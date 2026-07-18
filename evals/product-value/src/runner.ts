import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  Assignment,
  Corpus,
  Observation,
  Protocol,
  RepositoryDefinition,
  TaskDefinition,
} from "./types";
import { command, checked } from "./process";
import {
  capturePatch,
  destroyWorkspace,
  injectOracleTests,
  mountPlugins,
  prepareWorkspace,
  verifyOutcome,
} from "./workspace";
import { invoke } from "./harness";
import { REPO_ROOT, SUITE_ROOT } from "./config";

async function digestDirectory(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  const glob = new Bun.Glob("**/*");
  const files: string[] = [];
  for await (const rel of glob.scan(path)) {
    if (rel.includes("/evals/")) continue;
    if ((await lstat(resolve(path, rel))).isFile()) files.push(rel);
  }
  files.sort();
  for (const rel of files) {
    const file = Bun.file(resolve(path, rel));
    hasher.update(`${rel}\0`);
    hasher.update(await file.arrayBuffer());
    hasher.update("\0");
  }
  return `sha256:${hasher.digest("hex")}`;
}

function digestJson(value: unknown): string {
  return `sha256:${new Bun.CryptoHasher("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

async function harnessVersion(
  executable: string,
  cwd: string,
): Promise<string> {
  const result = await command([executable, "--version"], cwd);
  return result.code === 0
    ? result.stdout.trim()
    : `unavailable (${result.code})`;
}

function runKey(assignment: Assignment): string {
  return [
    assignment.phase,
    String(assignment.ordinal).padStart(4, "0"),
    assignment.taskId,
    assignment.harness,
    assignment.treatment,
    `r${assignment.repeat}`,
  ].join("-");
}

export async function runAssignment(
  protocol: Protocol,
  corpus: Corpus,
  assignment: Assignment,
  sources: Map<string, string>,
  resultsRoot: string,
): Promise<Observation> {
  const task = corpus.tasks.find((item) => item.id === assignment.taskId) as
    TaskDefinition | undefined;
  const repository = corpus.repositories.find(
    (item) => item.id === assignment.repository,
  ) as RepositoryDefinition | undefined;
  if (!task || !repository)
    throw new Error(`invalid assignment ${assignment.taskId}`);
  const source = sources.get(repository.id);
  if (!source) throw new Error(`missing --source ${repository.id}=<path>`);

  const runId = runKey(assignment);
  const runRoot = join(resultsRoot, "runs", runId);
  const observationPath = join(runRoot, "observation.json");
  if (await Bun.file(observationPath).exists())
    return JSON.parse(await readFile(observationPath, "utf8"));
  await mkdir(runRoot, { recursive: true });
  const startedAt = new Date().toISOString();
  const wallStarted = performance.now();
  const pluginRoot = resolve(REPO_ROOT, protocol.paths.pluginRoot);
  const darrowExecutable = resolve(REPO_ROOT, protocol.paths.darrowExecutable);
  const bunExecutable = protocol.paths.bunExecutable;
  const route = protocol.harnesses[assignment.harness];
  const currentHarnessVersion = await harnessVersion(
    route.executable,
    REPO_ROOT,
  );
  if (currentHarnessVersion !== route.version)
    throw new Error(
      `${assignment.harness} version drift: expected ${route.version}, found ${currentHarnessVersion}`,
    );
  const runnerRevision = await checked(["git", "rev-parse", "HEAD"], REPO_ROOT);
  const pluginDigest = await digestDirectory(pluginRoot);
  let workspace;
  let invocation;
  let verification = null;
  let patchPath: string | null = null;
  let setupFailure: string | null = null;
  let operationalFailure: string | null = null;
  let preparationTimeMs = 0;
  try {
    const preparationStarted = performance.now();
    workspace = await prepareWorkspace(source, repository, task);
    preparationTimeMs = performance.now() - preparationStarted;
    await writeFile(
      join(runRoot, "sanitization.json"),
      JSON.stringify(workspace.sanitization, null, 2) + "\n",
    );
    if (assignment.treatment === "plugins")
      await mountPlugins(workspace.repo, pluginRoot, assignment.harness);
    invocation = await invoke(
      protocol,
      assignment.harness,
      assignment.treatment,
      workspace.repo,
      workspace.state,
      task.prompt,
      pluginRoot,
      bunExecutable,
      darrowExecutable,
      [source, SUITE_ROOT],
    );
    await writeFile(join(runRoot, "harness.log"), invocation.raw);
    const resultWorkspace = resolve(invocation.workspace);
    patchPath = join(runRoot, "change.patch");
    await capturePatch(resultWorkspace, patchPath, workspace.baseCommit);
    const oracleTests = await injectOracleTests(
      source,
      task,
      resultWorkspace,
      workspace.baseCommit,
    );
    verification = await verifyOutcome(resultWorkspace, task, oracleTests);
    if (!invocation.ok)
      operationalFailure = invocation.waiting
        ? "waiting_for_input"
        : "harness_or_runtime_failure";
  } catch (error) {
    if (!workspace) preparationTimeMs = performance.now() - wallStarted;
    const message = error instanceof Error ? error.message : String(error);
    if (!workspace) setupFailure = message;
    else operationalFailure = message;
    invocation ??= {
      ok: false,
      waiting: false,
      durationMs: 0,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      raw: message,
      darrowRunId: null,
      workspace: workspace?.repo ?? "",
    };
    await writeFile(join(runRoot, "harness.log"), invocation.raw);
  }

  const deterministicQuality = verification?.passed ? 1 : 0;
  const ungradableFailure = patchPath === null;
  const retainedWorkspacePath =
    workspace && !invocation!.ok ? workspace.root : null;
  const observation: Observation = {
    schemaVersion: "1.0.0",
    runId,
    assignment,
    startedAt,
    finishedAt: new Date().toISOString(),
    status:
      setupFailure || operationalFailure
        ? invocation!.waiting
          ? "waiting"
          : "failed"
        : "completed",
    setupFailure,
    operationalFailure,
    harnessVersion: currentHarnessVersion,
    model: route.model,
    effort: route.effort,
    permissionMode: route.permissionMode,
    sourceRevision: repository.pinnedRevision,
    runnerRevision,
    pluginDigest,
    configurationDigest: digestJson({
      route,
      treatment: assignment.treatment,
      paths: protocol.paths,
      isolation: "sandbox-exec:hidden-source-and-evaluator",
    }),
    sanitizationDigest: workspace?.sanitization.treeDigest ?? "unavailable",
    inputTokens: invocation!.inputTokens,
    outputTokens: invocation!.outputTokens,
    costUsd: invocation!.costUsd,
    wallTimeMs: performance.now() - wallStarted,
    preparationTimeMs,
    harnessTimeMs: invocation!.durationMs,
    humanAttentionMinutes: invocation!.ok ? 0 : null,
    interventions: 0,
    failures: invocation!.ok ? 0 : 1,
    retries: 0,
    recovered: false,
    reworkCount: 0,
    deterministicQuality,
    blindedQuality: ungradableFailure ? 0 : null,
    quality: deterministicQuality,
    verification,
    patchPath,
    rawOutputPath: join(runRoot, "harness.log"),
    darrowRunId: invocation!.darrowRunId,
    retainedWorkspacePath,
  };
  await writeFile(observationPath, JSON.stringify(observation, null, 2) + "\n");
  if (workspace && !retainedWorkspacePath) await destroyWorkspace(workspace);
  return observation;
}
