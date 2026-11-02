// v2 placement oracle. Historical provider assertions retain their mapping.
type Row = Record<string, unknown>;
type Status = "passed" | "failed" | "unavailable";
export type AssessmentReaders = {
  placement: "inline" | "fallback";
  axes: ("standards" | "spec")[];
  model: string;
  effort: string;
  claude?: { agent: string; model?: string; effort?: string };
};
export type CodexReaderContext = {
  spawns: Row[] | null;
  children: Row[] | null;
  nested: Row[] | null;
  complete: boolean;
};

function object(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}
function validAxes(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every((axis) => axis === "standards" || axis === "spec")
  );
}
function validClaudeSelection(value: unknown): boolean {
  if (value === undefined) return true;
  const data = object(value);
  if (!data || typeof data.agent !== "string" || !data.agent) return false;
  const keys = Object.keys(data).every((key) =>
    ["agent", "model", "effort"].includes(key),
  );
  const route =
    (data.model === undefined && data.effort === undefined) ||
    [data.model, data.effort].every(
      (field) => typeof field === "string" && field.length > 0,
    );
  return keys && route;
}
export function assessmentReadersSelection(value: unknown): AssessmentReaders {
  const data = object(value);
  if (!data) throw new Error("assessment_readers requires an object");
  const known = Object.keys(data).every((key) =>
    ["placement", "axes", "model", "effort", "claude"].includes(key),
  );
  const route = [data.model, data.effort].every(
    (v) => typeof v === "string" && v.length > 0,
  );
  if (
    !validClaudeSelection(data.claude) ||
    !known ||
    !route ||
    !validAxes(data.axes) ||
    !["inline", "fallback"].includes(String(data.placement))
  )
    throw new Error(
      "assessment_readers requires placement, unique axes and reader model/effort",
    );
  return data as AssessmentReaders;
}
function axis(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const matches = ["standards", "spec"].filter((value) =>
    new RegExp("(^|[-_])" + value + "($|[-_])").test(name),
  );
  return matches.length === 1 ? matches[0]! : null;
}
function readerStatus(reader: Row, expected: AssessmentReaders): Status {
  if (reader.forkTurns !== "none")
    return reader.forkTurns === undefined ? "unavailable" : "failed";
  if (
    typeof reader.model !== "string" ||
    typeof reader.reasoningEffort !== "string"
  )
    return "unavailable";
  if (
    reader.model !== expected.model ||
    reader.reasoningEffort !== expected.effort
  )
    return "failed";
  return reader.sessionStatus === "available" &&
    reader.readerResultStatus === "completed"
    ? "passed"
    : "unavailable";
}
function aggregate(statuses: Status[]): Status {
  return statuses.includes("failed")
    ? "failed"
    : statuses.includes("unavailable")
      ? "unavailable"
      : "passed";
}
function completedSession(spawn: Row, children: Row[]): Row {
  const sessions = children.filter(
    (child) => child.threadId === spawn.threadId,
  );
  const child = sessions.length === 1 ? sessions[0] : undefined;
  return {
    ...spawn,
    sessionStatus: child?.status,
    readerResultStatus: child?.resultStatus,
  };
}
function inlineReaders(context: CodexReaderContext): Row[] | Status {
  const { spawns, children } = context;
  if (!spawns || !children) return "unavailable";
  if (spawns.some((spawn) => axis(spawn.taskName) === null)) return "failed";
  return spawns.map((spawn) => completedSession(spawn, children));
}
function capable(owner: Row): boolean {
  return (
    owner.model === "gpt-6.1-sol" &&
    owner.reasoningEffort === "medium" &&
    owner.forkTurns === "none" &&
    axis(owner.taskName) === null
  );
}
function completedCoordinator(children: Row[]): boolean {
  return (
    children[0]?.status === "available" &&
    children[0]?.resultStatus === "completed"
  );
}
function fallbackReaders(context: CodexReaderContext): Row[] | Status {
  const { spawns, children, nested } = context;
  if (!spawns || !children || !nested) return "unavailable";
  if (spawns.length !== 1 || !capable(spawns[0]!)) return "failed";
  if (!completedCoordinator(children)) return "unavailable";
  if (nested.some((reader) => reader.status !== "accepted"))
    return "unavailable";
  if (nested.some((reader) => axis(reader.taskName) === null)) return "failed";
  return nested;
}
function axisStatus(
  value: string,
  readers: Row[],
  expected: AssessmentReaders,
): Status {
  const matches = readers.filter((reader) => axis(reader.taskName) === value);
  return matches.length === 1 ? readerStatus(matches[0]!, expected) : "failed";
}
// The caller binds these facts to one complete public native observation.
export function codexAssessmentReaders(
  expected: AssessmentReaders,
  context: CodexReaderContext,
): Status {
  if (!context.complete) return "unavailable";
  const readers =
    expected.placement === "inline"
      ? inlineReaders(context)
      : fallbackReaders(context);
  if (typeof readers === "string") return readers;
  return aggregate(
    expected.axes.map((value) => axisStatus(value, readers, expected)),
  );
}

export { claudeAssessmentReaders } from "./claude-assessment";
