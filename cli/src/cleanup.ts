import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { DarrowError } from "./errors";
import { exists, hashDirectory, readJson, replaceJson, writeJson } from "./io";
import { withDirectoryLock } from "./locks";
import { run } from "./process";
import {
  removeManagedWorkspace,
  withRepositoryCoordination,
} from "./repository";
import { validateSchema } from "./schema";
import { event, readRun } from "./state";
import type {
  PublishedArtifact,
  RunRecord,
  TicketPublicationRecord,
} from "./types";

export type CleanupKind =
  | "artifacts"
  | "snapshot"
  | "content"
  | "results"
  | "worktree"
  | "ticket_artifact";

export interface CleanupFilters {
  runId: string | null;
  olderThanSeconds: number | null;
}

export interface CleanupSelection {
  runData: boolean;
  worktrees: boolean;
  tickets: boolean;
}

export interface CleanupItem {
  resourceId: string;
  runId: string;
  kind: CleanupKind;
  ticketKey: string | null;
  publicationId: string | null;
  contentHash: string | null;
  path: string;
  runState: RunRecord["state"] | "unavailable";
  ageSeconds: number;
  size: number;
  referenceStatus: "unreferenced" | "active_run" | "referenced_by_active_run";
  eligible: boolean;
  selected: boolean;
  reason:
    | "active_run"
    | "active_reference"
    | "dirty_worktree"
    | "dirty_ticket_artifact"
    | "digest_mismatch"
    | "source_run_missing"
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
    ticketKey?: string;
    publicationId?: string;
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
  runDir = await realpath(runDir);
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
  const root = await realpath(resolve(runDir, "../../.."));
  for (const resource of record.resources) {
    const ticketResource = resource.kind === "ticket_artifact";
    if (seen.has(resource.resourceId))
      throw new DarrowError(
        `cleanup record contains duplicate resource ${resource.resourceId}: ${path}`,
        "state",
      );
    if (!isAbsolute(resource.path))
      throw new DarrowError(
        `cleanup record contains a relative resource path: ${path}`,
        "state",
      );
    if (ticketResource) {
      if (!resource.ticketKey || !resource.publicationId)
        throw new DarrowError(
          `cleanup record omits ticket resource identity ${resource.resourceId}: ${path}`,
          "state",
        );
      if (
        resource.resourceId !==
        ticketResourceId(resource.ticketKey, resource.publicationId)
      )
        throw new DarrowError(
          `cleanup record ticket resource ID is inconsistent ${resource.resourceId}: ${path}`,
          "state",
        );
      if (!inside(resolve(root, ".darrow", "tickets"), resource.path))
        throw new DarrowError(
          `cleanup record ticket path escapes its repository ${resource.path}: ${path}`,
          "state",
        );
    } else if (
      resource.ticketKey !== undefined ||
      resource.publicationId !== undefined ||
      resource.resourceId !== `${record.runId}:${resource.kind}` ||
      (resource.kind !== "worktree" &&
        resource.path !== resolve(runDir, resource.kind))
    )
      throw new DarrowError(
        `cleanup record contains inconsistent run resource ${resource.resourceId}: ${path}`,
        "state",
      );
    seen.add(resource.resourceId);
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
  if (kind === "worktree") return selection.worktrees;
  if (kind === "ticket_artifact") return selection.tickets;
  return selection.runData;
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
    ticketKey: null,
    publicationId: null,
    contentHash: null,
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

function inside(root: string, path: string): boolean {
  const child = relative(resolve(root), resolve(path));
  return (
    child.length > 0 &&
    child !== ".." &&
    !child.startsWith("../") &&
    !child.startsWith("..\\") &&
    !isAbsolute(child)
  );
}

async function rejectCleanupSymlinks(path: string): Promise<void> {
  const info = await lstat(path);
  if (info.isSymbolicLink())
    throw new DarrowError(
      `ticket cleanup refuses a symbolic link: ${resolve(path)}`,
      "cleanup",
    );
  if (!info.isDirectory()) return;
  for (const entry of await readdir(path))
    await rejectCleanupSymlinks(resolve(path, entry));
}

function ticketResourceId(ticketKey: string, publicationId: string): string {
  return `ticket:${ticketKey}:${publicationId}`;
}

function ticketWorkingTreeDirty(
  root: string,
  ticketPath: string,
  artifactPath: string,
): boolean {
  for (const path of [ticketPath, artifactPath]) {
    const tracked = run(
      ["git", "ls-files", "--error-unmatch", "--", relative(root, path)],
      root,
    );
    if (tracked.exitCode !== 0) return true;
  }
  const status = run(
    [
      "git",
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--ignored=matching",
      "--",
      relative(root, ticketPath),
      relative(root, artifactPath),
    ],
    root,
  );
  if (status.exitCode !== 0)
    throw new DarrowError(
      `git could not inspect ticket cleanup paths: ${status.stderr.trim() || status.stdout.trim()}`,
      "git",
    );
  return status.stdout.length > 0;
}

async function ticketCandidate(
  root: string,
  ticketPath: string,
  ticketKey: string,
  publication: PublishedArtifact,
  records: Map<string, { runDir: string; record: RunRecord }>,
  filters: CleanupFilters,
  selection: CleanupSelection,
  activeCorpora: Array<{ runId: string; corpus: string }>,
  now: number,
): Promise<CleanupItem> {
  const run = records.get(publication.runId);
  const path = resolve(root, publication.location);
  const ticketDir = resolve(root, ".darrow", "tickets", ticketKey);
  if (!inside(resolve(ticketDir, "artifacts"), path))
    throw new DarrowError(
      `ticket publication location escapes ticket ${ticketKey}: ${publication.location}`,
      "state",
    );
  const prior = run
    ? (await cleanupRecord(run.runDir))?.resources.find(
        (resource) =>
          resource.resourceId ===
          ticketResourceId(ticketKey, publication.publicationId),
      )
    : undefined;
  const present = await exists(path);
  if (present) await rejectCleanupSymlinks(path);
  const publishedAt = Date.parse(publication.publishedAt);
  const ageSeconds = Math.max(0, Math.floor((now - publishedAt) / 1_000));
  const repositoryRelative = relative(root, path).replaceAll("\\", "/");
  const activeReference = activeCorpora.some(
    ({ runId, corpus }) =>
      runId !== publication.runId &&
      (corpus.includes(path) ||
        corpus.includes(repositoryRelative) ||
        corpus.includes(publication.publicationId)),
  );
  const referenceStatus =
    run?.record.state !== undefined && run.record.state !== "completed"
      ? "active_run"
      : activeReference
        ? "referenced_by_active_run"
        : "unreferenced";
  let reason: CleanupItem["reason"] = null;
  if (!run) reason = "source_run_missing";
  else if (run.record.state !== "completed") reason = "active_run";
  else if (activeReference) reason = "active_reference";
  else if (!present && prior?.completedAt) reason = "already_deleted";
  else if (!present) reason = "missing";
  else if (ticketWorkingTreeDirty(root, ticketPath, path))
    reason = "dirty_ticket_artifact";
  else if ((await hashDirectory(path)) !== publication.contentHash)
    reason = "digest_mismatch";
  const eligible = reason === null;
  const matchesRun =
    filters.runId === null || filters.runId === publication.runId;
  const matchesAge =
    filters.olderThanSeconds === null || ageSeconds >= filters.olderThanSeconds;
  return {
    resourceId: ticketResourceId(ticketKey, publication.publicationId),
    runId: publication.runId,
    kind: "ticket_artifact",
    ticketKey,
    publicationId: publication.publicationId,
    contentHash: publication.contentHash,
    path,
    runState: run?.record.state ?? "unavailable",
    ageSeconds,
    size: present ? await sizeOf(path) : (prior?.size ?? publication.size),
    referenceStatus,
    eligible,
    selected: selection.tickets && matchesRun && matchesAge,
    reason,
    proposedAction: eligible && matchesRun && matchesAge ? "delete" : "retain",
  };
}

async function ticketCandidates(
  root: string,
  records: Map<string, { runDir: string; record: RunRecord }>,
  filters: CleanupFilters,
  selection: CleanupSelection,
  activeCorpora: Array<{ runId: string; corpus: string }>,
  now: number,
): Promise<CleanupItem[]> {
  const ticketsRoot = resolve(root, ".darrow", "tickets");
  const lockRoot = resolve(root, ".darrow", "locks", "tickets");
  await mkdir(lockRoot, { recursive: true });
  const items: CleanupItem[] = [];
  const entries = await readdir(ticketsRoot, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink() || !entry.isDirectory())
      throw new DarrowError(
        `invalid ticket workspace entry: ${resolve(ticketsRoot, entry.name)}`,
        "state",
      );
    if (!/^[a-f0-9]{64}$/.test(entry.name))
      throw new DarrowError(
        `invalid ticket workspace key: ${entry.name}`,
        "state",
      );
    const ticketDir = resolve(ticketsRoot, entry.name);
    const ticketPath = resolve(ticketDir, "ticket.json");
    await withDirectoryLock(
      resolve(lockRoot, `${entry.name}.lock`),
      `ticket ${entry.name} cleanup inventory`,
      async () => {
        await rejectCleanupSymlinks(ticketPath);
        const record = await readJson<TicketPublicationRecord>(ticketPath);
        await validateSchema(
          "ticket-publication.schema.json",
          record,
          `ticket publication ${entry.name}`,
        );
        if (record.ticketKey !== entry.name)
          throw new DarrowError(
            `ticket publication key disagrees with its directory: ${ticketPath}`,
            "state",
          );
        const seen = new Set<string>();
        for (const publication of record.publications) {
          if (seen.has(publication.publicationId))
            throw new DarrowError(
              `ticket publication contains duplicate artifact ${publication.publicationId}: ${ticketPath}`,
              "state",
            );
          seen.add(publication.publicationId);
          items.push(
            await ticketCandidate(
              root,
              ticketPath,
              entry.name,
              publication,
              records,
              filters,
              selection,
              activeCorpora,
              now,
            ),
          );
        }
      },
    );
  }
  return items;
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

async function assertDeletionAuthority(
  root: string,
  item: CleanupItem,
): Promise<void> {
  const records = await runRecords(root);
  const owner = records.find(({ record }) => record.runId === item.runId);
  if (!owner || owner.record.state !== "completed")
    throw new DarrowError(
      `refusing cleanup for active or unavailable run ${item.runId}`,
      "cleanup_active",
    );
  const activeCorpora = await Promise.all(
    records
      .filter(({ record }) => record.state !== "completed")
      .map(async ({ runDir, record }) => ({
        runId: record.runId,
        corpus: await controlCorpus(runDir),
      })),
  );
  const referenced = referencedByActiveRun(
    root,
    item.path,
    activeCorpora,
    item.runId,
  );
  const ticketReferenced =
    item.publicationId !== null &&
    activeCorpora.some(
      ({ runId, corpus }) =>
        runId !== item.runId && corpus.includes(item.publicationId!),
    );
  if (referenced || ticketReferenced)
    throw new DarrowError(
      `refusing cleanup of ${item.resourceId}; it is referenced by an active run`,
      "cleanup_active",
    );
}

export async function inventoryCleanup(
  root: string,
  filters: CleanupFilters,
  selection: CleanupSelection,
  now = Date.now(),
): Promise<CleanupItem[]> {
  root = await realpath(root);
  const records = await runRecords(root);
  const recordsById = new Map(
    records.map((entry) => [entry.record.runId, entry] as const),
  );
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
  items.push(
    ...(await ticketCandidates(
      root,
      recordsById,
      filters,
      selection,
      activeCorpora,
      now,
    )),
  );
  if (
    filters.runId !== null &&
    !items.some((item) => item.runId === filters.runId)
  )
    throw new DarrowError(`run not found: ${filters.runId}`, "not_found");
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
      ...(item.ticketKey ? { ticketKey: item.ticketKey } : {}),
      ...(item.publicationId ? { publicationId: item.publicationId } : {}),
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

export async function cleanedTicketPublicationIds(
  record: CleanupRecord | null,
): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const resource of record?.resources ?? [])
    if (
      resource.kind === "ticket_artifact" &&
      resource.publicationId &&
      (resource.completedAt !== null || !(await exists(resource.path)))
    )
      ids.add(resource.publicationId);
  return ids;
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
      await assertDeletionAuthority(root, item);
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

async function deleteTicketItems(
  root: string,
  items: CleanupItem[],
): Promise<void> {
  const ticketKey = items[0]?.ticketKey;
  if (!ticketKey || items.some((item) => item.ticketKey !== ticketKey))
    throw new DarrowError("inconsistent ticket cleanup selection", "state");
  const ticketDir = resolve(root, ".darrow", "tickets", ticketKey);
  const ticketPath = resolve(ticketDir, "ticket.json");
  const lockPath = resolve(
    root,
    ".darrow",
    "locks",
    "tickets",
    `${ticketKey}.lock`,
  );
  await mkdir(resolve(lockPath, ".."), { recursive: true });
  await withDirectoryLock(lockPath, `ticket ${ticketKey} cleanup`, async () => {
    const record = await readJson<TicketPublicationRecord>(ticketPath);
    await validateSchema(
      "ticket-publication.schema.json",
      record,
      `ticket publication ${ticketKey}`,
    );
    if (record.ticketKey !== ticketKey)
      throw new DarrowError(
        `ticket publication key disagrees with its directory: ${ticketPath}`,
        "state",
      );
    const selectedIds = new Set(
      items.map((item) => item.publicationId).filter(Boolean),
    );
    const selectedPublications = record.publications.filter((publication) =>
      selectedIds.has(publication.publicationId),
    );
    if (selectedPublications.length !== items.length)
      throw new DarrowError(
        `ticket cleanup selection changed before deletion: ${ticketPath}`,
        "concurrency",
      );
    for (const item of items) await assertDeletionAuthority(root, item);
    for (const item of items) {
      const publication = selectedPublications.find(
        (candidate) => candidate.publicationId === item.publicationId,
      )!;
      if (
        resolve(root, publication.location) !== item.path ||
        publication.runId !== item.runId ||
        publication.contentHash !== item.contentHash ||
        !(await exists(item.path)) ||
        ticketWorkingTreeDirty(root, ticketPath, item.path) ||
        (await hashDirectory(item.path)) !== publication.contentHash
      )
        throw new DarrowError(
          `ticket cleanup resource changed before deletion: ${item.resourceId}`,
          "concurrency",
        );
    }
    for (const item of items) {
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
        },
      );
    }

    const prepared: Array<{ item: CleanupItem; mode: number }> = [];
    const moved: Array<{
      item: CleanupItem;
      mode: number;
      staging: string;
    }> = [];
    try {
      for (const item of items) {
        const staging = resolve(
          root,
          ".darrow",
          "runtime",
          "ticket-cleanup",
          `${item.publicationId}-${crypto.randomUUID()}`,
        );
        await mkdir(resolve(staging, ".."), { recursive: true });
        const mode = (await lstat(item.path)).mode & 0o777;
        prepared.push({ item, mode });
        await chmod(item.path, 0o755);
        await rename(item.path, staging);
        moved.push({ item, mode, staging });
      }
      record.publications = record.publications.filter(
        (publication) => !selectedIds.has(publication.publicationId),
      );
      await validateSchema(
        "ticket-publication.schema.json",
        record,
        `ticket publication ${ticketKey}`,
      );
      await replaceJson(ticketPath, record);
    } catch (error) {
      for (const { item, mode, staging } of moved.reverse())
        if ((await exists(staging)) && !(await exists(item.path))) {
          await rename(staging, item.path);
          await chmod(item.path, mode);
        }
      for (const { item, mode } of prepared)
        if (await exists(item.path)) await chmod(item.path, mode);
      throw error;
    }

    for (const { item, staging } of moved) {
      if (await exists(staging)) await makeRemovable(staging);
      await rm(staging, { recursive: true, force: true });
      const runDir = resolve(root, ".darrow", "runs", item.runId);
      const completedAt = new Date().toISOString();
      await withDirectoryLock(
        resolve(runDir, "state.lock"),
        `run ${item.runId} cleanup`,
        async () => {
          await writeCleanupMarker(runDir, item, completedAt);
          await event(runDir, item.runId, "cleanup.resource.deleted", {
            resourceId: item.resourceId,
            kind: item.kind,
            ticketKey: item.ticketKey,
            publicationId: item.publicationId,
            path: item.path,
            size: item.size,
            completedAt,
          });
        },
      );
    }
  });
}

async function cleanWithInventory(
  root: string,
  filters: CleanupFilters,
  selection: CleanupSelection,
): Promise<CleanupResult> {
  const mode =
    selection.runData || selection.worktrees || selection.tickets
      ? "delete"
      : "report";
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
  const selectedItems = items.filter((item) => item.selected);
  if (mode === "report") return result;
  for (const item of selectedItems) await assertDeletionAuthority(root, item);
  const ticketItems = items.filter(
    (candidate) => candidate.selected && candidate.kind === "ticket_artifact",
  );
  const tickets = new Map<string, CleanupItem[]>();
  for (const item of ticketItems) {
    const grouped = tickets.get(item.ticketKey!);
    if (grouped) grouped.push(item);
    else tickets.set(item.ticketKey!, [item]);
  }
  for (const ticketItems of tickets.values()) {
    await deleteTicketItems(root, ticketItems);
    result.deleted.push(...ticketItems.map((item) => item.resourceId));
  }
  const selected = items
    .filter(
      (candidate) => candidate.selected && candidate.kind !== "ticket_artifact",
    )
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

export async function cleanRepository(
  root: string,
  filters: CleanupFilters,
  selection: CleanupSelection,
): Promise<CleanupResult> {
  root = await realpath(root);
  const deleting =
    selection.runData || selection.worktrees || selection.tickets;
  if (!deleting) return cleanWithInventory(root, filters, selection);
  return withRepositoryCoordination(root, "repository cleanup", () =>
    cleanWithInventory(root, filters, selection),
  );
}
