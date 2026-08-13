import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { CaseResult, JudgeAssessment } from "./types";

export interface ReportCell {
  harness: string;
  mode: string;
  gating?: boolean;
  results: CaseResult[];
}

function mean(values: number[]): number | undefined {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : undefined;
}

function p95(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

function percent(value: number | undefined): string {
  return value === undefined ? "n/a" : `${(value * 100).toFixed(0)}%`;
}

function activationPercent(value: number | null | undefined): string {
  return value === null ? "unknown" : percent(value);
}

function milliseconds(value: number | undefined): string {
  return value === undefined ? "n/a" : `${(value / 1000).toFixed(1)}s`;
}

function tokens(value: number | undefined): string {
  return value === undefined ? "unknown" : Math.round(value).toString();
}

function cost(value: number | undefined): string {
  return value === undefined ? "unknown" : `$${value.toFixed(4)}`;
}

function isBookkeepingCheck(name: string): boolean {
  return (
    name === "reported child invocation count" ||
    name === "reported human intervention count"
  );
}

function taskPassRate(result: CaseResult): number {
  if (!result.trials.length) return result.passRate;
  return (
    result.trials.filter((trial) =>
      [
        trial.harness.ok,
        ...trial.checks
          .filter((check) => !isBookkeepingCheck(check.name))
          .map((check) => check.passed),
      ].every(Boolean),
    ).length / result.trials.length
  );
}

function meanWhenDefined(values: (number | undefined)[]): number | undefined {
  return values.length && values.every((value) => value !== undefined)
    ? mean(values as number[])
    : undefined;
}

/** Mean over a reported series, or undefined when any entry is unreported. */
function meanWhenComplete(values: (number | null)[]): number | undefined {
  return values.length && values.every((value) => value !== null)
    ? mean(values as number[])
    : undefined;
}

/** Sum over a reported series, or undefined when any entry is unreported. */
function totalWhenComplete(values: (number | null)[]): number | undefined {
  return values.length && values.every((value) => value !== null)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
}

function cellAssessments(cell: ReportCell): JudgeAssessment[] | undefined {
  const trials = cell.results.flatMap((result) => result.trials);
  const assessments = trials.map((trial) =>
    trial.judge?.ok ? trial.judge.assessment : undefined,
  );
  return assessments.length &&
    assessments.every((assessment) => assessment !== undefined)
    ? (assessments as JudgeAssessment[])
    : undefined;
}

function cellJudgeRuns(cell: ReportCell) {
  const trials = cell.results.flatMap((result) => result.trials);
  const runs = trials.map((trial) => trial.judge?.harness);
  return runs.length && runs.every((run) => run !== undefined)
    ? (runs as NonNullable<(typeof runs)[number]>[])
    : undefined;
}

function rollupJudgeQuality(cell: ReportCell) {
  return {
    judgeScore: meanWhenDefined(
      cell.results.map((result) => result.meanJudgeScore),
    ),
    judgePass: meanWhenDefined(
      cell.results.map((result) => result.judgePassRate),
    ),
  };
}

function judgeQuality(
  cell: ReportCell,
  assessments: JudgeAssessment[] | undefined,
) {
  const trialCount = cell.results.reduce(
    (total, result) => total + result.trials.length,
    0,
  );
  if (!trialCount) return rollupJudgeQuality(cell);
  return {
    judgeScore: assessments
      ? mean(assessments.map((assessment) => assessment.overallScore))
      : undefined,
    judgePass: assessments
      ? assessments.filter((assessment) => assessment.verdict === "pass")
          .length / assessments.length
      : undefined,
  };
}

function candidateDurations(cell: ReportCell): number[] {
  return cell.results.flatMap((result) =>
    result.trials.length
      ? result.trials.map((trial) => trial.harness.durationMs)
      : [result.meanDurationMs],
  );
}

/** Interventions are a total, so an unreported case must not read as zero. */
function humanInterventions(cell: ReportCell): number | undefined {
  const values = cell.results.map((result) => result.totalHumanInterruptions);
  return values.every((value) => value !== undefined)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : undefined;
}

function cellMetrics(cell: ReportCell) {
  const durations = candidateDurations(cell);
  const assessments = cellAssessments(cell);
  const judgeRuns = cellJudgeRuns(cell);
  return {
    taskPass: mean(cell.results.map(taskPassRate)),
    protocolPass: mean(cell.results.map((result) => result.passRate)),
    ...judgeQuality(cell, assessments),
    wallMean: mean(durations),
    wallP95: p95(durations),
    candidateTokens: meanWhenComplete(
      cell.results.map((result) => result.meanTokens),
    ),
    candidateCost: totalWhenComplete(
      cell.results.map((result) => result.totalCostUsd),
    ),
    childInvocations: meanWhenDefined(
      cell.results.map((result) => result.meanChildInvocationCount),
    ),
    humanInterventions: humanInterventions(cell),
    judgeTokens: judgeRuns
      ? mean(judgeRuns.map((run) => run.inputTokens + run.outputTokens))
      : undefined,
    judgeCost: judgeRuns
      ? totalWhenComplete(judgeRuns.map((run) => run.costUsd))
      : undefined,
    assessments: assessments ?? [],
  };
}

interface CellMetricRow {
  cell: ReportCell;
  metric: ReturnType<typeof cellMetrics>;
}

function outcomesSection(
  rows: CellMetricRow[],
  orchestrationEvidence: boolean,
): string[] {
  return [
    orchestrationEvidence
      ? "# Orchestration value benchmark"
      : "# Evaluation suite report",
    "",
    "Task pass is the primary outcome and excludes evaluator bookkeeping records. Protocol pass additionally requires the candidate to report child-invocation and human-intervention counts. The condition-blind LLM judge is advisory and scores final-tree correctness, maintainability, test quality, and scope discipline on a 1–5 scale.",
    "",
    "## Outcomes and candidate efficiency",
    "",
    "| Harness | Mode | Task pass | Protocol pass | Judge score | Judge pass | Wall mean / p95 | Candidate tokens mean | Candidate cost | Children mean | Human interventions |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map(
      ({ cell, metric }) =>
        `| ${cell.harness} | ${cell.mode} | ${percent(metric.taskPass)} | ${percent(metric.protocolPass)} | ${metric.judgeScore?.toFixed(2) ?? "n/a"} | ${percent(metric.judgePass)} | ${milliseconds(metric.wallMean)} / ${milliseconds(metric.wallP95)} | ${tokens(metric.candidateTokens)} | ${cost(metric.candidateCost)} | ${metric.childInvocations?.toFixed(1) ?? "n/a"} | ${metric.humanInterventions ?? "n/a"} |`,
    ),
  ];
}

function perTaskSection(cells: ReportCell[]): string[] {
  return [
    "",
    "## Per-task outcomes",
    "",
    "The aggregate is intentionally paired with task-level results so one task shape cannot hide another.",
    "",
    "| Harness | Mode | Case | Workload digest | Entrypoint adapter | Transport | Task pass | Protocol pass | Judge score | Wall mean | Candidate tokens mean |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...cells.flatMap((cell) =>
      cell.results.map(
        (result) =>
          `| ${cell.harness} | ${cell.mode} | ${result.caseId} | ${result.evaluationDigest} | ${result.entrypointAdapter ?? "none"} | ${result.entrypointTransport ?? "none"} | ${percent(taskPassRate(result))} | ${percent(result.passRate)} | ${result.meanJudgeScore?.toFixed(2) ?? "n/a"} | ${milliseconds(result.meanDurationMs)} | ${result.meanTokens === null ? "unknown" : Math.round(result.meanTokens)} |`,
      ),
    ),
  ];
}

const activationSourceLabel = (
  source:
    "harness_event" | "skill_file_read_probe" | "skill_activation_probe" | null,
): string =>
  source === "harness_event"
    ? "harness event"
    : source === "skill_file_read_probe"
      ? "skill-file read probe"
      : source === "skill_activation_probe"
        ? "private activation probe"
        : "unknown";

function caseActivationRate(result: CaseResult): number | null | undefined {
  if (result.activationClass === undefined) return undefined;
  if (!result.trials.length) {
    return typeof result.activationPassRate === "number"
      ? result.activationPassRate
      : result.activationPassRate === null
        ? null
        : undefined;
  }
  const grades = result.trials.map((trial) => trial.activation);
  if (grades.some((grade) => grade === undefined || grade.passed === null))
    return null;
  return (
    grades.filter((grade) => grade?.passed === true).length / grades.length
  );
}

function caseActivationPrimary(result: CaseResult): string {
  if (!result.trials.length) return "unknown";
  const grades = result.trials.map((trial) => trial.activation);
  if (grades.some((grade) => grade === undefined || grade.passed === null))
    return "unknown";
  return [
    ...new Set(grades.map((grade) => grade?.primarySkill ?? "none")),
  ].join(", ");
}

function caseActivationSources(result: CaseResult): string {
  if (!result.trials.length) return "unknown";
  const sources = result.trials.map(
    (trial) => trial.activation?.source ?? null,
  );
  return [
    ...new Set(sources.map((source) => activationSourceLabel(source))),
  ].join(", ");
}

type ActivationGrade = NonNullable<CaseResult["trials"][number]["activation"]>;

function completeActivationGrades(declared: CaseResult[]): {
  grades: ActivationGrade[];
  complete: boolean;
} {
  const expected = declared.reduce(
    (total, result) => total + result.trials.length,
    0,
  );
  const possible = declared.flatMap((result) =>
    result.trials.map((trial) => trial.activation),
  );
  const complete =
    expected > 0 &&
    possible.length === expected &&
    possible.every(
      (grade) =>
        grade !== undefined && grade.passed !== null && grade.source !== null,
    );
  return {
    grades: complete
      ? possible.filter((grade): grade is ActivationGrade => !!grade)
      : [],
    complete,
  };
}

function activationClassRate(
  grades: ActivationGrade[],
  complete: boolean,
  activationClass: ActivationGrade["class"],
): number | null | undefined {
  if (!complete) return null;
  const matching = grades.filter((grade) => grade.class === activationClass);
  return matching.length
    ? matching.filter((grade) => grade.passed).length / matching.length
    : undefined;
}

function cellActivationMetrics(cell: ReportCell) {
  const declared = cell.results.filter(
    (result) => result.activationClass !== undefined,
  );
  if (!declared.length) return undefined;
  const { grades, complete } = completeActivationGrades(declared);
  const intended = grades.filter((grade) => grade.class !== "negative");
  const trueSelections = intended.filter((grade) => grade.passed).length;
  const falseSelections = grades.filter((grade) => {
    if (grade.class === "negative") return !grade.passed;
    return !grade.passed && grade.primarySkill !== null;
  }).length;
  const sources = [
    ...new Set(
      declared.flatMap((result) =>
        result.trials.map((trial) =>
          activationSourceLabel(trial.activation?.source ?? null),
        ),
      ),
    ),
  ].join(", ");
  return {
    recall: !complete
      ? null
      : intended.length
        ? trueSelections / intended.length
        : undefined,
    precision: !complete
      ? null
      : trueSelections + falseSelections > 0
        ? trueSelections / (trueSelections + falseSelections)
        : null,
    positive: activationClassRate(grades, complete, "positive"),
    negative: activationClassRate(grades, complete, "negative"),
    competition: activationClassRate(grades, complete, "competition"),
    sources,
  };
}

function activationSection(cells: ReportCell[]): string[] {
  const rows = cells
    .map((cell) => ({ cell, metric: cellActivationMetrics(cell) }))
    .filter(
      (
        row,
      ): row is {
        cell: ReportCell;
        metric: NonNullable<ReturnType<typeof cellActivationMetrics>>;
      } => row.metric !== undefined,
    );
  if (!rows.length) return [];
  return [
    "",
    "## Skill activation",
    "",
    "Activation is graded independently from task outcomes. Recall covers intended positive and competition selections; precision penalizes wrong primary selections on intended routes and owning skills selected on negative cases. `unknown` means at least one declared trial lacked complete harness-visible evidence or precision had no measured selection denominator.",
    "",
    "| Harness | Mode | Recall | Precision | Positive | Negative | Competition | Evidence |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map(
      ({ cell, metric }) =>
        `| ${cell.harness} | ${cell.mode} | ${activationPercent(metric.recall)} | ${activationPercent(metric.precision)} | ${activationPercent(metric.positive)} | ${activationPercent(metric.negative)} | ${activationPercent(metric.competition)} | ${metric.sources} |`,
    ),
    "",
    "### Per-case activation",
    "",
    "| Harness | Mode | Case | Class | Target | Primary observed | Activation pass | Task pass | Evidence |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | --- |",
    ...cells.flatMap((cell) =>
      cell.results
        .filter((result) => result.activationClass !== undefined)
        .map(
          (result) =>
            `| ${cell.harness} | ${cell.mode} | ${result.caseId} | ${result.activationClass} | ${result.activationTargetSkill} | ${caseActivationPrimary(result)} | ${activationPercent(caseActivationRate(result))} | ${percent(taskPassRate(result))} | ${caseActivationSources(result)} |`,
        ),
    ),
  ];
}

function phaseMean(
  cell: ReportCell,
  select: (result: CaseResult) => number | undefined,
): number | undefined {
  return meanWhenDefined(cell.results.map(select));
}

function phaseSection(cells: ReportCell[]): string[] {
  const phaseCells = cells.filter((cell) =>
    cell.results.some(
      (result) => result.meanClassifierDurationMs !== undefined,
    ),
  );
  if (!phaseCells.length) return [];
  return [
    "",
    "## Preflight and native execution phases",
    "",
    "Preparation is deterministic host work. Classifier metrics cover only the structured preflight turn; execution metrics exclude classifier usage.",
    "",
    "| Harness | Mode | Preparation mean | Classifier mean | Classifier tokens mean | Classifier calls mean | Execution mean | Execution tokens mean |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...phaseCells.map(
      (cell) =>
        `| ${cell.harness} | ${cell.mode} | ${milliseconds(phaseMean(cell, (result) => result.meanPreparationDurationMs))} | ${milliseconds(phaseMean(cell, (result) => result.meanClassifierDurationMs))} | ${tokens(phaseMean(cell, (result) => result.meanClassifierTokens))} | ${phaseMean(cell, (result) => result.meanClassifierModelCalls)?.toFixed(1) ?? "n/a"} | ${milliseconds(phaseMean(cell, (result) => result.meanExecutionDurationMs))} | ${tokens(phaseMean(cell, (result) => result.meanExecutionTokens))} |`,
    ),
  ];
}

function judgeOverheadSection(rows: CellMetricRow[]): string[] {
  return [
    "",
    "## Judge overhead",
    "",
    "Judge work is excluded from candidate wall time, token counts, and cost above.",
    "",
    "| Harness | Mode | Judge tokens mean | Judge cost |",
    "| --- | --- | ---: | ---: |",
    ...rows.map(
      ({ cell, metric }) =>
        `| ${cell.harness} | ${cell.mode} | ${tokens(metric.judgeTokens)} | ${cost(metric.judgeCost)} |`,
    ),
  ];
}

function observationBlock(label: string, items: string[]): string[] {
  return items.length
    ? [label, "", ...items.map((item) => `- ${item}`), ""]
    : [];
}

function qualitativeCell({ cell, metric }: CellMetricRow): string[] {
  const unique = (select: (item: JudgeAssessment) => string[]): string[] =>
    [...new Set(metric.assessments.flatMap(select))].slice(0, 5);
  return [
    `### ${cell.harness} / ${cell.mode}`,
    "",
    ...observationBlock(
      "Strengths:",
      unique((item) => item.strengths),
    ),
    ...observationBlock(
      "Weaknesses:",
      unique((item) => item.weaknesses),
    ),
  ];
}

function qualitativeSection(rows: CellMetricRow[]): string[] {
  const withAssessments = rows.filter(
    ({ metric }) => metric.assessments.length > 0,
  );
  if (!withAssessments.length) return [];
  return [
    "",
    "## Qualitative judge observations",
    "",
    ...withAssessments.flatMap(qualitativeCell),
  ];
}

const interpretationLimits = [
  "## Interpretation limits",
  "",
  "- `unknown` cost is intentional when a harness does not report actual provider cost; token counts remain available when the harness reports them.",
  "- Compare modes primarily within the same harness/model/effort block. Cross-harness differences also include model and CLI effects.",
  "- Setup and dependency installation occur before candidate timing. Judge work is measured separately.",
  "- Protocol-only failures indicate missing evaluation records, not a failed codebase contract; task pass and judge quality remain separately visible.",
  "- Human interventions are explicit stops for human decisions or authority, not ordinary model reasoning.",
  "",
];

function gateScopeSection(cells: ReportCell[]): string[] {
  const gating = cells
    .filter((cell) => cell.gating !== false)
    .map((cell) => `${cell.harness}/${cell.mode}`);
  const comparative = cells
    .filter((cell) => cell.gating === false)
    .map((cell) => `${cell.harness}/${cell.mode}`);
  if (!comparative.length) return [];
  return [
    "",
    "## Gate scope",
    "",
    `- Gating cells: ${gating.join(", ") || "none"}.`,
    `- Comparative-only cells: ${comparative.join(", ")}. Their failures remain evidence and do not fail the candidate gate.`,
  ];
}

export function renderSuiteReport(cells: ReportCell[]): string {
  const rows: CellMetricRow[] = cells.map((cell) => ({
    cell,
    metric: cellMetrics(cell),
  }));
  const orchestrationEvidence = cells.some((cell) =>
    cell.results.some(
      (result) => result.meanChildInvocationCount !== undefined,
    ),
  );
  return [
    ...outcomesSection(rows, orchestrationEvidence),
    ...perTaskSection(cells),
    ...activationSection(cells),
    ...phaseSection(cells),
    ...judgeOverheadSection(rows),
    ...gateScopeSection(cells),
    ...qualitativeSection(rows),
    ...interpretationLimits,
  ].join("\n");
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: { output: { type: "string" } },
  });
  if (positionals.length !== 1) {
    throw new Error(
      "usage: bun evals/runner/report.ts <suite-run.json> [--output report.md]",
    );
  }
  const manifestPath = resolve(process.cwd(), positionals[0]!);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    cells: Array<{
      harness: string;
      mode: string;
      gating?: boolean;
      result: string;
    }>;
  };
  const cells: ReportCell[] = [];
  for (const cell of manifest.cells) {
    cells.push({
      harness: cell.harness,
      mode: cell.mode,
      gating: cell.gating,
      results: JSON.parse(await readFile(cell.result, "utf8")) as CaseResult[],
    });
  }
  const outputPath = values.output
    ? resolve(process.cwd(), values.output)
    : join(dirname(manifestPath), "report.md");
  await writeFile(outputPath, renderSuiteReport(cells));
  console.log(`Report: ${outputPath}`);
}
