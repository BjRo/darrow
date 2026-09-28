import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { selectCaseIds } from "../../sevro-extension/index";
import { sevroCommand } from "../../sevro-extension/sevro-command";

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

async function invoke(
  args: string[],
  environment: Record<string, string | undefined> = {},
) {
  const proc = Bun.spawn([process.execPath, suiteCommand, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...environment },
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "suite applies per-mode candidate routes independently for both hosts",
  async () => {
    const { root, suite, results } = await fixture();
    const binRoot = await mkdtemp(
      join(tmpdir(), "darrow-sevro-suite-binaries-"),
    );
    roots.push(binRoot);
    const codexBinary = join(binRoot, "synthetic-codex");
    const claudeBinary = join(binRoot, "synthetic-claude");
    const codexAuth = join(root, "codex-auth.json");
    const claudeAuth = join(root, "claude-auth.json");
    const realCodex = `'${Bun.which("codex")!.replaceAll("'", `'"'"'`)}'`;
    const events = [
      { type: "thread.started", thread_id: "synthetic-suite-turn" },
      {
        type: "item.completed",
        item: { type: "agent_message", text: "ready" },
      },
      { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n");
    await Promise.all([
      writeFile(codexAuth, "test-only-auth\n", { mode: 0o600 }),
      writeFile(claudeAuth, '{"test":"private-login"}', { mode: 0o600 }),
      writeFile(
        codexBinary,
        `#!/bin/sh
if [ "$1" = sandbox ]; then exec ${realCodex} "$@"; fi
if [ "$1" = --version ]; then printf 'synthetic-codex\\n'; exit 0; fi
if [ "$1" != exec ]; then exit 99; fi
/bin/cat >/dev/null
/bin/cat <<'SEVRO_EVENTS'
${events}
SEVRO_EVENTS
`,
        { mode: 0o700 },
      ),
      writeFile(
        claudeBinary,
        `#!/bin/sh
test -r "$CLAUDE_CONFIG_DIR/.credentials.json" || exit 3
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"result":"ready","usage":{"input_tokens":1,"output_tokens":1},"total_cost_usd":0}'
`,
        { mode: 0o700 },
      ),
    ]);
    await writeFile(
      suite,
      JSON.stringify({
        version: 1,
        experiment: "mode-routes",
        harnesses: ["codex", "claude"],
        case_filter: "suite-alpha",
        modes: {
          original: { owner_evaluation: "passive" },
          overridden: {
            owner_evaluation: "passive",
            model_by_harness: {
              codex: "codex-variant",
              claude: "claude-variant",
            },
            effort: "high",
          },
        },
      }),
    );
    const optionsFile = join(root, "hosts.json");
    await writeFile(
      optionsFile,
      JSON.stringify({
        codex: [
          "--host",
          "codex",
          "--codex-bin",
          codexBinary,
          "--codex-auth-file",
          codexAuth,
          "--model=base-codex",
          "--effort",
          "low",
        ],
        claude: [
          "--host",
          "claude",
          "--claude-bin",
          claudeBinary,
          "--claude-credential-file",
          claudeAuth,
          "--model",
          "base-claude",
          "--effort=low",
        ],
      }),
    );
    const args = [
      "--suite",
      suite,
      "--project-root",
      root,
      "--results-root",
      results,
      "--host-options-file",
      optionsFile,
      "--trials",
      "1",
      "--threshold",
      "1",
      "--",
      "--shell-isolation",
    ];
    const run = await invoke(args);
    expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(0);
    const manifest = JSON.parse(
      await readFile(join(results, "suite-run.json"), "utf8"),
    );
    expect(manifest.cells).toHaveLength(4);
    expect(manifest.modes[1]).toMatchObject({
      modelByHarness: { codex: "codex-variant", claude: "claude-variant" },
      effort: "high",
    });
    expect(
      manifest.cells.map(
        (cell: { provenance: { routes: unknown[] } }) =>
          cell.provenance.routes[0],
      ),
    ).toEqual([
      {
        role: "candidate",
        host: "sevro.host.codex",
        model: "base-codex",
        effort: "low",
      },
      {
        role: "candidate",
        host: "sevro.host.claude",
        model: "base-claude",
        effort: "low",
      },
      {
        role: "candidate",
        host: "sevro.host.codex",
        model: "codex-variant",
        effort: "high",
      },
      {
        role: "candidate",
        host: "sevro.host.claude",
        model: "claude-variant",
        effort: "high",
      },
    ]);
    expect(manifest.cells[2].requestedRoute).toEqual({
      model: "codex-variant",
      effort: "high",
    });
    expect(manifest.cells[3].requestedRoute).toEqual({
      model: "claude-variant",
      effort: "high",
    });
    const route = sevroCommand();
    const contradictorySevro = join(binRoot, "contradictory-sevro");
    await writeFile(
      contradictorySevro,
      `#!${process.execPath}
import { readFile, writeFile } from "node:fs/promises";
const args = process.argv.slice(2);
const child = Bun.spawn([...${JSON.stringify(route.launch)}, ...args,
  ...(args[0] === "run" ? ${JSON.stringify(route.extraArgs)} : [])], { stdout: "pipe", stderr: "inherit" });
const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
if (code === 0 && args[0] === "run") {
  const result = JSON.parse(stdout);
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  for (const actual of evidence.routes) {
    if (actual.role === "candidate" && actual.model.endsWith("-variant"))
      actual[process.env.SEVRO_TEST_BAD_ROUTE_FIELD] = "contradictory";
  }
  await writeFile(result.evidencePath, JSON.stringify(evidence));
}
process.stdout.write(stdout);
process.exitCode = code;
`,
      { mode: 0o700 },
    );
    for (const field of ["model", "effort"]) {
      const mismatchedRoot = join(results, field);
      const mismatch = await invoke(
        args.map((arg) => (arg === results ? mismatchedRoot : arg)),
        {
          SEVRO_CHECKOUT: undefined,
          SEVRO_PACKAGE_BIN: contradictorySevro,
          SEVRO_TEST_BAD_ROUTE_FIELD: field,
        },
      );
      expect(mismatch.code, `${mismatch.stderr}\n${mismatch.stdout}`).toBe(1);
      const retained = JSON.parse(
        await readFile(join(mismatchedRoot, "suite-run.json"), "utf8"),
      );
      expect(
        retained.cells.map((cell: { exitCode: number }) => cell.exitCode),
      ).toEqual([0, 0, 70, 70]);
      expect(retained.cells[2].provenance).toBeNull();
      const result = JSON.parse(
        await readFile(retained.cells[2].result, "utf8"),
      );
      expect(result.task.verdict).toBe("passed");
      expect(result.exitCode).toBe(0);
    }
    const plugin = join(root, "plugins/capability/example");
    const skill = join(plugin, "skills/probe");
    await mkdir(join(skill, "evals"), { recursive: true });
    await writeFile(
      join(skill, "SKILL.md"),
      "---\nname: probe\ndescription: Return ready.\n---\nReturn ready.\n",
    );
    for (const host of ["codex", "claude"]) {
      await mkdir(join(plugin, `.${host}-plugin`));
      await writeFile(
        join(plugin, `.${host}-plugin/plugin.json`),
        JSON.stringify({ name: "example", version: "0.1.0" }),
      );
    }
    const selectedCase = JSON.parse(
      await readFile(
        join(root, "evals/experiments/example/cases/suite-alpha.yaml"),
        "utf8",
      ),
    );
    selectedCase.id = "route-ablation";
    await writeFile(
      join(skill, "evals/route-ablation.yaml"),
      JSON.stringify(selectedCase),
    );
    const definition = JSON.parse(await readFile(suite, "utf8"));
    definition.case_filter = "route-ablation";
    definition.modes.original.without_skill = true;
    definition.ablations = [
      { name: "route-mismatch", baseline: "original", candidate: "overridden" },
    ];
    await writeFile(suite, JSON.stringify(definition));
    const ablationRoot = join(binRoot, "ablation-results");
    const ablation = await invoke(
      args.map((arg) => (arg === results ? ablationRoot : arg)),
    );
    expect(ablation.code, `${ablation.stderr}\n${ablation.stdout}`).toBe(1);
    const comparison = JSON.parse(
      await readFile(join(ablationRoot, "suite-run.json"), "utf8"),
    );
    expect(
      comparison.cells.every(
        (cell: { exitCode: number }) => cell.exitCode === 0,
      ),
    ).toBeTrue();
    expect(comparison.ablationReport.valid).toBeFalse();
    const report = JSON.parse(
      await readFile(comparison.ablationReport.jsonPath, "utf8"),
    );
    expect(report.comparisons[0].cases).toEqual([]);
  },
  45_000,
);

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

test("suite supports legacy defaults and focused host, mode, and case selection", async () => {
  const { root, adapter, suite, results } = await fixture();
  const definition = JSON.parse(await readFile(suite, "utf8"));
  delete definition.harnesses;
  definition.case_filter = "suite-alpha";
  await writeFile(suite, JSON.stringify(definition));
  const run = await invoke([
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
    "--harness",
    "codex",
    "--mode",
    "enforced",
    "--case",
    "suite-beta",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(0);
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(manifest.harnesses).toEqual(["codex"]);
  expect(manifest.caseIds).toEqual(["suite-beta"]);
  expect(manifest.modes).toEqual([
    { name: "enforced", condition: "enforced", withoutSkill: false },
  ]);
  expect(manifest.cells).toHaveLength(1);
  expect(manifest.cells[0]).toMatchObject({
    harness: "codex",
    mode: "enforced",
    caseId: "suite-beta",
  });
}, 15_000);

test("suite keeps both-host options when narrowing a default-host suite", async () => {
  const { root, adapter, suite, results } = await fixture();
  const definition = JSON.parse(await readFile(suite, "utf8"));
  delete definition.harnesses;
  definition.case_filter = "suite-alpha";
  definition.modes = { passive: definition.modes.passive };
  await writeFile(suite, JSON.stringify(definition));
  const claudeAdapter = join(root, "claude-adapter.ts");
  await writeFile(
    claudeAdapter,
    (await readFile(adapter, "utf8")).replace(
      'id: "sevro.host.codex"',
      'id: "sevro.host.claude"',
    ),
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
    "--host-options-file",
    optionsFile,
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    "--shell-isolation",
  ];
  const focusedRoot = join(results, "focused");
  const focusedArgs = args.map((arg) => (arg === results ? focusedRoot : arg));
  const separator = focusedArgs.indexOf("--");
  focusedArgs.splice(separator, 0, "--harness", "codex");
  const focused = await invoke(focusedArgs);
  expect(focused.code, `${focused.stderr}\n${focused.stdout}`).toBe(0);
  const selected = JSON.parse(
    await readFile(join(focusedRoot, "suite-run.json"), "utf8"),
  );
  expect(selected.harnesses).toEqual(["codex"]);
  expect(selected.cells).toHaveLength(1);
  const both = await invoke(args);
  expect(both.code, `${both.stderr}\n${both.stdout}`).toBe(0);
  const matrix = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(matrix.harnesses).toEqual(["claude", "codex"]);
  expect(matrix.cells.map((cell: { harness: string }) => cell.harness)).toEqual(
    ["claude", "codex"],
  );
  expect(matrix.hostOptionsSha256).toBe(selected.hostOptionsSha256);
  await writeFile(
    optionsFile,
    JSON.stringify({
      codex: ["--adapter-module", adapter],
      claude: ["--host", "codex"],
    }),
  );
  const invalidRoot = join(results, "invalid-unused-host");
  const invalid = await invoke(
    focusedArgs.map((arg) => (arg === focusedRoot ? invalidRoot : arg)),
  );
  expect(invalid.code, invalid.stderr).toBe(64);
  expect(await Bun.file(invalidRoot).exists()).toBeFalse();
}, 15_000);

test("suite rejects unsupported focus selections before starting cells", async () => {
  const { root, adapter, suite, results } = await fixture();
  const base = [
    "--suite",
    suite,
    "--project-root",
    root,
    "--results-root",
    results,
  ];
  for (const selected of [
    ["--harness", "claude"],
    ["--harness", "foreign"],
    ["--harness", "codex", "--harness", "codex"],
    ["--mode", "missing"],
    ["--mode", "passive", "--mode", "passive"],
    ["--case", "missing"],
    ["--case", ""],
  ]) {
    const run = await invoke([
      ...base,
      ...selected,
      "--",
      "--dry",
      "--adapter-module",
      adapter,
    ]);
    expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(64);
    expect(await Bun.file(results).exists()).toBeFalse();
  }
});

test("suite rejects invalid mode model and effort declarations before execution", async () => {
  const { root, suite, results } = await fixture();
  const definition = JSON.parse(await readFile(suite, "utf8"));
  const invalid = [
    { model_by_harness: [] },
    { model_by_harness: {} },
    { model_by_harness: { other: "model" } },
    { model_by_harness: { codex: "" } },
    { model_by_harness: { codex: 42 } },
    { effort: "" },
    { effort: true },
    { effort: "high\n" },
  ];
  for (const mode of invalid) {
    await writeFile(
      suite,
      JSON.stringify({ ...definition, modes: { candidate: mode } }),
    );
    const run = await invoke([
      "--suite",
      suite,
      "--project-root",
      root,
      "--results-root",
      results,
      "--",
      "--dry",
    ]);
    expect(run.code, run.stderr).toBe(64);
    expect(await Bun.file(results).exists()).toBeFalse();
  }
});

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
    trueSelections: 1,
    falseSelections: 0,
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
  const activation = JSON.parse(
    await readFile(manifest.activationReport.jsonPath, "utf8"),
  );
  expect(activation.groups[0]).toMatchObject({ recall: null, precision: null });
  expect(activation.groups[0].classes.positive).toEqual({
    trials: 2,
    measured: 1,
    passed: 1,
    failed: 0,
    unavailable: 1,
    passRate: null,
  });
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
  const dryReport = JSON.parse(
    await readFile(preparation.activationReport.jsonPath, "utf8"),
  );
  expect(dryReport.summary).toMatchObject({ notRun: 1, notRequested: 1 });
  expect(
    dryReport.groups.every(
      (group: { recall: unknown; precision: unknown }) =>
        group.recall === null && group.precision === null,
    ),
  ).toBeTrue();
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
  const report = JSON.parse(
    await readFile(execution.activationReport.jsonPath, "utf8"),
  );
  expect(report.groups).toHaveLength(2);
  expect(report.groups[0]).toMatchObject({
    mode: "candidate",
    recall: 0.5,
    precision: 1,
  });
  expect(report.groups[1]).toMatchObject({
    mode: "baseline",
    recall: null,
    precision: null,
  });
  expect(report.groups[1].classes.positive.trials).toBe(0);
}, 15_000);

test("suite reports activation classes and selection metrics separately from tasks", async () => {
  const { root, adapter, suite, results } = await activationFixture();
  const skill = join(root, "plugins/capability/example/skills/probe");
  await rm(join(skill, "evals/suite-activation.yaml"));
  const sibling = join(root, "plugins/capability/example/skills/rival");
  await mkdir(sibling, { recursive: true });
  await writeFile(
    join(sibling, "SKILL.md"),
    "---\nname: rival\ndescription: An adjacent capability.\n---\nReturn ready.\n",
  );
  for (const activation of ["positive", "negative", "competition"]) {
    await writeFile(
      join(skill, `evals/activation-${activation}.yaml`),
      JSON.stringify({
        id: `activation-${activation}`,
        invariant: "EXAMPLE-ACTIVATION",
        activation,
        mount_plugin_skills: activation === "competition",
        prompt: activation,
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
  await writeFile(
    adapter,
    `const counts = {};
export default {
  id: "sevro.host.codex", model: "synthetic", effort: "none",
  async run({ condition, prompt }) {
    const first = (counts[prompt] = (counts[prompt] ?? 0) + 1) === 1;
    const primary = prompt === "negative" ? (first ? "rival" : "probe")
      : first ? "probe" : prompt === "competition" ? "rival" : null;
    return { finalMessage: "ready", complete: true, actualCondition: condition,
      observations: [{ id: "sevro.codex.skill-reads", completeness: "complete",
        data: { method: "skill_file_read_probe", primarySkill: primary,
          observedSkills: primary ? [primary] : [] } }] };
  },
};\n`,
  );
  const definition = JSON.parse(await readFile(suite, "utf8"));
  definition.case_filter = "activation-";
  await writeFile(suite, JSON.stringify(definition));
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
  expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(1);
  expect(
    manifest.cells.every((cell: { exitCode: number }) => cell.exitCode === 0),
  ).toBeTrue();
  expect(manifest.activationReport?.jsonPath).toBeString();
  const activation = JSON.parse(
    await readFile(manifest.activationReport.jsonPath, "utf8"),
  );
  expect(activation.format).toBe("darrow-sevro-activation-v1");
  expect(activation.rows).toHaveLength(3);
  expect(activation.summary).toEqual({
    cells: 3,
    passed: 0,
    failed: 3,
    unavailable: 0,
    notRun: 0,
    notRequested: 0,
  });
  expect(activation.groups).toHaveLength(1);
  expect(activation.groups[0]).toMatchObject({
    harness: "codex",
    mode: "candidate",
    condition: "passive",
    recall: 0.5,
    precision: 0.5,
  });
  for (const label of ["positive", "negative", "competition"]) {
    expect(activation.groups[0].classes[label]).toEqual({
      trials: 2,
      measured: 2,
      passed: 1,
      failed: 1,
      unavailable: 0,
      passRate: 0.5,
    });
  }
  const task = JSON.parse(await readFile(manifest.report.jsonPath, "utf8"));
  expect(task.summary).toMatchObject({ passed: 3, failed: 0 });
  const markdown = await readFile(
    manifest.activationReport.markdownPath,
    "utf8",
  );
  expect(markdown).toContain("# Darrow activation report");
  expect(markdown).toContain("Recall: 50.0%; precision: 50.0%");
}, 15_000);

test("suite leaves precision unknown when a negative case selects an adjacent skill", async () => {
  const { root, adapter, suite, results } = await activationFixture();
  const casePath = join(
    root,
    "plugins/capability/example/skills/probe/evals/suite-activation.yaml",
  );
  const definition = JSON.parse(await readFile(casePath, "utf8"));
  definition.activation = "negative";
  await writeFile(casePath, JSON.stringify(definition));
  await writeFile(
    adapter,
    (await readFile(adapter, "utf8")).replace(
      '++runs === 1 ? ["probe"] : []',
      '["rival"]',
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
    "1",
    "--threshold",
    "1",
    "--",
    "--adapter-module",
    adapter,
    "--shell-isolation",
  ]);
  expect(run.code, `${run.stderr}\n${run.stdout}`).toBe(0);
  const manifest = JSON.parse(
    await readFile(join(results, "suite-run.json"), "utf8"),
  );
  expect(manifest.cells[0].activation).toMatchObject({
    status: "passed",
    trueSelections: 0,
    falseSelections: 0,
  });
  const report = JSON.parse(
    await readFile(manifest.activationReport.jsonPath, "utf8"),
  );
  expect(report.groups[0]).toMatchObject({ recall: null, precision: null });
  expect(report.groups[0].classes.negative).toMatchObject({
    trials: 1,
    passed: 1,
    failed: 0,
    passRate: 1,
  });
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
  const activation = JSON.parse(
    await readFile(manifest.activationReport.jsonPath, "utf8"),
  );
  expect(
    activation.groups.map((group: { harness: string; mode: string }) => [
      group.harness,
      group.mode,
    ]),
  ).toEqual([
    ["codex", "baseline"],
    ["claude", "baseline"],
    ["codex", "candidate"],
    ["claude", "candidate"],
  ]);
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
