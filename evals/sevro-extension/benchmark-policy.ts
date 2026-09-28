import {
  ownerRoute,
  ownerRoutes,
  ownerRouteCasePolicy,
  selectedOwnerRoute,
  type OwnerRoute,
} from "./benchmark-owner";
type RecordValue = Record<string, unknown>;
export type BenchmarkPolicyConfiguration = {
  requireEvaluationRecords?: true;
  effectiveOwnerRoute?: OwnerRoute;
};

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
  return {
    ...(value.requireEvaluationRecords === true
      ? { requireEvaluationRecords: true as const }
      : {}),
    ...(value.effectiveOwnerRoute === undefined
      ? {}
      : { effectiveOwnerRoute: ownerRoute(value.effectiveOwnerRoute) }),
  };
}

export function modeBenchmarkPolicy(mode: RecordValue) {
  if (
    mode.require_evaluation_records !== undefined &&
    typeof mode.require_evaluation_records !== "boolean"
  )
    throw new Error("require_evaluation_records must be a boolean");
  return {
    ...(mode.require_evaluation_records === true
      ? { requireEvaluationRecords: true as const }
      : {}),
    ...(mode.effective_owner_routes === undefined
      ? {}
      : { effectiveOwnerRoutes: ownerRoutes(mode.effective_owner_routes) }),
  };
}

export function requestedBenchmarkPolicy(
  mode: {
    requireEvaluationRecords?: true;
    effectiveOwnerRoutes?: Record<string, OwnerRoute>;
  },
  caseId: string,
): BenchmarkPolicyConfiguration {
  return benchmarkPolicyConfiguration({
    ...(mode.requireEvaluationRecords
      ? { requireEvaluationRecords: true }
      : {}),
    effectiveOwnerRoute: selectedOwnerRoute(mode.effectiveOwnerRoutes, caseId),
  });
}

export function runBenchmarkPolicy(
  required: boolean,
  map: string | undefined,
  caseId: string,
) {
  if (map !== undefined && Buffer.byteLength(map) > 64 * 1024)
    throw new Error("owner route JSON exceeds 64 KiB");
  return requestedBenchmarkPolicy(
    {
      ...(required ? { requireEvaluationRecords: true } : {}),
      ...(map === undefined
        ? {}
        : { effectiveOwnerRoutes: ownerRoutes(JSON.parse(map)) }),
    },
    caseId,
  );
}

export function benchmarkArguments(
  policy: BenchmarkPolicyConfiguration,
  caseId: string,
) {
  return [
    ...(policy.requireEvaluationRecords
      ? ["--require-evaluation-records"]
      : []),
    ...(policy.effectiveOwnerRoute
      ? [
          "--assert-effective-owner-routes",
          JSON.stringify({ [caseId]: policy.effectiveOwnerRoute }),
        ]
      : []),
  ];
}

function recordCasePolicy(
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

export function benchmarkCasePolicy(
  configuration: BenchmarkPolicyConfiguration,
  skillDir: string | null,
) {
  const records = recordCasePolicy(configuration, skillDir);
  const owner = ownerRouteCasePolicy(configuration.effectiveOwnerRoute);
  return {
    checks: [...records.checks, ...owner.checks],
    requiredEvidence: [...records.requiredEvidence, ...owner.requiredEvidence],
    details: { ...records.details, ...owner.details },
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
