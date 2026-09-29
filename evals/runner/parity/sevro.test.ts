import { afterEach, expect, test } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sevroCommand } from "../../sevro-extension/sevro-command";

const roots: string[] = [];
const runnerRoot = resolve(import.meta.dir, "..");
const response = "synthetic compatibility response";
const digest = "a".repeat(64);

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function installedSevro(): Promise<{
  command: string[];
  version: string;
}> {
  const checkout = process.env.SEVRO_CHECKOUT;
  if (!checkout || !isAbsolute(checkout))
    throw new Error("SEVRO_CHECKOUT must name an absolute local checkout");
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-package-"));
  roots.push(root);
  const packingSource = join(root, "packing-source");
  await mkdir(packingSource);
  await Promise.all(
    ["package.json", "README.md", "docs", "examples", "schemas", "src"].map(
      (name) =>
        cp(join(checkout, name), join(packingSource, name), {
          recursive: true,
        }),
    ),
  );
  const packed = await command(
    ["npm", "pack", "--ignore-scripts", "--pack-destination", root, "--silent"],
    "pass",
    packingSource,
  );
  if (packed.code !== 0)
    throw new Error(`npm pack failed: ${packed.stderr || packed.stdout}`);
  await rm(packingSource, { recursive: true, force: true });
  if ((await readdir(root)).includes("packing-source"))
    throw new Error("packing source remained available after archive creation");
  const archive = join(root, packed.stdout.trim());
  const consumer = join(root, "consumer");
  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "darrow-sevro-parity-consumer", private: true }),
  );
  const installed = await command(
    [process.execPath, "add", archive],
    "pass",
    consumer,
  );
  if (installed.code !== 0)
    throw new Error(`bun add failed: ${installed.stderr || installed.stdout}`);
  const packageRoot = join(consumer, "node_modules", "@bjoernrochel", "sevro");
  const bin = join(consumer, "node_modules", ".bin", "sevro");
  const binTarget = await realpath(bin);
  const canonicalPackageRoot = await realpath(packageRoot);
  if (
    !binTarget.startsWith(`${canonicalPackageRoot}${sep}`) ||
    (await readdir(packageRoot)).includes(".git")
  )
    throw new Error("installed Sevro command is not isolated from source Git");
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  ) as { version: string };
  return { command: [bin], version: manifest.version };
}

function credentialFreeEnvironment(
  extra: Record<string, string>,
): Record<string, string> {
  const retained = Object.entries(process.env).filter(
    ([name, value]) =>
      value !== undefined &&
      !/(?:api[_-]?key|token|secret|password|credential)/i.test(name),
  ) as Array<[string, string]>;
  return { ...Object.fromEntries(retained), ...extra };
}

async function command(argv: string[], scenario: string, cwd: string) {
  const proc = startCommand(argv, scenario, cwd);
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, code };
}

function startCommand(
  argv: string[],
  scenario: string,
  cwd: string,
  extra: Record<string, string> = {},
) {
  const environment = credentialFreeEnvironment({
    SEVRO_PARITY_SCENARIO: scenario,
    ...extra,
  });
  if (argv.includes(join(runnerRoot, "run.ts"))) {
    delete environment.SEVRO_CHECKOUT;
    delete environment.SEVRO_PACKAGE_BIN;
  }
  return Bun.spawn(argv, {
    cwd,
    env: environment,
    stdout: "pipe",
    stderr: "pipe",
  });
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

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function fixture(isolation = false, separateStorage = false) {
  const projectRoot = await mkdtemp(join(tmpdir(), "darrow-sevro-parity-"));
  roots.push(projectRoot);
  expect(Bun.spawnSync(["git", "init", "--quiet", projectRoot]).exitCode).toBe(
    0,
  );
  const skillRoot = join(
    projectRoot,
    "plugins/capability/compatibility/skills/compatibility-primary",
  );
  await mkdir(join(skillRoot, "evals"), { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: compatibility-primary\ndescription: Compatibility fixture\n---\n\nReturn the requested response.\n",
  );
  const configRoot = isolation
    ? await mkdtemp(join(tmpdir(), "darrow-sevro-config-"))
    : null;
  if (configRoot) roots.push(configRoot);
  const storage = separateStorage
    ? {
        legacyResultsRoot: await realpath(
          await mkdtemp(join(tmpdir(), "darrow-legacy-results-")),
        ),
        legacyStateRoot: await realpath(
          await mkdtemp(join(tmpdir(), "darrow-legacy-state-")),
        ),
        sevroResultsRoot: await realpath(
          await mkdtemp(join(tmpdir(), "darrow-sevro-results-")),
        ),
        sevroStateRoot: await realpath(
          await mkdtemp(join(tmpdir(), "darrow-sevro-state-")),
        ),
      }
    : null;
  if (storage) roots.push(...Object.values(storage));
  const shellChecks = [
    { name: "fixture file", id: "fixture-file", run: "test -f README.md" },
  ];
  const hiddenSources: string[] = [];
  if (configRoot) {
    const projectSecret = join(projectRoot, "private-source.txt");
    const configSecret = join(configRoot, "private-config.txt");
    hiddenSources.push(projectSecret, configSecret);
    await Promise.all([
      writeFile(projectSecret, "hidden project source\n"),
      writeFile(configSecret, "hidden configuration\n"),
    ]);
    shellChecks.push(
      {
        name: "project source hidden",
        id: "project-source-hidden",
        run: `if cat ${shellQuote(projectSecret)} >/dev/null 2>&1; then exit 1; fi`,
      },
      {
        name: "configuration source hidden",
        id: "configuration-source-hidden",
        run: `if cat ${shellQuote(configSecret)} >/dev/null 2>&1; then exit 1; fi`,
      },
    );
  }
  await writeFile(
    join(skillRoot, "evals/compat-selected.yaml"),
    JSON.stringify({
      id: "compat-selected",
      invariant: "COMPAT-C1",
      prompt: `Return ${response}.`,
      fixture: {
        files: { "README.md": "compatibility fixture\n" },
        commit_files: true,
      },
      checks: shellChecks.map(({ name, run }) => ({ name, run })),
      output_checks: [{ name: "synthetic response", expect_exact: response }],
    }),
  );
  const caseFile = join(projectRoot, "resolved-case.json");
  await writeFile(
    caseFile,
    JSON.stringify({
      id: "compat-selected",
      prompt: `Return ${response}.`,
      fixture: { files: { "README.md": "compatibility fixture\n" } },
      checks: [
        ...shellChecks.map(({ id, run }) => ({
          id,
          grader: "sevro.shell",
          configuration: { run },
        })),
        {
          id: "synthetic-response",
          grader: "sevro.regex",
          configuration: { pattern: `^${response}$` },
        },
      ],
      requiredEvidence: [],
    }),
  );
  const legacyAdapter = join(projectRoot, "legacy-adapter.ts");
  await writeFile(
    legacyAdapter,
    `import { writeFile } from "node:fs/promises";
import { codexAdapter } from ${JSON.stringify(join(runnerRoot, "adapters/codex.ts"))};
import { trackEvaluationProcess } from ${JSON.stringify(join(runnerRoot, "run-control.ts"))};
codexAdapter.sourceCodexPlugin = false;
codexAdapter.skillMounts = [".agents/skills"];
codexAdapter.version = async () => "synthetic-parity-v1";
codexAdapter.run = async ({ control }) => {
  const scenario = process.env.SEVRO_PARITY_SCENARIO ?? "pass";
  if (scenario === "wait") {
    const child = trackEvaluationProcess(Bun.spawn([
      process.execPath, "-e",
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
    ], { detached: true, stdout: "ignore", stderr: "ignore" }));
    await writeFile(process.env.SEVRO_PARITY_CHILD_PID_PATH!, String(child.pid));
    await writeFile(process.env.SEVRO_PARITY_READY_PATH!, "ready");
    await child.exited;
  }
  return {
    ok: true, durationMs: 1, inputTokens: 2, outputTokens: 3, costUsd: null,
    tokenUsageComplete: scenario !== "incomplete-usage",
    evaluationEnforcement: control?.ownerEvaluationMode ?? "passive",
    skillActivation: { source: "harness_event", complete: true,
      primarySkill: "compatibility-primary", observedSkills: ["compatibility-primary"] },
    resultText: scenario === "fail" ? "synthetic behavioral failure" : ${JSON.stringify(response)},
    raw: "synthetic retained evidence",
  };
};
`,
  );
  const sevroAdapter = join(projectRoot, "sevro-adapter.ts");
  await writeFile(
    sevroAdapter,
    `import { writeFile } from "node:fs/promises";
export default {
  id: "codex", model: "synthetic", effort: "low",
  async run({ condition, signal }) {
    const scenario = process.env.SEVRO_PARITY_SCENARIO ?? "pass";
    if (scenario === "wait") {
      await writeFile(process.env.SEVRO_PARITY_READY_PATH!, "ready");
      await new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
      });
    }
    return {
      finalMessage: scenario === "fail" ? "synthetic behavioral failure" : ${JSON.stringify(response)},
      complete: true, actualCondition: condition,
      inputTokens: 2, outputTokens: 3, costUsd: null,
      usageComplete: scenario !== "incomplete-usage",
    };
  },
};
`,
  );
  return {
    projectRoot,
    configRoot,
    caseFile,
    legacyAdapter,
    sevroAdapter,
    shellChecks,
    hiddenSources,
    storage,
  };
}

type FixturePaths = Awaited<ReturnType<typeof fixture>>;

interface ParityOptions {
  isolation?: boolean;
  separateStorage?: boolean;
  condition?: "passive" | "enforced";
  paths?: FixturePaths;
  sevroRoute?: ReturnType<typeof sevroCommand>;
  autoIdentity?: boolean;
}

async function parityInputs(options: ParityOptions) {
  return {
    paths:
      options.paths ??
      (await fixture(options.isolation, options.separateStorage)),
    route: options.sevroRoute ?? sevroCommand(),
    condition: options.condition ?? "passive",
    autoIdentity: options.autoIdentity ?? false,
  };
}

function legacyArguments(
  paths: FixturePaths,
  oldOutput: string,
  condition: "passive" | "enforced",
): string[] {
  return [
    process.execPath,
    "--preload",
    paths.legacyAdapter,
    join(runnerRoot, "run.ts"),
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
    "--project-root",
    paths.projectRoot,
    ...(paths.configRoot ? ["--config-root", paths.configRoot] : []),
    ...(paths.storage
      ? [
          "--results-root",
          paths.storage.legacyResultsRoot,
          "--run-state-root",
          paths.storage.legacyStateRoot,
        ]
      : []),
    "--skill",
    "compatibility-primary",
    "--case",
    "selected",
    "--owner-evaluation",
    condition,
    "--output",
    oldOutput,
  ];
}

function sevroArguments(
  paths: FixturePaths,
  route: ReturnType<typeof sevroCommand>,
  condition: "passive" | "enforced",
  autoIdentity = false,
): string[] {
  return [
    ...route.launch,
    "run",
    "--json",
    "--case-file",
    paths.caseFile,
    "--adapter-module",
    paths.sevroAdapter,
    "--shell-isolation",
    ...(paths.configRoot ? ["--config-root", paths.configRoot] : []),
    "--project-root",
    paths.projectRoot,
    "--results-root",
    paths.storage?.sevroResultsRoot ?? join(paths.projectRoot, "sevro-results"),
    ...(paths.storage
      ? ["--run-state-root", paths.storage.sevroStateRoot]
      : []),
    ...(autoIdentity
      ? []
      : ["--runner-build-digest", digest, "--project-digest", digest]),
    ...route.extraArgs,
    "--condition",
    condition,
    "--trials",
    "1",
    "--threshold",
    "1",
  ];
}

async function assertStorageParity(
  paths: FixturePaths,
  oldOutput: string,
  newResult: { runId: string; evidencePath: string },
  newTrial: { artifactPath: string },
): Promise<void> {
  if (!paths.storage) return;
  const oldActiveNames = await readdir(
    join(paths.storage.legacyStateRoot, "active"),
  );
  expect(oldActiveNames.filter((name) => name.endsWith(".json"))).toHaveLength(
    1,
  );
  const oldActive = JSON.parse(
    await readFile(
      join(paths.storage.legacyStateRoot, "active", oldActiveNames[0]!),
      "utf8",
    ),
  );
  expect(oldActive.artifactPath).toBe(oldOutput);
  expect(
    oldActive.evidenceDirectory.startsWith(paths.storage.legacyStateRoot),
  ).toBeTrue();
  const newActive = JSON.parse(
    await readFile(
      join(paths.storage.sevroStateRoot, "active", `${newResult.runId}.json`),
      "utf8",
    ),
  );
  expect(newActive).toMatchObject({
    status: "complete",
    artifactPath: newResult.evidencePath,
    completedTrials: [{ trial: 1, artifactPath: newTrial.artifactPath }],
  });
  expect(
    newActive.evidenceDirectory.startsWith(paths.storage.sevroStateRoot),
  ).toBeTrue();
  expect(await Bun.file(newActive.checkpointPath).exists()).toBeTrue();
  expect(
    await Bun.file(join(paths.storage.legacyResultsRoot, "active")).exists(),
  ).toBeFalse();
  expect(
    await Bun.file(join(paths.storage.sevroResultsRoot, "active")).exists(),
  ).toBeFalse();
}

async function assertParity(
  scenario: "pass" | "fail" | "incomplete-usage",
  options: ParityOptions = {},
): Promise<{
  legacyDigest: string;
  sevroDigest: string;
  sevroRunner: Record<string, unknown>;
}> {
  const { paths, route, condition, autoIdentity } = await parityInputs(options);
  expect(await Bun.file(route.launch.at(-1)!).exists()).toBeTrue();
  const oldOutput = join(
    paths.projectRoot,
    `legacy-${scenario}-${condition}.json`,
  );
  const legacy = await command(
    legacyArguments(paths, oldOutput, condition),
    scenario,
    paths.projectRoot,
  );
  const sevro = await command(
    sevroArguments(paths, route, condition, autoIdentity),
    scenario,
    paths.projectRoot,
  );
  expect(legacy.code, legacy.stderr).toBe(scenario === "fail" ? 1 : 0);
  expect(sevro.code, sevro.stderr).toBe(legacy.code);
  const [oldResult] = JSON.parse(await readFile(oldOutput, "utf8"));
  const newResult = JSON.parse(sevro.stdout);
  const newRunEvidence = JSON.parse(
    await readFile(newResult.evidencePath, "utf8"),
  );
  expect(newRunEvidence.runner.source).toBe(route.source);
  const newTrial = newResult.cases[0].trials[0];
  const newArtifact = JSON.parse(await readFile(newTrial.artifactPath, "utf8"));
  expect(oldResult.caseId).toBe(newResult.cases[0].caseId);
  expect(oldResult.ownerEvaluationMode).toBe(
    newArtifact.evidence.condition.requested,
  );
  expect(oldResult.ownerEvaluationMode).toBe(condition);
  expect(newRunEvidence.condition.requested).toBe(condition);
  expect(newRunEvidence.condition.actual).toBe(condition);
  expect(newRunEvidence.evaluationIdentity.dimensions.condition).toBe(
    condition,
  );
  expect(oldResult.trials[0].harness.evaluationEnforcement).toBe(
    newArtifact.evidence.condition.actual,
  );
  expect(oldResult.trials[0].harness.tokenUsageComplete).toBe(
    newArtifact.evidence.usage.complete,
  );
  const oldChecks = new Map(
    oldResult.trials[0].checks.map(
      (check: { name: string; passed: boolean }) => [check.name, check.passed],
    ),
  );
  const newChecks = new Map(
    newTrial.checks.map((check: { id: string; status: string }) => [
      check.id,
      check.status === "passed",
    ]),
  );
  expect([...newChecks.keys()].sort()).toEqual(
    [
      ...paths.shellChecks.map((check) => check.id),
      "synthetic-response",
    ].sort(),
  );
  for (const check of paths.shellChecks) {
    expect(oldChecks.has(check.name)).toBeTrue();
    expect(oldChecks.get(check.name)).toBe(newChecks.get(check.id));
  }
  expect(oldChecks.has("synthetic response")).toBeTrue();
  expect(oldChecks.get("synthetic response")).toBe(
    newChecks.get("synthetic-response"),
  );
  expect(oldResult.trials[0].passed).toBe(newTrial.task.verdict === "passed");
  for (const source of paths.hiddenSources)
    expect(await Bun.file(source).exists()).toBeTrue();
  expect(await Bun.file(newResult.evidencePath).exists()).toBeTrue();
  expect(oldResult.trials[0].harness.raw).toBe("synthetic retained evidence");
  const rawPath = fileURLToPath(newArtifact.evidence.rawResult.path);
  expect(await Bun.file(rawPath).exists()).toBeTrue();
  expect(await readFile(rawPath, "utf8")).toBe(
    scenario === "fail" ? "synthetic behavioral failure" : response,
  );
  await assertStorageParity(paths, oldOutput, newResult, newTrial);
  return {
    legacyDigest: oldResult.evaluationDigest,
    sevroDigest: newRunEvidence.evaluationIdentity.digest,
    sevroRunner: newRunEvidence.runner,
  };
}

for (const scenario of ["pass", "fail", "incomplete-usage"] as const) {
  test(`public commands agree on ${scenario} trial outcomes`, async () => {
    await assertParity(scenario);
  });
}

test("public commands hide project and configuration sources", async () => {
  await assertParity("pass", { isolation: true });
});

test("public commands keep run state apart from results", async () => {
  await assertParity("pass", { separateStorage: true });
});

test("public commands retain enforced condition and separate mode identity", async () => {
  const paths = await fixture();
  const passive = await assertParity("pass", { condition: "passive", paths });
  const enforced = await assertParity("pass", { condition: "enforced", paths });
  expect(passive.legacyDigest).not.toBe(enforced.legacyDigest);
  expect(passive.sevroDigest).not.toBe(enforced.sevroDigest);
});

test("public commands retain interrupted attempts after cancellation", async () => {
  const paths = await fixture();
  const oldOutput = join(paths.projectRoot, "legacy-cancelled.json");
  const legacyReady = join(paths.projectRoot, "legacy-ready");
  const childPidPath = join(paths.projectRoot, "legacy-child-pid");
  const legacy = startCommand(
    legacyArguments(paths, oldOutput, "passive"),
    "wait",
    paths.projectRoot,
    {
      SEVRO_PARITY_READY_PATH: legacyReady,
      SEVRO_PARITY_CHILD_PID_PATH: childPidPath,
    },
  );
  try {
    await waitForFile(legacyReady);
    legacy.kill("SIGTERM");
    expect(await legacy.exited).not.toBe(0);
    expect(await Bun.file(oldOutput).exists()).toBeFalse();
    expect(
      processIsGone(Number(await readFile(childPidPath, "utf8"))),
    ).toBeTrue();
    const diagnostic = JSON.parse(
      await readFile(`${oldOutput}.diagnostic.json`, "utf8"),
    );
    expect(diagnostic.completedTrials).toEqual([]);
    const oldActiveNames = await readdir(
      join(paths.projectRoot, "evals/results/active"),
    );
    expect(
      oldActiveNames.filter((name) => name.endsWith(".json")),
    ).toHaveLength(1);
    const oldActive = JSON.parse(
      await readFile(
        join(paths.projectRoot, "evals/results/active", oldActiveNames[0]!),
        "utf8",
      ),
    );
    expect(oldActive.status).toBe("interrupted");
  } finally {
    legacy.kill("SIGKILL");
    await legacy.exited;
  }

  const sevroReady = join(paths.projectRoot, "sevro-ready");
  const sevro = startCommand(
    sevroArguments(paths, sevroCommand(), "passive"),
    "wait",
    paths.projectRoot,
    { SEVRO_PARITY_READY_PATH: sevroReady },
  );
  try {
    await waitForFile(sevroReady);
    sevro.kill("SIGTERM");
    const [stdout, code] = await Promise.all([
      new Response(sevro.stdout).text(),
      sevro.exited,
    ]);
    expect(code).toBe(143);
    const result = JSON.parse(stdout);
    expect(result.execution.status).toBe("cancelled");
    expect(result.cases[0].trials).toHaveLength(1);
    expect(result.cases[0].trials[0].execution.status).toBe("cancelled");
    expect(result.cases[0].trials[0].task.verdict).toBe("not_assessed");
    expect(
      await Bun.file(result.cases[0].trials[0].artifactPath).exists(),
    ).toBeTrue();
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    expect(evidence.result.execution.status).toBe("cancelled");
    const active = JSON.parse(
      await readFile(
        join(paths.projectRoot, "sevro-results/active", `${result.runId}.json`),
        "utf8",
      ),
    );
    expect(active.status).toBe("interrupted");
    expect(active.completedTrials).toHaveLength(1);
  } finally {
    sevro.kill("SIGKILL");
    await sevro.exited;
  }
}, 20_000);

test("public commands refuse an equivalent run while its owner is live", async () => {
  const paths = await fixture();
  const oldOutput = join(paths.projectRoot, "legacy-owned.json");
  const legacyReady = join(paths.projectRoot, "legacy-owner-ready");
  const legacy = startCommand(
    legacyArguments(paths, oldOutput, "passive"),
    "wait",
    paths.projectRoot,
    {
      SEVRO_PARITY_READY_PATH: legacyReady,
      SEVRO_PARITY_CHILD_PID_PATH: join(
        paths.projectRoot,
        "legacy-owner-child",
      ),
    },
  );
  try {
    await waitForFile(legacyReady);
    const duplicate = await command(
      legacyArguments(paths, oldOutput, "passive"),
      "pass",
      paths.projectRoot,
    );
    expect(duplicate.code).not.toBe(0);
    expect(duplicate.stderr).toContain("equivalent evaluation is still active");
    expect(await Bun.file(oldOutput).exists()).toBeFalse();
    expect(processIsGone(legacy.pid)).toBeFalse();
    const oldActiveNames = await readdir(
      join(paths.projectRoot, "evals/results/active"),
    );
    expect(
      oldActiveNames.filter((name) => name.endsWith(".json")),
    ).toHaveLength(1);
    const oldActive = JSON.parse(
      await readFile(
        join(paths.projectRoot, "evals/results/active", oldActiveNames[0]!),
        "utf8",
      ),
    );
    expect(oldActive.status).toBe("active");
    expect(oldActive.owner.pid).toBe(legacy.pid);
  } finally {
    legacy.kill("SIGTERM");
    await legacy.exited;
  }

  const sevroReady = join(paths.projectRoot, "sevro-owner-ready");
  const sevroArgs = sevroArguments(paths, sevroCommand(), "passive");
  const sevro = startCommand(sevroArgs, "wait", paths.projectRoot, {
    SEVRO_PARITY_READY_PATH: sevroReady,
  });
  try {
    await waitForFile(sevroReady);
    const duplicate = await command(sevroArgs, "pass", paths.projectRoot);
    expect(duplicate.code).toBe(70);
    const refused = JSON.parse(duplicate.stdout);
    expect(refused.execution.status).toBe("not_run");
    expect(refused.evidencePath).toBeNull();
    expect(refused.diagnostic.message).toContain(
      "equivalent Sevro run is active",
    );
    expect(processIsGone(sevro.pid)).toBeFalse();
    const newActiveNames = await readdir(
      join(paths.projectRoot, "sevro-results/active"),
    );
    expect(
      newActiveNames.filter((name) => name.endsWith(".json")),
    ).toHaveLength(1);
    const newActive = JSON.parse(
      await readFile(
        join(paths.projectRoot, "sevro-results/active", newActiveNames[0]!),
        "utf8",
      ),
    );
    expect(newActive.status).toBe("active");
    expect(newActive.owner.pid).toBe(sevro.pid);
  } finally {
    sevro.kill("SIGTERM");
    await sevro.exited;
  }
}, 20_000);

if (process.env.SEVRO_CHECKOUT) {
  test("installed Sevro package matches the Darrow command outcome", async () => {
    const installed = await installedSevro();
    const compared = await assertParity("pass", {
      sevroRoute: {
        launch: installed.command,
        extraArgs: [],
        source: "package",
      },
      autoIdentity: true,
    });
    expect(compared.sevroRunner).toMatchObject({
      source: "package",
      packageName: "@bjoernrochel/sevro",
      version: installed.version,
    });
    expect(compared.sevroRunner.buildDigest).toMatch(/^[a-f0-9]{64}$/);
  }, 30_000);
}
