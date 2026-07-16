import { expect, test } from "bun:test";
import { WorkflowNotFoundError } from "@temporalio/client";
import { executionIdentity, reconcileWorkflowHandle, waitForBoundary } from "../src/temporal";

test("closed abnormal Temporal workflows fail instead of polling forever", async () => {
  const handle = {
    query: async () => { throw new Error("query rejected because workflow closed"); },
    describe: async () => ({ status: { name: "FAILED" } }),
    result: async () => { throw new Error("activity timed out"); },
  };
  await expect(waitForBoundary(handle as never, { workflowId: "failed" })).rejects.toThrow("closed as FAILED");
});

test("execution identity is deterministic per repository and run", () => {
  expect(executionIdentity("/repo", "run-1")).toEqual(executionIdentity("/repo", "run-1"));
  expect(executionIdentity("/repo", "run-1")).not.toEqual(executionIdentity("/repo", "run-2"));
});

test("an unconfirmed missing execution starts once with the same workflow ID", async () => {
  const missing = { describe: async () => { throw new WorkflowNotFoundError("missing", "workflow-1", undefined); } };
  const started = { describe: async () => ({ runId: "temporal-run-1" }) };
  let starts = 0;
  const workflow = {
    getHandle: () => missing,
    start: async (_workflow: unknown, options: { workflowId: string }) => {
      starts += 1;
      expect(options.workflowId).toBe("workflow-1");
      return started;
    },
  };
  const result = await reconcileWorkflowHandle(workflow as never, "workflow-1", "queue-1", {} as never, true);
  expect(result.recovery).toBe("started_pending");
  expect(result.runId).toBe("temporal-run-1");
  expect(starts).toBe(1);
});

test("a confirmed missing execution is never reconstructed from local state", async () => {
  const workflow = {
    getHandle: () => ({ describe: async () => { throw new WorkflowNotFoundError("missing", "workflow-1", undefined); } }),
    start: async () => { throw new Error("must not start"); },
  };
  await expect(reconcileWorkflowHandle(workflow as never, "workflow-1", "queue-1", {} as never, false)).rejects.toThrow("confirmed Temporal workflow is missing");
});
