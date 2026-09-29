import { afterEach, expect, test } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { compatibilityRunnerCommand, type CompatibilityPaths } from "./command";

interface RunnerFixture extends CompatibilityPaths {
  root: string;
}

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const roots: string[] = [];
const runnerSource = resolve(import.meta.dir, "..");
const nodeModules = resolve(import.meta.dir, "../../../node_modules");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function caseRecord(id: string) {
  return {
    id,
    invariant: "COMPAT-C1",
    prompt: "Return the synthetic compatibility response.",
    fixture: {
      files: { "README.md": "compatibility fixture\n" },
      commit_files: true,
    },
    checks: [{ name: "fixture file", run: "test -f README.md" }],
    output_checks: [
      {
        name: "synthetic response",
        expect_exact: "synthetic compatibility response",
      },
    ],
  };
}

async function writeSkillCase(
  root: string,
  skill: string,
  id: string,
): Promise<void> {
  const skillRoot = join(
    root,
    "plugins/capability/compatibility/skills",
    skill,
  );
  await mkdir(join(skillRoot, "evals"), { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    `---\nname: ${skill}\ndescription: Compatibility fixture\n---\n\nReturn the requested response.\n`,
  );
  await writeFile(
    join(skillRoot, "evals", `${id}.yaml`),
    JSON.stringify(caseRecord(id)),
  );
}

function syntheticAdapterSource(fixture: RunnerFixture): string {
  const adapter = join(fixture.root, "evals/runner/adapters/codex.ts");
  const control = join(fixture.root, "evals/runner/run-control.ts");
  return `
import { writeFile } from "node:fs/promises";
import { codexAdapter } from ${JSON.stringify(adapter)};
import { trackEvaluationProcess } from ${JSON.stringify(control)};

codexAdapter.sourceCodexPlugin = false;
codexAdapter.skillMounts = [".agents/skills"];
codexAdapter.version = async () => "synthetic-compatibility-v1";

let call = 0;
codexAdapter.run = async ({ control }) => {
  call += 1;
  const scenario = process.env.DARROW_EVAL_COMPAT_SCENARIO ?? "pass";
  if (scenario === "throw-after-first" && call > 1)
    throw new Error("synthetic adapter failure after retained trial");
  if (scenario === "wait") {
    const child = trackEvaluationProcess(Bun.spawn([
      process.execPath,
      "-e",
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
    ], { detached: true, stdout: "ignore", stderr: "ignore" }));
    await writeFile(process.env.DARROW_EVAL_COMPAT_CHILD_PID_PATH!, String(child.pid));
    await writeFile(process.env.DARROW_EVAL_COMPAT_READY_PATH!, "ready");
    await child.exited;
  }
  const resultText = scenario === "fail"
    ? "synthetic behavioral failure"
    : "synthetic compatibility response";
  return {
    ok: true,
    durationMs: 1,
    inputTokens: 2,
    outputTokens: 3,
    costUsd: null,
    tokenUsageComplete: scenario !== "incomplete-usage",
    evaluationEnforcement: control?.ownerEvaluationMode ?? "enforced",
    skillActivation: {
      source: "harness_event",
      complete: true,
      primarySkill: "compatibility-primary",
      observedSkills: ["compatibility-primary", "support"],
    },
    resultText,
    raw: \`synthetic retained evidence \${call}\`,
  };
};
`;
}

async function runnerFixture(separateTooling = false): Promise<RunnerFixture> {
  const projectRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-compatibility-")),
  );
  roots.push(projectRoot);
  const root = separateTooling
    ? await realpath(await mkdtemp(join(tmpdir(), "darrow-runner-tooling-")))
    : projectRoot;
  if (separateTooling) roots.push(root);
  expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
  const runnerPath = join(root, "evals/runner/run.ts");
  const resultsRoot = join(projectRoot, "evals/results");
  const syntheticAdapter = join(root, "synthetic-adapter.ts");
  const fixture = {
    root,
    projectRoot,
    resultsRoot,
    runnerPath,
    syntheticAdapter,
  };
  await cp(runnerSource, dirname(runnerPath), {
    recursive: true,
    filter: (path) =>
      !path.endsWith(".test.ts") && !path.includes("/compatibility"),
  });
  for (const path of [
    "fixture-ticket.ts",
    "sevro-extension/model-defaults.ts",
    "sevro-extension/review-axis.ts",
  ]) {
    await mkdir(dirname(join(root, "evals", path)), { recursive: true });
    await cp(resolve(runnerSource, "..", path), join(root, "evals", path));
  }
  await mkdir(join(root, "evals/corpus/orchestration"), { recursive: true });
  await cp(
    resolve(runnerSource, "../corpus/orchestration/source.ts"),
    join(root, "evals/corpus/orchestration/source.ts"),
  );
  await symlink(nodeModules, join(root, "node_modules"));
  await writeSkillCase(projectRoot, "compatibility-primary", "compat-selected");
  await writeSkillCase(projectRoot, "compatibility-primary", "compat-sibling");
  await writeSkillCase(projectRoot, "compatibility-other", "compat-other");
  await writeFile(syntheticAdapter, syntheticAdapterSource(fixture));
  return fixture;
}

function credentialFreeEnvironment(
  extra: Record<string, string> = {},
): Record<string, string> {
  const retained = Object.entries(process.env).filter(
    ([name, value]) =>
      value !== undefined &&
      !/(?:api[_-]?key|token|secret|password|credential)/i.test(name),
  ) as Array<[string, string]>;
  return { ...Object.fromEntries(retained), ...extra };
}

function commonArguments(...args: string[]): string[] {
  return [
    "--harness",
    "codex",
    "--model",
    "synthetic",
    "--trials",
    "1",
    "--jobs",
    "1",
    "--no-color",
    "--no-emoji",
    "--no-progress",
    ...args,
  ];
}

function startRunner(
  fixture: RunnerFixture,
  args: string[],
  environment: Record<string, string> = {},
) {
  return Bun.spawn([...compatibilityRunnerCommand(fixture), ...args], {
    cwd: fixture.projectRoot,
    env: credentialFreeEnvironment(environment),
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function runRunner(
  fixture: RunnerFixture,
  args: string[],
  environment: Record<string, string> = {},
): Promise<RunResult> {
  const proc = startRunner(fixture, args, environment);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

function containedBy(root: string, path: string): boolean {
  const rel = relative(root, path);
  return isAbsolute(path) && rel !== ".." && !rel.startsWith(`..${sep}`);
}

async function onlyResultPath(resultsRoot: string): Promise<string> {
  const names = (await readdir(resultsRoot)).filter((name) =>
    name.endsWith(".json"),
  );
  expect(names).toHaveLength(1);
  return join(resultsRoot, names[0]!);
}

async function onlyActiveRecord(resultsRoot: string) {
  const activeRoot = join(resultsRoot, "active");
  const names = (await readdir(activeRoot)).filter((name) =>
    name.endsWith(".json"),
  );
  expect(names).toHaveLength(1);
  return JSON.parse(await readFile(join(activeRoot, names[0]!), "utf8"));
}

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!(await Bun.file(path).exists())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await Bun.sleep(20);
  }
}

function processIsGone(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

test("runner command configuration expands fixture paths without shell parsing", () => {
  const paths: CompatibilityPaths = {
    projectRoot: "/project",
    resultsRoot: "/project/evals/results",
    runnerPath: "/project/evals/runner/run.ts",
    syntheticAdapter: "/project/adapter.ts",
  };
  expect(
    compatibilityRunnerCommand(
      paths,
      JSON.stringify([
        "sevro",
        "run",
        "--project-root={projectRoot}",
        "--results-root",
        "{resultsRoot}",
      ]),
    ),
  ).toEqual([
    "sevro",
    "run",
    "--project-root=/project",
    "--results-root",
    "/project/evals/results",
  ]);
});

test("selects and evaluates cases from an explicit project root outside runner source", async () => {
  const fixture = await runnerFixture(true);
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--skill",
      "compatibility-primary",
      "--case",
      "selected",
    ),
  );
  expect(run.code, run.stderr).toBe(0);
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(fixture.resultsRoot), "utf8"),
  );
  expect(result.caseId).toBe("compat-selected");
  expect(result.skillDirectory).toBe(
    join(
      fixture.projectRoot,
      "plugins/capability/compatibility/skills/compatibility-primary",
    ),
  );
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "fixture file", passed: true }),
      expect.objectContaining({ name: "synthetic response", passed: true }),
    ]),
  );
});

test("reads Codex evaluation configuration from an explicit configuration root", async () => {
  const fixture = await runnerFixture(true);
  const configRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-configuration-")),
  );
  roots.push(configRoot);
  await mkdir(join(configRoot, ".codex"));
  await mkdir(join(fixture.projectRoot, ".codex"));
  await writeFile(
    join(configRoot, ".codex/config.toml"),
    "[agents]\nmax_concurrent_threads_per_session = 7\n",
  );
  await writeFile(
    join(fixture.projectRoot, ".codex/config.toml"),
    "[agents]\nmax_concurrent_threads_per_session = 3\n",
  );
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--config-root",
      configRoot,
      "--case",
      "compat-selected",
    ),
  );
  expect(run.code, run.stderr).toBe(0);
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(fixture.resultsRoot), "utf8"),
  );
  expect(result.codexAgentConcurrencyLimit).toBe(7);
});

test("resolves supporting activation skills from the project root", async () => {
  const fixture = await runnerFixture(true);
  const supportPath = "plugins/capability/support/skills/support";
  await mkdir(join(fixture.projectRoot, supportPath), { recursive: true });
  await writeFile(
    join(fixture.projectRoot, supportPath, "SKILL.md"),
    "---\nname: support\ndescription: Supporting fixture\n---\n",
  );
  const casePath = join(
    fixture.projectRoot,
    "plugins/capability/compatibility/skills/compatibility-primary/evals/compat-selected.yaml",
  );
  const evalCase = JSON.parse(await readFile(casePath, "utf8"));
  await writeFile(
    casePath,
    JSON.stringify({
      ...evalCase,
      activation: "positive",
      activation_includes: ["support"],
      additional_skills: [supportPath],
    }),
  );
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--case",
      "compat-selected",
    ),
  );
  expect(run.code, run.stderr).toBe(0);
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(fixture.resultsRoot), "utf8"),
  );
  expect(result.trials[0].activation.passed).toBe(true);
});

test("shell checks cannot read the separately located project source", async () => {
  const fixture = await runnerFixture(true);
  const secret = join(fixture.projectRoot, "private-check.txt");
  await writeFile(secret, "hidden evaluator content\n");
  const casePath = join(
    fixture.projectRoot,
    "plugins/capability/compatibility/skills/compatibility-primary/evals/compat-selected.yaml",
  );
  const evalCase = JSON.parse(await readFile(casePath, "utf8"));
  evalCase.checks.push({
    name: "project source hidden",
    run: `if cat '${secret}' >/dev/null 2>&1; then exit 1; fi`,
  });
  await writeFile(casePath, JSON.stringify(evalCase));
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--case",
      "compat-selected",
    ),
  );
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(fixture.resultsRoot), "utf8"),
  );
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "project source hidden", passed: true }),
    ]),
  );
  expect(run.code, run.stderr).toBe(0);
});

test("shell checks cannot read a separate configuration root", async () => {
  const fixture = await runnerFixture(true);
  const configRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-configuration-")),
  );
  roots.push(configRoot);
  const secret = join(configRoot, "private-credential.txt");
  await writeFile(secret, "hidden evaluator credential\n");
  const casePath = join(
    fixture.projectRoot,
    "plugins/capability/compatibility/skills/compatibility-primary/evals/compat-selected.yaml",
  );
  const evalCase = JSON.parse(await readFile(casePath, "utf8"));
  evalCase.checks.push({
    name: "configuration source hidden",
    run: `if cat '${secret}' >/dev/null 2>&1; then exit 1; fi`,
  });
  await writeFile(casePath, JSON.stringify(evalCase));
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--config-root",
      configRoot,
      "--case",
      "compat-selected",
    ),
  );
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(fixture.resultsRoot), "utf8"),
  );
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "configuration source hidden",
        passed: true,
      }),
    ]),
  );
  expect(run.code, run.stderr).toBe(0);
});

test("runs shell checks when the runner installation has no Git metadata", async () => {
  const fixture = await runnerFixture(true);
  await rm(join(fixture.root, ".git"), { recursive: true });
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--case",
      "compat-selected",
    ),
  );
  expect(run.code, run.stderr).toBe(0);
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(fixture.resultsRoot), "utf8"),
  );
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "fixture file", passed: true }),
    ]),
  );
});

test("writes default result and run state under an explicit results root", async () => {
  const fixture = await runnerFixture(true);
  const resultsRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-results-")),
  );
  roots.push(resultsRoot);
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--results-root",
      resultsRoot,
      "--case",
      "compat-selected",
    ),
  );
  expect(run.code, run.stderr).toBe(0);
  const resultPath = await onlyResultPath(resultsRoot);
  const [result] = JSON.parse(await readFile(resultPath, "utf8"));
  expect(result.caseId).toBe("compat-selected");
  expect(await Bun.file(fixture.resultsRoot).exists()).toBeFalse();
  const active = await onlyActiveRecord(resultsRoot);
  expect(active.artifactPath).toBe(resultPath);
  expect(containedBy(resultsRoot, active.evidenceDirectory)).toBeTrue();
});

test("stores active ownership and checkpoints separately from results", async () => {
  const fixture = await runnerFixture(true);
  const resultsRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-results-")),
  );
  const runStateRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-state-")),
  );
  roots.push(resultsRoot, runStateRoot);
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--results-root",
      resultsRoot,
      "--run-state-root",
      runStateRoot,
      "--case",
      "compat-selected",
    ),
  );
  expect(run.code, run.stderr).toBe(0);
  const resultPath = await onlyResultPath(resultsRoot);
  const active = await onlyActiveRecord(runStateRoot);
  expect(active.artifactPath).toBe(resultPath);
  expect(containedBy(runStateRoot, active.evidenceDirectory)).toBeTrue();
  expect(await Bun.file(join(resultsRoot, "active")).exists()).toBeFalse();
});

test("shell checks cannot read separate result and run-state roots", async () => {
  const fixture = await runnerFixture(true);
  const resultsRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-results-")),
  );
  const runStateRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-state-")),
  );
  roots.push(resultsRoot, runStateRoot);
  const resultSecret = join(resultsRoot, "retained-secret.txt");
  const stateSecret = join(runStateRoot, "active-secret.txt");
  await writeFile(resultSecret, "retained evidence\n");
  await writeFile(stateSecret, "active owner\n");
  const casePath = join(
    fixture.projectRoot,
    "plugins/capability/compatibility/skills/compatibility-primary/evals/compat-selected.yaml",
  );
  const evalCase = JSON.parse(await readFile(casePath, "utf8"));
  for (const [name, path] of [
    ["retained results hidden", resultSecret],
    ["active state hidden", stateSecret],
  ]) {
    evalCase.checks.push({
      name,
      run: `if cat '${path}' >/dev/null 2>&1; then exit 1; fi`,
    });
  }
  await writeFile(casePath, JSON.stringify(evalCase));
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--results-root",
      resultsRoot,
      "--run-state-root",
      runStateRoot,
      "--case",
      "compat-selected",
    ),
  );
  const [result] = JSON.parse(
    await readFile(await onlyResultPath(resultsRoot), "utf8"),
  );
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "retained results hidden",
        passed: true,
      }),
      expect.objectContaining({ name: "active state hidden", passed: true }),
    ]),
  );
  expect(run.code, run.stderr).toBe(0);
});

test("shell checks cannot read an explicit result path outside the results root", async () => {
  const fixture = await runnerFixture(true);
  const outputRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-runner-output-")),
  );
  roots.push(outputRoot);
  const output = join(outputRoot, "custom.json");
  await writeFile(output, "prior retained evidence\n");
  const casePath = join(
    fixture.projectRoot,
    "plugins/capability/compatibility/skills/compatibility-primary/evals/compat-selected.yaml",
  );
  const evalCase = JSON.parse(await readFile(casePath, "utf8"));
  evalCase.checks.push({
    name: "explicit result hidden",
    run: `if cat '${output}' >/dev/null 2>&1; then exit 1; fi`,
  });
  await writeFile(casePath, JSON.stringify(evalCase));
  const run = await runRunner(
    fixture,
    commonArguments(
      "--project-root",
      fixture.projectRoot,
      "--output",
      output,
      "--case",
      "compat-selected",
    ),
  );
  const [result] = JSON.parse(await readFile(output, "utf8"));
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "explicit result hidden", passed: true }),
    ]),
  );
  expect(run.code, run.stderr).toBe(0);
});

test("selects cases from the project and keeps result evidence under its result root", async () => {
  const fixture = await runnerFixture();
  const run = await runRunner(
    fixture,
    commonArguments("--skill", "compatibility-primary", "--case", "selected"),
  );
  expect(run.code, run.stderr).toBe(0);

  const resultPath = await onlyResultPath(fixture.resultsRoot);
  const results = JSON.parse(await readFile(resultPath, "utf8"));
  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    caseId: "compat-selected",
    executionMode: "executed",
    harness: "codex",
    harnessVersion: "synthetic-compatibility-v1",
    passRate: 1,
    trials: [
      {
        passed: true,
        checks: expect.arrayContaining([
          expect.objectContaining({ name: "fixture file", passed: true }),
          expect.objectContaining({ name: "synthetic response", passed: true }),
        ]),
      },
    ],
  });
  expect(results[0].skillDirectory).toBe(
    join(
      fixture.projectRoot,
      "plugins/capability/compatibility/skills/compatibility-primary",
    ),
  );

  const active = await onlyActiveRecord(fixture.resultsRoot);
  expect(active).toMatchObject({
    format: "darrow-eval-active-run-v1",
    status: "complete",
    artifactPath: resultPath,
  });
  expect(containedBy(fixture.resultsRoot, active.evidenceDirectory)).toBeTrue();
  expect(
    await Bun.file(join(active.evidenceDirectory, "run.json")).exists(),
  ).toBeTrue();
});

test("distinguishes invalid invocation and behavioral failure from success", async () => {
  const invalidFixture = await runnerFixture();
  const invalid = await runRunner(invalidFixture, ["--dry"]);
  expect(invalid.code).not.toBe(0);
  expect(await Bun.file(invalidFixture.resultsRoot).exists()).toBeFalse();

  const failedFixture = await runnerFixture();
  const output = join(failedFixture.root, "behavioral-failure.json");
  const failed = await runRunner(
    failedFixture,
    commonArguments("--case", "compat-selected", "--output", output),
    { DARROW_EVAL_COMPAT_SCENARIO: "fail" },
  );
  expect(failed.code).not.toBe(0);
  expect(await Bun.file(output).exists()).toBeTrue();
  expect(await Bun.file(`${output}.diagnostic.json`).exists()).toBeFalse();
  const [result] = JSON.parse(await readFile(output, "utf8"));
  expect(result).toMatchObject({ caseId: "compat-selected", passRate: 0 });
  expect(result.trials[0].checks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: "fixture file", passed: true }),
      expect.objectContaining({ name: "synthetic response", passed: false }),
    ]),
  );
});

test("retains requested and observed evaluation conditions as separate evidence", async () => {
  const results = [];
  for (const mode of ["passive", "enforced"] as const) {
    const fixture = await runnerFixture();
    const output = join(fixture.root, `${mode}.json`);
    const run = await runRunner(
      fixture,
      commonArguments(
        "--case",
        "compat-selected",
        "--owner-evaluation",
        mode,
        "--output",
        output,
      ),
    );
    expect(run.code, run.stderr).toBe(0);
    const [result] = JSON.parse(await readFile(output, "utf8"));
    expect(result.ownerEvaluationMode).toBe(mode);
    expect(result.trials[0].harness.evaluationEnforcement).toBe(mode);
    results.push(result);
  }
  expect(results[0].evaluationDigest).not.toBe(results[1].evaluationDigest);
});

test("retains incomplete usage and unknown cost without changing task checks", async () => {
  const fixture = await runnerFixture();
  const output = join(fixture.root, "incomplete-usage.json");
  const run = await runRunner(
    fixture,
    commonArguments("--case", "compat-selected", "--output", output),
    { DARROW_EVAL_COMPAT_SCENARIO: "incomplete-usage" },
  );
  expect(run.code, run.stderr).toBe(0);
  const [result] = JSON.parse(await readFile(output, "utf8"));
  expect(result.passRate).toBe(1);
  expect(result.trials[0].harness).toMatchObject({
    tokenUsageComplete: false,
    costUsd: null,
  });
});

test("writes a diagnostic and retains completed trial evidence after a runner error", async () => {
  const fixture = await runnerFixture();
  const output = join(fixture.root, "failed-run.json");
  const run = await runRunner(
    fixture,
    [
      ...commonArguments("--case", "compat-selected", "--output", output),
      "--trials",
      "2",
    ],
    { DARROW_EVAL_COMPAT_SCENARIO: "throw-after-first" },
  );
  expect(run.code).not.toBe(0);
  expect(await Bun.file(output).exists()).toBeFalse();

  const diagnosticPath = `${output}.diagnostic.json`;
  const diagnostic = JSON.parse(await readFile(diagnosticPath, "utf8"));
  expect(diagnostic).toMatchObject({
    format: "darrow-eval-diagnostic-v1",
    artifactPath: output,
  });
  expect(diagnostic.completedTrials).toHaveLength(1);
  expect(containedBy(fixture.resultsRoot, diagnostic.activeRunPath)).toBeTrue();
  expect(
    containedBy(fixture.resultsRoot, diagnostic.evidenceDirectory),
  ).toBeTrue();

  const retainedPath = diagnostic.completedTrials[0].artifactPath;
  expect(containedBy(fixture.resultsRoot, retainedPath)).toBeTrue();
  const retained = JSON.parse(await readFile(retainedPath, "utf8"));
  expect(retained).toMatchObject({
    format: "darrow-eval-trial-v1",
    plannedTrials: 2,
    case: {
      caseId: "compat-selected",
      trials: [
        {
          trial: 1,
          harness: { raw: "synthetic retained evidence 1" },
        },
      ],
    },
  });
});

test("cancellation stops adapter work and finalizes interruption evidence", async () => {
  const fixture = await runnerFixture();
  const output = join(fixture.root, "interrupted-run.json");
  const ready = join(fixture.root, "adapter-ready");
  const childPidPath = join(fixture.root, "adapter-child-pid");
  const proc = startRunner(
    fixture,
    commonArguments("--case", "compat-selected", "--output", output),
    {
      DARROW_EVAL_COMPAT_SCENARIO: "wait",
      DARROW_EVAL_COMPAT_READY_PATH: ready,
      DARROW_EVAL_COMPAT_CHILD_PID_PATH: childPidPath,
    },
  );
  await waitForFile(ready);
  proc.kill("SIGTERM");
  const code = await proc.exited;
  expect(code).not.toBe(0);
  expect(await Bun.file(output).exists()).toBeFalse();

  const childPid = Number(await readFile(childPidPath, "utf8"));
  expect(processIsGone(childPid)).toBeTrue();
  const diagnostic = JSON.parse(
    await readFile(`${output}.diagnostic.json`, "utf8"),
  );
  expect(diagnostic).toMatchObject({
    format: "darrow-eval-diagnostic-v1",
    artifactPath: output,
    completedTrials: [],
  });
  const active = await onlyActiveRecord(fixture.resultsRoot);
  expect(active.status).toBe("interrupted");
  expect(active.diagnosticPath).toBe(`${output}.diagnostic.json`);
}, 15_000);
