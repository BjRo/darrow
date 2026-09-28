import { isDeepStrictEqual } from "node:util";
import { legacyRow, object, type ObjectValue } from "./legacy-evidence";

/** Only fields used by Darrow's historical array comparison. */
export type ArchivedCase = {
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

export function archivalCase(
  value: unknown,
  path: string,
  context: { cell?: ObjectValue; manifest?: ObjectValue } = {},
): ArchivedCase {
  const result = object(value, "case result");
  const row = legacyRow(
    result,
    { result: path, ...context.cell },
    context.manifest ?? {},
  );
  if (row.error) throw new Error(`${path}: ${row.error}`);
  if (row.executionMode !== "executed")
    throw new Error(`${path}: dry or unknown execution is unmeasured`);
  validateIdentity(result, path);
  for (const key of quantities) validateQuantity(result, key, path);
  validateTrials(result.trials, path);
  validatePassRate(result.passRate as number, row.trials, path);
  return result as ArchivedCase;
}

export function archivalArray(value: unknown, path: string): ArchivedCase[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`${path}: a nonempty historical result array is required`);
  const ids = new Set<string>();
  return value.map((item) => {
    const result = archivalCase(item, path);
    if (ids.has(result.caseId))
      throw new Error(`${path}: duplicate caseId ${result.caseId}`);
    ids.add(result.caseId);
    return result;
  });
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

export function comparisonErrors(
  base: ArchivedCase,
  cand: ArchivedCase,
): string[] {
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
