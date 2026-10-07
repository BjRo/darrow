type RecordValue = Record<string, unknown>;
type Status = "passed" | "failed" | "unavailable";
const states = new Set([
  "active",
  "paused",
  "blocked",
  "usageLimited",
  "budgetLimited",
  "complete",
]);

function object(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function observation(values: unknown, id: string) {
  if (!Array.isArray(values)) return null;
  const matches = values.map(object).filter((row) => row?.id === id);
  const row = matches.length === 1 ? matches[0] : null;
  if (
    !row ||
    row.completeness !== "complete" ||
    !["sevro.host.codex", "sevro.host.claude"].includes(String(row.source))
  )
    return null;
  return object(row.data);
}

function validGoal(value: unknown) {
  const goal = object(value);
  return (
    goal &&
    states.has(String(goal.status)) &&
    Number.isInteger(goal.characters) &&
    Number(goal.characters) >= 1 &&
    Number(goal.characters) <= 4000
  );
}

function validHistory(
  data: RecordValue | null,
): data is RecordValue & { goals: unknown[] } {
  return (
    !!data &&
    typeof data.threadId === "string" &&
    !!data.threadId &&
    !data.failure &&
    Array.isArray(data.goals)
  );
}

function activationStatus(expected: unknown, data: RecordValue | null): Status {
  if (!validHistory(data)) return "unavailable";
  if (!data.goals.every(validGoal)) return "unavailable";
  if (
    data.goals.length === 0
      ? data.goalStatus !== null
      : data.goalStatus !== object(data.goals.at(-1))!.status
  )
    return "unavailable";
  const activated =
    data.goals.length > 0 && states.has(String(data.goalStatus));
  const absent = data.goals.length === 0 && data.goalStatus === null;
  return (expected === "required" ? activated : absent) ? "passed" : "failed";
}

export function nativeGoalPolicy(expected: unknown) {
  if (expected !== "required" && expected !== "forbidden")
    throw new Error("native_goal must be required or forbidden");
  return {
    checks: [
      "darrow.evals.native-goal",
      "darrow.evals.native-goal.internal-record",
      "darrow.evals.native-goal.canonical-report",
    ].map((id) => ({
      id,
      grader: "darrow.evals.native-goal",
      configuration: {},
    })),
    requiredEvidence: ["sevro.host.native-goal"],
    details: { nativeGoal: expected },
  };
}

function outcome(id: string, status: Status, evidenceId: string) {
  return {
    id,
    status,
    detail:
      status === "unavailable"
        ? "Native evidence is unavailable or incomplete"
        : "Graded the retained native goal and final response",
    evidenceRefs: status === "unavailable" ? [] : [evidenceId],
  };
}

export function nativeGoalOutcomes(expected: unknown, values: unknown) {
  if (expected === undefined) return [];
  const data = observation(values, "sevro.host.native-goal");
  const final = observation(values, "sevro.observation.final-message");
  const text = typeof final?.text === "string" ? final.text : null;
  return [
    outcome(
      "darrow.evals.native-goal",
      activationStatus(expected, data),
      "sevro.host.native-goal",
    ),
    outcome(
      "darrow.evals.native-goal.internal-record",
      text === null
        ? "unavailable"
        : /format\tdarrow-(?:native-goal|goal-step|claude-(?:agent-route|owner-route|route-gate|verify-route))-/.test(
              text,
            )
          ? "failed"
          : "passed",
      "sevro.observation.final-message",
    ),
    outcome(
      "darrow.evals.native-goal.canonical-report",
      text === null
        ? "unavailable"
        : /darrow-goal-report|darrow-native-goal-report/.test(text)
          ? "failed"
          : "passed",
      "sevro.observation.final-message",
    ),
  ];
}
