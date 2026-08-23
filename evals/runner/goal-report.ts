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
export type ImplementationReadinessVerdict =
  "ready" | "needs-discovery" | "needs-decision" | "blocked";

export interface ImplementationReadinessResult {
  verdict: ImplementationReadinessVerdict;
}

const GOAL_REPORT_FORMAT = "darrow-native-goal-report-v1";
const INTERNAL_GOAL_FORMAT =
  /format\tdarrow-(?:native-goal|goal-step|claude-(?:agent-route|route-gate|verify-route))-[^\s]+/;
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

const READINESS_HEADINGS = [
  "### Basis",
  "### Quality bar",
  "### Findings",
  "### Required next action",
] as const;
const READINESS_ACTIONS: Record<ImplementationReadinessVerdict, string> = {
  ready: "none",
  "needs-discovery": "discovery",
  "needs-decision": "decision",
  blocked: "unblock",
};

function readinessSectionIndexes(lines: string[]): number[] | undefined {
  const indexes = READINESS_HEADINGS.map((heading) =>
    lines.flatMap((line, index) => (line === heading ? [index] : [])),
  );
  if (indexes.some((matches) => matches.length !== 1)) return undefined;
  const flattened = indexes.map((matches) => matches[0]!);
  return flattened.every(
    (index, position) => position === 0 || index > flattened[position - 1]!,
  )
    ? flattened
    : undefined;
}

function readinessSection(
  lines: string[],
  indexes: number[],
  position: number,
): string[] {
  const end = indexes[position + 1] ?? lines.length;
  return lines.slice(indexes[position]! + 1, end).filter(Boolean);
}

function matchesFixedReadinessItems(
  lines: string[],
  fields: RegExp[],
): boolean {
  if (lines.length === 0 || lines.length % fields.length !== 0) return false;
  return lines.every((line, index) =>
    fields[index % fields.length]!.test(line),
  );
}

function matchesReadinessFindings(lines: string[]): boolean {
  const findingType =
    /^- \*\*Type:\*\* `(missing-information|unresolved-decision|contradiction|dependency|permission|quality-bar-gap)`$/;
  let index = 0;
  let findings = 0;
  while (index < lines.length) {
    if (!findingType.test(lines[index]!)) return false;
    if (!/^- \*\*Summary:\*\* \S/.test(lines[index + 1] ?? "")) return false;
    if (lines[index + 2] !== "- **Evidence:**") return false;
    index += 3;
    let evidence = 0;
    while (index < lines.length && !findingType.test(lines[index]!)) {
      if (!/^- (?!\*\*)\S/.test(lines[index]!)) return false;
      evidence += 1;
      index += 1;
    }
    if (evidence === 0) return false;
    findings += 1;
  }
  return findings > 0;
}

function readinessVerdict(
  lines: string[],
  indexes: number[],
): ImplementationReadinessVerdict | undefined {
  const introduction = lines.slice(0, indexes[0]).filter(Boolean);
  if (introduction.length !== 2) return undefined;
  return introduction[1]!.match(
    /^\*\*Verdict:\*\* `(ready|needs-discovery|needs-decision|blocked)`$/,
  )?.[1] as ImplementationReadinessVerdict | undefined;
}

function matchesReadinessBasis(lines: string[]): boolean {
  return matchesFixedReadinessItems(lines, [
    /^- \*\*Source:\*\* \S/,
    /^- \*\*Authority:\*\* `(authoritative|repository|supporting)`$/,
    /^- \*\*Status:\*\* `(available|missing|contradictory)`$/,
    /^- \*\*Summary:\*\* \S/,
  ]);
}

function matchesReadinessQualityBar(
  lines: string[],
  verdict: ImplementationReadinessVerdict,
): boolean {
  const structured = matchesFixedReadinessItems(lines, [
    /^- \*\*Criterion:\*\* \S/,
    /^- \*\*Oracle:\*\* \S/,
    /^- \*\*Verification:\*\* \S/,
  ]);
  return verdict === "ready"
    ? structured
    : structured || lines.join("\n") === "None.";
}

function matchesReadinessAction(
  lines: string[],
  verdict: ImplementationReadinessVerdict,
): boolean {
  if (lines.length !== 2) return false;
  const action = lines[0]!.match(
    /^- \*\*Type:\*\* `(none|discovery|decision|unblock)`$/,
  )?.[1];
  return (
    action === READINESS_ACTIONS[verdict] &&
    /^- \*\*Description:\*\* \S/.test(lines[1]!)
  );
}

function matchesReadinessSections(
  lines: string[],
  indexes: number[],
  verdict: ImplementationReadinessVerdict,
): boolean {
  const findings = readinessSection(lines, indexes, 2);
  return [
    matchesReadinessBasis(readinessSection(lines, indexes, 0)),
    matchesReadinessQualityBar(readinessSection(lines, indexes, 1), verdict),
    verdict === "ready"
      ? findings.join("\n") === "None."
      : matchesReadinessFindings(findings),
    matchesReadinessAction(readinessSection(lines, indexes, 3), verdict),
  ].every(Boolean);
}

/** Parse one complete default human-readable readiness result. */
export function parseImplementationReadinessResult(
  resultText: string,
): ImplementationReadinessResult | undefined {
  const lines = resultText
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim());
  if (lines[0] !== "## Implementation readiness") return undefined;
  const indexes = readinessSectionIndexes(lines);
  if (!indexes) return undefined;
  const verdict = readinessVerdict(lines, indexes);
  return verdict && matchesReadinessSections(lines, indexes, verdict)
    ? { verdict }
    : undefined;
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

/** Parse the outer report that follows a complete non-ready readiness result. */
export function parseReadinessCompanionGoalReport(
  resultText: string,
): GoalReport | undefined {
  const lines = resultText.trimStart().split("\n");
  if (lines[0]?.trim() !== "## Implementation readiness") return undefined;
  const starts = reportStarts(lines);
  if (starts.length !== 1 || starts[0]! < 2) return undefined;
  const preceding = lines
    .slice(0, starts[0])
    .findLast((line) => line.trim().length > 0);
  if (preceding?.trim().startsWith("```")) return undefined;
  const readinessResult = lines.slice(0, starts[0]).join("\n").trim();
  const parsedReadiness = parseImplementationReadinessResult(readinessResult);
  if (!parsedReadiness || parsedReadiness.verdict === "ready") return undefined;
  return parseGoalReport(lines.slice(starts[0]).join("\n"));
}

/** Parse either ordinary terminal ordering or the readiness companion ordering. */
export function parseTerminalGoalReport(
  resultText: string,
): GoalReport | undefined {
  return (
    parseGoalReport(resultText) ?? parseReadinessCompanionGoalReport(resultText)
  );
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
  if (report.route_verified !== "true" || report.harness === "none")
    return false;
  const appliedByBoundary: Record<string, string> = {
    same_thread: "current-thread",
    host_api: "host-api",
    native_subagent: "native-subagent",
    nested_session: "nested-session",
  };
  return appliedByBoundary[report.launch_boundary] === report.route_applied_by;
}

/** Detect an internal Darrow launch record regardless of Markdown prefixes. */
export function exposesInternalGoalRecord(resultText: string): boolean {
  return INTERNAL_GOAL_FORMAT.test(resultText);
}
