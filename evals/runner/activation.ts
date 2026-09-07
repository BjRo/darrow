import { access } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  ActivationClass,
  EvalCase,
  SkillActivationProbe,
  SkillActivationObservation,
  TrialActivationResult,
} from "./types";
import { hasExplicitSkillInvocation, skillInvocationToken } from "./prompt";

const ACTIVATION_CLASSES: ActivationClass[] = [
  "positive",
  "negative",
  "competition",
];

export function activationTargetSkill(evalCase: EvalCase): string {
  return evalCase.owningSkillName ?? basename(evalCase.skillDir);
}

export function activationProbeForCase(
  evalCase: EvalCase,
  harness: string,
): SkillActivationProbe {
  const explicit = [evalCase.prompt, evalCase.follow_up_prompt ?? ""].some(
    hasExplicitSkillInvocation,
  );
  if (!explicit) return { mode: "implicit" };
  return {
    mode: "explicit",
    skill: activationTargetSkill(evalCase),
    invocation: skillInvocationToken(harness, evalCase),
  };
}

export function expectsAdaptiveGoalOwner(evalCase: EvalCase): boolean {
  if (evalCase.activation === "negative") return false;
  return (
    evalCase.adaptive_goal_composition === true ||
    activationTargetSkill(evalCase) === "adaptive-goal"
  );
}

function validateActivationSequence(evalCase: EvalCase): string[] {
  const sequence = evalCase.activation_sequence;
  if (sequence === undefined) return [];
  if (
    !Array.isArray(sequence) ||
    sequence.length === 0 ||
    sequence.some((skill) => typeof skill !== "string" || !skill.trim())
  )
    return [
      `${evalCase.id}: activation_sequence must be a non-empty skill-name list`,
    ];

  const errors: string[] = [];
  const target = activationTargetSkill(evalCase);
  if (evalCase.activation === "negative")
    errors.push(
      `${evalCase.id}: activation_sequence is incompatible with negative activation`,
    );
  else if (sequence[0] !== target)
    errors.push(
      `${evalCase.id}: activation_sequence must start with the owning skill ${target}`,
    );
  if (sequence.length > 1 && evalCase.mount_plugin_skills !== true)
    errors.push(
      `${evalCase.id}: composed activation_sequence requires mount_plugin_skills: true`,
    );
  return errors;
}

function validateActivationExclusions(evalCase: EvalCase): string[] {
  const exclusions = evalCase.activation_excludes;
  if (exclusions === undefined) return [];
  if (
    !Array.isArray(exclusions) ||
    exclusions.length === 0 ||
    exclusions.some((skill) => typeof skill !== "string" || !skill.trim())
  )
    return [
      `${evalCase.id}: activation_excludes must be a non-empty skill-name list`,
    ];
  return [];
}

export function validateActivationCase(evalCase: EvalCase): string[] {
  if (evalCase.activation === undefined) {
    const fields = [
      evalCase.activation_sequence === undefined
        ? undefined
        : "activation_sequence",
      evalCase.activation_excludes === undefined
        ? undefined
        : "activation_excludes",
    ].filter((field): field is string => field !== undefined);
    return fields.map(
      (field) => `${evalCase.id}: ${field} requires activation`,
    );
  }
  const errors: string[] = [];
  if (!ACTIVATION_CLASSES.includes(evalCase.activation)) {
    errors.push(
      `${evalCase.id}: activation must be positive, negative, or competition`,
    );
  }
  if (!evalCase.skillDir) {
    errors.push(`${evalCase.id}: activation requires a colocated owning skill`);
  }
  if (
    evalCase.activation === "competition" &&
    evalCase.mount_plugin_skills !== true
  ) {
    errors.push(
      `${evalCase.id}: competition activation requires mount_plugin_skills: true`,
    );
  }
  errors.push(...validateActivationSequence(evalCase));
  errors.push(...validateActivationExclusions(evalCase));
  return errors;
}

export async function validateMountedActivationTarget(
  evalCase: EvalCase,
): Promise<string[]> {
  if (evalCase.activation === undefined) return [];
  const target = activationTargetSkill(evalCase);
  const mountedDir = (skill: string) =>
    basename(evalCase.skillDir) === skill
      ? evalCase.skillDir
      : evalCase.mount_plugin_skills === true
        ? join(dirname(evalCase.skillDir), skill)
        : "";
  const errors: string[] = [];
  for (const skill of [target, ...(evalCase.activation_excludes ?? [])]) {
    try {
      const skillDir = mountedDir(skill);
      if (!skillDir) throw new Error("not mounted");
      await access(join(skillDir, "SKILL.md"));
    } catch {
      errors.push(
        `${evalCase.id}: activation ${skill === target ? "target" : "exclusion"} ${skill} is absent from the mounted skill set`,
      );
    }
  }
  return errors;
}

interface ActivationExpectations {
  sequence?: string[];
  excludes?: string[];
}

function matchesActivationSequence(
  observedSkills: string[],
  expectedSkills: string[] | undefined,
): boolean {
  return (
    expectedSkills === undefined ||
    expectedSkills.every((skill, index) => observedSkills[index] === skill)
  );
}

function avoidsExcludedSkills(
  observedSkills: string[],
  excludedSkills: string[] | undefined,
): boolean {
  return (
    excludedSkills === undefined ||
    excludedSkills.every((skill) => !observedSkills.includes(skill))
  );
}

function activationVerdict(
  activationClass: ActivationClass,
  complete: boolean,
  primaryPassed: boolean,
  expectationsPassed: boolean,
): boolean | null {
  if (!complete) return null;
  if (activationClass === "negative")
    return !primaryPassed && expectationsPassed;
  return primaryPassed && expectationsPassed;
}

export function gradeActivation(
  activationClass: ActivationClass,
  targetSkill: string,
  observation: SkillActivationObservation | undefined,
  expectations: ActivationExpectations = {},
): TrialActivationResult {
  const observed = observation ?? {
    source: null,
    complete: false,
    primarySkill: null,
    observedSkills: [] as string[],
  };
  const primaryPassed = observed.primarySkill === targetSkill;
  const sequencePassed = matchesActivationSequence(
    observed.observedSkills,
    expectations.sequence,
  );
  const exclusionsPassed = avoidsExcludedSkills(
    observed.observedSkills,
    expectations.excludes,
  );
  const passed = activationVerdict(
    activationClass,
    observed.complete,
    primaryPassed,
    sequencePassed && exclusionsPassed,
  );
  return {
    class: activationClass,
    targetSkill,
    ...(expectations.sequence
      ? { expectedSkills: [...expectations.sequence] }
      : {}),
    ...(expectations.excludes
      ? { excludedSkills: [...expectations.excludes] }
      : {}),
    passed,
    source: observed.source,
    primarySkill: observed.primarySkill,
    observedSkills: observed.observedSkills,
  };
}

export function activationPassRate(
  trials: TrialActivationResult[],
): number | null {
  if (!trials.length || trials.some((trial) => trial.passed === null))
    return null;
  return trials.filter((trial) => trial.passed).length / trials.length;
}

export function activationPassesThreshold(
  passRate: number | null | undefined,
  threshold: number,
): boolean {
  return passRate === undefined || (passRate !== null && passRate >= threshold);
}
