import type { HarnessAdapter } from "./types";

export type EvalModelRole =
  "candidate" | "qualityJudge" | "semanticOutputGrader";

export interface EvalRoute {
  model: string;
  effort: string;
}

export const CODEX_EVAL_ROLE_DEFAULTS: Readonly<
  Record<EvalModelRole, EvalRoute>
> = Object.freeze({
  candidate: Object.freeze({ model: "gpt-5.6-terra", effort: "medium" }),
  qualityJudge: Object.freeze({ model: "gpt-5.6-sol", effort: "low" }),
  semanticOutputGrader: Object.freeze({
    model: "gpt-5.6-luna",
    effort: "low",
  }),
});

const ROLE_EFFORT_DEFAULTS: Readonly<Record<EvalModelRole, string>> =
  Object.freeze({
    candidate: "medium",
    qualityJudge: "low",
    semanticOutputGrader: "low",
  });

export function defaultEvalRoute(
  adapter: HarnessAdapter,
  role: EvalModelRole,
): EvalRoute {
  if (adapter.name === "codex") return { ...CODEX_EVAL_ROLE_DEFAULTS[role] };
  return {
    model: adapter.defaultModel,
    effort: ROLE_EFFORT_DEFAULTS[role],
  };
}

export function resolveEvalRoute(
  adapter: HarnessAdapter,
  role: EvalModelRole,
  overrides: Partial<EvalRoute>,
): EvalRoute {
  const defaults = defaultEvalRoute(adapter, role);
  return {
    model: overrides.model ?? defaults.model,
    effort: overrides.effort ?? defaults.effort,
  };
}
