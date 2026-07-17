import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  cleanRepository,
  inventoryCleanup,
  readCleanupRecord,
} from "../src/cleanup";
import { exists, writeJson } from "../src/io";
import { CLI_ROOT } from "../src/paths";
import {
  allocateManagedWorkspace,
  initRepository,
  releaseWorkspace,
} from "../src/repository";
import type { RunRecord } from "../src/types";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

function command(
  args: string[],
  cwd: string,
): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(args, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

function git(cwd: string, args: string[]): string {
  const result = command(["git", ...args], cwd);
  if (result.code !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function fixture(): Promise<{ root: string; commit: string }> {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-cleanup-"));
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

async function createRun(
  root: string,
  commit: string,
  runId: string,
  state: RunRecord["state"],
): Promise<{ runDir: string; workspace: string }> {
  const runDir = resolve(root, ".darrow", "runs", runId);
  for (const name of ["artifacts", "snapshot", "content", "results"])
    await mkdir(resolve(runDir, name), { recursive: true });
  await writeFile(resolve(runDir, "artifacts", "evidence.txt"), "evidence\n");
  await writeFile(resolve(runDir, "snapshot", "workflow.yaml"), "id: test\n");
  await writeFile(resolve(runDir, "content", "prompt.txt"), "prompt\n");
  await writeFile(resolve(runDir, "results", "result.json"), "{}\n");
  const workspace = await allocateManagedWorkspace(root, runId, commit);
  const time = "2026-01-01T00:00:00.000Z";
  await writeJson(resolve(runDir, "run.json"), {
    schemaVersion: "0.1.0",
    runId,
    workflowId: "test",
    state,
    conclusion: state === "completed" ? "succeeded" : null,
    createdAt: time,
    updatedAt: time,
    temporal: {},
    workspace,
    currentStep: state === "completed" ? null : "implement",
    steps: [
      {
        stepId: "implement",
        state: state === "completed" ? "succeeded" : "running",
        attempt: 1,
      },
    ],
    request: null,
    waivers: [],
    cancellation: null,
    error: null,
  } satisfies RunRecord);
  if (state === "completed") await releaseWorkspace(root, runId, workspace);
  return { runDir, workspace };
}

describe("M2 explicit cleanup", () => {
  test("reports eligibility without deleting and applies age filters", async () => {
    const { root, commit } = await fixture();
    const terminal = await createRun(root, commit, "run-terminal", "completed");
    await createRun(root, commit, "run-active", "running");
    const items = await inventoryCleanup(
      root,
      { runId: null, olderThanSeconds: 86_400 },
      { runData: false, worktrees: false },
      Date.parse("2026-07-16T00:00:00.000Z"),
    );
    expect(
      items
        .filter((item) => item.runId === "run-terminal")
        .every((item) => item.eligible && item.proposedAction === "delete"),
    ).toBe(true);
    expect(
      items
        .filter((item) => item.runId === "run-active")
        .every(
          (item) =>
            !item.eligible &&
            item.reason === "active_run" &&
            item.referenceStatus === "active_run",
        ),
    ).toBe(true);
    expect(await exists(resolve(terminal.runDir, "artifacts"))).toBe(true);
    expect(await exists(terminal.workspace)).toBe(true);
  });

  test("refuses an entire selected cleanup when a run is active or a worktree is dirty", async () => {
    const { root, commit } = await fixture();
    const terminal = await createRun(root, commit, "run-terminal", "completed");
    await createRun(root, commit, "run-active", "running");
    await writeFile(resolve(terminal.workspace, "dirty.txt"), "dirty\n");
    const result = await cleanRepository(
      root,
      { runId: null, olderThanSeconds: null },
      { runData: true, worktrees: true },
    );
    expect(result.deleted).toEqual([]);
    expect(result.blockers.some((item) => item.reason === "active_run")).toBe(
      true,
    );
    expect(
      result.blockers.some((item) => item.reason === "dirty_worktree"),
    ).toBe(true);
    expect(await exists(resolve(terminal.runDir, "artifacts"))).toBe(true);
    expect(await exists(terminal.workspace)).toBe(true);
  });

  test("protects terminal data referenced by another active run", async () => {
    const { root, commit } = await fixture();
    const terminal = await createRun(root, commit, "run-terminal", "completed");
    const active = await createRun(root, commit, "run-active", "running");
    await writeFile(
      resolve(active.runDir, "events.jsonl"),
      `${JSON.stringify({ artifact: resolve(terminal.runDir, "artifacts") })}\n`,
    );
    const result = await cleanRepository(
      root,
      { runId: "run-terminal", olderThanSeconds: null },
      { runData: true, worktrees: false },
    );
    expect(result.deleted).toEqual([]);
    expect(
      result.blockers.find((item) => item.kind === "artifacts"),
    ).toMatchObject({
      reason: "active_reference",
      referenceStatus: "referenced_by_active_run",
    });
    expect(await exists(resolve(terminal.runDir, "artifacts"))).toBe(true);
  });

  test("deletes selected terminal data and a clean managed worktree without deleting its branch", async () => {
    const { root, commit } = await fixture();
    const terminal = await createRun(root, commit, "run-terminal", "completed");
    git(terminal.workspace, ["switch", "-q", "-c", "feat/retained"]);
    await chmod(resolve(terminal.runDir, "artifacts", "evidence.txt"), 0o444);
    await chmod(resolve(terminal.runDir, "artifacts"), 0o555);
    const result = await cleanRepository(
      root,
      { runId: "run-terminal", olderThanSeconds: null },
      { runData: true, worktrees: true },
    );
    expect(result.blockers).toEqual([]);
    expect(result.deleted).toEqual([
      "run-terminal:worktree",
      "run-terminal:artifacts",
      "run-terminal:snapshot",
      "run-terminal:content",
      "run-terminal:results",
    ]);
    expect(await exists(resolve(terminal.runDir, "artifacts"))).toBe(false);
    expect(await exists(terminal.workspace)).toBe(false);
    expect(git(root, ["branch", "--list", "feat/retained"])).toContain(
      "feat/retained",
    );
    const marker = await readCleanupRecord(terminal.runDir);
    expect(marker?.resources).toHaveLength(5);
    expect(marker?.resources.every((resource) => resource.completedAt)).toBe(
      true,
    );
    const events = await Bun.file(
      resolve(terminal.runDir, "events.jsonl"),
    ).text();
    expect(events.match(/"type":"cleanup.resource.deleted"/g)).toHaveLength(5);
  });

  test("CLI report is read-only and selected active cleanup returns a typed refusal", async () => {
    const { root, commit } = await fixture();
    const active = await createRun(root, commit, "run-active", "running");
    const cli = resolve(CLI_ROOT, "src", "index.ts");
    const report = command(
      ["bun", cli, "clean", "--run", "run-active", "--json"],
      root,
    );
    expect(report.code, report.stderr).toBe(0);
    const reported = JSON.parse(report.stdout) as {
      ok: boolean;
      data: { mode: string; deleted: string[]; items: unknown[] };
    };
    expect(reported.ok).toBe(true);
    expect(reported.data.mode).toBe("report");
    expect(reported.data.deleted).toEqual([]);
    expect(reported.data.items).not.toHaveLength(0);
    const refused = command(
      ["bun", cli, "clean", "--run", "run-active", "--worktrees", "--json"],
      root,
    );
    expect(refused.code).toBe(2);
    const refusal = JSON.parse(refused.stdout) as {
      ok: boolean;
      error: { category: string };
    };
    expect(refusal.ok).toBe(false);
    expect(refusal.error.category).toBe("cleanup_refused");
    expect(await exists(active.workspace)).toBe(true);
  });
});
