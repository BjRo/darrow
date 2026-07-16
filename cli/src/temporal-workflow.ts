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
import type { ActivityInput, CommandResult, ResolvedPlan } from "./types";

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
  request: { version: number; reason: string; choices: string[] } | null;
}

type Continuation = {
  version: number;
  choice: "retry" | "amend" | "abort";
  model?: string;
};

export const runStatusQuery = defineQuery<WorkflowStatus>("darrowRunStatus");
export const continuationSignal =
  defineSignal<[Continuation]>("darrowContinue");

export async function runResolvedPlanWorkflow(
  input: WorkflowInput,
): Promise<CommandResult[]> {
  const attempts = new Map<string, CommandResult[]>(
    input.plan.steps.map((step) => [step.id, []]),
  );
  const steps = initialStepStatuses(input.plan.steps);
  let state: WorkflowStatus["state"] = "running";
  let request: WorkflowStatus["request"] = null;
  let continuation: Continuation | null = null;
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
  }));
  setHandler(continuationSignal, (value) => {
    if (request && value.version === request.version) continuation = value;
  });

  const waitForDecision = async (
    status: StepExecutionStatus,
    reason: string,
    choices: Continuation["choice"][],
  ): Promise<Continuation> => {
    const previousWait = waitQueue;
    let releaseWait!: () => void;
    waitQueue = new Promise<void>((resolve) => {
      releaseWait = resolve;
    });
    await previousWait;
    try {
      requestVersion += 1;
      request = { version: requestVersion, reason, choices };
      continuation = null;
      status.state = "waiting_for_input";
      state = "waiting_for_input";
      await condition(() => continuation !== null);
      const decision = continuation!;
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
          });
        } catch {
          await waitForDecision(status, "uncertain_activity", ["abort"]);
          return { state: "failed", stop: true };
        }

        attempts.get(step.id)!.push(result);
        if (result.status === "succeeded")
          return { state: "succeeded", value: result };
        if (result.error?.category !== "model_unavailable")
          return { state: "failed", value: result };

        const decision = await waitForDecision(status, "model_unavailable", [
          "retry",
          "amend",
          "abort",
        ]);
        if (decision.choice === "abort")
          return { state: "failed", value: result, stop: true };
        if (decision.choice === "amend") amendedModel = decision.model ?? null;
        attempt += 1;
      }
    },
    steps,
  );

  state = "completed";
  return orderedResults();
}
