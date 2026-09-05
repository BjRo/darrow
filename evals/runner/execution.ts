import type { CaseResult, ExecutionMode } from "./types";

/** Only explicit, consistent provenance establishes behavioral execution. */
export function executionMode(
  result: CaseResult,
  fallback?: ExecutionMode,
): ExecutionMode {
  const declared = result.executionMode ?? fallback;
  const modes = result.trials.map(
    (trial) => trial.executionMode ?? declared ?? "unknown",
  );
  if (declared) modes.push(declared);
  if (fallback) modes.push(fallback);
  const first = modes[0];
  return first && modes.every((mode) => mode === first) ? first : "unknown";
}

export function hasBehavioralEvidence(
  result: CaseResult,
): result is CaseResult & { passRate: number } {
  return (
    executionMode(result) === "executed" && typeof result.passRate === "number"
  );
}

export function manifestExecutionMode(dry: unknown): ExecutionMode {
  return dry === true ? "dry" : dry === false ? "executed" : "unknown";
}

export function executionLabel(results: CaseResult[]): string {
  const modes = [...new Set(results.map((result) => executionMode(result)))];
  if (modes.length !== 1) return "mixed (unmeasured)";
  return modes[0] === "executed" ? "executed" : `${modes[0]} (unmeasured)`;
}
