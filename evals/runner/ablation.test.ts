import { describe, expect, test } from "bun:test";
import {
  analyzeAblations,
  renderAblationReport,
  validateAblationDefinitions,
} from "./ablation";
import type { ReportCell } from "./report";
import type { CaseResult } from "./types";

function result(overrides: Partial<CaseResult> = {}): CaseResult {
  return {
    caseId: "discovery-sample",
    invariant: "DF-C1",
    evaluationDigest: "sha256:shared-evaluation",
    passThreshold: 0.8,
    skillDirectory: "/fixture/skills/discover-feature",
    mountPluginSkills: false,
    executionMode: "executed",
    harness: "codex",
    harnessVersion: "codex 1.2.3",
    model: "gpt-test",
    effort: "medium",
    trials: [
      {
        trial: 1,
        passed: true,
        checks: [],
        harness: {
          ok: true,
          durationMs: 1_000,
          inputTokens: 100,
          outputTokens: 20,
          costUsd: null,
          resultText: "",
          raw: "",
        },
      },
    ],
    passRate: 1,
    meanDurationMs: 1_000,
    p95DurationMs: 1_000,
    meanTokens: 120,
    totalCostUsd: null,
    humanReviewMinutes: null,
    ...overrides,
  };
}

function cell(mode: string, value: CaseResult): ReportCell {
  return {
    harness: value.harness,
    mode,
    results: [
      mode === "without-skill"
        ? { ...value, skillDirectory: null, mountPluginSkills: false }
        : value,
    ],
  };
}

describe("skill ablation", () => {
  test("dry and unknown results cannot establish a skill comparison", () => {
    for (const executionMode of ["dry", "unknown"] as const) {
      const analysis = analyzeAblations(
        [
          cell("without-skill", result({ executionMode })),
          cell("candidate", result({ executionMode })),
        ],
        [
          {
            name: "discovery-value",
            baseline: "without-skill",
            candidate: "candidate",
          },
        ],
        0.8,
        1,
      );
      expect(analysis.valid).toBe(false);
      expect(
        analysis.comparisons.flatMap((comparison) => comparison.cases),
      ).toEqual([]);
      expect(renderAblationReport(analysis)).toContain("unmeasured");
    }
  });

  test("renders task-level improvement and preserves unknown measurements", () => {
    const analysis = analyzeAblations(
      [
        cell(
          "without-skill",
          result({ passRate: 0, meanDurationMs: 600, meanTokens: 80 }),
        ),
        cell("candidate", result()),
      ],
      [
        {
          name: "discovery-value",
          baseline: "without-skill",
          candidate: "candidate",
        },
      ],
      0.8,
      1,
    );

    expect(analysis.valid).toBe(true);
    expect(analysis.comparisons[0]?.cases[0]?.passRateDelta).toBe(1);
    const markdown = renderAblationReport(analysis);
    expect(markdown).toContain("discovery-value");
    expect(markdown).toContain("0% → 100% (+100pp)");
    expect(markdown).toContain("unknown → unknown (delta unknown)");
  });

  test("preserves a reported measurement when only one side is unknown", () => {
    const analysis = analyzeAblations(
      [
        cell("without-skill", result({ meanTokens: null })),
        cell("candidate", result({ meanTokens: 120 })),
      ],
      [
        {
          name: "discovery-value",
          baseline: "without-skill",
          candidate: "candidate",
        },
      ],
      0.8,
      1,
    );
    expect(renderAblationReport(analysis)).toContain(
      "unknown → 120 (delta unknown)",
    );
  });

  test("shows regressions rather than hiding them in an aggregate", () => {
    const analysis = analyzeAblations(
      [
        cell("without-skill", result()),
        cell("candidate", result({ passRate: 0 })),
      ],
      [
        {
          name: "discovery-value",
          baseline: "without-skill",
          candidate: "candidate",
        },
      ],
      0.8,
      1,
    );
    expect(renderAblationReport(analysis)).toContain("100% → 0% (-100pp)");
  });

  test("rejects mismatched result dimensions and missing cases", () => {
    for (const candidate of [
      result({ harnessVersion: "codex 9.9.9" }),
      result({ evaluationDigest: "sha256:different-evaluation" }),
      result({ passThreshold: 0.9 }),
      result({ model: "other-model" }),
      result({ effort: "high" }),
      result({ trials: [] }),
      result({ caseId: "other-case" }),
    ]) {
      const analysis = analyzeAblations(
        [cell("without-skill", result()), cell("candidate", candidate)],
        [
          {
            name: "discovery-value",
            baseline: "without-skill",
            candidate: "candidate",
          },
        ],
        0.8,
        1,
      );
      expect(analysis.valid).toBe(false);
      expect(analysis.errors.length).toBeGreaterThan(0);
    }
  });

  test("requires the baseline to omit and candidate to mount a skill", () => {
    const definition = [
      {
        name: "discovery-value",
        baseline: "baseline",
        candidate: "candidate",
      },
    ];
    const mountedBaseline = analyzeAblations(
      [cell("baseline", result()), cell("candidate", result())],
      definition,
      0.8,
      1,
    );
    expect(mountedBaseline.valid).toBe(false);
    expect(mountedBaseline.errors.join("\n")).toContain(
      "baseline mounted a skill",
    );

    const missingCandidate = analyzeAblations(
      [
        cell("baseline", result({ skillDirectory: null })),
        cell("candidate", result({ skillDirectory: null })),
      ],
      definition,
      0.8,
      1,
    );
    expect(missingCandidate.valid).toBe(false);
    expect(missingCandidate.errors.join("\n")).toContain(
      "candidate mounted no skill",
    );
  });

  test("rejects a result threshold that differs from the manifest", () => {
    const analysis = analyzeAblations(
      [cell("without-skill", result()), cell("candidate", result())],
      [
        {
          name: "discovery-value",
          baseline: "without-skill",
          candidate: "candidate",
        },
      ],
      0.9,
      1,
    );
    expect(analysis.valid).toBe(false);
    expect(analysis.errors.join("\n")).toContain(
      "result threshold 0.8 differs from manifest threshold 0.9",
    );
  });

  test("rejects a result trial count that differs from the manifest", () => {
    const analysis = analyzeAblations(
      [cell("without-skill", result()), cell("candidate", result())],
      [
        {
          name: "discovery-value",
          baseline: "without-skill",
          candidate: "candidate",
        },
      ],
      0.8,
      3,
    );
    expect(analysis.valid).toBe(false);
    expect(analysis.errors.join("\n")).toContain(
      "result trial count 1 differs from manifest trial count 3",
    );
  });

  test("rejects matched zero-trial evidence", () => {
    const analysis = analyzeAblations(
      [
        cell("without-skill", result({ trials: [] })),
        cell("candidate", result({ trials: [] })),
      ],
      [
        {
          name: "discovery-value",
          baseline: "without-skill",
          candidate: "candidate",
        },
      ],
      0.8,
      1,
    );
    expect(analysis.valid).toBe(false);
    expect(analysis.errors.join("\n")).toContain(
      "trial count must be positive",
    );
  });

  test("requires a no-skill baseline and identical conditions and effort", () => {
    const baseModes = {
      "without-skill": { without_skill: true },
      candidate: {},
    };
    const definitions = [
      {
        name: "discovery-value",
        baseline: "without-skill",
        candidate: "candidate",
      },
    ];
    expect(validateAblationDefinitions(baseModes, definitions)).toEqual([]);
    expect(
      validateAblationDefinitions(
        { ...baseModes, "without-skill": {} },
        definitions,
      ),
    ).toContain("discovery-value: baseline mode must set without_skill: true");
    expect(
      validateAblationDefinitions(
        {
          "without-skill": { without_skill: true, condition: "one.md" },
          candidate: { condition: "two.md" },
        },
        definitions,
      ),
    ).toContain("discovery-value: condition configuration differs");
    expect(
      validateAblationDefinitions(
        {
          "without-skill": { without_skill: true, effort: "low" },
          candidate: { effort: "high" },
        },
        definitions,
      ),
    ).toContain("discovery-value: effort differs");
    expect(
      validateAblationDefinitions(
        {
          "without-skill": { without_skill: true, apply_case_routes: true },
          candidate: {},
        },
        definitions,
      ),
    ).toContain("discovery-value: non-skill mode configuration differs");
  });
});
