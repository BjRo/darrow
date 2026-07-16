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

const fmtDelta = (
  base: number,
  cand: number,
  unit: string,
  lowerBetter = true,
): string => {
  const delta = cand - base;
  if (base === 0 && cand === 0) return "±0";
  const pct =
    base !== 0
      ? ` (${delta > 0 ? "+" : ""}${((delta / base) * 100).toFixed(0)}%)`
      : "";
  const better = lowerBetter ? delta < 0 : delta > 0;
  const marker = delta === 0 ? "=" : better ? "▲" : "▼";
  return `${marker} ${delta > 0 ? "+" : ""}${delta.toFixed(unit === "s" ? 1 : 0)}${unit}${pct}`;
};

console.log(`baseline:  ${baselinePath}`);
console.log(`candidate: ${candidatePath}\n`);

for (const base of baseline) {
  const cand = candidate.find((c) => c.caseId === base.caseId);
  if (!cand) {
    console.log(`${base.caseId}: missing in candidate`);
    continue;
  }
  console.log(`${base.caseId} [${base.invariant}]`);
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
      fmtDelta(base.totalCostUsd, cand.totalCostUsd, ""),
  );
}
