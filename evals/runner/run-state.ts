import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { atomicWriteJsonSync } from "./artifacts";

interface ProcessOwner {
  pid: number;
  startedAt: string;
  host: string;
}

export interface ActiveRunRecord {
  format: "darrow-eval-active-run-v1";
  status: "active" | "complete" | "diagnostic" | "interrupted";
  startedAt: string;
  finalizedAt?: string;
  artifactPath: string;
  attemptId: string;
  evidenceDirectory: string;
  owner?: ProcessOwner;
  diagnosticPath?: string;
  completedTrials: Array<{
    caseId: string;
    trial: number;
    passed: boolean;
    artifactPath: string;
  }>;
  failure?: string;
}

function processOwner(pid: number): ProcessOwner | undefined {
  const result = Bun.spawnSync(
    ["/bin/ps", "-p", String(pid), "-o", "lstart="],
    {
      env: { PATH: "/usr/bin:/bin", LC_ALL: "C" },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const startedAt = result.stdout.toString().trim();
  return result.exitCode === 0 && startedAt
    ? { pid, startedAt, host: hostname() }
    : undefined;
}

function ownerStatus(
  owner: ProcessOwner | undefined,
): "live" | "dead" | "unknown" {
  if (
    !owner ||
    owner.host !== hostname() ||
    !Number.isInteger(owner.pid) ||
    owner.pid <= 0 ||
    !owner.startedAt
  )
    return "unknown";
  try {
    process.kill(owner.pid, 0);
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH"
      ? "dead"
      : "unknown";
  }
  const current = processOwner(owner.pid);
  if (!current) return "unknown";
  return current.startedAt === owner.startedAt ? "live" : "dead";
}

/** SQLite's OS lock serializes file claims and is released even after SIGKILL.
 * No transaction spans a trial or any asynchronous work. */
function withRecordLock<T>(path: string, action: () => T): T {
  const lockDirectory = resolve(dirname(path), "../locks");
  mkdirSync(lockDirectory, { recursive: true });
  const database = new Database(
    join(lockDirectory, `${basename(path)}.sqlite`),
  );
  try {
    database.exec("PRAGMA busy_timeout = 5000");
    database.exec("CREATE TABLE IF NOT EXISTS mutex (id INTEGER PRIMARY KEY)");
    return database.transaction(action).immediate();
  } finally {
    database.close();
  }
}

function readRecord(path: string): ActiveRunRecord | undefined {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  const record = JSON.parse(text) as ActiveRunRecord;
  if (
    record?.format !== "darrow-eval-active-run-v1" ||
    !["active", "complete", "diagnostic", "interrupted"].includes(record.status)
  )
    throw new Error(`unrecognized evaluation ownership record: ${path}`);
  return record;
}

function preservePrior(path: string, prior: ActiveRunRecord): void {
  if (prior.status === "active") {
    const status = ownerStatus(prior.owner);
    if (status === "live")
      throw new Error(`an equivalent evaluation is still active: ${path}`);
    if (status === "unknown")
      throw new Error(
        `evaluation ownership is unverifiable: ${path}; confirm the prior runner has exited, then archive this record before retrying`,
      );
    prior.status = "interrupted";
    prior.finalizedAt = new Date().toISOString();
    prior.failure =
      "the previous runner exited without finalizing this attempt";
  }
  const directory =
    prior.evidenceDirectory ??
    resolve(dirname(path), "../attempts", `legacy-${crypto.randomUUID()}`);
  mkdirSync(directory, { recursive: true });
  atomicWriteJsonSync(join(directory, "run.json"), prior);
}

function persistRecord(path: string, record: ActiveRunRecord): void {
  atomicWriteJsonSync(join(record.evidenceDirectory, "run.json"), record);
  atomicWriteJsonSync(path, record);
}

export function startActiveRun(
  path: string,
  artifactPath: string,
): ActiveRunRecord {
  return withRecordLock(path, () => {
    const prior = readRecord(path);
    if (prior) preservePrior(path, prior);
    const owner = processOwner(process.pid);
    if (!owner)
      throw new Error("cannot verify the evaluation runner's process identity");
    const attemptId = crypto.randomUUID();
    const record: ActiveRunRecord = {
      format: "darrow-eval-active-run-v1",
      status: "active",
      owner,
      startedAt: new Date().toISOString(),
      artifactPath,
      attemptId,
      evidenceDirectory: resolve(dirname(path), "../attempts", attemptId),
      completedTrials: [],
    };
    mkdirSync(record.evidenceDirectory, { recursive: true });
    persistRecord(path, record);
    return record;
  });
}

export function checkpointActiveRun(
  path: string,
  record: ActiveRunRecord,
): void {
  withRecordLock(path, () => {
    if (readRecord(path)?.attemptId !== record.attemptId)
      throw new Error(
        `evaluation ownership changed before checkpoint: ${path}`,
      );
    persistRecord(path, record);
  });
}

export function finalizeActiveRun(path: string, record: ActiveRunRecord): void {
  record.finalizedAt = new Date().toISOString();
  checkpointActiveRun(path, record);
}
