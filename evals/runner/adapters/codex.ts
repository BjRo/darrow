import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type {
  HarnessAdapter,
  HarnessResult,
  HarnessRunRequest,
  SkillActivationProbe,
  SkillActivationObservation,
} from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";
import {
  fixtureStateFingerprint,
  repositoryFingerprint,
  verifiedCodexAcceptedOwner,
  verifiedCodexSpawnAttestation,
} from "../codex-spawn-guard";
import { CODEX_EVAL_ROLE_DEFAULTS } from "../model-defaults";

type AcceptedCodexOwner = NonNullable<
  Awaited<ReturnType<typeof verifiedCodexAcceptedOwner>>
>;

const CODEX_AGENT_REF =
  /^(?:\/root(?:\/[a-z0-9_]+)+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface CodexEvent {
  type?: unknown;
  thread_id?: unknown;
  usage?: CodexUsage;
  msg?: { type?: unknown; info?: { total_token_usage?: CodexUsage } };
  info?: { total_token_usage?: CodexUsage };
  item?: {
    id?: unknown;
    type?: unknown;
    command?: unknown;
    exit_code?: unknown;
    status?: unknown;
    aggregated_output?: unknown;
    tool?: unknown;
    prompt?: unknown;
    sender_thread_id?: unknown;
    senderThreadId?: unknown;
    receiver_thread_ids?: unknown;
    receiverThreadIds?: unknown;
    task_name?: unknown;
    taskName?: unknown;
  };
  tool_response?: unknown;
  result?: unknown;
  [key: string]: unknown;
}

/** JSONL events from the `codex exec --json` stream; non-JSON noise is fine. */
function codexEvents(stream: string): CodexEvent[] {
  const events: CodexEvent[] = [];
  for (const line of stream.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed) as CodexEvent);
    } catch {
      // non-JSON noise in the stream is fine
    }
  }
  return events;
}

export function codexThreadId(stream: string): string | undefined {
  const ids = [
    ...new Set(
      codexEvents(stream).flatMap((event) =>
        event.type === "thread.started" && typeof event.thread_id === "string"
          ? [event.thread_id]
          : [],
      ),
    ),
  ];
  return ids.length === 1 ? ids[0] : undefined;
}

function codexStreamMalformed(stream: string): boolean {
  return stream.split("\n").some((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return false;
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      return true;
    }
  });
}

function codexEventTypes(event: CodexEvent): string[] {
  return [event.type, event.msg?.type].filter(
    (type): type is string => typeof type === "string",
  );
}

export function codexRunSucceeded(code: number, stream: string): boolean {
  let completed = false;
  let failed = false;
  for (const event of codexEvents(stream)) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return code === 0 && completed && !failed;
}

function completedCommand(event: CodexEvent): string | undefined {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution" ||
    typeof event.item.command !== "string" ||
    event.item.exit_code !== 0 ||
    event.item.status !== "completed"
  )
    return undefined;
  return event.item.command;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shellPayload(command: string): string | undefined {
  const wrapper = command.match(
    /^\/bin\/(?:ba|z)?sh\s+-lc\s+(["'])([\s\S]*)\1$/,
  );
  return wrapper?.[2] ?? command;
}

function skillReads(command: string, skillsRoot: string): string[] {
  const path = new RegExp(
    `(?:^|[^A-Za-z0-9._/-])(?:\\./)?${escapeRegExp(skillsRoot)}/([A-Za-z0-9._-]+)/SKILL\\.md(?=$|[^A-Za-z0-9._/-])`,
    "g",
  );
  const payload = shellPayload(command);
  if (!payload) return [];
  return [...payload.matchAll(path)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

function malformedCompletedCommand(event: CodexEvent): boolean {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution"
  )
    return false;
  return (
    typeof event.item.command !== "string" ||
    typeof event.item.exit_code !== "number" ||
    (event.item.status !== "completed" && event.item.status !== "failed")
  );
}

function observedSkillReads(
  events: CodexEvent[],
  skillsRoots: string | string[],
): string[] {
  const roots = Array.isArray(skillsRoots) ? skillsRoots : [skillsRoots];
  const observedSkills: string[] = [];
  for (const event of events) {
    const command = completedCommand(event);
    const output = event.item?.aggregated_output;
    const skills = command
      ? roots.flatMap((skillsRoot) => skillReads(command, skillsRoot))
      : [];
    for (const skill of skills) {
      if (
        typeof output === "string" &&
        new RegExp(
          `(?:^|\\n)---\\nname:\\s*${escapeRegExp(skill)}(?:\\n|$)`,
        ).test(output) &&
        !observedSkills.includes(skill)
      )
        observedSkills.push(skill);
    }
  }
  return observedSkills;
}

function codexTrackedSkillRoots(
  repoDir: string,
  installedSkillsRoot: string | string[],
): string[] {
  const installedSkillsRoots = Array.isArray(installedSkillsRoot)
    ? installedSkillsRoot
    : [installedSkillsRoot];
  const repoRelativeInstalledRoots = installedSkillsRoots.flatMap(
    (skillsRoot) => {
      if (!isAbsolute(skillsRoot)) return [];
      const repoRelativeRoot = relative(repoDir, skillsRoot);
      if (
        !repoRelativeRoot ||
        repoRelativeRoot === ".." ||
        repoRelativeRoot.startsWith(`..${sep}`) ||
        isAbsolute(repoRelativeRoot)
      )
        return [];
      return [repoRelativeRoot];
    },
  );
  return [
    ...new Set([
      ...installedSkillsRoots,
      ...repoRelativeInstalledRoots,
      join(repoDir, ".agents", "skills"),
      join(".agents", "skills"),
    ]),
  ];
}

function codexActivationStreamComplete(
  stream: string,
  events: CodexEvent[],
): boolean {
  let completed = false;
  let failed = false;
  for (const event of events) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return (
    completed &&
    !failed &&
    !codexStreamMalformed(stream) &&
    !events.some(malformedCompletedCommand)
  );
}

function literalOccurrences(value: string, token: string): number {
  if (!token) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(token, offset)) !== -1) {
    count++;
    offset += token.length;
  }
  return count;
}

/**
 * Codex resolves a runner-rendered explicit skill token before model execution,
 * so that dispatch is not repeated as a transcript-visible SKILL.md read. The
 * controlled probe is complete only when one exact expected token was supplied
 * to a successfully completed turn.
 */
export function codexExplicitSkillActivation(
  stream: string,
  prompt: string,
  probe: Extract<SkillActivationProbe, { mode: "explicit" }>,
): SkillActivationObservation {
  const events = codexEvents(stream);
  const unambiguous =
    /^[A-Za-z0-9._-]+$/.test(probe.skill) &&
    probe.invocation.length > 0 &&
    literalOccurrences(prompt, probe.invocation) === 1;
  const complete = unambiguous && codexActivationStreamComplete(stream, events);
  const observedSkills = complete ? [probe.skill] : [];
  return {
    source: "explicit_invocation",
    complete,
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

/**
 * Codex exposes command events but no native skill-invocation event for
 * implicit discovery. The first completed mounted SKILL.md read is therefore
 * retained as an explicitly labeled behavior probe for implicit cases.
 */
export function codexSkillActivation(
  stream: string,
  repoDir: string,
  installedSkillsRoot: string | string[] = join(repoDir, ".agents", "skills"),
): SkillActivationObservation {
  const events = codexEvents(stream);
  const observedSkills = observedSkillReads(
    events,
    codexTrackedSkillRoots(repoDir, installedSkillsRoot),
  );
  return {
    source: "skill_file_read_probe",
    complete: codexActivationStreamComplete(stream, events),
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

function retainedTerminalEvent(event: CodexEvent): unknown | undefined {
  const types = codexEventTypes(event);
  const terminal = types.find(
    (type) => type === "turn.completed" || type === "turn.failed",
  );
  if (!terminal) return undefined;
  const usage = normalizedCodexUsage(codexUsageCandidate(event).value);
  return usage ? { type: terminal, usage } : { type: terminal };
}

function acceptedCollaborationEvent(event: CodexEvent): boolean {
  const item = event.item;
  if (item?.type !== "collab_tool_call" || typeof item.tool !== "string")
    return false;
  if (event.type === "item.completed")
    return item.tool === "spawn_agent" || item.status === "completed";
  return (
    event.type === "item.started" &&
    ["spawn_agent", "wait", "wait_agent"].includes(item.tool) &&
    item.status === "in_progress"
  );
}

function canonicalCodexAgentRef(value: unknown): string | undefined {
  return typeof value === "string" && CODEX_AGENT_REF.test(value)
    ? value
    : undefined;
}

function taskNameAgentRefs(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return [record.task_name, record.taskName]
    .map(canonicalCodexAgentRef)
    .filter((reference): reference is string => reference !== undefined);
}

function invalidTaskNameAgentRef(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return ["task_name", "taskName"].some(
    (key) => key in record && canonicalCodexAgentRef(record[key]) === undefined,
  );
}

function soleReceiverAgentRef(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  return canonicalCodexAgentRef(value[0]);
}

function unsafeReceiverAgentRef(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== 1) return true;
  const receiver = value[0];
  if (typeof receiver !== "string" || receiver.length === 0) return true;
  if (canonicalCodexAgentRef(receiver)) return false;
  return !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(receiver);
}

function invalidCompletedReceiverAgentRef(event: CodexEvent): boolean {
  if (event.type !== "item.completed" || !event.item) return false;
  const item = event.item;
  return ["receiver_thread_ids", "receiverThreadIds"].some(
    (key) =>
      key in item && unsafeReceiverAgentRef(item[key as keyof typeof item]),
  );
}

function collaborationAgentRefCandidates(event: CodexEvent): string[] {
  const item = event.item;
  const candidates = [item, event.tool_response, event.result];
  const references = candidates.flatMap(taskNameAgentRefs);
  const receiver = soleReceiverAgentRef(
    item?.receiver_thread_ids ?? item?.receiverThreadIds,
  );
  return receiver ? [...references, receiver] : references;
}

function acceptedCollaborationAgentRef(event: CodexEvent): string | undefined {
  const candidates = collaborationAgentRefCandidates(event);
  return new Set(candidates).size === 1 ? candidates[0] : undefined;
}

function completedGoalOwnerAgentRef(stream: string): string | undefined {
  const references = codexEvents(stream).flatMap((event) => {
    const item = event.item;
    const markedOwner =
      typeof item?.prompt === "string" &&
      item.prompt.startsWith("- phase: adaptive-goal-owner\n");
    if (
      event.type !== "item.completed" ||
      item?.type !== "collab_tool_call" ||
      item.tool !== "spawn_agent" ||
      item.status !== "completed" ||
      !markedOwner
    )
      return [];
    const reference = acceptedCollaborationAgentRef(event);
    return reference ? [reference] : [];
  });
  return references.length === 1 ? references[0] : undefined;
}

function collaborationAgentRefConflicts(
  event: CodexEvent,
  acceptedAgentRef?: string,
): boolean {
  const candidates = collaborationAgentRefCandidates(event);
  return (
    [event.item, event.tool_response, event.result].some(
      invalidTaskNameAgentRef,
    ) ||
    invalidCompletedReceiverAgentRef(event) ||
    new Set(candidates).size > 1 ||
    (!!acceptedAgentRef &&
      candidates.some((candidate) => candidate !== acceptedAgentRef))
  );
}

function retainedCollaborationPrompt(prompt: unknown): string | undefined {
  if (typeof prompt !== "string") return undefined;
  const lines = prompt.split("\n");
  if (/^- phase: adaptive-goal-(?:owner|runner)$/.test(lines[0] ?? ""))
    return lines[0];
  const retained = lines
    .filter((line, index) => {
      if (/^- phase: adaptive-goal-(?:owner|runner)$/.test(line)) return false;
      return (
        /^- (?:phase|iteration|stable_child_id|required skill|phase_skill): /.test(
          line,
        ) ||
        (index === 0 && /^- review_axis: (?:standards|spec)$/.test(line))
      );
    })
    .join("\n");
  return retained || undefined;
}

function retainedCollaborationEvent(
  event: CodexEvent,
  spawnGuardSecret?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  if (!acceptedCollaborationEvent(event)) return undefined;
  const item = event.item!;
  const prompt = retainedCollaborationPrompt(item.prompt);
  const attestation = collaborationSpawnAttestation(item, spawnGuardSecret);
  const isGoalOwner = prompt === "- phase: adaptive-goal-owner";
  if (collaborationAgentRefConflicts(event, acceptedAgentRef)) return undefined;
  const agentRef =
    acceptedCollaborationAgentRef(event) ||
    ((attestation || isGoalOwner) && acceptedAgentRef) ||
    undefined;
  if (
    acceptedAgentRef &&
    item.tool !== "spawn_agent" &&
    agentRef !== acceptedAgentRef
  )
    return undefined;
  return retainedCollaborationRecord(event, item, {
    prompt,
    attestation,
    agentRef,
  });
}

function collaborationSpawnAttestation(
  item: NonNullable<CodexEvent["item"]>,
  secret?: string,
): ReturnType<typeof verifiedCodexSpawnAttestation> {
  if (item.tool !== "spawn_agent" || !secret || typeof item.prompt !== "string")
    return undefined;
  return verifiedCodexSpawnAttestation(item.prompt, secret);
}

function retainedCollaborationRecord(
  event: CodexEvent,
  item: NonNullable<CodexEvent["item"]>,
  evidence: {
    prompt?: string;
    attestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
    agentRef?: string;
  },
): object {
  const retained: Record<string, unknown> = {
    type: item.type,
    tool: item.tool,
    status: item.status,
    sender_thread_id: item.sender_thread_id ?? item.senderThreadId,
    receiver_thread_ids: item.receiver_thread_ids ?? item.receiverThreadIds,
  };
  if (evidence.agentRef) retained.agent_ref = evidence.agentRef;
  if (evidence.prompt) retained.prompt = evidence.prompt;
  if (evidence.attestation)
    retained.goal_spawn_attestation = publicSpawnAttestation(
      evidence.attestation,
    );
  return { type: event.type, item: retained };
}

function publicSpawnAttestation(
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
): object {
  return {
    model: attestation.model,
    effort: attestation.effort,
    forkTurns: attestation.forkTurns,
    requestSha256: attestation.requestSha256,
    objectiveSha256: attestation.objectiveSha256,
    contractSha256: attestation.contractSha256,
    baselineSha256: attestation.baselineSha256,
    fixtureStateSha256: attestation.fixtureStateSha256,
    objectiveMode: attestation.objectiveMode,
  };
}

interface PostGoalEvidenceContext {
  seen: Set<string>;
  repoDir: string;
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
  goalLoopPath?: string;
  agentRef?: string;
  activationState: "pending" | "recorded" | "rejected";
  goalPersistence: "none" | "confirmed" | "unavailable";
  waited: boolean;
  interrupted: boolean;
  closed: boolean;
  launchStopRecorded: boolean;
  objectiveReleased: boolean;
}

function retainedPostGoalToolEvent(
  event: CodexEvent,
  context: PostGoalEvidenceContext,
): unknown | undefined {
  const item = postGoalToolItem(event);
  if (!item) return undefined;
  const id = typeof item.id === "string" ? item.id : undefined;
  if (id && context.seen.has(id)) return undefined;
  if (id) context.seen.add(id);
  if (retainedHumanFeedbackEvent(event)) return undefined;
  const lifecycle = retainedGoalLifecycleEvent(event, context);
  if (lifecycle) return lifecycle;
  return {
    type: "darrow.parent_tool_after_goal",
    operation: postGoalToolOperation(item, context.repoDir),
  };
}

function retainedGoalLifecycleEvent(
  event: CodexEvent,
  context: PostGoalEvidenceContext,
): unknown | undefined {
  const activation = retainedGoalActivationEvent(
    event,
    context.attestation,
    context.goalLoopPath,
    context.agentRef,
  );
  if (activation) return activation;
  const rejected = retainedGoalActivationRejectedEvent(
    event,
    context.attestation,
    context.goalLoopPath,
    context.agentRef,
  );
  if (rejected) return rejected;
  const goalPersistence = retainedGoalPersistenceForState(event, context);
  if (goalPersistence) return goalPersistence;
  const launchStop =
    context.activationState === "rejected" && context.interrupted
      ? retainedGoalLaunchStopEvent(
          event,
          context.attestation,
          context.goalLoopPath,
          context.agentRef,
        )
      : undefined;
  if (launchStop) return launchStop;
  const release = retainedObjectiveReleaseEvent(
    event,
    context.attestation,
    context.goalLoopPath,
  );
  if (release) return release;
  const report = retainedGoalReportEvent(
    event,
    context.attestation,
    context.goalLoopPath,
  );
  return goalReportFollowsLifecycle(report, context) ? report : undefined;
}

function retainedGoalPersistenceForState(
  event: CodexEvent,
  context: PostGoalEvidenceContext,
): unknown | undefined {
  return context.activationState === "recorded"
    ? retainedGoalPersistenceEvent(
        event,
        context.attestation,
        context.goalLoopPath,
        context.agentRef,
      )
    : undefined;
}

function goalReportFollowsLifecycle(
  report: unknown,
  context: PostGoalEvidenceContext,
): boolean {
  if (!report || typeof report !== "object" || Array.isArray(report))
    return false;
  const status = (report as { status?: unknown }).status;
  if (status !== "launch-required")
    return (
      context.activationState === "recorded" &&
      context.goalPersistence === "confirmed"
    );
  return (
    acceptedLaunchFailureLifecycle(context) ||
    acceptedGoalPersistenceFailureLifecycle(context)
  );
}

function acceptedGoalPersistenceFailureLifecycle(
  context: PostGoalEvidenceContext,
): boolean {
  const objectiveClean =
    context.attestation?.objectiveMode !== "file-backed" ||
    context.objectiveReleased;
  return [
    context.activationState === "recorded",
    context.goalPersistence === "unavailable",
    context.waited,
    objectiveClean,
  ].every(Boolean);
}

function acceptedLaunchFailureLifecycle(
  context: PostGoalEvidenceContext,
): boolean {
  const objectiveClean =
    context.attestation?.objectiveMode !== "file-backed" ||
    context.objectiveReleased;
  return [
    context.activationState === "rejected",
    context.interrupted,
    context.closed,
    context.launchStopRecorded,
    objectiveClean,
  ].every(Boolean);
}

function postGoalToolItem(
  event: CodexEvent,
): NonNullable<CodexEvent["item"]> | undefined {
  const item = event.item;
  const valid = [
    event.type === "item.started" || event.type === "item.completed",
    !!item,
    typeof item?.type === "string",
    !postGoalToolIgnored(String(item?.type)),
    !(item?.type === "command_execution" && event.type === "item.started"),
  ].every(Boolean);
  return valid ? item : undefined;
}

function postGoalToolIgnored(type: string): boolean {
  return [
    "agent_message",
    "reasoning",
    "error",
    "collab_tool_call",
    "collabAgentToolCall",
  ].includes(type);
}

function literalShellWords(command: string): string[] | undefined {
  const payload = shellPayload(command)?.trim();
  if (!payload) return undefined;
  const words: string[] = [];
  const token =
    /(?:'([^'\r\n]*)'|"([^"$`\\\r\n]*)"|([A-Za-z0-9_./:@,+%=-]+))(?:[ \t]+|$)/y;
  let index = 0;
  while (index < payload.length) {
    token.lastIndex = index;
    const match = token.exec(payload);
    if (!match) return undefined;
    words.push(match[1] ?? match[2] ?? match[3]!);
    index = token.lastIndex;
  }
  return words;
}

function retainedObjectiveReleaseEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  goalLoopPath?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (!command || !attestation || !goalLoopPath) return undefined;
  if (!objectiveReleaseCommandMatches(command, attestation, goalLoopPath))
    return undefined;
  if (!objectiveReleaseOutputMatches(event, attestation)) return undefined;
  return {
    type: "darrow.objective_release",
    status: "completed",
    contract_sha256: attestation.contractSha256,
  };
}

function retainedGoalActivationEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  goalLoopPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (!command || !attestation || !goalLoopPath || !acceptedAgentRef)
    return undefined;
  const evidence = goalActivationCommandEvidence(
    command,
    attestation,
    goalLoopPath,
    acceptedAgentRef,
  );
  if (!evidence || !goalActivationOutputMatches(event, evidence))
    return undefined;
  return {
    type: "darrow.goal_activation",
    status: "completed",
    boundary: "native_subagent",
    agent_ref: evidence.agentRef,
    effective_route: evidence.route,
  };
}

function retainedGoalActivationRejectedEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  goalLoopPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  const command = rejectedCommand(event);
  if (!command || !attestation || !goalLoopPath || !acceptedAgentRef)
    return undefined;
  const evidence = goalActivationCommandEvidence(
    command,
    attestation,
    goalLoopPath,
    acceptedAgentRef,
  );
  return evidence
    ? {
        type: "darrow.goal_activation_rejected",
        status: "rejected",
        agent_ref: evidence.agentRef,
      }
    : undefined;
}

function retainedGoalPersistenceEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  goalLoopPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  if (!attestation || !goalLoopPath || !acceptedAgentRef) return undefined;
  const status = goalPersistenceCommandStatus(
    event,
    attestation,
    goalLoopPath,
    acceptedAgentRef,
  );
  if (!status || !goalPersistenceOutputMatches(event, status)) return undefined;
  return {
    type: "darrow.goal_persistence",
    status: status === "active" ? "confirmed" : "unavailable",
    agent_ref: acceptedAgentRef,
  };
}

function goalPersistenceCommandStatus(
  event: CodexEvent,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  goalLoopPath: string,
  acceptedAgentRef: string,
): "active" | "unavailable" | undefined {
  const command = completedCommand(event);
  const sender = event.item?.sender_thread_id ?? event.item?.senderThreadId;
  if (!command || sender !== acceptedAgentRef) return undefined;
  const words = literalShellWords(command);
  const status = words?.[7];
  if (status !== "active" && status !== "unavailable") return undefined;
  const expected = [
    "/bin/bash",
    goalLoopPath,
    "step",
    "goal-state",
    "--ledger",
    attestation.ledger,
    "--status",
    status,
  ];
  return JSON.stringify(words) === JSON.stringify(expected)
    ? status
    : undefined;
}

function goalPersistenceOutputMatches(
  event: CodexEvent,
  status: "active" | "unavailable",
): boolean {
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format\tdarrow-goal-step-v1$/m.test(output) ||
    !/^step\tgoal-state$/m.test(output) ||
    !/^status\trecorded$/m.test(output) ||
    !new RegExp(`^goal_state\\t${status}$`, "m").test(output)
  );
}

function rejectedCommand(event: CodexEvent): string | undefined {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution" ||
    typeof event.item.command !== "string" ||
    typeof event.item.exit_code !== "number" ||
    event.item.exit_code === 0 ||
    (event.item.status !== "completed" && event.item.status !== "failed")
  )
    return undefined;
  return event.item.command;
}

function goalActivationCommandEvidence(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  goalLoopPath: string,
  acceptedAgentRef: string,
): { agentRef: string; route: string } | undefined {
  const words = literalShellWords(command);
  const route = `codex|openai|${attestation.model}|${attestation.effort}`;
  if (!words || words.length !== 16) return undefined;
  const prefix = [
    "/bin/bash",
    goalLoopPath,
    "step",
    "activate",
    "--ledger",
    attestation.ledger,
    "--applied-by",
    "native-subagent",
    "--boundary",
    "native_subagent",
    "--agent-ref",
  ];
  if (JSON.stringify(words.slice(0, 11)) !== JSON.stringify(prefix))
    return undefined;
  const agentRef = words[11]!;
  if (
    canonicalCodexAgentRef(agentRef) !== agentRef ||
    agentRef !== acceptedAgentRef
  )
    return undefined;
  const suffix = ["--effective-route", route, "--route-verified", "true"];
  if (JSON.stringify(words.slice(12)) !== JSON.stringify(suffix))
    return undefined;
  return { agentRef, route };
}

function goalActivationOutputMatches(
  event: CodexEvent,
  evidence: { agentRef: string; route: string },
): boolean {
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format\tdarrow-goal-step-v1$/m.test(output) ||
    !/^step\tactivate$/m.test(output) ||
    !/^status\trecorded$/m.test(output) ||
    !new RegExp(`^agent_ref\\t${escapeRegExp(evidence.agentRef)}$`, "m").test(
      output,
    ) ||
    !new RegExp(
      `^effective_route\\t${escapeRegExp(evidence.route)}$`,
      "m",
    ).test(output) ||
    !/^route_verified\ttrue$/m.test(output)
  );
}

function retainedGoalLaunchStopEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  goalLoopPath?: string,
  acceptedAgentRef?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (!command || !attestation || !goalLoopPath || !acceptedAgentRef)
    return undefined;
  if (
    !goalLaunchStopCommandMatches(
      command,
      attestation,
      goalLoopPath,
      acceptedAgentRef,
    ) ||
    !goalLaunchStopOutputMatches(event, acceptedAgentRef)
  )
    return undefined;
  return {
    type: "darrow.goal_launch_stop",
    status: "launch-unavailable",
    agent_ref: acceptedAgentRef,
    child_invocations: 1,
  };
}

function goalLaunchStopCommandMatches(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  goalLoopPath: string,
  acceptedAgentRef: string,
): boolean {
  const expected = [
    "/bin/bash",
    goalLoopPath,
    "step",
    "launch-stop",
    "--ledger",
    attestation.ledger,
    "--reason",
    "launch-unavailable",
    "--agent-ref",
    acceptedAgentRef,
  ];
  return (
    JSON.stringify(literalShellWords(command)) === JSON.stringify(expected)
  );
}

function goalLaunchStopOutputMatches(
  event: CodexEvent,
  acceptedAgentRef: string,
): boolean {
  const output = event.item?.aggregated_output;
  return (
    typeof output === "string" &&
    /^format\tdarrow-goal-step-v1$/m.test(output) &&
    /^step\tlaunch-stop$/m.test(output) &&
    /^status\trecorded$/m.test(output) &&
    /^reason\tlaunch-unavailable$/m.test(output) &&
    new RegExp(`^agent_ref\\t${escapeRegExp(acceptedAgentRef)}$`, "m").test(
      output,
    )
  );
}

function retainedGoalReportEvent(
  event: CodexEvent,
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>,
  goalLoopPath?: string,
): unknown | undefined {
  const command = completedCommand(event);
  if (!command || !attestation || !goalLoopPath) return undefined;
  const evidence = goalReportCommandEvidence(
    command,
    attestation,
    goalLoopPath,
  );
  if (!evidence || !goalReportOutputMatches(event, evidence.status))
    return undefined;
  return {
    type: "darrow.goal_report",
    status: evidence.status,
    human_interruptions: evidence.humanInterruptions,
  };
}

function goalReportCommandEvidence(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  goalLoopPath: string,
): { status: string; humanInterruptions: number } | undefined {
  const words = literalShellWords(command);
  if (!words || words.length !== 10) return undefined;
  const prefix = [
    "/bin/bash",
    goalLoopPath,
    "step",
    "report",
    "--ledger",
    attestation.ledger,
    "--status",
  ];
  if (JSON.stringify(words.slice(0, 7)) !== JSON.stringify(prefix))
    return undefined;
  const status = words[7]!;
  if (!["complete", "blocked", "launch-required"].includes(status))
    return undefined;
  if (words[8] !== "--human-interruptions" || !/^\d+$/.test(words[9]!))
    return undefined;
  return { status, humanInterruptions: Number(words[9]) };
}

function goalReportOutputMatches(event: CodexEvent, status: string): boolean {
  const terminal = {
    complete: "Native goal completed.",
    blocked: "Native goal settled as blocked.",
    "launch-required": "Native goal requires host launch.",
  }[status];
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format: darrow-native-goal-report-v1$/m.test(output) ||
    !new RegExp(`^${escapeRegExp(terminal!)}$`, "m").test(output)
  );
}

function objectiveReleaseCommandMatches(
  command: string,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
  goalLoopPath: string,
): boolean {
  if (!attestation.attachmentDir || attestation.objectiveMode !== "file-backed")
    return false;
  const expected = [
    "/bin/bash",
    goalLoopPath,
    "step",
    "release-objective",
    "--ledger",
    attestation.ledger,
    "--attachment-dir",
    attestation.attachmentDir,
    "--expected-sha256",
    attestation.contractSha256,
  ];
  return (
    JSON.stringify(literalShellWords(command)) === JSON.stringify(expected)
  );
}

function objectiveReleaseOutputMatches(
  event: CodexEvent,
  attestation: NonNullable<ReturnType<typeof verifiedCodexSpawnAttestation>>,
): boolean {
  if (!attestation.attachmentDir) return false;
  const output = event.item?.aggregated_output;
  return !(
    typeof output !== "string" ||
    !/^format\tdarrow-native-goal-objective-release-v1$/m.test(output) ||
    !/^status\treleased$/m.test(output) ||
    !new RegExp(
      `^attachment_dir\\t${escapeRegExp(attestation.attachmentDir)}$`,
      "m",
    ).test(output)
  );
}

function postGoalToolOperation(
  item: NonNullable<CodexEvent["item"]>,
  repoDir: string,
): string {
  return item.type === "command_execution" && typeof item.command === "string"
    ? postGoalCommandOperation(item.command, repoDir)
    : String(item.type);
}

function postGoalCommandOperation(command: string, repoDir: string): string {
  if (/\bgit\s+(?:status|diff)\b/.test(command)) return "repository-inspection";
  if (
    /\b(?:bash\s+)?test\.sh\b|\b(?:bun|npm|pnpm)\s+(?:run\s+)?test\b|\bnode\s+--test\b/.test(
      command,
    )
  )
    return "verification";
  if (/\bindependent-review-fixture\b/.test(command))
    return "independent-review";
  if (/\bgoal-loop\s+release-(?:staging|objective)\b/.test(command))
    return "objective-cleanup";
  const privateRoot = join(repoDir, ".git", "darrow-eval", "state", "codex");
  if (/\brm\b/.test(command) && command.includes(privateRoot))
    return "private-staging-cleanup";
  return "command";
}

function retainedPreGoalToolEvent(
  event: CodexEvent,
  repoDir: string,
): unknown | undefined {
  const item = event.item;
  if (!item || typeof item.type !== "string") return undefined;
  const command = completedCommand(event);
  if (command) {
    const operation = postGoalCommandOperation(command, repoDir);
    return operation === "verification" || operation === "independent-review"
      ? { type: "darrow.parent_tool_before_goal", operation }
      : undefined;
  }
  if (
    event.type === "item.started" &&
    ![
      "agent_message",
      "reasoning",
      "command_execution",
      // The spawn hook allows apply_patch before ownership only for the one
      // objective staging file inside the evaluator-created temporary root.
      "file_change",
      "collab_tool_call",
      "collabAgentToolCall",
      "file_read",
      "grep",
      "glob",
    ].includes(item.type)
  )
    return {
      type: "darrow.parent_tool_before_goal",
      operation: item.type,
    };
  return undefined;
}

function acceptedGoalOwnerSpawn(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as {
    type?: unknown;
    item?: {
      tool?: unknown;
      status?: unknown;
      agent_ref?: unknown;
      prompt?: unknown;
      goal_spawn_attestation?: unknown;
    };
  };
  return (
    event.type === "item.completed" &&
    event.item?.tool === "spawn_agent" &&
    event.item.status === "completed" &&
    canonicalCodexAgentRef(event.item.agent_ref) === event.item.agent_ref &&
    (!!event.item.goal_spawn_attestation ||
      event.item.prompt === "- phase: adaptive-goal-owner")
  );
}

function retainedHumanFeedbackEvent(event: CodexEvent): unknown | undefined {
  const command = completedCommand(event);
  const payload = command ? shellPayload(command)?.trim() : undefined;
  if (!payload || !/(?:^|\/)feedbackctl answer rounding-mode$/.test(payload))
    return undefined;
  return {
    type: "darrow.human_feedback_answer",
    feedback_id: "rounding-mode",
    status: "completed",
  };
}

function retainedHostProtocolEvent(event: CodexEvent): unknown | undefined {
  if (
    event.type !== "darrow.route_applied" &&
    event.type !== "darrow.dimensions_applied" &&
    event.type !== "darrow.workflow_loaded"
  )
    return undefined;
  const allowed = [
    "type",
    "accepted",
    "threadId",
    "turnId",
    "selected",
    "effective",
    "appliedBy",
    "stage",
    "workflow",
    "risk",
    "file",
    "sha256",
  ];
  return Object.fromEntries(
    allowed.flatMap((key) =>
      event[key] === undefined ? [] : [[key, event[key]]],
    ),
  );
}

function retainedNestedApplication(event: CodexEvent): unknown | undefined {
  const item = event.item;
  if (
    event.type !== "item.completed" ||
    item?.type !== "command_execution" ||
    item.status !== "completed" ||
    item.exit_code !== 0 ||
    typeof item.aggregated_output !== "string" ||
    !/^format\tdarrow-native-goal-route-application-v1$/m.test(
      item.aggregated_output,
    ) ||
    !/^route_applied_by\tnested-session$/m.test(item.aggregated_output) ||
    !/^route_verified\ttrue$/m.test(item.aggregated_output)
  )
    return undefined;
  const protocol = item.aggregated_output
    .split("\n")
    .filter((line) =>
      /^(?:format|route_applied_by|route_verified|selected_route|effective_route)\t/.test(
        line,
      ),
    );
  const completed = codexEvents(item.aggregated_output)
    .filter((nested) => codexEventTypes(nested).includes("turn.completed"))
    .map(retainedTerminalEvent)
    .filter((nested): nested is object => nested !== undefined);
  return {
    type: "item.completed",
    item: {
      type: "command_execution",
      status: "completed",
      exit_code: 0,
      aggregated_output: [
        ...completed.map((value) => JSON.stringify(value)),
        ...protocol,
      ].join("\n"),
    },
  };
}

interface CodexRetentionStatus {
  exitCode: number;
  stderrPresent: boolean;
  spawnGuardSecret?: string;
  goalLoopPath?: string;
  acceptedAgentRef?: string;
  acceptedOwner?: AcceptedCodexOwner;
}

interface CodexRetentionState {
  goalOwnerAccepted: boolean;
  goalAttestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
  postGoalToolIds: Set<string>;
  pendingPostGoalCommands: Set<string>;
  goalOwnerReference?: string;
  activationState: "pending" | "recorded" | "rejected";
  goalPersistence: "none" | "confirmed" | "unavailable";
  waited: boolean;
  interrupted: boolean;
  closed: boolean;
  launchStopRecorded: boolean;
  objectiveReleased: boolean;
}

function retainCodexEvent(
  event: CodexEvent,
  state: CodexRetentionState,
  repoDir: string,
  status?: CodexRetentionStatus,
): object[] {
  if (event.type === "darrow.eval.follow_up_turn") return [event];
  const collaboration = retainedCollaborationEvent(
    event,
    status?.spawnGuardSecret,
    state.goalOwnerReference ?? status?.acceptedAgentRef,
  );
  const lifecycle = state.goalOwnerAccepted
    ? retainedPostGoalToolEvent(event, {
        seen: state.postGoalToolIds,
        repoDir,
        attestation: state.goalAttestation,
        goalLoopPath: status?.goalLoopPath,
        agentRef: state.goalOwnerReference,
        activationState: state.activationState,
        goalPersistence: state.goalPersistence,
        waited: state.waited,
        interrupted: state.interrupted,
        closed: state.closed,
        launchStopRecorded: state.launchStopRecorded,
        objectiveReleased: state.objectiveReleased,
      })
    : retainedPreGoalToolEvent(event, repoDir);
  const collaborationViolation = retainedCollaborationViolation(
    event,
    collaboration,
    state,
  );
  const postOwnerSpawn = retainedPostOwnerSpawnObservation(event, state);
  const values = [
    retainedTerminalEvent(event),
    retainedHostProtocolEvent(event),
    collaboration,
    retainedHumanFeedbackEvent(event),
    retainedNestedApplication(event),
    lifecycle,
    collaborationViolation,
    postOwnerSpawn,
  ].filter((value): value is object => value !== undefined);
  trackPostGoalCommand(event, state);
  acceptAttestedGoalSpawn(event, collaboration, state, status);
  updateGoalLifecycleState(event, collaboration, lifecycle, state);
  return values;
}

function runnerControlKind(event: CodexEvent): string | undefined {
  if (!acceptedCollaborationEvent(event)) return undefined;
  const tool = event.item?.tool;
  return typeof tool === "string" &&
    [
      "wait",
      "wait_agent",
      "followup_task",
      "send_message",
      "interrupt_agent",
      "close_agent",
    ].includes(tool)
    ? tool
    : undefined;
}

function retainedCollaborationViolation(
  event: CodexEvent,
  collaboration: unknown,
  state: CodexRetentionState,
): object | undefined {
  const tool = state.goalOwnerAccepted ? runnerControlKind(event) : undefined;
  if (!tool) return undefined;
  const activationRequired = ["wait", "wait_agent", "send_message"].includes(
    tool,
  );
  const invalidOrder = activationRequired
    ? state.activationState !== "recorded"
    : state.activationState === "pending";
  return !collaboration || invalidOrder
    ? { type: "darrow.parent_tool_after_goal", operation: tool }
    : undefined;
}

function retainedPostOwnerSpawnObservation(
  event: CodexEvent,
  state: CodexRetentionState,
): object | undefined {
  if (
    !state.goalOwnerAccepted ||
    !acceptedCollaborationEvent(event) ||
    event.item?.tool !== "spawn_agent"
  )
    return undefined;
  const senderRef = canonicalCodexAgentRef(event.item.sender_thread_id);
  if (senderRef === state.goalOwnerReference) return undefined;
  const agentRef = acceptedCollaborationAgentRef(event);
  return {
    type: "darrow.parent_spawn_after_goal",
    tool: "spawn_agent",
    status: event.item.status,
    ...(senderRef ? { sender_thread_id: senderRef } : {}),
    ...(agentRef ? { agent_ref: agentRef } : {}),
  };
}

function retainedEventType(value: unknown): string | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? String((value as { type?: unknown }).type ?? "") || undefined
    : undefined;
}

function updateGoalLifecycleState(
  event: CodexEvent,
  collaboration: unknown,
  lifecycle: unknown,
  state: CodexRetentionState,
): void {
  updateLedgerLifecycleState(lifecycle, state);
  if (collaboration) updateCollaborationLifecycleState(event, state);
}

function updateLedgerLifecycleState(
  lifecycle: unknown,
  state: CodexRetentionState,
): void {
  const type = retainedEventType(lifecycle);
  if (type === "darrow.goal_activation") state.activationState = "recorded";
  if (type === "darrow.goal_activation_rejected")
    state.activationState = "rejected";
  if (type === "darrow.goal_launch_stop") state.launchStopRecorded = true;
  if (type === "darrow.goal_persistence") {
    const status = (lifecycle as { status?: unknown }).status;
    if (status === "confirmed" || status === "unavailable")
      state.goalPersistence = status;
  }
  if (type === "darrow.objective_release") state.objectiveReleased = true;
}

function updateCollaborationLifecycleState(
  event: CodexEvent,
  state: CodexRetentionState,
): void {
  const tool = runnerControlKind(event);
  if (tool === "wait" || tool === "wait_agent") state.waited = true;
  if (tool === "interrupt_agent") state.interrupted = true;
  if (tool === "close_agent") state.closed = true;
}

function trackPostGoalCommand(
  event: CodexEvent,
  state: CodexRetentionState,
): void {
  const id = event.item?.id;
  if (!state.goalOwnerAccepted || typeof id !== "string") return;
  if (event.type === "item.started" && event.item?.type === "command_execution")
    state.pendingPostGoalCommands.add(id);
  if (event.type === "item.completed") state.pendingPostGoalCommands.delete(id);
}

function acceptAttestedGoalSpawn(
  event: CodexEvent,
  collaboration: unknown,
  state: CodexRetentionState,
  status?: CodexRetentionStatus,
): void {
  if (!acceptedGoalOwnerSpawn(collaboration)) return;
  const record = collaboration as { item?: { agent_ref?: unknown } };
  const acceptedReference = canonicalCodexAgentRef(record.item?.agent_ref);
  if (!acceptedReference) return;
  state.goalOwnerAccepted = true;
  state.goalOwnerReference = acceptedReference;
  // The accepted host spawn is the route-application boundary. There is no
  // separate lifecycle activation step in the simplified protocol.
  state.activationState = "recorded";
  if (!status?.spawnGuardSecret || typeof event.item?.prompt !== "string")
    return;
  state.goalAttestation = verifiedCodexSpawnAttestation(
    event.item.prompt,
    status.spawnGuardSecret,
  );
}

function appendCodexRetentionState(
  retained: object[],
  state: CodexRetentionState,
  options: {
    acceptedOwner?: AcceptedCodexOwner;
  },
): void {
  for (let index = 0; index < state.pendingPostGoalCommands.size; index++)
    retained.push({
      type: "darrow.parent_tool_after_goal",
      operation: "incomplete-command",
    });
  if (options.acceptedOwner) {
    const owner = options.acceptedOwner;
    const route = {
      harness: "codex",
      provider: "openai",
      model: owner.model,
      effort: owner.effort,
    };
    retained.push({
      type: "darrow.goal_owner_accepted",
      agent_ref: owner.agentRef,
      workflow: owner.workflow,
      risk: owner.risk,
      profile: owner.profile,
      selected: route,
      effective: route,
      applied_by: "native-subagent",
      launch_boundary: "native_subagent",
      child_invocations: 1,
    });
  }
}

/** Retain only bounded activation, orchestration, and terminal accounting evidence. */
function codexEvidenceSkillRoots(
  repoDir: string,
  installedSkillsRoot: string | string[],
) {
  return codexTrackedSkillRoots(repoDir, installedSkillsRoot);
}

function retainedCodexSkillReads(
  event: CodexEvent,
  skillsRoots: string[],
  retainedSkills: Set<string>,
): Record<string, unknown>[] {
  return observedSkillReads([event], skillsRoots).flatMap((skill) => {
    if (retainedSkills.has(skill)) return [];
    retainedSkills.add(skill);
    return [
      {
        type: "darrow.skill_read_probe",
        source: "skill_file_read_probe",
        skill,
        status: "completed",
      },
    ];
  });
}

export function retainedCodexEvidence(
  stream: string,
  repoDir: string,
  status?: CodexRetentionStatus,
  installedSkillsRoot: string | string[] = join(repoDir, ".agents", "skills"),
): string {
  const events = codexEvents(stream);
  const skillsRoots = codexEvidenceSkillRoots(repoDir, installedSkillsRoot);
  const retainedSkills = new Set<string>();
  const state: CodexRetentionState = {
    goalOwnerAccepted: false,
    goalAttestation: undefined,
    postGoalToolIds: new Set<string>(),
    pendingPostGoalCommands: new Set<string>(),
    goalOwnerReference: status?.acceptedAgentRef,
    activationState: "pending",
    goalPersistence: "none",
    waited: false,
    interrupted: false,
    closed: false,
    launchStopRecorded: false,
    objectiveReleased: false,
  };
  const retained = events.flatMap((event) => {
    return [
      ...retainCodexEvent(event, state, repoDir, status),
      ...retainedCodexSkillReads(event, skillsRoots, retainedSkills),
    ];
  });
  appendCodexRetentionState(retained, state, {
    acceptedOwner: status?.acceptedOwner,
  });
  if (codexStreamMalformed(stream)) retained.push({ type: "malformed_stream" });
  if (status && status.exitCode !== 0)
    retained.push({
      type: "harness_failure",
      exit_code: status.exitCode,
      stderr_present: status.stderrPresent,
    });
  return retained.map((event) => JSON.stringify(event)).join("\n");
}

interface CodexTokenUsage {
  complete: boolean;
  inputTokens: number;
  outputTokens: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function codexUsageCandidate(event: CodexEvent): {
  present: boolean;
  value?: unknown;
} {
  if ("usage" in event) return { present: true, value: event.usage };
  const message = isRecord(event.msg) ? event.msg : undefined;
  const messageInfo = isRecord(message?.info) ? message.info : undefined;
  if (messageInfo && "total_token_usage" in messageInfo)
    return { present: true, value: messageInfo.total_token_usage };
  const info = isRecord(event.info) ? event.info : undefined;
  if (info && "total_token_usage" in info)
    return { present: true, value: info.total_token_usage };
  return { present: false };
}

function normalizedCodexUsage(
  value: unknown,
): { input_tokens: number; output_tokens: number } | null {
  if (!isRecord(value)) return null;
  const input = value.input_tokens;
  const output = value.output_tokens;
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input < 0 ||
    typeof output !== "number" ||
    !Number.isFinite(output) ||
    output < 0
  )
    return null;
  return { input_tokens: input, output_tokens: output };
}

/** Codex reports cumulative usage repeatedly; the last report on the stream wins. */
export function codexTokenUsage(stream: string): CodexTokenUsage {
  let lastUsage: unknown;
  let found = false;
  for (const event of codexEvents(stream)) {
    const candidate = codexUsageCandidate(event);
    if (!candidate.present) continue;
    found = true;
    lastUsage = candidate.value;
  }
  const usage = normalizedCodexUsage(lastUsage);
  if (!found || !usage || codexStreamMalformed(stream))
    return { complete: false, inputTokens: 0, outputTokens: 0 };
  return {
    complete: true,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}

interface CodexArgvOptions {
  repoDir: string;
  prompt: string;
  model: string;
  effort: string;
  persistent?: boolean;
}

export function codexArgv(options: CodexArgvOptions): string[] {
  const { repoDir, prompt, model, effort, persistent = false } = options;
  const argv = [
    "codex",
    "exec",
    prompt,
    "--json",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "--skip-git-repo-check",
    "--ignore-rules",
    "--dangerously-bypass-hook-trust",
    "--dangerously-bypass-approvals-and-sandbox",
    // Final agent message lands under .git/ so checks can read it without
    // it ever appearing in the model's worktree (same trick as fixture-bin).
    "-o",
    join(repoDir, ".git", "last-message.md"),
  ];
  if (!persistent) argv.push("--ephemeral");
  return argv;
}

interface CodexResumeArgvOptions extends Omit<CodexArgvOptions, "persistent"> {
  threadId: string;
}

export function codexResumeArgv(options: CodexResumeArgvOptions): string[] {
  const { repoDir, threadId, prompt, model, effort } = options;
  return [
    "codex",
    "exec",
    "resume",
    threadId,
    prompt,
    "--json",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "--skip-git-repo-check",
    "--ignore-rules",
    "--dangerously-bypass-hook-trust",
    "--dangerously-bypass-approvals-and-sandbox",
    "-o",
    join(repoDir, ".git", "last-message.md"),
  ];
}

async function runCodexPluginCommand(
  argv: string[],
  env: Record<string, string>,
): Promise<string> {
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", env });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0)
    throw new Error(`Codex eval plugin setup failed (${code}): ${err.trim()}`);
  return out;
}

interface InstalledCodexEvalPlugins {
  pluginRoots: string[];
  skillsRoots: string[];
}

async function installCodexEvalPlugins(
  repoDir: string,
  env: Record<string, string>,
): Promise<InstalledCodexEvalPlugins> {
  const marketplace = join(repoDir, ".git", "eval-marketplace");
  const catalog = JSON.parse(
    await readFile(
      join(marketplace, ".claude-plugin", "marketplace.json"),
      "utf8",
    ),
  ) as { plugins?: unknown };
  if (!Array.isArray(catalog.plugins) || !catalog.plugins.length)
    throw new Error("Codex eval marketplace has no plugins");
  await runCodexPluginCommand(
    ["codex", "plugin", "marketplace", "add", marketplace, "--json"],
    env,
  );
  const pluginRoots: string[] = [];
  const skillsRoots: string[] = [];
  for (const entry of catalog.plugins) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { name?: unknown }).name !== "string" ||
      !(entry as { name: string }).name
    ) {
      throw new Error("Codex eval marketplace has an invalid plugin entry");
    }
    const name = (entry as { name: string }).name;
    const installed = JSON.parse(
      await runCodexPluginCommand(
        ["codex", "plugin", "add", `${name}@darrow-eval`, "--json"],
        env,
      ),
    ) as { installedPath?: unknown };
    if (typeof installed.installedPath !== "string" || !installed.installedPath)
      throw new Error(`Codex eval plugin install returned no path for ${name}`);
    const pluginRoot = await realpath(resolve(installed.installedPath));
    pluginRoots.push(pluginRoot);
    skillsRoots.push(await realpath(join(pluginRoot, "skills")));
  }
  return { pluginRoots, skillsRoots };
}

export async function codexEvalSkillsRoot(
  repoDir: string,
  env: Record<string, string>,
): Promise<string> {
  const catalog = join(
    repoDir,
    ".git",
    "eval-marketplace",
    ".claude-plugin",
    "marketplace.json",
  );
  if (!existsSync(catalog)) return join(repoDir, ".git", "eval-no-skills");
  const installed = await installCodexEvalPlugins(repoDir, env);
  return installed.skillsRoots[0] ?? join(repoDir, ".git", "eval-no-skills");
}

async function codexFinalMessage(repoDir: string): Promise<string> {
  try {
    return await readFile(join(repoDir, ".git", "last-message.md"), "utf8");
  } catch {
    // A missing final message is observable to output checks and raw output.
    return "";
  }
}

interface CodexExecution {
  canonicalRepoDir: string;
  installedSkillsRoots: string[];
  out: string;
  err: string;
  code: number;
  durationMs: number;
  spawnGuardSecret?: string;
  goalLoopPath?: string;
  acceptedAgentRef?: string;
  acceptedOwner?: AcceptedCodexOwner;
}

interface CodexSpawnGuard {
  secret: string;
  executablePath: string;
  writeDeniedPaths: string[];
  statePath: string;
}

interface CodexSpawnGuardPolicy {
  secret: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  requestSha256: string;
  objectiveRoot: string;
  goalLoopPath: string;
  statePath: string;
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

async function installCodexSpawnGuard(
  repoDir: string,
  env: Record<string, string>,
  options: {
    prompt: string;
    objectiveRoot: string;
    goalLoopPath: string;
  },
): Promise<CodexSpawnGuard> {
  const configRoot = env.CODEX_HOME;
  if (!configRoot) throw new Error("Codex eval has no isolated config root");
  const runtimeDir = join(repoDir, ".git", "darrow-eval", "codex-guard");
  await mkdir(runtimeDir, { recursive: true });
  const wrapperPath = join(runtimeDir, "codex-spawn-guard-entry.ts");
  const executablePath = join(runtimeDir, "codex-spawn-guard");
  const statePath = join(runtimeDir, "state");
  const hooksPath = join(configRoot, "hooks.json");
  const policy: CodexSpawnGuardPolicy = {
    secret: randomBytes(32).toString("hex"),
    baselineSha256: await repositoryFingerprint(repoDir),
    fixtureStateSha256: await fixtureStateFingerprint(repoDir),
    requestSha256: createHash("sha256").update(options.prompt).digest("hex"),
    objectiveRoot: options.objectiveRoot,
    goalLoopPath: options.goalLoopPath,
    statePath,
  };
  await compileCodexSpawnGuard(wrapperPath, executablePath, policy);
  await writeCodexSpawnHook(hooksPath, executablePath);
  return {
    secret: policy.secret,
    executablePath,
    writeDeniedPaths: [hooksPath],
    statePath,
  };
}

async function compileCodexSpawnGuard(
  wrapperPath: string,
  executablePath: string,
  policy: CodexSpawnGuardPolicy,
): Promise<void> {
  const guardSource = join(import.meta.dir, "..", "codex-spawn-guard.ts");
  await writeFile(
    wrapperPath,
    [
      `import { guardCodexSpawn } from ${JSON.stringify(guardSource)};`,
      "const input = JSON.parse(await new Response(Bun.stdin.stream()).text());",
      `const result = await guardCodexSpawn(input, ${JSON.stringify(policy)});`,
      "if (result) process.stdout.write(`${JSON.stringify(result)}\\n`);",
      "",
    ].join("\n"),
    { mode: 0o400 },
  );
  const build = Bun.spawn(
    [
      process.execPath,
      "build",
      "--compile",
      wrapperPath,
      "--outfile",
      executablePath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [buildOut, buildErr, buildCode] = await Promise.all([
    new Response(build.stdout).text(),
    new Response(build.stderr).text(),
    build.exited,
  ]);
  await rm(wrapperPath, { force: true });
  if (buildCode !== 0)
    throw new Error(
      `cannot compile Codex spawn guard: ${buildErr.trim() || buildOut.trim()}`,
    );
  await chmod(executablePath, 0o500);
}

async function writeCodexSpawnHook(
  hooksPath: string,
  executablePath: string,
): Promise<void> {
  await writeFile(
    hooksPath,
    `${JSON.stringify({
      hooks: {
        PreToolUse: ["Agent", "Bash", "apply_patch"].map((matcher) => ({
          matcher,
          hooks: [
            {
              type: "command",
              command: shellSingleQuote(executablePath),
              timeout: 30,
            },
          ],
        })),
      },
    })}\n`,
    { mode: 0o400 },
  );
}

interface CodexProcessContext {
  canonicalRepoDir: string;
  installedSkillsRoots: string[];
  installedPluginRoots: string[];
  goalLoopPath?: string;
  objectiveRoot: string;
  env: Record<string, string>;
  spawnGuard?: CodexSpawnGuard;
}

export function codexSpawnGuardRequested(
  prompt: string,
  followUpPrompt?: string,
): boolean {
  return [prompt, followUpPrompt].some((value) =>
    value?.includes("adaptive-goal"),
  );
}

async function installedCodexPluginContext(
  repoDir: string,
  env: Record<string, string>,
) {
  const catalog = join(
    repoDir,
    ".git",
    "eval-marketplace",
    ".claude-plugin",
    "marketplace.json",
  );
  const installed = existsSync(catalog)
    ? await installCodexEvalPlugins(repoDir, env)
    : { pluginRoots: [], skillsRoots: [] };
  return {
    installedSkillsRoots: installed.skillsRoots.length
      ? installed.skillsRoots
      : [join(repoDir, ".git", "eval-no-skills")],
    installedPluginRoots: installed.pluginRoots,
  };
}

async function codexProcessContext(
  repoDir: string,
  prompt: string,
  enableSpawnGuard: boolean,
): Promise<CodexProcessContext> {
  const canonicalRepoDir = await realpath(repoDir);
  const env = await isolatedHarnessEnvironment("codex", repoDir);
  const objectiveRoot = await realpath(
    await mkdtemp(
      join(process.env.TMPDIR ?? "/tmp", "darrow-codex-objective-"),
    ),
  );
  env.TMPDIR = objectiveRoot;
  const { installedSkillsRoots, installedPluginRoots } =
    await installedCodexPluginContext(repoDir, env);
  const goalLoopCandidate = installedPluginRoots
    .map((pluginRoot) => join(pluginRoot, "bin", "goal-loop"))
    .find((path) => existsSync(path));
  const goalLoopPath =
    goalLoopCandidate && existsSync(goalLoopCandidate)
      ? await realpath(goalLoopCandidate)
      : undefined;
  const spawnGuard =
    goalLoopPath && enableSpawnGuard
      ? await installCodexSpawnGuard(canonicalRepoDir, env, {
          prompt,
          objectiveRoot,
          goalLoopPath,
        })
      : undefined;
  return {
    canonicalRepoDir,
    installedSkillsRoots,
    installedPluginRoots,
    goalLoopPath,
    objectiveRoot,
    env,
    spawnGuard,
  };
}

interface CodexProcessOutput {
  out: string;
  err: string;
  code: number;
}

async function codexTurnOutput(options: {
  request: HarnessRunRequest;
  initial: CodexProcessOutput;
  sandboxed: (argv: string[]) => Promise<string[]>;
  env: Record<string, string>;
}): Promise<CodexProcessOutput> {
  const { request, initial, sandboxed, env } = options;
  const followUpPrompt = request.control?.followUpPrompt;
  if (!followUpPrompt || !codexRunSucceeded(initial.code, initial.out))
    return initial;
  const threadId = codexThreadId(initial.out);
  if (!threadId)
    throw new Error(
      "Codex follow-up eval could not identify exactly one initial thread",
    );
  const resumed = await runCodexProcess(
    await sandboxed(
      codexResumeArgv({ ...request, threadId, prompt: followUpPrompt }),
    ),
    request.repoDir,
    env,
  );
  const boundary = JSON.stringify({
    type: "darrow.eval.follow_up_turn",
    thread_id: threadId,
  });
  return {
    out: [initial.out.trimEnd(), boundary, resumed.out.trimStart()].join("\n"),
    err: [initial.err.trimEnd(), resumed.err.trimStart()]
      .filter(Boolean)
      .join("\n"),
    code: resumed.code,
  };
}

function codexSandboxedCommand(
  context: Awaited<ReturnType<typeof codexProcessContext>>,
  repoDir: string,
): (argv: string[]) => Promise<string[]> {
  const deniedPaths = [
    ...(context.spawnGuard?.writeDeniedPaths ?? []),
    join(context.canonicalRepoDir, ".git", "fixture-bin"),
    ...context.installedPluginRoots,
  ];
  const allowedExecutables = context.spawnGuard
    ? [context.spawnGuard.executablePath]
    : [];
  return (argv) =>
    sandboxedAgentCommand(argv, repoDir, deniedPaths, allowedExecutables);
}

function codexProcessContextForRequest(request: HarnessRunRequest) {
  return codexProcessContext(
    request.repoDir,
    request.prompt,
    request.control?.expectGoalOwner === true ||
      codexSpawnGuardRequested(request.prompt, request.control?.followUpPrompt),
  );
}

async function executeCodex(
  request: HarnessRunRequest,
): Promise<CodexExecution> {
  const start = performance.now();
  const { repoDir } = request;
  const context = await codexProcessContextForRequest(request);
  const { env, spawnGuard } = context;
  const sandboxed = codexSandboxedCommand(context, repoDir);
  try {
    const initial = await runCodexProcess(
      await sandboxed(
        codexArgv({
          ...request,
          persistent: !!request.control?.followUpPrompt,
        }),
      ),
      repoDir,
      env,
    );
    const { out, err, code } = await codexTurnOutput({
      request,
      initial,
      sandboxed,
      env,
    });
    const acceptedOwner = spawnGuard
      ? await verifiedCodexAcceptedOwner(
          spawnGuard.statePath,
          spawnGuard.secret,
          completedGoalOwnerAgentRef(out),
        )
      : undefined;
    return {
      canonicalRepoDir: context.canonicalRepoDir,
      installedSkillsRoots: context.installedSkillsRoots,
      out,
      err,
      code,
      durationMs: performance.now() - start,
      spawnGuardSecret: spawnGuard?.secret,
      goalLoopPath: context.goalLoopPath,
      acceptedAgentRef: acceptedOwner?.agentRef,
      acceptedOwner,
    };
  } finally {
    await rm(context.objectiveRoot, { recursive: true, force: true });
  }
}

async function runCodexProcess(
  argv: string[],
  repoDir: string,
  env: Record<string, string>,
): Promise<{ out: string; err: string; code: number }> {
  const proc = Bun.spawn(argv, {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    // Fixture mocks shadow real network tools for the harness and children.
    env: {
      ...env,
      DARROW_GOAL_LOOP_EXTERNAL_SANDBOX: "1",
      PATH: `${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`,
    },
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { out, err, code };
}

function codexActivationForRequest(
  request: HarnessRunRequest,
  execution: CodexExecution,
): SkillActivationObservation {
  const activationProbe = request.control?.activationProbe;
  if (activationProbe?.mode !== "explicit") {
    return codexSkillActivation(
      execution.out,
      execution.canonicalRepoDir,
      execution.installedSkillsRoots,
    );
  }
  return codexExplicitSkillActivation(
    execution.out,
    [request.prompt, request.control?.followUpPrompt]
      .filter((value): value is string => value !== undefined)
      .join("\n"),
    activationProbe,
  );
}

async function codexHarnessResult(
  request: HarnessRunRequest,
  execution: CodexExecution,
): Promise<HarnessResult> {
  const {
    canonicalRepoDir,
    installedSkillsRoots,
    out,
    err,
    code,
    durationMs,
    spawnGuardSecret,
    goalLoopPath,
    acceptedAgentRef,
    acceptedOwner,
  } = execution;
  const usage = codexTokenUsage(out);
  const ok = codexRunSucceeded(code, out);
  const resultText = await codexFinalMessage(request.repoDir);
  const activation = codexActivationForRequest(request, execution);
  return {
    ok,
    durationMs,
    tokenUsageComplete: usage.complete,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: null,
    resultText,
    raw: retainedCodexEvidence(
      out,
      canonicalRepoDir,
      {
        exitCode: code,
        stderrPresent: err.trim().length > 0,
        spawnGuardSecret,
        goalLoopPath,
        acceptedAgentRef,
        acceptedOwner,
      },
      installedSkillsRoots,
    ),
    skillActivation: { ...activation, complete: ok && activation.complete },
  };
}

/**
 * Runs the skill via headless Codex (`codex exec`). The fixture source is
 * installed into the isolated Codex plugin cache through a local marketplace,
 * matching installed-plugin discovery without a shadowing project skill.
 * Native approvals are bypassed inside the runner's outer OS sandbox.
 * Codex reports token usage in its JSONL event stream but no cost — costUsd
 * stays null for this adapter.
 */
export const codexAdapter: HarnessAdapter = {
  name: "codex",
  defaultModel: CODEX_EVAL_ROLE_DEFAULTS.candidate.model,
  skillMounts: [],
  sourceCodexPlugin: true,

  async version(): Promise<string> {
    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim();
  },

  async run(request): Promise<HarnessResult> {
    return codexHarnessResult(request, await executeCodex(request));
  },
};
