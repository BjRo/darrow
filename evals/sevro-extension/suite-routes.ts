type Harness = "codex" | "claude";
export type CandidateRoute = { model: string | null; effort: string | null };
export type CaseRoutes = Partial<
  Record<Harness, Record<string, { model: string; effort: string }>>
>;

function caseRouteMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("case_routes host map must be an object");
  return Object.fromEntries(
    Object.entries(value).map(([id, raw]) => {
      if (!id.trim() || id.length > 128 || /[\r\n\0]/.test(id))
        throw new Error("case route ID must be a bounded nonempty line");
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw new Error("case route must be a model/effort object");
      const route = raw as Record<string, unknown>;
      if (Object.keys(route).some((key) => key !== "model" && key !== "effort"))
        throw new Error("case route must contain only model and effort");
      return [
        id,
        {
          model: routeValue(route.model, "case route model"),
          effort: routeValue(route.effort, "case route effort"),
        },
      ];
    }),
  );
}

export function suiteCaseRoutes(value: unknown): CaseRoutes {
  if (value === undefined) return {};
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Buffer.byteLength(JSON.stringify(value)) > 64 * 1024
  )
    throw new Error("case_routes must be a bounded harness map");
  return Object.fromEntries(
    Object.entries(value).map(([harness, routes]) => {
      if (harness !== "codex" && harness !== "claude")
        throw new Error("case_routes must name codex or claude");
      return [harness, caseRouteMap(routes)];
    }),
  );
}

/** Validate a case's own `candidate_routes` host map. */
export function caseCandidateRoutes(
  value: unknown,
): Partial<Record<Harness, { model: string; effort: string }>> {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("candidate_routes must be a host map");
  return Object.fromEntries(
    Object.entries(value).map(([harness, raw]) => {
      if (harness !== "codex" && harness !== "claude")
        throw new Error("candidate_routes must name codex or claude");
      return [harness, caseRouteMap({ [harness]: raw })[harness]!];
    }),
  );
}

function routeValue(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    /[\r\n\0]/.test(value)
  )
    throw new Error(`invalid ${label}`);
  return value;
}

function modelOverrides(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("model_by_harness must be an object");
  const entries = Object.entries(value);
  if (
    !entries.length ||
    entries.some(([host]) => host !== "codex" && host !== "claude")
  )
    throw new Error("model_by_harness must name codex or claude");
  return Object.fromEntries(
    entries.map(([host, model]) => [host, routeValue(model, `${host} model`)]),
  ) as Partial<Record<Harness, string>>;
}

export function modeRouteConfig(mode: Record<string, unknown>) {
  if (
    mode.apply_case_routes !== undefined &&
    typeof mode.apply_case_routes !== "boolean"
  )
    throw new Error("apply_case_routes must be boolean");
  return {
    ...(mode.apply_case_routes === true ? { applyCaseRoutes: true } : {}),
    ...(mode.model_by_harness === undefined
      ? {}
      : { modelByHarness: modelOverrides(mode.model_by_harness) }),
    ...(mode.effort === undefined
      ? {}
      : { effort: routeValue(mode.effort, "mode effort") }),
  };
}

function selectedCaseRoute(
  enabled: boolean | undefined,
  harness: Harness,
  caseId: string,
  caseRoutes: CaseRoutes,
) {
  if (!enabled) return undefined;
  const routes = caseRoutes[harness];
  if (!routes)
    throw new Error(`mode requests case routes but none exist for ${harness}`);
  return Object.hasOwn(routes, caseId) ? routes[caseId] : undefined;
}

export function requestedCandidateRoute(
  mode: ReturnType<typeof modeRouteConfig>,
  harness: Harness,
  caseId: string,
  caseRoutes: CaseRoutes,
): CandidateRoute {
  const route = selectedCaseRoute(
    mode.applyCaseRoutes,
    harness,
    caseId,
    caseRoutes,
  );
  return {
    model: route?.model ?? mode.modelByHarness?.[harness] ?? null,
    effort: route?.effort ?? mode.effort ?? null,
  };
}

export function optionValue(args: string[], name: string): string | null {
  const matching = args.filter(
    (arg) => arg === name || arg.startsWith(`${name}=`),
  );
  if (matching.length > 1) throw new Error(`duplicate route option: ${name}`);
  const token = matching[0];
  if (!token) return null;
  const value =
    token === name
      ? args[args.indexOf(token) + 1]
      : token.slice(name.length + 1);
  if (!value || value.startsWith("--"))
    throw new Error(`missing route value: ${name}`);
  return value;
}

function replaceOption(args: string[], name: string, value: string | null) {
  if (value === null) return args;
  optionValue(args, name);
  const output: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const token = args[index]!;
    if (token === name) index++;
    else if (!token.startsWith(`${name}=`)) output.push(token);
  }
  return [...output, name, value];
}

export function candidateArguments(args: string[], route: CandidateRoute) {
  return replaceOption(
    replaceOption(args, "--model", route.model),
    "--effort",
    route.effort,
  );
}

export function candidateRouteMatches(
  value: unknown,
  expected: { harness: Harness; requestedRoute: CandidateRoute },
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = value as Record<string, unknown>;
  const route = expected.requestedRoute;
  return (
    actual.host === `sevro.host.${expected.harness}` &&
    (route.model === null || actual.model === route.model) &&
    (route.effort === null || actual.effort === route.effort)
  );
}
