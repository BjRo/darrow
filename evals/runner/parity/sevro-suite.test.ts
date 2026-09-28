import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { selectCaseIds } from "../../sevro-extension/index";

const roots: string[] = [];
const suiteCommand = resolve(import.meta.dir, "../../sevro-extension/suite.ts");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-suite-"));
  roots.push(root);
  expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  for (const id of ["suite-alpha", "suite-beta"]) {
    await writeFile(
      join(cases, `${id}.yaml`),
      JSON.stringify({
        id,
        invariant: "EXAMPLE-C1",
        prompt: "Return ready.",
        fixture: {
          commits: [
            { message: "chore: init", files: { "README.md": "ready\n" } },
          ],
        },
        checks: [],
        output_checks: [{ name: "response", expect_exact: "ready" }],
      }),
    );
  }
  const adapter = join(root, "adapter.ts");
  await writeFile(
    adapter,
    `import { writeFile } from "node:fs/promises";
export default {
  id: "sevro.host.codex", model: "synthetic", effort: "none",
  async run({ condition, signal }) {
    if (process.env.SEVRO_SUITE_READY_PATH) {
      await writeFile(process.env.SEVRO_SUITE_READY_PATH, "ready");
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      });
    }
    return { finalMessage: "ready", complete: true, actualCondition: condition,
      inputTokens: 1, outputTokens: 1, usageComplete: true };
  },
};\n`,
  );
  const suite = join(root, "suite.yaml");
  await writeFile(
    suite,
    JSON.stringify({
      version: 1,
      experiment: "example",
      harnesses: ["codex"],
      case_filter: "suite-",
      modes: {
        passive: { owner_evaluation: "passive" },
        enforced: { owner_evaluation: "enforced" },
      },
    }),
  );
  return { root, cases, adapter, suite, results: join(root, "results") };
}

async function waitForFile(path: string) {
  const deadline = Date.now() + 10_000;
  while (!(await Bun.file(path).exists())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await Bun.sleep(20);
  }
}

async function invoke(args: string[]) {
  const proc = Bun.spawn([process.execPath, suiteCommand, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

async function activationFixture() {
  const { root, adapter, suite, results } = await fixture();
  const skill = join(root, "plugins/capability/example/skills/probe");
  await mkdir(join(skill, "evals"), { recursive: true });
  await writeFile(
    join(skill, "SKILL.md"),
    "---\nname: probe\ndescription: Return ready.\n---\nReturn ready.\n",
  );
  await writeFile(
    join(skill, "evals/suite-activation.yaml"),
    JSON.stringify({
      id: "suite-activation",
      invariant: "EXAMPLE-ACTIVATION",
      activation: "positive",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  await writeFile(
    adapter,
    `let runs = 0;
export default {
  id: "sevro.host.codex", model: "synthetic", effort: "none",
  async run({ condition }) {
    const skills = ++runs === 1 ? ["probe"] : [];
    return { finalMessage: "ready", complete: true, actualCondition: condition,
      observations: [{ id: "sevro.codex.skill-reads", completeness: "complete",
        data: { method: "skill_file_read_probe", primarySkill: skills[0] ?? null,
          observedSkills: skills } }] };
  },
};\n`,
  );
  await writeFile(
    suite,
    JSON.stringify({
      version: 1,
      experiment: "activation",
      harnesses: ["codex"],
      case_filter: "suite-activation",
      modes: { candidate: { owner_evaluation: "passive" } },
    }),
  );
  return { root, adapter, suite, results };
}

test("suite gates activation independently when all task checks pass", async () => {
  const { root, adapter, suite, results } = await activationFixture();
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "2",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  const cell = manifest.cells[0];
  const result = JSON.parse(await readFile(cell.result, "utf8"));
  expect(result.task.verdict).toBe("passed");
  expect(
    result.cases[0].trials.map(
      (trial: { domainOutcomes: unknown[] }) => trial.domainOutcomes,
    ),
  ).toMatchObject([
    [{ id: "darrow.evals.activation", status: "passed" }],
    [{ id: "darrow.evals.activation", status: "failed" }],
  ]);
  expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(1);
  expect(cell.exitCode).toBe(0);
  expect(cell.activation).toEqual({
    status: "failed",
    class: "positive",
    targetSkill: "probe",
    trials: 2,
    measured: 2,
    passed: 1,
    failed: 1,
    unavailable: 0,
    passRate: 0.5,
    threshold: 1,
  });
  expect(JSON.parse(run.stdout)).toMatchObject({
    cells: 1,
    failed: 0,
    activationFailed: 1,
    activationUnavailable: 0,
  });
}, 15_000);

test("suite retains unknown activation without averaging the measured subset", async () => {
  const { root, adapter, suite, results } = await activationFixture();
  await writeFile(
    adapter,
    (await readFile(adapter, "utf8")).replace(
      'completeness: "complete"',
      'completeness: runs === 1 ? "complete" : "partial"',
    ),
  );
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "2",
    "--threshold",
    "0.5",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(1);
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  const cell = manifest.cells[0];
  expect(cell.exitCode).toBe(0);
  expect(cell.activation).toMatchObject({
    status: "unavailable",
    class: "positive",
    measured: 1,
    passed: 1,
    failed: 0,
    unavailable: 1,
    passRate: null,
    threshold: 0.5,
  });
  expect(JSON.parse(run.stdout)).toMatchObject({
    activationFailed: 0,
    activationUnavailable: 1,
  });
  const result = JSON.parse(await readFile(cell.result, "utf8"));
  expect(result.task.verdict).toBe("passed");
}, 15_000);

test("suite labels dry activation and excludes unmounted controls from its gate", async () => {
  const { root, adapter, suite, results } = await activationFixture();
  const definition = JSON.parse(await readFile(suite, "utf8"));
  definition.modes.baseline = {
    owner_evaluation: "passive",
    without_skill: true,
  };
  await writeFile(suite, JSON.stringify(definition));
  const args = [
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "2",
    "--threshold",
    "0.5",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ];
  const dry = await invoke([...args, "--dry"]);
  expect(dry.code, `${dry.stderr}\n${dry.stdout}`).toBe(0);
  const preparation = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(preparation.cells[0].activation).toMatchObject({
    status: "not_run",
    passRate: null,
    measured: 0,
  });
  expect(preparation.cells[1].activation).toEqual({ status: "not_requested" });
  const liveResults = join(results, "live");
  const live = await invoke(
    args.map((arg) => (arg === results ? liveResults : arg)),
  );
  expect(live.code, `${live.stderr}\n${live.stdout}`).toBe(0);
  const execution = JSON.parse(
    await readFile(join(liveResults, "suite-run.json"), "utf8"),
  );
  expect(execution.cells[0].activation).toMatchObject({
    status: "passed",
    passRate: 0.5,
  });
  expect(execution.cells[1].activation).toEqual({ status: "not_requested" });
}, 15_000);

test("suite selection rejects duplicate IDs and unsupported modes before running", async () => {
  const { root, cases, suite, results } = await fixture();
  expect(await selectCaseIds(root, ["suite-"])).toEqual([
    "suite-alpha",
    "suite-beta",
  ]);
  expect(selectCaseIds(root, ["missing"])).rejects.toThrow("No cases matched.");
  await writeFile(
    join(cases, "duplicate.yaml"),
    JSON.stringify({ id: "suite-alpha" }),
  );
  expect(selectCaseIds(root, ["suite-"])).rejects.toThrow("duplicate case ID");
  const duplicate = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--",
    "--dry",
  ]);
  expect(duplicate.code).toBe(64);
  expect(await Bun.file(results).exists()).toBeFalse();
  await rm(join(cases, "duplicate.yaml"));
  const unsupported = JSON.parse(await readFile(suite, "utf8"));
  unsupported.modes.passive.without_skill = false;
  await writeFile(suite, JSON.stringify(unsupported));
  const rejected = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--",
    "--dry",
  ]);
  expect(rejected.code).toBe(64);
  expect(rejected.stderr).toContain("invalid passive without_skill");
  expect(await Bun.file(results).exists()).toBeFalse();
});

test("suite runs every selected mode and case through Sevro public commands", async () => {
  const { root, adapter, suite, results } = await fixture();
  const route = process.env.SEVRO_CHECKOUT
    ? {
        SEVRO_CHECKOUT: process.env.SEVRO_CHECKOUT,
        SEVRO_PACKAGE_BIN: undefined,
      }
    : {
        SEVRO_CHECKOUT: undefined,
        SEVRO_PACKAGE_BIN: process.env.SEVRO_PACKAGE_BIN,
      };
  expect(route.SEVRO_CHECKOUT || route.SEVRO_PACKAGE_BIN).toBeTruthy();
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  const diagnostics = await readFile(join(results, "suite-run.json"), "utf8");
  const firstResult = JSON.parse(diagnostics).cells[0].result;
  const firstEvidence = firstResult ? await readFile(firstResult, "utf8") : "";
  expect(run.code, `${run.stderr}\n${run.stdout}\n${firstEvidence}`).toBe(0);
  expect(JSON.parse(run.stdout)).toMatchObject({ cells: 4, failed: 0 });
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(manifest.format).toBe("darrow-sevro-suite-v1");
  expect(manifest.harnesses).toEqual(["codex"]);
  expect(manifest.caseIds).toEqual(["suite-alpha", "suite-beta"]);
  expect(manifest.modes).toEqual([
    { name: "passive", condition: "passive", withoutSkill: false },
    { name: "enforced", condition: "enforced", withoutSkill: false },
  ]);
  expect(manifest.report.error).toBeNull();
  const report = JSON.parse(await readFile(manifest.report.jsonPath, "utf8"));
  expect(report.format).toBe("sevro.report.v1");
  expect(report.summary).toEqual({
    cases: 4,
    passed: 4,
    failed: 0,
    notAssessed: 0,
  });
  expect(
    report.rows.map((row: { resultFile: string }) => row.resultFile),
  ).toEqual(manifest.cells.map((cell: { result: string }) => cell.result));
  expect(await readFile(manifest.report.markdownPath, "utf8")).toContain(
    "# Sevro evaluation report",
  );
  expect(
    manifest.cells.map((cell: { caseId: string; mode: string }) => [
      cell.mode,
      cell.caseId,
    ]),
  ).toEqual([
    ["passive", "suite-alpha"],
    ["passive", "suite-beta"],
    ["enforced", "suite-alpha"],
    ["enforced", "suite-beta"],
  ]);
  for (const cell of manifest.cells) {
    expect(cell.exitCode).toBe(0);
    expect(cell.provenance.evaluationDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(cell.provenance.runner.source).toBe(
      process.env.SEVRO_CHECKOUT ? "checkout" : "package",
    );
    expect(cell.provenance.project.root).toStartWith("file:///");
    expect(cell.provenance.extension.id).toBe("darrow.evals");
    expect(cell.provenance.routes).toContainEqual({
      role: "candidate",
      host: "sevro.host.codex",
      model: "synthetic",
      effort: "none",
    });
    const result = JSON.parse(await readFile(cell.result, "utf8"));
    expect(result.cases[0].caseId).toBe(cell.caseId);
    expect(result.task.verdict).toBe("passed");
    const evidence = JSON.parse(await readFile(cell.evidencePath, "utf8"));
    expect(evidence.condition.requested).toBe(cell.condition);
  }
}, 15_000);

test("suite binds separate host routes and compares ablations per harness", async () => {
  const { root, adapter, suite } = await fixture();
  const results = await mkdtemp(join(tmpdir(), "darrow-sevro-host-ablation-"));
  roots.push(results);
  const plugin = join(root, "plugins/capability/example");
  const skill = join(plugin, "skills/probe");
  await mkdir(join(skill, "evals"), { recursive: true });
  for (const host of ["claude", "codex"]) {
    await mkdir(join(plugin, `.${host}-plugin`));
    await writeFile(
      join(plugin, `.${host}-plugin/plugin.json`),
      JSON.stringify({ name: "example", version: "0.1.0" }),
    );
  }
  await writeFile(
    join(skill, "SKILL.md"),
    "---\nname: probe\ndescription: Return ready.\n---\nReturn ready.\n",
  );
  await writeFile(
    join(skill, "evals/suite-skill.yaml"),
    JSON.stringify({
      id: "suite-skill",
      invariant: "EXAMPLE-SKILL",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  const claudeAdapter = join(root, "claude-adapter.ts");
  await writeFile(
    claudeAdapter,
    (await readFile(adapter, "utf8"))
      .replace(
        'id: "sevro.host.codex"',
        'id: "sevro.host.claude", hostCapabilities: ["sevro.claude.plugin-dirs"]',
      )
      .replace('model: "synthetic"', 'model: "claude-synthetic"'),
  );
  await writeFile(
    suite,
    JSON.stringify({
      version: 1,
      experiment: "both-hosts",
      harnesses: ["codex", "claude"],
      case_filter: "suite-skill",
      modes: {
        baseline: { owner_evaluation: "passive", without_skill: true },
        candidate: { owner_evaluation: "passive" },
      },
      ablations: [
        { name: "skill-value", baseline: "baseline", candidate: "candidate" },
      ],
    }),
  );
  const optionsFile = join(root, "hosts.json");
  await writeFile(
    optionsFile,
    JSON.stringify({
      codex: ["--adapter-module", adapter],
      claude: ["--adapter-module", claudeAdapter],
    }),
  );
  const args = [
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--host-options-file",
    optionsFile,
    "--",
    "--shell-isolation",
  ];
  const run = await invoke(args);
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(run.code, `${run.stderr}\n${JSON.stringify(manifest)}`).toBe(0);
  expect(manifest.harnesses).toEqual(["codex", "claude"]);
  expect(manifest.hostOptionsSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(
    manifest.cells.map((cell: { harness: string; mode: string }) => [
      cell.mode,
      cell.harness,
    ]),
  ).toEqual([
    ["baseline", "codex"],
    ["baseline", "claude"],
    ["candidate", "codex"],
    ["candidate", "claude"],
  ]);
  for (const cell of manifest.cells) {
    expect(cell.provenance.routes[0].host).toBe(`sevro.host.${cell.harness}`);
    expect(cell.provenance.routes[0].model).toBe(
      cell.harness === "codex" ? "synthetic" : "claude-synthetic",
    );
  }
  const analysis = JSON.parse(
    await readFile(manifest.ablationReport.jsonPath, "utf8"),
  );
  expect(analysis.valid).toBeTrue();
  expect(
    analysis.comparisons[0].cases.map(
      (row: { harness: string }) => row.harness,
    ),
  ).toEqual(["codex", "claude"]);
  expect(
    analysis.comparisons[0].cases.every(
      (row: { passRate: { delta: number } }) => row.passRate.delta === 0,
    ),
  ).toBeTrue();

  await writeFile(
    optionsFile,
    JSON.stringify({
      codex: ["--adapter-module", adapter],
      claude: ["--adapter-module", adapter],
    }),
  );
  const mismatchedResults = join(results, "mismatched");
  const mismatched = await invoke(
    args.map((arg) => (arg === results ? mismatchedResults : arg)),
  );
  expect(mismatched.code).toBe(1);
  const mismatch = JSON.parse(
    await readFile(join(mismatchedResults, "suite-run.json"), "utf8"),
  );
  expect(
    mismatch.cells
      .filter((cell: { harness: string }) => cell.harness === "claude")
      .every(
        (cell: { exitCode: number; provenance: unknown }) =>
          cell.exitCode === 70 && cell.provenance === null,
      ),
  ).toBeTrue();
  expect(mismatch.ablationReport.valid).toBeFalse();
}, 30_000);

test("suite rejects ambiguous or conflicting host routes before execution", async () => {
  const { root, suite, results } = await fixture();
  const definition = JSON.parse(await readFile(suite, "utf8"));
  const optionsFile = join(root, "hosts.json");
  const base = [
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
  ];
  for (const harnesses of [[], ["codex", "codex"], ["foreign"]]) {
    await writeFile(suite, JSON.stringify({ ...definition, harnesses }));
    expect((await invoke([...base, "--", "--dry"])).code).toBe(64);
  }
  await writeFile(
    suite,
    JSON.stringify({ ...definition, harnesses: ["codex", "claude"] }),
  );
  const missing = await invoke([...base, "--", "--dry"]);
  expect(missing.code).toBe(64);
  expect(missing.stderr).toContain(
    "multiple harnesses require --host-options-file",
  );
  for (const options of [
    { codex: ["--host", "codex"] },
    { codex: ["--host", "codex"], claude: ["--host", "codex"] },
    { codex: ["--condition", "passive"], claude: ["--host", "claude"] },
  ]) {
    await writeFile(optionsFile, JSON.stringify(options));
    expect(
      (
        await invoke([
          ...base,
          "--host-options-file",
          optionsFile,
          "--",
          "--dry",
        ])
      ).code,
    ).toBe(64);
  }
  await writeFile(
    optionsFile,
    JSON.stringify({
      codex: ["--host", "codex"],
      claude: ["--host", "claude"],
    }),
  );
  const conflict = await invoke([
    ...base,
    "--host-options-file",
    optionsFile,
    "--",
    "--host",
    "codex",
    "--dry",
  ]);
  expect(conflict.code).toBe(64);
  expect(await Bun.file(results).exists()).toBeFalse();
});

test("suite compares a mounted skill with a no-skill baseline", async () => {
  const { root, adapter, suite } = await fixture();
  const results = await mkdtemp(join(tmpdir(), "darrow-sevro-ablation-"));
  roots.push(results);
  const skillRoot = join(root, "plugins/capability/example/skills/probe");
  await mkdir(join(skillRoot, "evals"), { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: probe\ndescription: Return ready.\n---\n\nReturn ready.\n",
  );
  await writeFile(
    join(skillRoot, "evals/suite-skill.yaml"),
    JSON.stringify({
      id: "suite-skill",
      invariant: "EXAMPLE-SKILL",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: init", files: { "README.md": "ready\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "response", expect_exact: "ready" }],
    }),
  );
  await writeFile(
    suite,
    JSON.stringify({
      version: 1,
      experiment: "skill-value",
      harnesses: ["codex"],
      case_filter: "suite-skill",
      modes: { baseline: { without_skill: true }, candidate: {} },
      ablations: [
        { name: "skill-value", baseline: "baseline", candidate: "candidate" },
      ],
    }),
  );
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  expect(run.stderr, run.stdout).toBe("");
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(
    run.code,
    `${run.stderr}\n${run.stdout}\n${JSON.stringify(manifest)}`,
  ).toBe(0);
  expect(manifest.cells).toHaveLength(2);
  expect(manifest.ablationReport.valid).toBeTrue();
  const ablation = JSON.parse(
    await readFile(manifest.ablationReport.jsonPath, "utf8"),
  );
  expect(ablation.valid).toBeTrue();
  expect(ablation.comparisons[0].cases[0]).toMatchObject({
    caseId: "suite-skill",
    passRate: { baseline: 1, candidate: 1, delta: 0 },
    tokens: { baseline: 2, candidate: 2, delta: 0 },
  });
  expect(ablation.comparisons[0].cases[0].costUsd).toEqual({
    baseline: null,
    candidate: null,
    delta: null,
  });
  const [baseline, candidate] = manifest.cells;
  expect(baseline.provenance.dimensions.caseDigest).toBe(
    candidate.provenance.dimensions.caseDigest,
  );
  expect(baseline.provenance.dimensions.fixtureDigest).not.toBe(
    candidate.provenance.dimensions.fixtureDigest,
  );
  expect(
    await readFile(manifest.ablationReport.markdownPath, "utf8"),
  ).toContain("unknown / unknown / unknown");
});

test("suite retains failed cells and continues the remaining public runs", async () => {
  const { root, cases, adapter, suite, results } = await fixture();
  const beta = join(cases, "suite-beta.yaml");
  const definition = JSON.parse(await readFile(beta, "utf8"));
  definition.output_checks[0].expect_exact = "different";
  await writeFile(beta, JSON.stringify(definition));
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  expect(run.code).toBe(1);
  expect(JSON.parse(run.stdout)).toMatchObject({ cells: 4, failed: 2 });
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  const report = JSON.parse(await readFile(manifest.report.jsonPath, "utf8"));
  expect(report.summary).toMatchObject({ passed: 2, failed: 2 });
  expect(
    manifest.cells.map((cell: { exitCode: number }) => cell.exitCode),
  ).toEqual([0, 1, 0, 1]);
  for (const cell of manifest.cells) {
    const result = JSON.parse(await readFile(cell.result, "utf8"));
    expect(result.task.verdict).toBe(
      cell.caseId === "suite-beta" ? "failed" : "passed",
    );
    expect(cell.provenance.evaluationDigest).toMatch(/^[a-f0-9]{64}$/);
  }
}, 15_000);

test("suite interruption cancels the active Sevro cell and stops selection", async () => {
  const { root, adapter, suite, results } = await fixture();
  const ready = join(root, "suite-ready");
  const child = Bun.spawn(
    [
      process.execPath,
      suiteCommand,
      "--suite",
      suite,
      "--project-root",
      root,
      "--results-root",
      results,
      "--trials",
      "1",
      "--threshold",
      "1",
      "--",
      "--adapter-module",
      adapter,
      "--shell-isolation",
    ],
    {
      env: { ...process.env, SEVRO_SUITE_READY_PATH: ready },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  try {
    await waitForFile(ready);
    child.kill("SIGTERM");
    const [stdout, code] = await Promise.all([
      new Response(child.stdout).text(),
      child.exited,
    ]);
    expect(code).toBe(143);
    expect(JSON.parse(stdout)).toMatchObject({
      cells: 1,
      interrupted: "SIGTERM",
    });
    const manifest = JSON.parse(
      await readFile(join(results, "suite-run.json"), "utf8"),
    );
    expect(manifest.interrupted).toBe("SIGTERM");
    expect(manifest.cells).toHaveLength(1);
    const report = JSON.parse(await readFile(manifest.report.jsonPath, "utf8"));
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].execution).toBe("cancelled");
    expect(manifest.cells[0].provenance.runner.source).toBe(
      process.env.SEVRO_CHECKOUT ? "checkout" : "package",
    );
    const result = JSON.parse(await readFile(manifest.cells[0].result, "utf8"));
    expect(result.execution.status).toBe("cancelled");
    expect(result.task.verdict).toBe("not_assessed");
  } finally {
    child.kill("SIGKILL");
    await child.exited;
  }
}, 20_000);
