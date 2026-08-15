import { access } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type {
  ActivationClass,
  EvalCase,
  SkillActivationObservation,
  TrialActivationResult,
} from "./types";

const ACTIVATION_CLASSES: ActivationClass[] = [
  "positive",
  "negative",
  "competition",
];

export function activationTargetSkill(evalCase: EvalCase): string {
  return evalCase.owningSkillName ?? basename(evalCase.skillDir);
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

/** Prefer the least indirect complete observation with an actual selection. */
function observationRank(
  observation: SkillActivationObservation | undefined,
): number {
  if (!observation?.complete) return 0;
  const sourceRank = {
    harness_event: 3,
    skill_file_read_probe: 2,
    skill_activation_probe: 1,
  }[observation.source];
  return (observation.observedSkills.length ? 10 : 0) + sourceRank;
}

export function selectActivationObservation(
  harness: SkillActivationObservation | undefined,
  probe: SkillActivationObservation,
): SkillActivationObservation {
  const selected =
    harness && observationRank(harness) >= observationRank(probe)
      ? harness
      : probe;
  if (!harness?.complete || !probe.complete) return selected;
  return {
    ...selected,
    observedSkills: [
      ...new Set([...harness.observedSkills, ...probe.observedSkills]),
    ],
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
