import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type {
  CheckObservation,
  Harness,
  RepositoryDefinition,
  SanitizationManifest,
  TaskDefinition,
} from "./types";
import { checked, command, shellQuote } from "./process";
import { sanitizeWorkspace } from "./sanitize";

export interface TrialWorkspace {
  root: string;
  repo: string;
  state: string;
  baseCommit: string;
  sanitization: SanitizationManifest;
}

export async function prepareWorkspace(
  source: string,
  repository: RepositoryDefinition,
  task: TaskDefinition,
): Promise<TrialWorkspace> {
  const root = await mkdtemp(join(tmpdir(), "darrow-product-eval-"));
  try {
    const repo = join(root, "repo");
    const state = join(root, "state");
    await mkdir(repo, { recursive: true });
    await mkdir(state, { recursive: true });

    const pinned = await checked(
      ["git", "rev-parse", repository.pinnedRevision],
      source,
    );
    if (pinned !== repository.pinnedRevision)
      throw new Error(`${repository.id} pinned revision is not exact`);
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

    const archive = join(root, "source.tar");
    await checked(
      [
        "git",
        "archive",
        "--format=tar",
        `--output=${archive}`,
        task.baseRevision,
      ],
      source,
    );
    await checked(["tar", "-xf", archive, "-C", repo], root);
    await rm(archive, { force: true });
    const sanitization = await sanitizeWorkspace(repo, task.baseRevision);

    await checked(["git", "init", "-b", "main"], repo);
    await checked(["git", "config", "user.name", "Darrow Product Eval"], repo);
    await checked(["git", "config", "user.email", "eval@darrow.local"], repo);
    await checked(["git", "add", "-A"], repo);
    await checked(
      ["git", "commit", "-m", "chore: prepare evaluation task"],
      repo,
    );
    const baseCommit = await checked(["git", "rev-parse", "HEAD"], repo);

    const setup = await command(["sh", "-lc", repository.setupCommand], repo);
    if (setup.code !== 0)
      throw new Error(`setup failed (${setup.code}): ${setup.stderr.trim()}`);
    return { root, repo, state, baseCommit, sanitization };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export async function mountPlugins(
  repo: string,
  pluginRoot: string,
  harness: Harness,
): Promise<void> {
  const mountRoot = join(repo, harness === "codex" ? ".agents" : ".claude");
  const skillsRoot = join(mountRoot, "skills");
  await mkdir(skillsRoot, { recursive: true });
  const projection = harness === "codex" ? "codex-skills" : "claude-skills";
  const glob = new Bun.Glob(`*/${projection}/*/SKILL.md`);
  for await (const rel of glob.scan(pluginRoot)) {
    const skillDirectory = dirname(resolve(pluginRoot, rel));
    await cp(skillDirectory, join(skillsRoot, basename(skillDirectory)), {
      recursive: true,
      filter: (path) => {
        const evals = join(skillDirectory, "evals");
        return path !== evals && !path.startsWith(evals + "/");
      },
    });
  }
  const binGlob = new Bun.Glob("*/bin/*");
  for await (const rel of binGlob.scan(pluginRoot)) {
    const source = resolve(pluginRoot, rel);
    await mkdir(join(mountRoot, "bin"), { recursive: true });
    await cp(source, join(mountRoot, "bin", basename(source)));
  }
  await writeFile(
    join(repo, ".git", "info", "exclude"),
    `/${basename(mountRoot)}/\n`,
    { flag: "a" },
  );
}

export async function capturePatch(
  repo: string,
  destination: string,
  baseCommit: string,
  excludedPaths: string[] = [],
): Promise<void> {
  const pathspecs = [".", ...excludedPaths.map((path) => `:(exclude)${path}`)];
  const intentToAdd = await command(
    ["git", "add", "-N", "--", ...pathspecs],
    repo,
  );
  if (intentToAdd.code !== 0)
    throw new Error(
      `cannot expose untracked participant files: ${intentToAdd.stderr.trim()}`,
    );
  const result = await command(
    ["git", "diff", "--binary", baseCommit, "--", ...pathspecs],
    repo,
  );
  if (result.code !== 0)
    throw new Error(
      `cannot capture participant patch: ${result.stderr.trim()}`,
    );
  await writeFile(destination, result.stdout);
}

export async function injectOracleTests(
  source: string,
  task: TaskDefinition,
  repo: string,
  baseCommit: string,
): Promise<string[]> {
  const tracked = await checked(
    ["git", "ls-tree", "-r", "--name-only", baseCommit],
    repo,
  );
  const verifierInputs = tracked
    .split("\n")
    .filter(Boolean)
    .filter(
      (path) =>
        /(^|\/).*(test|spec)\.(ts|tsx|js|jsx|go)$/.test(path) ||
        /(^|\/)(package\.json|bun\.lock|pnpm-lock\.yaml|pnpm-workspace\.yaml|turbo\.json|go\.mod|go\.sum)$/.test(
          path,
        ),
    );
  for (const path of verifierInputs) {
    const content = await command(
      ["git", "show", `${baseCommit}:${path}`],
      repo,
    );
    if (content.code !== 0)
      throw new Error(`cannot restore verifier input ${path}`);
    await mkdir(dirname(join(repo, path)), { recursive: true });
    await writeFile(join(repo, path), content.stdout);
  }
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
  const tests = changed
    .split("\n")
    .filter(Boolean)
    .filter((path) => /(^|\/).*(test|spec)\.(ts|tsx|js|jsx|go)$/.test(path));
  if (!tests.length) throw new Error(`${task.id} oracle has no changed tests`);
  for (const path of tests) {
    const content = await command(
      ["git", "show", `${task.oracleRevision}:${path}`],
      source,
    );
    if (content.code !== 0)
      throw new Error(`${task.id} cannot read oracle test ${path}`);
    await mkdir(dirname(join(repo, path)), { recursive: true });
    await writeFile(join(repo, path), content.stdout);
  }
  return tests;
}

export async function verifyOutcome(
  repo: string,
  task: TaskDefinition,
  oracleTests: string[],
  outputPath?: string,
): Promise<CheckObservation> {
  const tests = oracleTests.map(shellQuote).join(" ");
  const script = task.verificationCommand.replaceAll("{tests}", tests);
  const result = await command(
    ["sh", "-lc", script],
    repo,
    process.env,
    20 * 60_000,
  );
  if (outputPath)
    await writeFile(outputPath, `${result.stdout}${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  const failureCategory = result.timedOut
    ? "timeout"
    : result.code === 0
      ? null
      : /Cannot find package ['"]bun:/i.test(output)
        ? "runtime_mismatch"
        : /(Cannot find (package|module)|MODULE_NOT_FOUND|command not found)/i.test(
              output,
            )
          ? "missing_dependency"
          : /(Failed Tests|Failed Suites|Test Files.*failed|\bFAIL\b)/i.test(
                output,
              )
            ? "test_failure"
            : "command_failure";
  return {
    command: script,
    exitCode: result.code,
    durationMs: result.durationMs,
    passed: result.code === 0,
    failureCategory,
    outputPath: outputPath ?? null,
  };
}

export async function destroyWorkspace(
  workspace: TrialWorkspace,
): Promise<void> {
  const writable = await command(
    [
      "find",
      "-P",
      workspace.root,
      "-type",
      "d",
      "-exec",
      "chmod",
      "u+w",
      "{}",
      "+",
    ],
    dirname(workspace.root),
  );
  if (writable.code !== 0)
    throw new Error(
      `cannot prepare disposable workspace for removal: ${writable.stderr.trim()}`,
    );
  await rm(workspace.root, { recursive: true, force: true });
}

export async function fileDigest(path: string): Promise<string> {
  return `sha256:${new Bun.CryptoHasher("sha256").update(await readFile(path)).digest("hex")}`;
}
