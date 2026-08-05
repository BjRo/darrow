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
  metric: "escaped_defect" | "defect_detection",
): number | undefined {
  if (!result.trials.length) return undefined;
  const values = result.trials.map((trial) => {
    const checks = trial.checks.filter((check) => check.metric === metric);
    if (!checks.length) return undefined;
    if (metric === "escaped_defect")
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
  for (const key of ["invariant", "harness", "model", "effort"] as const) {
    if (base[key] !== cand[key])
      errors.push(`${key} differs (${base[key]} vs ${cand[key]})`);
  }
  if (base.trials.length !== cand.trials.length)
    errors.push(
      `trial count differs (${base.trials.length} vs ${cand.trials.length})`,
    );
  return errors;
}

const fmtDelta = (
  base: number,
  cand: number,
  unit: string,
  lowerBetter = true,
  precision = unit === "s" ? 1 : 0,
): string => {
  const delta = cand - base;
  if (base === 0 && cand === 0) return "±0";
  const pct =
    base !== 0
      ? ` (${delta > 0 ? "+" : ""}${((delta / base) * 100).toFixed(0)}%)`
      : "";
  const better = lowerBetter ? delta < 0 : delta > 0;
  const marker = delta === 0 ? "=" : better ? "▲" : "▼";
  return `${marker} ${delta > 0 ? "+" : ""}${delta.toFixed(precision)}${unit}${pct}`;
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
      fmtDelta(base.passRate * 100, cand.passRate * 100, "pp", false),
  );
  console.log(
    `  wall    ${(base.meanDurationMs / 1000).toFixed(1)}s → ${(cand.meanDurationMs / 1000).toFixed(1)}s  ` +
      fmtDelta(base.meanDurationMs / 1000, cand.meanDurationMs / 1000, "s"),
  );
  console.log(
    `  tokens  ${Math.round(base.meanTokens)} → ${Math.round(cand.meanTokens)}  ` +
      fmtDelta(base.meanTokens, cand.meanTokens, ""),
  );
  console.log(
    `  cost    $${base.totalCostUsd.toFixed(4)} → $${cand.totalCostUsd.toFixed(4)}  ` +
      fmtDelta(base.totalCostUsd, cand.totalCostUsd, "", true, 4),
  );
  const baseEscaped = metricMean(base, "escaped_defect");
  const candEscaped = metricMean(cand, "escaped_defect");
  const baseDetection = metricMean(base, "defect_detection");
  const candDetection = metricMean(cand, "defect_detection");
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
        fmtDelta(basePct, candPct, "pp", false),
    );
  } else if (baseDetection !== candDetection) {
    invalidComparison = true;
    console.log("  detect  incomparable — metric missing from one run");
  }
}

for (const cand of candidate) {
  if (!baseline.some((base) => base.caseId === cand.caseId)) {
    invalidComparison = true;
    console.log(`${cand.caseId}: missing in baseline`);
  }
}

if (invalidComparison) process.exitCode = 1;
