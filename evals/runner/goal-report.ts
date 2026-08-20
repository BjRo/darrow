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
};

function reportStarts(lines: string[]): number[] {
  const marker = `format: ${GOAL_REPORT_FORMAT}`;
  return lines.flatMap((line, index) =>
    line.trim() === marker ? [index] : [],
  );
}

/** Parse exactly one ordered, contiguous adaptive-goal report block. */
export function parseGoalReport(resultText: string): GoalReport | undefined {
  const lines = resultText.split("\n");
  const starts = reportStarts(lines);
  if (starts.length !== 1) return undefined;
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

/** Validate every closed field and counter in a parsed report. */
export function validGoalReportValues(report: GoalReport | undefined): boolean {
  if (!report) return false;
  return GOAL_REPORT_KEYS.every((key) =>
    GOAL_REPORT_VALUES[key].test(report[key]),
  );
}

/** Detect an internal Darrow launch record regardless of Markdown prefixes. */
export function exposesInternalGoalRecord(resultText: string): boolean {
  return INTERNAL_GOAL_FORMAT.test(resultText);
}
