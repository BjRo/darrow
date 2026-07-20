import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Corpus, Phase, Protocol } from "./types";
import { command, checked } from "./process";
import { REPO_ROOT, SUITE_ROOT } from "./config";
import { isolatedEnvironment, sandboxed } from "./harness";
import { temporalExecutable } from "./toolchain";

export async function probeHarnessAuthentication(
  name: "codex" | "claude",
  protocol: Protocol,
  phase: Phase,
  hiddenPaths: string[],
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "darrow-preflight-auth-"));
  const repo = join(root, "repo");
  const state = join(root, "state");
  await Promise.all([mkdir(repo), mkdir(state)]);
  try {
    const env = await isolatedEnvironment(
      name,
      protocol.harnesses[name],
      state,
      repo,
    );
    const route = protocol.harnesses[name];
    const effort = protocol.phases[phase].effort;
    const authentication =
      name === "codex"
        ? env.OPENAI_API_KEY
          ? "api-key"
          : "isolated-config"
        : env.ANTHROPIC_API_KEY
          ? "api-key"
          : "setup-token";
    const prompt = "Reply with exactly OK.";
    const args =
      name === "codex"
        ? [
            route.executable,
            "exec",
            prompt,
            "--json",
            "--ephemeral",
            "--ignore-user-config",
            "--ignore-rules",
            "--dangerously-bypass-approvals-and-sandbox",
            "-m",
            route.model,
            "-c",
            `model_reasoning_effort="${effort}"`,
            "--skip-git-repo-check",
          ]
        : [
            route.executable,
            "-p",
            prompt,
            "--output-format",
            "json",
            "--model",
            route.model,
            "--effort",
            effort,
            "--permission-mode",
            "acceptEdits",
            "--no-session-persistence",
          ];
    const result = await command(
      await sandboxed(args, state, hiddenPaths),
      repo,
      env,
      2 * 60_000,
    );
    if (name === "codex") {
      if (result.code !== 0 || !result.stdout.includes('"turn.completed"'))
        throw new Error(
          "codex inference probe failed inside evaluator isolation",
        );
      return authentication;
    }
    let status: { subtype?: string; is_error?: boolean } = {};
    try {
      status = JSON.parse(result.stdout);
    } catch {
      throw new Error("claude inference probe returned invalid output");
    }
    if (
      result.code !== 0 ||
      status.subtype !== "success" ||
      status.is_error === true
    )
      throw new Error(
        "claude inference probe failed inside evaluator isolation",
      );
    return authentication;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function probeTemporal(
  executable: string,
  hiddenPaths: string[],
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "darrow-preflight-runtime-"));
  const repo = join(root, "repo");
  const state = join(root, "state");
  await Promise.all([mkdir(repo), mkdir(state)]);
  try {
    const result = await command(
      await sandboxed([executable, "--version"], state, hiddenPaths, [
        executable,
      ]),
      repo,
    );
    const version = (result.stdout + result.stderr).trim();
    if (result.code !== 0 || !version.includes("1.8.0"))
      throw new Error(
        "pinned Temporal 1.8.0 is unusable in the evaluator sandbox",
      );
    return version;
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function probeDarrowWorkerBundle(
  protocol: Protocol,
  cliRoot = resolve(REPO_ROOT, "cli"),
): Promise<string> {
  const workflowsPath = resolve(cliRoot, "src", "temporal-workflow.ts");
  if (!(await Bun.file(workflowsPath).exists()))
    throw new Error(`Darrow workflow source is unavailable: ${workflowsPath}`);
  const script = [
    'import { bundleWorkflowCode } from "@temporalio/worker";',
    `await bundleWorkflowCode({ workflowsPath: ${JSON.stringify(workflowsPath)} });`,
  ].join("\n");
  const result = await command(
    [protocol.paths.bunExecutable, "-e", script],
    cliRoot,
    process.env,
    2 * 60_000,
  );
  if (result.code !== 0)
    throw new Error(
      "Darrow worker dependencies are unavailable or its workflow cannot be bundled; run `bun install --frozen-lockfile` before evaluation",
    );
  return "ready";
}

export async function preflightSources(
  protocol: Protocol,
  corpus: Corpus,
  sources: Map<string, string>,
  phase: Phase,
): Promise<Record<string, unknown>> {
  if (
    process.platform !== "darwin" ||
    !(await Bun.file("/usr/bin/sandbox-exec").exists())
  )
    throw new Error(
      "confirmatory isolation requires macOS sandbox-exec or a separately reviewed container boundary",
    );
  const repositoryResults: Record<string, unknown>[] = [];
  const hiddenPaths = [SUITE_ROOT];
  for (const repository of corpus.repositories) {
    const source = sources.get(repository.id);
    if (!source)
      throw new Error(`preflight requires --source ${repository.id}=<path>`);
    hiddenPaths.push(source);
    const pinned = await checked(
      ["git", "rev-parse", repository.pinnedRevision],
      source,
    );
    if (pinned !== repository.pinnedRevision)
      throw new Error(`${repository.id} pinned revision is not exact`);
    const taskResults = [];
    for (const task of corpus.tasks.filter(
      (item) => item.repository === repository.id,
    )) {
      const oracle = await checked(
        ["git", "rev-parse", task.oracleRevision],
        source,
      );
      const base = await checked(
        ["git", "rev-parse", `${task.oracleRevision}^`],
        source,
      );
      if (oracle !== task.oracleRevision || base !== task.baseRevision)
        throw new Error(`${task.id} base/oracle relationship changed`);
      const ancestor = await command(
        [
          "git",
          "merge-base",
          "--is-ancestor",
          task.oracleRevision,
          repository.pinnedRevision,
        ],
        source,
      );
      if (ancestor.code !== 0)
        throw new Error(`${task.id} oracle is outside pinned history`);
      const changed = await checked(
        [
          "git",
          "diff-tree",
          "--no-commit-id",
          "--name-only",
          "-r",
          task.oracleRevision,
        ],
        source,
      );
      const oracleTests = changed
        .split("\n")
        .filter((path) =>
          /(^|\/).*(test|spec)\.(ts|tsx|js|jsx|go)$/.test(path),
        );
      if (!oracleTests.length)
        throw new Error(`${task.id} has no oracle tests`);
      taskResults.push({ taskId: task.id, oracleTests: oracleTests.length });
    }
    repositoryResults.push({
      id: repository.id,
      source,
      pinnedRevision: pinned,
      tasks: taskResults,
    });
  }
  const harnesses: Record<string, unknown> = {};
  for (const name of ["claude", "codex"] as const) {
    const route = protocol.harnesses[name];
    const version = await command([route.executable, "--version"], REPO_ROOT);
    if (version.code !== 0)
      throw new Error(`${name} executable is unavailable`);
    if (version.stdout.trim() !== route.version)
      throw new Error(
        `${name} version drift: expected ${route.version}, found ${version.stdout.trim()}`,
      );
    const authentication = await probeHarnessAuthentication(
      name,
      protocol,
      phase,
      hiddenPaths,
    );
    harnesses[name] = {
      executable: route.executable,
      version: route.version,
      model: route.model,
      phaseEfforts: Object.fromEntries(
        Object.entries(protocol.phases).map(([phase, settings]) => [
          phase,
          settings.effort,
        ]),
      ),
      permissionMode: route.permissionMode,
      authentication,
    };
  }
  const darrowExecutable = resolve(REPO_ROOT, protocol.paths.darrowExecutable);
  if (!(await Bun.file(darrowExecutable).exists()))
    throw new Error(`Darrow executable is unavailable: ${darrowExecutable}`);
  const bunVersion = await command(
    [protocol.paths.bunExecutable, "--version"],
    REPO_ROOT,
  );
  if (bunVersion.code !== 0)
    throw new Error("pinned Bun executable is unavailable");
  const workerBundle = await probeDarrowWorkerBundle(protocol);
  const temporal = await temporalExecutable(protocol);
  const temporalVersion = await probeTemporal(temporal, hiddenPaths);
  return {
    repositories: repositoryResults,
    harnesses,
    bun: {
      executable: protocol.paths.bunExecutable,
      version: bunVersion.stdout.trim(),
    },
    darrowExecutable,
    workerBundle,
    temporalExecutable: temporal,
    temporalVersion,
  };
}
