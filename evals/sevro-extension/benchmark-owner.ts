type RecordValue = Record<string, unknown>;
export type OwnerRoute = { model: string; effort: string };
type NativeOwners = {
  acceptedSpawnCount: number;
  acceptedSpawns: RecordValue[];
};
const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const effortPattern = /^(low|medium|high|xhigh|max|ultra)$/;
const checkId = "darrow.evals.benchmark.effective-owner-route";

export function ownerRoute(value: unknown): OwnerRoute {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("owner route must be a model/effort object");
  const route = value as RecordValue;
  if (
    Object.keys(route).some((key) => key !== "model" && key !== "effort") ||
    typeof route.model !== "string" ||
    !modelPattern.test(route.model) ||
    typeof route.effort !== "string" ||
    !effortPattern.test(route.effort)
  )
    throw new Error(
      "owner route requires a bounded model and supported effort",
    );
  return { model: route.model, effort: route.effort };
}

export function ownerRoutes(value: unknown): Record<string, OwnerRoute> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Buffer.byteLength(JSON.stringify(value)) > 64 * 1024
  )
    throw new Error("effective owner routes must be a bounded case-ID map");
  return Object.fromEntries(
    Object.entries(value).map(([id, route]) => {
      if (!id.trim() || id.length > 128 || /[\r\n\0]/.test(id))
        throw new Error("owner route case ID must be a bounded nonempty line");
      return [id, ownerRoute(route)];
    }),
  );
}

export function selectedOwnerRoute(
  routes: Record<string, OwnerRoute> | undefined,
  caseId: string,
) {
  return routes && Object.hasOwn(routes, caseId) ? routes[caseId] : undefined;
}

export function ownerRouteCasePolicy(expected: OwnerRoute | undefined) {
  return {
    checks: expected
      ? [{ id: checkId, grader: "darrow.evals.benchmark", configuration: {} }]
      : [],
    requiredEvidence: expected ? ["sevro.codex.native-calls"] : [],
    details: expected
      ? {
          benchmarkOwnerRoute: expected,
          benchmarkOwnerRouteCheck: {
            id: checkId,
            name: "native owner effective route matches expectation",
          },
        }
      : {},
  };
}

function hasNativeRoute(spawn: RecordValue) {
  return (
    typeof spawn.forkTurns === "string" &&
    /^(none|all|[1-9]\d*)$/.test(spawn.forkTurns) &&
    typeof spawn.model === "string" &&
    modelPattern.test(spawn.model) &&
    typeof spawn.reasoningEffort === "string" &&
    effortPattern.test(spawn.reasoningEffort)
  );
}

function ownerRouteStatus(expected: OwnerRoute, native: NativeOwners | null) {
  if (!native) return "unavailable";
  if (native.acceptedSpawnCount !== 1 || native.acceptedSpawns.length !== 1)
    return "failed";
  const spawn = native.acceptedSpawns[0]!;
  if (!hasNativeRoute(spawn)) return "unavailable";
  return spawn.forkTurns === "none" &&
    spawn.model === expected.model &&
    spawn.reasoningEffort === expected.effort
    ? "passed"
    : "failed";
}

export function nativeOwnerRouteChecks(
  value: unknown,
  native: NativeOwners | null,
) {
  if (value === undefined) return [];
  const expected = ownerRoute(value);
  return [
    {
      id: checkId,
      status: ownerRouteStatus(expected, native),
      detail: `Expected one accepted owner at ${expected.model}/${expected.effort} with forkTurns none; contract selection remains unverified`,
      evidenceRefs: native ? ["sevro.codex.native-calls"] : [],
    },
  ];
}
