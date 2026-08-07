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

/** Builds a temp git repo per the fixture and mounts the skill into the given dirs. */
export async function buildFixture(
  fixture: Fixture,
  skillDir: string,
  skillMounts: string[],
  mountPluginSkills = false,
  caseDir = "",
): Promise<string> {
  const repoDir = await mkdtemp(join(tmpdir(), "darrow-eval-"));
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
  if (fixture.hooks) {
    for (const [name, content] of Object.entries(fixture.hooks)) {
      const hookPath = join(repoDir, ".git", "hooks", name);
      await writeFile(hookPath, content, { mode: 0o755 });
    }
  }
  if (fixture.bin) {
    const binDir = join(repoDir, ".git", "fixture-bin");
    await mkdir(binDir, { recursive: true });
    for (const [name, content] of Object.entries(fixture.bin)) {
      await writeFile(join(binDir, name), content, { mode: 0o755 });
    }
  }
  if (fixture.ticket) {
    if (!/^[A-Za-z0-9._-]+$/.test(fixture.ticket.id))
      throw new Error("fixture: ticket id contains unsupported characters");
    if (/[\r\n]/.test(fixture.ticket.title))
      throw new Error("fixture: ticket title must be one line");
    const gitDir = join(repoDir, ".git");
    const binDir = join(gitDir, "fixture-bin");
    await mkdir(binDir, { recursive: true });
    await Promise.all([
      writeFile(join(binDir, "ticketctl"), TICKETCTL, { mode: 0o755 }),
      writeFile(join(gitDir, "fixture-ticket-id"), fixture.ticket.id + "\n"),
      writeFile(
        join(gitDir, "fixture-ticket-title"),
        fixture.ticket.title + "\n",
      ),
      writeFile(join(gitDir, "fixture-ticket.md"), fixture.ticket.body),
      writeFile(join(gitDir, "ticketctl.log"), ""),
    ]);
  }
  if (fixture.setup) {
    const setup = fixture.setup.replaceAll(
      "{{case_dir}}",
      "$DARROW_EVAL_CASE_DIR",
    );
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

  // Skill-less cases (experiments) mount nothing.
  if (!skillDir) return repoDir;

  // Plugin-level mechanics and deterministic config mount two levels above
  // the skill so relative paths resolve exactly like the repo/plugin cache.
  const pluginRoot = dirname(dirname(skillDir));
  const pluginBin = join(pluginRoot, "bin");
  const pluginConfig = join(pluginRoot, "config");
  const skillDirs = mountPluginSkills
    ? (await readdir(dirname(skillDir), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(dirname(skillDir), entry.name))
    : [skillDir];
  for (const mount of skillMounts) {
    for (const mountedSkillDir of skillDirs) {
      const mountedSkillName = mountedSkillDir
        .split("/")
        .filter(Boolean)
        .pop()!;
      const evalsDir = join(mountedSkillDir, "evals");
      await cp(mountedSkillDir, join(repoDir, mount, mountedSkillName), {
        recursive: true,
        // Never expose any skill's colocated pass criteria to the model.
        filter: (src) => src !== evalsDir && !src.startsWith(evalsDir + "/"),
      });
    }
    if (existsSync(pluginBin)) {
      await cp(pluginBin, join(repoDir, mount, "..", "bin"), {
        recursive: true,
      });
    }
    if (existsSync(pluginConfig)) {
      await cp(pluginConfig, join(repoDir, mount, "..", "config"), {
        recursive: true,
      });
    }
  }
  // Keep mounts invisible to git: they are eval infrastructure, not repo
  // state (a model told "commit my changes" would otherwise commit them).
  const excludes = skillMounts.map((m) => `/${m.split("/")[0]}/`).join("\n");
  await writeFile(join(repoDir, ".git", "info", "exclude"), excludes + "\n");

  return repoDir;
}

export async function destroyFixture(repoDir: string): Promise<void> {
  await rm(repoDir, { recursive: true, force: true });
}
