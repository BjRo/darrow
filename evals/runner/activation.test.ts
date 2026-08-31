import { describe, expect, test } from "bun:test";
import {
  activationPassRate,
  activationPassesThreshold,
  expectsAdaptiveGoalOwner,
  gradeActivation,
  validateActivationCase,
} from "./activation";
import type { EvalCase, TrialActivationResult } from "./types";

function evalCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: "activation-case",
    invariant: "SE-C9",
    skillDir: "/repo/plugins/sample/skills/grilling",
    caseDir: "/repo/plugins/sample/skills/grilling/evals",
    prompt: "Grill this plan.",
    fixture: {},
    checks: [],
    ...overrides,
  };
}

describe("skill activation grading", () => {
  test("expects an owner for adaptive-goal cases except negative activation", () => {
    expect(
      expectsAdaptiveGoalOwner(
        evalCase({ skillDir: "/repo/plugins/goal-loop/skills/adaptive-goal" }),
      ),
    ).toBe(true);
    expect(
      expectsAdaptiveGoalOwner(evalCase({ adaptive_goal_composition: true })),
    ).toBe(true);
    expect(
      expectsAdaptiveGoalOwner(
        evalCase({
          skillDir: "/repo/plugins/goal-loop/skills/adaptive-goal",
          activation: "negative",
        }),
      ),
    ).toBe(false);
    expect(expectsAdaptiveGoalOwner(evalCase())).toBe(false);
  });

  test("grades a positive primary selection and preserves unavailable evidence as unknown", () => {
    expect(
      gradeActivation("positive", "grilling", {
        source: "harness_event",
        complete: true,
        primarySkill: "grilling",
        observedSkills: ["grilling"],
      }),
    ).toEqual({
      class: "positive",
      targetSkill: "grilling",
      passed: true,
      source: "harness_event",
      primarySkill: "grilling",
      observedSkills: ["grilling"],
    });

    expect(gradeActivation("positive", "grilling", undefined)).toEqual({
      class: "positive",
      targetSkill: "grilling",
      passed: null,
      source: null,
      primarySkill: null,
      observedSkills: [],
    });
  });

  test("grades negative avoidance and competition selection against the owning skill", () => {
    const otherPrimary = {
      source: "skill_file_read_probe" as const,
      complete: true,
      primarySkill: "discover-feature",
      observedSkills: ["discover-feature", "grilling"],
    };
    expect(gradeActivation("negative", "grilling", otherPrimary).passed).toBe(
      true,
    );
    expect(
      gradeActivation("competition", "plan-implementation", otherPrimary)
        .passed,
    ).toBe(false);
  });

  test("rejects unknown activation classes and competition without sibling skills", () => {
    expect(
      validateActivationCase(
        evalCase({ activation: "other" as EvalCase["activation"] }),
      ),
    ).toEqual([
      "activation-case: activation must be positive, negative, or competition",
    ]);
    expect(
      validateActivationCase(evalCase({ activation: "competition" })),
    ).toEqual([
      "activation-case: competition activation requires mount_plugin_skills: true",
    ]);
    expect(
      validateActivationCase(
        evalCase({
          activation: "competition",
          mount_plugin_skills: true,
        }),
      ),
    ).toEqual([]);
  });

  test("does not average measured activation trials with an unknown trial", () => {
    const measured: TrialActivationResult = {
      class: "positive",
      targetSkill: "grilling",
      passed: true,
      source: "harness_event",
      primarySkill: "grilling",
      observedSkills: ["grilling"],
    };
    expect(activationPassRate([measured])).toBe(1);
    expect(
      activationPassRate([
        measured,
        {
          ...measured,
          passed: null,
          source: null,
          primarySkill: null,
          observedSkills: [],
        },
      ]),
    ).toBeNull();
  });

  test("gates declared activation independently while leaving undeclared cases alone", () => {
    expect(activationPassesThreshold(undefined, 0.8)).toBe(true);
    expect(activationPassesThreshold(null, 0.8)).toBe(false);
    expect(activationPassesThreshold(0.66, 0.8)).toBe(false);
    expect(activationPassesThreshold(0.8, 0.8)).toBe(true);
  });
});
