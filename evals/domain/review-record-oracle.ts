import { afterEach, expect } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { OracleCheck } from "./fixture-command";
import { prepareUvFixtureRuntime } from "./fixture-runtime";

const backend = fileURLToPath(
  new URL("../../plugins/capability/darrow-review/backend/", import.meta.url),
);
const roots: string[] = [];
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function copyReviewPackage(project: string) {
  const excluded = new Set([
    ".venv",
    "tests",
    "__pycache__",
    ".hypothesis",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
  ]);
  await cp(backend, project, {
    recursive: true,
    filter: (path) => !excluded.has(basename(path)),
  });
  const assertions = join(project, "tests/evals");
  await mkdir(assertions, { recursive: true });
  await writeFile(
    join(assertions, "assert_records.py"),
    await readFile(join(backend, "tests/evals/assert_records.py")),
  );
}

async function runRecordCommand(
  check: OracleCheck,
  options: { root: string; environment: Record<string, string> },
) {
  if (
    "expect_regex" in check ||
    "expect_exact" in check ||
    ("exit_code" in check && check.exit_code !== 0)
  )
    throw new Error(
      "review record checks must express their expected outcome in the command",
    );
  const command = Bun.spawn(["/bin/bash", "-e", "-c", check.run], {
    cwd: options.root,
    env: options.environment,
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
  expect(exitCode, `${check.name}\n${(stderr || stdout).slice(0, 4096)}`).toBe(
    0,
  );
}

/** Check review records through their owning frozen CLI, without a participant run. */
export async function runReviewRecordChecks(checks: OracleCheck[]) {
  const root = await mkdtemp(join(tmpdir(), "darrow-review-record-oracle-"));
  roots.push(root);
  const project = join(root, ".git/eval-tools/backend");
  const bin = join(root, ".git/fixture-bin");
  const home = join(root, ".git/oracle-home");
  const temporary = join(root, ".git/oracle-tmp");
  const reviewState = join(root, ".git/review-state");
  await Promise.all(
    [bin, home, temporary, reviewState].map((path) =>
      mkdir(path, { recursive: true }),
    ),
  );
  await copyReviewPackage(project);
  await writeFile(join(root, ".git/oracle-review-state"), reviewState + "\n");
  const runtime = await prepareUvFixtureRuntime();
  for (const [name, content] of Object.entries(runtime.bin))
    await writeFile(join(bin, name), content, { mode: 0o755 });
  const uv = Bun.which("uv");
  if (!uv) throw new Error("fixture tool is unavailable: uv");
  const environment = {
    PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`,
    HOME: home,
    TMPDIR: temporary,
    LANG: "C",
    UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? join(home, "uv-cache"),
    UV_PYTHON_DOWNLOADS: "never",
    PYTHONDONTWRITEBYTECODE: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const commands = [
    {
      name: "prepare the frozen review package",
      run: `${runtime.setupPrefix}\n${quote(uv)} sync --quiet --frozen --no-dev --project ${quote(project)}`,
    },
    ...checks,
  ];
  for (const check of commands)
    await runRecordCommand(check, { root, environment });
}
