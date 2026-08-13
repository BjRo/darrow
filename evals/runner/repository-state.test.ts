import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  repositoryMutationMatches,
  repositoryMutationState,
} from "./repository-state";

const roots: string[] = [];

async function git(repo: string, ...args: string[]): Promise<void> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: repo,
    stdout: "ignore",
    stderr: "pipe",
  });
  const error = await new Response(proc.stderr).text();
  if ((await proc.exited) !== 0) throw new Error(error);
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

describe("repository mutation state", () => {
  test("supports both no-mutation and explicit-mutation cases", () => {
    expect(repositoryMutationMatches("base", "base", false)).toBe(true);
    expect(repositoryMutationMatches("base", "changed", false)).toBe(false);
    expect(repositoryMutationMatches("base", "changed", true)).toBe(true);
    expect(repositoryMutationMatches("base", "base", true)).toBe(false);
  });

  test("changes for untracked, staged, unstaged, and branch-only mutations", async () => {
    const repo = await mkdtemp(join(tmpdir(), "darrow-repository-state-"));
    roots.push(repo);
    await git(repo, "init", "-b", "main");
    await git(repo, "config", "user.name", "Eval");
    await git(repo, "config", "user.email", "eval@example.invalid");
    await writeFile(join(repo, "tracked.txt"), "base\n");
    await git(repo, "add", "tracked.txt");
    await git(repo, "commit", "-m", "init");
    const base = await repositoryMutationState(repo);

    await writeFile(join(repo, "untracked.txt"), "new\n");
    expect(await repositoryMutationState(repo)).not.toBe(base);
    await rm(join(repo, "untracked.txt"));

    await writeFile(join(repo, "tracked.txt"), "changed\n");
    expect(await repositoryMutationState(repo)).not.toBe(base);
    await git(repo, "add", "tracked.txt");
    expect(await repositoryMutationState(repo)).not.toBe(base);
    await git(repo, "restore", "--staged", "--worktree", "tracked.txt");

    await git(repo, "switch", "-c", "other");
    expect(await repositoryMutationState(repo)).not.toBe(base);

    await git(repo, "switch", "main");
    await git(repo, "branch", "hidden-ref");
    expect(await repositoryMutationState(repo)).not.toBe(base);
  });
});
