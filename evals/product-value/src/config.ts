import { readFile } from "node:fs/promises";
import { isAbsolute, normalize, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  CORE_TREATMENTS,
  HARNESSES,
  type Corpus,
  OPERATIONAL_DIAGNOSTIC_TREATMENTS,
  type OperationalDiagnostic,
  type OperatorStudy,
  type Phase,
  type Protocol,
} from "./types";

export const SUITE_ROOT = resolve(import.meta.dir, "..");
export const REPO_ROOT = resolve(SUITE_ROOT, "..", "..");

export async function loadProtocol(
  path = resolve(SUITE_ROOT, "protocol.yaml"),
): Promise<Protocol> {
  const value = parseYaml(await readFile(path, "utf8")) as Protocol;
  if (value.schemaVersion !== "1.1.0")
    throw new Error(`unsupported protocol schema: ${value.schemaVersion}`);
  if (!value.amendedAt || !Number.isFinite(Date.parse(value.amendedAt)))
    throw new Error("protocol amendment timestamp is invalid");
  if (
    value.treatments.length !== CORE_TREATMENTS.length ||
    CORE_TREATMENTS.some((t) => !value.treatments.includes(t))
  )
    throw new Error("protocol must contain each treatment exactly once");
  for (const harness of HARNESSES) {
    const route = value.harnesses[harness];
    if (!route?.executable || !route.version || !route.model)
      throw new Error(`protocol route is incomplete: ${harness}`);
  }
  for (const phase of ["smoke", "pilot", "confirmatory"] as Phase[]) {
    const settings = value.phases?.[phase];
    if (
      !settings ||
      !Number.isSafeInteger(settings.repeats) ||
      settings.repeats < 1 ||
      !Number.isFinite(settings.timeoutMinutes) ||
      settings.timeoutMinutes <= 0 ||
      !settings.effort ||
      !Number.isFinite(value.budgets?.[phase]?.costUsd) ||
      value.budgets[phase].costUsd <= 0 ||
      !Number.isSafeInteger(value.budgets[phase].tokens) ||
      value.budgets[phase].tokens <= 0
    )
      throw new Error(`protocol phase is incomplete: ${phase}`);
  }
  if (!value.phases.smoke.taskId)
    throw new Error("protocol smoke phase requires one taskId");
  if (
    value.phases.smoke.repeats !== 1 ||
    value.phases.smoke.timeoutMinutes !== 15 ||
    value.phases.smoke.effort !== "medium" ||
    value.phases.pilot.repeats !== 1
  )
    throw new Error("protocol bounded smoke and pilot calibration changed");
  return value;
}

export async function loadCorpus(
  path = resolve(SUITE_ROOT, "corpus.yaml"),
): Promise<Corpus> {
  const value = parseYaml(await readFile(path, "utf8"), {
    merge: true,
  }) as Corpus;
  if (value.schemaVersion !== "1.0.0")
    throw new Error(`unsupported corpus schema: ${value.schemaVersion}`);
  const repos = new Set(value.repositories.map((r) => r.id));
  const ids = new Set<string>();
  for (const task of value.tasks) {
    if (ids.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (!repos.has(task.repository))
      throw new Error(`task ${task.id} names unknown repository`);
    if (!task.prompt.trim() || !task.verificationCommand.trim())
      throw new Error(`task ${task.id} is incomplete`);
    if (task.verificationCwd !== undefined) {
      const normalized = normalize(task.verificationCwd);
      if (
        !task.verificationCwd.trim() ||
        isAbsolute(task.verificationCwd) ||
        normalized === ".." ||
        normalized.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
      )
        throw new Error(`task ${task.id} has invalid verification cwd`);
    }
    if (task.grading !== "deterministic" && task.grading !== "mixed")
      throw new Error(`task ${task.id} has invalid grading mode`);
    if (!task.rubric.length) throw new Error(`task ${task.id} has no rubric`);
  }
  return value;
}

export async function loadOperationalDiagnostic(
  path = resolve(SUITE_ROOT, "operational-diagnostic.yaml"),
): Promise<OperationalDiagnostic> {
  const value = parseYaml(
    await readFile(path, "utf8"),
  ) as OperationalDiagnostic;
  if (value.schemaVersion !== "1.0.0")
    throw new Error(
      `unsupported operational diagnostic schema: ${value.schemaVersion}`,
    );
  if (!value.id?.trim())
    throw new Error("operational diagnostic requires an id");
  if (value.phase !== "pilot")
    throw new Error("operational diagnostic is restricted to pilot tasks");
  if (!Number.isSafeInteger(value.repeats) || value.repeats !== 1)
    throw new Error("operational diagnostic requires exactly one repeat");
  if (
    value.treatments.length !== OPERATIONAL_DIAGNOSTIC_TREATMENTS.length ||
    OPERATIONAL_DIAGNOSTIC_TREATMENTS.some(
      (treatment) => !value.treatments.includes(treatment),
    )
  )
    throw new Error(
      "operational diagnostic must contain both playbook treatments exactly once",
    );
  if (
    value.taskIds.length !== 3 ||
    new Set(value.taskIds).size !== value.taskIds.length
  )
    throw new Error("operational diagnostic requires three distinct tasks");
  return value;
}

export async function loadOperatorStudy(
  path = resolve(SUITE_ROOT, "operator-study.yaml"),
): Promise<OperatorStudy> {
  const value = parseYaml(await readFile(path, "utf8")) as OperatorStudy;
  if (value.schemaVersion !== "1.0.0")
    throw new Error(
      `unsupported operator study schema: ${value.schemaVersion}`,
    );
  if (!value.id?.trim() || !value.frozenSeed?.trim())
    throw new Error("operator study requires an id and frozen seed");
  if (
    !value.preregisteredAt ||
    !Number.isFinite(Date.parse(value.preregisteredAt)) ||
    !value.amendedAt ||
    !Number.isFinite(Date.parse(value.amendedAt))
  )
    throw new Error("operator study freeze timestamps are invalid");
  if (value.phase !== "pilot" || value.repeats !== 1)
    throw new Error("operator study is restricted to one pilot repeat");
  if (
    value.harnesses.length !== HARNESSES.length ||
    HARNESSES.some((harness) => !value.harnesses.includes(harness))
  )
    throw new Error("operator study must contain both harnesses exactly once");
  if (
    value.treatments.length !== OPERATIONAL_DIAGNOSTIC_TREATMENTS.length ||
    OPERATIONAL_DIAGNOSTIC_TREATMENTS.some(
      (treatment) => !value.treatments.includes(treatment),
    )
  )
    throw new Error(
      "operator study must contain both playbook treatments exactly once",
    );
  if (
    value.taskIds.length !== 3 ||
    new Set(value.taskIds).size !== value.taskIds.length
  )
    throw new Error("operator study requires three distinct tasks");
  const integerThresholds = [
    value.thresholds?.minCliUnattendedCompletions,
    value.thresholds?.minCliQualityQualifiedUnattendedCompletions,
    value.thresholds?.maxCliInterventions,
    value.thresholds?.maxCliOperationalFailures,
  ];
  const ratioThresholds = [
    value.thresholds?.maxWallTimeRatio,
    value.thresholds?.maxResourceRatio,
  ];
  if (
    integerThresholds.some(
      (threshold) => !Number.isSafeInteger(threshold) || threshold < 0,
    ) ||
    !Number.isFinite(value.thresholds?.maxCliQualityDeficit) ||
    value.thresholds.maxCliQualityDeficit < 0 ||
    ratioThresholds.some(
      (threshold) => !Number.isFinite(threshold) || threshold <= 0,
    )
  )
    throw new Error("operator study thresholds are invalid");
  if (
    !Number.isFinite(value.budget?.costUsd) ||
    value.budget.costUsd <= 0 ||
    !Number.isSafeInteger(value.budget?.tokens) ||
    value.budget.tokens <= 0
  )
    throw new Error("operator study budget is invalid");
  return value;
}

export function parseSourceArgs(values: string[]): Map<string, string> {
  const sources = new Map<string, string>();
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator < 1) throw new Error(`invalid --source: ${value}`);
    sources.set(value.slice(0, separator), resolve(value.slice(separator + 1)));
  }
  return sources;
}
