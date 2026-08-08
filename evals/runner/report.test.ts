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
  test("separates task outcomes, protocol compliance, judge quality, and unknown cost", () => {
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
    expect(markdown).toContain("Task pass");
    expect(markdown).toContain("Protocol pass");
    expect(markdown).toContain("Judge score");
    expect(markdown).toContain("codex | vanilla");
    expect(markdown).toContain("unknown");
    expect(markdown).toContain("$1.2500");
    expect(markdown).toContain("Human interventions");
    expect(markdown).toContain("Per-task outcomes");
  });

  test("does not treat missing bookkeeping records as a task failure", () => {
    const markdown = renderSuiteReport([
      {
        harness: "claude",
        mode: "native-goal",
        results: [
          result({
            harness: "claude",
            condition: "native-goal",
            passRate: 0,
            trials: [
              {
                trial: 1,
                passed: false,
                checks: [
                  {
                    name: "hidden product contract",
                    passed: true,
                    detail: "ok",
                  },
                  {
                    name: "reported child invocation count",
                    passed: false,
                    detail: "missing",
                  },
                ],
                harness: {
                  ok: true,
                  durationMs: 1,
                  inputTokens: 1,
                  outputTokens: 1,
                  costUsd: null,
                  resultText: "done",
                  raw: "",
                },
              },
            ],
          }),
        ],
      },
    ]);
    expect(markdown).toContain("| claude | native-goal | 100% | 0% |");
  });

  test("reports prepared classifier and native execution phases separately", () => {
    const markdown = renderSuiteReport([
      {
        harness: "codex",
        mode: "darrow-goal-loop",
        results: [
          result({
            condition: "darrow-goal-loop",
            meanPreparationDurationMs: 100,
            meanClassifierDurationMs: 200,
            meanClassifierTokens: 300,
            meanClassifierModelCalls: 1,
            meanExecutionDurationMs: 900,
            meanExecutionTokens: 120,
          } as any),
        ],
      },
    ]);
    expect(markdown).toContain("Preflight and native execution phases");
    expect(markdown).toContain(
      "| codex | darrow-goal-loop | 0.1s | 0.2s | 300 | 1.0 | 0.9s | 120 |",
    );
  });
});
