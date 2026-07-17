import { chmod, lstat, readdir, readFile, rm } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { DarrowError } from "./errors";
import { exists, readJson, replaceJson, writeJson } from "./io";
import { withDirectoryLock } from "./locks";
import { run } from "./process";
import { removeManagedWorkspace } from "./repository";
import { validateSchema } from "./schema";
import { event, readRun } from "./state";
import type { RunRecord } from "./types";

export type CleanupKind =
  "artifacts" | "snapshot" | "content" | "results" | "worktree";

export interface CleanupFilters {
  runId: string | null;
  olderThanSeconds: number | null;
}

export interface CleanupSelection {
  runData: boolean;
  worktrees: boolean;
}

export interface CleanupItem {
  resourceId: string;
  runId: string;
  kind: CleanupKind;
  path: string;
  runState: RunRecord["state"];
  ageSeconds: number;
  size: number;
  referenceStatus: "unreferenced" | "active_run" | "referenced_by_active_run";
  eligible: boolean;
  selected: boolean;
  reason:
    | "active_run"
    | "active_reference"
    | "dirty_worktree"
    | "missing"
    | "already_deleted"
    | null;
  proposedAction: "delete" | "retain";
}

export interface CleanupRecord {
  schemaVersion: "0.1.0";
  runId: string;
  resources: Array<{
    resourceId: string;
    kind: CleanupKind;
    path: string;
    size: number;
    selectedAt: string;
    completedAt: string | null;
  }>;
}

export interface CleanupResult {
  mode: "report" | "delete";
  filters: CleanupFilters;
  selection: CleanupSelection;
  items: CleanupItem[];
  deleted: string[];
  blockers: CleanupItem[];
}

const RUN_DATA_KINDS: CleanupKind[] = [
  "artifacts",
  "snapshot",
  "content",
  "results",
];

async function sizeOf(path: string): Promise<number> {
  const info = await lstat(path);
  if (!info.isDirectory()) return info.size;
  let size = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) size += await sizeOf(child);
    else size += (await lstat(child)).size;
  }
  return size;
}

async function makeRemovable(path: string): Promise<void> {
  const info = await lstat(path);
  if (info.isSymbolicLink()) return;
  if (!info.isDirectory()) {
    await chmod(path, 0o600);
    return;
  }
  await chmod(path, 0o700);
  for (const entry of await readdir(path))
    await makeRemovable(resolve(path, entry));
}

async function cleanupRecord(runDir: string): Promise<CleanupRecord | null> {
  const path = resolve(runDir, "cleanup.json");
  if (!(await exists(path))) return null;
  const record = await readJson<CleanupRecord>(path);
  await validateSchema("cleanup.schema.json", record, `cleanup record ${path}`);
  if (record.runId !== basename(runDir))
    throw new DarrowError(
      `cleanup record run ID disagrees with its directory: ${path}`,
      "state",
    );
  const seen = new Set<string>();
  for (const resource of record.resources) {
    if (
      seen.has(resource.kind) ||
      resource.resourceId !== `${record.runId}:${resource.kind}` ||
      !isAbsolute(resource.path) ||
      (resource.kind !== "worktree" &&
        resource.path !== resolve(runDir, resource.kind))
    )
      throw new DarrowError(
        `cleanup record contains an inconsistent resource: ${path}`,
        "state",
      );
    seen.add(resource.kind);
  }
  return record;
}

export async function readCleanupRecord(
  runDir: string,
): Promise<CleanupRecord | null> {
  return cleanupRecord(runDir);
}

export async function cleanupUnavailable(
  record: CleanupRecord | null,
  kind: CleanupKind,
): Promise<boolean> {
  const resource = record?.resources.find((item) => item.kind === kind);
  return resource
    ? resource.completedAt !== null || !(await exists(resource.path))
    : false;
}

async function controlCorpus(runDir: string): Promise<string> {
  const chunks: string[] = [];
  for (const name of ["run.json", "plan.json", "lock.json", "events.jsonl"]) {
    const path = resolve(runDir, name);
    if (await exists(path)) chunks.push(await readFile(path, "utf8"));
  }
  const results = resolve(runDir, "results");
  if (await exists(results)) {
    for (const name of await readdir(results)) {
      if (name.endsWith(".json"))
        chunks.push(await readFile(resolve(results, name), "utf8"));
    }
  }
  return chunks.join("\n");
}

function selectedKind(kind: CleanupKind, selection: CleanupSelection): boolean {
  return kind === "worktree" ? selection.worktrees : selection.runData;
}

function referencedByActiveRun(
  root: string,
  path: string,
  activeCorpora: Array<{ runId: string; corpus: string }>,
  ownRunId: string,
): boolean {
  const absolute = resolve(path);
  const repositoryRelative = relative(root, absolute).replaceAll("\\", "/");
  return activeCorpora.some(
    ({ runId, corpus }) =>
      runId !== ownRunId &&
      (corpus.includes(absolute) || corpus.includes(repositoryRelative)),
  );
}

async function candidate(
  root: string,
  runDir: string,
  record: RunRecord,
  kind: CleanupKind,
  path: string,
  filters: CleanupFilters,
  selection: CleanupSelection,
  activeCorpora: Array<{ runId: string; corpus: string }>,
  now: number,
): Promise<CleanupItem> {
  const marker = await cleanupRecord(runDir);
  const prior = marker?.resources.find((resource) => resource.kind === kind);
  const present = await exists(path);
  const ageSeconds = Math.max(
    0,
    Math.floor((now - Date.parse(record.updatedAt)) / 1_000),
  );
  const activeReference = referencedByActiveRun(
    root,
    path,
    activeCorpora,
    record.runId,
  );
  const referenceStatus =
    record.state !== "completed"
      ? "active_run"
      : activeReference
        ? "referenced_by_active_run"
        : "unreferenced";
  let reason: CleanupItem["reason"] = null;
  if (record.state !== "completed") reason = "active_run";
  else if (activeReference) reason = "active_reference";
  else if (!present && prior?.completedAt) reason = "already_deleted";
  else if (!present && !prior) reason = "missing";
  else if (kind === "worktree") {
    const status = run(
      ["git", "status", "--porcelain=v1", "--untracked-files=all"],
      path,
    );
    if (status.exitCode !== 0) reason = "missing";
    else if (status.stdout.length > 0) reason = "dirty_worktree";
  }
  const eligible = reason === null;
  const matchesRun = filters.runId === null || filters.runId === record.runId;
  const matchesAge =
    filters.olderThanSeconds === null || ageSeconds >= filters.olderThanSeconds;
  const selected = selectedKind(kind, selection) && matchesRun && matchesAge;
  return {
    resourceId: `${record.runId}:${kind}`,
    runId: record.runId,
    kind,
    path: resolve(path),
    runState: record.state,
    ageSeconds,
    size: present ? await sizeOf(path) : (prior?.size ?? 0),
    referenceStatus,
    eligible,
    selected,
    reason,
    proposedAction: eligible && matchesRun && matchesAge ? "delete" : "retain",
  };
}

async function runRecords(
  root: string,
): Promise<Array<{ runDir: string; record: RunRecord }>> {
  const runsDir = resolve(root, ".darrow", "runs");
  const records: Array<{ runDir: string; record: RunRecord }> = [];
  for (const name of (await readdir(runsDir)).sort()) {
    if (name.startsWith(".staging-")) continue;
    const runDir = resolve(runsDir, name);
    if (!(await lstat(runDir)).isDirectory()) continue;
    records.push({ runDir, record: await readRun(runDir) });
  }
  return records;
}

export async function inventoryCleanup(
  root: string,
  filters: CleanupFilters,
  selection: CleanupSelection,
  now = Date.now(),
): Promise<CleanupItem[]> {
  const records = await runRecords(root);
  if (
    filters.runId !== null &&
    !records.some(({ record }) => record.runId === filters.runId)
  )
    throw new DarrowError(`run not found: ${filters.runId}`, "not_found");
  const activeCorpora = await Promise.all(
    records
      .filter(({ record }) => record.state !== "completed")
      .map(async ({ runDir, record }) => ({
        runId: record.runId,
        corpus: await controlCorpus(runDir),
      })),
  );
  const items: CleanupItem[] = [];
  for (const { runDir, record } of records) {
    for (const kind of RUN_DATA_KINDS)
      items.push(
        await candidate(
          root,
          runDir,
          record,
          kind,
          resolve(runDir, kind),
          filters,
          selection,
          activeCorpora,
          now,
        ),
      );
    if (record.workspace && record.temporal.attached !== true)
      items.push(
        await candidate(
          root,
          runDir,
          record,
          "worktree",
          record.workspace,
          filters,
          selection,
          activeCorpora,
          now,
        ),
      );
  }
  return items;
}

async function writeCleanupMarker(
  runDir: string,
  item: CleanupItem,
  completedAt: string | null,
): Promise<void> {
  const path = resolve(runDir, "cleanup.json");
  const record =
    (await cleanupRecord(runDir)) ??
    ({
      schemaVersion: "0.1.0",
      runId: item.runId,
      resources: [],
    } satisfies CleanupRecord);
  const existing = record.resources.find(
    (resource) => resource.resourceId === item.resourceId,
  );
  if (existing) {
    if (completedAt) existing.completedAt = completedAt;
  } else {
    record.resources.push({
      resourceId: item.resourceId,
      kind: item.kind,
      path: item.path,
      size: item.size,
      selectedAt: new Date().toISOString(),
      completedAt,
    });
  }
  await validateSchema("cleanup.schema.json", record, `cleanup record ${path}`);
  if (await exists(path)) await replaceJson(path, record);
  else await writeJson(path, record);
}

async function deleteItem(root: string, item: CleanupItem): Promise<void> {
  const runDir = resolve(root, ".darrow", "runs", item.runId);
  await withDirectoryLock(
    resolve(runDir, "state.lock"),
    `run ${item.runId} cleanup`,
    async () => {
      const current = await readRun(runDir);
      if (current.state !== "completed")
        throw new DarrowError(
          `refusing cleanup for active run ${item.runId}`,
          "cleanup_active",
        );
      await writeCleanupMarker(runDir, item, null);
      if (item.kind === "worktree")
        await removeManagedWorkspace(root, item.runId, item.path);
      else {
        if (await exists(item.path)) await makeRemovable(item.path);
        await rm(item.path, { recursive: true, force: true });
      }
      const completedAt = new Date().toISOString();
      await writeCleanupMarker(runDir, item, completedAt);
      await event(runDir, item.runId, "cleanup.resource.deleted", {
        resourceId: item.resourceId,
        kind: item.kind,
        path: item.path,
        size: item.size,
        completedAt,
      });
    },
  );
}

export async function cleanRepository(
  root: string,
  filters: CleanupFilters,
  selection: CleanupSelection,
): Promise<CleanupResult> {
  const mode = selection.runData || selection.worktrees ? "delete" : "report";
  const items = await inventoryCleanup(root, filters, selection);
  const blockers = items.filter((item) => item.selected && !item.eligible);
  const result: CleanupResult = {
    mode,
    filters,
    selection,
    items,
    deleted: [],
    blockers,
  };
  if (blockers.length > 0) return result;
  const selected = items
    .filter((candidate) => candidate.selected)
    .sort(
      (left, right) =>
        Number(right.kind === "worktree") - Number(left.kind === "worktree"),
    );
  for (const item of selected) {
    await deleteItem(root, item);
    result.deleted.push(item.resourceId);
  }
  return result;
}
