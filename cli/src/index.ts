#!/usr/bin/env bun
import { chmod, mkdir, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { compile, createLock, snapshot, verifyRunSnapshot } from "./compiler";
import { verifyArtifacts } from "./artifacts";
import { DarrowError } from "./errors";
import { exists, readJson, writeJson } from "./io";
import {
  allocateWorktree,
  claimCurrentWorkspace,
  currentWorktreeRoot,
  initRepository,
  isDirty,
  newRunId,
  pinnedCommit,
  primaryRepoRoot,
  releaseCurrentWorkspace,
  requireInitialized,
  withAllocationLock,
} from "./repository";
import { event, readRun, saveRun } from "./state";
import { continuePlan, describeWorkflow, executePlan, resumePlan, type ExecutionBoundary } from "./temporal";
import { validateSchema } from "./schema";
import type { Conclusion, ResolvedPlan, RunRecord } from "./types";

interface RunOptions {
  workflow: string;
  inputs: Record<string, unknown>;
  base?: string;
  workspace?: "current";
  worktree?: string;
  json: boolean;
}

function usage(): string {
  return [
    "darrow 0.1.0 (CLI protocol 0.1.0)", "", "Usage:",
    "  darrow init [--json]",
    "  darrow run <workflow|path> --input <name=value> [--base <ref>] [--workspace current|--worktree <path>] [--json]",
    "  darrow run implement-change --change <description> [--base <ref>] [--json]",
    "  darrow continue <run-id> --choice head|current|retry|amend|abort [--model <id>] [--json]",
    "  darrow resume <run-id> [--json]",
    "  darrow inspect <run-id> [--json]",
    "  darrow --version", "",
    "Install the pinned Temporal executable explicitly with darrow-install --scope global|local.",
  ].join("\n");
}

function parseValue(value: string): string | boolean | number {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) return Number(value);
  return value;
}

function parseRun(args: string[]): RunOptions {
  const workflow = args.shift();
  if (!workflow) throw new DarrowError("run requires a workflow name or path", "usage");
  const options: RunOptions = { workflow, inputs: {}, json: false };
  while (args.length > 0) {
    const flag = args.shift()!;
    if (flag === "--json") options.json = true;
    else if (flag === "--input") {
      const assignment = args.shift();
      const index = assignment?.indexOf("=") ?? -1;
      if (!assignment || index < 1) throw new DarrowError("--input requires name=value", "usage");
      options.inputs[assignment.slice(0, index)] = parseValue(assignment.slice(index + 1));
    } else if (flag === "--change") {
      const change = args.shift();
      if (!change) throw new DarrowError("--change requires a description", "usage");
      options.inputs.change = change;
    } else if (flag === "--base") {
      options.base = args.shift();
      if (!options.base) throw new DarrowError("--base requires a Git ref", "usage");
    } else if (flag === "--workspace") {
      const workspace = args.shift();
      if (workspace !== "current") throw new DarrowError("M1 supports only --workspace current", "usage");
      options.workspace = workspace;
    } else if (flag === "--worktree") {
      options.worktree = args.shift();
      if (!options.worktree) throw new DarrowError("--worktree requires an exact path", "usage");
    } else throw new DarrowError(`unknown run argument: ${flag}`, "usage");
  }
  if (options.workspace && options.worktree) throw new DarrowError("--workspace and --worktree are mutually exclusive", "usage");
  return options;
}

function parseContinuation(args: string[]): { runId: string; choice: string; model?: string; json: boolean } {
  const runId = args.shift();
  if (!runId) throw new DarrowError("continue requires a run ID", "usage");
  let choice = "";
  let model: string | undefined;
  let json = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--json") json = true;
    else if (flag === "--choice") choice = args.shift() ?? "";
    else if (flag === "--model") model = args.shift() ?? "";
    else throw new DarrowError(`unknown continue argument: ${flag}`, "usage");
  }
  return { runId, choice, model, json };
}

async function emitJson(command: "init" | "run" | "continue" | "resume" | "inspect", ok: boolean, data: Record<string, unknown> | null, error: { category: string; message: string } | null): Promise<void> {
  const output = { protocolVersion: "0.1.0", command, ok, data, error };
  await validateSchema("protocol.schema.json", output, `${command} output`);
  console.log(JSON.stringify(output));
}

async function initialize(json: boolean): Promise<void> {
  const root = await initRepository();
  const data = { repository: root, stateDirectory: resolve(root, ".darrow") };
  if (json) await emitJson("init", true, data, null);
  else console.log(`Initialized Darrow in ${data.stateDirectory}`);
}

async function createInitialRun(runDir: string, runId: string, workflowId: string): Promise<RunRecord> {
  const now = new Date().toISOString();
  const record: RunRecord = { schemaVersion: "0.1.0", runId, workflowId, state: "running", conclusion: null, createdAt: now, updatedAt: now, temporal: {}, workspace: null, currentStep: null, error: null };
  await validateSchema("run.schema.json", record, "initial run record");
  await writeJson(resolve(runDir, "run.json"), record);
  return record;
}

async function stageRun(repoRoot: string, runId: string, workflowId: string, compilation: Awaited<ReturnType<typeof compile>>): Promise<{ runDir: string; record: RunRecord; snapshotDir: string }> {
  const finalDir = resolve(repoRoot, ".darrow", "runs", runId);
  const stagingDir = resolve(repoRoot, ".darrow", "runs", `.staging-${runId}`);
  try {
    for (const name of ["content", "artifacts", "results"]) await mkdir(resolve(stagingDir, name), { recursive: true });
    const record = await createInitialRun(stagingDir, runId, workflowId);
    await writeJson(resolve(stagingDir, "plan.json"), compilation.plan);
    await writeJson(resolve(stagingDir, "lock.json"), await createLock(compilation, runId));
    await chmod(resolve(stagingDir, "plan.json"), 0o444);
    await chmod(resolve(stagingDir, "lock.json"), 0o444);
    await snapshot(compilation, stagingDir);
    await rename(stagingDir, finalDir);
    return { runDir: finalDir, record, snapshotDir: resolve(finalDir, "snapshot") };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

async function printWaiting(record: RunRecord, json: boolean, command: "run" | "continue" | "resume" = "run"): Promise<void> {
  const dirty = record.error?.category === "dirty_checkout";
  const request = record.temporal.request as { choices?: string[] } | undefined;
  const choices = dirty ? ["head", "current", "abort"] : request?.choices ?? ["retry", "abort"];
  const data = { runId: record.runId, state: record.state, reason: record.error?.message, choices, continuation: `darrow continue ${record.runId}` };
  if (json) await emitJson(command, true, data, null);
  else console.log(`Run: ${record.runId}\nState: waiting_for_input\nReason: ${record.error?.message}\nChoices: ${choices.join(", ")}\nContinue: ${data.continuation}`);
}

async function releaseAttachment(repoRoot: string, record: RunRecord): Promise<void> {
  if (record.workspace && record.temporal.attached === true) await releaseCurrentWorkspace(repoRoot, record.runId, record.workspace);
}

async function applyBoundary(repoRoot: string, runDir: string, record: RunRecord, boundary: ExecutionBoundary, cancelled = false): Promise<void> {
  record.temporal = { ...record.temporal, ...boundary.temporal, request: boundary.request };
  if (boundary.status === "waiting_for_input") {
    record.state = "waiting_for_input";
    const reason = boundary.request?.reason ?? "model_unavailable";
    record.error = { category: reason, message: reason === "uncertain_activity" ? "the effectful activity ended without a trustworthy outcome" : "the selected Codex model is currently unavailable" };
    await event(runDir, record.runId, "human.input.requested", boundary.request ?? {});
  } else {
    const terminal = boundary.results.at(-1);
    record.state = "completed";
    record.conclusion = cancelled ? "cancelled" : terminal?.status === "failed" ? "failed" : "succeeded";
    record.error = cancelled ? null : terminal?.error ?? null;
    record.currentStep = null;
    await event(runDir, record.runId, "run.completed", { conclusion: record.conclusion, results: boundary.results.map((item) => ({ invocationId: item.invocationId, status: item.status, artifacts: item.artifacts })) });
    await releaseAttachment(repoRoot, record);
  }
  await saveRun(runDir, record);
}

async function executeStarted(repoRoot: string, runDir: string, record: RunRecord, plan: ResolvedPlan): Promise<ExecutionBoundary> {
  const snapshotDir = resolve(runDir, "snapshot");
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  return executePlan({ runId: record.runId, repoRoot, runDir, workspace: record.workspace!, snapshotDir, plan }, async (temporal) => {
    record.temporal = { ...record.temporal, ...temporal };
    await saveRun(runDir, record);
    await event(runDir, record.runId, "run.started", { temporal, workspace: record.workspace });
  });
}

async function presentResult(command: "run" | "continue" | "resume", record: RunRecord, results: ExecutionBoundary["results"], json: boolean): Promise<number> {
  if (record.state === "waiting_for_input") { await printWaiting(record, json, command); return 0; }
  const data = { runId: record.runId, state: record.state, conclusion: record.conclusion, workspace: record.workspace, results };
  if (json) await emitJson(command, record.conclusion !== "failed", data, record.error);
  else console.log(`Run ${record.runId} ${record.conclusion}\nWorkspace: ${record.workspace ?? "(none)"}\nInspect: darrow inspect ${record.runId}`);
  return record.conclusion === "failed" ? 1 : 0;
}

async function runWorkflow(options: RunOptions): Promise<number> {
  const invokedRoot = currentWorktreeRoot();
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const compilation = await compile(repoRoot, options.workflow, options.inputs);
  const commit = pinnedCommit(invokedRoot, options.base);
  const runId = newRunId();
  const staged = await stageRun(repoRoot, runId, compilation.workflow.id, compilation);
  const { runDir, record } = staged;
  await event(runDir, runId, "workflow.compiled", { workflow: compilation.plan.workflow, planDigest: compilation.plan.digest });
  await event(runDir, runId, "dependencies.resolved", { commands: compilation.plan.steps.map((step) => step.commandId), capabilities: compilation.plan.capabilities });
  if (isDirty(invokedRoot) && !options.base && !options.workspace) {
    record.state = "waiting_for_input";
    record.error = { category: "dirty_checkout", message: "the invoking checkout has uncommitted changes" };
    record.temporal = { pending: { kind: "dirty_checkout", commit, invokedRoot } };
    await saveRun(runDir, record);
    await event(runDir, runId, "human.input.requested", { reason: "dirty_checkout", choices: ["head", "current", "abort"], version: 1 });
    await printWaiting(record, options.json);
    return 0;
  }
  try {
    if (options.workspace === "current") {
      await claimCurrentWorkspace(repoRoot, runId, invokedRoot);
      record.workspace = invokedRoot;
      record.temporal = { attached: true };
    } else record.workspace = await withAllocationLock(repoRoot, () => allocateWorktree(repoRoot, runId, commit, options.worktree));
    record.currentStep = compilation.plan.steps[0]?.id ?? null;
    await saveRun(runDir, record);
    await event(runDir, runId, "workspace.allocated", { workspace: record.workspace, commit, attached: options.workspace === "current" });
    const boundary = await executeStarted(repoRoot, runDir, record, compilation.plan);
    await applyBoundary(repoRoot, runDir, record, boundary);
    return await presentResult("run", record, boundary.results, options.json);
  } catch (error) {
    record.state = "completed";
    record.conclusion = "failed";
    record.error = { category: error instanceof DarrowError ? error.category : "infrastructure", message: error instanceof Error ? error.message : String(error) };
    record.currentStep = null;
    await releaseAttachment(repoRoot, record);
    await saveRun(runDir, record);
    await event(runDir, runId, "run.completed", { conclusion: "failed", error: record.error });
    if (options.json) await emitJson("run", false, { runId, state: record.state, conclusion: record.conclusion }, record.error);
    else console.error(`Run ${runId} failed: ${record.error.message}\nInspect: darrow inspect ${runId}`);
    return 1;
  }
}

async function continueRun(runId: string, choice: string, json: boolean, model?: string): Promise<number> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  const record = await readRun(runDir);
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  if (record.state !== "waiting_for_input") throw new DarrowError(`run is not waiting for input: ${runId}`, "state");
  if (!choice) {
    if (json || !process.stdin.isTTY) throw new DarrowError("continue requires --choice in non-interactive mode", "usage");
    choice = globalThis.prompt("Continuation choice:")?.trim() ?? "";
    if (!choice) throw new DarrowError("no continuation choice supplied", "usage");
  }
  await event(runDir, runId, "human.input.received", { choice, ...(model ? { model } : {}) });
  const pending = record.temporal.pending as { kind?: string; commit?: string; invokedRoot?: string } | undefined;
  if (pending?.kind === "dirty_checkout") {
    if (!['head', 'current', 'abort'].includes(choice)) throw new DarrowError("dirty-checkout continuation requires head, current, or abort", "usage");
    if (choice === "abort") {
      record.state = "completed"; record.conclusion = "cancelled"; record.error = null; record.temporal = {};
      await saveRun(runDir, record); await event(runDir, runId, "run.completed", { conclusion: "cancelled" });
      return presentResult("continue", record, [], json);
    }
    const workspace = choice === "current" ? resolve(pending.invokedRoot!) : await withAllocationLock(repoRoot, () => allocateWorktree(repoRoot, runId, String(pending.commit)));
    if (choice === "current") await claimCurrentWorkspace(repoRoot, runId, workspace);
    record.workspace = workspace;
    record.temporal = choice === "current" ? { attached: true } : {};
    record.state = "running"; record.error = null; record.currentStep = plan.steps[0]?.id ?? null;
    await saveRun(runDir, record);
    await event(runDir, runId, "workspace.allocated", { workspace, commit: pending.commit, attached: choice === "current" });
    const boundary = await executeStarted(repoRoot, runDir, record, plan);
    await applyBoundary(repoRoot, runDir, record, boundary);
    return presentResult("continue", record, boundary.results, json);
  }
  const allowed = (record.temporal.request as { choices?: string[] } | undefined)?.choices ?? ["retry", "abort"];
  if (!allowed.includes(choice)) throw new DarrowError(`continuation requires one of: ${allowed.join(", ")}`, "usage");
  const request = record.temporal.request as { version?: number } | undefined;
  const boundary = await continuePlan(repoRoot, record.temporal, Number(request?.version), choice as "retry" | "amend" | "abort", model);
  await applyBoundary(repoRoot, runDir, record, boundary, choice === "abort");
  return presentResult("continue", record, boundary.results, json);
}

async function resumeRun(runId: string, json: boolean): Promise<number> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  const record = await readRun(runDir);
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  if (!record.temporal.workflowId) throw new DarrowError(`run has no started Temporal workflow: ${runId}`, "state");
  const boundary = await resumePlan(repoRoot, record.temporal);
  await applyBoundary(repoRoot, runDir, record, boundary);
  return presentResult("resume", record, boundary.results, json);
}

async function inspectRun(runId: string, json: boolean): Promise<void> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  if (!(await exists(runDir))) throw new DarrowError(`run not found: ${runId}`, "not_found");
  const record = await readRun(runDir);
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  const temporal = record.state === "completed" || !record.temporal.workflowId ? null : await describeWorkflow(repoRoot, record.temporal);
  const eventsPath = resolve(runDir, "events.jsonl");
  const eventCount = (await exists(eventsPath)) ? (await Bun.file(eventsPath).text()).split("\n").filter(Boolean).length : 0;
  const results = (await readdir(resolve(runDir, "results"))).filter((name) => name.endsWith(".json"));
  const data = { ...record, liveTemporal: temporal, paths: { run: runDir, plan: resolve(runDir, "plan.json"), lock: resolve(runDir, "lock.json"), snapshot: resolve(runDir, "snapshot"), workspace: record.workspace }, counts: { events: eventCount, results: results.length } };
  if (json) await emitJson("inspect", true, data, null);
  else console.log(`Run: ${runId}\nState: ${record.state}\nConclusion: ${record.conclusion ?? "(none)"}\nWorkflow: ${record.workflowId}\nWorkspace: ${record.workspace ?? "(not allocated)"}\nEvents: ${eventCount}\nResults: ${results.length}\nRun record: ${runDir}`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (!command || command === "help" || command === "--help" || command === "-h") { console.log(usage()); return 0; }
  if (command === "--version" || command === "-V") { console.log("darrow 0.1.0"); return 0; }
  if (command === "init") {
    const json = args.length === 1 && args[0] === "--json";
    if (args.length > (json ? 1 : 0)) throw new DarrowError(`unknown init argument: ${args[0]}`, "usage");
    await initialize(json); return 0;
  }
  if (command === "run") return runWorkflow(parseRun(args));
  if (command === "continue") { const parsed = parseContinuation(args); return continueRun(parsed.runId, parsed.choice, parsed.json, parsed.model); }
  if (command === "resume") {
    const runId = args.shift(); if (!runId) throw new DarrowError("resume requires a run ID", "usage");
    const json = args.length === 1 && args[0] === "--json"; if (args.length > (json ? 1 : 0)) throw new DarrowError(`unknown resume argument: ${args[0]}`, "usage");
    return resumeRun(runId, json);
  }
  if (command === "inspect") {
    const runId = args.shift(); if (!runId) throw new DarrowError("inspect requires a run ID", "usage");
    const json = args.length === 1 && args[0] === "--json"; if (args.length > (json ? 1 : 0)) throw new DarrowError(`unknown inspect argument: ${args[0]}`, "usage");
    await inspectRun(runId, json); return 0;
  }
  throw new DarrowError(`unknown command: ${command}\n${usage()}`, "usage");
}

main().then((code) => { process.exitCode = code; }).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode = error instanceof DarrowError ? error.exitCode : 1;
});
