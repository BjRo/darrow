import { Client, Connection, WorkflowExecutionAlreadyStartedError, WorkflowNotFoundError } from "@temporalio/client";
import { spawn } from "node:child_process";
import { open, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { DarrowError } from "./errors";
import { exists, readJson, replaceJson, sha256 } from "./io";
import { withDirectoryLock } from "./locks";
import { globalToolchainHome } from "./paths";
import {
  continuationSignal,
  runResolvedPlanWorkflow,
  runStatusQuery,
  type WorkflowInput,
  type WorkflowStatus,
} from "./temporal-workflow";

const TEMPORAL_VERSION = "1.8.0";

interface ServiceRecord {
  schemaVersion: "0.1.0";
  pid: number;
  address: string;
  namespace: string;
  binary: string;
  version: string;
  startedAt: string;
}

interface WorkerRecord {
  schemaVersion: "0.1.0";
  pid: number;
  servicePid: number;
  address: string;
  namespace: string;
  taskQueue: string;
  startedAt: string;
}

export interface ExecutionBoundary {
  status: WorkflowStatus["state"];
  results: WorkflowStatus["results"];
  request: WorkflowStatus["request"];
  temporal: Record<string, unknown>;
  recovery?: "reattached" | "started_pending";
}

export interface ExecutionIdentity {
  workflowId: string;
  taskQueue: string;
}

export function executionIdentity(repoRoot: string, runId: string): ExecutionIdentity {
  return {
    taskQueue: `darrow-${sha256(repoRoot).slice(7, 19)}`,
    workflowId: `darrow-${sha256(repoRoot).slice(7, 15)}-${runId}`,
  };
}

function platformKey(): string {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : process.platform === "win32" ? "windows" : process.platform;
  const arch = process.arch === "x64" ? "amd64" : process.arch;
  return `${os}-${arch}`;
}

function temporalBinary(repoRoot: string): string {
  if (process.env.DARROW_TEMPORAL_BIN) return resolve(process.env.DARROW_TEMPORAL_BIN);
  const executable = process.platform === "win32" ? "temporal.exe" : "temporal";
  const local = resolve(repoRoot, ".darrow", "runtime", "toolchain", TEMPORAL_VERSION, platformKey(), executable);
  if (Bun.file(local).size > 0) return local;
  const global = resolve(globalToolchainHome(), "temporal", TEMPORAL_VERSION, platformKey(), executable);
  if (Bun.file(global).size > 0) return global;
  throw new DarrowError(`pinned Temporal ${TEMPORAL_VERSION} is not installed for ${platformKey()}; run darrow-install --scope global or --scope local`, "runtime_missing");
}

async function withRuntimeLock<T>(runtimeDir: string, operation: () => Promise<T>): Promise<T> {
  const lock = resolve(runtimeDir, "runtime.lock");
  return withDirectoryLock(lock, "Temporal runtime", operation);
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function connectable(record: ServiceRecord): Promise<boolean> {
  if (!alive(record.pid)) return false;
  try {
    const connection = await Connection.connect({ address: record.address });
    await connection.close();
    return true;
  } catch { return false; }
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((accept, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", accept);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((accept, reject) => server.close((error) => error ? reject(error) : accept()));
  if (port === 0) throw new DarrowError("cannot allocate a local Temporal port", "infrastructure");
  return port;
}

async function startService(repoRoot: string): Promise<ServiceRecord> {
  const runtimeDir = resolve(repoRoot, ".darrow", "runtime");
  await mkdir(runtimeDir, { recursive: true });
  return withRuntimeLock(runtimeDir, async () => {
    const servicePath = resolve(runtimeDir, "service.json");
    if (await exists(servicePath)) {
      const record = await readJson<ServiceRecord>(servicePath);
      if (await connectable(record)) return record;
      await rm(servicePath, { force: true });
    }
    const binary = temporalBinary(repoRoot);
    if (!(await exists(binary))) throw new DarrowError(`configured Temporal executable is unreadable: ${binary}`, "runtime_missing");
    const namespace = `darrow-${sha256(repoRoot).slice(7, 19)}`;
    const port = await availablePort();
    const address = `127.0.0.1:${port}`;
    const log = await open(resolve(runtimeDir, "temporal.log"), "a");
    const child = spawn(binary, [
      "server", "start-dev",
      "--db-filename", resolve(runtimeDir, "temporal.db"),
      "--namespace", namespace,
      "--ip", "127.0.0.1",
      "--port", String(port),
      "--headless",
      "--log-format", "json",
      "--disable-config-file",
      "--disable-config-env",
    ], { cwd: runtimeDir, detached: true, stdio: ["ignore", log.fd, log.fd] });
    child.unref();
    const record: ServiceRecord = { schemaVersion: "0.1.0", pid: child.pid!, address, namespace, binary, version: TEMPORAL_VERSION, startedAt: new Date().toISOString() };
    let ready = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (!alive(record.pid)) break;
      if (await connectable(record)) { ready = true; break; }
      await Bun.sleep(50);
    }
    await log.close();
    if (!ready) {
      try { process.kill(record.pid, "SIGTERM"); } catch { /* process already exited */ }
      throw new DarrowError(`Temporal failed to become ready at ${address}; inspect ${resolve(runtimeDir, "temporal.log")}`, "infrastructure");
    }
    await replaceJson(servicePath, record);
    return record;
  });
}

async function ensureWorker(repoRoot: string, service: ServiceRecord, taskQueue: string): Promise<WorkerRecord> {
  const runtimeDir = resolve(repoRoot, ".darrow", "runtime");
  return withRuntimeLock(runtimeDir, async () => {
    const workerPath = resolve(runtimeDir, "worker.json");
    if (await exists(workerPath)) {
      const prior = await readJson<WorkerRecord>(workerPath);
      if (alive(prior.pid) && prior.servicePid === service.pid && prior.taskQueue === taskQueue) return prior;
      if (alive(prior.pid)) try { process.kill(prior.pid, "SIGTERM"); } catch { /* process already exited */ }
      await rm(workerPath, { force: true });
    }
    const log = await open(resolve(runtimeDir, "worker.log"), "a");
    const child = spawn(process.execPath, [resolve(import.meta.dir, "worker.ts"), service.address, service.namespace, taskQueue], {
      cwd: runtimeDir,
      detached: true,
      stdio: ["ignore", log.fd, log.fd],
    });
    child.unref();
    const record: WorkerRecord = {
      schemaVersion: "0.1.0",
      pid: child.pid!,
      servicePid: service.pid,
      address: service.address,
      namespace: service.namespace,
      taskQueue,
      startedAt: new Date().toISOString(),
    };
    await Bun.sleep(250);
    await log.close();
    if (!alive(record.pid)) throw new DarrowError(`Temporal worker failed to start; inspect ${resolve(runtimeDir, "worker.log")}`, "infrastructure");
    await replaceJson(workerPath, record);
    return record;
  });
}

async function clientFor(repoRoot: string, taskQueue: string): Promise<{ client: Client; connection: Connection; service: ServiceRecord }> {
  const service = await startService(repoRoot);
  await ensureWorker(repoRoot, service, taskQueue);
  const connection = await Connection.connect({ address: service.address });
  return { client: new Client({ connection, namespace: service.namespace }), connection, service };
}

export async function waitForBoundary(handle: ReturnType<Client["workflow"]["getHandle"]>, temporal: Record<string, unknown>): Promise<ExecutionBoundary> {
  let consecutiveErrors = 0;
  while (true) {
    try {
      const status = await handle.query(runStatusQuery);
      if (status.state === "waiting_for_input") return { status: status.state, results: status.results, request: status.request, temporal };
      if (status.state === "completed") {
        const results = await handle.result();
        return { status: "completed", results, request: null, temporal };
      }
      consecutiveErrors = 0;
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) throw error;
      consecutiveErrors += 1;
      try {
        const description = await handle.describe();
        if (description.status.name !== "RUNNING") {
          try {
            const results = await handle.result();
            return { status: "completed", results, request: null, temporal };
          } catch (resultError) {
            throw new DarrowError(`Temporal workflow closed as ${description.status.name}: ${resultError instanceof Error ? resultError.message : String(resultError)}`, "infrastructure");
          }
        }
      } catch (describeError) {
        if (describeError instanceof DarrowError) throw describeError;
        if (consecutiveErrors >= 50) throw new DarrowError(`lost contact with Temporal while waiting: ${describeError instanceof Error ? describeError.message : String(describeError)}`, "infrastructure");
      }
    }
    await Bun.sleep(100);
  }
}

export async function executePlan(input: WorkflowInput, onStarted?: (temporal: Record<string, unknown>) => Promise<void>): Promise<ExecutionBoundary> {
  const { taskQueue, workflowId } = executionIdentity(input.repoRoot, input.runId);
  const runtime = await clientFor(input.repoRoot, taskQueue);
  try {
    const handle = await runtime.client.workflow.start(runResolvedPlanWorkflow, {
      workflowId,
      taskQueue,
      args: [input],
    });
    const temporal = { workflowId, namespace: runtime.service.namespace, address: runtime.service.address, taskQueue, runId: handle.firstExecutionRunId, startPending: false };
    await onStarted?.(temporal);
    return await waitForBoundary(handle, temporal);
  } finally { await runtime.connection.close(); }
}

export async function reconcileWorkflowHandle(
  workflow: Pick<Client["workflow"], "getHandle" | "start">,
  workflowId: string,
  taskQueue: string,
  input: WorkflowInput | undefined,
  startPending: boolean,
): Promise<{ handle: ReturnType<Client["workflow"]["getHandle"]>; runId: string; recovery: "reattached" | "started_pending" }> {
  let handle = workflow.getHandle(workflowId);
  try {
    const description = await handle.describe();
    return { handle, runId: description.runId, recovery: "reattached" };
  } catch (error) {
    if (!(error instanceof WorkflowNotFoundError)) throw error;
    if (!startPending) throw new DarrowError(`confirmed Temporal workflow is missing: ${workflowId}`, "recovery");
    if (!input) throw new DarrowError(`pending Temporal workflow cannot be started without its immutable input: ${workflowId}`, "recovery");
  }
  try {
    handle = await workflow.start(runResolvedPlanWorkflow, { workflowId, taskQueue, args: [input] });
    const description = await handle.describe();
    return { handle, runId: description.runId, recovery: "started_pending" };
  } catch (error) {
    if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error;
    handle = workflow.getHandle(workflowId);
    const description = await handle.describe();
    return { handle, runId: description.runId, recovery: "reattached" };
  }
}

export async function resumePlan(repoRoot: string, temporal: Record<string, unknown>, input?: WorkflowInput): Promise<ExecutionBoundary> {
  const workflowId = String(temporal.workflowId ?? "");
  const taskQueue = String(temporal.taskQueue ?? "");
  if (!workflowId || !taskQueue) throw new DarrowError("run has no resumable Temporal execution", "state");
  const runtime = await clientFor(repoRoot, taskQueue);
  try {
    const reconciled = await reconcileWorkflowHandle(runtime.client.workflow, workflowId, taskQueue, input, temporal.startPending === true);
    const current = {
      ...temporal,
      workflowId,
      namespace: runtime.service.namespace,
      address: runtime.service.address,
      taskQueue,
      runId: reconciled.runId,
      startPending: false,
    };
    return { ...await waitForBoundary(reconciled.handle, current), recovery: reconciled.recovery };
  }
  finally { await runtime.connection.close(); }
}

export async function continuePlan(repoRoot: string, temporal: Record<string, unknown>, version: number, choice: "retry" | "amend" | "abort", model?: string): Promise<ExecutionBoundary> {
  const workflowId = String(temporal.workflowId ?? "");
  const taskQueue = String(temporal.taskQueue ?? "");
  if (!workflowId || !taskQueue) throw new DarrowError("run has no continuable Temporal execution", "state");
  const runtime = await clientFor(repoRoot, taskQueue);
  try {
    const handle = runtime.client.workflow.getHandle(workflowId);
    const status = await handle.query(runStatusQuery);
    if (status.state !== "waiting_for_input" || !status.request) throw new DarrowError("Temporal workflow is not waiting for input", "state");
    if (status.request.version !== version) throw new DarrowError(`stale continuation version ${version}; current version is ${status.request.version}`, "state");
    if (!status.request.choices.includes(choice)) throw new DarrowError(`continuation ${choice} is not allowed for ${status.request.reason}`, "state");
    if (choice === "amend" && !model) throw new DarrowError("model amendment requires an explicit model", "usage");
    await handle.signal(continuationSignal, { version, choice, model });
    return await waitForBoundary(handle, temporal);
  } finally { await runtime.connection.close(); }
}

export async function describeWorkflow(repoRoot: string, temporal: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const servicePath = resolve(repoRoot, ".darrow", "runtime", "service.json");
  if (!(await exists(servicePath)) || typeof temporal.workflowId !== "string") return null;
  const record = await readJson<ServiceRecord>(servicePath);
  if (!(await connectable(record))) return null;
  const connection = await Connection.connect({ address: record.address });
  try {
    const client = new Client({ connection, namespace: String(temporal.namespace) });
    const description = await client.workflow.getHandle(temporal.workflowId).describe();
    return { status: description.status.name, startTime: description.startTime.toISOString(), closeTime: description.closeTime?.toISOString() ?? null, runId: description.runId };
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) return null;
    throw error;
  } finally { await connection.close(); }
}
