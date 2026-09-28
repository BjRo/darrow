type RecordValue = Record<string, unknown>;
export type BenchmarkPolicyConfiguration = { requireEvaluationRecords?: true };

const recordChecks = [
  {
    id: "darrow.evals.benchmark.child-invocations",
    name: "reported child invocation count",
    field: "evaluation_child_invocations",
  },
  {
    id: "darrow.evals.benchmark.human-interruptions",
    name: "reported human intervention count",
    field: "evaluation_human_interruptions",
  },
];

export function benchmarkPolicyConfiguration(
  value: RecordValue,
): BenchmarkPolicyConfiguration {
  if (
    value.requireEvaluationRecords !== undefined &&
    value.requireEvaluationRecords !== true
  )
    throw new Error("requireEvaluationRecords configuration must be true");
  return value.requireEvaluationRecords === true
    ? { requireEvaluationRecords: true }
    : {};
}

export function modeBenchmarkPolicy(mode: RecordValue) {
  if (
    mode.require_evaluation_records !== undefined &&
    typeof mode.require_evaluation_records !== "boolean"
  )
    throw new Error("require_evaluation_records must be a boolean");
  return mode.require_evaluation_records === true
    ? { requireEvaluationRecords: true as const }
    : {};
}

export function benchmarkArguments(policy: BenchmarkPolicyConfiguration) {
  return policy.requireEvaluationRecords
    ? ["--require-evaluation-records"]
    : [];
}

export function benchmarkCasePolicy(
  configuration: BenchmarkPolicyConfiguration,
  skillDir: string | null,
) {
  const required =
    configuration.requireEvaluationRecords === true &&
    !skillDir?.endsWith("/adaptive-delivery");
  return {
    checks: required
      ? recordChecks.map(({ id }) => ({
          id,
          grader: "darrow.evals.benchmark",
          configuration: {},
        }))
      : [],
    requiredEvidence: required ? ["sevro.observation.final-message"] : [],
    details: required
      ? {
          benchmarkRecords: true,
          benchmarkCheckNames: recordChecks.map(({ id, name }) => ({
            id,
            name,
          })),
        }
      : {},
  };
}

function completeFinalText(observation: RecordValue | null): string | null {
  const data = observation?.data;
  if (
    observation?.completeness !== "complete" ||
    !["sevro.host.codex", "sevro.host.claude"].includes(
      String(observation.source),
    ) ||
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  )
    return null;
  const text = (data as RecordValue).text;
  return typeof text === "string" ? text : null;
}

export function benchmarkRecordChecks(
  required: unknown,
  observation: RecordValue | null,
) {
  if (required === undefined) return [];
  if (required !== true) throw new Error("benchmark record policy is invalid");
  const text = completeFinalText(observation);
  return recordChecks.map(({ id, field }) => ({
    id,
    status:
      text === null
        ? "unavailable"
        : text.match(new RegExp(`^(?:${field}\\t|${field}: )\\d+$`, "gm"))
              ?.length === 1
          ? "passed"
          : "failed",
    detail:
      text === null
        ? "Complete final response evidence required"
        : `Expected exactly one ${field} record with an integer`,
    evidenceRefs: text === null ? [] : ["sevro.observation.final-message"],
  }));
}
