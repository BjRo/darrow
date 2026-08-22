export const GOAL_REPORT_KEYS = [
  "format",
  "workflow",
  "risk",
  "profile",
  "harness",
  "model",
  "effort",
  "route_applied_by",
  "route_verified",
  "launch_boundary",
  "verification_gate",
  "evaluation_child_invocations",
  "evaluation_human_interruptions",
  "enforcement",
] as const;

export type GoalReport = Record<(typeof GOAL_REPORT_KEYS)[number], string>;

const GOAL_REPORT_FORMAT = "darrow-native-goal-report-v1";
const INTERNAL_GOAL_FORMAT =
  /format\tdarrow-native-goal-(?:preflight-v(?:2|4)|route-application-v1)/;
const GOAL_REPORT_VALUES: Record<keyof GoalReport, RegExp> = {
  format: /^darrow-native-goal-report-v1$/,
  workflow:
    /^(?:fix-bug|implement-feature|change-feature|refactor|migration|mechanical|decision-gated)$/,
  risk: /^(?:routine|elevated|high)$/,
  profile: /^(?:routine|routine-plus|scaled|repo-wide|judgment|none)$/,
  harness: /^(?:codex|claude|none)$/,
  model: /^(?:openai|anthropic|unknown|none) > [^\n]+$/,
  effort: /^(?:low|medium|high|xhigh|max|ultra|unknown|none)$/,
  route_applied_by:
    /^(?:current-thread|host-api|native-subagent|nested-session|none)$/,
  route_verified: /^(?:true|false)$/,
  launch_boundary:
    /^(?:same_thread|host_api|native_subagent|nested_session|launch_required)$/,
  verification_gate: /^(?:routine|elevated|high|not-applicable)$/,
  evaluation_child_invocations: /^\d+$/,
  evaluation_human_interruptions: /^\d+$/,
  enforcement: /^(?:helper|helper\+claude-hooks|helper\+codex-hooks)$/,
};

const DECISION_GATED_REPORT: Partial<GoalReport> = {
  risk: "high",
  profile: "none",
  harness: "none",
  model: "none > none",
  effort: "none",
  route_applied_by: "none",
  route_verified: "false",
  launch_boundary: "launch_required",
  verification_gate: "not-applicable",
  evaluation_child_invocations: "0",
  evaluation_human_interruptions: "1",
};

function reportStarts(lines: string[]): number[] {
  const marker = `format: ${GOAL_REPORT_FORMAT}`;
  return lines.flatMap((line, index) =>
    line.trim() === marker ? [index] : [],
  );
}

/** Parse exactly one ordered, contiguous adaptive-goal report block. */
export function parseGoalReport(resultText: string): GoalReport | undefined {
  const lines = resultText.trimStart().split("\n");
  const starts = reportStarts(lines);
  if (starts.length !== 1 || starts[0] !== 0) return undefined;
  const report = {} as GoalReport;
  for (const [offset, key] of GOAL_REPORT_KEYS.entries()) {
    const line = lines[starts[0]! + offset]?.trim();
    const prefix = `${key}: `;
    if (!line?.startsWith(prefix) || line.length === prefix.length)
      return undefined;
    report[key] = line.slice(prefix.length).trimEnd();
  }
  return report.format === GOAL_REPORT_FORMAT ? report : undefined;
}

/** Parse the optional report that may follow a nonterminal feedback question. */
export function parsePausedGoalReport(
  resultText: string,
): GoalReport | undefined {
  const lines = resultText.trimStart().split("\n");
  if (lines[0]?.trim() !== "- phase: human-feedback-request") return undefined;
  const starts = reportStarts(lines);
  if (starts.length !== 1 || starts[0]! < 2) return undefined;
  const question = lines.slice(1, starts[0]).join("\n").trim();
  if (!question) return undefined;
  return parseGoalReport(lines.slice(starts[0]).join("\n"));
}

/** Validate every closed field and counter in a parsed report. */
export function validGoalReportValues(report: GoalReport | undefined): boolean {
  if (!report) return false;
  return (
    GOAL_REPORT_KEYS.every((key) =>
      GOAL_REPORT_VALUES[key].test(report[key]),
    ) &&
    decisionReportIsConsistent(report) &&
    routeReportIsConsistent(report)
  );
}

function decisionReportIsConsistent(report: GoalReport): boolean {
  if (report.workflow !== "decision-gated")
    return report.verification_gate === report.risk;
  return Object.entries(DECISION_GATED_REPORT).every(
    ([key, value]) => report[key as keyof GoalReport] === value,
  );
}

function routeReportIsConsistent(report: GoalReport): boolean {
  if (report.launch_boundary === "launch_required")
    return report.route_verified === "false";
  if (report.route_verified !== "true") return true;
  return report.harness !== "none" && report.route_applied_by !== "none";
}

/** Detect an internal Darrow launch record regardless of Markdown prefixes. */
export function exposesInternalGoalRecord(resultText: string): boolean {
  return INTERNAL_GOAL_FORMAT.test(resultText);
}
