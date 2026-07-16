import {
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import {
  executeStaticGraph,
  initialStepStatuses,
  type StepExecutionStatus,
} from "./scheduler";
import type {
  ActivityInput,
  CommandResult,
  ContentReference,
  HumanChoice,
  HumanRequest,
  HumanResponse,
  ResolvedPlan,
} from "./types";

const { executeCommand } = proxyActivities<{
  executeCommand(input: ActivityInput): Promise<CommandResult>;
}>({
  startToCloseTimeout: "6 hours",
  retry: { maximumAttempts: 1 },
});

export interface WorkflowInput {
  runId: string;
  repoRoot: string;
  runDir: string;
  workspace: string;
  snapshotDir: string;
  plan: ResolvedPlan;
}

export interface WorkflowStatus {
  state: "running" | "waiting_for_input" | "completed";
  results: CommandResult[];
  steps: StepExecutionStatus[];
  request: HumanRequest | null;
  lastResponse: Pick<HumanResponse, "requestId" | "version"> | null;
}

export const runStatusQuery = defineQuery<WorkflowStatus>("darrowRunStatus");
export const continuationSignal =
  defineSignal<[HumanResponse]>("darrowContinue");

function validContentReference(value: unknown): value is ContentReference {
  if (!value || typeof value !== "object") return false;
  const reference = value as Record<string, unknown>;
  return (
    typeof reference.contentId === "string" &&
    reference.mediaType === "text/plain" &&
    typeof reference.contentHash === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(reference.contentHash) &&
    Number.isSafeInteger(reference.size) &&
    Number(reference.size) >= 0 &&
    typeof reference.location === "string"
  );
}

function validHumanResponse(value: unknown): value is HumanResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  const actor = response.actor as Record<string, unknown> | null;
  return (
    typeof response.requestId === "string" &&
    Number.isSafeInteger(response.version) &&
    Number(response.version) >= 1 &&
    typeof response.choice === "string" &&
    actor !== null &&
    (actor.id === null || typeof actor.id === "string") &&
    (actor.harness === null || typeof actor.harness === "string") &&
    actor.verified === false &&
    (response.instructions === null ||
      validContentReference(response.instructions)) &&
    (response.model === undefined || typeof response.model === "string")
  );
}

export async function runResolvedPlanWorkflow(
  input: WorkflowInput,
): Promise<CommandResult[]> {
  const attempts = new Map<string, CommandResult[]>(
    input.plan.steps.map((step) => [step.id, []]),
  );
  const steps = initialStepStatuses(input.plan.steps);
  let state: WorkflowStatus["state"] = "running";
  let request: WorkflowStatus["request"] = null;
  let continuation: HumanResponse | null = null;
  let lastResponse: WorkflowStatus["lastResponse"] = null;
  let amendedModel: string | null = null;
  let requestVersion = 0;
  let waitQueue = Promise.resolve();

  const orderedResults = (): CommandResult[] =>
    input.plan.steps.flatMap((step) => attempts.get(step.id) ?? []);

  setHandler(runStatusQuery, () => ({
    state,
    results: orderedResults(),
    steps,
    request,
    lastResponse,
  }));
  setHandler(continuationSignal, (value) => {
    if (
      validHumanResponse(value) &&
      request &&
      continuation === null &&
      value.requestId === request.requestId &&
      value.version === request.version &&
      request.choices.some(
        (choice) =>
          choice.id === value.choice &&
          (value.instructions === null || choice.acceptsInstructions),
      ) &&
      (value.choice !== "amend" || Boolean(value.model))
    )
      continuation = value;
  });

  const waitForDecision = async (
    status: StepExecutionStatus,
    reason: string,
    question: string,
    choices: HumanChoice[],
  ): Promise<HumanResponse> => {
    const previousWait = waitQueue;
    let releaseWait!: () => void;
    waitQueue = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    await previousWait;
    try {
      requestVersion += 1;
      request = {
        requestId: `${status.stepId}-${reason.replaceAll("_", "-")}-${requestVersion}`,
        version: requestVersion,
        stepId: status.stepId,
        reason,
        question,
        choices,
        context: [],
      };
      continuation = null;
      status.state = "waiting_for_input";
      state = "waiting_for_input";
      await condition(() => continuation !== null);
      const decision = continuation!;
      lastResponse = {
        requestId: decision.requestId,
        version: decision.version,
      };
      request = null;
      continuation = null;
      status.state = "running";
      state = "running";
      return decision;
    } finally {
      releaseWait();
    }
  };

  await executeStaticGraph(
    input.plan.steps,
    async (scheduledStep, status) => {
      const step = input.plan.steps.find(
        (item) => item.id === scheduledStep.id,
      )!;
      let attempt = 1;
      const instructions: ContentReference[] = [];
      while (true) {
        status.attempt = attempt;
        let result: CommandResult;
        try {
          result = await executeCommand({
            runId: input.runId,
            repoRoot: input.repoRoot,
            runDir: input.runDir,
            workspace: input.workspace,
            snapshotDir: input.snapshotDir,
            step,
            planCapabilities: input.plan.capabilities,
            profile: amendedModel
              ? { ...input.plan.profile, model: amendedModel }
              : input.plan.profile,
            attemptId: `attempt-${step.id}-${attempt}`,
            instructions,
          });
        } catch {
          await waitForDecision(
            status,
            "uncertain_activity",
            "The activity ended without a trustworthy outcome. Abort this run?",
            [
              {
                id: "abort",
                consequence:
                  "Cancel the run without retrying the uncertain effect.",
                acceptsInstructions: false,
              },
            ],
          );
          return { state: "failed", stop: true };
        }

        attempts.get(step.id)!.push(result);
        if (result.status === "succeeded")
          return { state: "succeeded", value: result };
        if (result.error?.category !== "model_unavailable")
          return { state: "failed", value: result };

        const decision = await waitForDecision(
          status,
          "model_unavailable",
          "How should Darrow proceed after the selected model was unavailable?",
          [
            {
              id: "retry",
              consequence: "Retry this step with the same model.",
              acceptsInstructions: true,
            },
            {
              id: "amend",
              consequence:
                "Retry this step with the explicitly supplied model.",
              acceptsInstructions: true,
            },
            {
              id: "abort",
              consequence: "Cancel the run without another attempt.",
              acceptsInstructions: false,
            },
          ],
        );
        if (decision.choice === "abort")
          return { state: "failed", value: result, stop: true };
        if (decision.choice === "amend") amendedModel = decision.model ?? null;
        if (decision.instructions) instructions.push(decision.instructions);
        attempt += 1;
      }
    },
    steps,
  );

  state = "completed";
  return orderedResults();
}
