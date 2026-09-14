import { access } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
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

export function expectsAdaptiveDeliveryOwner(evalCase: EvalCase): boolean {
  if (evalCase.activation === "negative") return false;
  return (
    evalCase.adaptive_delivery_composition === true ||
    activationTargetSkill(evalCase) === "adaptive-delivery"
  );
}

function hasSupportingSkillMount(evalCase: EvalCase): boolean {
  if (evalCase.mount_plugin_skills === true) return true;
  if (evalCase.skillScope !== "repository") return false;
  return !!(
    evalCase.additional_skills?.length || evalCase.additional_plugins?.length
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
  if (sequence.length > 1 && !hasSupportingSkillMount(evalCase))
    errors.push(
      `${evalCase.id}: composed activation_sequence requires mount_plugin_skills: true`,
    );
  return errors;
}

function validateActivationMembership(
  evalCase: EvalCase,
  field: "activation_excludes" | "activation_includes",
): string[] {
  const skills = evalCase[field];
  if (skills === undefined) return [];
  if (
    !Array.isArray(skills) ||
    skills.length === 0 ||
    skills.some((skill) => typeof skill !== "string" || !skill.trim())
  )
    return [`${evalCase.id}: ${field} must be a non-empty skill-name list`];
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
      evalCase.activation_includes === undefined
        ? undefined
        : "activation_includes",
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
  errors.push(...validateActivationMembership(evalCase, "activation_excludes"));
  errors.push(...validateActivationMembership(evalCase, "activation_includes"));
  return errors;
}

export async function validateMountedActivationTarget(
  evalCase: EvalCase,
): Promise<string[]> {
  if (evalCase.activation === undefined) return [];
  const target = activationTargetSkill(evalCase);
  const errors: string[] = [];
  const requirements = [
    { skill: target, kind: "target" },
    ...(evalCase.activation_excludes ?? []).map((skill) => ({
      skill,
      kind: "exclusion",
    })),
    ...(evalCase.activation_includes ?? []).map((skill) => ({
      skill,
      kind: "inclusion",
    })),
  ];
  for (const { skill, kind } of requirements) {
    const available = await Promise.all(
      mountedActivationDirectories(evalCase, skill).map((directory) =>
        access(join(directory, "SKILL.md")).then(
          () => true,
          () => false,
        ),
      ),
    );
    if (!available.some(Boolean)) {
      errors.push(
        `${evalCase.id}: activation ${kind} ${skill} is absent from the mounted skill set`,
      );
    }
  }
  return errors;
}

function mountedActivationDirectories(
  evalCase: EvalCase,
  skill: string,
): string[] {
  const root = resolve(import.meta.dir, "../..");
  const primary =
    basename(evalCase.skillDir) === skill
      ? [evalCase.skillDir]
      : evalCase.mount_plugin_skills === true
        ? [join(dirname(evalCase.skillDir), skill)]
        : [];
  return [
    ...primary,
    ...(evalCase.additional_skills ?? [])
      .filter((directory) => basename(directory) === skill)
      .map((directory) => resolve(root, directory)),
    ...(evalCase.additional_plugins ?? []).map((plugin) =>
      resolve(root, plugin, "skills", skill),
    ),
  ];
}

interface ActivationExpectations {
  sequence?: string[];
  includes?: string[];
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
  const inclusionsPassed =
    expectations.includes?.every((skill) =>
      observed.observedSkills.includes(skill),
    ) ?? true;
  const passed = activationVerdict(
    activationClass,
    observed.complete,
    primaryPassed,
    sequencePassed && exclusionsPassed && inclusionsPassed,
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
    ...(expectations.includes
      ? { requiredSkills: [...expectations.includes] }
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
