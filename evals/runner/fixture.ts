import { mkdtemp, writeFile, mkdir, cp, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Fixture } from "./types";

const TICKETCTL = `#!/bin/bash
set -euo pipefail
git_dir=$(git rev-parse --git-dir)
case "$git_dir" in /*) ;; *) git_dir="$PWD/$git_dir" ;; esac
ticket_id=$(<"$git_dir/fixture-ticket-id")
ticket_title=$(<"$git_dir/fixture-ticket-title")
ticket_body="$git_dir/fixture-ticket.md"
log="$git_dir/ticketctl.log"

usage() {
  echo "usage: ticketctl get <id> --body-file <path> | describe <id> --body-file <path>" >&2
  exit 2
}

[[ $# -ge 1 ]] || usage
command=$1
shift
if [[ "$command" == "help" || "$command" == "--help" ]]; then
  echo "get <id> --body-file <path>"
  echo "describe <id> --body-file <path>"
  exit 0
fi
[[ $# -eq 3 && "$2" == "--body-file" ]] || usage
[[ "$1" == "$ticket_id" ]] || { echo "error: ticket not found: $1" >&2; exit 1; }
body_file=$3

case "$command" in
  get)
    cp "$ticket_body" "$body_file"
    printf 'id: %s\nstate: open\ntitle: %s\n' "$ticket_id" "$ticket_title"
    printf 'get %s\n' "$ticket_id" >>"$log"
    ;;
  describe)
    [[ -f "$body_file" ]] || { echo "error: unreadable body file" >&2; exit 1; }
    cp "$body_file" "$ticket_body"
    printf 'describe %s\n' "$ticket_id" >>"$log"
    printf 'updated: %s\n' "$ticket_id"
    ;;
  *) usage ;;
esac
`;

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`git ${args.join(" ")} failed (${code}): ${err}`);
  return out;
}

async function writeFiles(
  repoDir: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const abs = join(repoDir, path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content);
  }
}

/** Clone or initialise the fixture's git repo with a deterministic identity. */
async function initFixtureRepo(
  repoDir: string,
  fixture: Fixture,
): Promise<void> {
  if (fixture.repo) {
    if (fixture.commits?.length)
      throw new Error("fixture: repo and commits are mutually exclusive");
    await git(repoDir, "clone", "--local", "--no-hardlinks", fixture.repo, ".");
    // The eval clone must have no route back to the source repo.
    await git(repoDir, "remote", "remove", "origin");
  } else {
    await git(repoDir, "init", "-b", "main");
  }
  await git(repoDir, "config", "user.name", "Eval Fixture");
  await git(repoDir, "config", "user.email", "fixture@darrow.local");
}

/** Lay down the fixture's history, working tree, index, hooks, and stub bin. */
async function applyFixtureContent(
  repoDir: string,
  fixture: Fixture,
): Promise<void> {
  for (const commit of fixture.commits ?? []) {
    await writeFiles(repoDir, commit.files);
    await git(repoDir, "add", ...Object.keys(commit.files));
    await git(repoDir, "commit", "-m", commit.message);
  }

  if (fixture.files) {
    await writeFiles(repoDir, fixture.files);
    if (fixture.commit_files) {
      await git(repoDir, "add", ...Object.keys(fixture.files));
      await git(repoDir, "commit", "-m", "Add evaluation scaffolding");
    }
  } else if (fixture.commit_files) {
    throw new Error("fixture: commit_files requires files");
  }
  if (fixture.staged?.length) await git(repoDir, "add", ...fixture.staged);
  await writeFixtureExecutables(repoDir, fixture);
}

/** Install the fixture's git hooks and stub binaries, both mode 0755. */
async function writeFixtureExecutables(
  repoDir: string,
  fixture: Fixture,
): Promise<void> {
  for (const [name, content] of Object.entries(fixture.hooks ?? {})) {
    const hookPath = join(repoDir, ".git", "hooks", name);
    await writeFile(hookPath, content, { mode: 0o755 });
  }
  if (!fixture.bin) return;
  const binDir = join(repoDir, ".git", "fixture-bin");
  await mkdir(binDir, { recursive: true });
  for (const [name, content] of Object.entries(fixture.bin)) {
    await writeFile(join(binDir, name), content, { mode: 0o755 });
  }
}

/** Provision the local `ticketctl` stub and its single fixture ticket. */
async function provisionFixtureTicket(
  repoDir: string,
  ticket: NonNullable<Fixture["ticket"]>,
): Promise<void> {
  if (!/^[A-Za-z0-9._-]+$/.test(ticket.id))
    throw new Error("fixture: ticket id contains unsupported characters");
  if (/[\r\n]/.test(ticket.title))
    throw new Error("fixture: ticket title must be one line");
  const gitDir = join(repoDir, ".git");
  const binDir = join(gitDir, "fixture-bin");
  await mkdir(binDir, { recursive: true });
  await Promise.all([
    writeFile(join(binDir, "ticketctl"), TICKETCTL, { mode: 0o755 }),
    writeFile(join(gitDir, "fixture-ticket-id"), ticket.id + "\n"),
    writeFile(join(gitDir, "fixture-ticket-title"), ticket.title + "\n"),
    writeFile(join(gitDir, "fixture-ticket.md"), ticket.body),
    writeFile(join(gitDir, "ticketctl.log"), ""),
  ]);
}

async function runFixtureSetup(
  repoDir: string,
  script: string,
  caseDir: string,
): Promise<void> {
  const setup = script.replaceAll("{{case_dir}}", "$DARROW_EVAL_CASE_DIR");
  const proc = Bun.spawn(["bash", "-c", setup], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      DARROW_EVAL_CASE_DIR: caseDir,
    },
  });
  const [err, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`fixture setup failed (${code}): ${err}`);
}

/** Resolve which skill directories a mount receives: just the case's skill, or
 * every sibling skill in the same plugin. */
async function resolveMountedSkillDirs(
  skillDir: string,
  mountPluginSkills: boolean,
): Promise<string[]> {
  if (!mountPluginSkills) return [skillDir];
  const skillsRoot = dirname(skillDir);
  const entries = await readdir(skillsRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsRoot, entry.name));
}

async function copySkillWithoutEvals(
  mountedSkillDir: string,
  destination: string,
): Promise<void> {
  const evalsDir = join(mountedSkillDir, "evals");
  await cp(mountedSkillDir, destination, {
    recursive: true,
    // Never expose any skill's colocated pass criteria to the model.
    filter: (src) => src !== evalsDir && !src.startsWith(evalsDir + "/"),
  });
}

interface PluginMountPaths {
  manifest: string;
  agents: string;
  bin: string;
  config: string;
}

async function mountPluginMechanics(
  repoDir: string,
  mount: string,
  paths: PluginMountPaths,
): Promise<void> {
  if (existsSync(paths.bin))
    await cp(paths.bin, join(repoDir, mount, "..", "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(repoDir, mount, "..", "config"), {
      recursive: true,
    });
  if (mount.startsWith(".claude/") && existsSync(paths.agents))
    await cp(paths.agents, join(repoDir, ".claude", "agents"), {
      recursive: true,
    });
}

async function mountSourceClaudePlugin(
  repoDir: string,
  skillDirs: string[],
  paths: PluginMountPaths,
): Promise<void> {
  const evalPlugin = join(repoDir, ".git", "eval-plugin");
  await mkdir(join(evalPlugin, ".claude-plugin"), { recursive: true });
  await cp(paths.manifest, join(evalPlugin, ".claude-plugin", "plugin.json"));
  for (const mountedSkillDir of skillDirs) {
    const name = mountedSkillDir.split("/").filter(Boolean).pop()!;
    await copySkillWithoutEvals(
      mountedSkillDir,
      join(evalPlugin, "skills", name),
    );
  }
  await cp(paths.agents, join(evalPlugin, "agents"), { recursive: true });
  if (existsSync(paths.bin))
    await cp(paths.bin, join(evalPlugin, "bin"), { recursive: true });
  if (existsSync(paths.config))
    await cp(paths.config, join(evalPlugin, "config"), { recursive: true });
}

async function mountSkills(
  repoDir: string,
  options: Pick<
    BuildFixtureOptions,
    "skillDir" | "skillMounts" | "mountPluginSkills"
  >,
): Promise<void> {
  const { skillDir, skillMounts, mountPluginSkills = false } = options;
  // Plugin-level mechanics and deterministic config mount two levels above
  // the skill so relative paths resolve exactly like the repo/plugin cache.
  const pluginRoot = dirname(dirname(skillDir));
  const paths: PluginMountPaths = {
    bin: join(pluginRoot, "bin"),
    config: join(pluginRoot, "config"),
    agents: join(pluginRoot, "agents"),
    manifest: join(pluginRoot, ".claude-plugin", "plugin.json"),
  };
  const skillDirs = await resolveMountedSkillDirs(skillDir, mountPluginSkills);
  for (const mount of skillMounts) {
    for (const mountedSkillDir of skillDirs) {
      const mountedSkillName = mountedSkillDir
        .split("/")
        .filter(Boolean)
        .pop()!;
      await copySkillWithoutEvals(
        mountedSkillDir,
        join(repoDir, mount, mountedSkillName),
      );
    }
    await mountPluginMechanics(repoDir, mount, paths);
  }
  if (
    skillMounts.some((mount) => mount.startsWith(".claude/")) &&
    existsSync(paths.agents) &&
    existsSync(paths.manifest)
  ) {
    // Use source runner definitions instead of a possibly stale global cache.
    await mountSourceClaudePlugin(repoDir, skillDirs, paths);
  }
  // Keep mounts invisible to git: they are eval infrastructure, not repo
  // state (a model told "commit my changes" would otherwise commit them).
  const excludes = skillMounts.map((m) => `/${m.split("/")[0]}/`).join("\n");
  await writeFile(join(repoDir, ".git", "info", "exclude"), excludes + "\n");
}

export interface BuildFixtureOptions {
  fixture: Fixture;
  /** Skill under evaluation; empty for skill-less experiment cases. */
  skillDir: string;
  /** Repo-relative directories the skill is copied into. */
  skillMounts: string[];
  /** Mount every sibling skill of the plugin, not just `skillDir`. */
  mountPluginSkills?: boolean;
  /** Value of `{{case_dir}}` / `$DARROW_EVAL_CASE_DIR` in `fixture.setup`. */
  caseDir?: string;
}

/** Builds a temp git repo per the fixture and mounts the skill into the given dirs. */
export async function buildFixture(
  options: BuildFixtureOptions,
): Promise<string> {
  const { fixture, skillDir, caseDir = "" } = options;
  const repoDir = await mkdtemp(join(tmpdir(), "darrow-eval-"));
  await initFixtureRepo(repoDir, fixture);
  await applyFixtureContent(repoDir, fixture);
  if (fixture.ticket) await provisionFixtureTicket(repoDir, fixture.ticket);
  if (fixture.setup) await runFixtureSetup(repoDir, fixture.setup, caseDir);

  // Skill-less cases (experiments) mount nothing.
  if (skillDir) await mountSkills(repoDir, options);

  return repoDir;
}

export async function destroyFixture(repoDir: string): Promise<void> {
  if (!existsSync(repoDir)) return;
  let removalError: unknown;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const writable = Bun.spawn(["chmod", "-R", "u+rwX", repoDir], {
      stdout: "ignore",
      stderr: "pipe",
    });
    const [stderr, code] = await Promise.all([
      new Response(writable.stderr).text(),
      writable.exited,
    ]);
    if (code !== 0 && existsSync(repoDir)) {
      throw new Error(`cannot make eval fixture removable: ${stderr.trim()}`);
    }
    try {
      await rm(repoDir, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay: 100,
      });
    } catch (error) {
      removalError = error;
    }
    if (!existsSync(repoDir)) return;
    await Bun.sleep(Math.min(100 * 2 ** attempt, 1_000));
  }
  throw removalError ?? new Error(`cannot remove eval fixture: ${repoDir}`);
}
