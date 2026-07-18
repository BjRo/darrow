import { resolve } from "node:path";
import type { Corpus, Protocol } from "./types";
import { command, checked } from "./process";
import { REPO_ROOT } from "./config";

export async function preflightSources(
  protocol: Protocol,
  corpus: Corpus,
  sources: Map<string, string>,
): Promise<Record<string, unknown>> {
  if (
    process.platform !== "darwin" ||
    !(await Bun.file("/usr/bin/sandbox-exec").exists())
  )
    throw new Error(
      "confirmatory isolation requires macOS sandbox-exec or a separately reviewed container boundary",
    );
  const repositoryResults: Record<string, unknown>[] = [];
  for (const repository of corpus.repositories) {
    const source = sources.get(repository.id);
    if (!source)
      throw new Error(`preflight requires --source ${repository.id}=<path>`);
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
  for (const [name, route] of Object.entries(protocol.harnesses)) {
    const version = await command([route.executable, "--version"], REPO_ROOT);
    if (version.code !== 0)
      throw new Error(`${name} executable is unavailable`);
    if (version.stdout.trim() !== route.version)
      throw new Error(
        `${name} version drift: expected ${route.version}, found ${version.stdout.trim()}`,
      );
    harnesses[name] = {
      executable: route.executable,
      version: route.version,
      model: route.model,
      effort: route.effort,
      permissionMode: route.permissionMode,
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
  const toolchainHome = resolve(REPO_ROOT, protocol.paths.toolchainHome);
  const temporalGlob = new Bun.Glob("temporal/1.8.0/*/temporal");
  let temporalExecutable: string | null = null;
  for await (const rel of temporalGlob.scan(toolchainHome)) {
    temporalExecutable = resolve(toolchainHome, rel);
    break;
  }
  if (!temporalExecutable)
    throw new Error(
      "pinned Temporal 1.8.0 is unavailable; run `bun evals/product-value/cli.ts install-toolchain`",
    );
  return {
    repositories: repositoryResults,
    harnesses,
    bun: {
      executable: protocol.paths.bunExecutable,
      version: bunVersion.stdout.trim(),
    },
    darrowExecutable,
    temporalExecutable,
  };
}
