import type { ExecutionRoute } from "./types";

export function amendRouteModel(
  route: ExecutionRoute,
  model: string,
): ExecutionRoute {
  return {
    ...route,
    routeId: `${route.routeId}:model:${encodeURIComponent(model)}`,
    model,
    selectionSource: "scoped_human_amendment",
  };
}
