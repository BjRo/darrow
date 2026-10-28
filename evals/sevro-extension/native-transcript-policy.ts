import { createHash } from "node:crypto";
// Exact current-main assertions: changed contracts must acquire a new mapping.
const allowedPatterns = new Set([
  "05c5a2051ea2b6c2bdda8c649172c7ddf3d137e983e05212cd5562d4f89895c1",
  "1ae6f1f4348e9f39147d79d5f17715b278f81042286f85b6b837a44f306d9879",
  "26a68e5004bdf564c604d616bb2144c1bf1311ab8c8e5ab44a0d0524c8e89c1a",
  "2735c8032bdd1be400866c55cfa9c0782c3af8c6c7e675a7303fba32508ab9c0",
  "2d668c865b4e4a7bef79675b032261b7a2f1f8cba097b1f334780d0aeabdddb4",
  "477494af9a187a707b1a0294209a427f71fdec078c7535deddb8597f08960d43",
  "4944ca41ef44b3b23773882700d0153d23c5d3e70b03551d6b9da9a5f429aa0d",
  "529783053bc77eeaf2ab39e8cc4a98627d80928510e1b98a372d3f12315e2210",
  "53308d6805d0dc9f795b3efb0aa60ff819b28ffb29ab0ec63da41aac0a4909ed",
  "59a0afb6b55236dedf7c92857157c6ae23a8d385324c825679cc9dccaf5f97c8",
  "62587f212854141760bc4e63bd727e4a0b879b6290b8d172a6ec9e5e98f8de27",
  "725b7caac1d68e60343d587efcaa4e94b1f3fe9f6dd7a13c6fa30f14df8c4a81",
  "cc420b42519baee8419c5c35e814b15c38f4b0cd84a76411f1d1f704d1ef4eec",
  "d05e07668e4ada9a7e10472137ef2208ac66cdab73bdaee13304fbd22d5d35fb",
  "d8555dc9ae9af86e5eaa5e3bebb563b1e29f4d5227bbb3dbaf0375bfd440769f",
  "de6257a3fc8e46a7b07e9588317c5782960be7f76d0ec1160f03fad2a32c5dd3",
  "f0604873d6c89049370d65fa114902823ab3765251a019a85f26543bdcf16361",
  "f6f40a471e9f6feca32be3ae6d1ee2c07b94e1a0c8f668ea1f95e62b3099a5b8",
  "ff68c888dc9ef2db7774dfa11285e3d4c05a9b383ed90b5ded2cacb96c3510ff",
]);
type Row = Record<string, unknown>;
type Status = "passed" | "failed" | "unavailable";
export type NativeTranscript = {
  id: string;
  kind: string;
  terms?: string[];
  model?: string;
  effort?: string;
  claudeTypes?: string[];
};

function row(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function checkKind(check: Row): Omit<NativeTranscript, "id"> | null {
  const pattern = check.not_regex;
  if (
    typeof pattern === "string" &&
    pattern
      .split("|")
      .every((term) =>
        [
          "adaptive-goal-preflight step",
          "Protocol ledger",
          "darrow-native-goal-report",
          "claude-route-gate",
        ].includes(term),
      )
  )
    return { kind: "ledger", terms: pattern.split("|") };
  if (pattern === '"skill":"adaptive-goal"|adaptive-goal-preflight prepare')
    return { kind: "inactive" };
  if (
    pattern ===
    '"type":"darrow.codex_native_spawn"[^\\n]*"status":"accepted"[\\s\\S]*"type":"darrow.eval.follow_up_turn"'
  )
    return { kind: "no-child-before-feedback" };
  return positiveKind(check) ?? repairReuseKind(check) ?? claudeKind(check);
}

function positiveKind(check: Row): Omit<NativeTranscript, "id"> | null {
  const pattern = check.expect_regex;
  if (
    pattern ===
    '"type":"darrow.eval.follow_up_turn"[^\\n]*"native_goal_observed":false[^\\n]*"native_goal_status":null'
  )
    return { kind: "no-goal-before-feedback" };
  if (
    check.name !==
      "selected implementation policy route has accepted bounded-child evidence" ||
    typeof pattern !== "string"
  )
    return null;
  if (
    !pattern.includes('"status":"accepted"') ||
    !pattern.includes("darrow\\.codex_native_spawn")
  )
    return null;
  const model = pattern.includes('"model":"gpt-6-astra"')
    ? "gpt-6-astra"
    : pattern.includes('"model":"gpt-6-luna"')
      ? "gpt-6-luna"
      : null;
  if (!model) return null;
  return {
    kind: "route",
    model,
    effort: pattern.includes('"reasoning_effort":"high"') ? "high" : "medium",
    claudeTypes: implementationClaudeTypes(model, pattern),
  };
}

function implementationClaudeTypes(model: string, pattern: string) {
  if (model === "gpt-6-astra")
    return ["darrow-adaptive-goal:adaptive-goal-opus-5-5-high"];
  if (pattern.includes('"reasoning_effort":"high"'))
    return ["darrow-adaptive-goal:adaptive-goal-sonnet-5-5-medium"];
  return [
    "darrow-adaptive-goal:adaptive-goal-sonnet-5-5-low",
    "darrow-adaptive-goal:adaptive-goal-sonnet-5-5-medium",
  ];
}

// Repairs return to the one implementor that produced the candidate.
const REPAIR_REUSE_NAME = "repair returns to the retained implementor";
const REPAIR_REUSE_PATTERN = String.raw`"type":"darrow.codex_native_spawn"[^\n]*"model":"gpt-6.1-sol"[^\n]*"reasoning_effort":"high"[^\n]*"agent_ref":"([^"]+)"[\s\S]*"type":"darrow.codex_native_feedback"[^\n]*"agent_ref":"\1"|"name":"Agent"[\s\S]*"name":"SendMessage"`;

function repairReuseKind(check: Row): Omit<NativeTranscript, "id"> | null {
  if (
    check.name !== REPAIR_REUSE_NAME ||
    check.expect_regex !== REPAIR_REUSE_PATTERN
  )
    return null;
  return {
    kind: "repair-reuse",
    model: "gpt-6.1-sol",
    effort: "high",
  };
}

function claudeKind(check: Row): Omit<NativeTranscript, "id"> | null {
  const names: Record<string, string> = {
    "Claude invokes the readiness skill exactly once": "readiness-once",
    "Claude does not retry readiness without a user resolution":
      "readiness-no-retry",
    "Claude launches no owner before ready": "no-claude-owner",
    "advertised independent review skill is invoked": "independent-review",
  };
  const kind = names[String(check.name)];
  return kind ? { kind } : null;
}

export function nativeTranscriptPolicy(value: unknown): NativeTranscript[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw new Error("native transcript checks must be an array");
  return value.map((entry, index) => {
    const check = row(entry);
    if (
      !allowedPatterns.has(
        createHash("sha256").update(JSON.stringify(check)).digest("hex"),
      )
    )
      throw new Error("Native transcript assertion has changed");
    const selected = check ? checkKind(check) : null;
    if (!selected)
      throw new Error(
        `native transcript check ${index + 1} has no Sevro evidence mapping`,
      );
    return { id: `darrow.evals.transcript.${index + 1}`, ...selected };
  });
}

export function nativeTranscriptEvidence(checks: NativeTranscript[]): string[] {
  return [
    ...new Set(
      checks.flatMap((check) => {
        if (check.kind === "ledger") return [];
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
// a Verification review coordinator or invokes the verify-change skill.
function claudeImplementors(tools: Row[], nested: Row[] | null): Row[] {
  const verification = new Set([
    ...tools
      .filter(
        (call) =>
          call.name === "Agent" &&
          call.actor === "nested" &&
          String(call.subagentType).startsWith("darrow-verification:"),
      )
      .map((call) => call.parentToolUseId),
    ...(nested ?? [])
      .filter((call) => call.skill === "verify-change")
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
  return (
    typeof target === "string" &&
    target.length > 0 &&
    (target === name || resultText.includes(target))
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
  const { events } = context;
  if (check.kind === "ledger")
    return events === null
      ? "unavailable"
      : check.terms!.some((term) => events.includes(term))
        ? "failed"
        : "passed";
  if (check.kind === "route") return hostRouteStatus(check, context);
  if (check.kind === "repair-reuse") return repairReuseStatus(check, context);
  if (check.kind === "inactive") return inactiveStatus(context);
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
  if (check.kind === "ledger") return [eventId];
  if (check.kind === "inactive") return [context.skills!.evidenceRef, eventId];
  if (
    check.kind === "independent-review" &&
    context.claudeTools &&
    countSkill(context.claudeTools, "independent-code-review") === 0
  )
    return ["sevro.claude.tool-calls", "sevro.claude.nested-skills"];
  return ["sevro.claude.tool-calls"];
}
