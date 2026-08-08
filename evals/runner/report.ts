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

function cellMetrics(cell: ReportCell) {
  const candidateDurations = cell.results.flatMap((result) =>
    result.trials.length
      ? result.trials.map((trial) => trial.harness.durationMs)
      : [result.meanDurationMs],
  );
  const candidateTokens = cell.results.map((result) => result.meanTokens);
  const candidateCosts = cell.results.map((result) => result.totalCostUsd);
  const assessments = cell.results.flatMap((result) =>
    result.trials
      .map((trial) => (trial.judge?.ok ? trial.judge.assessment : undefined))
      .filter(
        (assessment): assessment is JudgeAssessment => assessment !== undefined,
      ),
  );
  const fallbackJudgeScores = cell.results
    .map((result) => result.meanJudgeScore)
    .filter((value): value is number => value !== undefined);
  const judgeRuns = cell.results.flatMap((result) =>
    result.trials
      .map((trial) => trial.judge?.harness)
      .filter((run): run is NonNullable<typeof run> => run !== undefined),
  );
  const judgeCosts = judgeRuns.map((run) => run.costUsd);
  return {
    taskPass: mean(cell.results.map(taskPassRate)),
    protocolPass: mean(cell.results.map((result) => result.passRate)),
    judgeScore: assessments.length
      ? mean(assessments.map((assessment) => assessment.overallScore))
      : mean(fallbackJudgeScores),
    judgePass: assessments.length
      ? assessments.filter((assessment) => assessment.verdict === "pass")
          .length / assessments.length
      : mean(
          cell.results
            .map((result) => result.judgePassRate)
            .filter((value): value is number => value !== undefined),
        ),
    wallMean: mean(candidateDurations),
    wallP95: p95(candidateDurations),
    candidateTokens:
      candidateTokens.length && candidateTokens.every((value) => value !== null)
        ? mean(candidateTokens as number[])
        : undefined,
    candidateCost:
      candidateCosts.length && candidateCosts.every((value) => value !== null)
        ? candidateCosts.reduce((total, value) => total + (value ?? 0), 0)
        : undefined,
    childInvocations: mean(
      cell.results
        .map((result) => result.meanChildInvocationCount)
        .filter((value): value is number => value !== undefined),
    ),
    humanInterventions: cell.results.every(
      (result) => result.totalHumanInterruptions !== undefined,
    )
      ? cell.results.reduce(
          (total, result) => total + (result.totalHumanInterruptions ?? 0),
          0,
        )
      : undefined,
    judgeTokens: judgeRuns.length
      ? mean(judgeRuns.map((run) => run.inputTokens + run.outputTokens))
      : undefined,
    judgeCost:
      judgeCosts.length && judgeCosts.every((value) => value !== null)
        ? judgeCosts.reduce((total, value) => total + (value ?? 0), 0)
        : undefined,
    assessments,
  };
}

export function renderSuiteReport(cells: ReportCell[]): string {
  const lines = [
    "# Orchestration value benchmark",
    "",
    "Task pass is the primary outcome and excludes evaluator bookkeeping records. Protocol pass additionally requires the candidate to report child-invocation and human-intervention counts. The condition-blind LLM judge is advisory and scores final-tree correctness, maintainability, test quality, and scope discipline on a 1–5 scale.",
    "",
    "## Outcomes and candidate efficiency",
    "",
    "| Harness | Mode | Task pass | Protocol pass | Judge score | Judge pass | Wall mean / p95 | Candidate tokens mean | Candidate cost | Children mean | Human interventions |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  const metrics = cells.map((cell) => ({ cell, metric: cellMetrics(cell) }));
  for (const { cell, metric } of metrics) {
    lines.push(
      `| ${cell.harness} | ${cell.mode} | ${percent(metric.taskPass)} | ${percent(metric.protocolPass)} | ${metric.judgeScore?.toFixed(2) ?? "n/a"} | ${percent(metric.judgePass)} | ${milliseconds(metric.wallMean)} / ${milliseconds(metric.wallP95)} | ${tokens(metric.candidateTokens)} | ${cost(metric.candidateCost)} | ${metric.childInvocations?.toFixed(1) ?? "n/a"} | ${metric.humanInterventions ?? "n/a"} |`,
    );
  }

  lines.push(
    "",
    "## Per-task outcomes",
    "",
    "The aggregate is intentionally paired with task-level results so one task shape cannot hide another.",
    "",
    "| Harness | Mode | Case | Task pass | Protocol pass | Judge score | Wall mean | Candidate tokens mean |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const cell of cells) {
    for (const result of cell.results) {
      lines.push(
        `| ${cell.harness} | ${cell.mode} | ${result.caseId} | ${percent(taskPassRate(result))} | ${percent(result.passRate)} | ${result.meanJudgeScore?.toFixed(2) ?? "n/a"} | ${milliseconds(result.meanDurationMs)} | ${result.meanTokens === null ? "unknown" : Math.round(result.meanTokens)} |`,
      );
    }
  }

  const phaseCells = cells.filter((cell) =>
    cell.results.some(
      (result) => result.meanClassifierDurationMs !== undefined,
    ),
  );
  if (phaseCells.length) {
    lines.push(
      "",
      "## Preflight and native execution phases",
      "",
      "Preparation is deterministic host work. Classifier metrics cover only the structured preflight turn; execution metrics exclude classifier usage.",
      "",
      "| Harness | Mode | Preparation mean | Classifier mean | Classifier tokens mean | Classifier calls mean | Execution mean | Execution tokens mean |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    );
    for (const cell of phaseCells) {
      lines.push(
        `| ${cell.harness} | ${cell.mode} | ${milliseconds(mean(cell.results.map((result) => result.meanPreparationDurationMs).filter((value): value is number => value !== undefined)))} | ${milliseconds(mean(cell.results.map((result) => result.meanClassifierDurationMs).filter((value): value is number => value !== undefined)))} | ${tokens(mean(cell.results.map((result) => result.meanClassifierTokens).filter((value): value is number => value !== undefined)))} | ${mean(cell.results.map((result) => result.meanClassifierModelCalls).filter((value): value is number => value !== undefined))?.toFixed(1) ?? "n/a"} | ${milliseconds(mean(cell.results.map((result) => result.meanExecutionDurationMs).filter((value): value is number => value !== undefined)))} | ${tokens(mean(cell.results.map((result) => result.meanExecutionTokens).filter((value): value is number => value !== undefined)))} |`,
      );
    }
  }

  lines.push(
    "",
    "## Judge overhead",
    "",
    "Judge work is excluded from candidate wall time, token counts, and cost above.",
    "",
    "| Harness | Mode | Judge tokens mean | Judge cost |",
    "| --- | --- | ---: | ---: |",
  );
  for (const { cell, metric } of metrics) {
    lines.push(
      `| ${cell.harness} | ${cell.mode} | ${tokens(metric.judgeTokens)} | ${cost(metric.judgeCost)} |`,
    );
  }

  const withAssessments = metrics.filter(
    ({ metric }) => metric.assessments.length > 0,
  );
  if (withAssessments.length) {
    lines.push("", "## Qualitative judge observations", "");
    for (const { cell, metric } of withAssessments) {
      const strengths = [
        ...new Set(metric.assessments.flatMap((item) => item.strengths)),
      ].slice(0, 5);
      const weaknesses = [
        ...new Set(metric.assessments.flatMap((item) => item.weaknesses)),
      ].slice(0, 5);
      lines.push(`### ${cell.harness} / ${cell.mode}`, "");
      if (strengths.length)
        lines.push(
          "Strengths:",
          "",
          ...strengths.map((item) => `- ${item}`),
          "",
        );
      if (weaknesses.length)
        lines.push(
          "Weaknesses:",
          "",
          ...weaknesses.map((item) => `- ${item}`),
          "",
        );
    }
  }

  lines.push(
    "## Interpretation limits",
    "",
    "- `unknown` cost is intentional when a harness does not report actual provider cost; token counts remain available when the harness reports them.",
    "- Compare modes primarily within the same harness/model/effort block. Cross-harness differences also include model and CLI effects.",
    "- Setup and dependency installation occur before candidate timing. Judge work is measured separately.",
    "- Protocol-only failures indicate missing evaluation records, not a failed codebase contract; task pass and judge quality remain separately visible.",
    "- Human interventions are explicit stops for human decisions or authority, not ordinary model reasoning.",
    "",
  );
  return lines.join("\n");
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
