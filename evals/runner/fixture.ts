import { mkdtemp, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Fixture } from "./types";

async function git(repoDir: string, ...args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`git ${args.join(" ")} failed (${code}): ${err}`);
  return out;
}

async function writeFiles(repoDir: string, files: Record<string, string>): Promise<void> {
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
): Promise<string> {
  const repoDir = await mkdtemp(join(tmpdir(), "darrow-eval-"));
  await git(repoDir, "init", "-b", "main");
  await git(repoDir, "config", "user.name", "Eval Fixture");
  await git(repoDir, "config", "user.email", "fixture@darrow.local");

  for (const commit of fixture.commits) {
    await writeFiles(repoDir, commit.files);
    await git(repoDir, "add", ...Object.keys(commit.files));
    await git(repoDir, "commit", "-m", commit.message);
  }

  if (fixture.files) await writeFiles(repoDir, fixture.files);
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
  if (fixture.setup) {
    const proc = Bun.spawn(["bash", "-c", fixture.setup], {
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
    });
    const [err, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    if (code !== 0) throw new Error(`fixture setup failed (${code}): ${err}`);
  }

  const skillName = skillDir.split("/").filter(Boolean).pop()!;
  for (const mount of skillMounts) {
    await cp(skillDir, join(repoDir, mount, skillName), { recursive: true });
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
