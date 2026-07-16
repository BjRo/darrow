import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  allocateManagedWorkspace,
  claimCurrentWorkspace,
  initRepository,
  ownedWorkspaceForRun,
  releaseWorkspace,
  reserveRunDirectory,
} from "../src/repository";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function git(cwd: string, args: string[]): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
  return result.stdout.toString().trim();
}

async function repo(): Promise<{ root: string; commit: string }> {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-repository-"));
  temps.push(root);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "user.email", "test@example.com"]);
  await writeFile(resolve(root, "README.md"), "fixture\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "-qm", "fixture"]);
  await initRepository(root);
  return { root, commit: git(root, ["rev-parse", "HEAD"]) };
}

describe("M2 repository concurrency", () => {
  test("allocates independent managed workspaces and persists their owners", async () => {
    const { root, commit } = await repo();
    const [left, right] = await Promise.all([
      allocateManagedWorkspace(root, "run-left", commit),
      allocateManagedWorkspace(root, "run-right", commit),
    ]);
    expect(left).not.toBe(right);
    expect((await ownedWorkspaceForRun(root, "run-left"))?.workspace).toBe(
      left,
    );
    expect((await ownedWorkspaceForRun(root, "run-right"))?.workspace).toBe(
      right,
    );
    expect(git(left, ["rev-parse", "HEAD"])).toBe(commit);
    expect(git(right, ["rev-parse", "HEAD"])).toBe(commit);
  });

  test("allows exactly one run to own an attached workspace", async () => {
    const { root } = await repo();
    const claims = await Promise.allSettled([
      claimCurrentWorkspace(root, "run-one", root),
      claimCurrentWorkspace(root, "run-two", root),
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(
      1,
    );
    const owner =
      (await ownedWorkspaceForRun(root, "run-one")) ??
      (await ownedWorkspaceForRun(root, "run-two"));
    expect(owner?.workspace).toBe(root);
    await releaseWorkspace(
      root,
      owner!.runId === "run-one" ? "run-two" : "run-one",
      root,
    );
    expect((await ownedWorkspaceForRun(root, owner!.runId))?.workspace).toBe(
      root,
    );
    await releaseWorkspace(root, owner!.runId, root);
    expect(await ownedWorkspaceForRun(root, owner!.runId)).toBeNull();
  });

  test("serializes run ID reservations", async () => {
    const { root } = await repo();
    const reservations = await Promise.all(
      Array.from({ length: 12 }, () => reserveRunDirectory(root)),
    );
    expect(new Set(reservations.map(({ runId }) => runId)).size).toBe(12);
    for (const reservation of reservations)
      expect((await stat(reservation.stagingDir)).isDirectory()).toBe(true);
  });
});
