import { afterEach, expect, test } from "bun:test";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const legacyCommand = resolve(import.meta.dir, "../compare.ts");
const standaloneDirectory = resolve(import.meta.dir, "../../sevro-extension");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function archivedCase() {
  return {
    caseId: "historical-comparison",
    invariant: "HISTORY-C1",
    executionMode: "executed",
    evaluationDigest: "sha256:retained-case",
    passThreshold: 1,
    harness: "codex",
    harnessVersion: "synthetic-v1",
    model: "recorded-model",
    effort: "medium",
    condition: "baseline",
    ownerEvaluationMode: "passive",
    passRate: 1,
    meanDurationMs: 1000,
    p95DurationMs: 1000,
    meanTokens: 100,
    totalCostUsd: 0.002,
    humanReviewMinutes: 5,
    trials: [
      {
        trial: 1,
        executionMode: "executed",
        passed: true,
        checks: [{ name: "answer", passed: true }],
        harness: {
          ok: true,
          resultText: "ready",
          durationMs: 1000,
          inputTokens: 60,
          outputTokens: 40,
          tokenUsageComplete: true,
          evaluationEnforcement: "passive",
        },
      },
    ],
  };
}

async function fixture(baseline: unknown, candidate: unknown = baseline) {
  const root = await mkdtemp(join(tmpdir(), "darrow-legacy-compare-"));
  roots.push(root);
  const base = join(root, "baseline.json");
  const cand = join(root, "candidate.json");
  await writeFile(base, JSON.stringify(baseline));
  await writeFile(cand, JSON.stringify(candidate));
  return { root, base, cand };
}

async function invoke(
  command: string,
  base: string,
  cand: string,
  args: string[] = [],
) {
  const child = Bun.spawn([process.execPath, command, base, cand, ...args], {
    env: { PATH: process.env.PATH },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("historical comparison refuses matching missing identity", async () => {
  for (const key of [
    "invariant",
    "evaluationDigest",
    "passThreshold",
    "harness",
    "harnessVersion",
    "model",
    "effort",
  ]) {
    const sample: Record<string, unknown> = archivedCase();
    delete sample[key];
    const { base, cand } = await fixture([sample]);
    const originals = await Promise.all([
      readFile(base, "utf8"),
      readFile(cand, "utf8"),
    ]);
    const run = await invoke(legacyCommand, base, cand);
    expect(run.code, run.stderr + run.stdout).toBe(1);
    expect(run.stdout).toContain("incomparable");
    expect(run.stdout).not.toContain("  pass ");
    expect(
      await Promise.all([readFile(base, "utf8"), readFile(cand, "utf8")]),
    ).toEqual(originals);
  }
});

test.each(["dry", "unknown"])(
  "compare refuses %s execution provenance",
  async (executionMode) => {
    const { base, cand } = await fixture([
      { ...archivedCase(), executionMode, trials: [] },
    ]);
    const run = await invoke(legacyCommand, base, cand);
    expect(run.code).toBe(1);
    expect(run.stdout).toContain("unmeasured");
    expect(run.stdout).not.toContain("100%");
  },
);

test("historical comparison retains metric directions and unknown quantities", async () => {
  const sample = archivedCase();
  const metrics = (passed: boolean) => [
    { name: "answer", passed, metric: "defect_detection" },
    { name: "escape", passed, metric: "escaped_defect" },
    { name: "finding", passed, metric: "false_positive" },
  ];
  const baseCase = {
    ...sample,
    passRate: 0,
    meanTokens: null,
    totalCostUsd: null,
    humanReviewMinutes: null,
    meanChildInvocationCount: 2,
    totalHumanInterruptions: 2,
    trials: [{ ...sample.trials[0], passed: false, checks: metrics(false) }],
  };
  const candidateCase = {
    ...baseCase,
    passRate: 1,
    meanChildInvocationCount: 1,
    totalHumanInterruptions: 0,
    trials: [{ ...sample.trials[0], passed: true, checks: metrics(true) }],
  };
  const { base, cand } = await fixture([baseCase], [candidateCase]);
  const run = await invoke(legacyCommand, base, cand);
  expect(run.code, run.stdout + run.stderr).toBe(0);
  expect(run.stdout).toContain("pass    0% → 100%  ▲ +100pp");
  expect(run.stdout).toContain("escaped 1.0 → 0.0  ▲ -1");
  expect(run.stdout).toContain("detect  0% → 100%  ▲ +100pp");
  expect(run.stdout).toContain("false+  1.0 → 0.0  ▲ -1");
  expect(run.stdout).toContain("child(reported) 2.0 → 1.0  ▲ -1");
  expect(run.stdout).toContain("interrupts 2 → 0  ▲ -2");
  for (const label of ["tokens", "cost", "human"])
    expect(run.stdout).toMatch(new RegExp(label + " +unknown → unknown"));
  expect(run.stdout).toContain("metadata remains unknown");
});

test("historical comparison refuses contradictory success", async () => {
  const sample = archivedCase();
  const { base, cand } = await fixture(
    [sample],
    [
      {
        ...sample,
        trials: [
          { ...sample.trials[0], checks: [{ name: "answer", passed: false }] },
        ],
      },
    ],
  );
  const run = await invoke(legacyCommand, base, cand);
  expect(run.code).toBe(1);
  expect(run.stdout).toContain("incomparable");
  expect(run.stdout).not.toContain("  pass ");
});

test("historical comparison works without the generic runner", async () => {
  const baseCase = archivedCase();
  const candidateCase = {
    ...baseCase,
    condition: "candidate",
    meanDurationMs: 500,
    meanTokens: 50,
  };
  const { root, base, cand } = await fixture([baseCase], [candidateCase]);
  const copied = join(root, "legacy-compare.ts");
  await copyFile(join(standaloneDirectory, "legacy-compare.ts"), copied);
  await copyFile(
    join(standaloneDirectory, "legacy-evidence.ts"),
    join(root, "legacy-evidence.ts"),
  );
  await copyFile(
    join(standaloneDirectory, "legacy-comparison.ts"),
    join(root, "legacy-comparison.ts"),
  );
  const publicRun = await invoke(legacyCommand, base, cand);
  const isolatedRun = await invoke(copied, base, cand);
  expect(publicRun.code, publicRun.stderr).toBe(0);
  expect(isolatedRun.code, isolatedRun.stderr).toBe(0);
  expect(isolatedRun.stdout).toBe(publicRun.stdout);
  expect(publicRun.stdout).toContain("condition baseline → candidate");
  expect(publicRun.stdout).toContain("wall    1.0s → 0.5s  ▲ -0.5s (-50%)");
  expect(publicRun.stdout).toContain("tokens  100 → 50  ▲ -50 (-50%)");
  expect(publicRun.stdout).toContain("archival");
  expect(publicRun.stdout).toContain("complete run boundary");
  expect(publicRun.stdout).toContain("evaluator equivalence");
});

test("historical comparison rejects invalid archival arrays", async () => {
  const sample = archivedCase();
  for (const input of [
    [],
    [sample, sample],
    [{ ...sample, trials: [] }],
    [{ ...sample, invariant: "   " }],
    [{ ...sample, invariant: false }],
    [{ ...sample, passThreshold: 2 }],
    [{ ...sample, passRate: 2 }],
    [{ ...sample, meanDurationMs: -1 }],
    [{ ...sample, meanTokens: -1 }],
    [{ ...sample, meanChildInvocationCount: null }],
  ]) {
    const { base, cand } = await fixture(input);
    const run = await invoke(legacyCommand, base, cand);
    expect(run.code, JSON.stringify(input) + run.stdout + run.stderr).toBe(1);
    expect(run.stdout + run.stderr).toContain("incomparable");
    expect(run.stdout).not.toContain("  pass ");
    expect(await readFile(base, "utf8")).toBe(JSON.stringify(input));
    expect(await readFile(cand, "utf8")).toBe(JSON.stringify(input));
  }
});

test("historical comparison refuses changed grading and instrumentation", async () => {
  const sample = archivedCase();
  for (const candidate of [
    { ...sample, ownerEvaluationMode: "enforced" },
    {
      ...sample,
      trials: [
        {
          ...sample.trials[0],
          harness: {
            ...sample.trials[0]!.harness,
            evaluationEnforcement: "enforced",
          },
        },
      ],
    },
    {
      ...sample,
      trials: [
        {
          ...sample.trials[0],
          harness: { ...sample.trials[0]!.harness, tokenUsageComplete: false },
        },
      ],
    },
    {
      ...sample,
      trials: [
        {
          ...sample.trials[0],
          judge: {
            ok: true,
            route: { harness: "codex", model: "grader", effort: "high" },
          },
        },
      ],
    },
    {
      ...sample,
      trials: [
        {
          ...sample.trials[0],
          semanticOutput: {
            ok: true,
            route: { harness: "codex", model: "grader", effort: "high" },
            assessments: [
              { name: "answer", verdict: "pass", reason: "recorded" },
            ],
          },
        },
      ],
    },
    {
      ...sample,
      trials: [
        {
          ...sample.trials[0],
          effectiveOwnerRoute: { model: "different-owner", effort: "high" },
        },
      ],
    },
  ]) {
    const { base, cand } = await fixture([sample], [candidate]);
    const run = await invoke(legacyCommand, base, cand);
    expect(run.code, run.stderr + run.stdout).toBe(1);
    expect(run.stdout).toContain("incomparable");
    expect(run.stdout).not.toContain("  pass ");
  }
});

test("historical comparison refuses array-valued metric labels", async () => {
  const sample = archivedCase();
  for (const metric of [
    "escaped_defect",
    "defect_detection",
    "false_positive",
  ]) {
    const input = [
      {
        ...sample,
        trials: [
          {
            ...sample.trials[0],
            checks: [{ name: "answer", passed: true, metric: [metric] }],
          },
        ],
      },
    ];
    const { base, cand } = await fixture(input);
    const original = JSON.stringify(input);
    const run = await invoke(legacyCommand, base, cand);
    expect(run.code, run.stdout + run.stderr).toBe(1);
    expect(run.stdout).toContain("incomparable");
    expect(run.stdout).not.toContain("  pass ");
    expect(
      await Promise.all([readFile(base, "utf8"), readFile(cand, "utf8")]),
    ).toEqual([original, original]);
  }
});

test.each([legacyCommand, join(standaloneDirectory, "legacy-compare.ts")])(
  "historical comparison compares owner route values regardless of property order (%s)",
  async (command) => {
    const sample = archivedCase();
    const route = {
      harness: "codex",
      provider: "openai",
      model: "owner",
      effort: "high",
    };
    const reordered = {
      effort: "high",
      model: "owner",
      provider: "openai",
      harness: "codex",
    };
    const baseline = {
      ...sample,
      trials: [{ ...sample.trials[0], effectiveOwnerRoute: route }],
    };
    for (const [effectiveOwnerRoute, code] of [
      [reordered, 0],
      [{ ...reordered, model: "different-owner" }, 1],
    ] as const) {
      const candidate = {
        ...sample,
        meanDurationMs: 500,
        trials: [{ ...sample.trials[0], effectiveOwnerRoute }],
      };
      const { base, cand } = await fixture([baseline], [candidate]);
      const originals: [string, string] = [
        JSON.stringify([baseline]),
        JSON.stringify([candidate]),
      ];
      const run = await invoke(command, base, cand);
      expect(run.code, run.stdout + run.stderr).toBe(code);
      if (code === 0) {
        expect(run.stdout).toContain("pass    100% → 100%  = 0pp (0%)");
        expect(run.stdout).toContain("wall    1.0s → 0.5s  ▲ -0.5s (-50%)");
      } else {
        expect(run.stdout).toContain(
          "recorded grading or instrumentation differs",
        );
        expect(run.stdout).not.toContain("  pass ");
      }
      expect(
        await Promise.all([readFile(base, "utf8"), readFile(cand, "utf8")]),
      ).toEqual(originals);
    }
  },
);

test.each([legacyCommand, join(standaloneDirectory, "legacy-compare.ts")])(
  "historical comparison refuses rates that contradict recorded trials (%s)",
  async (command) => {
    const sample = archivedCase();
    const baseline = {
      ...sample,
      passRate: 0,
      trials: [
        {
          ...sample.trials[0],
          passed: false,
          checks: [{ name: "answer", passed: false }],
        },
      ],
    };
    for (const passRate of [1, 0]) {
      const candidate = { ...baseline, passRate };
      const { base, cand } = await fixture([baseline], [candidate]);
      const originals: [string, string] = [
        JSON.stringify([baseline]),
        JSON.stringify([candidate]),
      ];
      const run = await invoke(command, base, cand);
      expect(run.code, run.stdout + run.stderr).toBe(passRate === 1 ? 1 : 0);
      if (passRate === 1) {
        expect(run.stdout).toContain("passRate contradicts trial outcomes");
        expect(run.stdout).not.toContain("  pass ");
      } else {
        expect(run.stdout).toContain("pass    0% → 0%  ±0");
      }
      expect(
        await Promise.all([readFile(base, "utf8"), readFile(cand, "utf8")]),
      ).toEqual(originals);
    }
  },
);
