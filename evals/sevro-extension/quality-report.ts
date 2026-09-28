import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import Ajv2020 from "ajv/dist/2020";
import schema from "./schemas/cli-result-v1.schema.json";
import evidenceSchema from "./schemas/run-evidence-v1.schema.json";

const validator = new Ajv2020({ strict: false }).addSchema(schema);
const validate = validator.getSchema(schema.$id)!;
const validateRunEvidence = validator.compile(evidenceSchema);
const recordIds = [
  "darrow.evals.benchmark.child-invocations",
  "darrow.evals.benchmark.human-interruptions",
];
type Assessment = {
  status: "passed" | "failed" | "unavailable" | "not_run" | "not_requested";
  reason: string | null;
};
type Outcomes = {
  execution: { status: string; errorCode?: string };
  grading: { status: string; errorCode?: string };
  task: { verdict: string };
};
type Check = { id: string; grader: string; status: string };
type Trial = Outcomes & { trial: number; checks: Check[] };
type PublicResult = Outcomes & {
  runId: string | null;
  evidencePath: string | null;
  exitCode: number;
  cases: Array<Outcomes & { caseId: string; trials: Trial[] }>;
};
type Policy = { id: string; recommendation: string | null };
type TrialEvidence = {
  caseId: string;
  trial: number;
  executionMode: string;
  taskVerdictPolicy: Policy | null;
};
type Evidence = {
  format: string;
  runId: string;
  result: PublicResult;
  evaluationIdentity: { digest: string };
  routes: Route[];
  condition: { requested: string; actual: string };
  extension: {
    id: string;
    replacements: { taskVerdictPolicy: string | null };
  };
  trials: TrialEvidence[];
};
type Route = { role: string; host: string; model: string; effort: string };
type Cell = {
  caseId: string;
  harness: string;
  mode: string;
  condition: string;
  result: string | null;
  evidencePath: string | null;
  exitCode: number;
  recordChecksRequested: boolean;
  provenance: { evaluationDigest: string; routes: Route[] } | null;
  error?: string;
};

function assessment(
  status: Assessment["status"],
  reason: string | null = null,
): Assessment {
  return { status, reason };
}

function recordCheck(check: Check) {
  return (
    recordIds.includes(check.id) && check.grader === "darrow.evals.benchmark"
  );
}

function measuredChecks(checks: Check[]) {
  if (checks.some(({ status }) => status === "unavailable"))
    return assessment("unavailable", "Required check evidence is unavailable");
  return assessment(
    checks.some(({ status }) => status === "failed") ? "failed" : "passed",
  );
}

function trialReadiness(
  trial: Trial,
  evidence: TrialEvidence,
): Assessment | null {
  if (evidence.executionMode === "dry")
    return assessment("not_run", "Dry execution");
  if (evidence.executionMode !== "executed")
    return assessment("unavailable", "Execution mode is unknown");
  if (
    trial.execution.status !== "completed" ||
    trial.grading.status !== "completed"
  )
    return assessment("unavailable", "Execution or grading did not complete");
  return null;
}

function qualityAssessment(trial: Trial, evidence: TrialEvidence) {
  const readiness = trialReadiness(trial, evidence);
  if (readiness) return readiness;
  const checks = trial.checks.filter((check) => !recordCheck(check));
  if (!checks.length)
    return assessment("not_requested", "No quality checks declared");
  if (evidence.taskVerdictPolicy !== null)
    return assessment(
      "unavailable",
      "Custom task policy has no default quality metric",
    );
  return measuredChecks(checks);
}

function recordsAssessment(
  trial: Trial,
  evidence: TrialEvidence,
  requested: boolean,
) {
  const checks = trial.checks.filter(recordCheck);
  if (!requested) {
    if (checks.length)
      throw new Error("Bookkeeping declaration differs from retained outcomes");
    return assessment("not_requested", "Bookkeeping checks were not declared");
  }
  const readiness = trialReadiness(trial, evidence);
  if (readiness) return readiness;
  if (
    checks.length !== recordIds.length ||
    recordIds.some((id) => !checks.some((check) => check.id === id))
  )
    throw new Error("Both declared bookkeeping check outcomes are required");
  return measuredChecks(checks);
}

function protocolAssessment(trial: Trial, evidence: TrialEvidence) {
  const readiness = trialReadiness(trial, evidence);
  if (readiness) return readiness;
  if (trial.task.verdict === "not_assessed")
    return assessment("unavailable", "Public task was not assessed");
  return assessment(trial.task.verdict === "passed" ? "passed" : "failed");
}

function summaryStatus(assessments: Assessment[], expected: number) {
  if (assessments.length !== expected || !expected)
    return { status: "unavailable", reason: "Incomplete trial set" };
  if (assessments.every(({ status }) => status === "not_requested"))
    return { status: "not_requested", reason: "Checks were not requested" };
  if (assessments.every(({ status }) => status === "not_run"))
    return { status: "not_run", reason: "Dry execution" };
  if (
    assessments.some(({ status }) => status !== "passed" && status !== "failed")
  )
    return {
      status: "unavailable",
      reason: [
        ...new Set(
          assessments.flatMap(({ reason }) => (reason ? [reason] : [])),
        ),
      ].join("; "),
    };
  return { status: "measured", reason: null };
}

function summarize(assessments: Assessment[], expected: number) {
  const state = summaryStatus(assessments, expected);
  const passed = assessments.filter(({ status }) => status === "passed").length;
  const failed = assessments.filter(({ status }) => status === "failed").length;
  return {
    ...state,
    trials: expected,
    measured: passed + failed,
    passed,
    failed,
    passRate: state.status === "measured" ? passed / expected : null,
  };
}

function policyMatches(evidence: TrialEvidence, selected: string | null) {
  if (!["executed", "dry", "unknown"].includes(evidence.executionMode))
    return false;
  if (selected === null) return evidence.taskVerdictPolicy === null;
  return (
    typeof selected === "string" && evidence.taskVerdictPolicy?.id === selected
  );
}

async function publicInput(cell: Cell) {
  if (cell.error) throw new Error(cell.error);
  if (!cell.result || !isAbsolute(cell.result))
    throw new Error("No public result file");
  const result = JSON.parse(
    await readFile(cell.result, "utf8"),
  ) as PublicResult;
  if (
    !validate(result) ||
    result.exitCode !== cell.exitCode ||
    result.cases.length !== 1 ||
    result.cases[0]?.caseId !== cell.caseId
  )
    throw new Error("Invalid public Sevro result for quality report");
  return result;
}

function evidencePath(result: PublicResult, cell: Cell) {
  if (
    !result.runId ||
    !result.evidencePath ||
    !isAbsolute(result.evidencePath) ||
    result.evidencePath !== cell.evidencePath
  )
    throw new Error("Missing retained Sevro evidence for quality report");
  return result.evidencePath;
}

function validateEvidence(evidence: Evidence, result: PublicResult) {
  if (!validateRunEvidence(evidence))
    throw new Error(
      `Invalid retained Sevro evidence for quality report: ${validator.errorsText(validateRunEvidence.errors, { dataVar: "evidence" })}`,
    );
  if (
    evidence.format !== "sevro.run-evidence.v1" ||
    evidence.runId !== result.runId ||
    !isDeepStrictEqual(evidence.result, result)
  )
    throw new Error(
      "Retained Sevro evidence differs from quality report input",
    );
  if (
    evidence.extension?.id !== "darrow.evals" ||
    !evidence.extension.replacements ||
    !Array.isArray(evidence.trials)
  )
    throw new Error("Darrow report policy evidence is unavailable");
}

function validateMetadata(evidence: Evidence, cell: Cell) {
  if (
    !cell.provenance ||
    evidence.evaluationIdentity?.digest !== cell.provenance.evaluationDigest ||
    !isDeepStrictEqual(evidence.routes, cell.provenance.routes)
  )
    throw new Error("Retained provenance differs from quality report input");
  if (
    evidence.condition?.requested !== cell.condition ||
    !["passive", "enforced", "unknown"].includes(evidence.condition.actual)
  )
    throw new Error("Retained condition differs from quality report input");
}

async function loadInputs(cell: Cell) {
  const result = await publicInput(cell);
  const evidence = JSON.parse(
    await readFile(evidencePath(result, cell), "utf8"),
  ) as Evidence;
  validateEvidence(evidence, result);
  validateMetadata(evidence, cell);
  return { result, evidence };
}

function validateTrialSet(trials: Trial[], evidence: Evidence) {
  if (
    evidence.trials.length !== trials.length ||
    new Set(trials.map(({ trial }) => trial)).size !== trials.length
  )
    throw new Error("Retained trial set differs from quality report input");
  if (
    trials.some(
      ({ checks }) =>
        new Set(checks.map(({ id }) => id)).size !== checks.length,
    )
  )
    throw new Error("Duplicate check outcomes in quality report input");
}

function trialRows(trials: Trial[], evidence: Evidence, cell: Cell) {
  validateTrialSet(trials, evidence);
  return trials.map((trial) => {
    const matches = evidence.trials.filter(
      (row) => row.caseId === cell.caseId && row.trial === trial.trial,
    );
    const retained = matches[0];
    if (
      matches.length !== 1 ||
      !retained ||
      !policyMatches(
        retained,
        evidence.extension.replacements.taskVerdictPolicy,
      )
    )
      throw new Error(
        "Retained trial policy differs from quality report input",
      );
    return {
      trial: trial.trial,
      execution: trial.execution,
      grading: trial.grading,
      task: trial.task,
      executionMode: retained.executionMode,
      taskVerdictPolicy: retained.taskVerdictPolicy,
      quality: qualityAssessment(trial, retained),
      records: recordsAssessment(trial, retained, cell.recordChecksRequested),
      protocol: protocolAssessment(trial, retained),
    };
  });
}

function cellMetadata(cell: Cell) {
  const candidates =
    cell.provenance?.routes.filter(({ role }) => role === "candidate") ?? [];
  return {
    caseId: cell.caseId,
    harness: cell.harness,
    mode: cell.mode,
    condition: cell.condition,
    resultFile: cell.result,
    evidencePath: cell.evidencePath,
    exitCode: cell.exitCode,
    recordChecksRequested: cell.recordChecksRequested,
    evaluationDigest: cell.provenance?.evaluationDigest ?? null,
    candidateRoute: candidates.length === 1 ? candidates[0]! : null,
  };
}

async function reportRow(cell: Cell, expected: number) {
  const metadata = cellMetadata(cell);
  try {
    const { result, evidence } = await loadInputs(cell);
    const selected = result.cases[0]!;
    const trials = trialRows(selected.trials, evidence, cell);
    return {
      ...metadata,
      actualCondition: evidence.condition.actual,
      execution: selected.execution,
      grading: selected.grading,
      task: selected.task,
      quality: summarize(
        trials.map(({ quality }) => quality),
        expected,
      ),
      records: summarize(
        trials.map(({ records }) => records),
        expected,
      ),
      protocolPassRate: summarize(
        trials.map(({ protocol }) => protocol),
        expected,
      ).passRate,
      trials,
      error: null,
    };
  } catch (error) {
    return unavailableRow(metadata, expected, error);
  }
}

function unavailableRow(
  metadata: ReturnType<typeof cellMetadata>,
  expected: number,
  error: unknown,
) {
  const reason = error instanceof Error ? error.message : String(error);
  return {
    ...metadata,
    actualCondition: null,
    execution: null,
    grading: null,
    task: null,
    quality: { ...summarize([], expected), reason },
    records: { ...summarize([], expected), reason },
    protocolPassRate: null,
    trials: [] as ReturnType<typeof trialRows>,
    error: reason,
  };
}

type Row = Awaited<ReturnType<typeof reportRow>>;

function groupRows(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = JSON.stringify([
      row.harness,
      row.mode,
      row.condition,
      row.actualCondition,
      row.candidateRoute,
    ]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const first = group[0]!;
    const trials = group.flatMap(({ trials }) => trials);
    const expected = group.reduce(
      (count, row) => count + row.quality.trials,
      0,
    );
    return {
      harness: first.harness,
      mode: first.mode,
      condition: first.condition,
      actualCondition: first.actualCondition,
      candidateRoute: first.candidateRoute,
      cells: group.length,
      quality: summarize(
        trials.map(({ quality }) => quality),
        expected,
      ),
      records: summarize(
        trials.map(({ records }) => records),
        expected,
      ),
      protocolPassRate: summarize(
        trials.map(({ protocol }) => protocol),
        expected,
      ).passRate,
    };
  });
}

function percent(rate: number | null) {
  return rate === null ? "unknown" : `${(rate * 100).toFixed(1)}%`;
}

function textCell(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]/g, " ");
}

function groupMarkdown(groups: ReturnType<typeof groupRows>) {
  const lines = [
    "## Groups",
    "",
    "Groups keep requested and actual conditions and candidate routes separate. Missing measurements are unknown.",
    "",
    "| Harness | Mode | Condition | Candidate | Trials | Task quality | Bookkeeping | Public task pass |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
  ];
  for (const group of groups) {
    const route = group.candidateRoute;
    const values = [
      group.harness,
      group.mode,
      `${group.condition}/${group.actualCondition ?? "unknown"}`,
      route ? `${route.host}/${route.model}@${route.effort}` : "unknown",
      String(group.quality.trials),
      percent(group.quality.passRate),
      percent(group.records.passRate),
      percent(group.protocolPassRate),
    ];
    lines.push(`| ${values.map(textCell).join(" | ")} |`);
  }
  return lines;
}

function rowMarkdown(row: Row) {
  const values = [
    row.caseId,
    row.harness,
    row.mode,
    `${row.condition}/${row.actualCondition ?? "unknown"}`,
    percent(row.quality.passRate),
    percent(row.records.passRate),
    percent(row.protocolPassRate),
    row.task?.verdict ?? "unavailable",
    row.execution?.status ?? "unavailable",
    row.grading?.status ?? "unavailable",
  ];
  return `| ${values.map(textCell).join(" | ")} |`;
}

function markdown(rows: Row[], groups: ReturnType<typeof groupRows>) {
  const lines = [
    "# Darrow task quality and bookkeeping report",
    "",
    "Task quality excludes the two evaluator bookkeeping checks. Public task pass uses Sevro's actual task verdict and preserves the selected task policy. Existing task and activation gates remain in force; invalid report inputs also fail the suite. Advisory and activation outcomes remain separate.",
    "",
    "| Case | Harness | Mode | Condition | Task quality | Bookkeeping | Public task pass | Task | Execution | Grading |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |",
  ];
  const notes: string[] = [];
  for (const row of rows) {
    lines.push(rowMarkdown(row));
    for (const [label, metric] of [
      ["Task quality", row.quality],
      ["Bookkeeping", row.records],
    ] as const)
      if (metric.reason)
        notes.push(
          "",
          `${textCell(row.caseId)} (${textCell(row.mode)}): ${label} ${metric.status}: ${textCell(metric.reason)}.`,
        );
  }
  return (
    [...lines, "", ...groupMarkdown(groups), "", ...notes].join("\n") + "\n"
  );
}

/** Darrow's quality/check-record policy over public Sevro results and evidence. */
export async function qualityReports(
  resultsRoot: string,
  cells: Cell[],
  trials: number,
) {
  try {
    const rows = await Promise.all(
      cells.map((cell) => reportRow(cell, trials)),
    );
    const report = {
      format: "darrow-sevro-quality-v1",
      policy: {
        id: "darrow.evals.report.quality",
        version: 1,
        excludedCheckIds: recordIds,
        recordGrader: "darrow.evals.benchmark",
      },
      rows,
      groups: groupRows(rows),
    };
    const jsonPath = join(resultsRoot, "quality-report.json");
    const markdownPath = join(resultsRoot, "quality-report.md");
    await Promise.all([
      writeFile(jsonPath, JSON.stringify(report, null, 2) + "\n"),
      writeFile(markdownPath, markdown(rows, report.groups)),
    ]);
    const invalid = rows.filter(({ error }) => error !== null).length;
    return {
      jsonPath,
      markdownPath,
      error: invalid
        ? `${invalid} quality report input(s) unavailable; inspect ${jsonPath}`
        : null,
    };
  } catch (error) {
    return {
      jsonPath: null,
      markdownPath: null,
      error: `Quality report failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
