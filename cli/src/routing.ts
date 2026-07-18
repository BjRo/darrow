import type { ExecutionRoute, ResolvedProfile, RouteAmendment } from "./types";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function validPermissions(value: unknown): boolean {
  const permissions = record(value);
  return (
    permissions !== null &&
    permissions.inherit === true &&
    Object.keys(permissions).length === 1
  );
}

export function validExecutionRoute(value: unknown): value is ExecutionRoute {
  const route = record(value);
  if (!route) return false;
  const limits = record(route.limits);
  const adapter = record(route.adapter);
  const harness = route.harness;
  const provider = route.provider;
  return (
    typeof route.routeId === "string" &&
    route.routeId.length > 0 &&
    typeof route.profileId === "string" &&
    route.profileId.length > 0 &&
    typeof route.profileDigest === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(route.profileDigest) &&
    (harness === "codex" || harness === "claude") &&
    provider === (harness === "codex" ? "openai" : "anthropic") &&
    typeof route.model === "string" &&
    route.model.length > 0 &&
    typeof route.reasoningEffort === "string" &&
    route.reasoningEffort.length > 0 &&
    validPermissions(route.permissions) &&
    limits !== null &&
    Object.values(limits).every(
      (limit) =>
        typeof limit === "number" && Number.isFinite(limit) && limit >= 0,
    ) &&
    adapter !== null &&
    adapter.id === (harness === "codex" ? "codex-cli" : "claude-code") &&
    adapter.version === "0.1.0" &&
    [
      "fixed_plan",
      "scoped_human_amendment",
      "explicit_user_pin",
      "routing_policy",
    ].includes(String(route.selectionSource))
  );
}

function validResolvedProfile(value: unknown): value is ResolvedProfile {
  const profile = record(value);
  if (!profile) return false;
  const harness = profile.harness;
  return (
    profile.schemaVersion === "0.1.0" &&
    typeof profile.id === "string" &&
    /^[a-z][a-z0-9-]*$/.test(profile.id) &&
    (harness === "codex" || harness === "claude") &&
    profile.provider === (harness === "codex" ? "openai" : "anthropic") &&
    typeof profile.model === "string" &&
    profile.model.length > 0 &&
    typeof profile.reasoningEffort === "string" &&
    profile.reasoningEffort.length > 0 &&
    validPermissions(profile.permissions) &&
    typeof profile.source === "string" &&
    profile.source.length > 0 &&
    ["explicit", "project", "user", "bundled"].includes(
      String(profile.scope),
    ) &&
    typeof profile.digest === "string" &&
    /^sha256:[a-f0-9]{64}$/.test(profile.digest)
  );
}

export function validRouteAmendment(value: unknown): value is RouteAmendment {
  const amendment = record(value);
  if (!amendment) return false;
  const attemptScope = record(amendment.attemptScope);
  const actor = record(amendment.actor);
  if (
    typeof amendment.amendmentId !== "string" ||
    !/^sha256:[a-f0-9]{64}$/.test(amendment.amendmentId) ||
    typeof amendment.requestId !== "string" ||
    amendment.requestId.length === 0 ||
    typeof amendment.responseId !== "string" ||
    amendment.responseId.length === 0 ||
    typeof amendment.stepId !== "string" ||
    amendment.stepId.length === 0 ||
    typeof amendment.planRouteId !== "string" ||
    amendment.planRouteId.length === 0 ||
    !attemptScope ||
    !Number.isSafeInteger(attemptScope.fromAttempt) ||
    Number(attemptScope.fromAttempt) < 1 ||
    attemptScope.throughAttempt !== null ||
    !validExecutionRoute(amendment.unavailableRoute) ||
    !validResolvedProfile(amendment.replacementProfile) ||
    !validExecutionRoute(amendment.replacementRoute) ||
    !actor ||
    (actor.id !== null && typeof actor.id !== "string") ||
    (actor.harness !== null && typeof actor.harness !== "string") ||
    actor.verified !== false ||
    typeof amendment.approvedAt !== "string" ||
    Number.isNaN(Date.parse(amendment.approvedAt))
  )
    return false;

  const unavailable = amendment.unavailableRoute;
  const profile = amendment.replacementProfile;
  const replacement = amendment.replacementRoute;
  return (
    replacement.selectionSource === "scoped_human_amendment" &&
    replacement.profileId === profile.id &&
    replacement.profileDigest === profile.digest &&
    replacement.harness === profile.harness &&
    replacement.provider === profile.provider &&
    replacement.model === profile.model &&
    replacement.reasoningEffort === profile.reasoningEffort &&
    replacement.harness === unavailable.harness &&
    replacement.adapter.id === unavailable.adapter.id &&
    replacement.routeId !== unavailable.routeId
  );
}
