import type { CheckResult } from "./types";

export interface FactoryMetrics {
  childInvocationCount: number;
  humanInterruptions: number;
  escapedDefects: number;
  falsePositiveVerifierFindings: number;
}

export function extractFactoryMetrics(
  resultText: string,
  checks: CheckResult[],
): FactoryMetrics | undefined {
  const routeRecords = resultText.match(
    /^route\t(?:planner|executor|verifier|repair)\t/gm,
  );
  const hasFactoryResult = /^format\tdarrow-factory-result-v1$/m.test(
    resultText,
  );
  const declaredChildren = resultText.match(
    /^evaluation_child_invocations\t([0-9]+)$/m,
  );
  const declaredInterruptions = resultText.match(
    /^evaluation_human_interruptions\t([0-9]+)$/m,
  );
  if (!hasFactoryResult && !routeRecords && !declaredChildren) return undefined;
  return {
    childInvocationCount:
      routeRecords?.length ?? Number(declaredChildren?.[1] ?? 0),
    humanInterruptions: declaredInterruptions
      ? Number(declaredInterruptions[1])
      : /^status\tneeds_human$/m.test(resultText)
        ? 1
        : 0,
    escapedDefects: checks.filter(
      (check) => check.metric === "escaped_defect" && !check.passed,
    ).length,
    falsePositiveVerifierFindings: checks.filter(
      (check) => check.metric === "false_positive" && !check.passed,
    ).length,
  };
}
