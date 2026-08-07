import { describe, expect, test } from "bun:test";
import { renderSuiteReport } from "./report";
import type { CaseResult } from "./types";

function result(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: "oss-sample",
    invariant: "ORCH-OSS-SAMPLE",
    harness: "codex",
    model: "candidate-model",
    effort: "medium",
    condition: "vanilla",
    trials: [],
    passRate: 1,
    meanDurationMs: 1200,
    p95DurationMs: 1500,
    meanTokens: 420,
    totalCostUsd: null,
    humanReviewMinutes: null,
    meanChildInvocationCount: 0,
    totalHumanInterruptions: 0,
    meanJudgeScore: 4,
    judgePassRate: 1,
    ...overrides,
  };
}

describe("orchestration suite report", () => {
  test("separates deterministic outcomes, judge quality, and unknown cost", () => {
    const markdown = renderSuiteReport([
      {
        harness: "codex",
        mode: "vanilla",
        results: [result()],
      },
      {
        harness: "claude",
        mode: "darrow-goal-loop",
        results: [
          result({
            harness: "claude",
            condition: "darrow-goal-loop",
            passRate: 0.5,
            totalCostUsd: 1.25,
            meanChildInvocationCount: 2,
            totalHumanInterruptions: 1,
          }),
        ],
      },
    ]);
    expect(markdown).toContain("Deterministic pass");
    expect(markdown).toContain("Judge score");
    expect(markdown).toContain("codex | vanilla");
    expect(markdown).toContain("unknown");
    expect(markdown).toContain("$1.2500");
    expect(markdown).toContain("Human interventions");
    expect(markdown).toContain("Per-task outcomes");
  });
});
