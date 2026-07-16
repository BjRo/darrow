import { expect, test } from "bun:test";
import { waitForBoundary } from "../src/temporal";

test("closed abnormal Temporal workflows fail instead of polling forever", async () => {
  const handle = {
    query: async () => { throw new Error("query rejected because workflow closed"); },
    describe: async () => ({ status: { name: "FAILED" } }),
    result: async () => { throw new Error("activity timed out"); },
  };
  await expect(waitForBoundary(handle as never, { workflowId: "failed" })).rejects.toThrow("closed as FAILED");
});
