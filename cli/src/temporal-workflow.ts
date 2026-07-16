import { condition, defineQuery, defineSignal, proxyActivities, setHandler } from "@temporalio/workflow";
import type { ActivityInput, CommandResult, ResolvedPlan } from "./types";

const { executeCommand } = proxyActivities<{ executeCommand(input: ActivityInput): Promise<CommandResult> }>({
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
  request: { version: number; reason: string; choices: string[] } | null;
}

export const runStatusQuery = defineQuery<WorkflowStatus>("darrowRunStatus");
export const continuationSignal = defineSignal<[ { version: number; choice: "retry" | "amend" | "abort"; model?: string } ]>("darrowContinue");

export async function runResolvedPlanWorkflow(input: WorkflowInput): Promise<CommandResult[]> {
  const results: CommandResult[] = [];
  let state: WorkflowStatus["state"] = "running";
  let request: WorkflowStatus["request"] = null;
  let continuation: { version: number; choice: "retry" | "amend" | "abort"; model?: string } | null = null;
  let amendedModel: string | null = null;
  setHandler(runStatusQuery, () => ({ state, results, request }));
  setHandler(continuationSignal, (value) => {
    if (request && value.version === request.version) continuation = value;
  });
  for (let index = 0; index < input.plan.steps.length; index += 1) {
    const step = input.plan.steps[index]!;
    let attempt = 1;
    while (true) {
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
          profile: amendedModel ? { ...input.plan.profile, model: amendedModel } : input.plan.profile,
          attemptId: `attempt-${index + 1}-${attempt}`,
        });
      } catch {
        state = "waiting_for_input";
        request = { version: attempt, reason: "uncertain_activity", choices: ["abort"] };
        continuation = null;
        await condition(() => continuation !== null);
        state = "completed";
        return results;
      }
      results.push(result);
      if (result.status === "succeeded") break;
      if (result.error?.category !== "model_unavailable") {
        state = "completed";
        return results;
      }
      state = "waiting_for_input";
      request = { version: attempt, reason: "model_unavailable", choices: ["retry", "amend", "abort"] };
      continuation = null;
      await condition(() => continuation !== null);
      if ((continuation as unknown as { choice: string }).choice === "abort") {
        state = "completed";
        return results;
      }
      const response = continuation as unknown as { choice: string; model?: string };
      if (response.choice === "amend") amendedModel = response.model ?? null;
      attempt += 1;
      state = "running";
      request = null;
    }
  }
  state = "completed";
  return results;
}
