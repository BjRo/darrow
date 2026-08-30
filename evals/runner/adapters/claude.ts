import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";
import type {
  HarnessAdapter,
  HarnessResult,
  HarnessRunRequest,
  SkillActivationObservation,
} from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";
import { parseGoalReport, validGoalReportValues } from "../goal-report";

function isHumanFeedbackPauseText(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const marker = text.match(/^- phase: human-feedback-request\r?\n/);
  return !!marker && text.slice(marker[0].length).trim().length > 0;
}

export interface ClaudeUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function claudeInputTokens(usage: ClaudeUsage | undefined): number {
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  );
}

export function claudeRunSucceeded(
  code: number,
  result: { subtype?: string; is_error?: boolean },
): boolean {
  return (
    code === 0 && result.subtype === "success" && result.is_error === false
  );
}

interface ClaudeResultEnvelope {
  type?: unknown;
  thread_id?: unknown;
  task_id?: unknown;
  tool_use_id?: unknown;
  status?: unknown;
  parent_tool_use_id?: unknown;
  subtype?: string;
  is_error?: boolean;
  usage?: unknown;
  total_cost_usd?: unknown;
  result?: unknown;
  message?: unknown;
}

function isTopLevelClaudeEvent(event: ClaudeResultEnvelope): boolean {
  return !(
    typeof event.parent_tool_use_id === "string" &&
    event.parent_tool_use_id.length > 0
  );
}

interface ClaudeOutcome {
  ok: boolean;
  tokenUsageComplete: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  resultText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validAssistantContentBlock(
  value: unknown,
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (value.type !== "tool_use" || value.name !== "Skill") return true;
  return (
    isRecord(value.input) &&
    typeof value.input.skill === "string" &&
    !!value.input.skill.split(":").pop()?.trim()
  );
}

function validResultEnvelope(value: Record<string, unknown>): boolean {
  return (
    typeof value.subtype === "string" &&
    !!value.subtype.trim() &&
    typeof value.is_error === "boolean" &&
    typeof value.result === "string"
  );
}

function validStreamEvent(value: unknown): value is ClaudeResultEnvelope {
  if (!isRecord(value)) return false;
  if (value.type === "result") return validResultEnvelope(value);
  if (value.type !== "assistant") return true;
  const message = value.message;
  return (
    isRecord(message) &&
    Array.isArray(message.content) &&
    message.content.every(validAssistantContentBlock)
  );
}

function isNonnegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

type CompleteClaudeUsage = Required<Pick<ClaudeUsage, "input_tokens">> & {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens: number;
};

function completeClaudeUsage(value: unknown): CompleteClaudeUsage | null {
  if (!isRecord(value)) return null;
  const optionalBuckets = [
    value.cache_creation_input_tokens,
    value.cache_read_input_tokens,
  ];
  if (
    !isNonnegativeFiniteNumber(value.input_tokens) ||
    !isNonnegativeFiniteNumber(value.output_tokens) ||
    optionalBuckets.some(
      (bucket) => bucket !== undefined && !isNonnegativeFiniteNumber(bucket),
    )
  )
    return null;
  return value as CompleteClaudeUsage;
}

function sumKnownCosts(results: ClaudeResultEnvelope[]): number | null {
  const costs = results.map((result) => result.total_cost_usd);
  return costs.every(isNonnegativeFiniteNumber)
    ? costs.reduce((total, cost) => total + cost, 0)
    : null;
}

interface ClaudeStream {
  events: ClaudeResultEnvelope[];
  malformed: boolean;
}

function claudeStream(stream: string): ClaudeStream {
  const events: ClaudeResultEnvelope[] = [];
  let malformed = false;
  for (const line of stream.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event: unknown = JSON.parse(line);
      if (validStreamEvent(event)) events.push(event);
      else malformed = true;
    } catch {
      malformed = true;
    }
  }
  return { events, malformed };
}

export function claudeResultAccounting(
  streamText: string,
  code: number,
): ClaudeOutcome {
  const stream = claudeStream(streamText);
  const results = stream.events.filter((event) => event.type === "result");
  const final = results.at(-1);
  const usages = results.map((result) => completeClaudeUsage(result.usage));
  return {
    ok:
      !stream.malformed &&
      !!final &&
      claudeRunSucceeded(code, final) &&
      results.every((result) => claudeRunSucceeded(0, result)),
    tokenUsageComplete:
      !stream.malformed && results.length > 0 && usages.every(Boolean),
    inputTokens: usages.reduce(
      (total, usage) => total + claudeInputTokens(usage ?? undefined),
      0,
    ),
    outputTokens: usages.reduce(
      (total, usage) => total + (usage?.output_tokens ?? 0),
      0,
    ),
    costUsd:
      !stream.malformed && results.length ? sumKnownCosts(results) : null,
    resultText: typeof final?.result === "string" ? final.result : "",
  };
}

function claudeContent(event: ClaudeResultEnvelope): Record<string, unknown>[] {
  if (!isRecord(event.message) || !Array.isArray(event.message.content))
    return [];
  return event.message.content.filter(isRecord);
}

function claudeSkillName(block: unknown): string | undefined {
  if (!isRecord(block)) return undefined;
  const input = isRecord(block.input) ? block.input : undefined;
  if (
    block.type !== "tool_use" ||
    block.name !== "Skill" ||
    typeof input?.skill !== "string"
  )
    return undefined;
  return input.skill.split(":").pop()?.trim() || undefined;
}

function uniqueSkills(events: ClaudeResultEnvelope[]): string[] {
  const skills = events.flatMap((event) =>
    event.type === "assistant" ? claudeContent(event).map(claudeSkillName) : [],
  );
  return [...new Set(skills.filter((skill): skill is string => !!skill))];
}

function retainedSkillBlocks(event: ClaudeResultEnvelope) {
  if (event.type !== "assistant") return [];
  return claudeContent(event).flatMap((block) => {
    const skill = claudeSkillName(block);
    return skill ? [{ type: "tool_use", name: "Skill", input: { skill } }] : [];
  });
}

function retainedAgentPromptMarker(prompt: unknown): string | undefined {
  if (typeof prompt !== "string") return undefined;
  const first = prompt.split("\n", 1)[0];
  return first &&
    /^(?:- review_axis: (?:standards|spec)|- phase: (?:adaptive-goal-(?:owner|runner)|blocked-goal-response))$/.test(
      first,
    )
    ? first
    : undefined;
}

function normalizedReviewAgentInput(block: Record<string, unknown>) {
  if (block.type !== "tool_use" || block.name !== "Agent") return undefined;
  if (typeof block.id !== "string") return undefined;
  const input = isRecord(block.input) ? block.input : undefined;
  if (!input) return undefined;
  const rawSubagentType = input.subagent_type ?? input.subagentType;
  const subagentType =
    typeof rawSubagentType === "string" ? rawSubagentType : "unknown";
  const prompt = retainedAgentPromptMarker(input.prompt);
  return {
    id: block.id,
    subagentType,
    prompt,
    runInBackground: input.run_in_background,
    model: input.model,
    resume: input.resume,
    isolation: input.isolation,
  };
}

function retainedReviewAgentBlocks(event: ClaudeResultEnvelope) {
  if (event.type !== "assistant") return [];
  return claudeContent(event).flatMap((block) => {
    const input = normalizedReviewAgentInput(block);
    if (!input) return [];
    return [
      {
        type: "tool_use",
        name: "Agent",
        id: input.id,
        input: {
          subagent_type: input.subagentType,
          ...(typeof input.runInBackground === "boolean"
            ? { run_in_background: input.runInBackground }
            : {}),
          ...(typeof input.model === "string" ? { model: input.model } : {}),
          ...(typeof input.resume === "string" ? { resume: input.resume } : {}),
          ...(typeof input.isolation === "string"
            ? { isolation: input.isolation }
            : {}),
          ...(input.prompt
            ? { prompt: input.prompt }
            : { prompt_marker: "invalid" }),
        },
      },
    ];
  });
}

function hostReportedAgentId(block: Record<string, unknown>) {
  if (!successfulToolResult(block)) return undefined;
  const last = block.content.at(-1);
  const text = textContent(last);
  if (!text) return undefined;
  const match = text.match(
    /^agentId: ([A-Za-z0-9]+) \(use SendMessage with to: '([A-Za-z0-9]+)'[\s\S]*\n<usage>[\s\S]*<\/usage>$/,
  );
  const agentId = match?.[1];
  if (!agentId || agentId !== match?.[2]) return undefined;
  return { toolUseId: block.tool_use_id, agentId };
}

function successfulToolResult(block: Record<string, unknown>): block is Record<
  string,
  unknown
> & {
  type: "tool_result";
  tool_use_id: string;
  content: unknown[];
} {
  return [
    block.type === "tool_result",
    typeof block.tool_use_id === "string",
    block.is_error !== true,
    Array.isArray(block.content),
  ].every(Boolean);
}

function textContent(block: unknown): string | undefined {
  return isRecord(block) &&
    block.type === "text" &&
    typeof block.text === "string"
    ? block.text
    : undefined;
}

function retainedReviewAgentResults(event: ClaudeResultEnvelope) {
  if (event.type !== "user") return [];
  return claudeContent(event).flatMap((block) => {
    const result = hostReportedAgentId(block);
    return result ? [result] : [];
  });
}

interface PendingGoalAgent {
  subagentType: string;
}

interface CompletedGoalAgent extends PendingGoalAgent {
  agentId: string;
  feedbackPending: boolean;
}

interface PendingGoalAgentResume extends CompletedGoalAgent {
  goalToolUseId: string;
  dispatched: boolean;
  response: string;
  mode: "blocked" | "feedback";
}

interface PendingBlockedResponseAcquisition {
  mode: "answer" | "continue" | "retry" | "waive";
  operation: string;
}

interface PendingRouteGate {
  goalToolUseId: string;
  agentId: string;
  selectedModel: string;
  selectedEffort: string;
  observedRouteTrusted: boolean;
}

interface PendingGoalReport {
  id: string;
  status: "complete" | "blocked" | "launch-required";
}

export function goalReportRequiresObjectiveRelease(
  status: PendingGoalReport["status"] | undefined,
): boolean {
  return status !== "blocked";
}

interface GoalAttachment {
  attachmentDir: string;
  contractSha256: string;
}

interface MaterializedGoalObjective {
  status: "inline" | "file-backed";
  contractFile: string;
  contractSha256: string;
  objectiveFile: string;
  attachment: GoalAttachment | null;
}

interface StagedGoalObjective {
  block: Record<string, unknown>;
  toolUseId: string;
  path: string;
  sha256: string;
  pathBound: boolean;
}

interface StagingRegistrationCall {
  id: string;
  goalFile: string;
}

type ClaudePreflightStage =
  | "start"
  | "start-pending"
  | "prepare"
  | "prepare-pending"
  | "route"
  | "route-pending"
  | "runner"
  | "runner-pending"
  | "decision"
  | "complete"
  | "failed";

type PendingClaudePreflight =
  | { id: string; kind: "start" }
  | { id: string; kind: "prepare" }
  | { id: string; kind: "route"; profile: string; decisionGated?: true }
  | { id: string; kind: "runner"; model: string; effort: string };

interface SelectedClaudeRoute {
  model: string;
  effort: string;
}

const adaptiveGoalRunner =
  /^darrow-goal-loop:adaptive-goal-(?:sonnet-5-(?:low|medium)|opus-5-high)$/;

function retainGoalAgentStarts(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (state.goalAgentStarted) return;
  if (retainInlineGoalAgentStart(event, state)) return;
  retainLegacyGoalAgentStart(event, state);
}

function retainInlineGoalAgentStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
): boolean {
  for (const block of claudeContent(event)) {
    const start = inlineGoalAgentStart(block);
    if (!start) continue;
    state.pendingGoalAgents.set(start.id, start.pending);
    state.goalAgentStarted = true;
    state.inlineGoalOwner = true;
    return true;
  }
  return false;
}

function retainLegacyGoalAgentStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
): void {
  const objective = state.materializedObjective;
  if (
    !objective ||
    !state.stagingReleased ||
    state.preflightStage !== "complete" ||
    !state.resolvedGoalRunner ||
    !state.provisionalActivationRecorded
  )
    return;
  for (const block of claudeContent(event)) {
    const start = goalAgentStart(block, objective);
    if (start?.pending.subagentType !== state.resolvedGoalRunner) continue;
    state.pendingGoalAgents.set(start.id, start.pending);
    state.goalAgentStarted = true;
    return;
  }
}

function inlineGoalAgentStart(block: unknown) {
  if (!isRecord(block)) return undefined;
  const input = normalizedReviewAgentInput(block);
  const rawPrompt = isRecord(block.input) ? block.input.prompt : undefined;
  if (
    !input ||
    !adaptiveGoalRunner.test(input.subagentType) ||
    input.runInBackground !== false ||
    input.model !== undefined ||
    typeof rawPrompt !== "string" ||
    !rawPrompt.startsWith("- phase: adaptive-goal-owner\n") ||
    !completeInlineOwnerContract(rawPrompt, input.subagentType)
  )
    return undefined;
  return { id: input.id, pending: { subagentType: input.subagentType } };
}

const REQUIRED_INLINE_OWNER_LABELS = [
  "Role",
  "Outcome",
  "Acceptance criteria",
  "Scope",
  "Permissions",
  "Workflow",
  "Risk",
  "Profile",
  "Selected route",
  "Capability bindings",
  "Verification",
  "Completion evidence",
] as const;

function inlineOwnerField(prompt: string, label: string): string | undefined {
  const prefix = `${label}:`;
  const values = prompt
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
  return values.length === 1 && values[0] ? values[0] : undefined;
}

function inlineOwnerToken(value: string | undefined): string | undefined {
  return value?.match(/^`?([a-z][a-z-]*)`?(?:[. ]|$)/)?.[1];
}

function matchingInlineOwnerRoute(
  selectedRoute: string | undefined,
  subagentType: string,
): boolean {
  const route = routeForGoalRunner(subagentType);
  const selected = selectedRoute?.match(
    /^`?claude\s*[|/]\s*anthropic\s*[|/]\s*(claude-[A-Za-z0-9._-]+)\s*[|/]\s*(low|medium|high|xhigh|max)`?\.?$/,
  );
  return !!(
    route &&
    selected?.[1] === route.model &&
    selected[2] === route.effort
  );
}

function validInlineOwnerDimensions(
  fields: Record<string, string | undefined>,
): boolean {
  return (
    [
      "fix-bug",
      "implement-feature",
      "change-feature",
      "refactor",
      "migration",
      "mechanical",
    ].includes(inlineOwnerToken(fields.Workflow) ?? "") &&
    ["routine", "elevated", "high"].includes(
      inlineOwnerToken(fields.Risk) ?? "",
    ) &&
    ["routine", "routine-plus", "scaled", "repo-wide", "judgment"].includes(
      inlineOwnerToken(fields.Profile) ?? "",
    )
  );
}

function completeInlineOwnerContract(
  prompt: string,
  subagentType: string,
): boolean {
  const fields = Object.fromEntries(
    REQUIRED_INLINE_OWNER_LABELS.map((label) => [
      label,
      inlineOwnerField(prompt, label),
    ]),
  );
  if (Object.values(fields).some((value) => value === undefined)) return false;
  if (
    fields.Role !==
    "You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner."
  )
    return false;
  return (
    matchingInlineOwnerRoute(fields["Selected route"], subagentType) &&
    validInlineOwnerDimensions(fields)
  );
}

function retainGoalAgentResumeStarts(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const continuation = resumableGoalAgentResponse(event, state);
  if (!continuation) return;
  const [goalToolUseId, goal] = [...state.completedGoalAgents.entries()][0]!;
  const { mode, response } = continuation;
  for (const block of claudeContent(event)) {
    const input = normalizedSendMessageInput(block);
    if (!input) continue;
    const issue =
      mode === "blocked"
        ? blockedGoalSendIssue(input, goal, response)
        : feedbackGoalSendIssue(input, goal, response);
    if (issue) continue;
    state.pendingGoalResumes.set(input.id, {
      ...goal,
      goalToolUseId,
      dispatched: false,
      response,
      mode,
    });
    if (mode === "blocked") {
      state.blockedGoalResponse = undefined;
      state.reportRendered = false;
      state.renderedGoalStatus = undefined;
    } else {
      state.humanFeedbackResponse = undefined;
    }
    return;
  }
}

function resumableGoalAgentResponse(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
): { mode: "blocked" | "feedback"; response: string } | undefined {
  if (
    event.type !== "assistant" ||
    state.completedGoalAgents.size !== 1 ||
    state.pendingGoalResumes.size !== 0
  )
    return undefined;
  const goal = [...state.completedGoalAgents.values()][0]!;
  if (goal.feedbackPending && state.humanFeedbackResponse)
    return { mode: "feedback", response: state.humanFeedbackResponse };
  if (
    state.reportRendered &&
    state.renderedGoalStatus === "blocked" &&
    state.blockedGoalResponse
  )
    return { mode: "blocked", response: state.blockedGoalResponse };
  return undefined;
}

const blockedGoalResumeSummary =
  "Resume blocked adaptive goal with user response";
const feedbackGoalResumeSummary = "Resume adaptive goal with human feedback";

function blockedGoalResponsePromptIssue(prompt: string): string | undefined {
  const marker = "- phase: blocked-goal-response";
  if (!prompt.startsWith(`${marker}\n`)) return "marker";
  return prompt.slice(marker.length + 1).trim().length > 0
    ? undefined
    : "response-missing";
}

function normalizedSendMessageInput(block: unknown) {
  if (!isRecord(block) || block.type !== "tool_use") return undefined;
  if (block.name !== "SendMessage" || typeof block.id !== "string")
    return undefined;
  if (!isRecord(block.input)) return undefined;
  const { to, summary, message } = block.input;
  if (
    typeof to !== "string" ||
    typeof summary !== "string" ||
    typeof message !== "string"
  )
    return undefined;
  return { id: block.id, to, summary, message };
}

function blockedGoalSendIssue(
  input: NonNullable<ReturnType<typeof normalizedSendMessageInput>>,
  goal: CompletedGoalAgent,
  expectedResponse: string,
): string | undefined {
  if (input.to !== goal.agentId) return "agent-id-invalid";
  if (input.summary !== blockedGoalResumeSummary) return "summary-invalid";
  const promptIssue = blockedGoalResponsePromptIssue(input.message);
  if (promptIssue) return promptIssue;
  const marker = "- phase: blocked-goal-response\n";
  return input.message.slice(marker.length) === expectedResponse
    ? undefined
    : "response-mismatch";
}

function feedbackGoalSendIssue(
  input: NonNullable<ReturnType<typeof normalizedSendMessageInput>>,
  goal: CompletedGoalAgent,
  expectedResponse: string,
): string | undefined {
  if (input.to !== goal.agentId) return "agent-id-invalid";
  if (input.summary !== feedbackGoalResumeSummary) return "summary-invalid";
  const marker = "- phase: human-feedback-response\n";
  if (!input.message.startsWith(marker)) return "marker";
  return input.message.slice(marker.length) === expectedResponse
    ? undefined
    : "response-mismatch";
}

function goalAgentStart(block: unknown, objective: MaterializedGoalObjective) {
  if (!isRecord(block)) return undefined;
  const input = normalizedReviewAgentInput(block);
  if (!input || !isRecord(block.input)) return undefined;
  const valid = [
    adaptiveGoalRunner.test(input.subagentType),
    input.runInBackground === false,
    input.model === undefined,
    input.prompt === "- phase: adaptive-goal-runner",
    boundGoalAgentPrompt(block.input.prompt, objective),
  ].every(Boolean);
  if (!valid) return undefined;
  return { id: input.id, pending: { subagentType: input.subagentType } };
}

function boundGoalAgentPrompt(
  prompt: unknown,
  objective: MaterializedGoalObjective,
) {
  return goalAgentPromptIssue(prompt, objective) === undefined;
}

function goalAgentPromptIssue(
  prompt: unknown,
  objective: MaterializedGoalObjective,
): string | undefined {
  if (typeof prompt !== "string") return "shape";
  const marker = "- phase: adaptive-goal-runner";
  if (!prompt.startsWith(`${marker}\n`)) return "marker";
  const body = prompt.slice(marker.length + 1);
  const boundedObjective =
    objective.status === "file-backed"
      ? `- objective_file: ${objective.objectiveFile}`
      : null;
  if (!boundedObjective)
    return sha256Text(body) === objective.contractSha256
      ? undefined
      : "body-mismatch";
  if (body === boundedObjective) return undefined;
  if (body.startsWith(`${boundedObjective}\n`)) return "body-mismatch";
  if (body.includes(boundedObjective)) return "body-reference-not-leading";
  if (boundedObjective.startsWith(body)) return "body-truncated";
  return "body-mismatch";
}

function sha256Text(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex");
}

function retainedGoalAgentCompletions(
  event: ClaudeResultEnvelope,
  pending: Map<string, PendingGoalAgent>,
  completed: Map<string, CompletedGoalAgent>,
) {
  if (event.type !== "user") return [];
  return claudeContent(event).flatMap((block) => {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      typeof block.tool_use_id !== "string"
    )
      return [];
    const call = pending.get(block.tool_use_id);
    if (!call) return [];
    pending.delete(block.tool_use_id);
    const result = hostReportedAgentId(block);
    const feedbackPending = isHumanFeedbackPauseText(
      goalAgentChildResultText(block),
    );
    if (block.is_error !== true && result)
      completed.set(block.tool_use_id, {
        subagentType: call.subagentType,
        agentId: result.agentId,
        feedbackPending,
      });
    return [
      {
        type: "darrow.goal_agent_completion",
        tool_use_id: block.tool_use_id,
        subagent_type: call.subagentType,
        status: block.is_error === true ? "failed" : "completed",
        ...(result ? { agent_id: result.agentId } : {}),
        ...(feedbackPending ? { feedback_pending: true } : {}),
      },
    ];
  });
}

function dispatchedGoalResumeEvidence(
  toolUseId: string,
  call: PendingGoalAgentResume,
): unknown[] {
  return [
    {
      type: "darrow.goal_agent_resume_dispatched",
      tool_use_id: toolUseId,
      goal_tool_use_id: call.goalToolUseId,
      agent_id: call.agentId,
      same_owner: true,
    },
    ...(call.mode === "feedback"
      ? [
          {
            type: "darrow.human_feedback_relay",
            answer: call.response,
            agent_id: call.agentId,
            same_owner: true,
          },
        ]
      : []),
  ];
}

function failedGoalResumeEvidence(
  toolUseId: string,
  call: PendingGoalAgentResume,
  resumedAgentId?: string,
): unknown[] {
  return [
    {
      type: "darrow.goal_agent_resumption",
      tool_use_id: toolUseId,
      goal_tool_use_id: call.goalToolUseId,
      subagent_type: call.subagentType,
      agent_id: call.agentId,
      ...(resumedAgentId ? { observed_agent_id: resumedAgentId } : {}),
      status: "failed",
      same_owner: false,
    },
  ];
}

function retainedGoalAgentResumeResults(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "user") return [];
  return claudeContent(event).flatMap((block) => {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      typeof block.tool_use_id !== "string"
    )
      return [];
    const call = state.pendingGoalResumes.get(block.tool_use_id);
    if (!call || call.dispatched) return [];
    const resumedAgentId = hostReportedResumedAgentId(block);
    const dispatched =
      block.is_error !== true && resumedAgentId === call.agentId;
    if (dispatched) {
      call.dispatched = true;
      return dispatchedGoalResumeEvidence(block.tool_use_id, call);
    }
    state.pendingGoalResumes.delete(block.tool_use_id);
    restoreGoalResume(state, call);
    return failedGoalResumeEvidence(block.tool_use_id, call, resumedAgentId);
  });
}

function hostReportedResumedAgentId(block: Record<string, unknown>) {
  const text = toolResultText(block).trim();
  if (!text) return undefined;
  try {
    const result: unknown = JSON.parse(text);
    return isRecord(result) &&
      result.success === true &&
      typeof result.resumedAgentId === "string"
      ? result.resumedAgentId
      : undefined;
  } catch {
    return undefined;
  }
}

function retainedGoalAgentResumeNotifications(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (
    event.type !== "system" ||
    event.subtype !== "task_notification" ||
    typeof event.tool_use_id !== "string"
  )
    return [];
  const call = state.pendingGoalResumes.get(event.tool_use_id);
  if (!call || !call.dispatched) return [];
  state.pendingGoalResumes.delete(event.tool_use_id);
  const completed = completedGoalResumeNotification(event, call);
  applyGoalResumeNotification(state, call, completed);
  return [
    {
      type: "darrow.goal_agent_resumption",
      tool_use_id: event.tool_use_id,
      goal_tool_use_id: call.goalToolUseId,
      subagent_type: call.subagentType,
      agent_id: call.agentId,
      ...(typeof event.task_id === "string"
        ? { observed_agent_id: event.task_id }
        : {}),
      status: completed ? "completed" : "failed",
      same_owner: completed,
    },
  ];
}

function applyGoalResumeNotification(
  state: ClaudeEvidenceState,
  call: PendingGoalAgentResume,
  completed: boolean,
): void {
  if (!completed) {
    restoreGoalResume(state, call);
    return;
  }
  const goal = state.completedGoalAgents.get(call.goalToolUseId);
  if (goal && call.mode === "feedback") goal.feedbackPending = false;
}

function completedGoalResumeNotification(
  event: ClaudeResultEnvelope,
  call: PendingGoalAgentResume,
): boolean {
  return event.status === "completed" && event.task_id === call.agentId;
}

function restoreGoalResume(
  state: ClaudeEvidenceState,
  call: PendingGoalAgentResume,
): void {
  if (call.mode === "feedback") {
    state.humanFeedbackResponse = call.response;
  } else {
    state.blockedGoalResponse = call.response;
    state.reportRendered = true;
    state.renderedGoalStatus = "blocked";
  }
}

function bashToolCommand(block: unknown) {
  if (!isRecord(block)) return undefined;
  if (block.type !== "tool_use" || block.name !== "Bash") return undefined;
  if (typeof block.id !== "string" || !isRecord(block.input)) return undefined;
  if (typeof block.input.command !== "string") return undefined;
  return { id: block.id, command: block.input.command };
}

function matchingToolResult(
  block: unknown,
  toolUseId: string,
): block is Record<string, unknown> {
  return (
    isRecord(block) &&
    block.type === "tool_result" &&
    block.tool_use_id === toolUseId
  );
}

function literalShellWords(command: string): string[] | undefined {
  const normalized = command.replace(/\\\r?\n[ \t]*/g, " ");
  if (normalized !== normalized.trim()) return undefined;
  const words: string[] = [];
  const token =
    /(?:'([^'\r\n]*)'|"([^"$`\\\r\n]*)"|([A-Za-z0-9_./:@,+%=-]+))(?:[ \t]+|$)/y;
  let index = 0;
  while (index < normalized.length) {
    token.lastIndex = index;
    const match = token.exec(normalized);
    if (!match) return undefined;
    words.push(match[1] ?? match[2] ?? match[3]!);
    index = token.lastIndex;
  }
  return words;
}

interface ClaudeEvidenceContext {
  repoDir: string;
  pluginDir: string;
  stagingRoot: string;
  observedRouteTrusted: boolean;
  engineeringRequest?: string;
  followUpPrompt?: string;
}

function trustedRouteObservation(
  context: ClaudeEvidenceContext | undefined,
): boolean {
  return context?.observedRouteTrusted === true;
}

function expectedBundledExecutable(
  path: string,
  name: string,
  context: ClaudeEvidenceContext | undefined,
): boolean {
  return (
    !!context &&
    path === join(context.pluginDir, "bin", name) &&
    isAbsolute(path) &&
    normalize(path) === path
  );
}

function concreteAbsolutePath(path: string): boolean {
  return isAbsolute(path) && normalize(path) === path;
}

function routeForGoalRunner(subagentType: string) {
  const routes: Record<string, { model: string; effort: string }> = {
    "darrow-goal-loop:adaptive-goal-sonnet-5-low": {
      model: "claude-sonnet-5",
      effort: "low",
    },
    "darrow-goal-loop:adaptive-goal-sonnet-5-medium": {
      model: "claude-sonnet-5",
      effort: "medium",
    },
    "darrow-goal-loop:adaptive-goal-opus-5-high": {
      model: "claude-opus-5",
      effort: "high",
    },
  };
  return routes[subagentType];
}

function routeGateCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
) {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (!validRouteGateWords(words, context, ledger)) return undefined;
  const selected = words[7]!.match(
    /^claude\|anthropic\|([A-Za-z0-9._-]+)\|(low|medium|high|xhigh|max|ultra)$/,
  );
  if (!selected) return undefined;
  return {
    id: tool.id,
    agentId: words[5]!,
    selectedModel: selected[1]!,
    selectedEffort: selected[2]!,
  };
}

function ownerRouteCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
) {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (!validOwnerRouteWords(words, context)) return undefined;
  return {
    id: tool.id,
    agentId: words[5]!,
    selectedModel: words[7]!,
    selectedEffort: words[9]!,
  };
}

function validOwnerRouteWords(
  words: string[] | undefined,
  context: ClaudeEvidenceContext | undefined,
): words is string[] {
  return (
    !!words &&
    [
      words.length === 10,
      words[0] === "/bin/bash",
      expectedBundledExecutable(words[1] ?? "", "claude-owner-route", context),
      words[2] === "--repo",
      words[3] === context?.repoDir,
      words[4] === "--agent-id",
      /^[A-Za-z0-9]+$/.test(words[5] ?? ""),
      words[6] === "--selected-model",
      /^claude-[A-Za-z0-9._-]+$/.test(words[7] ?? ""),
      words[8] === "--selected-effort",
      /^(?:low|medium|high|xhigh|max)$/.test(words[9] ?? ""),
    ].every(Boolean)
  );
}

function routeObservationCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
) {
  return (
    ownerRouteCall(block, context) ?? routeGateCall(block, context, ledger)
  );
}

function validRouteGateWords(
  words: string[] | undefined,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): words is string[] {
  return (
    !!words &&
    [
      words.length === 10,
      words[0] === "/bin/bash",
      expectedBundledExecutable(words[1] ?? "", "claude-route-gate", context),
      words[2] === "--repo",
      words[3] === context?.repoDir,
      words[4] === "--agent-id",
      /^[A-Za-z0-9]+$/.test(words[5] ?? ""),
      words[6] === "--selected",
      words[8] === "--ledger",
      words[9] === ledger,
    ].every(Boolean)
  );
}

function materializeObjectiveCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): { id: string; goalFile: string; contractSha256: string } | undefined {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (!words) return undefined;
  const valid = [
    words.length === 10,
    words[0] === "/bin/bash",
    expectedBundledExecutable(words[1]!, "goal-loop", context),
    words[2] === "step",
    words[3] === "materialize",
    words[4] === "--ledger",
    words[5] === ledger,
    words[6] === "--goal-file",
    concreteAbsolutePath(words[7] ?? ""),
    words[8] === "--expected-sha256",
    /^[0-9a-f]{64}$/.test(words[9] ?? ""),
  ].every(Boolean);
  if (!valid) return undefined;
  return { id: tool.id, goalFile: words[7]!, contractSha256: words[9]! };
}

function exactGoalLoopStepWords(
  words: string[] | undefined,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
  expected: { step: string; length: number },
): words is string[] {
  if (!words || words.length !== expected.length) return false;
  if (!expectedBundledExecutable(words[1] ?? "", "goal-loop", context))
    return false;
  const expectedPrefix = [
    "/bin/bash",
    words[1],
    "step",
    expected.step,
    "--ledger",
    ledger,
  ];
  return expectedPrefix.every((word, index) => words[index] === word);
}

function stagingRegistrationCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): StagingRegistrationCall | undefined {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (
    !exactGoalLoopStepWords(words, context, ledger, {
      step: "stage",
      length: 8,
    })
  )
    return undefined;
  if (words[6] !== "--goal-file" || !concreteAbsolutePath(words[7] ?? ""))
    return undefined;
  return { id: tool.id, goalFile: words[7]! };
}

function objectiveReleaseCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): ({ id: string } & GoalAttachment) | undefined {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (!words) return undefined;
  const valid = [
    words.length === 10,
    words[0] === "/bin/bash",
    expectedBundledExecutable(words[1]!, "goal-loop", context),
    words[2] === "step",
    words[3] === "release-objective",
    words[4] === "--ledger",
    words[5] === ledger,
    words[6] === "--attachment-dir",
    concreteAbsolutePath(words[7] ?? ""),
    words[8] === "--expected-sha256",
    /^[0-9a-f]{64}$/.test(words[9] ?? ""),
  ].every(Boolean);
  if (!valid) return undefined;
  return {
    id: tool.id,
    attachmentDir: words[7]!,
    contractSha256: words[9]!,
  };
}

interface StagingReleaseCall {
  id: string;
  goalFile: string;
  contractSha256: string;
}

function goalReportCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): PendingGoalReport | undefined {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (
    !exactGoalLoopStepWords(words, context, ledger, {
      step: "report",
      length: 10,
    })
  )
    return undefined;
  if (
    words[6] !== "--status" ||
    !/^(?:complete|blocked|launch-required)$/.test(words[7] ?? "") ||
    words[8] !== "--human-interruptions" ||
    !/^\d+$/.test(words[9] ?? "")
  )
    return undefined;
  return { id: tool.id, status: words[7]! as PendingGoalReport["status"] };
}

function goalBlockCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): { operation: string } | undefined {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command) ?? [];
  if (
    ![14, 16].includes(words.length) ||
    !exactGoalLoopStepWords(words.slice(0, 6), context, ledger, {
      step: "block",
      length: 6,
    })
  )
    return undefined;
  const options = parseGoalBlockOptions(words);
  if (!options || !validGoalBlockOptions(options)) return undefined;
  return { operation: options.get("--operation")! };
}

function parseGoalBlockOptions(
  words: string[],
): Map<string, string> | undefined {
  const options = new Map<string, string>();
  for (let index = 6; index < words.length; index += 2) {
    const name = words[index];
    const value = words[index + 1];
    if (!name || !value || options.has(name)) return undefined;
    options.set(name, value);
  }
  return options;
}

function validGoalBlockOptions(options: Map<string, string>): boolean {
  const kind = options.get("--kind") ?? "";
  const operation = options.get("--operation") ?? "";
  const retry = options.get("--retry") ?? "";
  const waiver = options.get("--waiver") ?? "";
  const evidence = options.get("--evidence-sha256");
  const expectedOptionCount = retry === "evidence-change" ? 5 : 4;
  const valid = [
    options.size === expectedOptionCount,
    /^(?:decision|permission|operation|review|gate|dependency)$/.test(kind),
    operation !== "" && operation !== "none",
    /^(?:one-attempt|observe-first|evidence-change|forbidden)$/.test(retry),
    /^(?:discretionary|forbidden)$/.test(waiver),
    retry === "evidence-change"
      ? /^[0-9a-f]{64}$/.test(evidence ?? "")
      : evidence === undefined,
  ].every(Boolean);
  return valid;
}

function goalEndCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): boolean {
  const tool = bashToolCommand(block);
  if (!tool) return false;
  const words = literalShellWords(tool.command);
  return (
    exactGoalLoopStepWords(words, context, ledger, {
      step: "end",
      length: 8,
    }) &&
    words[6] === "--reason" &&
    /^(?:abandoned|superseded|thread-destroyed)$/.test(words[7] ?? "")
  );
}

function stagingReleaseCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): StagingReleaseCall | undefined {
  const tool = bashToolCommand(block);
  if (!tool) return undefined;
  const words = literalShellWords(tool.command);
  if (!words) return undefined;
  const valid = [
    words.length === 10,
    words[0] === "/bin/bash",
    expectedBundledExecutable(words[1]!, "goal-loop", context),
    words[2] === "step",
    words[3] === "release-staging",
    words[4] === "--ledger",
    words[5] === ledger,
    words[6] === "--goal-file",
    concreteAbsolutePath(words[7] ?? ""),
    words[8] === "--expected-sha256",
    /^[0-9a-f]{64}$/.test(words[9] ?? ""),
  ].every(Boolean);
  if (!valid) return undefined;
  return {
    id: tool.id,
    goalFile: words[7]!,
    contractSha256: words[9]!,
  };
}

function provisionalClaudeActivationCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
  selected: SelectedClaudeRoute | undefined,
): { id: string } | undefined {
  const tool = bashToolCommand(block);
  if (!tool || !selected) return undefined;
  const words = literalShellWords(tool.command);
  if (!words || words.length !== 16) return undefined;
  const selectedRoute = `claude|anthropic|${selected.model}|${selected.effort}`;
  const exactStep = exactGoalLoopStepWords(words, context, ledger, {
    step: "activate",
    length: words.length,
  });
  const expectedSuffix = [
    "--applied-by",
    "native-subagent",
    "--boundary",
    "native_subagent",
    "--agent-id",
    "pending",
    "--effective-route",
    selectedRoute,
    "--route-verified",
    "false",
  ];
  const suffixMatches = expectedSuffix.every(
    (word, index) => words[index + 6] === word,
  );
  return [exactStep, suffixMatches].every(Boolean)
    ? { id: tool.id }
    : undefined;
}

function claudePreflightCall(
  block: unknown,
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): PendingClaudePreflight | undefined {
  const tool = bashToolCommand(block);
  const words = tool ? literalShellWords(tool.command) : undefined;
  if (!tool || !words || words[0] !== "/bin/bash") return undefined;
  return (
    goalLoopPreflightCall(tool.id, words, context, ledger) ??
    runnerPreflightCall(tool.id, words, context, ledger)
  );
}

function goalLoopPreflightCall(
  id: string,
  words: string[],
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): PendingClaudePreflight | undefined {
  if (!expectedBundledExecutable(words[1] ?? "", "goal-loop", context))
    return undefined;
  if (validClaudeStartWords(words, context)) return { id, kind: "start" };
  if (validClaudePrepareWords(words, ledger)) return { id, kind: "prepare" };
  if (validClaudeDecisionRouteWords(words, ledger))
    return { id, kind: "route", profile: "none", decisionGated: true };
  return validClaudeRouteWords(words, ledger)
    ? { id, kind: "route", profile: words[11]! }
    : undefined;
}

function validClaudeDecisionRouteWords(
  words: string[],
  ledger: string | undefined,
): boolean {
  const expected = [
    "step",
    "route",
    "--ledger",
    ledger,
    "--workflow",
    "decision-gated",
    "--risk",
    "high",
    "--profile",
    "none",
    "--verification-gate",
    "not-applicable",
    "--readiness",
    "omitted",
    "--review",
    "omitted",
  ];
  return (
    words.length === 18 &&
    words.slice(2).every((word, index) => word === expected[index])
  );
}

function validClaudeStartWords(
  words: string[],
  context: ClaudeEvidenceContext | undefined,
): boolean {
  return [
    words.length === 8,
    words[2] === "step",
    words[3] === "start",
    words[4] === "--repo",
    words[5] === context?.repoDir,
    words[6] === "--host",
    words[7] === "claude",
  ].every(Boolean);
}

function validClaudePrepareWords(
  words: string[],
  ledger: string | undefined,
): boolean {
  return (
    words.length === 6 &&
    words[2] === "step" &&
    words[3] === "prepare" &&
    words[4] === "--ledger" &&
    words[5] === ledger
  );
}

function validClaudeRouteWords(
  words: string[],
  ledger: string | undefined,
): boolean {
  return [
    [18, 20, 22].includes(words.length),
    words[2] === "step",
    words[3] === "route",
    words[4] === "--ledger",
    words[5] === ledger,
    words[6] === "--workflow",
    /^(?:fix-bug|implement-feature|change-feature|refactor|migration|mechanical)$/.test(
      words[7] ?? "",
    ),
    words[8] === "--risk",
    /^(?:routine|elevated|high)$/.test(words[9] ?? ""),
    words[10] === "--profile",
    /^(?:routine|routine-plus|scaled|repo-wide|judgment)$/.test(
      words[11] ?? "",
    ),
    words[12] === "--verification-gate",
    words[13] === words[9],
    words[14] === "--readiness",
    /^(?:selected|omitted)$/.test(words[15] ?? ""),
    words[16] === "--review",
    /^(?:selected|omitted)$/.test(words[17] ?? ""),
    words[9] !== "high" || words[17] === "selected",
    exactOptionalClaudeRoute(words),
  ].every(Boolean);
}

function runnerPreflightCall(
  id: string,
  words: string[],
  context: ClaudeEvidenceContext | undefined,
  ledger: string | undefined,
): PendingClaudePreflight | undefined {
  const valid = [
    words.length === 12,
    expectedBundledExecutable(words[1] ?? "", "goal-loop", context),
    words[2] === "step",
    words[3] === "runner",
    words[4] === "--ledger",
    words[5] === ledger,
    words[6] === "--provider",
    words[7] === "anthropic",
    words[8] === "--model",
    /^(?:claude-sonnet-5|claude-opus-5)$/.test(words[9] ?? ""),
    words[10] === "--effort",
    /^(?:low|medium|high)$/.test(words[11] ?? ""),
  ].every(Boolean);
  return valid
    ? { id, kind: "runner", model: words[9]!, effort: words[11]! }
    : undefined;
}

function tempRootProbeCall(block: unknown): { id: string } | undefined {
  const tool = bashToolCommand(block);
  const words = tool ? literalShellWords(tool.command) : undefined;
  if (
    !tool ||
    !words ||
    words.length !== 2 ||
    !["printenv", "/usr/bin/printenv"].includes(words[0] ?? "") ||
    words[1] !== "TMPDIR"
  )
    return undefined;
  return { id: tool.id };
}

function exactOptionalClaudeRoute(words: string[]): boolean {
  let index = 18;
  if (words[index] === "--review-round-limit") {
    if (words[17] !== "selected" || !/^[1-9]\d*$/.test(words[index + 1] ?? ""))
      return false;
    index += 2;
  }
  if (words.length === index) return true;
  if (words[index] !== "--route" || words.length !== index + 2) return false;
  return /^claude\|anthropic\|[A-Za-z0-9._-]+\|(?:low|medium|high|xhigh|max|ultra)$/.test(
    words[index + 1] ?? "",
  );
}

function goalRunnerForRoute(model: string, effort: string): string | undefined {
  return [
    "darrow-goal-loop:adaptive-goal-sonnet-5-low",
    "darrow-goal-loop:adaptive-goal-sonnet-5-medium",
    "darrow-goal-loop:adaptive-goal-opus-5-high",
  ].find((runner) => {
    const route = routeForGoalRunner(runner);
    return route?.model === model && route.effort === effort;
  });
}

function validPreparedResult(
  text: string,
  context: ClaudeEvidenceContext | undefined,
): boolean {
  const lines = text.trim().split(/\r?\n/);
  const preparedIndex = lines.indexOf("format\tdarrow-native-goal-prepared-v1");
  return (
    preparedIndex >= 0 &&
    lines[preparedIndex + 1] === `repo\t${context?.repoDir}` &&
    lines.some((line) =>
      /^route\t[^\t]+\tclaude\tanthropic\t[^\t]+\t[^\t]+$/.test(line),
    ) &&
    lines.some((line) =>
      /^workflow\t(?:fix-bug|implement-feature|change-feature|refactor|migration|mechanical|decision-gated)\t\//.test(
        line,
      ),
    )
  );
}

function startedLedgerResult(
  text: string,
  context: ClaudeEvidenceContext | undefined,
): { ledger: string; stagingDir: string } | undefined {
  const lines = text.trim().split(/\r?\n/);
  const ledger = uniqueStepValue(lines, "ledger");
  const stagingDir = uniqueStepValue(lines, "staging_dir");
  if (
    !context ||
    lines[0] !== "format\tdarrow-goal-step-v1" ||
    !lines.includes("step\tstart") ||
    !lines.includes(`repo\t${context.repoDir}`) ||
    !lines.includes("host\tclaude") ||
    !privateStepPath(ledger, context.stagingRoot, "darrow-goal-run.") ||
    !privateStepPath(stagingDir, context.stagingRoot, "darrow-goal-stage.")
  )
    return undefined;
  return { ledger, stagingDir };
}

function uniqueStepValue(lines: string[], key: string): string | undefined {
  const prefix = `${key}\t`;
  const values = lines.flatMap((line) =>
    line.startsWith(prefix) ? [line.slice(prefix.length)] : [],
  );
  return values.length === 1 ? values[0] : undefined;
}

function privateStepPath(
  value: string | undefined,
  root: string,
  prefix: string,
): value is string {
  return (
    value !== undefined &&
    concreteAbsolutePath(value) &&
    dirname(value) === root &&
    basename(value).startsWith(prefix)
  );
}

function selectedRouteResult(
  text: string,
  profile: string,
): SelectedClaudeRoute | undefined {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.includes(`profile\t${profile}`)) return undefined;
  const selectedLine = lines.find((line) =>
    line.startsWith("selected_route\t"),
  );
  const selected = selectedLine?.match(
    /^selected_route\tclaude\|anthropic\|([A-Za-z0-9._-]+)\|(low|medium|high|xhigh|max|ultra)$/,
  );
  if (!selected) return undefined;
  if (!lines.some((line) => /^route_source\t(?:policy|user)$/.test(line)))
    return undefined;
  return { model: selected[1]!, effort: selected[2]! };
}

function resolvedRunnerResult(
  text: string,
  route: SelectedClaudeRoute,
  context: ClaudeEvidenceContext | undefined,
): string | undefined {
  const runner = goalRunnerForRoute(route.model, route.effort);
  if (!runner || !context) return undefined;
  const runnerName = runner.slice("darrow-goal-loop:".length);
  const expected = [
    "format\tdarrow-claude-agent-route-v1",
    `selected_route\tclaude\tanthropic\t${route.model}\t${route.effort}`,
    `subagent_type\t${runner}`,
    `agent_file\t${join(context.pluginDir, "agents", `${runnerName}.md`)}`,
  ].join("\n");
  const lines = text.trim().split(/\r?\n/);
  return expected.split("\n").every((line) => lines.includes(line))
    ? runner
    : undefined;
}

function retainClaudePreflightStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (
    event.type !== "assistant" ||
    state.pendingPreflight ||
    state.preflightStage === "complete" ||
    state.preflightStage === "failed"
  )
    return;
  const expectedKind = expectedClaudePreflightKind(state.preflightStage);
  if (!expectedKind) return;
  for (const block of claudeContent(event)) {
    if (!isRecord(block)) continue;
    const call = claudePreflightCall(block, state.context, state.ledger);
    if (call?.kind !== expectedKind) continue;
    state.pendingPreflight = call;
    state.acceptedPreflightBlocks.add(block);
    state.preflightStage = `${call.kind}-pending` as ClaudePreflightStage;
    return;
  }
}

function expectedClaudePreflightKind(
  stage: ClaudePreflightStage,
): PendingClaudePreflight["kind"] | undefined {
  const kinds: Partial<
    Record<ClaudePreflightStage, PendingClaudePreflight["kind"]>
  > = {
    start: "start",
    prepare: "prepare",
    route: "route",
    runner: "runner",
  };
  return kinds[stage];
}

function retainClaudePreflightResult(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const pending = state.pendingPreflight;
  if (event.type !== "user" || !pending) return;
  for (const block of claudeContent(event)) {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      block.tool_use_id !== pending.id
    )
      continue;
    state.pendingPreflight = undefined;
    const accepted =
      block.is_error !== true &&
      acceptClaudePreflightResult(pending, toolResultText(block), state);
    if (!accepted) state.preflightStage = "failed";
    return;
  }
}

function acceptClaudePreflightResult(
  pending: PendingClaudePreflight,
  text: string,
  state: ClaudeEvidenceState,
): boolean {
  if (pending.kind === "start") {
    const started = startedLedgerResult(text, state.context);
    if (!started) return false;
    state.ledger = started.ledger;
    state.stagingDir = started.stagingDir;
    state.preflightStage = "prepare";
    return true;
  }
  if (pending.kind === "prepare") {
    const valid = validPreparedResult(text, state.context);
    if (valid) state.preflightStage = "route";
    return valid;
  }
  if (pending.kind === "route")
    return acceptSelectedRoute(pending, text, state);
  return acceptResolvedRunner(pending, text, state);
}

function acceptSelectedRoute(
  pending: Extract<PendingClaudePreflight, { kind: "route" }>,
  text: string,
  state: ClaudeEvidenceState,
): boolean {
  if (pending.decisionGated) {
    const lines = text.trim().split(/\r?\n/);
    const expected = [
      "workflow\tdecision-gated",
      "risk\thigh",
      "profile\tnone",
      "verification_gate\tnot-applicable",
      "review_selection\tomitted",
      "selected_route\tnone",
      "route_source\tnone",
    ];
    if (!expected.every((line) => lines.includes(line))) return false;
    state.preflightStage = "decision";
    return true;
  }
  const route = selectedRouteResult(text, pending.profile);
  if (!route || !goalRunnerForRoute(route.model, route.effort)) return false;
  state.selectedClaudeRoute = route;
  state.preflightStage = "runner";
  return true;
}

function retainDecisionGoalReportStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (
    event.type !== "assistant" ||
    state.preflightStage !== "decision" ||
    state.pendingGoalReport ||
    state.reportRendered
  )
    return;
  for (const block of claudeContent(event)) {
    if (!isRecord(block)) continue;
    const report = goalReportCall(block, state.context, state.ledger);
    if (report?.status !== "launch-required") continue;
    state.pendingGoalReport = report;
    state.acceptedPreflightBlocks.add(block);
    return;
  }
}

function acceptResolvedRunner(
  pending: Extract<PendingClaudePreflight, { kind: "runner" }>,
  text: string,
  state: ClaudeEvidenceState,
): boolean {
  const selected = state.selectedClaudeRoute;
  if (!selected) return false;
  if (pending.model !== selected.model || pending.effort !== selected.effort)
    return false;
  const runner = resolvedRunnerResult(text, selected, state.context);
  if (!runner) return false;
  state.resolvedGoalRunner = runner;
  state.preflightStage = "complete";
  return true;
}

function retainTempRootProbeStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (
    event.type !== "assistant" ||
    !claudeRouteSelected(state) ||
    state.tempRootProbeStarted
  )
    return;
  for (const block of claudeContent(event)) {
    if (!isRecord(block)) continue;
    const probe = tempRootProbeCall(block);
    if (!probe) continue;
    state.tempRootProbeStarted = true;
    state.tempRootProbeBlock = block;
    state.pendingTempRootProbe = probe.id;
    return;
  }
}

function claudeRouteSelected(state: ClaudeEvidenceState): boolean {
  return ["runner", "runner-pending", "complete"].includes(
    state.preflightStage,
  );
}

function retainTempRootProbeResult(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "user" || !state.pendingTempRootProbe) return;
  for (const block of claudeContent(event)) {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      block.tool_use_id !== state.pendingTempRootProbe
    )
      continue;
    state.pendingTempRootProbe = undefined;
    state.tempRootObserved =
      block.is_error !== true &&
      toolResultText(block).trim() === state.context?.stagingRoot;
    return;
  }
}

function acceptPreGoalStagingWrite(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  if (
    state.preflightStage !== "complete" ||
    state.stagedGoalObjective ||
    block.name !== "Write" ||
    typeof block.id !== "string" ||
    !isRecord(block.input)
  )
    return false;
  const path = block.input.file_path;
  const content = block.input.content;
  if (
    typeof path !== "string" ||
    typeof content !== "string" ||
    !concreteAbsolutePath(path)
  )
    return false;
  state.stagedGoalObjective = {
    block,
    toolUseId: block.id,
    path,
    sha256: sha256Text(content),
    pathBound: dirname(path) === state.stagingDir,
  };
  return true;
}

function retainPreGoalStagingWrite(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "assistant" || state.completedGoalAgents.size !== 0)
    return;
  for (const block of claudeContent(event)) {
    if (isRecord(block) && acceptPreGoalStagingWrite(block, state)) return;
  }
}

const claudePreGoalReadOnlyTools = new Set([
  "Skill",
  "ToolSearch",
  "Read",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "TodoWrite",
  "TaskCreate",
  "TaskUpdate",
  "AskUserQuestion",
]);

function permittedPreGoalTool(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  if (state.goalAgentStarted) return acceptedGoalAgentBlock(block, state);
  if (typeof block.name !== "string") return false;
  if (claudePreGoalReadOnlyTools.has(block.name)) return true;
  if (block.name === "Bash") return permittedPreGoalBash(block, state);
  if (block.name === "Write") return block === state.stagedGoalObjective?.block;
  return acceptedGoalAgentBlock(block, state);
}

function acceptedGoalAgentBlock(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  return (
    block.name === "Agent" &&
    typeof block.id === "string" &&
    state.pendingGoalAgents.has(block.id)
  );
}

function permittedPreGoalBash(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  if (exactInertPreGoalNoop(block)) return true;
  if (tempRootProbeCall(block)) return block === state.tempRootProbeBlock;
  const registration = stagingRegistrationCall(
    block,
    state.context,
    state.ledger,
  );
  if (registration)
    return registration.id === state.pendingStagingRegistration?.id;
  if (stagingReleaseCall(block, state.context, state.ledger))
    return block === state.stagingReleaseBlock;
  if (
    provisionalClaudeActivationCall(
      block,
      state.context,
      state.ledger,
      state.selectedClaudeRoute,
    )
  )
    return block === state.provisionalActivationBlock;
  const materialization = materializeObjectiveCall(
    block,
    state.context,
    state.ledger,
  );
  if (materialization)
    return materialization.id === state.materializationToolUseId;
  return state.acceptedPreflightBlocks.has(block);
}

function exactInertPreGoalNoop(block: Record<string, unknown>): boolean {
  const tool = bashToolCommand(block);
  return tool?.command.trim() === "true";
}

function retainedPreGoalRepositoryTools(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "assistant" || state.completedGoalAgents.size !== 0)
    return [];
  return claudeContent(event).flatMap((block) => {
    if (
      !isRecord(block) ||
      block.type !== "tool_use" ||
      permittedPreGoalTool(block, state)
    )
      return [];
    const tool = typeof block.name === "string" ? block.name : "unknown";
    return [
      {
        type: "darrow.parent_repository_tool_before_goal",
        tool,
        operation:
          rejectedGoalAgentOperation(block, state) ??
          postGoalRepositoryOperation({ ...block, name: tool }),
      },
    ];
  });
}

function rejectedGoalAgentOperation(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): string | undefined {
  if (block.name !== "Agent") return undefined;
  if (!state.materializedObjective) return "agent-objective-missing";
  if (!state.stagingReleased) return "agent-staging-unreleased";
  const input = normalizedReviewAgentInput(block);
  if (!input || !isRecord(block.input)) return "agent-shape-invalid";
  const invocationIssue = goalAgentInvocationIssue(input);
  if (invocationIssue) return invocationIssue;
  const promptIssue = goalAgentPromptIssue(
    block.input.prompt,
    state.materializedObjective,
  );
  if (promptIssue) return `agent-contract-${promptIssue}`;
  return "agent-duplicate";
}

function goalAgentInvocationIssue(
  input: NonNullable<ReturnType<typeof normalizedReviewAgentInput>>,
): string | undefined {
  if (!adaptiveGoalRunner.test(input.subagentType))
    return "agent-route-invalid";
  if (input.runInBackground !== false) return "agent-background-invalid";
  if (input.model !== undefined) return "agent-model-override";
  if (input.prompt !== "- phase: adaptive-goal-runner")
    return "agent-marker-invalid";
  return undefined;
}

const objectiveMaterializationRecordPatterns = [
  /^contract_bytes\t[1-9][0-9]*$/,
  /^contract_sha256\t[0-9a-f]{64}$/,
  /^contract_file\t\/[^\t\r\n]+$/,
  /^objective_bytes\t[1-9][0-9]*$/,
  /^objective_file\t\/[^\t\r\n]+$/,
];

function objectiveMaterializationRecord(
  text: string,
): MaterializedGoalObjective | undefined {
  const allLines = text.trim().split(/\r?\n/);
  const marker = allLines.indexOf("format\tdarrow-native-goal-objective-v1");
  if (marker < 0) return undefined;
  const lines = allLines.slice(marker);
  const recordsValid = objectiveMaterializationRecordPatterns.every(
    (pattern, index) => pattern.test(String(lines[index + 2])),
  );
  const baseValid = [
    lines.length === 8,
    lines[0] === "format\tdarrow-native-goal-objective-v1",
    recordsValid,
  ].every(Boolean);
  if (!baseValid) return undefined;
  const inline = [
    lines[1] === "mode\tinline",
    lines[7] === "attachment_dir\tnone",
  ].every(Boolean);
  const contractFile = lines[4]!.slice("contract_file\t".length);
  const contractSha256 = lines[3]!.slice("contract_sha256\t".length);
  const objectiveFile = lines[6]!.slice("objective_file\t".length);
  if (inline)
    return {
      status: "inline",
      contractFile,
      contractSha256,
      objectiveFile,
      attachment: null,
    };
  const attachment = String(lines[7]).match(/^attachment_dir\t(\/[^\t\r\n]+)$/);
  if (lines[1] !== "mode\tfile-backed") return undefined;
  if (!attachment) return undefined;
  return {
    status: "file-backed",
    contractFile,
    contractSha256,
    objectiveFile,
    attachment: {
      attachmentDir: attachment[1]!,
      contractSha256,
    },
  };
}

function retainStagingRegistrationStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const staged = state.stagedGoalObjective;
  if (event.type !== "assistant" || !staged || state.stagingRegistrationStarted)
    return;
  for (const block of claudeContent(event)) {
    const call = stagingRegistrationCall(block, state.context, state.ledger);
    if (!call || call.goalFile !== staged.path) continue;
    state.stagingRegistrationStarted = true;
    state.pendingStagingRegistration = call;
    return;
  }
}

function retainStagingRegistrationResult(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const pending = state.pendingStagingRegistration;
  const staged = state.stagedGoalObjective;
  if (event.type !== "user" || !pending || !staged) return;
  for (const block of claudeContent(event)) {
    if (!matchingToolResult(block, pending.id)) continue;
    state.pendingStagingRegistration = undefined;
    const lines = toolResultText(block).trim().split(/\r?\n/);
    state.stagingRegistered =
      block.is_error !== true &&
      lines.includes("step\tstage") &&
      lines.includes(`goal_file\t${staged.path}`) &&
      lines.includes(`contract_sha256\t${staged.sha256}`);
    return;
  }
}

function retainObjectiveMaterializationStarts(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "assistant" || state.materializationStarted) return;
  const staged = state.stagedGoalObjective;
  if (!staged || !state.stagingRegistered) return;
  for (const block of claudeContent(event)) {
    const call = materializeObjectiveCall(block, state.context, state.ledger);
    if (
      !call ||
      call.goalFile !== staged.path ||
      call.contractSha256 !== staged.sha256
    )
      continue;
    state.materializationStarted = true;
    state.materializationToolUseId = call.id;
    state.pendingMaterializations.set(call.id, staged);
    return;
  }
}

function retainObjectiveMaterializationResults(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "user") return [];
  const retained: unknown[] = [];
  for (const block of claudeContent(event)) {
    const objective = acceptedObjectiveMaterialization(block, state);
    if (!objective) continue;
    state.materializedObjective = objective;
    state.expectedAttachment = objective.attachment;
    retained.push({
      type: "darrow.goal_objective_materialization",
      status: objective.status,
    });
  }
  return retained;
}

function acceptedObjectiveMaterialization(
  block: unknown,
  state: ClaudeEvidenceState,
): MaterializedGoalObjective | undefined {
  if (!isRecord(block) || block.type !== "tool_result") return undefined;
  if (typeof block.tool_use_id !== "string") return undefined;
  const staged = state.pendingMaterializations.get(block.tool_use_id);
  if (!staged) return undefined;
  state.pendingMaterializations.delete(block.tool_use_id);
  if (block.is_error === true) return undefined;
  const objective = objectiveMaterializationRecord(toolResultText(block));
  if (!objective || objective.contractSha256 !== staged.sha256)
    return undefined;
  if (objective.status === "inline" && objective.contractFile !== staged.path)
    return undefined;
  return objective;
}

function retainStagingReleaseStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const staged = state.stagedGoalObjective;
  if (
    event.type !== "assistant" ||
    !state.materializedObjective ||
    !staged ||
    state.stagingReleaseStarted
  )
    return;
  for (const block of claudeContent(event)) {
    const release = stagingReleaseCall(block, state.context, state.ledger);
    if (
      !release ||
      release.goalFile !== staged.path ||
      release.contractSha256 !== staged.sha256
    )
      continue;
    state.stagingReleaseStarted = true;
    state.stagingReleaseBlock = isRecord(block) ? block : undefined;
    state.pendingStagingRelease = release;
    return;
  }
}

function retainStagingReleaseResult(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const pending = state.pendingStagingRelease;
  if (event.type !== "user" || !pending) return;
  for (const block of claudeContent(event)) {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      block.tool_use_id !== pending.id
    )
      continue;
    state.pendingStagingRelease = undefined;
    const expected = [
      "format\tdarrow-native-goal-staging-release-v1",
      "status\treleased",
      `goal_file\t${pending.goalFile}`,
    ].join("\n");
    state.stagingReleased =
      block.is_error !== true &&
      toolResultText(block).trim().endsWith(expected);
    return;
  }
}

function retainProvisionalClaudeActivationStart(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (
    event.type !== "assistant" ||
    !state.stagingReleased ||
    state.provisionalActivationStarted
  )
    return;
  for (const block of claudeContent(event)) {
    const activation = provisionalClaudeActivationCall(
      block,
      state.context,
      state.ledger,
      state.selectedClaudeRoute,
    );
    if (!activation) continue;
    state.provisionalActivationStarted = true;
    state.pendingProvisionalActivation = activation.id;
    state.provisionalActivationBlock = isRecord(block) ? block : undefined;
    return;
  }
}

function retainProvisionalClaudeActivationResult(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const pending = state.pendingProvisionalActivation;
  if (event.type !== "user" || !pending || !state.selectedClaudeRoute) return;
  for (const block of claudeContent(event)) {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      block.tool_use_id !== pending
    )
      continue;
    state.pendingProvisionalActivation = undefined;
    const text = toolResultText(block);
    const route = `claude|anthropic|${state.selectedClaudeRoute.model}|${state.selectedClaudeRoute.effort}`;
    state.provisionalActivationRecorded =
      block.is_error !== true &&
      [
        "format\tdarrow-goal-step-v1",
        `ledger\t${state.ledger}`,
        "step\tactivate",
        "status\trecorded",
        "agent_id\tpending",
        `effective_route\t${route}`,
        "route_verified\tfalse",
      ].every((line) => text.includes(line)) &&
      /(?:^|\n)enforcement\thelper(?:\n|$)/.test(text);
    return;
  }
}

function retainRouteGateStarts(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "assistant" || state.completedGoalAgents.size !== 1)
    return;
  const [goalToolUseId, goal] = [...state.completedGoalAgents.entries()][0]!;
  const selected = routeForGoalRunner(goal.subagentType);
  if (!selected) return;
  for (const block of claudeContent(event)) {
    const call = routeObservationCall(block, state.context, state.ledger);
    if (
      !call ||
      state.routeGateStarted ||
      call.agentId !== goal.agentId ||
      call.selectedModel !== selected.model ||
      call.selectedEffort !== selected.effort
    )
      continue;
    state.routeGateStarted = true;
    state.pendingRouteGates.set(call.id, {
      goalToolUseId,
      agentId: goal.agentId,
      selectedModel: call.selectedModel,
      selectedEffort: call.selectedEffort,
      observedRouteTrusted: trustedRouteObservation(state.context),
    });
  }
}

function toolResultText(block: Record<string, unknown>): string {
  if (typeof block.content === "string") return block.content;
  if (!Array.isArray(block.content)) return "";
  return block.content
    .flatMap((item) =>
      isRecord(item) && item.type === "text" && typeof item.text === "string"
        ? [item.text]
        : [],
    )
    .join("\n");
}

function goalAgentChildResultText(block: Record<string, unknown>): string {
  if (typeof block.content === "string") return block.content;
  if (!successfulToolResult(block)) return "";
  return block.content
    .slice(0, -1)
    .flatMap((item) => {
      const text = textContent(item);
      return text === undefined ? [] : [text];
    })
    .join("\n");
}

function claudeOwnerRouteRecord(
  text: string,
  agentId: string,
  observedRouteTrusted: boolean,
  selected: SelectedClaudeRoute,
) {
  const lines = text.trim().split(/\r?\n/);
  const route = lines[3]?.match(
    /^observed_route\t(claude)\t(anthropic)\t([^\t\r\n]+)\t([^\t\r\n]+)$/,
  );
  const confirmation = lines[5]?.match(/^confirmation\t(confirmed|rejected)$/);
  const valid = [
    observedRouteTrusted,
    lines.length === 6,
    lines[0] === "format\tdarrow-claude-owner-route-v1",
    lines[1] === `agent_id\t${agentId}`,
    /^transcript\t\//.test(lines[2] ?? ""),
    !!route,
    lines[4] ===
      `selected_route\tclaude\tanthropic\t${selected.model}\t${selected.effort}`,
    !!confirmation,
  ].every(Boolean);
  return valid && route && confirmation
    ? observedRouteRecord(route, confirmation[1]!)
    : undefined;
}

function legacyClaudeRouteGateRecord(
  text: string,
  agentId: string,
  observedRouteTrusted: boolean,
) {
  const lines = text.trim().split(/\r?\n/);
  if (
    lines[0] !== "format\tdarrow-claude-route-gate-v1" ||
    lines[1] !== `agent_id\t${agentId}`
  )
    return undefined;
  if (lines.length === 3 && lines[2] === "observation\tunavailable")
    return { status: "unavailable" as const };
  if (!observedRouteTrusted) return undefined;
  if (lines.length !== 4) return undefined;
  const route = lines[2]!.match(
    /^observed_route\t(claude)\t(anthropic)\t([^\t\r\n]+)\t([^\t\r\n]+)$/,
  );
  const confirmation = lines[3]!.match(/^confirmation\t(confirmed|rejected)$/);
  if (!route || !confirmation) return undefined;
  return observedRouteRecord(route, confirmation[1]!);
}

function observedRouteRecord(route: RegExpMatchArray, confirmation: string) {
  return {
    status: "observed" as const,
    harness: route[1]!,
    provider: route[2]!,
    model: route[3]!,
    effort: route[4]!,
    confirmation: confirmation as "confirmed" | "rejected",
  };
}

function claudeRouteObservationRecord(
  text: string,
  agentId: string,
  observedRouteTrusted: boolean,
  selected: SelectedClaudeRoute,
) {
  return (
    claudeOwnerRouteRecord(text, agentId, observedRouteTrusted, selected) ??
    legacyClaudeRouteGateRecord(text, agentId, observedRouteTrusted)
  );
}

function retainedRouteGateResults(
  event: ClaudeResultEnvelope,
  pending: Map<string, PendingRouteGate>,
) {
  if (event.type !== "user") return [];
  return claudeContent(event).flatMap((block) =>
    retainedRouteGateResult(block, pending),
  );
}

function retainedRouteGateResult(
  block: unknown,
  pending: Map<string, PendingRouteGate>,
): unknown[] {
  if (!isRecord(block) || block.type !== "tool_result") return [];
  if (typeof block.tool_use_id !== "string") return [];
  const call = pending.get(block.tool_use_id);
  if (!call) return [];
  pending.delete(block.tool_use_id);
  const text = toolResultText(block);
  const parsedRecord = claudeRouteObservationRecord(
    text,
    call.agentId,
    call.observedRouteTrusted,
    { model: call.selectedModel, effort: call.selectedEffort },
  );
  const record =
    parsedRecord ??
    (block.is_error === true ? { status: "unavailable" as const } : undefined);
  if (!record) return [];
  return retainedRouteRecord(block.tool_use_id, call, record);
}

function retainedRouteRecord(
  toolUseId: string,
  call: PendingRouteGate,
  record: NonNullable<ReturnType<typeof claudeRouteObservationRecord>>,
): unknown[] {
  return [
    {
      type: "darrow.claude_route_observation",
      tool_use_id: toolUseId,
      goal_tool_use_id: call.goalToolUseId,
      agent_id: call.agentId,
      status: record.status,
      ...(record.status === "observed"
        ? {
            harness: record.harness,
            provider: record.provider,
            model: record.model,
            effort: record.effort,
          }
        : {}),
    },
    ...(record.status === "observed"
      ? [
          {
            type: "darrow.claude_route_confirmation",
            tool_use_id: toolUseId,
            goal_tool_use_id: call.goalToolUseId,
            agent_id: call.agentId,
            status: record.confirmation,
            selectedModel: call.selectedModel,
            selectedEffort: call.selectedEffort,
            effectiveModel: record.model,
            effectiveEffort: record.effort,
          },
        ]
      : []),
  ];
}

function postGoalRepositoryOperation(block: Record<string, unknown>): string {
  if (block.name !== "Bash") return String(block.name).toLowerCase();
  const tool = bashToolCommand(block);
  const command = tool?.command ?? "";
  const words = literalShellWords(command);
  const executable = words?.[0] ? basename(words[0]) : "compound";
  const commandShape =
    diagnosticShellExecutables(command).join("+") || executable;
  return (
    bashMutationOperation(command, commandShape) ??
    knownBashOperation(command, executable, commandShape) ??
    `other-${commandShape}`
  );
}

function bashMutationOperation(
  command: string,
  commandShape: string,
): string | undefined {
  if (/\bsed\b[^\r\n]*[ \t]-i(?:[ \t]|$)/.test(command)) return "mutation-sed";
  if (
    /\bfind\b[^\r\n]*(?:-delete|-exec|-execdir|-ok|-okdir|-fprint)/.test(
      command,
    )
  )
    return "mutation-find";
  const mutator = command.match(
    /(?:^|[;&|][ \t]*)(?:\/[A-Za-z0-9_./-]+\/)?(rm|mv|cp|touch|mkdir|tee|install)(?:[ \t]|$)/,
  )?.[1];
  if (mutator) return `mutation-${mutator}`;
  if (hasShellWriteRedirection(command))
    return `mutation-redirect-${commandShape}`;
  return undefined;
}

function knownBashOperation(
  command: string,
  executable: string,
  commandShape: string,
): string | undefined {
  if (/\bgit[ \t]+status\b/.test(command)) return "git-status";
  if (/\bgit[ \t]+diff\b/.test(command)) return "git-diff";
  if (
    /\b(?:bash[ \t]+)?test\.sh\b|\b(?:bun|npm|pnpm)[ \t]+test\b/.test(command)
  )
    return `test-${commandShape}`;
  if (/\b(?:shasum|sha256sum)\b/.test(command)) return "hash";
  if (
    /\b(?:pwd|ls|find|wc|head|tail|sed|awk|readlink|realpath|dirname)\b/.test(
      command,
    )
  )
    return `inspect-${commandShape}`;
  const unboundGoalLoop = unboundGoalLoopOperation(command);
  if (unboundGoalLoop) return unboundGoalLoop;
  if (command.includes("claude-agent-route")) return "agent-route-unbound";
  if (command.includes("claude-route-gate")) return "route-gate-unbound";
  if (command.includes("claude-owner-route")) return "owner-route-unbound";
  return undefined;
}

function unboundGoalLoopOperation(command: string): string | undefined {
  if (!command.includes("goal-loop")) return undefined;
  const step = command.match(/goal-loop[ \t]+step[ \t]+([a-z-]+)/)?.[1];
  return step ? `goal-loop-unbound-${step}` : "goal-loop-unbound";
}

function diagnosticShellExecutables(command: string): string[] {
  return command
    .split(/&&|\|\||[;\n|]/)
    .slice(0, 4)
    .flatMap((segment) => {
      const first = segment.trim().match(/^([A-Za-z0-9_./-]+)/)?.[1];
      return first ? [basename(first)] : [];
    });
}

function hasShellWriteRedirection(command: string): boolean {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index]!;
    if (char === "\\" && quote !== "'") {
      index += 1;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === ">") return true;
  }
  return false;
}

function acceptObjectiveRelease(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  const release = objectiveReleaseCall(block, state.context, state.ledger);
  const expected = state.expectedAttachment;
  if (!release || !expected || state.objectiveReleaseStarted) return false;
  const matches = [
    release.attachmentDir === expected.attachmentDir,
    release.contractSha256 === expected.contractSha256,
  ].every(Boolean);
  if (!matches) return false;
  state.objectiveReleaseStarted = true;
  state.pendingObjectiveReleases.set(release.id, release);
  return true;
}

function retainedPostGoalRepositoryTools(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "assistant" || state.completedGoalAgents.size !== 1)
    return [];
  const [goalToolUseId] = state.completedGoalAgents.keys();
  return claudeContent(event).flatMap((block) =>
    retainedPostGoalBlock(block, state, goalToolUseId!),
  );
}

function retainedPostGoalBlock(
  block: unknown,
  state: ClaudeEvidenceState,
  goalToolUseId: string,
): unknown[] {
  if (!isRecord(block) || block.type !== "tool_use") return [];
  if (typeof block.name !== "string") return [];
  if (acceptedPostGoalBlock(block, state)) return [];
  return [
    {
      type: "darrow.parent_repository_tool_after_goal",
      goal_tool_use_id: goalToolUseId,
      tool: block.name,
      operation:
        rejectedGoalSendOperation(block, state) ??
        rejectedBlockedAcquisitionOperation(block, state) ??
        postGoalRepositoryOperation(block),
    },
  ];
}

function rejectedBlockedAcquisitionOperation(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): string | undefined {
  const tool = bashToolCommand(block);
  if (!tool || !tool.command.includes("decisionctl")) return undefined;
  if (
    !state.reportRendered ||
    state.renderedGoalStatus !== "blocked" ||
    state.blockedGoalResponse !== undefined ||
    state.pendingBlockedResponseAcquisitions.size !== 0
  )
    return "blocked-acquisition-state";
  const words = literalShellWords(tool.command);
  const expected = authorizedBlockedResponseWords(state);
  if (!words) return "blocked-acquisition-command-shape";
  if (!expected) return "blocked-acquisition-unauthorized";
  return words.join("\0") === expected.join("\0")
    ? "blocked-acquisition-order"
    : "blocked-acquisition-command-mismatch";
}

function rejectedGoalSendOperation(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): string | undefined {
  if (block.name !== "SendMessage") return undefined;
  const input = normalizedSendMessageInput(block);
  const goal = [...state.completedGoalAgents.values()][0];
  if (!input) return "sendmessage-shape";
  if (!goal) return "sendmessage-state";
  const issue = goal.feedbackPending
    ? state.humanFeedbackResponse
      ? feedbackGoalSendIssue(input, goal, state.humanFeedbackResponse)
      : "feedback-response-missing"
    : state.blockedGoalResponse
      ? blockedGoalSendIssue(input, goal, state.blockedGoalResponse)
      : "state";
  return issue ? `sendmessage-${issue}` : "sendmessage-order";
}

function acceptedPostGoalBlock(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  const gate = routeObservationCall(block, state.context, state.ledger);
  const acceptedGate = !!gate && state.pendingRouteGates.has(gate.id);
  const acceptedResume =
    typeof block.id === "string" && state.pendingGoalResumes.has(block.id);
  return (
    acceptedGate ||
    acceptedResume ||
    acceptedGoalLifecycleCall(block, state) ||
    acceptBlockedResponseAcquisition(block, state) ||
    acceptObjectiveRelease(block, state) ||
    acceptGoalReportCall(block, state) ||
    block.name === "ToolSearch"
  );
}

function acceptedGoalLifecycleCall(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  const blocker = goalBlockCall(block, state.context, state.ledger);
  if (blocker) {
    state.blockedOperation = blocker.operation;
    return true;
  }
  return goalEndCall(block, state.context, state.ledger);
}

function authorizedBlockedResponseWords(
  state: ClaudeEvidenceState,
): string[] | undefined {
  const operation = state.blockedOperation;
  const request = state.context?.engineeringRequest;
  if (!operation || !request) return undefined;
  const match = request.match(
    /(?:`|\b)([A-Za-z0-9_./-]+)\s+(answer|continue|retry|waive)\s+<blocked-operation>(?:`|\b)/,
  );
  return match ? [match[1]!, match[2]!, operation] : undefined;
}

function acceptBlockedResponseAcquisition(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  if (
    !state.reportRendered ||
    state.renderedGoalStatus !== "blocked" ||
    state.blockedGoalResponse !== undefined ||
    state.pendingBlockedResponseAcquisitions.size !== 0
  )
    return false;
  const tool = bashToolCommand(block);
  const words = tool ? literalShellWords(tool.command) : undefined;
  const expected = authorizedBlockedResponseWords(state);
  if (!tool || !words || !expected || words.join("\0") !== expected.join("\0"))
    return false;
  state.pendingBlockedResponseAcquisitions.set(tool.id, {
    mode: expected[1]! as PendingBlockedResponseAcquisition["mode"],
    operation: expected[2]!,
  });
  return true;
}

function retainBlockedGoalUserResponse(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
): void {
  if (event.type !== "user" || state.pendingGoalResumes.size !== 0) return;
  const responses = claudeContent(event).flatMap((block) =>
    block.type === "text" && typeof block.text === "string" && block.text
      ? [block.text]
      : [],
  );
  if (responses.length !== 1) return;
  const goal = [...state.completedGoalAgents.values()][0];
  if (goal?.feedbackPending && state.humanFeedbackResponse === undefined) {
    state.humanFeedbackResponse = responses[0]!;
    return;
  }
  if (
    state.reportRendered &&
    state.renderedGoalStatus === "blocked" &&
    state.blockedGoalResponse === undefined
  ) {
    state.blockedGoalResponse = responses[0]!;
  }
}

function retainedBlockedResponseAcquisitionResults(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "user") return [];
  return claudeContent(event).flatMap((block) => {
    if (!isRecord(block) || typeof block.tool_use_id !== "string") return [];
    const pending = state.pendingBlockedResponseAcquisitions.get(
      block.tool_use_id,
    );
    if (!pending || block.type !== "tool_result") return [];
    state.pendingBlockedResponseAcquisitions.delete(block.tool_use_id);
    const response = toolResultText(block).trim();
    const completed =
      block.is_error !== true && !!response && !/[\r\n]/.test(response);
    if (completed) state.blockedGoalResponse = response;
    return [
      {
        type: "darrow.blocked_goal_response_acquired",
        mode: pending.mode,
        operation: pending.operation,
        status: completed ? "completed" : "failed",
      },
    ];
  });
}

function acceptGoalReportCall(
  block: Record<string, unknown>,
  state: ClaudeEvidenceState,
): boolean {
  const report = goalReportCall(block, state.context, state.ledger);
  if (
    !report ||
    state.pendingGoalReport ||
    state.reportRendered ||
    state.pendingGoalResumes.size !== 0
  )
    return false;
  state.pendingGoalReport = report;
  return true;
}

function retainedObjectiveReleaseResults(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  if (event.type !== "user") return [];
  return claudeContent(event).flatMap((block) => {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      typeof block.tool_use_id !== "string"
    )
      return [];
    const release = state.pendingObjectiveReleases.get(block.tool_use_id);
    if (!release) return [];
    state.pendingObjectiveReleases.delete(block.tool_use_id);
    const expected = [
      "format\tdarrow-native-goal-objective-release-v1",
      "status\treleased",
      `attachment_dir\t${release.attachmentDir}`,
    ].join("\n");
    if (
      block.is_error !== true &&
      toolResultText(block).trim().endsWith(expected)
    ) {
      state.objectiveReleased = true;
      return [];
    }
    return [postGoalLifecycleViolation(state, "release-failed")];
  });
}

function retainedGoalReportResult(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const pending = state.pendingGoalReport;
  if (event.type !== "user" || !pending) return [];
  for (const block of claudeContent(event)) {
    if (
      !isRecord(block) ||
      block.type !== "tool_result" ||
      block.tool_use_id !== pending.id
    )
      continue;
    state.pendingGoalReport = undefined;
    const report =
      block.is_error === true
        ? undefined
        : parseGoalReport(toolResultText(block));
    if (!validGoalReportValues(report))
      return [postGoalLifecycleViolation(state, "report-failed")];
    state.reportRendered = true;
    state.renderedGoalStatus = pending.status;
    return [
      {
        type: "darrow.goal_report_rendered",
        status: pending.status,
        enforcement: report!.enforcement,
      },
    ];
  }
  return [];
}

function postGoalLifecycleViolation(
  state: ClaudeEvidenceState,
  operation: string,
) {
  const [goalToolUseId] = state.completedGoalAgents.keys();
  return {
    type: "darrow.parent_repository_tool_after_goal",
    goal_tool_use_id: goalToolUseId,
    tool: "Bash",
    operation,
  };
}

export interface ClaudeGoalRouteEvidence {
  goalToolUseId: string;
  agentId: string;
  subagentType: string;
  observation:
    | { status: "unavailable" }
    | {
        status: "observed";
        harness: string;
        provider: string;
        model: string;
        effort: string;
      };
  confirmation?: {
    status: "confirmed" | "rejected";
    selectedModel?: string;
    selectedEffort?: string;
    effectiveModel?: string;
    effectiveEffort?: string;
  };
}

function retainedRecords(raw: string): Record<string, unknown>[] {
  return raw.split("\n").flatMap((line) => {
    try {
      const parsed: unknown = JSON.parse(line);
      return isRecord(parsed) ? [parsed] : [];
    } catch {
      return [];
    }
  });
}

/** Summarize only normalized lifecycle facts when Claude route evidence fails. */
export function claudeGoalRouteEvidenceSummary(raw: string): string {
  const events = retainedRecords(raw);
  const count = (type: string) =>
    events.filter((event) => event.type === type).length;
  const parentOperations = claudeParentLifecycleOperations(raw);
  return [
    `materializations=${count("darrow.goal_objective_materialization")}`,
    `goal_completions=${count("darrow.goal_agent_completion")}`,
    `route_observations=${count("darrow.claude_route_observation")}`,
    `parent_operations=${parentOperations.length ? parentOperations.join(",") : "none"}`,
  ].join("; ");
}

/** Return only normalized parent lifecycle labels, never commands or inputs. */
export function claudeParentLifecycleOperations(raw: string): string[] {
  return retainedRecords(raw).flatMap((event) =>
    (event.type === "darrow.parent_repository_tool_before_goal" ||
      event.type === "darrow.parent_repository_tool_after_goal") &&
    typeof event.operation === "string"
      ? [
          `${event.type === "darrow.parent_repository_tool_before_goal" ? "before" : "after"}:${event.operation}`,
        ]
      : [],
  );
}

/** Whether the retained stream shows an attempted marked Claude goal owner. */
export function hasClaudeGoalAgentEvidence(raw: string): boolean {
  return retainedRecords(raw).some(
    (event) => event.type === "darrow.goal_agent_completion",
  );
}

function goalCompletion(events: Record<string, unknown>[]) {
  const completions = events.filter(
    (event) => event.type === "darrow.goal_agent_completion",
  );
  if (completions.length !== 1) return undefined;
  const completion = completions[0]!;
  return [
    completion.status === "completed",
    typeof completion.tool_use_id === "string",
    typeof completion.agent_id === "string",
    typeof completion.subagent_type === "string",
  ].every(Boolean)
    ? completion
    : undefined;
}

function hasPriorGoalMaterialization(
  events: Record<string, unknown>[],
  completion: Record<string, unknown>,
) {
  const completionIndex = events.indexOf(completion);
  const materializations = events.flatMap((event, index) =>
    event.type === "darrow.goal_objective_materialization" &&
    (event.status === "inline" || event.status === "file-backed") &&
    index < completionIndex
      ? [event]
      : [],
  );
  return materializations.length === 1;
}

function routeObservation(
  events: Record<string, unknown>[],
  goalToolUseId: string,
  agentId: string,
): ClaudeGoalRouteEvidence["observation"] | undefined {
  const matches = events.filter(
    (event) =>
      event.type === "darrow.claude_route_observation" &&
      event.goal_tool_use_id === goalToolUseId &&
      event.agent_id === agentId,
  );
  if (matches.length !== 1) return undefined;
  const observation = matches[0]!;
  if (observation.status === "unavailable") return { status: "unavailable" };
  const fields = ["harness", "provider", "model", "effort"] as const;
  if (
    observation.status !== "observed" ||
    !fields.every((key) => typeof observation[key] === "string")
  )
    return undefined;
  return {
    status: "observed",
    harness: observation.harness as string,
    provider: observation.provider as string,
    model: observation.model as string,
    effort: observation.effort as string,
  };
}

function optionalString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function routeConfirmation(
  events: Record<string, unknown>[],
  goalToolUseId: string,
  agentId: string,
): ClaudeGoalRouteEvidence["confirmation"] | null | undefined {
  const matches = events.filter(
    (event) =>
      event.type === "darrow.claude_route_confirmation" &&
      event.goal_tool_use_id === goalToolUseId &&
      event.agent_id === agentId,
  );
  if (!matches.length) return undefined;
  if (matches.length !== 1) return null;
  const confirmation = matches[0]!;
  if (confirmation.status !== "confirmed" && confirmation.status !== "rejected")
    return null;
  return {
    status: confirmation.status,
    selectedModel: optionalString(confirmation, "selectedModel"),
    selectedEffort: optionalString(confirmation, "selectedEffort"),
    effectiveModel: optionalString(confirmation, "effectiveModel"),
    effectiveEffort: optionalString(confirmation, "effectiveEffort"),
  };
}

/** Read only the bounded route facts retained from a Claude harness stream. */
export function claudeGoalRouteEvidence(
  raw: string,
): ClaudeGoalRouteEvidence | undefined {
  const events = retainedRecords(raw);
  const completion = goalCompletion(events);
  if (!completion || !hasPriorGoalMaterialization(events, completion))
    return undefined;
  const goalToolUseId = completion.tool_use_id as string;
  const agentId = completion.agent_id as string;
  const observation = routeObservation(events, goalToolUseId, agentId);
  if (!observation) return undefined;
  const confirmation = routeConfirmation(events, goalToolUseId, agentId);
  if (
    confirmation === null ||
    (observation.status === "observed" && !confirmation) ||
    (observation.status === "unavailable" && confirmation)
  )
    return undefined;
  return {
    goalToolUseId,
    agentId,
    subagentType: completion.subagent_type as string,
    observation,
    ...(confirmation ? { confirmation } : {}),
  };
}

interface ClaudeGoalRouteReport {
  harness: string;
  model: string;
  effort: string;
  route_applied_by: string;
  route_verified: string;
  launch_boundary: string;
  evaluation_child_invocations: string;
}

function confirmedClaudeGoalRoute(
  evidence: ClaudeGoalRouteEvidence,
  selected: { model: string; effort: string },
): boolean {
  const observed = evidence.observation;
  const confirmation = evidence.confirmation;
  return [
    observed.status === "observed" &&
      observed.harness === "claude" &&
      observed.provider === "anthropic",
    observed.status === "observed" && observed.model === selected.model,
    observed.status === "observed" && observed.effort === selected.effort,
    confirmation?.status === "confirmed",
    confirmation?.selectedModel === selected.model,
    confirmation?.selectedEffort === selected.effort,
    observationMatchesConfirmation(observed, confirmation),
  ].every(Boolean);
}

function observationMatchesConfirmation(
  observed: ClaudeGoalRouteEvidence["observation"],
  confirmation: ClaudeGoalRouteEvidence["confirmation"],
) {
  return (
    observed.status === "observed" &&
    confirmation?.effectiveModel === observed.model &&
    confirmation.effectiveEffort === observed.effort
  );
}

function unavailableRouteReportMatches(
  report: ClaudeGoalRouteReport,
  evidence: ClaudeGoalRouteEvidence,
) {
  return [
    evidence.confirmation === undefined,
    report.harness === "claude",
    report.model === "anthropic > unknown",
    report.effort === "unknown",
    report.route_verified === "false",
    report.launch_boundary === "launch_required",
  ].every(Boolean);
}

function confirmationSelectedRouteMatches(
  evidence: ClaudeGoalRouteEvidence,
  selected: { model: string; effort: string },
) {
  return [
    evidence.confirmation?.selectedModel === selected.model,
    evidence.confirmation?.selectedEffort === selected.effort,
  ].every(Boolean);
}

/** Reconcile caller-facing route fields with retained observation evidence. */
export function claudeGoalRouteReportMatches(
  report: ClaudeGoalRouteReport,
  evidence: ClaudeGoalRouteEvidence,
  selected: { model: string; effort: string },
): boolean {
  const validOwner =
    report.route_applied_by === "native-subagent" &&
    report.evaluation_child_invocations === "1";
  if (!validOwner) return false;
  if (evidence.observation.status === "observed" && !evidence.confirmation)
    return false;
  if (evidence.observation.status === "unavailable")
    return unavailableRouteReportMatches(report, evidence);
  const observed = evidence.observation;
  if (!confirmationSelectedRouteMatches(evidence, selected)) return false;
  const verified = confirmedClaudeGoalRoute(evidence, selected);
  return [
    report.harness === observed.harness &&
      report.model === `${observed.provider} > ${observed.model}`,
    report.effort === observed.effort,
    report.route_verified === String(verified),
    report.launch_boundary ===
      (verified ? "native_subagent" : "launch_required"),
  ].every(Boolean);
}

interface PendingReviewAgent {
  axis: string;
  batch: number;
  subagentType: string;
  turn: RetainedReviewAgentTurn;
}

type RetainedReviewAgentBlock = ReturnType<
  typeof retainedReviewAgentBlocks
>[number];

interface RetainedReviewAgentTurn {
  batch: number;
  closed: boolean;
  event: {
    type: "assistant";
    message: {
      id?: string;
      content: RetainedReviewAgentBlock[];
    };
  };
}

function assistantMessageId(event: ClaudeResultEnvelope) {
  if (event.type !== "assistant" || !isRecord(event.message)) return undefined;
  const id = event.message.id;
  return typeof id === "string" && id ? id : undefined;
}

function reviewAgentTurn(
  event: ClaudeResultEnvelope,
  turns: Map<string, RetainedReviewAgentTurn>,
  nextBatch: number,
) {
  const messageId = assistantMessageId(event);
  const existing = messageId ? turns.get(messageId) : undefined;
  if (existing && !existing.closed) return { turn: existing, created: false };
  const turn = {
    batch: nextBatch,
    closed: false,
    event: {
      type: "assistant" as const,
      message: {
        ...(messageId ? { id: messageId } : {}),
        content: [],
      },
    },
  } satisfies RetainedReviewAgentTurn;
  if (messageId) turns.set(messageId, turn);
  return { turn, created: true };
}

function retainedReviewAgentEvidence(
  event: ClaudeResultEnvelope,
  pending: Map<string, PendingReviewAgent>,
  turns: Map<string, RetainedReviewAgentTurn>,
  previousBatch: number,
) {
  const retained: unknown[] = [];
  const calls = retainedReviewAgentBlocks(event);
  let batch = previousBatch;
  if (calls.length) {
    const { turn, created } = reviewAgentTurn(event, turns, previousBatch + 1);
    if (created) {
      batch = turn.batch;
      retained.push(turn.event);
    }
    turn.event.message.content.push(...calls);
    for (const block of calls) {
      if (
        !("prompt" in block.input) ||
        block.input.run_in_background !== false ||
        "model" in block.input ||
        !block.input.subagent_type.startsWith("darrow-review:review-reader-")
      )
        continue;
      pending.set(block.id, {
        axis: block.input.prompt.replace("- review_axis: ", ""),
        batch: turn.batch,
        subagentType: block.input.subagent_type,
        turn,
      });
    }
  }
  for (const result of retainedReviewAgentResults(event)) {
    const call = pending.get(result.toolUseId);
    if (!call) continue;
    call.turn.closed = true;
    retained.push({
      type: "darrow.review_agent_launch",
      tool_use_id: result.toolUseId,
      agent_id: result.agentId,
      review_axis: call.axis,
      subagent_type: call.subagentType,
      batch: call.batch,
    });
    pending.delete(result.toolUseId);
  }
  return { retained, batch };
}

/** Normalize Claude's direct Skill tool-use events without retaining messages. */
export function claudeSkillActivation(
  stream: string,
): SkillActivationObservation {
  const parsed = claudeStream(stream);
  const observedSkills = uniqueSkills(parsed.events);
  return {
    source: "harness_event",
    complete:
      !parsed.malformed &&
      parsed.events.some((event) => event.type === "result"),
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

function retainedResultEnvelope(event: ClaudeResultEnvelope) {
  const completeUsage = completeClaudeUsage(event.usage);
  const usage = completeUsage
    ? {
        input_tokens: completeUsage.input_tokens,
        cache_creation_input_tokens: completeUsage.cache_creation_input_tokens,
        cache_read_input_tokens: completeUsage.cache_read_input_tokens,
        output_tokens: completeUsage.output_tokens,
      }
    : undefined;
  return {
    type: "result",
    subtype: event.subtype,
    is_error: event.is_error,
    ...(usage ? { usage } : {}),
    ...(typeof event.total_cost_usd === "number"
      ? { total_cost_usd: event.total_cost_usd }
      : {}),
  };
}

interface ClaudeEvidenceState {
  pendingReviewAgents: Map<string, PendingReviewAgent>;
  pendingGoalAgents: Map<string, PendingGoalAgent>;
  completedGoalAgents: Map<string, CompletedGoalAgent>;
  pendingGoalResumes: Map<string, PendingGoalAgentResume>;
  pendingBlockedResponseAcquisitions: Map<
    string,
    PendingBlockedResponseAcquisition
  >;
  blockedOperation?: string;
  blockedGoalResponse?: string;
  humanFeedbackResponse?: string;
  pendingRouteGates: Map<string, PendingRouteGate>;
  retainedReviewAgentTurns: Map<string, RetainedReviewAgentTurn>;
  reviewAgentBatch: number;
  context?: ClaudeEvidenceContext;
  ledger?: string;
  stagingDir?: string;
  preflightStage: ClaudePreflightStage;
  pendingPreflight?: PendingClaudePreflight;
  acceptedPreflightBlocks: Set<Record<string, unknown>>;
  selectedClaudeRoute?: SelectedClaudeRoute;
  resolvedGoalRunner?: string;
  goalAgentStarted: boolean;
  inlineGoalOwner: boolean;
  routeGateStarted: boolean;
  tempRootProbeStarted: boolean;
  tempRootProbeBlock?: Record<string, unknown>;
  pendingTempRootProbe?: string;
  tempRootObserved: boolean;
  stagedGoalObjective?: StagedGoalObjective;
  stagingRegistrationStarted: boolean;
  pendingStagingRegistration?: StagingRegistrationCall;
  stagingRegistered: boolean;
  materializationStarted: boolean;
  materializationToolUseId?: string;
  pendingMaterializations: Map<string, StagedGoalObjective>;
  stagingReleaseStarted: boolean;
  stagingReleaseBlock?: Record<string, unknown>;
  pendingStagingRelease?: StagingReleaseCall;
  stagingReleased: boolean;
  provisionalActivationStarted: boolean;
  pendingProvisionalActivation?: string;
  provisionalActivationRecorded: boolean;
  provisionalActivationBlock?: Record<string, unknown>;
  expectedAttachment?: GoalAttachment | null;
  materializedObjective?: MaterializedGoalObjective;
  objectiveReleaseStarted: boolean;
  pendingObjectiveReleases: Map<string, GoalAttachment>;
  objectiveReleased: boolean;
  pendingGoalReport?: PendingGoalReport;
  reportRendered: boolean;
  renderedGoalStatus?: PendingGoalReport["status"];
}

function newClaudeEvidenceState(
  context: ClaudeEvidenceContext | undefined,
): ClaudeEvidenceState {
  return {
    pendingReviewAgents: new Map(),
    pendingGoalAgents: new Map(),
    completedGoalAgents: new Map(),
    pendingGoalResumes: new Map(),
    pendingBlockedResponseAcquisitions: new Map(),
    pendingRouteGates: new Map(),
    retainedReviewAgentTurns: new Map(),
    reviewAgentBatch: 0,
    context,
    preflightStage: "start",
    acceptedPreflightBlocks: new Set(),
    goalAgentStarted: false,
    inlineGoalOwner: false,
    routeGateStarted: false,
    tempRootProbeStarted: false,
    tempRootObserved: false,
    stagingRegistrationStarted: false,
    stagingRegistered: false,
    materializationStarted: false,
    pendingMaterializations: new Map(),
    stagingReleaseStarted: false,
    stagingReleased: false,
    provisionalActivationStarted: false,
    provisionalActivationRecorded: false,
    objectiveReleaseStarted: false,
    pendingObjectiveReleases: new Map(),
    objectiveReleased: false,
    reportRendered: false,
  };
}

function retainTopLevelClaudeStarts(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
  retained: unknown[],
) {
  retainBlockedGoalUserResponse(event, state);
  retainClaudePreflightStart(event, state);
  retainClaudePreflightResult(event, state);
  retainTempRootProbeStart(event, state);
  retainTempRootProbeResult(event, state);
  retainPreGoalStagingWrite(event, state);
  retainStagingRegistrationStart(event, state);
  retainStagingRegistrationResult(event, state);
  retainObjectiveMaterializationStarts(event, state);
  retained.push(...retainObjectiveMaterializationResults(event, state));
  retainStagingReleaseStart(event, state);
  retainStagingReleaseResult(event, state);
  retainProvisionalClaudeActivationStart(event, state);
  retainProvisionalClaudeActivationResult(event, state);
  retainGoalAgentStarts(event, state);
  retainGoalAgentResumeStarts(event, state);
  retainDecisionGoalReportStart(event, state);
  retained.push(...retainedPreGoalRepositoryTools(event, state));
  retainRouteGateStarts(event, state);
  retained.push(...retainedPostGoalRepositoryTools(event, state));
}

function retainTopLevelClaudeResults(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
  retained: unknown[],
) {
  retained.push(
    ...retainedGoalAgentCompletions(
      event,
      state.pendingGoalAgents,
      state.completedGoalAgents,
    ),
  );
  retained.push(...retainedGoalAgentResumeResults(event, state));
  retained.push(...retainedGoalAgentResumeNotifications(event, state));
  retained.push(...retainedBlockedResponseAcquisitionResults(event, state));
  retained.push(...retainedRouteGateResults(event, state.pendingRouteGates));
  retained.push(...retainedObjectiveReleaseResults(event, state));
  retained.push(...retainedGoalReportResult(event, state));
}

function retainedNonResultEvent(
  event: ClaudeResultEnvelope,
  state: ClaudeEvidenceState,
) {
  const retained: unknown[] = [];
  if (event.type === "darrow.eval.follow_up_turn") {
    retained.push(event);
    if (
      state.humanFeedbackResponse === undefined &&
      state.context?.followUpPrompt
    )
      state.humanFeedbackResponse = state.context.followUpPrompt;
  }
  const skills = retainedSkillBlocks(event);
  if (skills.length)
    retained.push({ type: "assistant", message: { content: skills } });
  const topLevel = isTopLevelClaudeEvent(event);
  if (topLevel) retainTopLevelClaudeStarts(event, state, retained);
  const reviewEvidence = retainedReviewAgentEvidence(
    event,
    state.pendingReviewAgents,
    state.retainedReviewAgentTurns,
    state.reviewAgentBatch,
  );
  retained.push(...reviewEvidence.retained);
  if (topLevel) retainTopLevelClaudeResults(event, state, retained);
  state.reviewAgentBatch = reviewEvidence.batch;
  return retained;
}

function hasUnboundStagedObjective(state: ClaudeEvidenceState): boolean {
  return !!(
    state.stagedGoalObjective &&
    !state.stagedGoalObjective.pathBound &&
    !state.stagingRegistered
  );
}

function hasMissingObjectiveRelease(
  state: ClaudeEvidenceState,
  feedbackPending: boolean,
): boolean {
  return !!(
    state.completedGoalAgents.size === 1 &&
    !feedbackPending &&
    state.expectedAttachment &&
    goalReportRequiresObjectiveRelease(state.renderedGoalStatus) &&
    !state.objectiveReleased
  );
}

function retainedGoalTerminalViolations(state: ClaudeEvidenceState): unknown[] {
  if (state.inlineGoalOwner) return [];
  const retainedGoal = [...state.completedGoalAgents.values()][0];
  const feedbackPending = retainedGoal?.feedbackPending === true;
  const violations: unknown[] = [];
  if (hasUnboundStagedObjective(state))
    violations.push({
      type: "darrow.parent_repository_tool_before_goal",
      tool: "Write",
      operation: "write",
    });
  if (hasMissingObjectiveRelease(state, feedbackPending))
    violations.push(postGoalLifecycleViolation(state, "release-missing"));
  if (
    state.completedGoalAgents.size === 1 &&
    !feedbackPending &&
    !state.reportRendered
  )
    violations.push(postGoalLifecycleViolation(state, "report-missing"));
  return violations;
}

function retainedHarnessFailure(status: {
  exitCode: number;
  stderrPresent: boolean;
}): unknown[] {
  return status.exitCode === 0
    ? []
    : [
        {
          type: "harness_failure",
          exit_code: status.exitCode,
          stderr_present: status.stderrPresent,
        },
      ];
}

function hookDeniedToolUseIds(events: ClaudeResultEnvelope[]): Set<string> {
  const denied = new Set<string>();
  for (const event of events) {
    if (event.type !== "user") continue;
    for (const block of claudeContent(event)) {
      if (
        block.type === "tool_result" &&
        typeof block.tool_use_id === "string" &&
        toolResultText(block).includes("darrow goal hook:")
      )
        denied.add(block.tool_use_id);
    }
  }
  return denied;
}

function withoutHookDeniedToolUses(
  event: ClaudeResultEnvelope,
  denied: Set<string>,
): ClaudeResultEnvelope {
  if (event.type !== "assistant" || !isRecord(event.message)) return event;
  const content = claudeContent(event);
  const retained = content.filter(
    (block) =>
      !(
        block.type === "tool_use" &&
        typeof block.id === "string" &&
        denied.has(block.id)
      ),
  );
  if (retained.length === content.length) return event;
  return { ...event, message: { ...event.message, content: retained } };
}

/** Retain bounded accounting and reduced Skill events, not result text. */
export function retainedClaudeEvidence(
  stream: string,
  status?: { exitCode: number; stderrPresent: boolean },
  context?: ClaudeEvidenceContext,
): string {
  const parsed = claudeStream(stream);
  const retained: unknown[] = [];
  const state = newClaudeEvidenceState(context);
  const hookDenied = hookDeniedToolUseIds(parsed.events);
  for (const originalEvent of parsed.events) {
    const event = withoutHookDeniedToolUses(originalEvent, hookDenied);
    if (event.type === "result") {
      retained.push(retainedResultEnvelope(event));
      continue;
    }
    retained.push(...retainedNonResultEvent(event, state));
  }
  retained.push(...retainedGoalTerminalViolations(state));
  if (parsed.malformed) retained.push({ type: "malformed_stream" });
  if (status) retained.push(...retainedHarnessFailure(status));
  return retained.map((event) => JSON.stringify(event)).join("\n");
}

interface ClaudeArgvOptions {
  pluginDir?: string;
  session?: { mode: "start" | "resume"; id: string };
}

export function claudeArgv(
  prompt: string,
  model: string,
  effort: string,
  options: ClaudeArgvOptions = {},
): string[] {
  const { pluginDir, session } = options;
  const argv = [
    "claude",
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--effort",
    effort,
    "--setting-sources",
    "project,local",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-chrome",
    "--dangerously-skip-permissions",
  ];
  if (/(?:^|\s)(?:\/adaptive-goal|\$adaptive-goal)(?:\s|$)/.test(prompt)) {
    argv.push("--disallowed-tools", "ScheduleWakeup");
  }
  if (session?.mode === "start") argv.push("--session-id", session.id);
  if (session?.mode === "resume") argv.push("--resume", session.id);
  if (pluginDir) argv.push("--plugin-dir", pluginDir);
  return argv;
}

/**
 * Reads the terminal result envelope from Claude's JSONL stream. A missing or
 * malformed stream is a failed run, not a partially usable one.
 */
async function claudeOutcome(
  repoDir: string,
  out: string,
  code: number,
): Promise<ClaudeOutcome> {
  const outcome: ClaudeOutcome = {
    ok: false,
    tokenUsageComplete: false,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
    resultText: "",
  };
  try {
    Object.assign(outcome, claudeResultAccounting(out, code));
    // Mirror the codex adapter: final agent message under .git/ for checks.
    if (outcome.resultText) {
      await writeFile(
        join(repoDir, ".git", "last-message.md"),
        outcome.resultText,
      );
    }
  } catch {
    // A malformed stream, or an unwritable final message, is a failed run.
    outcome.ok = false;
  }
  return outcome;
}

function retainedClaudeRunEvidence(
  out: string,
  code: number,
  err: string,
  context: ClaudeEvidenceContext,
) {
  return retainedClaudeEvidence(
    out,
    { exitCode: code, stderrPresent: err.trim().length > 0 },
    context,
  );
}

function claudeProcessEnvironment(
  env: Record<string, string>,
  repoDir: string,
) {
  return {
    ...env,
    DARROW_GOAL_LOOP_EXTERNAL_SANDBOX: "1",
    PATH: `${claudeSafeInspectionBin(repoDir)}:${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`,
  };
}

function configureClaudePluginData(
  env: Record<string, string>,
  repoDir: string,
): void {
  const pluginData = join(repoDir, ".git", "darrow-eval", "plugin-data");
  env.CLAUDE_PLUGIN_DATA = pluginData;
  env.PLUGIN_DATA = pluginData;
}

function protectedClaudeRuntimePaths(
  repoDir: string,
  pluginDir: string,
  env: Record<string, string>,
) {
  const searchPaths = (env.PATH ?? "")
    .split(":")
    .filter((path) => concreteAbsolutePath(path));
  return [
    pluginDir,
    env.ZDOTDIR,
    env.CLAUDE_PLUGIN_DATA,
    claudeSafeInspectionBin(repoDir),
    join(repoDir, ".git", "fixture-bin"),
    ...searchPaths,
  ].filter(
    (path): path is string => typeof path === "string" && path.length > 0,
  );
}

function claudeSafeInspectionBin(repoDir: string): string {
  return join(repoDir, ".git", "darrow-eval", "safe-inspection-bin");
}

async function installClaudeSafeInspectionWrappers(repoDir: string) {
  const bin = claudeSafeInspectionBin(repoDir);
  await mkdir(bin, { recursive: true });
  await Promise.all([
    writeFile(
      join(bin, "find"),
      `#!/bin/sh
for arg do
  case "$arg" in
    -delete|-exec|-execdir|-ok|-okdir|-fprint|-fprint0|-fprintf|-fls) exit 64 ;;
  esac
done
exec /usr/bin/find "$@"
`,
      { mode: 0o500 },
    ),
    writeFile(join(bin, "ls"), '#!/bin/sh\nexec /bin/ls "$@"\n', {
      mode: 0o500,
    }),
    writeFile(join(bin, "sort"), '#!/bin/sh\nexec /usr/bin/sort "$@"\n', {
      mode: 0o500,
    }),
    writeFile(join(bin, "head"), '#!/bin/sh\nexec /usr/bin/head "$@"\n', {
      mode: 0o500,
    }),
    writeFile(
      join(bin, "printenv"),
      '#!/bin/sh\n[ "$#" -eq 1 ] && [ "$1" = TMPDIR ] || exit 64\nexec /usr/bin/printenv TMPDIR\n',
      { mode: 0o500 },
    ),
  ]);
}

async function spawnClaudeEvaluation(
  argv: string[],
  repoDir: string,
  env: Record<string, string>,
) {
  const proc = Bun.spawn(argv, {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
    // Fixture mocks shadow real network tools for every subprocess.
    env: claudeProcessEnvironment(env, repoDir),
  });
  return Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
}

interface ClaudeTurnOutput {
  out: string;
  err: string;
  code: number;
}

async function sandboxedClaudeCommand(options: {
  request: HarnessRunRequest;
  repo: string;
  evalPlugin: string;
  env: Record<string, string>;
  prompt: string;
  session?: { mode: "start" | "resume"; id: string };
}): Promise<string[]> {
  const { request, repo, evalPlugin, env, prompt, session } = options;
  return sandboxedAgentCommand(
    claudeArgv(prompt, request.model, request.effort, {
      pluginDir: existsSync(evalPlugin) ? evalPlugin : undefined,
      session,
    }),
    repo,
    protectedClaudeRuntimePaths(repo, evalPlugin, env),
  );
}

async function claudeTurnOutput(options: {
  request: HarnessRunRequest;
  repo: string;
  evalPlugin: string;
  env: Record<string, string>;
}): Promise<ClaudeTurnOutput> {
  const { request, repo, env } = options;
  const followUpPrompt = request.control?.followUpPrompt;
  const sessionId = followUpPrompt ? randomUUID() : undefined;
  const initial = await spawnClaudeEvaluation(
    await sandboxedClaudeCommand({
      ...options,
      prompt: request.prompt,
      session: sessionId ? { mode: "start", id: sessionId } : undefined,
    }),
    repo,
    env,
  );
  const [initialOut, initialErr, initialCode] = initial;
  if (
    !followUpPrompt ||
    !sessionId ||
    !claudeResultAccounting(initialOut, initialCode).ok
  )
    return { out: initialOut, err: initialErr, code: initialCode };
  const [out, err, code] = await spawnClaudeEvaluation(
    await sandboxedClaudeCommand({
      ...options,
      prompt: followUpPrompt,
      session: { mode: "resume", id: sessionId },
    }),
    repo,
    env,
  );
  const boundary = JSON.stringify({
    type: "darrow.eval.follow_up_turn",
    thread_id: sessionId,
  });
  return {
    out: [initialOut.trimEnd(), boundary, out.trimStart()].join("\n"),
    err: [initialErr.trimEnd(), err.trimStart()].filter(Boolean).join("\n"),
    code,
  };
}

async function claudeHarnessResult(options: {
  repo: string;
  turn: ClaudeTurnOutput;
  start: number;
  evidenceContext: ClaudeEvidenceContext;
}): Promise<HarnessResult> {
  const { repo, turn, start, evidenceContext } = options;
  const outcome = await claudeOutcome(repo, turn.out, turn.code);
  const skillActivation = claudeSkillActivation(turn.out);
  return {
    ok: outcome.ok,
    durationMs: performance.now() - start,
    tokenUsageComplete: outcome.tokenUsageComplete,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
    costUsd: outcome.costUsd,
    resultText: outcome.resultText,
    raw: retainedClaudeRunEvidence(
      turn.out,
      turn.code,
      turn.err,
      evidenceContext,
    ),
    skillActivation: {
      ...skillActivation,
      complete: outcome.ok && skillActivation.complete,
    },
  };
}

async function executeClaude(
  request: HarnessRunRequest,
): Promise<HarnessResult> {
  const start = performance.now();
  const repo = realpathSync(request.repoDir);
  const env = await isolatedHarnessEnvironment("claude", repo);
  await installClaudeSafeInspectionWrappers(repo);
  const stagingRoot = realpathSync(
    await mkdtemp(join(tmpdir(), "darrow-claude-objective-")),
  );
  env.TMPDIR = stagingRoot;
  const evalPlugin = join(repo, ".git", "eval-plugin");
  configureClaudePluginData(env, repo);
  const evidenceContext = claudeEvidenceContext({
    repoDir: repo,
    pluginDir: evalPlugin,
    stagingRoot,
    engineeringRequest: request.prompt,
    followUpPrompt: request.control?.followUpPrompt,
  });
  try {
    const turn = await claudeTurnOutput({ request, repo, evalPlugin, env });
    return await claudeHarnessResult({ repo, turn, start, evidenceContext });
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }
}

/**
 * Runs the skill via headless Claude Code (`claude -p`). The fixture exposes
 * the source plugin through `--plugin-dir`, matching installed-plugin resource
 * resolution without a shadowing project skill. Native permissions are skipped
 * inside the runner's outer OS sandbox.
 */
export const claudeAdapter: HarnessAdapter = {
  name: "claude",
  defaultModel: "claude-sonnet-5",
  skillMounts: [],
  sourceClaudePlugin: true,

  async version(): Promise<string> {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim();
  },

  async run(request): Promise<HarnessResult> {
    return executeClaude(request);
  },
};

function claudeEvidenceContext(
  context: Omit<ClaudeEvidenceContext, "observedRouteTrusted">,
): ClaudeEvidenceContext {
  return {
    ...context,
    observedRouteTrusted: true,
  };
}
