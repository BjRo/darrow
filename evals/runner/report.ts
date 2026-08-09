import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { CaseResult, JudgeAssessment } from "./types";

export interface ReportCell {
  harness: string;
  mode: string;
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
      trial.checks
        .filter((check) => !isBookkeepingCheck(check.name))
        .every((check) => check.passed),
    ).length / result.trials.length
  );
}

function definedNumbers(values: (number | undefined)[]): number[] {
  return values.filter((value): value is number => value !== undefined);
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

function cellAssessments(cell: ReportCell): JudgeAssessment[] {
  return cell.results.flatMap((result) =>
    result.trials
      .map((trial) => (trial.judge?.ok ? trial.judge.assessment : undefined))
      .filter(
        (assessment): assessment is JudgeAssessment => assessment !== undefined,
      ),
  );
}

function cellJudgeRuns(cell: ReportCell) {
  return cell.results.flatMap((result) =>
    result.trials
      .map((trial) => trial.judge?.harness)
      .filter((run): run is NonNullable<typeof run> => run !== undefined),
  );
}

function candidateDurations(cell: ReportCell): number[] {
  return cell.results.flatMap((result) =>
    result.trials.length
      ? result.trials.map((trial) => trial.harness.durationMs)
      : [result.meanDurationMs],
  );
}

/** Per-trial judge assessments when present; otherwise the per-case rollups. */
function judgeQuality(cell: ReportCell, assessments: JudgeAssessment[]) {
  return {
    judgeScore: assessments.length
      ? mean(assessments.map((assessment) => assessment.overallScore))
      : mean(
          definedNumbers(cell.results.map((result) => result.meanJudgeScore)),
        ),
    judgePass: assessments.length
      ? assessments.filter((assessment) => assessment.verdict === "pass")
          .length / assessments.length
      : mean(
          definedNumbers(cell.results.map((result) => result.judgePassRate)),
        ),
  };
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
    childInvocations: mean(
      definedNumbers(
        cell.results.map((result) => result.meanChildInvocationCount),
      ),
    ),
    humanInterventions: humanInterventions(cell),
    judgeTokens: mean(
      judgeRuns.map((run) => run.inputTokens + run.outputTokens),
    ),
    judgeCost: totalWhenComplete(judgeRuns.map((run) => run.costUsd)),
    assessments,
  };
}

interface CellMetricRow {
  cell: ReportCell;
  metric: ReturnType<typeof cellMetrics>;
}

function outcomesSection(rows: CellMetricRow[]): string[] {
  return [
    "# Orchestration value benchmark",
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
    "| Harness | Mode | Case | Task pass | Protocol pass | Judge score | Wall mean | Candidate tokens mean |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...cells.flatMap((cell) =>
      cell.results.map(
        (result) =>
          `| ${cell.harness} | ${cell.mode} | ${result.caseId} | ${percent(taskPassRate(result))} | ${percent(result.passRate)} | ${result.meanJudgeScore?.toFixed(2) ?? "n/a"} | ${milliseconds(result.meanDurationMs)} | ${result.meanTokens === null ? "unknown" : Math.round(result.meanTokens)} |`,
      ),
    ),
  ];
}

function phaseMean(
  cell: ReportCell,
  select: (result: CaseResult) => number | undefined,
): number | undefined {
  return mean(definedNumbers(cell.results.map(select)));
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

export function renderSuiteReport(cells: ReportCell[]): string {
  const rows: CellMetricRow[] = cells.map((cell) => ({
    cell,
    metric: cellMetrics(cell),
  }));
  return [
    ...outcomesSection(rows),
    ...perTaskSection(cells),
    ...phaseSection(cells),
    ...judgeOverheadSection(rows),
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
    cells: Array<{ harness: string; mode: string; result: string }>;
  };
  const cells: ReportCell[] = [];
  for (const cell of manifest.cells) {
    cells.push({
      harness: cell.harness,
      mode: cell.mode,
      results: JSON.parse(await readFile(cell.result, "utf8")) as CaseResult[],
    });
  }
  const outputPath = values.output
    ? resolve(process.cwd(), values.output)
    : join(dirname(manifestPath), "report.md");
  await writeFile(outputPath, renderSuiteReport(cells));
  console.log(`Report: ${outputPath}`);
}
