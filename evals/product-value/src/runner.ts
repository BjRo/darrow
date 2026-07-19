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
import {
  installMatchedPolicy,
  matchedPolicyPrompt,
  usesMatchedPolicy,
  validateMatchedPolicyEvidence,
} from "./policy";
import { createExecutionTrace, traceTokenUsage } from "./trace";

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

async function persistTrace(
  runRoot: string,
  assignment: Assignment,
  invocation: Awaited<ReturnType<typeof invoke>>,
  evidenceDirectory?: string,
): Promise<{
  path: string;
  inputTokens: number | null;
  outputTokens: number | null;
} | null> {
  try {
    const path = join(runRoot, "trace.json");
    const trace = await createExecutionTrace(
      invocation,
      assignment.treatment,
      evidenceDirectory,
    );
    await writeFile(path, JSON.stringify(trace, null, 2) + "\n");
    return { path, ...traceTokenUsage(trace) };
  } catch {
    return null;
  }
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
  const runRoot = resolve(resultsRoot, "runs", runId);
  const observationPath = join(runRoot, "observation.json");
  if (await Bun.file(observationPath).exists())
    return JSON.parse(await readFile(observationPath, "utf8"));
  await mkdir(runRoot, { recursive: true });
  const startedAt = new Date().toISOString();
  const wallStarted = performance.now();
  const pluginRoot = resolve(REPO_ROOT, protocol.paths.pluginRoot);
  const darrowExecutable = resolve(REPO_ROOT, protocol.paths.darrowExecutable);
  const bunExecutable = protocol.paths.bunExecutable;
  const phaseSettings = protocol.phases[assignment.phase];
  const timeoutMs = phaseSettings.timeoutMinutes * 60_000;
  const route = {
    ...protocol.harnesses[assignment.harness],
    effort: phaseSettings.effort,
  };
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
  let tracePath: string | null = null;
  let evidenceDirectory: string | undefined;
  let matchedPolicy: Awaited<ReturnType<typeof installMatchedPolicy>> | null =
    null;
  let matchedPolicyFailure: string | null = null;
  try {
    const preparationStarted = performance.now();
    workspace = await prepareWorkspace(source, repository, task);
    preparationTimeMs = performance.now() - preparationStarted;
    await writeFile(
      join(runRoot, "sanitization.json"),
      JSON.stringify(workspace.sanitization, null, 2) + "\n",
    );
    if (
      assignment.treatment === "plugins" ||
      assignment.treatment === "plugins-matched-policy"
    )
      await mountPlugins(workspace.repo, pluginRoot, assignment.harness);
    let invocationPrompt = task.prompt;
    let outputSchema: string | undefined;
    if (usesMatchedPolicy(assignment.treatment)) {
      const policy = await installMatchedPolicy(workspace.repo, pluginRoot);
      matchedPolicy = policy;
      invocationPrompt = matchedPolicyPrompt(task.prompt, policy);
      evidenceDirectory = policy.evidenceDirectory;
      outputSchema = policy.outputSchema;
    }
    invocation = await invoke(
      protocol,
      assignment.phase,
      assignment.harness,
      assignment.treatment,
      workspace.repo,
      workspace.state,
      invocationPrompt,
      pluginRoot,
      bunExecutable,
      darrowExecutable,
      [source, SUITE_ROOT],
      outputSchema,
    );
    if (matchedPolicy) {
      if (
        !(await validateMatchedPolicyEvidence(workspace.repo, matchedPolicy))
      ) {
        invocation.ok = false;
        matchedPolicyFailure = "matched_policy_evidence_invalid";
      }
    }
    await writeFile(join(runRoot, "harness.log"), invocation.raw);
    const persistedTrace = await persistTrace(
      runRoot,
      assignment,
      invocation,
      evidenceDirectory,
    );
    tracePath = persistedTrace?.path ?? null;
    invocation.inputTokens ??= persistedTrace?.inputTokens ?? null;
    invocation.outputTokens ??= persistedTrace?.outputTokens ?? null;
    const resultWorkspace = resolve(invocation.workspace);
    patchPath = join(runRoot, "change.patch");
    await capturePatch(
      resultWorkspace,
      patchPath,
      invocation.patchBaseCommit ?? workspace.baseCommit,
      [".darrow", ".darrow-attempts"],
    );
    const oracleTests = await injectOracleTests(
      source,
      task,
      resultWorkspace,
      workspace.baseCommit,
    );
    verification = await verifyOutcome(
      resultWorkspace,
      task,
      oracleTests,
      join(runRoot, "verification.log"),
    );
    if (!invocation.ok)
      operationalFailure = matchedPolicyFailure
        ? matchedPolicyFailure
        : invocation.timedOut
          ? "timeout"
          : invocation.waiting
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
      timedOut: false,
      setupDurationMs: 0,
      durationMs: 0,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      raw: message,
      darrowRunId: null,
      workspace: workspace?.repo ?? "",
      patchBaseCommit: null,
    };
    await writeFile(join(runRoot, "harness.log"), invocation.raw);
    const persistedTrace = await persistTrace(
      runRoot,
      assignment,
      invocation,
      evidenceDirectory,
    );
    tracePath = persistedTrace?.path ?? null;
    invocation.inputTokens ??= persistedTrace?.inputTokens ?? null;
    invocation.outputTokens ??= persistedTrace?.outputTokens ?? null;
  }

  const deterministicQuality = verification?.passed ? 1 : 0;
  const ungradableFailure = patchPath === null;
  const retainedWorkspacePath =
    workspace && !invocation!.ok ? workspace.root : null;
  const observation: Observation = {
    schemaVersion: "1.2.0",
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
    timeoutMs,
    permissionMode: route.permissionMode,
    sourceRevision: repository.pinnedRevision,
    runnerRevision,
    pluginDigest,
    configurationDigest: digestJson({
      route,
      treatment: assignment.treatment,
      paths: protocol.paths,
      isolation: "sandbox-exec:hidden-source-and-evaluator",
      workspaceMode: "prepared-current",
    }),
    sanitizationDigest: workspace?.sanitization.treeDigest ?? "unavailable",
    inputTokens: invocation!.inputTokens,
    outputTokens: invocation!.outputTokens,
    costUsd: invocation!.costUsd,
    wallTimeMs: performance.now() - wallStarted,
    preparationTimeMs,
    treatmentSetupTimeMs: invocation!.setupDurationMs,
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
    tracePath,
    darrowRunId: invocation!.darrowRunId,
    retainedWorkspacePath,
  };
  await writeFile(observationPath, JSON.stringify(observation, null, 2) + "\n");
  if (workspace && !retainedWorkspacePath) await destroyWorkspace(workspace);
  return observation;
}
