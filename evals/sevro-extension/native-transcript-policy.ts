import { commandAbsence } from "./command-absence";

type Row = Record<string, unknown>;
type Status = "passed" | "failed" | "unavailable";
export type NativeTranscript = {
  id: string;
  kind: string;
  model?: string;
  effort?: string;
  claudeTypes?: string[];
  forbiddenCommandTerms?: string[];
};

function row(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

export const NATIVE_TRANSCRIPT_KINDS = new Set([
  "route",
  "repair-reuse",
  "inactive",
  "no-goal-before-feedback",
  "no-child-before-feedback",
  "readiness-once",
  "readiness-no-retry",
  "no-claude-owner",
  "independent-review",
  "command-absence",
]);

export function nativeTranscriptEvidence(checks: NativeTranscript[]): string[] {
  return [
    ...new Set(
      checks.flatMap((check) => {
        // The selected host determines which event artifact is required.
        if (check.kind === "command-absence") return [];
        if (check.kind === "inactive")
          return ["sevro.host.skill-activations", "sevro.codex.events"];
        // The check validates the selected host's accepted-child facts itself.
        // Requiring both host receipts, or an unused complete common receipt,
        // would make valid positive route evidence unavailable.
        if (SPAWN_KINDS.has(check.kind)) return [];
        if (check.kind === "no-goal-before-feedback")
          return ["sevro.codex.continuation"];
        if (check.kind === "no-child-before-feedback")
          return ["sevro.codex.native-calls", "sevro.codex.continuation"];
        return ["sevro.claude.tool-calls"];
      }),
    ),
  ];
}

function observation(values: unknown, id: string) {
  if (!Array.isArray(values)) return null;
  const matches = values.map(row).filter((item) => item?.id === id);
  const value = matches.length === 1 ? matches[0] : null;
  if (
    !value ||
    value.completeness !== "complete" ||
    value.source !==
      (id.startsWith("sevro.codex.") ? "sevro.host.codex" : "sevro.host.claude")
  )
    return null;
  return row(value.data);
}

function countSkill(entries: Row[], skill: string) {
  return entries.filter((item) => item.name === "Skill" && item.skill === skill)
    .length;
}

function readinessStatus(kind: string, tools: Row[]): Status | null {
  const readiness = countSkill(tools, "assess-implementation-readiness");
  if (kind === "readiness-once") return readiness === 1 ? "passed" : "failed";
  if (kind === "readiness-no-retry")
    return readiness <= 1 ? "passed" : "failed";
  if (kind === "no-claude-owner")
    return tools.some(
      (item) =>
        item.name === "Agent" &&
        String(item.subagentType).startsWith(
          "darrow-adaptive-goal:adaptive-goal-",
        ),
    )
      ? "failed"
      : "passed";
  return null;
}

function claudeStatus(check: NativeTranscript, context: NativeContext): Status {
  const tools = context.claudeTools;
  if (!tools) return "unavailable";
  const readiness = readinessStatus(check.kind, tools);
  if (readiness !== null) return readiness;
  if (check.kind !== "independent-review") return "unavailable";
  if (countSkill(tools, "independent-code-review") > 0) return "passed";
  const nested = context.claudeNestedSkills;
  return nested
    ? nested.some((item) => item.skill === "independent-code-review")
      ? "passed"
      : "failed"
    : "unavailable";
}

function feedbackStatus(
  check: NativeTranscript,
  values: unknown,
  spawns: Row[] | null,
): Status {
  const boundary = observation(values, "sevro.codex.continuation");
  if (!boundary) return "unavailable";
  if (check.kind === "no-goal-before-feedback")
    return typeof boundary.nativeGoalObserved === "boolean"
      ? !boundary.nativeGoalObserved && boundary.nativeGoalStatus === null
        ? "passed"
        : "failed"
      : "unavailable";
  if (!spawns || !Number.isInteger(boundary.nativeAfterOrdinal))
    return "unavailable";
  return spawns.some(
    (value) =>
      Number(value.acceptedOrdinal) <= Number(boundary.nativeAfterOrdinal),
  )
    ? "failed"
    : "passed";
}

function routeStatus(check: NativeTranscript, spawns: Row[] | null): Status {
  if (!spawns) return "unavailable";
  return spawns.some(
    (value) =>
      value.model === check.model && value.reasoningEffort === check.effort,
  )
    ? "passed"
    : "failed";
}

function inactiveStatus(context: NativeContext): Status {
  const { skills, events } = context;
  if (!skills || events === null) return "unavailable";
  return skills.observedSkills.includes("adaptive-goal") ||
    events.includes("adaptive-goal-preflight prepare")
    ? "failed"
    : "passed";
}

const FOLLOW_UP_TOOLS = new Set(["followup_task", "send_message"]);

function sameChild(target: unknown, agentRef: string): boolean {
  return (
    target === agentRef ||
    (agentRef.startsWith("/root/") &&
      !agentRef.slice("/root/".length).includes("/") &&
      target === agentRef.slice("/root/".length))
  );
}

// Codex: one accepted implementor spawn on the implementation route, another
// accepted spawn (verification) after it, then native follow-up to the same
// implementor after that spawn.
function codexRepairReuseStatus(
  check: NativeTranscript,
  spawns: Row[] | null,
  feedback: Row[] | null,
): Status {
  if (!spawns || !feedback) return "unavailable";
  const implementors = spawns.filter(
    (value) =>
      value.model === check.model && value.reasoningEffort === check.effort,
  );
  if (implementors.length !== 1) return "failed";
  const implementor = implementors[0]!;
  const accepted = Number(implementor.acceptedOrdinal);
  const assessment = spawns
    .filter(
      (value) =>
        value !== implementor && Number(value.acceptedOrdinal) > accepted,
    )
    .map((value) => Number(value.acceptedOrdinal));
  if (!assessment.length) return "failed";
  const after = Math.min(...assessment);
  return feedback.some(
    (call) =>
      FOLLOW_UP_TOOLS.has(String(call.tool)) &&
      Number(call.ordinal) > after &&
      sameChild(call.target, String(implementor.agentRef)),
  )
    ? "passed"
    : "failed";
}

function claudeBlocks(event: Row): Row[] {
  const message = row(event.message);
  const content = message?.content;
  return Array.isArray(content)
    ? content.map(row).filter((block): block is Row => !!block)
    : [];
}

function claudeResultText(block: Row): string {
  const content = block.content;
  if (typeof content === "string") return content;
  return Array.isArray(content)
    ? content
        .map(row)
        .filter(
          (item) => item?.type === "text" && typeof item.text === "string",
        )
        .map((item) => String(item!.text))
        .join("\n")
    : "";
}

function claudeEvents(text: string | null): Row[] | null {
  if (text === null) return null;
  try {
    const events = text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => row(JSON.parse(line) as unknown));
    if (events.some((event) => !event)) return null;
    return events.some((event) => event!.type === "result")
      ? (events as Row[])
      : null;
  } catch {
    return null;
  }
}

// Claude: one parent Adaptive Goal Agent that is not a verification agent, a
// later parent Agent call, then a parent SendMessage addressed to the
// implementor by its returned id or given name. A verification agent launches
// a public Review coordinator/reader or invokes the code-review skill.
function claudeImplementors(tools: Row[], nested: Row[] | null): Row[] {
  const verification = new Set([
    ...tools
      .filter(
        (call) =>
          call.name === "Agent" &&
          call.actor === "nested" &&
          String(call.subagentType).startsWith("darrow-review:"),
      )
      .map((call) => call.parentToolUseId),
    ...(nested ?? [])
      .filter((call) => call.skill === "code-review")
      .map((call) => call.ancestorToolUseId),
  ]);
  return tools.filter(
    (call) =>
      call.name === "Agent" &&
      call.actor === "parent" &&
      String(call.subagentType).startsWith(
        "darrow-adaptive-goal:adaptive-goal-",
      ) &&
      !verification.has(call.toolUseId),
  );
}

function sendsTo(block: Row, name: unknown, resultText: string): boolean {
  if (block.type !== "tool_use" || block.name !== "SendMessage") return false;
  const target = row(block.input)?.to;
  const returnedIds = [
    ...resultText.matchAll(/(?:^|\n)\s*agentId:\s*([A-Za-z0-9_-]+)(?=\s|$)/g),
  ];
  return (
    typeof target === "string" &&
    target.length > 0 &&
    (target === name ||
      (returnedIds.length === 1 && target === returnedIds[0]![1]))
  );
}

function claudeRepairReuseStatus(
  tools: Row[] | null,
  nested: Row[] | null,
  text: string | null,
): Status {
  const events = claudeEvents(text);
  if (!tools || !events) return "unavailable";
  const implementors = claudeImplementors(tools, nested);
  if (implementors.length !== 1) return "failed";
  const id = implementors[0]!.toolUseId;
  const blocks = events
    .filter((event) => !event.parent_tool_use_id)
    .flatMap(claudeBlocks);
  const useIndex = blocks.findIndex(
    (block) => block.type === "tool_use" && block.id === id,
  );
  if (useIndex < 0) return "unavailable";
  const result = blocks.find(
    (block) => block.type === "tool_result" && block.tool_use_id === id,
  );
  const name = row(blocks[useIndex]!.input)?.name;
  const resultText = result ? claudeResultText(result) : "";
  const laterAgent = blocks.findIndex(
    (block, index) =>
      index > useIndex && block.type === "tool_use" && block.name === "Agent",
  );
  if (laterAgent < 0) return "failed";
  return blocks
    .slice(laterAgent + 1)
    .some((block) => sendsTo(block, name, resultText))
    ? "passed"
    : "failed";
}

function repairReuseStatus(
  check: NativeTranscript,
  context: NativeContext,
): Status {
  return context.eventId === "sevro.claude.events"
    ? claudeRepairReuseStatus(
        context.claudeTools,
        context.claudeNestedSkills,
        context.events,
      )
    : codexRepairReuseStatus(check, context.spawns, context.feedback);
}

type NativeContext = {
  events: string | null;
  eventId: string;
  skills: { observedSkills: string[]; evidenceRef: string } | null;
  spawns: Row[] | null;
  feedback: Row[] | null;
  claudeTools: Row[] | null;
  claudeNestedSkills: Row[] | null;
  claudeCompletedRoutes: Row[] | null;
};
function hostRouteStatus(
  check: NativeTranscript,
  context: NativeContext,
): Status {
  if (context.eventId !== "sevro.claude.events")
    return routeStatus(check, context.spawns);
  return context.claudeCompletedRoutes === null
    ? "unavailable"
    : context.claudeCompletedRoutes.some((call) =>
          check.claudeTypes?.includes(String(call.subagentType)),
        )
      ? "passed"
      : "failed";
}

function status(
  check: NativeTranscript,
  values: unknown,
  context: NativeContext,
): Status {
  if (check.kind === "route") return hostRouteStatus(check, context);
  if (check.kind === "repair-reuse") return repairReuseStatus(check, context);
  if (check.kind === "inactive") return inactiveStatus(context);
  if (check.kind === "command-absence")
    return commandAbsence(
      context.events,
      context.eventId,
      check.forbiddenCommandTerms!,
    );
  if (check.kind.endsWith("before-feedback"))
    return feedbackStatus(check, values, context.spawns);
  return claudeStatus(check, context);
}

export function nativeTranscriptOutcomes(
  checks: NativeTranscript[] | undefined,
  values: unknown,
  context: NativeContext,
) {
  return (checks ?? []).map((check) => {
    const assessment = status(check, values, context);
    return {
      id: check.id,
      status: assessment,
      detail:
        assessment === "unavailable"
          ? "Required native transcript facts are unavailable"
          : "Graded from bounded native observations and verified host events",
      evidenceRefs:
        assessment === "unavailable" ? [] : transcriptRefs(check, context),
    };
  });
}

const SPAWN_KINDS = new Set(["route", "repair-reuse"]);

function transcriptRefs(check: NativeTranscript, context: NativeContext) {
  const { eventId } = context;
  if (check.kind === "command-absence") return [eventId];
  if (SPAWN_KINDS.has(check.kind))
    return eventId === "sevro.claude.events"
      ? ["sevro.claude.tool-calls", eventId]
      : ["sevro.codex.native-calls"];
  if (check.kind.endsWith("before-feedback"))
    return [
      "sevro.codex.continuation",
      ...(check.kind === "no-child-before-feedback"
        ? ["sevro.codex.native-calls"]
        : []),
    ];
  if (check.kind === "inactive") return [context.skills!.evidenceRef, eventId];
  if (
    check.kind === "independent-review" &&
    context.claudeTools &&
    countSkill(context.claudeTools, "independent-code-review") === 0
  )
    return ["sevro.claude.tool-calls", "sevro.claude.nested-skills"];
  return ["sevro.claude.tool-calls"];
}
