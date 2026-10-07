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
  return positiveKind(check) ?? claudeKind(check);
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
          return ["sevro.codex.skill-reads", "sevro.codex.events"];
        // Both hosts expose the common control receipt. Host-specific facts are
        // validated by the check; requiring both would make every trial unknown.
        if (check.kind === "route") return ["sevro.host.native-controls"];
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

function inactiveStatus(values: unknown, events: string | null): Status {
  const skills = observation(values, "sevro.codex.skill-reads");
  if (!skills || !Array.isArray(skills.observedSkills) || events === null)
    return "unavailable";
  return skills.observedSkills.includes("adaptive-goal") ||
    events.includes("adaptive-goal-preflight prepare")
    ? "failed"
    : "passed";
}

type NativeContext = {
  events: string | null;
  eventId: string;
  spawns: Row[] | null;
  claudeTools: Row[] | null;
  claudeNestedSkills: Row[] | null;
  claudeCompletedRoutes: Row[] | null;
};
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
  if (check.kind === "route") {
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
  if (check.kind === "inactive") return inactiveStatus(values, events);
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

function transcriptRefs(check: NativeTranscript, context: NativeContext) {
  const { eventId } = context;
  if (check.kind === "route")
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
  if (check.kind === "inactive") return ["sevro.codex.skill-reads", eventId];
  if (
    check.kind === "independent-review" &&
    context.claudeTools &&
    countSkill(context.claudeTools, "independent-code-review") === 0
  )
    return ["sevro.claude.tool-calls", "sevro.claude.nested-skills"];
  return ["sevro.claude.tool-calls"];
}
