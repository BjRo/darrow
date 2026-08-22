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
import { basename, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type {
  HarnessAdapter,
  HarnessResult,
  SkillActivationObservation,
} from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";
import {
  fixtureStateFingerprint,
  repositoryFingerprint,
  verifiedCodexSpawnAttestation,
} from "../codex-spawn-guard";

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface CodexEvent {
  type?: unknown;
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
  };
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
  const path = `${escapeRegExp(skillsRoot)}/([A-Za-z0-9._-]+)/SKILL\\.md`;
  const payload = shellPayload(command);
  if (!payload) return [];
  const reader = new RegExp(
    `^(?:cat|sed(?:\\s+-n)?(?:\\s+['"]?[0-9,$pn;-]+['"]?)?|awk(?:\\s+['"][^'"]+['"])?|head(?:\\s+-n?\\s*[1-9][0-9]*)?|tail(?:\\s+-n?\\s*[1-9][0-9]*)?|less|more)\\s+${path}$`,
  );
  const reads: string[] = [];
  for (const segment of payload.split(/\s*(?:&&|;|\n)\s*/)) {
    const match = segment.match(reader);
    if (match?.[1]) reads.push(match[1]);
  }
  return reads;
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
  skillsRoot: string,
): string[] {
  const observedSkills: string[] = [];
  for (const event of events) {
    const command = completedCommand(event);
    const output = event.item?.aggregated_output;
    const skills = command ? skillReads(command, skillsRoot) : [];
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

/**
 * Codex exposes command events but no native skill-invocation event. Its skill
 * protocol requires the selected skill body to be read, so the first completed
 * mounted SKILL.md read is retained as an explicitly labeled behavior probe.
 */
export function codexSkillActivation(
  stream: string,
  repoDir: string,
  installedSkillsRoot = join(repoDir, ".agents", "skills"),
): SkillActivationObservation {
  const events = codexEvents(stream);
  const observedSkills = observedSkillReads(events, installedSkillsRoot);
  let completed = false;
  let failed = false;
  for (const event of events) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return {
    source: "skill_file_read_probe",
    complete:
      completed &&
      !failed &&
      !codexStreamMalformed(stream) &&
      !events.some(malformedCompletedCommand),
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

function retainedCollaborationPrompt(prompt: unknown): string | undefined {
  if (typeof prompt !== "string") return undefined;
  const lines = prompt.split("\n");
  if (lines[0] === "- phase: adaptive-goal-runner") return lines[0];
  const retained = lines
    .filter((line, index) => {
      if (line === "- phase: adaptive-goal-runner") return false;
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
): unknown | undefined {
  if (!acceptedCollaborationEvent(event)) return undefined;
  const item = event.item!;
  const prompt = retainedCollaborationPrompt(item.prompt);
  const attestation =
    spawnGuardSecret && typeof item.prompt === "string"
      ? verifiedCodexSpawnAttestation(item.prompt, spawnGuardSecret)
      : undefined;
  const publicAttestation = attestation
    ? {
        model: attestation.model,
        effort: attestation.effort,
        forkTurns: attestation.forkTurns,
        requestSha256: attestation.requestSha256,
        objectiveSha256: attestation.objectiveSha256,
        contractSha256: attestation.contractSha256,
        baselineSha256: attestation.baselineSha256,
        fixtureStateSha256: attestation.fixtureStateSha256,
        objectiveMode: attestation.objectiveMode,
      }
    : undefined;
  return {
    type: event.type,
    item: {
      type: item.type,
      tool: item.tool,
      status: item.status,
      sender_thread_id: item.sender_thread_id ?? item.senderThreadId,
      receiver_thread_ids: item.receiver_thread_ids ?? item.receiverThreadIds,
      ...(prompt ? { prompt } : {}),
      ...(publicAttestation
        ? { goal_spawn_attestation: publicAttestation }
        : {}),
    },
  };
}

interface PostGoalEvidenceContext {
  seen: Set<string>;
  repoDir: string;
  attestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
  goalLoopPath?: string;
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
  const release = retainedObjectiveReleaseEvent(
    event,
    context.attestation,
    context.goalLoopPath,
  );
  if (release) return release;
  return {
    type: "darrow.parent_tool_after_goal",
    operation: postGoalToolOperation(item, context.repoDir),
  };
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

function attestedGoalSpawn(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as {
    type?: unknown;
    item?: { tool?: unknown; goal_spawn_attestation?: unknown };
  };
  return (
    (event.type === "item.started" || event.type === "item.completed") &&
    event.item?.tool === "spawn_agent" &&
    !!event.item.goal_spawn_attestation
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
}

interface CodexRetentionState {
  goalOwnerAccepted: boolean;
  goalAttestation: ReturnType<typeof verifiedCodexSpawnAttestation>;
  postGoalToolIds: Set<string>;
  pendingPostGoalCommands: Set<string>;
}

function retainCodexEvent(
  event: CodexEvent,
  state: CodexRetentionState,
  repoDir: string,
  status?: CodexRetentionStatus,
): object[] {
  const collaboration = retainedCollaborationEvent(
    event,
    status?.spawnGuardSecret,
  );
  const lifecycle = state.goalOwnerAccepted
    ? retainedPostGoalToolEvent(event, {
        seen: state.postGoalToolIds,
        repoDir,
        attestation: state.goalAttestation,
        goalLoopPath: status?.goalLoopPath,
      })
    : retainedPreGoalToolEvent(event, repoDir);
  const values = [
    retainedTerminalEvent(event),
    retainedHostProtocolEvent(event),
    collaboration,
    retainedHumanFeedbackEvent(event),
    retainedNestedApplication(event),
    lifecycle,
  ].filter((value): value is object => value !== undefined);
  trackPostGoalCommand(event, state);
  acceptAttestedGoalSpawn(event, collaboration, state, status);
  return values;
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
  if (!attestedGoalSpawn(collaboration)) return;
  state.goalOwnerAccepted = true;
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
  events: CodexEvent[],
  installedSkillsRoot: string,
): void {
  for (let index = 0; index < state.pendingPostGoalCommands.size; index++)
    retained.push({
      type: "darrow.parent_tool_after_goal",
      operation: "incomplete-command",
    });
  for (const skill of observedSkillReads(events, installedSkillsRoot)) {
    retained.push({
      type: "darrow.skill_read_probe",
      source: "skill_file_read_probe",
      skill,
      status: "completed",
    });
  }
}

/** Retain only bounded activation, orchestration, and terminal accounting evidence. */
export function retainedCodexEvidence(
  stream: string,
  repoDir: string,
  status?: CodexRetentionStatus,
  installedSkillsRoot = join(repoDir, ".agents", "skills"),
): string {
  const events = codexEvents(stream);
  const state: CodexRetentionState = {
    goalOwnerAccepted: false,
    goalAttestation: undefined,
    postGoalToolIds: new Set<string>(),
    pendingPostGoalCommands: new Set<string>(),
  };
  const retained = events.flatMap((event) =>
    retainCodexEvent(event, state, repoDir, status),
  );
  appendCodexRetentionState(retained, state, events, installedSkillsRoot);
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

function codexArgv(
  repoDir: string,
  prompt: string,
  model: string,
  effort: string,
): string[] {
  return [
    "codex",
    "exec",
    prompt,
    "--json",
    "-m",
    model,
    "-c",
    `model_reasoning_effort="${effort}"`,
    "--skip-git-repo-check",
    "--ephemeral",
    "--ignore-rules",
    "--dangerously-bypass-hook-trust",
    "--dangerously-bypass-approvals-and-sandbox",
    // Final agent message lands under .git/ so checks can read it without
    // it ever appearing in the model's worktree (same trick as fixture-bin).
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

async function installCodexEvalPlugin(
  repoDir: string,
  env: Record<string, string>,
): Promise<string> {
  const marketplace = join(repoDir, ".git", "eval-marketplace");
  const manifest = JSON.parse(
    await readFile(
      join(marketplace, "plugin", ".codex-plugin", "plugin.json"),
      "utf8",
    ),
  ) as { name?: unknown };
  if (typeof manifest.name !== "string" || !manifest.name)
    throw new Error("Codex eval plugin manifest has no name");
  await runCodexPluginCommand(
    ["codex", "plugin", "marketplace", "add", marketplace, "--json"],
    env,
  );
  const installed = JSON.parse(
    await runCodexPluginCommand(
      ["codex", "plugin", "add", `${manifest.name}@darrow-eval`, "--json"],
      env,
    ),
  ) as { installedPath?: unknown };
  if (typeof installed.installedPath !== "string" || !installed.installedPath)
    throw new Error("Codex eval plugin install returned no installed path");
  return realpath(join(installed.installedPath, "skills"));
}

export async function codexEvalSkillsRoot(
  repoDir: string,
  env: Record<string, string>,
): Promise<string> {
  const manifest = join(
    repoDir,
    ".git",
    "eval-marketplace",
    "plugin",
    ".codex-plugin",
    "plugin.json",
  );
  return existsSync(manifest)
    ? installCodexEvalPlugin(repoDir, env)
    : join(repoDir, ".git", "eval-no-skills");
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
  installedSkillsRoot: string;
  out: string;
  err: string;
  code: number;
  durationMs: number;
  spawnGuardSecret?: string;
  goalLoopPath?: string;
}

interface CodexSpawnGuard {
  secret: string;
  executablePath: string;
  writeDeniedPaths: string[];
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
  installedSkillsRoot: string;
  installedPluginRoot?: string;
  goalLoopPath?: string;
  objectiveRoot: string;
  env: Record<string, string>;
  spawnGuard?: CodexSpawnGuard;
}

async function codexProcessContext(
  repoDir: string,
  prompt: string,
): Promise<CodexProcessContext> {
  const canonicalRepoDir = await realpath(repoDir);
  const env = await isolatedHarnessEnvironment("codex", repoDir);
  const objectiveRoot = await realpath(
    await mkdtemp(
      join(process.env.TMPDIR ?? "/tmp", "darrow-codex-objective-"),
    ),
  );
  env.TMPDIR = objectiveRoot;
  const installedSkillsRoot = await codexEvalSkillsRoot(repoDir, env);
  const installedPluginRoot =
    basename(installedSkillsRoot) === "skills"
      ? await realpath(join(installedSkillsRoot, ".."))
      : undefined;
  const goalLoopCandidate = installedPluginRoot
    ? join(installedPluginRoot, "bin", "goal-loop")
    : undefined;
  const goalLoopPath =
    goalLoopCandidate && existsSync(goalLoopCandidate)
      ? await realpath(goalLoopCandidate)
      : undefined;
  const spawnGuard = goalLoopPath
    ? await installCodexSpawnGuard(canonicalRepoDir, env, {
        prompt,
        objectiveRoot,
        goalLoopPath,
      })
    : undefined;
  return {
    canonicalRepoDir,
    installedSkillsRoot,
    installedPluginRoot,
    goalLoopPath,
    objectiveRoot,
    env,
    spawnGuard,
  };
}

async function executeCodex(
  repoDir: string,
  prompt: string,
  model: string,
  effort: string,
): Promise<CodexExecution> {
  const start = performance.now();
  const context = await codexProcessContext(repoDir, prompt);
  const { env, spawnGuard } = context;
  const argv = await sandboxedAgentCommand(
    codexArgv(repoDir, prompt, model, effort),
    repoDir,
    [
      ...(spawnGuard?.writeDeniedPaths ?? []),
      join(context.canonicalRepoDir, ".git", "fixture-bin"),
      ...(context.installedPluginRoot ? [context.installedPluginRoot] : []),
    ],
    spawnGuard ? [spawnGuard.executablePath] : [],
  );
  try {
    const proc = Bun.spawn(argv, {
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
      // Fixture mocks (e.g. gh) shadow real network tools for the harness
      // and every subprocess it spawns.
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
    return {
      canonicalRepoDir: context.canonicalRepoDir,
      installedSkillsRoot: context.installedSkillsRoot,
      out,
      err,
      code,
      durationMs: performance.now() - start,
      spawnGuardSecret: spawnGuard?.secret,
      goalLoopPath: context.goalLoopPath,
    };
  } finally {
    await rm(context.objectiveRoot, { recursive: true, force: true });
  }
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
  defaultModel: "gpt-5.5",
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

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const execution = await executeCodex(repoDir, prompt, model, effort);
    const {
      canonicalRepoDir,
      installedSkillsRoot,
      out,
      err,
      code,
      durationMs,
      spawnGuardSecret,
      goalLoopPath,
    } = execution;

    const {
      complete: tokenUsageComplete,
      inputTokens,
      outputTokens,
    } = codexTokenUsage(out);
    const ok = codexRunSucceeded(code, out);
    const resultText = await codexFinalMessage(repoDir);
    const skillActivation = codexSkillActivation(
      out,
      canonicalRepoDir,
      installedSkillsRoot,
    );

    return {
      ok,
      durationMs,
      tokenUsageComplete,
      inputTokens,
      outputTokens,
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
        },
        installedSkillsRoot,
      ),
      skillActivation: {
        ...skillActivation,
        complete: ok && skillActivation.complete,
      },
    };
  },
};
