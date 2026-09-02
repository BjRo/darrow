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

export function validateActivationCase(evalCase: EvalCase): string[] {
  if (evalCase.activation === undefined) return [];
  if (!ACTIVATION_CLASSES.includes(evalCase.activation)) {
    return [
      `${evalCase.id}: activation must be positive, negative, or competition`,
    ];
  }
  if (!evalCase.skillDir) {
    return [`${evalCase.id}: activation requires a colocated owning skill`];
  }
  if (
    evalCase.activation === "competition" &&
    evalCase.mount_plugin_skills !== true
  ) {
    return [
      `${evalCase.id}: competition activation requires mount_plugin_skills: true`,
    ];
  }
  return [];
}

export async function validateMountedActivationTarget(
  evalCase: EvalCase,
): Promise<string[]> {
  if (evalCase.activation === undefined) return [];
  const target = activationTargetSkill(evalCase);
  const targetDir =
    basename(evalCase.skillDir) === target
      ? evalCase.skillDir
      : evalCase.mount_plugin_skills === true
        ? join(dirname(evalCase.skillDir), target)
        : "";
  try {
    if (!targetDir) throw new Error("not mounted");
    await access(join(targetDir, "SKILL.md"));
    return [];
  } catch {
    return [
      `${evalCase.id}: activation target ${target} is absent from the mounted skill set`,
    ];
  }
}

export function gradeActivation(
  activationClass: ActivationClass,
  targetSkill: string,
  observation: SkillActivationObservation | undefined,
): TrialActivationResult {
  const observed = observation ?? {
    source: null,
    complete: false,
    primarySkill: null,
    observedSkills: [],
  };
  const passed = !observed.complete
    ? null
    : activationClass === "negative"
      ? observed.primarySkill !== targetSkill
      : observed.primarySkill === targetSkill;
  return {
    class: activationClass,
    targetSkill,
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
