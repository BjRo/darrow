import {
  ActivityCancellationType,
  CancellationScope,
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import { executionNodes, loopOutcome, loopSatisfied } from "./convergence";
import {
  executeStaticGraph,
  initialStepStatuses,
  type StepExecutionStatus,
} from "./scheduler";
import type {
  ActivityInput,
  ArtifactReference,
  CancellationRequest,
  CancellationSummary,
  CommandResult,
  ContentReference,
  HumanChoice,
  HumanRequest,
  HumanResponse,
  ResolvedPlan,
  WaiverRecord,
} from "./types";

const { executeCommand } = proxyActivities<{
  executeCommand(input: ActivityInput): Promise<CommandResult>;
}>({
  startToCloseTimeout: "6 hours",
  cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
  heartbeatTimeout: "30 seconds",
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
  waivers: WaiverRecord[];
  cancellation: CancellationSummary | null;
}

export const runStatusQuery = defineQuery<WorkflowStatus>("darrowRunStatus");
export const continuationSignal =
  defineSignal<[HumanResponse]>("darrowContinue");
export const cancellationSignal =
  defineSignal<[CancellationRequest]>("darrowCancel");

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
    (response.rationale === null ||
      validContentReference(response.rationale)) &&
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
  const attemptCounts = new Map(input.plan.steps.map((step) => [step.id, 0]));
  const waivers: WaiverRecord[] = [];
  const forwardInstructions = new Map<string, ContentReference[]>();
  let state: WorkflowStatus["state"] = "running";
  let request: WorkflowStatus["request"] = null;
  let continuation: HumanResponse | null = null;
  let lastResponse: WorkflowStatus["lastResponse"] = null;
  let amendedModel: string | null = null;
  let requestVersion = 0;
  let waitQueue = Promise.resolve();
  let cancellationRequest: CancellationRequest | null = null;
  const cancellableActivities = new Map<string, CancellationScope>();
  const uncertainSteps = new Set<string>();

  const orderedResults = (): CommandResult[] =>
    input.plan.steps.flatMap((step) => attempts.get(step.id) ?? []);

  const cancellationSummary = (): CancellationSummary | null => {
    if (!cancellationRequest) return null;
    const completed = steps
      .filter((step) =>
        ["succeeded", "accepted_with_waiver", "failed"].includes(step.state),
      )
      .map((step) => step.stepId);
    const uncertain = steps
      .filter((step) => uncertainSteps.has(step.stepId))
      .map((step) => step.stepId);
    const incomplete = steps
      .filter(
        (step) =>
          !completed.includes(step.stepId) && !uncertainSteps.has(step.stepId),
      )
      .map((step) => step.stepId);
    return { ...cancellationRequest, completed, incomplete, uncertain };
  };

  const requestCancellation = (value?: CancellationRequest): void => {
    cancellationRequest ??= value ?? {
      requestedAt: new Date().toISOString(),
    };
    request = null;
    continuation = null;
    for (const scope of cancellableActivities.values()) scope.cancel();
  };

  setHandler(runStatusQuery, () => ({
    state,
    results: orderedResults(),
    steps,
    request,
    lastResponse,
    waivers,
    cancellation: cancellationSummary(),
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
      (value.choice === "waive"
        ? value.rationale !== null && value.rationale.size > 0
        : value.rationale === null) &&
      (value.choice !== "amend" || Boolean(value.model))
    )
      continuation = value;
  });
  setHandler(cancellationSignal, (value) => {
    if (
      value &&
      typeof value.requestedAt === "string" &&
      !Number.isNaN(Date.parse(value.requestedAt))
    )
      requestCancellation(value);
  });

  const waitForDecision = async (
    status: StepExecutionStatus,
    reason: string,
    question: string,
    choices: HumanChoice[],
    context: HumanRequest["context"] = [],
  ): Promise<HumanResponse | null> => {
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
        context,
      };
      continuation = null;
      status.state = "waiting_for_input";
      state = "waiting_for_input";
      await condition(
        () => continuation !== null || cancellationRequest !== null,
      );
      if (cancellationRequest) {
        request = null;
        continuation = null;
        status.state = "cancelled";
        state = "running";
        return null;
      }
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

  const invokeStep = async (
    step: ResolvedPlan["steps"][number],
    status: StepExecutionStatus,
    initialInstructions: ContentReference[],
    priorArtifacts: ArtifactReference[],
  ): Promise<{
    result: CommandResult | null;
    aborted: boolean;
    cancelled: boolean;
  }> => {
    const instructions = [...initialInstructions];
    while (true) {
      if (cancellationRequest) {
        status.state = "cancelled";
        return { result: null, aborted: false, cancelled: true };
      }
      const attempt = (attemptCounts.get(step.id) ?? 0) + 1;
      attemptCounts.set(step.id, attempt);
      status.state = "running";
      status.attempt = attempt;
      let result: CommandResult;
      const activityScope = new CancellationScope();
      if (step.cancellation === "interrupt")
        cancellableActivities.set(step.id, activityScope);
      try {
        result = await activityScope.run(() =>
          executeCommand({
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
            priorArtifacts,
          }),
        );
      } catch {
        if (cancellationRequest && step.cancellation === "interrupt") {
          uncertainSteps.add(step.id);
          status.state = "cancelled";
          return { result: null, aborted: false, cancelled: true };
        }
        const decision = await waitForDecision(
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
        requestCancellation();
        status.state = decision ? "failed" : "cancelled";
        return { result: null, aborted: true, cancelled: true };
      } finally {
        cancellableActivities.delete(step.id);
      }

      attempts.get(step.id)!.push(result);
      if (result.status === "succeeded") {
        status.state = "succeeded";
        return {
          result,
          aborted: false,
          cancelled: cancellationRequest !== null,
        };
      }
      if (result.error?.category !== "model_unavailable") {
        status.state = "failed";
        return {
          result,
          aborted: false,
          cancelled: cancellationRequest !== null,
        };
      }

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
            consequence: "Retry this step with the explicitly supplied model.",
            acceptsInstructions: true,
          },
          {
            id: "abort",
            consequence: "Cancel the run without another attempt.",
            acceptsInstructions: false,
          },
        ],
      );
      if (!decision || decision.choice === "abort") {
        requestCancellation();
        status.state = decision ? "failed" : "cancelled";
        return { result, aborted: true, cancelled: true };
      }
      if (decision.choice === "amend") amendedModel = decision.model ?? null;
      if (decision.instructions) instructions.push(decision.instructions);
    }
  };

  const nodes = executionNodes(input.plan);
  const nodeStatuses = initialStepStatuses(nodes);
  await executeStaticGraph<CommandResult>(
    nodes,
    async (scheduledNode) => {
      const node = nodes.find((item) => item.id === scheduledNode.id)!;
      if (!node.loop) {
        const step = input.plan.steps.find((item) => item.id === node.id)!;
        const status = steps.find((item) => item.stepId === step.id)!;
        const instructions = forwardInstructions.get(step.id) ?? [];
        const outcome = await invokeStep(step, status, instructions, []);
        return outcome.result?.status === "succeeded"
          ? {
              state: "succeeded",
              value: outcome.result,
              stop: outcome.cancelled,
            }
          : {
              state: "failed",
              ...(outcome.result ? { value: outcome.result } : {}),
              stop: outcome.aborted || outcome.cancelled,
            };
      }

      const loop = node.loop;
      const priorArtifacts: ArtifactReference[] = [];
      let retryInstructions = [
        ...(forwardInstructions.get(loop.steps[0]!) ?? []),
      ];
      for (let iteration = 1; iteration <= loop.maxAttempts; iteration += 1) {
        let finalResult: CommandResult | null = null;
        for (let index = 0; index < loop.steps.length; index += 1) {
          const stepId = loop.steps[index]!;
          const step = input.plan.steps.find((item) => item.id === stepId)!;
          const status = steps.find((item) => item.stepId === stepId)!;
          const outcome = await invokeStep(
            step,
            status,
            index === 0 ? retryInstructions : [],
            priorArtifacts,
          );
          if (!outcome.result || outcome.result.status === "failed") {
            for (const remaining of loop.steps.slice(index + 1)) {
              const remainingStatus = steps.find(
                (item) => item.stepId === remaining,
              )!;
              remainingStatus.state = outcome.cancelled
                ? "cancelled"
                : "blocked";
            }
            return {
              state: "failed",
              ...(outcome.result ? { value: outcome.result } : {}),
              stop: outcome.aborted || outcome.cancelled,
            };
          }
          finalResult = outcome.result;
          priorArtifacts.push(...outcome.result.artifacts);
          if (outcome.cancelled)
            return { state: "succeeded", value: outcome.result, stop: true };
        }

        if (loopSatisfied(loop, finalResult!))
          return { state: "succeeded", value: finalResult! };

        const actual = loopOutcome(loop, finalResult!);
        const finalStatus = steps.find(
          (item) => item.stepId === loop.until.stepId,
        )!;
        const choices: HumanChoice[] = [];
        if (iteration < loop.maxAttempts)
          choices.push({
            id: "retry",
            consequence: `Run loop ${loop.id} again; at most ${loop.maxAttempts - iteration} additional attempt(s) remain.`,
            acceptsInstructions: true,
          });
        if (loop.waiver)
          choices.push({
            id: "waive",
            consequence: `${loop.waiver.description} A rationale is required.`,
            acceptsInstructions: loop.waiver.instructionsTo !== null,
          });
        choices.push({
          id: "abort",
          consequence: "Cancel the run without accepting this outcome.",
          acceptsInstructions: false,
        });
        const decision = await waitForDecision(
          finalStatus,
          "loop_outcome",
          `Loop ${loop.id} did not satisfy its declared outcome. How should Darrow proceed?`,
          choices,
          [
            {
              label: "Expected outcome",
              reference: `${loop.until.output}=${JSON.stringify(loop.until.equals)}`,
            },
            {
              label: "Actual outcome",
              reference: `${loop.until.output}=${JSON.stringify(actual)}`,
            },
            ...finalResult!.artifacts.map((artifact) => ({
              label: "Outcome artifact",
              reference: artifact.location,
            })),
          ],
        );
        if (!decision || decision.choice === "abort") {
          requestCancellation();
          finalStatus.state = decision ? "failed" : "cancelled";
          return { state: "failed", value: finalResult!, stop: true };
        }
        if (decision.choice === "waive") {
          const declaration = loop.waiver!;
          const waiver: WaiverRecord = {
            waiverId: `${declaration.id}-${iteration}`,
            loopId: loop.id,
            stepId: loop.until.stepId,
            attempt: finalStatus.attempt,
            outcome: {
              output: loop.until.output,
              expected: loop.until.equals,
              actual,
            },
            actor: decision.actor,
            rationale: decision.rationale!,
            instructions: decision.instructions,
            instructionsTo: declaration.instructionsTo,
          };
          waivers.push(waiver);
          finalStatus.state = "accepted_with_waiver";
          if (decision.instructions && declaration.instructionsTo)
            forwardInstructions.set(declaration.instructionsTo, [
              decision.instructions,
            ]);
          return { state: "succeeded", value: finalResult! };
        }
        retryInstructions = decision.instructions
          ? [decision.instructions]
          : [];
      }
      throw new Error(`bounded loop ${loop.id} exhausted without a decision`);
    },
    nodeStatuses,
  );

  for (const nodeStatus of nodeStatuses) {
    if (nodeStatus.state !== "blocked") continue;
    const node = nodes.find((item) => item.id === nodeStatus.stepId)!;
    for (const stepId of node.stepIds) {
      const status = steps.find((item) => item.stepId === stepId)!;
      if (status.state === "pending")
        status.state = cancellationRequest ? "cancelled" : "blocked";
    }
  }

  if (cancellationRequest)
    for (const status of steps)
      if (
        ["pending", "running", "waiting_for_input", "blocked"].includes(
          status.state,
        )
      )
        status.state = "cancelled";

  state = "completed";
  return orderedResults();
}
