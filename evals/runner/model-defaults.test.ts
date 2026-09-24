import { describe, expect, test } from "bun:test";
import type { HarnessAdapter } from "./types";
import {
  CODEX_EVAL_ROLE_DEFAULTS,
  defaultEvalRoute,
  resolveEvalRoute,
  type EvalModelRole,
} from "./model-defaults";

const codex = {
  name: "codex",
  defaultModel: "adapter-fallback",
} as HarnessAdapter;
const claude = {
  name: "claude",
  defaultModel: "claude-default",
} as HarnessAdapter;

describe("evaluation role defaults", () => {
  test("resolves independent Codex defaults for every role", () => {
    expect(defaultEvalRoute(codex, "candidate")).toEqual({
      model: "gpt-6-luna",
      effort: "medium",
    });
    expect(defaultEvalRoute(codex, "qualityJudge")).toEqual({
      model: "gpt-5.6-sol",
      effort: "low",
    });
    expect(defaultEvalRoute(codex, "semanticOutputGrader")).toEqual({
      model: "gpt-5.6-luna",
      effort: "low",
    });
    expect(
      new Set(
        Object.values(CODEX_EVAL_ROLE_DEFAULTS).map(({ model }) => model),
      ),
    ).toHaveLength(3);
  });

  test.each<EvalModelRole>([
    "candidate",
    "qualityJudge",
    "semanticOutputGrader",
  ])("preserves explicit model and effort overrides for %s", (role) => {
    expect(
      resolveEvalRoute(codex, role, {
        model: `${role}-override`,
        effort: "xhigh",
      }),
    ).toEqual({ model: `${role}-override`, effort: "xhigh" });
  });

  test("retains adapter model defaults for non-Codex harnesses", () => {
    expect(defaultEvalRoute(claude, "candidate")).toEqual({
      model: "claude-default",
      effort: "medium",
    });
    expect(defaultEvalRoute(claude, "qualityJudge")).toEqual({
      model: "claude-default",
      effort: "low",
    });
  });
});
