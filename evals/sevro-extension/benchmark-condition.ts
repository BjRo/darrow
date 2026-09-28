import { createHash } from "node:crypto";
import { lstat, readFile, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join } from "node:path";
import { loadSkillOverride, skillMountConfiguration } from "./skill-mount";
import { benchmarkPolicyConfiguration } from "./benchmark-policy";

type RecordValue = Record<string, unknown>;
export type BenchmarkCondition = {
  label: string;
  text: string;
  sha256: string;
};
const textLimit = 64 * 1024;

function object(value: unknown, label: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as RecordValue;
}

function knownFields(value: RecordValue, allowed: string[], label: string) {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length)
    throw new Error(`unsupported ${label}: ${extra.join(", ")}`);
}

export function conditionLabel(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 128 ||
    /[\r\n\0]/.test(value)
  )
    throw new Error(
      "benchmark condition label must be a bounded nonempty line",
    );
  return value;
}

export function benchmarkConditionOptions(options: {
  conditionFile?: string;
  conditionLabel?: string;
  conditionSha256?: string;
}) {
  if (options.conditionFile !== undefined && !isAbsolute(options.conditionFile))
    throw new Error("benchmark condition file must be absolute");
  if (options.conditionLabel !== undefined) {
    if (!options.conditionFile)
      throw new Error("benchmark condition label requires a file");
    conditionLabel(options.conditionLabel);
  }
  if (
    options.conditionSha256 !== undefined &&
    (!options.conditionFile || !/^[a-f0-9]{64}$/.test(options.conditionSha256))
  )
    throw new Error(
      "benchmark condition SHA-256 requires a file and canonical digest",
    );
  return options;
}

function conditionText(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    Buffer.byteLength(value) > textLimit
  )
    throw new Error("benchmark condition text exceeds its UTF-8 size limit");
  return value;
}

export function extensionConfiguration(value: unknown) {
  const selected = object(value ?? {}, "extension configuration");
  knownFields(
    selected,
    [
      "withoutSkill",
      "benchmarkCondition",
      "skillDir",
      "mountPluginSkills",
      "requireEvaluationRecords",
    ],
    "extension configuration",
  );
  if (selected.withoutSkill !== undefined && selected.withoutSkill !== true)
    throw new Error("withoutSkill configuration must be true");
  let benchmarkCondition: BenchmarkCondition | undefined;
  if (selected.benchmarkCondition !== undefined) {
    const condition = object(
      selected.benchmarkCondition,
      "benchmark condition",
    );
    knownFields(condition, ["label", "text", "sha256"], "benchmark condition");
    const label = conditionLabel(condition.label);
    const text = conditionText(condition.text);
    const sha256 = createHash("sha256").update(text).digest("hex");
    if (condition.sha256 !== sha256)
      throw new Error("benchmark condition digest differs from its text");
    benchmarkCondition = { label, text, sha256 };
  }
  return {
    withoutSkill: selected.withoutSkill === true,
    benchmarkCondition,
    ...skillMountConfiguration(selected),
    ...benchmarkPolicyConfiguration(selected),
  };
}

export async function loadBenchmarkCondition(
  path: string,
  label?: string,
): Promise<BenchmarkCondition> {
  if (!isAbsolute(path))
    throw new Error("benchmark condition file must be absolute");
  const info = await lstat(path);
  if (!info.isFile() || info.size > textLimit)
    throw new Error("benchmark condition file must be a bounded regular file");
  const bytes = await readFile(path);
  const text = conditionText(bytes.toString("utf8"));
  if (!Buffer.from(text).equals(bytes))
    throw new Error("benchmark condition file must contain valid UTF-8");
  return {
    label: conditionLabel(label ?? basename(path, extname(path))),
    text,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function candidateRoute(value: unknown) {
  const host = object(value, "candidate route context");
  if (host.id !== "sevro.host.codex" && host.id !== "sevro.host.claude")
    throw new Error("benchmark condition requires a supported candidate route");
  for (const name of ["model", "effort"]) {
    const item = host[name];
    if (
      typeof item !== "string" ||
      !item.trim() ||
      item.length > 256 ||
      /[\r\n\0]/.test(item) ||
      item.includes("{{")
    )
      throw new Error(`benchmark condition candidate ${name} is invalid`);
  }
  return {
    harness: host.id.slice("sevro.host.".length),
    model: host.model as string,
    effort: host.effort as string,
  };
}

export function caseWithCondition(
  value: unknown,
  condition: BenchmarkCondition | undefined,
): unknown {
  if (!condition) return value;
  const selected = object(value, "case");
  if (typeof selected.prompt !== "string")
    throw new Error("case prompt must be text");
  const prefix = condition.text.trim();
  return {
    ...selected,
    prompt: prefix ? `${prefix}\n\n${selected.prompt}` : selected.prompt,
  };
}

export function conditionedCase(
  value: unknown,
  condition: BenchmarkCondition | undefined,
  host: unknown,
): unknown {
  if (!condition) return value;
  const selected = object(caseWithCondition(value, condition), "case");
  const route = candidateRoute(host);
  const render = (text: string) =>
    text.replace(
      /\{\{(harness|model|effort)\}\}/g,
      (_token, name: keyof typeof route) => route[name],
    );
  if (
    selected.follow_up_prompt !== undefined &&
    typeof selected.follow_up_prompt !== "string"
  )
    throw new Error("case follow-up prompt must be text");
  return {
    ...selected,
    prompt: render(selected.prompt as string),
    ...(typeof selected.follow_up_prompt === "string"
      ? { follow_up_prompt: render(selected.follow_up_prompt) }
      : {}),
  };
}

type RunConfigurationOptions = {
  projectRoot: string;
  resultsRoot: string;
  withoutSkill: boolean;
  conditionFile?: string;
  conditionLabel?: string;
  conditionSha256?: string;
  skillDir?: string;
  mountPluginSkills?: true;
  requireEvaluationRecords?: true;
};

async function runBenchmarkCondition(options: RunConfigurationOptions) {
  const benchmarkCondition = options.conditionFile
    ? await loadBenchmarkCondition(
        options.conditionFile,
        options.conditionLabel,
      )
    : undefined;
  if (
    options.conditionSha256 !== undefined &&
    benchmarkCondition?.sha256 !== options.conditionSha256
  )
    throw new Error("benchmark condition input changed since preflight");
  return benchmarkCondition;
}

async function runMountConfiguration(options: RunConfigurationOptions) {
  return {
    ...(options.withoutSkill ? { withoutSkill: true } : {}),
    ...(options.skillDir
      ? {
          skillDir: await loadSkillOverride(
            options.projectRoot,
            options.skillDir,
          ),
        }
      : {}),
    ...(options.mountPluginSkills ? { mountPluginSkills: true } : {}),
    ...benchmarkPolicyConfiguration(options),
  };
}

export async function writeRunConfiguration(options: RunConfigurationOptions) {
  if (
    !options.withoutSkill &&
    !options.conditionFile &&
    !options.skillDir &&
    !options.mountPluginSkills &&
    !options.requireEvaluationRecords
  )
    return;
  const benchmarkCondition = await runBenchmarkCondition(options);
  const control = await runMountConfiguration(options);
  const configuration = {
    ...control,
    ...(benchmarkCondition ? { benchmarkCondition } : {}),
  };
  const redacted = {
    ...control,
    ...(benchmarkCondition
      ? {
          benchmarkCondition: {
            label: benchmarkCondition.label,
            sha256: benchmarkCondition.sha256,
          },
        }
      : {}),
  };
  await Promise.all([
    writeFile(
      join(options.resultsRoot, "darrow-extension-configuration.json"),
      JSON.stringify(configuration),
      { mode: 0o600 },
    ),
    writeFile(
      join(options.resultsRoot, "darrow-extension-redacted-configuration.json"),
      JSON.stringify(redacted),
      { mode: 0o600 },
    ),
  ]);
}
