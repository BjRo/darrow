import { describe, expect, test } from "bun:test";
import { renderSuiteReport } from "./report";
import type { CaseResult } from "./types";

function result(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: "oss-sample",
    invariant: "ORCH-OSS-SAMPLE",
    evaluationDigest: "sha256:shared-evaluation",
    passThreshold: 0.8,
    skillDirectory: "/fixture/skills/sample",
    mountPluginSkills: false,
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
    expect(markdown).toContain("## Effective routes");
    expect(markdown).toContain(
      "| codex | vanilla | codex/candidate-model@medium | not used | not used |",
    );
  });

  test("reports exact heterogeneous candidate and grader routes", () => {
    const harness = {
      ok: true,
      durationMs: 10,
      inputTokens: 1,
      outputTokens: 1,
      costUsd: null,
      resultText: "done",
      raw: "",
    };
    const terra = result({
      model: "gpt-5.6-terra",
      effort: "medium",
      trials: [
        {
          trial: 1,
          passed: true,
          checks: [],
          harness,
          judge: {
            ok: false,
            route: {
              harness: "codex",
              model: "gpt-5.6-sol",
              effort: "low",
            },
            parseError: "fixture",
            harness,
          },
          semanticOutput: {
            ok: true,
            route: {
              harness: "codex",
              model: "gpt-5.6-luna",
              effort: "low",
            },
            assessments: [],
            harness,
          },
        },
      ],
    });
    const override = result({
      caseId: "override",
      model: "candidate-override",
      effort: "xhigh",
    });
    const markdown = renderSuiteReport([
      { harness: "codex", mode: "candidate", results: [terra, override] },
    ]);
    expect(markdown).toContain(
      "| codex | candidate | codex/gpt-5.6-terra@medium, codex/candidate-override@xhigh | codex/gpt-5.6-sol@low | codex/gpt-5.6-luna@low |",
    );
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
          }),
        ],
      },
    ]);
    expect(markdown).toContain("Preflight and native execution phases");
    expect(markdown).toContain(
      "| codex | darrow-goal-loop | 0.1s | 0.2s | 300 | 1.0 | 0.9s | 120 |",
    );
  });

  test("uses a generic title when the suite has no orchestration evidence", () => {
    const markdown = renderSuiteReport([
      {
        harness: "codex",
        mode: "candidate",
        results: [
          result({
            meanChildInvocationCount: undefined,
            totalHumanInterruptions: undefined,
          }),
        ],
      },
    ]);
    expect(markdown).toStartWith("# Evaluation suite report");
  });

  test("counts a failed harness as a failed task even when checks pass", () => {
    const value = result({
      passRate: 0,
      trials: [
        {
          trial: 1,
          passed: false,
          checks: [{ name: "outcome", passed: true, detail: "" }],
          harness: {
            ok: false,
            durationMs: 10,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: null,
            resultText: "",
            raw: "",
          },
        },
      ],
    });
    const markdown = renderSuiteReport([
      { harness: "codex", mode: "candidate", results: [value] },
    ]);
    expect(markdown).toContain("| codex | candidate | 0% | 0% |");
  });

  test("marks partial judge and child metrics unknown", () => {
    const judged = result({
      trials: [],
      meanJudgeScore: 5,
      judgePassRate: 1,
      meanChildInvocationCount: 2,
    });
    const missing = result({
      caseId: "second",
      trials: [],
      meanJudgeScore: undefined,
      judgePassRate: undefined,
      meanChildInvocationCount: undefined,
    });
    const markdown = renderSuiteReport([
      {
        harness: "codex",
        mode: "candidate",
        results: [judged, missing],
      },
    ]);
    expect(markdown).toContain(
      "| codex | candidate | 100% | 100% | n/a | n/a |",
    );
    expect(markdown).toContain("unknown | unknown |");
  });

  test("does not average one measured orchestration trial with one missing trial", () => {
    const value = result({
      meanChildInvocationCount: undefined,
      totalHumanInterruptions: undefined,
      escapedDefects: undefined,
      falsePositiveVerifierFindings: undefined,
      meanJudgeScore: undefined,
      judgePassRate: undefined,
      trials: [
        {
          trial: 1,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: null,
            resultText: "",
            raw: "",
          },
          orchestrationMetrics: {
            childInvocationCount: 2,
            humanInterruptions: 0,
            escapedDefects: 0,
            falsePositiveVerifierFindings: 0,
          },
        },
        {
          trial: 2,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: null,
            resultText: "",
            raw: "",
          },
        },
      ],
    });
    const markdown = renderSuiteReport([
      { harness: "codex", mode: "candidate", results: [value] },
    ]);
    expect(markdown).toContain(
      "| codex | candidate | 100% | 100% | n/a | n/a |",
    );
    expect(markdown).toContain("| unknown | n/a | n/a |");
  });

  test("reports activation recall and precision separately from task outcomes", () => {
    const positive = result({
      caseId: "grilling-positive",
      activationClass: "positive",
      activationTargetSkill: "grilling",
      activationPassRate: 1,
      trials: [
        {
          trial: 1,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 1,
            outputTokens: 1,
            costUsd: null,
            resultText: "done",
            raw: "",
          },
          activation: {
            class: "positive",
            targetSkill: "grilling",
            passed: true,
            source: "harness_event",
            primarySkill: "grilling",
            observedSkills: ["grilling"],
          },
        },
      ],
    });
    const negative = result({
      caseId: "grilling-negative",
      activationClass: "negative",
      activationTargetSkill: "grilling",
      activationPassRate: 0,
      trials: [
        {
          trial: 1,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 1,
            outputTokens: 1,
            costUsd: null,
            resultText: "done",
            raw: "",
          },
          activation: {
            class: "negative",
            targetSkill: "grilling",
            passed: false,
            source: "harness_event",
            primarySkill: "grilling",
            observedSkills: ["grilling"],
          },
        },
      ],
    });

    const markdown = renderSuiteReport([
      {
        harness: "claude",
        mode: "candidate",
        results: [positive, negative],
      },
    ]);
    expect(markdown).toContain("## Skill activation");
    expect(markdown).toContain(
      "| claude | candidate | 100% | 50% | 100% | 0% | n/a | harness event |",
    );
    expect(markdown).toContain(
      "| claude | candidate | grilling-negative | negative | grilling | grilling | 0% | 100% | harness event |",
    );
  });

  test("marks the whole activation rollup unknown when one trial is unobservable", () => {
    const value = result({
      activationClass: "positive",
      activationTargetSkill: "grilling",
      activationPassRate: null,
      trials: [
        {
          trial: 1,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 1,
            outputTokens: 1,
            costUsd: null,
            resultText: "done",
            raw: "",
          },
          activation: {
            class: "positive",
            targetSkill: "grilling",
            passed: true,
            source: "harness_event",
            primarySkill: "grilling",
            observedSkills: ["grilling"],
          },
        },
        {
          trial: 2,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 1,
            outputTokens: 1,
            costUsd: null,
            resultText: "done",
            raw: "",
          },
          activation: {
            class: "positive",
            targetSkill: "grilling",
            passed: null,
            source: null,
            primarySkill: null,
            observedSkills: [],
          },
        },
      ],
    });
    const markdown = renderSuiteReport([
      { harness: "claude", mode: "candidate", results: [value] },
    ]);
    expect(markdown).toContain(
      "| claude | candidate | unknown | unknown | unknown | unknown | unknown | harness event, unknown |",
    );
    expect(markdown).toContain(
      "| claude | candidate | oss-sample | positive | grilling | unknown | unknown | 100% | harness event, unknown |",
    );
  });

  test("counts a wrong competition primary as a false selection", () => {
    const value = result({
      activationClass: "competition",
      activationTargetSkill: "discover-feature",
      activationPassRate: 0,
      trials: [
        {
          trial: 1,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 10,
            inputTokens: 1,
            outputTokens: 1,
            costUsd: null,
            resultText: "done",
            raw: "",
          },
          activation: {
            class: "competition",
            targetSkill: "discover-feature",
            passed: false,
            source: "harness_event",
            primarySkill: "plan-implementation",
            observedSkills: ["plan-implementation"],
          },
        },
      ],
    });
    const markdown = renderSuiteReport([
      { harness: "claude", mode: "candidate", results: [value] },
    ]);
    expect(markdown).toContain(
      "| claude | candidate | 0% | 0% | n/a | n/a | 0% | harness event |",
    );
  });
});
