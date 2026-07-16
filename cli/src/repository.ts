import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { stringify } from "yaml";
import { DarrowError } from "./errors";
import { exists, readJson, sha256, writeJson } from "./io";
import { BUNDLED_WORKFLOWS_DIR } from "./paths";
import { mustRun, run } from "./process";
import type { ProjectDefinition } from "./types";

export function primaryRepoRoot(cwd = process.cwd()): string {
  const output = mustRun(["git", "worktree", "list", "--porcelain"], cwd, "git");
  const first = output.split("\n").find((line) => line.startsWith("worktree "));
  if (!first) throw new DarrowError("git did not report a primary worktree", "git");
  return resolve(first.slice("worktree ".length));
}

export function currentWorktreeRoot(cwd = process.cwd()): string {
  return resolve(mustRun(["git", "rev-parse", "--show-toplevel"], cwd, "git"));
}

async function ensureLine(path: string, line: string): Promise<void> {
  const text = (await exists(path)) ? await readFile(path, "utf8") : "";
  if (text.split(/\r?\n/).includes(line)) return;
  const prefix = text.length === 0 || text.endsWith("\n") ? text : `${text}\n`;
  await writeFile(path, `${prefix}${line}\n`);
}

export async function initRepository(cwd = process.cwd()): Promise<string> {
  const root = primaryRepoRoot(cwd);
  const home = resolve(root, ".darrow");
  for (const dir of ["workflows", "tickets", "runs", "locks", "runtime", "worktrees"]) {
    await mkdir(resolve(home, dir), { recursive: true });
  }
  const projectPath = resolve(home, "project.yaml");
  if (!(await exists(projectPath))) {
    const project: ProjectDefinition = { schemaVersion: "0.1.0", defaultProfile: "codex", pluginRoots: [] };
    await writeFile(projectPath, stringify(project));
  }
  const workflowPath = resolve(home, "workflows", "implement-change.yaml");
  if (!(await exists(workflowPath))) {
    await Bun.write(workflowPath, Bun.file(resolve(BUNDLED_WORKFLOWS_DIR, "implement-change.yaml")));
  }
  for (const ignored of [".darrow/runs/", ".darrow/locks/", ".darrow/runtime/", ".darrow/worktrees/"]) {
    await ensureLine(resolve(root, ".gitignore"), ignored);
  }
  await ensureLine(resolve(root, ".gitattributes"), ".darrow/tickets/**/artifacts/** linguist-generated");
  return root;
}

export async function requireInitialized(root: string): Promise<void> {
  const project = resolve(root, ".darrow", "project.yaml");
  if (!(await exists(project))) throw new DarrowError(`Darrow is not initialized in ${root}; run darrow init`, "not_initialized");
}

export function pinnedCommit(cwd: string, base?: string): string {
  const ref = base ?? "HEAD";
  return mustRun(["git", "rev-parse", "--verify", `${ref}^{commit}`], cwd, "git");
}

export function isDirty(cwd: string): boolean {
  return run(["git", "status", "--porcelain=v1", "--untracked-files=all"], cwd).stdout.length > 0;
}

export async function allocateWorktree(root: string, runId: string, commit: string, customPath?: string): Promise<string> {
  const defaultPath = resolve(root, ".darrow", "worktrees", runId);
  const path = customPath ? resolve(customPath) : defaultPath;
  if (await exists(path)) throw new DarrowError(`worktree path already exists: ${path}`, "workspace");
  if (customPath) {
    const inside = relative(root, path);
    if (!inside.startsWith("..") && !isAbsolute(inside)) {
      const ignored = run(["git", "check-ignore", "-q", path], root);
      if (ignored.exitCode !== 0) throw new DarrowError(`custom worktree path inside the repository must already be ignored: ${path}`, "workspace");
    }
  }
  mustRun(["git", "worktree", "add", "--detach", path, commit], root, "workspace");
  return path;
}

export async function withAllocationLock<T>(root: string, operation: () => Promise<T>): Promise<T> {
  const lock = resolve(root, ".darrow", "locks", "allocation.lock");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { await mkdir(lock); break; }
    catch {
      if (attempt === 99) throw new DarrowError(`allocation lock is busy: ${lock}`, "concurrency");
      await Bun.sleep(20);
    }
  }
  try { return await operation(); }
  finally { await rm(lock, { recursive: true, force: true }); }
}

function ownerPath(root: string, workspace: string): string {
  return resolve(root, ".darrow", "runtime", "workspace-owners", `${sha256(resolve(workspace)).slice(7)}.json`);
}

export async function claimCurrentWorkspace(root: string, runId: string, workspace: string): Promise<void> {
  await withAllocationLock(root, async () => {
    const path = ownerPath(root, workspace);
    if (await exists(path)) {
      const owner = await readJson<{ runId: string; workspace: string }>(path);
      if (owner.runId !== runId) throw new DarrowError(`current worktree is already attached to run ${owner.runId}: ${workspace}`, "concurrency");
      return;
    }
    await writeJson(path, { schemaVersion: "0.1.0", runId, workspace: resolve(workspace), claimedAt: new Date().toISOString() });
  });
}

export async function releaseCurrentWorkspace(root: string, runId: string, workspace: string): Promise<void> {
  await withAllocationLock(root, async () => {
    const path = ownerPath(root, workspace);
    if (!(await exists(path))) return;
    const owner = await readJson<{ runId: string }>(path);
    if (owner.runId === runId) await rm(path, { force: true });
  });
}

export function newRunId(): string {
  return `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 12)}`;
}
