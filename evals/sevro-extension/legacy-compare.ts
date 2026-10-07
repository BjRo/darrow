import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  archivalArray,
  comparisonErrors,
  type ArchivedCase,
} from "./legacy-comparison";

type CheckMetric = "escaped_defect" | "defect_detection" | "false_positive";
function trialMetric(
  checks: ArchivedCase["trials"][number]["checks"],
  metric: CheckMetric,
): number | undefined {
  const labeled = checks.filter((check) => check.metric === metric);
  if (!labeled.length) return undefined;
  if (metric === "defect_detection")
    return labeled.filter((check) => check.passed).length / labeled.length;
  return labeled.filter((check) => !check.passed).length;
}

function metricMean(
  result: ArchivedCase,
  metric: CheckMetric,
): number | undefined {
  const aggregate =
    metric === "false_positive"
      ? result.falsePositiveVerifierFindings
      : metric === "escaped_defect"
        ? result.escapedDefects
        : undefined;
  if (aggregate !== undefined) return aggregate / result.trials.length;
  const values = result.trials.map((trial) =>
    trialMetric(trial.checks, metric),
  );
  if (values.some((value) => value === undefined)) return undefined;
  return (
    (values as number[]).reduce((sum, value) => sum + value, 0) / values.length
  );
}

type DeltaOptions = { lowerBetter?: boolean; precision?: number };
const signed = (value: number, precision: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(precision)}`;
const deltaPercent = (base: number, delta: number): string =>
  base === 0 ? "" : ` (${signed((delta / base) * 100, 0)}%)`;
const deltaMarker = (delta: number, lowerBetter: boolean): string =>
  delta === 0 ? "=" : delta < 0 === lowerBetter ? "▲" : "▼";
function fmtDelta(
  base: number,
  cand: number,
  unit: string,
  options: DeltaOptions = {},
): string {
  const { lowerBetter = true, precision = unit === "s" ? 1 : 0 } = options;
  const delta = cand - base;
  if (base === 0 && cand === 0) return "±0";
  return `${deltaMarker(delta, lowerBetter)} ${signed(delta, precision)}${unit}${deltaPercent(base, delta)}`;
}

type Metric = DeltaOptions & {
  label: string;
  value: (result: ArchivedCase) => number | null | undefined;
  render: (value: number) => string;
  unit: string;
  unknown?: boolean;
  missing: string;
};
const count = (value: number) => String(Math.round(value));
const decimal = (value: number) => value.toFixed(1);
const percent = (value: number) => `${value.toFixed(0)}%`;
const scalePercent = (value: number | undefined) =>
  value === undefined ? undefined : value * 100;
const metrics: Metric[] = [
  {
    label: "pass    ",
    value: (r) => r.passRate * 100,
    render: percent,
    unit: "pp",
    lowerBetter: false,
    missing: "recorded rate missing",
  },
  {
    label: "wall    ",
    value: (r) => r.meanDurationMs / 1000,
    render: (v) => `${decimal(v)}s`,
    unit: "s",
    missing: "recorded duration missing",
  },
  {
    label: "tokens  ",
    value: (r) => r.meanTokens,
    render: count,
    unit: "",
    unknown: true,
    missing: "total usage missing from one run",
  },
  {
    label: "cost    ",
    value: (r) => r.totalCostUsd,
    render: (v) => `$${v.toFixed(4)}`,
    unit: "",
    precision: 4,
    unknown: true,
    missing: "actual cost missing from one run",
  },
  {
    label: "escaped ",
    value: (r) => metricMean(r, "escaped_defect"),
    render: decimal,
    unit: "",
    missing: "metric missing from one run",
  },
  {
    label: "detect  ",
    value: (r) => scalePercent(metricMean(r, "defect_detection")),
    render: percent,
    unit: "pp",
    lowerBetter: false,
    missing: "metric missing from one run",
  },
  {
    label: "false+  ",
    value: (r) => metricMean(r, "false_positive"),
    render: decimal,
    unit: "",
    missing: "metric missing from one run",
  },
  {
    label: "human   ",
    value: (r) => r.humanReviewMinutes,
    render: (v) => `${decimal(v)}m`,
    unit: "m",
    precision: 1,
    unknown: true,
    missing: "measurement missing from one run",
  },
  {
    label: "child(reported) ",
    value: (r) => r.meanChildInvocationCount,
    render: decimal,
    unit: "",
    missing: "measurement missing from one run",
  },
  {
    label: "interrupts ",
    value: (r) => r.totalHumanInterruptions,
    render: String,
    unit: "",
    missing: "measurement missing from one run",
  },
];

function printMetric(
  metric: Metric,
  base: ArchivedCase,
  cand: ArchivedCase,
): boolean {
  const a = metric.value(base);
  const b = metric.value(cand);
  if (typeof a === "number" && typeof b === "number") {
    console.log(
      `  ${metric.label}${metric.render(a)} → ${metric.render(b)}  ${fmtDelta(a, b, metric.unit, metric)}`,
    );
    return true;
  }
  if (a == null && b == null) {
    if (metric.unknown) console.log(`  ${metric.label}unknown → unknown`);
    return true;
  }
  console.log(`  ${metric.label}incomparable — ${metric.missing}`);
  return false;
}

function printCase(base: ArchivedCase, cand: ArchivedCase): boolean {
  const errors = comparisonErrors(base, cand);
  if (errors.length) {
    console.log(`${base.caseId}: incomparable — ${errors.join("; ")}`);
    return false;
  }
  console.log(`${base.caseId} [${base.invariant}]`);
  console.log(
    `  condition ${base.condition ?? "default"} → ${cand.condition ?? "default"}`,
  );
  let valid = true;
  for (const metric of metrics)
    if (!printMetric(metric, base, cand)) valid = false;
  return valid;
}

function printCases(
  baseline: ArchivedCase[],
  candidate: ArchivedCase[],
): boolean {
  let valid = true;
  for (const base of baseline) {
    const cand = candidate.find((row) => row.caseId === base.caseId);
    if (!cand) {
      console.log(`${base.caseId}: incomparable — missing in candidate`);
      valid = false;
    } else if (!printCase(base, cand)) valid = false;
  }
  for (const cand of candidate) {
    if (!baseline.some((row) => row.caseId === cand.caseId)) {
      console.log(`${cand.caseId}: incomparable — missing in baseline`);
      valid = false;
    }
  }
  return valid;
}

async function compare(args: string[]): Promise<number> {
  const [baselineInput, candidateInput] = args;
  if (!baselineInput || !candidateInput || args.length !== 2) {
    console.error(
      "Usage: bun evals/runner/compare.ts <baseline.json> <candidate.json>",
    );
    return 1;
  }
  const baselinePath = resolve(baselineInput);
  const candidatePath = resolve(candidateInput);
  const baseline = archivalArray(
    JSON.parse(await readFile(baselinePath, "utf8")),
    baselinePath,
  );
  const candidate = archivalArray(
    JSON.parse(await readFile(candidatePath, "utf8")),
    candidatePath,
  );
  console.log(
    "Recorded archival summaries: this comparison does not establish a complete run boundary, current evaluator equivalence, or live behavioral stability.",
  );
  console.log(
    "Missing grading or instrumentation metadata remains unknown; matched recorded facts do not establish evaluator equivalence.",
  );
  console.log(`baseline:  ${baselinePath}`);
  console.log(`candidate: ${candidatePath}\n`);
  return printCases(baseline, candidate) ? 0 : 1;
}

export async function runLegacyCompare(args: string[]): Promise<number> {
  try {
    return await compare(args);
  } catch (error) {
    console.log(
      "incomparable — " +
        (error instanceof Error ? error.message : String(error)),
    );
    return 1;
  }
}
if (import.meta.main)
  process.exitCode = await runLegacyCompare(process.argv.slice(2));
