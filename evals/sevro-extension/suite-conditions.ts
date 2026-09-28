import { dirname, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  conditionLabel,
  loadBenchmarkCondition,
  type BenchmarkCondition,
} from "./benchmark-condition";
import type { SkillMountConfiguration } from "./skill-mount";
import {
  benchmarkPolicyConfiguration,
  type BenchmarkPolicyConfiguration,
} from "./benchmark-policy";

type Harness = "codex" | "claude";
export type ConditionInput = { path: string; label: string; sha256: string };
export type SuiteConditions = Record<
  string,
  Partial<Record<Harness, ConditionInput>>
>;

function conditionPath(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.includes("\0"))
    throw new Error("benchmark condition path must be a nonempty string");
  return value;
}

function hostConditions(value: unknown): Partial<Record<Harness, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("condition_by_harness must be an object");
  const entries = Object.entries(value);
  if (
    !entries.length ||
    entries.some(([host]) => host !== "codex" && host !== "claude")
  )
    throw new Error("condition_by_harness needs supported harnesses");
  return Object.fromEntries(
    entries.map(([host, path]) => [host, conditionPath(path)]),
  );
}

export function modeConditionConfig(mode: Record<string, unknown>) {
  return {
    ...(mode.condition !== undefined
      ? { conditionFile: conditionPath(mode.condition) }
      : {}),
    ...(mode.condition_by_harness !== undefined
      ? { conditionByHarness: hostConditions(mode.condition_by_harness) }
      : {}),
  };
}

export async function loadSuiteConditions(
  suitePath: string,
  modes: Array<{
    name: string;
    conditionFile?: string;
    conditionByHarness?: Partial<Record<Harness, string>>;
  }>,
  harnesses: Harness[],
) {
  const conditions: SuiteConditions = {};
  const definitions = new Map<string, BenchmarkCondition>();
  for (const mode of modes) {
    for (const harness of harnesses) {
      const selected = mode.conditionByHarness?.[harness] ?? mode.conditionFile;
      if (selected === undefined) continue;
      const path = resolve(dirname(suitePath), selected);
      let definition = definitions.get(path);
      if (!definition) {
        definition = await loadBenchmarkCondition(path, mode.name);
        definitions.set(path, definition);
      }
      (conditions[mode.name] ??= {})[harness] = {
        path,
        label: conditionLabel(mode.name),
        sha256: definition.sha256,
      };
    }
  }
  return { inputs: conditions, definitions };
}

export function conditionArguments(input: ConditionInput | undefined) {
  return input
    ? [
        "--benchmark-condition-file",
        input.path,
        "--benchmark-condition-label",
        input.label,
        "--benchmark-condition-sha256",
        input.sha256,
      ]
    : [];
}

export function preflightConfiguration(
  input: ConditionInput | undefined,
  definitions: Map<string, BenchmarkCondition>,
) {
  if (!input) return {};
  const definition = definitions.get(input.path);
  if (!definition || definition.sha256 !== input.sha256)
    throw new Error("benchmark condition preflight input is unavailable");
  return { benchmarkCondition: { ...definition, label: input.label } };
}

export function conditionEvidenceMatches(
  value: unknown,
  input: ConditionInput | null,
  withoutSkill: boolean,
  mount: SkillMountConfiguration & BenchmarkPolicyConfiguration = {},
) {
  if (value === undefined) return !requiresRetainedConfiguration(input, mount);
  const expected = {
    ...(withoutSkill ? { withoutSkill: true } : {}),
    ...(mount.skillDir ? { skillDir: mount.skillDir } : {}),
    ...(mount.mountPluginSkills ? { mountPluginSkills: true } : {}),
    ...benchmarkPolicyConfiguration(mount),
    ...(input
      ? { benchmarkCondition: { label: input.label, sha256: input.sha256 } }
      : {}),
  };
  return isDeepStrictEqual(value, expected);
}

function requiresRetainedConfiguration(
  input: ConditionInput | null,
  mount: SkillMountConfiguration & BenchmarkPolicyConfiguration,
) {
  return Boolean(
    input ||
    mount.skillDir ||
    mount.mountPluginSkills ||
    mount.requireEvaluationRecords ||
    mount.effectiveOwnerRoute,
  );
}
