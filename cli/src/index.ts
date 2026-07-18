#!/usr/bin/env bun
import { chmod, mkdir, readdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareRouteAmendment } from "./amendments";
import { compile, createLock, snapshot, verifyRunSnapshot } from "./compiler";
import { verifyArtifacts } from "./artifacts";
import {
  cleanRepository,
  cleanedTicketPublicationIds,
  cleanupUnavailable,
  readCleanupRecord,
  type CleanupFilters,
  type CleanupResult,
  type CleanupSelection,
} from "./cleanup";
import { DarrowError } from "./errors";
import {
  assertCurrentRequest,
  createHumanRequest,
  readHumanInstructions,
  selectedChoice,
  storeHumanInstructions,
  storeHumanRationale,
} from "./human";
import { exists, readJson, readText, writeJson } from "./io";
import { withDirectoryLock } from "./locks";
import {
  readTicketPublicationEvents,
  verifyPublishedArtifacts,
} from "./publication";
import {
  allocateManagedWorkspace,
  claimCurrentWorkspace,
  currentWorktreeRoot,
  initRepository,
  isDirty,
  ownedWorkspaceForRun,
  pinnedCommit,
  primaryRepoRoot,
  releaseWorkspace,
  reserveRunDirectory,
  requireInitialized,
  withRepositoryCoordination,
} from "./repository";
import { event, readRun, saveRun } from "./state";
import {
  cancelPlan,
  continuePlan,
  describeWorkflow,
  executePlan,
  executionIdentity,
  resumePlan,
  type ExecutionBoundary,
} from "./temporal";
import { validateSchema } from "./schema";
import type {
  CancellationSummary,
  Conclusion,
  HumanResponse,
  ResolvedPlan,
  RunRecord,
} from "./types";

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
    "darrow 0.1.0 (CLI protocol 0.1.0)",
    "",
    "Usage:",
    "  darrow init [--json]",
    "  darrow run <workflow|path> --input <name=value> [--base <ref>] [--workspace current|--worktree <path>] [--json]",
    "  darrow run implement-change --change <description> [--base <ref>] [--json]",
    "  darrow continue <run-id> --request <id> --version <n> --choice <choice> [--profile <id>] [--instructions-file <path|->] [--rationale-file <path|->] [--actor <id>] [--harness <id>] [--json]",
    "  darrow resume <run-id> [--json]",
    "  darrow cancel <run-id> [--json]",
    "  darrow inspect <run-id> [--json]",
    "  darrow clean [--run <run-id>] [--older-than <duration>] [--run-data] [--worktrees] [--tickets] [--json]",
    "  darrow --version",
    "",
    "Install the pinned Temporal executable explicitly with darrow-install --scope global|local.",
  ].join("\n");
}

function parseDuration(value: string): number {
  const match = /^([1-9][0-9]*)([smhdw])$/.exec(value);
  if (!match)
    throw new DarrowError(
      "--older-than requires a positive duration such as 12h, 30d, or 8w",
      "usage",
    );
  const units = { s: 1, m: 60, h: 3_600, d: 86_400, w: 604_800 };
  const seconds = Number(match[1]) * units[match[2] as keyof typeof units];
  if (!Number.isSafeInteger(seconds))
    throw new DarrowError("--older-than duration is too large", "usage");
  return seconds;
}

function parseClean(args: string[]): {
  filters: CleanupFilters;
  selection: CleanupSelection;
  json: boolean;
} {
  const filters: CleanupFilters = { runId: null, olderThanSeconds: null };
  const selection: CleanupSelection = {
    runData: false,
    worktrees: false,
    tickets: false,
  };
  let json = false;
  while (args.length > 0) {
    const flag = args.shift();
    if (flag === "--json") json = true;
    else if (flag === "--run") {
      filters.runId = args.shift() ?? "";
      if (!filters.runId)
        throw new DarrowError("--run requires a run ID", "usage");
    } else if (flag === "--older-than") {
      const duration = args.shift();
      if (!duration)
        throw new DarrowError("--older-than requires a duration", "usage");
      filters.olderThanSeconds = parseDuration(duration);
    } else if (flag === "--run-data") selection.runData = true;
    else if (flag === "--worktrees") selection.worktrees = true;
    else if (flag === "--tickets") selection.tickets = true;
    else throw new DarrowError(`unknown clean argument: ${flag}`, "usage");
  }
  return { filters, selection, json };
}

function parseValue(value: string): string | boolean | number {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) return Number(value);
  return value;
}

function parseRun(args: string[]): RunOptions {
  const workflow = args.shift();
  if (!workflow)
    throw new DarrowError("run requires a workflow name or path", "usage");
  const options: RunOptions = { workflow, inputs: {}, json: false };
  while (args.length > 0) {
    const flag = args.shift()!;
    if (flag === "--json") options.json = true;
    else if (flag === "--input") {
      const assignment = args.shift();
      const index = assignment?.indexOf("=") ?? -1;
      if (!assignment || index < 1)
        throw new DarrowError("--input requires name=value", "usage");
      options.inputs[assignment.slice(0, index)] = parseValue(
        assignment.slice(index + 1),
      );
    } else if (flag === "--change") {
      const change = args.shift();
      if (!change)
        throw new DarrowError("--change requires a description", "usage");
      options.inputs.change = change;
    } else if (flag === "--base") {
      options.base = args.shift();
      if (!options.base)
        throw new DarrowError("--base requires a Git ref", "usage");
    } else if (flag === "--workspace") {
      const workspace = args.shift();
      if (workspace !== "current")
        throw new DarrowError("M1 supports only --workspace current", "usage");
      options.workspace = workspace;
    } else if (flag === "--worktree") {
      options.worktree = args.shift();
      if (!options.worktree)
        throw new DarrowError("--worktree requires an exact path", "usage");
    } else throw new DarrowError(`unknown run argument: ${flag}`, "usage");
  }
  if (options.workspace && options.worktree)
    throw new DarrowError(
      "--workspace and --worktree are mutually exclusive",
      "usage",
    );
  return options;
}

function parseContinuation(args: string[]): {
  runId: string;
  choice: string;
  requestId?: string;
  version?: number;
  instructionsFile?: string;
  rationaleFile?: string;
  actor?: string;
  harness?: string;
  profile?: string;
  json: boolean;
} {
  const runId = args.shift();
  if (!runId) throw new DarrowError("continue requires a run ID", "usage");
  let choice = "";
  let requestId: string | undefined;
  let version: number | undefined;
  let instructionsFile: string | undefined;
  let rationaleFile: string | undefined;
  let actor: string | undefined;
  let harness: string | undefined;
  let profile: string | undefined;
  let json = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--json") json = true;
    else if (flag === "--choice") choice = args.shift() ?? "";
    else if (flag === "--request") requestId = args.shift() ?? "";
    else if (flag === "--version") {
      const value = args.shift() ?? "";
      version = Number(value);
      if (!Number.isSafeInteger(version) || version < 1)
        throw new DarrowError("--version requires a positive integer", "usage");
    } else if (flag === "--instructions-file")
      instructionsFile = args.shift() ?? "";
    else if (flag === "--rationale-file") rationaleFile = args.shift() ?? "";
    else if (flag === "--actor") actor = args.shift() ?? "";
    else if (flag === "--harness") harness = args.shift() ?? "";
    else if (flag === "--profile") profile = args.shift() ?? "";
    else throw new DarrowError(`unknown continue argument: ${flag}`, "usage");
  }
  return {
    runId,
    choice,
    requestId,
    version,
    instructionsFile,
    rationaleFile,
    actor,
    harness,
    profile,
    json,
  };
}

async function emitJson(
  command:
    "init" | "run" | "continue" | "resume" | "cancel" | "inspect" | "clean",
  ok: boolean,
  data: object | null,
  error: { category: string; message: string } | null,
): Promise<void> {
  const output = { protocolVersion: "0.1.0", command, ok, data, error };
  await validateSchema("protocol.schema.json", output, `${command} output`);
  console.log(JSON.stringify(output));
}

async function clean(
  filters: CleanupFilters,
  selection: CleanupSelection,
  json: boolean,
): Promise<number> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const result = await cleanRepository(repoRoot, filters, selection);
  const refused = result.blockers.length > 0;
  const error = refused
    ? {
        category: "cleanup_refused",
        message: `refusing cleanup of ${result.blockers.map((item) => `${item.resourceId} (${item.reason})`).join(", ")}`,
      }
    : null;
  if (json) await emitJson("clean", !refused, result, error);
  else printCleanup(result, error?.message ?? null);
  return refused ? 2 : 0;
}

function printCleanup(result: CleanupResult, error: string | null): void {
  const lines = [
    `Cleanup mode: ${result.mode}`,
    ...result.items.map(
      (item) =>
        `${item.eligible ? "eligible" : "protected"} ${item.resourceId} state=${item.runState} age=${item.ageSeconds}s size=${item.size} reference=${item.referenceStatus} action=${item.proposedAction}${item.reason ? ` reason=${item.reason}` : ""} path=${item.path}`,
    ),
  ];
  if (result.deleted.length > 0)
    lines.push(`Deleted: ${result.deleted.join(", ")}`);
  if (error) lines.push(`Refused: ${error}`);
  console.log(lines.join("\n"));
}

async function initialize(json: boolean): Promise<void> {
  const root = await initRepository();
  const data = { repository: root, stateDirectory: resolve(root, ".darrow") };
  if (json) await emitJson("init", true, data, null);
  else console.log(`Initialized Darrow in ${data.stateDirectory}`);
}

async function createInitialRun(
  runDir: string,
  runId: string,
  workflowId: string,
  plan: ResolvedPlan,
): Promise<RunRecord> {
  const now = new Date().toISOString();
  const record: RunRecord = {
    schemaVersion: "0.1.0",
    runId,
    workflowId,
    state: "running",
    conclusion: null,
    createdAt: now,
    updatedAt: now,
    temporal: {},
    workspace: null,
    currentStep: null,
    steps: plan.steps.map((step) => ({
      stepId: step.id,
      state: "pending",
      attempt: 0,
    })),
    request: null,
    waivers: [],
    amendments: [],
    cancellation: null,
    error: null,
  };
  await validateSchema("run.schema.json", record, "initial run record");
  await writeJson(resolve(runDir, "run.json"), record);
  return record;
}

async function stageRun(
  repoRoot: string,
  workflowId: string,
  compilation: Awaited<ReturnType<typeof compile>>,
): Promise<{
  runId: string;
  runDir: string;
  record: RunRecord;
  snapshotDir: string;
}> {
  const { runId, stagingDir } = await reserveRunDirectory(repoRoot);
  const finalDir = resolve(repoRoot, ".darrow", "runs", runId);
  try {
    for (const name of ["content", "artifacts", "results"])
      await mkdir(resolve(stagingDir, name), { recursive: true });
    const record = await createInitialRun(
      stagingDir,
      runId,
      workflowId,
      compilation.plan,
    );
    await writeJson(resolve(stagingDir, "plan.json"), compilation.plan);
    await writeJson(
      resolve(stagingDir, "lock.json"),
      await createLock(compilation, runId),
    );
    await chmod(resolve(stagingDir, "plan.json"), 0o444);
    await chmod(resolve(stagingDir, "lock.json"), 0o444);
    await snapshot(compilation, stagingDir);
    await rename(stagingDir, finalDir);
    return {
      runId,
      runDir: finalDir,
      record,
      snapshotDir: resolve(finalDir, "snapshot"),
    };
  } catch (error) {
    await rm(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

async function printWaiting(
  record: RunRecord,
  json: boolean,
  command: "run" | "continue" | "resume" | "cancel" = "run",
): Promise<void> {
  const request = record.request;
  if (!request)
    throw new DarrowError(
      `run ${record.runId} is waiting without a human request`,
      "state",
    );
  const data = {
    runId: record.runId,
    state: record.state,
    request,
    continuation: `darrow continue ${record.runId}`,
  };
  if (json) await emitJson(command, true, data, null);
  else {
    const lines = [
      `Run: ${record.runId}`,
      `Step: ${request.stepId ?? "(run setup)"}`,
      `Reason: ${request.reason}`,
      `Question: ${request.question}`,
      "Choices:",
      ...request.choices.map(
        (choice) => `  ${choice.id}: ${choice.consequence}`,
      ),
      "Context:",
      ...(request.context.length > 0
        ? request.context.map((item) => `  ${item.label}: ${item.reference}`)
        : ["  (none)"]),
      `Continue: ${data.continuation}`,
    ];
    console.log(lines.join("\n"));
  }
}

async function releaseOwnership(
  repoRoot: string,
  record: RunRecord,
): Promise<void> {
  if (record.workspace)
    await releaseWorkspace(repoRoot, record.runId, record.workspace);
}

async function verifyWaiverContent(
  repoRoot: string,
  runDir: string,
  record: Pick<RunRecord, "waivers">,
): Promise<void> {
  for (const waiver of record.waivers) {
    await readHumanInstructions(repoRoot, runDir, waiver.rationale);
    if (waiver.instructions)
      await readHumanInstructions(repoRoot, runDir, waiver.instructions);
  }
}

async function applyBoundary(
  repoRoot: string,
  runDir: string,
  record: RunRecord,
  boundary: ExecutionBoundary,
): Promise<void> {
  await verifyPublishedArtifacts(repoRoot, boundary.publications);
  await withDirectoryLock(
    resolve(runDir, "state.lock"),
    `run ${record.runId} state`,
    async () => {
      const current = await readRun(runDir);
      if (current.state === "completed") {
        Object.assign(record, current);
        return;
      }
      const previousRequest = current.request;
      const previousWaivers = new Set(
        current.waivers.map((waiver) => waiver.waiverId),
      );
      const previousAmendments = new Set(
        current.amendments.map((amendment) => amendment.amendmentId),
      );
      const previousCancellation = current.cancellation;
      const recordedPublicationIds = new Set(
        (await readTicketPublicationEvents(runDir)).flatMap((publication) =>
          publication.artifacts.map((artifact) => artifact.publicationId),
        ),
      );
      await verifyWaiverContent(repoRoot, runDir, boundary);
      Object.assign(record, current);
      record.temporal = {
        ...current.temporal,
        ...boundary.temporal,
      };
      record.request = boundary.request;
      record.waivers = boundary.waivers;
      record.amendments = boundary.amendments;
      record.cancellation = boundary.cancellation ?? current.cancellation;
      if (!previousCancellation && record.cancellation)
        await event(runDir, record.runId, "run.cancel.requested", {
          requestedAt: record.cancellation.requestedAt,
        });
      for (const waiver of boundary.waivers)
        if (!previousWaivers.has(waiver.waiverId))
          await event(runDir, record.runId, "waiver.accepted", waiver);
      for (const amendment of boundary.amendments)
        if (!previousAmendments.has(amendment.amendmentId))
          await event(runDir, record.runId, "route.amended", amendment);
      for (const publication of boundary.publications)
        if (
          publication.artifacts.some(
            (artifact) => !recordedPublicationIds.has(artifact.publicationId),
          )
        ) {
          await event(
            runDir,
            record.runId,
            "ticket.artifacts.published",
            publication,
          );
          for (const artifact of publication.artifacts)
            recordedPublicationIds.add(artifact.publicationId);
        }
      if (boundary.steps.length > 0) record.steps = boundary.steps;
      record.currentStep =
        record.steps.find((step) =>
          ["running", "waiting_for_input"].includes(step.state),
        )?.stepId ?? null;
      if (boundary.status === "waiting_for_input") {
        record.state = "waiting_for_input";
        const reason = boundary.request?.reason ?? "model_unavailable";
        record.error = {
          category: reason,
          message:
            reason === "uncertain_activity"
              ? "the effectful activity ended without a trustworthy outcome"
              : reason === "loop_outcome"
                ? "a bounded loop did not satisfy its declared outcome"
                : "the selected execution route is currently unavailable",
        };
        if (
          boundary.request &&
          (previousRequest?.requestId !== boundary.request.requestId ||
            previousRequest?.version !== boundary.request.version)
        )
          await event(
            runDir,
            record.runId,
            "human.input.requested",
            boundary.request,
          );
      } else {
        const failedResult = boundary.results.findLast(
          (result) => result.status === "failed",
        );
        const graphFailed = record.steps.some((step) =>
          ["failed", "blocked"].includes(step.state),
        );
        record.state = "completed";
        record.conclusion = record.cancellation
          ? "cancelled"
          : graphFailed
            ? "failed"
            : record.waivers.length > 0
              ? "succeeded_with_waivers"
              : "succeeded";
        record.error =
          record.cancellation || !graphFailed
            ? null
            : (boundary.error ?? failedResult?.error ?? null);
        record.currentStep = null;
        record.request = null;
        await event(runDir, record.runId, "run.completed", {
          conclusion: record.conclusion,
          results: boundary.results.map((item) => ({
            invocationId: item.invocationId,
            status: item.status,
            artifacts: item.artifacts,
          })),
          waivers: record.waivers,
          ...(record.cancellation ? { cancellation: record.cancellation } : {}),
        });
        await releaseOwnership(repoRoot, record);
      }
      await saveRun(runDir, record);
    },
  );
}

async function executeStarted(
  repoRoot: string,
  runDir: string,
  record: RunRecord,
  plan: ResolvedPlan,
): Promise<ExecutionBoundary> {
  const snapshotDir = resolve(runDir, "snapshot");
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  await verifyWaiverContent(repoRoot, runDir, record);
  const identity = executionIdentity(repoRoot, record.runId);
  record.temporal = { ...record.temporal, ...identity, startPending: true };
  await saveRun(runDir, record);
  return executePlan(
    {
      runId: record.runId,
      repoRoot,
      runDir,
      workspace: record.workspace!,
      snapshotDir,
      plan,
    },
    async (temporal) => {
      record.temporal = { ...record.temporal, ...temporal };
      await saveRun(runDir, record);
      await event(runDir, record.runId, "run.started", {
        temporal,
        workspace: record.workspace,
      });
    },
  );
}

async function presentResult(
  command: "run" | "continue" | "resume" | "cancel",
  record: RunRecord,
  results: ExecutionBoundary["results"],
  json: boolean,
  publications: ExecutionBoundary["publications"] = [],
): Promise<number> {
  if (record.state === "waiting_for_input") {
    await printWaiting(record, json, command);
    return 0;
  }
  const data = {
    runId: record.runId,
    state: record.state,
    conclusion: record.conclusion,
    workspace: record.workspace,
    results,
    waivers: record.waivers,
    cancellation: record.cancellation,
    publications,
  };
  if (json)
    await emitJson(command, record.conclusion !== "failed", data, record.error);
  else
    console.log(
      `Run ${record.runId} ${record.conclusion}\nWorkspace: ${record.workspace ?? "(none)"}\nPublished: ${publications.flatMap((publication) => publication.artifacts).length}\nInspect: darrow inspect ${record.runId}`,
    );
  return record.conclusion === "failed" ? 1 : 0;
}

async function runWorkflow(options: RunOptions): Promise<number> {
  const invokedRoot = currentWorktreeRoot();
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const commit = pinnedCommit(invokedRoot, options.base);
  const { compilation, staged } = await withRepositoryCoordination(
    repoRoot,
    "run compilation",
    async () => {
      const compilation = await compile(
        repoRoot,
        options.workflow,
        options.inputs,
      );
      return {
        compilation,
        staged: await stageRun(repoRoot, compilation.workflow.id, compilation),
      };
    },
  );
  const { runId, runDir, record } = staged;
  await event(runDir, runId, "workflow.compiled", {
    workflow: compilation.plan.workflow,
    planDigest: compilation.plan.digest,
  });
  await event(runDir, runId, "dependencies.resolved", {
    commands: compilation.plan.steps.map((step) => step.commandId),
    capabilities: compilation.plan.capabilities,
  });
  if (isDirty(invokedRoot) && !options.base && !options.workspace) {
    record.state = "waiting_for_input";
    record.error = {
      category: "dirty_checkout",
      message: "the invoking checkout has uncommitted changes",
    };
    record.temporal = {
      pending: { kind: "dirty_checkout", commit, invokedRoot },
    };
    record.request = createHumanRequest({
      requestId: "dirty-checkout-1",
      version: 1,
      stepId: null,
      reason: "dirty_checkout",
      question: "How should Darrow handle the uncommitted invoking checkout?",
      choices: [
        {
          id: "head",
          consequence:
            "Create a managed worktree from the current HEAD commit.",
          acceptsInstructions: false,
        },
        {
          id: "current",
          consequence: "Attach this run to the current dirty checkout.",
          acceptsInstructions: false,
        },
        {
          id: "abort",
          consequence: "Cancel the run before allocating a workspace.",
          acceptsInstructions: false,
        },
      ],
      context: [{ label: "Invoking checkout", reference: invokedRoot }],
    });
    await saveRun(runDir, record);
    await event(runDir, runId, "human.input.requested", record.request);
    await printWaiting(record, options.json);
    return 0;
  }
  try {
    if (options.workspace === "current") {
      await claimCurrentWorkspace(repoRoot, runId, invokedRoot);
      record.workspace = invokedRoot;
      record.temporal = { attached: true };
    } else
      record.workspace = await allocateManagedWorkspace(
        repoRoot,
        runId,
        commit,
        options.worktree,
      );
    record.currentStep = compilation.plan.steps[0]?.id ?? null;
    await saveRun(runDir, record);
    await event(runDir, runId, "workspace.allocated", {
      workspace: record.workspace,
      commit,
      attached: options.workspace === "current",
    });
    const boundary = await executeStarted(
      repoRoot,
      runDir,
      record,
      compilation.plan,
    );
    await applyBoundary(repoRoot, runDir, record, boundary);
    return await presentResult(
      "run",
      record,
      boundary.results,
      options.json,
      boundary.publications,
    );
  } catch (error) {
    record.state = "completed";
    record.conclusion = "failed";
    record.error = {
      category:
        error instanceof DarrowError ? error.category : "infrastructure",
      message: error instanceof Error ? error.message : String(error),
    };
    record.currentStep = null;
    record.request = null;
    await releaseOwnership(repoRoot, record);
    await saveRun(runDir, record);
    await event(runDir, runId, "run.completed", {
      conclusion: "failed",
      error: record.error,
    });
    if (options.json)
      await emitJson(
        "run",
        false,
        { runId, state: record.state, conclusion: record.conclusion },
        record.error,
      );
    else
      console.error(
        `Run ${runId} failed: ${record.error.message}\nInspect: darrow inspect ${runId}`,
      );
    return 1;
  }
}

async function continueRun(
  options: ReturnType<typeof parseContinuation>,
): Promise<number> {
  const {
    runId,
    json,
    profile,
    instructionsFile,
    rationaleFile,
    actor,
    harness,
  } = options;
  let { choice, requestId, version } = options;
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  const record = await readRun(runDir);
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  await verifyWaiverContent(repoRoot, runDir, record);
  if (record.state !== "waiting_for_input")
    throw new DarrowError(`run is not waiting for input: ${runId}`, "state");
  if ((requestId === undefined) !== (version === undefined))
    throw new DarrowError(
      "continue requires both --request and --version",
      "usage",
    );
  if (requestId === "")
    throw new DarrowError("--request requires an ID", "usage");
  if (requestId === undefined || version === undefined) {
    if (json || !process.stdin.isTTY)
      throw new DarrowError(
        "continue requires --request and --version in non-interactive mode",
        "usage",
      );
    if (!record.request)
      throw new DarrowError("run has no open human request", "state");
    requestId = record.request.requestId;
    version = record.request.version;
  }
  const request = assertCurrentRequest(record.request, requestId, version);
  if (!choice) {
    if (json || !process.stdin.isTTY)
      throw new DarrowError(
        "continue requires --choice in non-interactive mode",
        "usage",
      );
    choice = globalThis.prompt("Continuation choice:")?.trim() ?? "";
    if (!choice)
      throw new DarrowError("no continuation choice supplied", "usage");
  }
  const selected = selectedChoice(request, choice);
  if (actor === "") throw new DarrowError("--actor requires an ID", "usage");
  if (harness === "")
    throw new DarrowError("--harness requires an ID", "usage");
  if (profile === "")
    throw new DarrowError("--profile requires a profile ID", "usage");
  if (choice === "amend" && !profile)
    throw new DarrowError(
      "route amendment requires an explicit profile",
      "usage",
    );
  if (choice !== "amend" && profile !== undefined)
    throw new DarrowError("--profile is only valid with choice amend", "usage");
  if (instructionsFile === "")
    throw new DarrowError("--instructions-file requires a path or -", "usage");
  if (rationaleFile === "")
    throw new DarrowError("--rationale-file requires a path or -", "usage");
  if (instructionsFile !== undefined && !selected.acceptsInstructions)
    throw new DarrowError(
      `continuation ${choice} does not accept supplemental instructions`,
      "usage",
    );
  if (choice === "waive" && rationaleFile === undefined)
    throw new DarrowError(
      "waiver continuation requires --rationale-file",
      "usage",
    );
  if (choice !== "waive" && rationaleFile !== undefined)
    throw new DarrowError(
      "--rationale-file is only valid with choice waive",
      "usage",
    );
  if (instructionsFile === "-" && rationaleFile === "-")
    throw new DarrowError(
      "instructions and rationale cannot both read from stdin",
      "usage",
    );
  const instructionContent =
    instructionsFile === undefined
      ? null
      : instructionsFile === "-"
        ? await Bun.stdin.text()
        : await readText(resolve(instructionsFile));
  const rationaleContent =
    rationaleFile === undefined
      ? null
      : rationaleFile === "-"
        ? await Bun.stdin.text()
        : await readText(resolve(rationaleFile));
  if (choice === "waive" && !rationaleContent?.trim())
    throw new DarrowError("waiver rationale must not be empty", "usage");
  const responseId = crypto.randomUUID();
  const responseActor: HumanResponse["actor"] = {
    id: actor || null,
    harness: harness || null,
    verified: false,
  };
  const amendment = profile
    ? await prepareRouteAmendment({
        repoRoot,
        plan,
        record,
        request,
        profileId: profile,
        responseId,
        actor: responseActor,
        approvedAt: new Date().toISOString(),
      })
    : null;
  const response: HumanResponse = {
    requestId,
    version,
    choice,
    actor: responseActor,
    instructions: await storeHumanInstructions(
      repoRoot,
      runDir,
      request,
      instructionContent,
    ),
    rationale: await storeHumanRationale(
      repoRoot,
      runDir,
      request,
      rationaleContent,
    ),
    amendment,
  };
  await event(runDir, runId, "human.input.received", response);
  const pending = record.temporal.pending as
    { kind?: string; commit?: string; invokedRoot?: string } | undefined;
  if (pending?.kind === "dirty_checkout") {
    if (choice === "abort") {
      const requestedAt = new Date().toISOString();
      for (const step of record.steps) step.state = "cancelled";
      record.cancellation = cancellationAtBoundary(record, requestedAt);
      record.state = "completed";
      record.conclusion = "cancelled";
      record.error = null;
      record.temporal = {};
      record.request = null;
      await event(runDir, runId, "run.cancel.requested", { requestedAt });
      await saveRun(runDir, record);
      await event(runDir, runId, "run.completed", {
        conclusion: "cancelled",
        cancellation: record.cancellation,
      });
      return presentResult("continue", record, [], json);
    }
    const workspace =
      choice === "current"
        ? resolve(pending.invokedRoot!)
        : await allocateManagedWorkspace(
            repoRoot,
            runId,
            String(pending.commit),
          );
    if (choice === "current")
      await claimCurrentWorkspace(repoRoot, runId, workspace);
    record.workspace = workspace;
    record.temporal = choice === "current" ? { attached: true } : {};
    record.state = "running";
    record.error = null;
    record.request = null;
    record.currentStep = plan.steps[0]?.id ?? null;
    await saveRun(runDir, record);
    await event(runDir, runId, "workspace.allocated", {
      workspace,
      commit: pending.commit,
      attached: choice === "current",
    });
    const boundary = await executeStarted(repoRoot, runDir, record, plan);
    await applyBoundary(repoRoot, runDir, record, boundary);
    return presentResult(
      "continue",
      record,
      boundary.results,
      json,
      boundary.publications,
    );
  }
  const boundary = await continuePlan(repoRoot, record.temporal, response);
  await applyBoundary(repoRoot, runDir, record, boundary);
  return presentResult(
    "continue",
    record,
    boundary.results,
    json,
    boundary.publications,
  );
}

async function resumeRun(runId: string, json: boolean): Promise<number> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  const record = await readRun(runDir);
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  await verifyWaiverContent(repoRoot, runDir, record);
  if (!record.workspace) {
    const owner = await ownedWorkspaceForRun(repoRoot, runId);
    if (owner) {
      record.workspace = owner.workspace;
      if (owner.kind === "attached")
        record.temporal = { ...record.temporal, attached: true };
    }
  }
  if (!record.workspace)
    throw new DarrowError(
      `run has no recoverable workspace: ${runId}`,
      "recovery",
    );
  if (!record.temporal.workflowId || !record.temporal.taskQueue) {
    record.temporal = {
      ...record.temporal,
      ...executionIdentity(repoRoot, runId),
      startPending: true,
    };
  }
  record.currentStep ??= plan.steps[0]?.id ?? null;
  await saveRun(runDir, record);
  const input = {
    runId,
    repoRoot,
    runDir,
    workspace: record.workspace,
    snapshotDir: resolve(runDir, "snapshot"),
    plan,
  };
  const boundary = await resumePlan(repoRoot, record.temporal, input);
  await event(runDir, runId, "run.recovered", {
    mode: boundary.recovery ?? "reattached",
    workflowId: boundary.temporal.workflowId,
    workspace: record.workspace,
  });
  await applyBoundary(repoRoot, runDir, record, boundary);
  return presentResult(
    "resume",
    record,
    boundary.results,
    json,
    boundary.publications,
  );
}

function cancellationAtBoundary(
  record: RunRecord,
  requestedAt: string,
): CancellationSummary {
  const completed = record.steps
    .filter((step) =>
      ["succeeded", "accepted_with_waiver", "failed"].includes(step.state),
    )
    .map((step) => step.stepId);
  return {
    requestedAt,
    completed,
    incomplete: record.steps
      .filter((step) => !completed.includes(step.stepId))
      .map((step) => step.stepId),
    uncertain: [],
  };
}

async function cancelRun(runId: string, json: boolean): Promise<number> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  let record = await readRun(runDir);
  let results: ExecutionBoundary["results"] = [];
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  await verifyRunSnapshot(runDir, plan);
  await verifyArtifacts(repoRoot, runDir);
  await verifyWaiverContent(repoRoot, runDir, record);
  let locallyCompleted = false;
  let requestedAt =
    record.cancellation?.requestedAt ?? new Date().toISOString();
  await withDirectoryLock(
    resolve(runDir, "state.lock"),
    `run ${runId} state`,
    async () => {
      record = await readRun(runDir);
      if (record.state === "completed") {
        if (record.conclusion !== "cancelled")
          throw new DarrowError(
            `run is already ${record.conclusion}: ${runId}`,
            "state",
          );
        locallyCompleted = true;
        return;
      }
      if (!record.temporal.workflowId) {
        if (!record.cancellation) {
          record.cancellation = cancellationAtBoundary(record, requestedAt);
          await event(runDir, runId, "run.cancel.requested", { requestedAt });
        }
        for (const step of record.steps)
          if (
            ["pending", "running", "waiting_for_input", "blocked"].includes(
              step.state,
            )
          )
            step.state = "cancelled";
        record.cancellation = cancellationAtBoundary(
          record,
          record.cancellation.requestedAt,
        );
        record.state = "completed";
        record.conclusion = "cancelled";
        record.temporal = {};
        record.currentStep = null;
        record.request = null;
        record.error = null;
        await event(runDir, runId, "run.completed", {
          conclusion: "cancelled",
          results: [],
          waivers: record.waivers,
          cancellation: record.cancellation,
        });
        await releaseOwnership(repoRoot, record);
        locallyCompleted = true;
      }
      await saveRun(runDir, record);
    },
  );
  if (!locallyCompleted) {
    const input = {
      runId,
      repoRoot,
      runDir,
      workspace: record.workspace!,
      snapshotDir: resolve(runDir, "snapshot"),
      plan,
    };
    const boundary = await cancelPlan(
      repoRoot,
      record.temporal,
      { requestedAt },
      input,
      async (accepted) => {
        requestedAt = accepted.requestedAt;
        await withDirectoryLock(
          resolve(runDir, "state.lock"),
          `run ${runId} state`,
          async () => {
            const current = await readRun(runDir);
            if (!current.cancellation) {
              current.cancellation = cancellationAtBoundary(
                current,
                accepted.requestedAt,
              );
              await event(runDir, runId, "run.cancel.requested", accepted);
              await saveRun(runDir, current);
            }
            Object.assign(record, current);
          },
        );
      },
    );
    results = boundary.results;
    if (boundary.recovery)
      await event(runDir, runId, "run.recovered", {
        mode: boundary.recovery,
        workflowId: boundary.temporal.workflowId,
        workspace: record.workspace,
      });
    await applyBoundary(repoRoot, runDir, record, boundary);
  }
  return presentResult(
    "cancel",
    record,
    results,
    json,
    await readTicketPublicationEvents(runDir),
  );
}

async function inspectRun(runId: string, json: boolean): Promise<void> {
  const repoRoot = primaryRepoRoot();
  await requireInitialized(repoRoot);
  const runDir = resolve(repoRoot, ".darrow", "runs", runId);
  if (!(await exists(runDir)))
    throw new DarrowError(`run not found: ${runId}`, "not_found");
  const record = await readRun(runDir);
  const plan = await readJson<ResolvedPlan>(resolve(runDir, "plan.json"));
  const cleanup = await readCleanupRecord(runDir);
  if (!(await cleanupUnavailable(cleanup, "snapshot")))
    await verifyRunSnapshot(runDir, plan);
  if (!(await cleanupUnavailable(cleanup, "artifacts")))
    await verifyArtifacts(repoRoot, runDir);
  if (!(await cleanupUnavailable(cleanup, "content")))
    await verifyWaiverContent(repoRoot, runDir, record);
  await verifyPublishedArtifacts(
    repoRoot,
    await readTicketPublicationEvents(runDir),
    await cleanedTicketPublicationIds(cleanup),
  );
  const temporal =
    record.state === "completed" || !record.temporal.workflowId
      ? null
      : await describeWorkflow(repoRoot, record.temporal);
  const eventsPath = resolve(runDir, "events.jsonl");
  const eventCount = (await exists(eventsPath))
    ? (await Bun.file(eventsPath).text()).split("\n").filter(Boolean).length
    : 0;
  const results = (await cleanupUnavailable(cleanup, "results"))
    ? []
    : (await readdir(resolve(runDir, "results"))).filter((name) =>
        name.endsWith(".json"),
      );
  const data = {
    ...record,
    cleanup,
    liveTemporal: temporal,
    paths: {
      run: runDir,
      plan: resolve(runDir, "plan.json"),
      lock: resolve(runDir, "lock.json"),
      snapshot: resolve(runDir, "snapshot"),
      workspace: record.workspace,
    },
    counts: { events: eventCount, results: results.length },
  };
  if (json) await emitJson("inspect", true, data, null);
  else if (record.state === "waiting_for_input")
    await printWaiting(record, false);
  else
    console.log(
      `Run: ${runId}\nState: ${record.state}\nConclusion: ${record.conclusion ?? "(none)"}\nWorkflow: ${record.workflowId}\nWorkspace: ${record.workspace ?? "(not allocated)"}\nAmendments: ${record.amendments.length}\nEvents: ${eventCount}\nResults: ${results.length}\nRun record: ${runDir}`,
    );
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args.shift();
  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    console.log(usage());
    return 0;
  }
  if (command === "--version" || command === "-V") {
    console.log("darrow 0.1.0");
    return 0;
  }
  if (command === "init") {
    const json = args.length === 1 && args[0] === "--json";
    if (args.length > (json ? 1 : 0))
      throw new DarrowError(`unknown init argument: ${args[0]}`, "usage");
    await initialize(json);
    return 0;
  }
  if (command === "run") return runWorkflow(parseRun(args));
  if (command === "continue") {
    const parsed = parseContinuation(args);
    return continueRun(parsed);
  }
  if (command === "resume") {
    const runId = args.shift();
    if (!runId) throw new DarrowError("resume requires a run ID", "usage");
    const json = args.length === 1 && args[0] === "--json";
    if (args.length > (json ? 1 : 0))
      throw new DarrowError(`unknown resume argument: ${args[0]}`, "usage");
    return resumeRun(runId, json);
  }
  if (command === "cancel") {
    const runId = args.shift();
    if (!runId) throw new DarrowError("cancel requires a run ID", "usage");
    const json = args.length === 1 && args[0] === "--json";
    if (args.length > (json ? 1 : 0))
      throw new DarrowError(`unknown cancel argument: ${args[0]}`, "usage");
    return cancelRun(runId, json);
  }
  if (command === "inspect") {
    const runId = args.shift();
    if (!runId) throw new DarrowError("inspect requires a run ID", "usage");
    const json = args.length === 1 && args[0] === "--json";
    if (args.length > (json ? 1 : 0))
      throw new DarrowError(`unknown inspect argument: ${args[0]}`, "usage");
    await inspectRun(runId, json);
    return 0;
  }
  if (command === "clean") {
    const parsed = parseClean(args);
    return clean(parsed.filters, parsed.selection, parsed.json);
  }
  throw new DarrowError(`unknown command: ${command}\n${usage()}`, "usage");
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    process.exitCode = error instanceof DarrowError ? error.exitCode : 1;
  });
