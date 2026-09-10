import { describe, expect, test } from "bun:test";
import { renderSuiteReport } from "./report";
import type { CaseResult } from "./types";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function result(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: "oss-sample",
    invariant: "ORCH-OSS-SAMPLE",
    evaluationDigest: "sha256:shared-evaluation",
    passThreshold: 0.8,
    skillDirectory: "/fixture/skills/sample",
    mountPluginSkills: false,
    executionMode: "executed",
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
  test("reports observed enforcement rather than inferring it from the requested mode", () => {
    const sample = result({
      ownerEvaluationMode: "enforced",
      trials: [
        {
          executionMode: "executed",
          trial: 1,
          passed: true,
          checks: [],
          harness: {
            ok: true,
            durationMs: 1,
            inputTokens: 1,
            outputTokens: 1,
            costUsd: null,
            resultText: "Complete",
            raw: "",
            evaluationEnforcement: "passive",
          },
        },
      ],
    });
    const report = renderSuiteReport([
      { harness: "codex", mode: "diagnostic", results: [sample] },
    ]);
    expect(report).toContain("| Enforcement |");
    expect(report).toContain("| executed | passive |");
    delete sample.trials[0]!.harness.evaluationEnforcement;
    expect(
      renderSuiteReport([
        { harness: "codex", mode: "historical", results: [sample] },
      ]),
    ).toContain("| executed | unknown |");
  });
  test("mixed and unknown execution stay unmeasured without hiding executed cases", () => {
    const markdown = renderSuiteReport([
      {
        harness: "codex",
        mode: "mixed",
        results: [
          result({ caseId: "executed" }),
          result({ caseId: "prepared", executionMode: "dry" }),
        ],
      },
      {
        harness: "codex",
        mode: "historical",
        results: [result({ executionMode: undefined })],
      },
    ]);
    expect(markdown).toContain("| codex | mixed | n/a | n/a |");
    expect(markdown).toContain("| codex | mixed | executed | 100% | 100% |");
    expect(markdown).toContain("| codex | mixed | prepared | n/a | n/a |");
    expect(markdown).toContain("| codex | historical | n/a | n/a |");
    expect(markdown).toContain("unknown (unmeasured)");
  });

  test.each([true, false])(
    "historical report CLI uses explicit suite dry=%s provenance",
    async (dry) => {
      const root = await mkdtemp(join(tmpdir(), "darrow-report-provenance-"));
      try {
        const artifact = join(root, "result.json");
        const manifest = join(root, "suite-run.json");
        await writeFile(
          artifact,
          JSON.stringify([result({ executionMode: undefined })]),
        );
        await writeFile(
          manifest,
          JSON.stringify({
            dry,
            cells: [{ harness: "codex", mode: "historical", result: artifact }],
          }),
        );
        const proc = Bun.spawn(
          [process.execPath, join(import.meta.dir, "report.ts"), manifest],
          { stdout: "pipe", stderr: "pipe" },
        );
        expect(await proc.exited).toBe(0);
        const markdown = await readFile(join(root, "report.md"), "utf8");
        if (dry) {
          expect(markdown).toContain("dry (unmeasured)");
          expect(markdown).not.toContain("100%");
        } else
          expect(markdown).toContain("| codex | historical | 100% | 100% |");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  test("dry fixture checks never become behavioral success scores", () => {
    const dry = result({
      executionMode: "dry",
      trials: [
        {
          trial: 1,
          executionMode: "dry",
          passed: false,
          checks: [{ name: "README exists", passed: true, detail: "ok" }],
          harness: {
            ok: true,
            durationMs: 0,
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
      { harness: "codex", mode: "candidate", results: [dry] },
    ]);
    expect(markdown).toContain("dry (unmeasured)");
    expect(markdown).not.toMatch(/\d+%/);
  });

  test("separates task outcomes, protocol compliance, judge quality, and unknown cost", () => {
    const markdown = renderSuiteReport([
      {
        harness: "codex",
        mode: "vanilla",
        results: [result()],
      },
      {
        harness: "claude",
        mode: "darrow-adaptive-delivery",
        results: [
          result({
            harness: "claude",
            condition: "darrow-adaptive-delivery",
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
        mode: "darrow-adaptive-delivery",
        results: [
          result({
            condition: "darrow-adaptive-delivery",
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
      "| codex | darrow-adaptive-delivery | 0.1s | 0.2s | 300 | 1.0 | 0.9s | 120 |",
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
            observedSkills: ["grilling", "plan-implementation"],
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
      "| claude | candidate | grilling-negative | negative | grilling | grilling | grilling | 0% | 100% | harness event |",
    );
    expect(markdown).toContain(
      "| claude | candidate | grilling-positive | positive | grilling | grilling | grilling → plan-implementation | 100% | 100% | harness event |",
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
      "| claude | candidate | oss-sample | positive | grilling | unknown | unknown | unknown | 100% | harness event, unknown |",
    );
  });

  test("retains explicit activation source and ordered observations", () => {
    const value = result({
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
            source: "explicit_invocation",
            primarySkill: "grilling",
            observedSkills: ["grilling"],
          },
        },
      ],
    });
    const markdown = renderSuiteReport([
      { harness: "codex", mode: "candidate", results: [value] },
    ]);
    expect(markdown).toContain(
      "| codex | candidate | oss-sample | positive | grilling | grilling | grilling | 100% | 100% | explicit invocation |",
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
