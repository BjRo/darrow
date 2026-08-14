import { existsSync } from "node:fs";
import { mkdir, readdir, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { BLOCKED_EXTERNAL_COMMANDS } from "./fixture";
import { captureProcess } from "./process";

const SOURCE_ROOT = resolve(import.meta.dir, "..", "..");
const SANDBOX_EXEC = "/usr/bin/sandbox-exec";

function quote(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function sandboxProfile(
  deniedPaths: string[],
  deniedExecutables: string[] = [],
): string {
  const unique = [...new Set(deniedPaths)].sort();
  const executables = [...new Set(deniedExecutables)].sort();
  return [
    "(version 1)",
    "(allow default)",
    ...executables.map(
      (path) => `(deny process-exec (literal "${quote(path)}"))`,
    ),
    ...unique.flatMap((path) => [
      `(deny file-read* (subpath "${quote(path)}"))`,
      `(deny file-write* (subpath "${quote(path)}"))`,
    ]),
    "",
  ].join("\n");
}

async function externalClientExecutables(): Promise<string[]> {
  const paths = (process.env.PATH ?? "").split(":").filter(Boolean);
  const found: string[] = [];
  for (const command of BLOCKED_EXTERNAL_COMMANDS) {
    for (const path of paths) {
      const candidate = join(path, command);
      if (!existsSync(candidate)) continue;
      try {
        found.push(await realpath(candidate));
      } catch {
        // A concurrently removed executable is already unavailable.
      }
    }
  }
  if (existsSync("/usr/bin/security")) found.push("/usr/bin/security");
  return found;
}

async function siblingFixtures(repoDir: string): Promise<string[]> {
  const repoReal = await realpath(repoDir);
  const entries = await readdir(tmpdir(), { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("darrow-eval-"))
      continue;
    const candidate = join(tmpdir(), entry.name);
    try {
      const candidateReal = await realpath(candidate);
      if (candidateReal !== repoReal) paths.push(candidateReal);
    } catch {
      // A concurrently removed fixture is already inaccessible.
    }
  }
  return paths;
}

async function globalSensitivePaths(): Promise<string[]> {
  const home = process.env.HOME ?? "";
  const candidates = [
    process.env.CODEX_HOME ?? resolve(home, ".codex"),
    process.env.CLAUDE_CONFIG_DIR ?? resolve(home, ".claude"),
    resolve(home, ".ssh"),
    resolve(home, ".gitconfig"),
    resolve(home, ".git-credentials"),
    resolve(home, ".config", "gh"),
    resolve(home, ".config", "glab-cli"),
    resolve(home, "Library", "Keychains"),
  ];
  const roots: string[] = [];
  for (const candidate of candidates) {
    try {
      roots.push(await realpath(candidate));
    } catch {
      // A missing global configuration cannot influence the harness.
    }
  }
  return roots;
}

async function repositoryWorktrees(): Promise<string[]> {
  const proc = Bun.spawn(
    ["git", "-C", SOURCE_ROOT, "worktree", "list", "--porcelain"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const { out, err, code } = await captureProcess(proc);
  if (code !== 0)
    throw new Error(`cannot resolve eval source worktrees: ${err.trim()}`);

  const roots: string[] = [];
  for (const line of out.split("\n")) {
    if (!line.startsWith("worktree ")) continue;
    roots.push(await realpath(line.slice("worktree ".length)));
  }
  if (!roots.length)
    throw new Error("cannot resolve eval source worktrees: inventory is empty");
  return roots;
}

/**
 * Wrap an evaluated agent in an outer boundary it cannot disable with its own
 * CLI flags. The native agent sandbox is bypassed only inside this boundary so
 * fixture mutations remain representative while source cases stay secret.
 */
export async function sandboxedAgentCommand(
  argv: string[],
  repoDir: string,
): Promise<string[]> {
  if (argv.length === 0) throw new Error("cannot sandbox an empty command");
  if (process.env.DARROW_EVAL_EXTERNAL_SANDBOX === "1") return argv;
  if (process.platform !== "darwin" || !existsSync(SANDBOX_EXEC)) {
    throw new Error(
      "eval isolation unavailable: run on macOS with sandbox-exec or set " +
        "DARROW_EVAL_EXTERNAL_SANDBOX=1 inside an equivalent external sandbox",
    );
  }

  const denied = [
    ...(await repositoryWorktrees()),
    ...(await siblingFixtures(repoDir)),
    ...(await globalSensitivePaths()),
  ];
  const profileDir = join(repoDir, ".git", "darrow-eval");
  await mkdir(profileDir, { recursive: true });
  const profilePath = join(profileDir, `${basename(argv[0]!)}.sb`);
  await writeFile(
    profilePath,
    sandboxProfile(denied, await externalClientExecutables()),
    { mode: 0o600 },
  );
  return [SANDBOX_EXEC, "-f", profilePath, ...argv];
}
