type Harness = "codex" | "claude";
export type CandidateRoute = { model: string | null; effort: string | null };

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
  return {
    ...(mode.model_by_harness === undefined
      ? {}
      : { modelByHarness: modelOverrides(mode.model_by_harness) }),
    ...(mode.effort === undefined
      ? {}
      : { effort: routeValue(mode.effort, "mode effort") }),
  };
}

export function requestedCandidateRoute(
  mode: ReturnType<typeof modeRouteConfig>,
  harness: Harness,
): CandidateRoute {
  return {
    model: mode.modelByHarness?.[harness] ?? null,
    effort: mode.effort ?? null,
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
