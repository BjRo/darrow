import { describe, expect, test } from "bun:test";
import {
  activationPassRate,
  activationPassesThreshold,
  forbiddenActivationChecks,
  gradeActivation,
  selectActivationObservation,
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

  test("prefers direct events, then observed reads, then the private probe", () => {
    const probe = {
      source: "skill_activation_probe" as const,
      complete: true,
      primarySkill: "ticket-to-pr",
      observedSkills: ["ticket-to-pr"],
    };
    expect(
      selectActivationObservation(
        {
          source: "harness_event",
          complete: true,
          primarySkill: "ticket-to-pr",
          observedSkills: ["ticket-to-pr"],
        },
        probe,
      ).source,
    ).toBe("harness_event");
    expect(
      selectActivationObservation(
        {
          source: "skill_file_read_probe",
          complete: false,
          primarySkill: null,
          observedSkills: [],
        },
        probe,
      ),
    ).toEqual(probe);
  });

  test("preserves secondary selections observed by a lower-ranked complete channel", () => {
    expect(
      selectActivationObservation(
        {
          source: "harness_event",
          complete: true,
          primarySkill: "ticket-to-pr",
          observedSkills: ["ticket-to-pr"],
        },
        {
          source: "skill_activation_probe",
          complete: true,
          primarySkill: "ticket-to-pr",
          observedSkills: ["ticket-to-pr", "adaptive-goal"],
        },
      ),
    ).toEqual({
      source: "harness_event",
      complete: true,
      primarySkill: "ticket-to-pr",
      observedSkills: ["ticket-to-pr", "adaptive-goal"],
    });
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

  test("fails closed when a forbidden skill is observed or evidence is incomplete", () => {
    const complete = {
      source: "harness_event" as const,
      complete: true,
      primarySkill: "ticket-to-pr",
      observedSkills: ["ticket-to-pr"],
    };
    expect(
      forbiddenActivationChecks(["adaptive-goal"], complete)[0]?.passed,
    ).toBe(true);
    expect(
      forbiddenActivationChecks(["adaptive-goal"], {
        ...complete,
        observedSkills: ["ticket-to-pr", "adaptive-goal"],
      })[0]?.passed,
    ).toBe(false);
    expect(
      forbiddenActivationChecks(["adaptive-goal"], undefined)[0]?.passed,
    ).toBe(false);
  });

  test("rejects malformed forbidden activation declarations", () => {
    expect(
      validateActivationCase(
        evalCase({ forbidden_skill_activations: ["adaptive-goal", ""] }),
      ),
    ).toHaveLength(1);
    expect(
      validateActivationCase(
        evalCase({
          forbidden_skill_activations: ["adaptive-goal", "adaptive-goal"],
        }),
      ),
    ).toHaveLength(1);
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
