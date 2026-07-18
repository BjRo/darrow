import { routeForProfile, resolveProfileReference } from "./compiler";
import { DarrowError } from "./errors";
import { canonicalJson, sha256 } from "./io";
import type {
  HumanRequest,
  HumanResponse,
  ResolvedPlan,
  RouteAmendment,
  RunRecord,
} from "./types";

function routeConfiguration(route: RouteAmendment["replacementRoute"]): object {
  const {
    routeId: _routeId,
    selectionSource: _selectionSource,
    ...configuration
  } = route;
  return configuration;
}

export async function prepareRouteAmendment(input: {
  repoRoot: string;
  plan: ResolvedPlan;
  record: RunRecord;
  request: HumanRequest;
  profileId: string;
  responseId: string;
  actor: HumanResponse["actor"];
  approvedAt: string;
}): Promise<RouteAmendment> {
  if (input.request.reason !== "model_unavailable" || !input.request.stepId)
    throw new DarrowError(
      "route amendments are only valid for an unavailable command route",
      "usage",
    );
  const step = input.plan.steps.find(
    (candidate) => candidate.id === input.request.stepId,
  );
  const status = input.record.steps.find(
    (candidate) => candidate.stepId === input.request.stepId,
  );
  if (!step || !status)
    throw new DarrowError(
      `cannot amend unknown workflow step ${input.request.stepId}`,
      "state",
    );

  const unavailableRoute =
    input.record.amendments.findLast(
      (amendment) => amendment.stepId === step.id,
    )?.replacementRoute ?? step.route;
  const { profile } = await resolveProfileReference(
    input.repoRoot,
    input.profileId,
  );
  const replacementRoute = routeForProfile(profile, "scoped_human_amendment");
  if (replacementRoute.harness !== unavailableRoute.harness)
    throw new DarrowError(
      `replacement profile ${profile.id} uses ${replacementRoute.harness}, but step ${step.id} was preflighted for ${unavailableRoute.harness}`,
      "preflight",
    );
  if (
    canonicalJson(routeConfiguration(replacementRoute)) ===
    canonicalJson(routeConfiguration(unavailableRoute))
  )
    throw new DarrowError(
      `replacement profile ${profile.id} resolves to the unavailable route`,
      "preflight",
    );

  const base = {
    requestId: input.request.requestId,
    responseId: input.responseId,
    stepId: step.id,
    planRouteId: step.route.routeId,
    attemptScope: {
      fromAttempt: status.attempt + 1,
      throughAttempt: null,
    },
    unavailableRoute,
    replacementProfile: profile,
    replacementRoute,
    actor: input.actor,
    approvedAt: input.approvedAt,
  } satisfies Omit<RouteAmendment, "amendmentId">;
  return {
    amendmentId: sha256(canonicalJson(base)),
    ...base,
  };
}
