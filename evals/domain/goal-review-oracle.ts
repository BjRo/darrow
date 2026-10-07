import { afterAll, afterEach, expect } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OracleCheck } from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

type ProofAssets = {
  files: Record<string, string>;
  bin: Record<string, string>;
  setup: string;
};
type ProofContext = { root: string; environment: Record<string, string> };
const cases: string[] = [];
const packages: string[] = [];
let proofPackage: Promise<string> | undefined;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

afterEach(async () => {
  await Promise.all(
    cases.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
afterAll(async () => {
  await proofPackage?.catch(() => undefined);
  proofPackage = undefined;
  await Promise.all(
    packages
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function execute(script: string, context: ProofContext) {
  const command = Bun.spawn(["/bin/bash", "-e", "-c", script], {
    cwd: context.root,
    env: context.environment,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30_000,
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(command.stdout).text(),
    new Response(command.stderr).text(),
    command.exited,
  ]);
  return { stdout, stderr, exitCode };
}

function environment(
  root: string,
  bin: string,
  reviewState: string,
): Record<string, string> {
  return {
    PATH: [bin, "/usr/bin:/bin:/usr/sbin:/sbin"].filter(Boolean).join(":"),
    HOME: join(root, ".git/oracle-home"),
    TMPDIR: join(root, ".git/oracle-tmp"),
    LANG: "C",
    UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? join(root, ".git/uv-cache"),
    UV_PYTHON_DOWNLOADS: "never",
    PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    DARROW_REVIEW_STATE_DIR: reviewState,
    DARROW_CACHE_DIR: join(root, ".git/fixture-runtime-cache"),
  };
}

async function prepareProofPackage() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-goal-proof-tools-")),
  );
  packages.push(root);
  const backend = join(root, "backend");
  const excluded = new Set([
    ".venv",
    "tests",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    ".hypothesis",
  ]);
  await cp(
    fileURLToPath(
      new URL(
        "../../plugins/orchestration/darrow-adaptive-goal/backend/",
        import.meta.url,
      ),
    ),
    backend,
    { recursive: true, filter: (path) => !excluded.has(basename(path)) },
  );
  const context = {
    root,
    environment: environment(root, "", join(root, "review-state")),
  };
  await Promise.all(
    [context.environment.HOME!, context.environment.TMPDIR!].map((path) =>
      mkdir(path, { recursive: true }),
    ),
  );
  const runtime = await prepareUvFixtureRuntime();
  const uv = Bun.which("uv");
  if (!uv) throw new Error("fixture tool is unavailable: uv");
  const result = await execute(
    `${runtime.setupPrefix}\n${quote(uv)} sync --quiet --frozen --no-dev --project ${quote(backend)}`,
    context,
  );
  expect(result.exitCode, result.stderr || result.stdout).toBe(0);
  return backend;
}

async function prepareRepository(context: ProofContext, assets: ProofAssets) {
  const { root } = context;
  const git = Bun.which("git");
  if (!git) throw new Error("fixture tool is unavailable: git");
  const result = await execute(`${quote(git)} init --quiet .\n`, context);
  expect(result.exitCode, result.stderr || result.stdout).toBe(0);
  await Promise.all(
    [
      ".git/fixture-bin",
      ".git/fixture-state",
      ".git/oracle-home",
      ".git/oracle-tmp",
    ].map((path) => mkdir(join(root, path), { recursive: true })),
  );
  await writeFile(join(root, "value.txt"), "before\n");
  const commit = await execute(
    `${quote(git)} add -- value.txt\n${quote(git)} -c user.name=Fixture -c user.email=fixture@example.invalid commit --quiet -m Initial`,
    context,
  );
  expect(commit.exitCode, commit.stderr || commit.stdout).toBe(0);
  for (const [path, contents] of Object.entries(assets.files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  for (const [name, content] of Object.entries(assets.bin))
    await writeFile(join(root, ".git/fixture-bin", name), content, {
      mode: 0o755,
    });
  await writeFile(
    join(root, ".git/oracle-review-state"),
    context.environment.DARROW_REVIEW_STATE_DIR! + "\n",
  );
}

/** Own fresh proof repositories and invoke their public fixture CLI directly. */
export async function goalReviewOracle(assets: ProofAssets) {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-goal-review-oracle-")),
  );
  cases.push(root);
  const reviewState = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-goal-review-state-")),
  );
  cases.push(reviewState);
  const context = {
    root,
    environment: environment(root, join(root, ".git/fixture-bin"), reviewState),
  };
  await prepareRepository(context, assets);
  proofPackage ??= prepareProofPackage();
  await symlink(await proofPackage, join(root, ".git/fixture-backend"));
  const uv = Bun.which("uv");
  if (!uv) throw new Error("fixture tool is unavailable: uv");
  const setup = await execute(
    `PATH=${quote(dirname(uv))}:$PATH\nexport PATH\n${assets.setup}`,
    context,
  );
  expect(setup.exitCode, setup.stderr || setup.stdout).toBe(0);
  return context;
}

export async function assertGoalReviewChecks(
  context: ProofContext,
  checks: OracleCheck[],
  rejectedIndex = -1,
) {
  for (const [index, check] of checks.entries()) {
    const result = await execute(check.run, context);
    const diagnostic = `${check.name}\n${(result.stderr || result.stdout).slice(0, 4096)}`;
    if (index === rejectedIndex)
      expect(result.exitCode, diagnostic).not.toBe(check.exit_code ?? 0);
    else {
      expect(result.exitCode, diagnostic).toBe(check.exit_code ?? 0);
      if (check.expect_regex !== undefined)
        expect(result.stdout, diagnostic).toMatch(
          new RegExp(check.expect_regex),
        );
      if (check.expect_exact !== undefined)
        expect(result.stdout, diagnostic).toBe(check.expect_exact);
    }
  }
}
