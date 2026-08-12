import { readFile } from "node:fs/promises";
import type { CaseResult } from "./types";

const [baselinePath, candidatePath] = process.argv.slice(2);
if (!baselinePath || !candidatePath) {
  console.error(
    "Usage: bun evals/runner/compare.ts <baseline.json> <candidate.json>",
  );
  process.exit(1);
}

const baseline: CaseResult[] = JSON.parse(await readFile(baselinePath, "utf8"));
const candidate: CaseResult[] = JSON.parse(
  await readFile(candidatePath, "utf8"),
);

function metricMean(
  result: CaseResult,
  metric: "escaped_defect" | "defect_detection" | "false_positive",
): number | undefined {
  if (!result.trials.length) return undefined;
  if (
    metric === "false_positive" &&
    result.falsePositiveVerifierFindings !== undefined
  ) {
    return result.falsePositiveVerifierFindings / result.trials.length;
  }
  if (metric === "escaped_defect" && result.escapedDefects !== undefined) {
    return result.escapedDefects / result.trials.length;
  }
  const values = result.trials.map((trial) => {
    const checks = trial.checks.filter((check) => check.metric === metric);
    if (!checks.length) return undefined;
    if (metric === "escaped_defect" || metric === "false_positive")
      return checks.filter((check) => !check.passed).length;
    return checks.filter((check) => check.passed).length / checks.length;
  });
  if (values.some((value) => value === undefined)) return undefined;
  return (
    (values as number[]).reduce((sum, value) => sum + value, 0) / values.length
  );
}

function comparisonErrors(base: CaseResult, cand: CaseResult): string[] {
  const errors: string[] = [];
  for (const key of [
    "invariant",
    "evaluationDigest",
    "passThreshold",
    "harness",
    "harnessVersion",
    "model",
    "effort",
  ] as const) {
    if (base[key] !== cand[key])
      errors.push(`${key} differs (${base[key]} vs ${cand[key]})`);
  }
  if (base.trials.length !== cand.trials.length)
    errors.push(
      `trial count differs (${base.trials.length} vs ${cand.trials.length})`,
    );
  return errors;
}

type DeltaOptions = {
  /** Whether a smaller candidate value is the improvement. Defaults to true. */
  lowerBetter?: boolean;
  /** Decimal places for the absolute delta. Defaults to 1 for seconds, else 0. */
  precision?: number;
};

const signed = (value: number, precision: number): string =>
  `${value > 0 ? "+" : ""}${value.toFixed(precision)}`;

const deltaPercent = (base: number, delta: number): string =>
  base === 0 ? "" : ` (${signed((delta / base) * 100, 0)}%)`;

const deltaMarker = (delta: number, lowerBetter: boolean): string => {
  if (delta === 0) return "=";
  return delta < 0 === lowerBetter ? "▲" : "▼";
};

const fmtDelta = (
  base: number,
  cand: number,
  unit: string,
  options: DeltaOptions = {},
): string => {
  const { lowerBetter = true, precision = unit === "s" ? 1 : 0 } = options;
  const delta = cand - base;
  if (base === 0 && cand === 0) return "±0";
  const marker = deltaMarker(delta, lowerBetter);
  return `${marker} ${signed(delta, precision)}${unit}${deltaPercent(base, delta)}`;
};

console.log(`baseline:  ${baselinePath}`);
console.log(`candidate: ${candidatePath}\n`);

let invalidComparison = false;
for (const base of baseline) {
  const cand = candidate.find((c) => c.caseId === base.caseId);
  if (!cand) {
    invalidComparison = true;
    console.log(`${base.caseId}: missing in candidate`);
    continue;
  }
  const errors = comparisonErrors(base, cand);
  if (errors.length) {
    invalidComparison = true;
    console.log(`${base.caseId}: incomparable — ${errors.join("; ")}`);
    continue;
  }
  console.log(`${base.caseId} [${base.invariant}]`);
  console.log(
    `  condition ${base.condition ?? "default"} → ${cand.condition ?? "default"}`,
  );
  console.log(
    `  pass    ${(base.passRate * 100).toFixed(0)}% → ${(cand.passRate * 100).toFixed(0)}%  ` +
      fmtDelta(base.passRate * 100, cand.passRate * 100, "pp", {
        lowerBetter: false,
      }),
  );
  console.log(
    `  wall    ${(base.meanDurationMs / 1000).toFixed(1)}s → ${(cand.meanDurationMs / 1000).toFixed(1)}s  ` +
      fmtDelta(base.meanDurationMs / 1000, cand.meanDurationMs / 1000, "s"),
  );
  if (
    typeof base.meanTokens === "number" &&
    typeof cand.meanTokens === "number"
  ) {
    console.log(
      `  tokens  ${Math.round(base.meanTokens)} → ${Math.round(cand.meanTokens)}  ` +
        fmtDelta(base.meanTokens, cand.meanTokens, ""),
    );
  } else if (base.meanTokens == null && cand.meanTokens == null) {
    console.log("  tokens  unknown → unknown");
  } else {
    invalidComparison = true;
    console.log("  tokens  incomparable — total usage missing from one run");
  }
  if (
    typeof base.totalCostUsd === "number" &&
    typeof cand.totalCostUsd === "number"
  ) {
    console.log(
      `  cost    $${base.totalCostUsd.toFixed(4)} → $${cand.totalCostUsd.toFixed(4)}  ` +
        fmtDelta(base.totalCostUsd, cand.totalCostUsd, "", { precision: 4 }),
    );
  } else if (base.totalCostUsd == null && cand.totalCostUsd == null) {
    console.log("  cost    unknown → unknown");
  } else {
    invalidComparison = true;
    console.log("  cost    incomparable — actual cost missing from one run");
  }
  const baseEscaped = metricMean(base, "escaped_defect");
  const candEscaped = metricMean(cand, "escaped_defect");
  const baseDetection = metricMean(base, "defect_detection");
  const candDetection = metricMean(cand, "defect_detection");
  const baseFalsePositives = metricMean(base, "false_positive");
  const candFalsePositives = metricMean(cand, "false_positive");
  if (baseEscaped !== undefined && candEscaped !== undefined) {
    console.log(
      `  escaped ${baseEscaped.toFixed(1)} → ${candEscaped.toFixed(1)}  ` +
        fmtDelta(baseEscaped, candEscaped, ""),
    );
  } else if (baseEscaped !== candEscaped) {
    invalidComparison = true;
    console.log("  escaped incomparable — metric missing from one run");
  }
  if (baseDetection !== undefined && candDetection !== undefined) {
    const basePct = baseDetection * 100;
    const candPct = candDetection * 100;
    console.log(
      `  detect  ${basePct.toFixed(0)}% → ${candPct.toFixed(0)}%  ` +
        fmtDelta(basePct, candPct, "pp", { lowerBetter: false }),
    );
  } else if (baseDetection !== candDetection) {
    invalidComparison = true;
    console.log("  detect  incomparable — metric missing from one run");
  }
  if (baseFalsePositives !== undefined && candFalsePositives !== undefined) {
    console.log(
      `  false+  ${baseFalsePositives.toFixed(1)} → ${candFalsePositives.toFixed(1)}  ` +
        fmtDelta(baseFalsePositives, candFalsePositives, ""),
    );
  } else if (baseFalsePositives !== candFalsePositives) {
    invalidComparison = true;
    console.log("  false+  incomparable — metric missing from one run");
  }
  if (
    typeof base.humanReviewMinutes === "number" &&
    typeof cand.humanReviewMinutes === "number"
  ) {
    console.log(
      `  human   ${base.humanReviewMinutes.toFixed(1)}m → ${cand.humanReviewMinutes.toFixed(1)}m  ` +
        fmtDelta(base.humanReviewMinutes, cand.humanReviewMinutes, "m", {
          precision: 1,
        }),
    );
  } else if (
    base.humanReviewMinutes == null &&
    cand.humanReviewMinutes == null
  ) {
    console.log("  human   unknown → unknown");
  } else {
    invalidComparison = true;
    console.log("  human   incomparable — measurement missing from one run");
  }
  if (
    base.meanChildInvocationCount !== undefined &&
    cand.meanChildInvocationCount !== undefined
  ) {
    console.log(
      `  child(reported) ${base.meanChildInvocationCount.toFixed(1)} → ${cand.meanChildInvocationCount.toFixed(1)}  ` +
        fmtDelta(
          base.meanChildInvocationCount,
          cand.meanChildInvocationCount,
          "",
        ),
    );
  } else if (base.meanChildInvocationCount !== cand.meanChildInvocationCount) {
    invalidComparison = true;
    console.log("  child   incomparable — measurement missing from one run");
  }
  if (
    base.totalHumanInterruptions !== undefined &&
    cand.totalHumanInterruptions !== undefined
  ) {
    console.log(
      `  interrupts ${base.totalHumanInterruptions} → ${cand.totalHumanInterruptions}  ` +
        fmtDelta(
          base.totalHumanInterruptions,
          cand.totalHumanInterruptions,
          "",
        ),
    );
  } else if (base.totalHumanInterruptions !== cand.totalHumanInterruptions) {
    invalidComparison = true;
    console.log("  interrupts incomparable — measurement missing from one run");
  }
}

for (const cand of candidate) {
  if (!baseline.some((base) => base.caseId === cand.caseId)) {
    invalidComparison = true;
    console.log(`${cand.caseId}: missing in baseline`);
  }
}

if (invalidComparison) process.exitCode = 1;
