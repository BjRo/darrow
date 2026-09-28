import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { legacyRow, object, type ObjectValue } from "./legacy-evidence";

/** Only fields used by Darrow's historical array comparison. */
type ArchivedCase = {
  caseId: string;
  invariant: string;
  evaluationDigest: string;
  passThreshold: number;
  harness: string;
  harnessVersion: string;
  model: string;
  effort: string;
  condition?: string;
  passRate: number;
  meanDurationMs: number;
  meanTokens?: number | null;
  totalCostUsd?: number | null;
  humanReviewMinutes?: number | null;
  meanChildInvocationCount?: number;
  totalHumanInterruptions?: number;
  escapedDefects?: number;
  falsePositiveVerifierFindings?: number;
  trials: { checks: { passed: boolean; metric?: string }[] }[];
};

const identityFields = [
  "invariant",
  "evaluationDigest",
  "harness",
  "harnessVersion",
  "model",
  "effort",
] as const;
const requiredQuantities = new Set([
  "passThreshold",
  "passRate",
  "meanDurationMs",
]);
const nullableQuantities = new Set([
  "meanTokens",
  "totalCostUsd",
  "humanReviewMinutes",
]);
const rates = new Set(["passThreshold", "passRate"]);
const quantities = [
  ...requiredQuantities,
  ...nullableQuantities,
  "meanChildInvocationCount",
  "totalHumanInterruptions",
  "escapedDefects",
  "falsePositiveVerifierFindings",
];

function validateIdentity(result: ObjectValue, path: string) {
  for (const key of ["caseId", ...identityFields]) {
    const value = result[key];
    if (typeof value !== "string" || !value.trim())
      throw new Error(`${path}: ${key} is unknown or invalid`);
  }
}

function validateQuantity(result: ObjectValue, key: string, path: string) {
  const value = result[key];
  const absent =
    value === undefined || (nullableQuantities.has(key) && value === null);
  if (!requiredQuantities.has(key) && absent) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error(`${path}: invalid recorded ${key}`);
  if (rates.has(key) && value > 1)
    throw new Error(`${path}: invalid recorded ${key}`);
}

function validateTrials(value: unknown, path: string) {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`${path}: recorded trial count is unknown or empty`);
  for (const trial of value)
    validateChecks(object(trial, "trial").checks, path);
}

function validateChecks(value: unknown, path: string) {
  if (!Array.isArray(value))
    throw new Error(`${path}: checks must be an array`);
  for (const item of value) {
    const check = object(item, "check");
    if (typeof check.passed !== "boolean")
      throw new Error(`${path}: check outcome is unknown`);
    if (
      check.metric !== undefined &&
      (typeof check.metric !== "string" ||
        !["escaped_defect", "defect_detection", "false_positive"].includes(
          check.metric,
        ))
    )
      throw new Error(`${path}: invalid check metric`);
  }
}

function validatePassRate(
  rate: number,
  trials: { passed: boolean | null }[],
  path: string,
) {
  const passed = trials.filter((trial) => trial.passed === true).length;
  const unknown = trials.filter((trial) => trial.passed === null).length;
  const minimum = passed / trials.length;
  const maximum = (passed + unknown) / trials.length;
  if (rate < minimum || rate > maximum)
    throw new Error(`${path}: recorded passRate contradicts trial outcomes`);
}

function archivalArray(value: unknown, path: string): ArchivedCase[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`${path}: a nonempty historical result array is required`);
  const ids = new Set<string>();
  for (const item of value) {
    const result = object(item, "case result");
    const row = legacyRow(result, { result: path }, {});
    if (row.error) throw new Error(`${path}: ${row.error}`);
    if (row.executionMode !== "executed")
      throw new Error(`${path}: dry or unknown execution is unmeasured`);
    validateIdentity(result, path);
    const id = result.caseId as string;
    if (ids.has(id)) throw new Error(`${path}: duplicate caseId ${id}`);
    ids.add(id);
    for (const key of quantities) validateQuantity(result, key, path);
    validateTrials(result.trials, path);
    validatePassRate(result.passRate as number, row.trials, path);
  }
  return value as ArchivedCase[];
}

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

function instrumentation(result: ArchivedCase) {
  const row = legacyRow(result, { result: "archival comparison" }, {});
  return {
    policy: row.policyAssistance,
    tokenUsageComplete: row.tokenUsageComplete,
    trials: row.trials.map((trial, index) => ({
      policyAssistance: trial.policyAssistance,
      tokenUsageComplete: trial.tokenUsageComplete,
      semantic: trial.semantic ? { route: trial.semantic.route } : null,
      advisory: trial.advisory ? { route: trial.advisory.route } : null,
      effectiveOwnerRoute: trial.effectiveOwnerRoute,
      checks: result.trials[index]!.checks.map((check, checkIndex) => ({
        name: trial.checks![checkIndex]!.name,
        metric: check.metric ?? null,
      })).sort((a, b) => a.name.localeCompare(b.name)),
    })),
  };
}

function comparisonErrors(base: ArchivedCase, cand: ArchivedCase): string[] {
  const errors: string[] = [];
  for (const key of [...identityFields, "passThreshold"] as const)
    if (base[key] !== cand[key])
      errors.push(`${key} differs (${base[key]} vs ${cand[key]})`);
  if (base.trials.length !== cand.trials.length)
    errors.push(
      `trial count differs (${base.trials.length} vs ${cand.trials.length})`,
    );
  if (!isDeepStrictEqual(instrumentation(base), instrumentation(cand)))
    errors.push("recorded grading or instrumentation differs");
  return errors;
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
