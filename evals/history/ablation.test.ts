import { afterEach, expect, test } from "bun:test";
import {
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const command = resolve(import.meta.dir, "../runner/ablation.ts");
const ownerDirectory = resolve(import.meta.dir, "../sevro-extension");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

test.each(["manifest", "result", "symlink", "hardlink"])(
  "historical ablation refuses archive output destinations: %s",
  async (alias) => {
    const { root, manifest } = await fixture();
    const result = join(root, "candidate.json");
    const originalManifest = await readFile(manifest, "utf8");
    const originalResult = await readFile(result, "utf8");
    let output = alias === "manifest" ? manifest : result;
    if (alias === "symlink" || alias === "hardlink") {
      output = join(root, "aliased.md");
      if (alias === "symlink") await symlink(result, output);
      else await link(result, output);
    }
    const run = await invoke(manifest, ["--output", output]);
    expect(run.code, run.stderr).toBe(64);
    expect(run.stderr).toContain("cannot replace input archive");
    expect(await readFile(manifest, "utf8")).toBe(originalManifest);
    expect(await readFile(result, "utf8")).toBe(originalResult);
  },
);

test("invalid suite metadata still protects referenced archives", async () => {
  const { root, manifest, definition, save } = await fixture();
  Reflect.deleteProperty(definition, "modeDefinitions");
  await save();
  const result = join(root, "candidate.json");
  const original = await readFile(result, "utf8");
  const run = await invoke(manifest, ["--output", result]);
  expect(run.code, run.stderr).toBe(64);
  expect(run.stderr).toContain("cannot replace input archive");
  expect(await readFile(result, "utf8")).toBe(original);
});

function sample(passed: boolean, skillDirectory: string | null) {
  return {
    caseId: "discovery-sample",
    invariant: "DF-C1",
    evaluationDigest: "sha256:shared-evaluation",
    passThreshold: 0.8,
    skillDirectory,
    mountPluginSkills: false,
    executionMode: "executed",
    harness: "codex",
    harnessVersion: "codex 1.2.3",
    model: "recorded-model",
    effort: "medium",
    trials: [
      {
        trial: 1,
        passed,
        checks: [{ name: "answer", passed }],
        harness: { ok: true },
      },
    ],
    passRate: passed ? 1 : 0,
    meanDurationMs: passed ? 1000 : 600,
    meanTokens: passed ? 120 : 80,
    totalCostUsd: null,
  };
}

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-archived-ablation-"));
  roots.push(root);
  const baseline = [sample(false, null)];
  const candidate = [sample(true, "/fixture/skills/discover-feature")];
  const definition = {
    format: "darrow-orchestration-suite-v1",
    dry: false,
    threshold: 0.8,
    trials: 1,
    modes: ["without-skill", "candidate"],
    modeDefinitions: {
      "without-skill": { without_skill: true },
      candidate: {},
    },
    ablations: [
      {
        name: "discovery-value",
        baseline: "without-skill",
        candidate: "candidate",
      },
    ],
    cells: [
      {
        harness: "codex",
        mode: "without-skill",
        result: "baseline.json",
        exitCode: 1,
      },
      {
        harness: "codex",
        mode: "candidate",
        result: "candidate.json",
        exitCode: 0,
      },
    ],
  };
  const manifest = join(root, "suite-run.json");
  async function save() {
    await writeFile(join(root, "baseline.json"), JSON.stringify(baseline));
    await writeFile(join(root, "candidate.json"), JSON.stringify(candidate));
    await writeFile(manifest, JSON.stringify(definition));
  }
  await save();
  return { root, baseline, candidate, definition, manifest, save };
}

async function invoke(
  input: string,
  args: string[] = [],
  entrypoint = command,
) {
  const child = Bun.spawn([process.execPath, entrypoint, input, ...args], {
    cwd: tmpdir(),
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

test("historical ablation resolves relative archives beside its manifest", async () => {
  const { root, manifest } = await fixture();
  const original = await readFile(manifest, "utf8");
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(0);
  expect(run.stdout).toContain(join(root, "ablation.md"));
  const markdown = await readFile(join(root, "ablation.md"), "utf8");
  expect(markdown).toContain("discovery-value");
  expect(markdown).toContain("0% → 100% (+100pp)");
  expect(markdown).toContain("0.6s → 1.0s (+0.4s)");
  expect(markdown).toContain("80 → 120 (+40)");
  expect(markdown).toContain("unknown → unknown (delta unknown)");
  expect(await readFile(manifest, "utf8")).toBe(original);
});

test.each([
  "unfinished-cell",
  "missing-cell-exit",
  "missing-trial-number",
  "missing-identity",
  "contradictory-rate",
  "different-checks",
  "different-policy",
  "different-condition",
  "mounted-baseline-plugin",
])(
  "ineligible archive rows retain valid peer comparisons: %s",
  async (scenario) => {
    const { root, manifest, baseline, candidate, definition, save } =
      await fixture();
    const originalBaseline = baseline[0]!;
    const originalCandidate = candidate[0]!;
    baseline.push({ ...sample(true, null), caseId: "valid-peer" });
    candidate.push({
      ...sample(true, "/fixture/skills/discover-feature"),
      caseId: "valid-peer",
    });
    const changes: Record<string, () => void> = {
      "unfinished-cell": () => {
        definition.cells[1]!.exitCode = 2;
      },
      "missing-cell-exit": () => {
        Reflect.deleteProperty(definition.cells[1]!, "exitCode");
      },
      "missing-trial-number": () => {
        Reflect.deleteProperty(originalCandidate.trials[0]!, "trial");
      },
      "missing-identity": () => {
        Reflect.deleteProperty(originalBaseline, "evaluationDigest");
        Reflect.deleteProperty(originalCandidate, "evaluationDigest");
      },
      "contradictory-rate": () => {
        originalCandidate.passRate = 0;
      },
      "different-checks": () => {
        originalCandidate.trials[0]!.checks[0]!.name = "different-answer";
      },
      "different-policy": () => {
        Object.assign(originalCandidate.trials[0]!.harness, {
          evaluationEnforcement: "enforced",
        });
      },
      "different-condition": () => {
        Object.assign(originalCandidate, { condition: "candidate-only" });
      },
      "mounted-baseline-plugin": () => {
        originalBaseline.mountPluginSkills = true;
      },
    };
    changes[scenario]!();
    // Cell completion applies to every case in that cell; use another complete harness as a peer.
    if (scenario === "unfinished-cell" || scenario === "missing-cell-exit") {
      await writeFile(
        join(root, "peer-baseline.json"),
        JSON.stringify([
          { ...sample(true, null), caseId: "valid-peer", harness: "claude" },
        ]),
      );
      await writeFile(
        join(root, "peer-candidate.json"),
        JSON.stringify([
          {
            ...sample(true, "/fixture/skills/discover-feature"),
            caseId: "valid-peer",
            harness: "claude",
          },
        ]),
      );
      definition.cells.push(
        {
          harness: "claude",
          mode: "without-skill",
          result: "peer-baseline.json",
          exitCode: 0,
        },
        {
          harness: "claude",
          mode: "candidate",
          result: "peer-candidate.json",
          exitCode: 0,
        },
      );
    }
    await save();
    const original = await readFile(join(root, "candidate.json"), "utf8");
    const run = await invoke(manifest);
    const markdown = await readFile(join(root, "ablation.md"), "utf8");
    expect(run.code, run.stderr + markdown).toBe(1);
    expect(markdown).toContain("Status: **invalid**");
    expect(markdown).toContain("valid-peer");
    expect(markdown).toContain("100% → 100% (0pp)");
    expect(markdown).not.toContain("0% → 100% (+100pp)");
    expect(await readFile(join(root, "candidate.json"), "utf8")).toBe(original);
  },
);

test.each(["baseline", "candidate"])(
  "duplicate case identities cannot produce an ablation delta: %s",
  async (side) => {
    const { root, baseline, candidate, manifest, save } = await fixture();
    const duplicated = side === "baseline" ? baseline : candidate;
    duplicated.push({ ...duplicated[0]! });
    baseline.push({ ...sample(true, null), caseId: "valid-peer" });
    candidate.push({
      ...sample(true, "/fixture/skills/discover-feature"),
      caseId: "valid-peer",
    });
    await save();
    const run = await invoke(manifest);
    expect(run.code, run.stderr).toBe(1);
    const markdown = await readFile(join(root, "ablation.md"), "utf8");
    expect(markdown).toContain(`duplicate ${side} case discovery-sample`);
    expect(markdown).not.toContain("0% → 100% (+100pp)");
    expect(markdown).toContain("100% → 100% (0pp)");
  },
);

test.each([
  "unsupported-format",
  "missing-mode-definitions",
  "different-owner-policy",
  "different-owner-routes",
  "dry-duplicate-cells",
  "dry-duplicate-cases",
  "unreadable-result",
])(
  "historical ablation diagnoses invalid suite inputs: %s",
  async (scenario) => {
    const { root, manifest, baseline, candidate, definition, save } =
      await fixture();
    switch (scenario) {
      case "unsupported-format":
        definition.format = "unversioned";
        break;
      case "missing-mode-definitions":
        Reflect.deleteProperty(definition, "modeDefinitions");
        break;
      case "different-owner-policy":
        Object.assign(definition.modeDefinitions.candidate, {
          owner_evaluation: "enforced",
        });
        break;
      case "different-owner-routes":
        Object.assign(definition.modeDefinitions.candidate, {
          effective_owner_routes: { codex: { model: "other", effort: "high" } },
        });
        break;
      case "dry-duplicate-cells":
        definition.cells.push({ ...definition.cells[0]! });
        break;
      case "dry-duplicate-cases":
        candidate.push({ ...candidate[0]! });
        break;
      case "unreadable-result":
        definition.cells[1]!.result = "missing.json";
        break;
    }
    if (scenario.startsWith("dry-")) {
      definition.dry = true;
      for (const value of [...baseline, ...candidate]) {
        Object.assign(value, { executionMode: "dry", passRate: null });
        Object.assign(value.trials[0]!, {
          executionMode: "dry",
          passed: null,
          checks: [],
        });
      }
    }
    await save();
    const original = await readFile(manifest, "utf8");
    const run = await invoke(manifest);
    expect(run.code, run.stderr).toBe(1);
    const markdown = await readFile(join(root, "ablation.md"), "utf8");
    expect(markdown).toContain("Status: **invalid**");
    expect(markdown).toContain("## Diagnostics");
    expect(markdown).toContain("SHA-256:");
    expect(markdown).toContain(manifest);
    expect(markdown).not.toContain("0% → 100% (+100pp)");
    expect(await readFile(manifest, "utf8")).toBe(original);
  },
);

test("historical ablation runs without the generic runner or Sevro", async () => {
  const { root, manifest } = await fixture();
  const consumer = join(root, "standalone");
  await mkdir(consumer);
  for (const name of [
    "legacy-ablation.ts",
    "legacy-comparison.ts",
    "legacy-evidence.ts",
    "legacy-output.ts",
  ])
    await copyFile(join(ownerDirectory, name), join(consumer, name));
  const legacy = await invoke(manifest);
  const original = await readFile(join(root, "ablation.md"), "utf8");
  expect(legacy.code, legacy.stderr).toBe(0);
  for (const entrypoint of [
    join(ownerDirectory, "legacy-ablation.ts"),
    join(consumer, "legacy-ablation.ts"),
  ]) {
    const output = join(root, "explicit-output.md");
    await writeFile(output, "old report");
    const standalone = await invoke(manifest, ["--output", output], entrypoint);
    expect(standalone.code, standalone.stderr).toBe(0);
    expect(standalone.stdout).toContain(output);
    expect(await readFile(output, "utf8")).toBe(original);
  }
});

test("invalid named ablations retain other eligible comparisons", async () => {
  const { root, manifest, definition, save } = await fixture();
  definition.ablations.push({
    name: "invalid-peer",
    baseline: "without-skill",
    candidate: "missing-mode",
  });
  await save();
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(1);
  const markdown = await readFile(join(root, "ablation.md"), "utf8");
  expect(markdown).toContain(
    "invalid-peer: unknown candidate mode missing-mode",
  );
  expect(markdown).toContain("## discovery-value");
  expect(markdown).toContain("0% → 100% (+100pp)");
});

test("manifest threshold controls historical ablation eligibility", async () => {
  const { root, manifest, definition, baseline, candidate, save } =
    await fixture();
  definition.threshold = 0.9;
  baseline.push({
    ...sample(true, null),
    caseId: "valid-peer",
    passThreshold: 0.9,
  });
  candidate.push({
    ...sample(true, "/fixture/skills/discover-feature"),
    caseId: "valid-peer",
    passThreshold: 0.9,
  });
  await save();
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(1);
  const markdown = await readFile(join(root, "ablation.md"), "utf8");
  expect(markdown).toContain("differs from manifest threshold 0.9");
  expect(markdown).not.toContain("0% → 100% (+100pp)");
  expect(markdown).toContain("100% → 100% (0pp)");
});

test("historical ablation preserves regressions and asymmetric unknown measurements", async () => {
  const { root, manifest, baseline, candidate, save } = await fixture();
  baseline[0] = sample(true, null);
  candidate[0] = sample(false, "/fixture/skills/discover-feature");
  Reflect.deleteProperty(baseline[0]!, "meanTokens");
  Object.assign(candidate[0]!, { meanTokens: 0, totalCostUsd: 0.05 });
  await save();
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(0);
  const markdown = await readFile(join(root, "ablation.md"), "utf8");
  expect(markdown).toContain("100% → 0% (-100pp)");
  expect(markdown).toContain("unknown → 0 (delta unknown)");
  expect(markdown).toContain("unknown → $0.0500 (delta unknown)");
  expect(markdown).toContain(
    "current evaluator equivalence or live behavioral stability",
  );
});

test("a consistent dry suite is unmeasured preparation with input digests", async () => {
  const { root, manifest, baseline, candidate, definition, save } =
    await fixture();
  definition.dry = true;
  for (const result of [...baseline, ...candidate]) {
    Reflect.deleteProperty(result, "executionMode");
    Object.assign(result, { passRate: null });
    Object.assign(result.trials[0]!, { passed: null, checks: [] });
  }
  await save();
  const run = await invoke(manifest);
  expect(run.code, run.stderr).toBe(0);
  const markdown = await readFile(join(root, "ablation.md"), "utf8");
  expect(markdown).toContain("Unmeasured: discovery-value");
  expect(markdown).toContain(
    "Fixture preparation does not establish a behavioral comparison",
  );
  expect(markdown).toContain("SHA-256:");
  expect(markdown).not.toContain("100%");
});

test.each([
  { field: "harnessVersion", value: "codex 9.9.9" },
  { field: "evaluationDigest", value: "sha256:different" },
  { field: "passThreshold", value: 0.9 },
  { field: "model", value: "other-model" },
  { field: "effort", value: "high" },
  { field: "trials", value: [] },
  { field: "caseId", value: "other-case" },
  { field: "skillDirectory", value: null },
])(
  "historical ablation preserves matched case eligibility: $field",
  async ({ field, value }) => {
    const { root, manifest, candidate, save } = await fixture();
    Object.assign(candidate[0]!, { [field]: value });
    await save();
    const run = await invoke(manifest);
    expect(run.code, run.stderr).toBe(1);
    const markdown = await readFile(join(root, "ablation.md"), "utf8");
    expect(markdown).toContain("Status: **invalid**");
    expect(markdown).not.toContain("0% → 100% (+100pp)");
  },
);
