import { assessmentReadersSelection } from "./assessment-readers";
import { NATIVE_TRANSCRIPT_KINDS } from "./native-transcript-policy";

type Check = Record<string, unknown> & {
  id: string;
  name: string;
  kind: string;
};
const simpleKinds = new Set([
  "continuation-boundary",
  "unchanged-before-continuation",
  "no-agent-spawn",
  "guide-no-owner-or-goal-control",
  "review-no-agent-spawn",
  "doctor-no-agent-spawn",
  "preflight-no-agent-spawn",
  "no-plaintext-feedback-mismatch",
  ...[...NATIVE_TRANSCRIPT_KINDS].filter(
    (kind) => kind !== "route" && kind !== "repair-reuse",
  ),
]);

function text(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    /[\r\n\0]/.test(value)
  )
    throw new Error(`transcript ${label} must be a bounded nonempty string`);
  return value;
}

function fields(check: Record<string, unknown>, allowed: string[]) {
  const extra = Object.keys(check).filter(
    (key) => !["name", "kind", ...allowed].includes(key),
  );
  if (extra.length)
    throw new Error(`unsupported transcript fields: ${extra.join(", ")}`);
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error(`transcript ${label} must be a nonempty list`);
  const items = value.map((item) => text(item, label));
  if (new Set(items).size !== items.length)
    throw new Error(`transcript ${label} must be unique`);
  return items;
}

function routeParameters(check: Record<string, unknown>, kind: string) {
  fields(check, [
    "model",
    "effort",
    ...(kind === "route" ? ["claudeTypes"] : []),
  ]);
  const model = text(check.model, "model");
  const effort = text(check.effort, "effort");
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(model) ||
    !/^(low|medium|high|xhigh|max|ultra)$/.test(effort)
  )
    throw new Error("transcript route requires a model and supported effort");
  return {
    model,
    effort,
    ...(check.claudeTypes === undefined
      ? {}
      : { claudeTypes: strings(check.claudeTypes, "claudeTypes") }),
  };
}

function inactiveParameters(check: Record<string, unknown>, kind: string) {
  fields(check, [
    "forbiddenSkills",
    "forbidSpawn",
    ...(kind === "inactive-controls"
      ? ["forbiddenCommandTerms", "forbidAgentTool"]
      : []),
  ]);
  const selected: Record<string, unknown> = {};
  for (const key of ["forbiddenSkills", "forbiddenCommandTerms"]) {
    if (check[key] !== undefined) selected[key] = strings(check[key], key);
  }
  for (const key of ["forbidSpawn", "forbidAgentTool"]) {
    if (check[key] === undefined) continue;
    if (check[key] !== true) throw new Error(`transcript ${key} must be true`);
    selected[key] = true;
  }
  if (!Object.keys(selected).length)
    throw new Error("inactive transcript check requires a forbidden action");
  return selected;
}

function parameters(check: Record<string, unknown>, kind: string) {
  if (simpleKinds.has(kind)) {
    fields(check, []);
    return {};
  }
  if (kind === "supporting-skill-read") {
    fields(check, ["skill"]);
    return { skill: text(check.skill, "skill") };
  }
  if (kind === "assessment-readers") {
    const names = ["placement", "axes", "model", "effort", "claude"];
    fields(check, names);
    return assessmentReadersSelection(
      Object.fromEntries(
        Object.entries(check).filter(([key]) => names.includes(key)),
      ),
    );
  }
  if (kind === "route" || kind === "repair-reuse")
    return routeParameters(check, kind);
  if (kind === "inactive-controls" || kind === "skills-inactive")
    return inactiveParameters(check, kind);
  throw new Error(`unsupported transcript kind: ${kind}`);
}

export function transcriptPolicy(value: unknown): Check[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.length)
    throw new Error("transcript_checks must be a nonempty list");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("transcript check must be an object");
    const check = entry as Record<string, unknown>;
    const name = text(check.name, "name");
    const kind = text(check.kind, "kind");
    return {
      id: `darrow.evals.transcript.${index + 1}`,
      name,
      kind,
      ...parameters(check, kind),
    };
  });
}
