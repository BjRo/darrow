import { describe, expect, test } from "bun:test";
import { executionNodes, loopOutcome, loopSatisfied } from "../src/convergence";
import type { CommandResult, ResolvedPlan } from "../src/types";

const loop = {
  id: "implementation-review",
  steps: ["implement", "review"],
  maxAttempts: 3,
  until: { stepId: "review", output: "approved", equals: true },
  waiver: null,
};

const route = {
  routeId: `sha256:${"a".repeat(64)}`,
  profileId: "codex",
  profileDigest: `sha256:${"b".repeat(64)}`,
  harness: "codex",
  provider: "openai",
  model: "gpt-5.6-sol",
  reasoningEffort: "high",
  permissions: { inherit: true },
  limits: {},
  adapter: { id: "codex-cli", version: "0.1.0" },
  selectionSource: "fixed_plan",
} as const;

function result(approved: unknown): CommandResult {
  return {
    invocationId: "invocation-1",
    status: "succeeded",
    commandId: "test:review",
    contractVersion: "0.1.0",
    implementationVersion: "0.1.0",
    route,
    payload: { approved },
    artifacts: [],
    timing: { startedAt: "start", finishedAt: "finish" },
  };
}

describe("M2 bounded convergence", () => {
  test("collapses a loop into one schedulable node without exposing its back edge", () => {
    const plan = {
      loops: [loop],
      steps: [
        { id: "prepare", dependsOn: [] },
        { id: "implement", dependsOn: ["prepare"] },
        { id: "review", dependsOn: ["implement"] },
        { id: "publish", dependsOn: ["review"] },
      ],
    } as ResolvedPlan;
    expect(executionNodes(plan)).toEqual([
      {
        id: "prepare",
        dependsOn: [],
        stepIds: ["prepare"],
        loop: null,
      },
      {
        id: "review",
        dependsOn: ["prepare"],
        stepIds: ["implement", "review"],
        loop,
      },
      {
        id: "publish",
        dependsOn: ["review"],
        stepIds: ["publish"],
        loop: null,
      },
    ]);
  });

  test("compares only the declared scalar outcome", () => {
    expect(loopSatisfied(loop, result(true))).toBe(true);
    expect(loopSatisfied(loop, result(false))).toBe(false);
    expect(loopOutcome(loop, result(false))).toBe(false);
    expect(() => loopOutcome(loop, result({ invalid: true }))).toThrow(
      "invalid scalar output",
    );
  });
});
