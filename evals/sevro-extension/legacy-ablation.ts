import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { writeLegacyMarkdown } from "./legacy-output";
import {
  archivalCase,
  comparisonErrors as archivalComparisonErrors,
  type ArchivedCase,
} from "./legacy-comparison";
import {
  legacyExitCode,
  legacyRow,
  object,
  text,
  type ObjectValue,
} from "./legacy-evidence";

/** Only the archived fields used by Darrow's skill ablation report. */
type ArchivedAblationCase = {
  caseId: string;
  invariant: string;
  evaluationDigest: string;
  passThreshold: number;
  skillDirectory: string | null;
  mountPluginSkills?: boolean;
  executionMode?: "executed" | "dry" | "unknown";
  condition?: string;
  harness: string;
  harnessVersion: string;
  model: string;
  effort: string;
  trials: unknown[];
  passRate: number | null;
  meanDurationMs: number;
  meanTokens: number | null;
  totalCostUsd: number | null;
};

interface ReportCell {
  harness: string;
  mode: string;
  results: ArchivedAblationCase[];
}

export interface AblationMode {
  without_skill?: boolean;
  skill_dir?: string;
  mount_plugin_skills?: boolean;
  condition?: string;
  condition_by_harness?: Record<string, string>;
  effort?: string;
  require_evaluation_records?: boolean;
  apply_expected_goal_routes?: boolean;
  apply_case_routes?: boolean;
  goal_expectations?: string;
}

export interface AblationDefinition {
  name: string;
  baseline: string;
  candidate: string;
}

interface AblationCaseComparison {
  harness: string;
  caseId: string;
  invariant: string;
  baseline: ArchivedAblationCase;
  candidate: ArchivedAblationCase;
  passRateDelta: number;
  durationDeltaMs: number;
  tokenDelta: number | null;
  costDeltaUsd: number | null;
}

interface AblationComparison {
  name: string;
  baseline: string;
  candidate: string;
  cases: AblationCaseComparison[];
  errors: string[];
}

interface AblationAnalysis {
  format: "darrow-skill-ablation-v1";
  threshold: number;
  comparisons: AblationComparison[];
  errors: string[];
  valid: boolean;
}

interface TransitionOptions {
  digits?: number;
  prefix?: string;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function conditionConfiguration(mode: AblationMode): unknown {
  return {
    condition: mode.condition ?? null,
    condition_by_harness: mode.condition_by_harness ?? null,
  };
}

function nonSkillConfiguration(mode: AblationMode): unknown {
  const configuration = { ...mode };
  delete configuration.without_skill;
  delete configuration.skill_dir;
  delete configuration.mount_plugin_skills;
  return {
    ...configuration,
    require_evaluation_records: mode.require_evaluation_records ?? false,
    apply_expected_goal_routes: mode.apply_expected_goal_routes ?? false,
    apply_case_routes: mode.apply_case_routes ?? false,
    goal_expectations: mode.goal_expectations ?? null,
  };
}

export function validateAblationDefinitions(
  modes: Record<string, AblationMode>,
  definitions: AblationDefinition[],
): string[] {
  const errors: string[] = [];
  const names = new Set<string>();
  for (const definition of definitions) {
    if (!definition.name || names.has(definition.name)) {
      errors.push(
        `${definition.name || "<unnamed>"}: ablation name is empty or duplicate`,
      );
      continue;
    }
    names.add(definition.name);
    errors.push(...validateDefinition(modes, definition));
  }
  return errors;
}

function validateDefinition(
  modes: Record<string, AblationMode>,
  definition: AblationDefinition,
): string[] {
  const baseline = modes[definition.baseline];
  const candidate = modes[definition.candidate];
  if (!baseline)
    return [`${definition.name}: unknown baseline mode ${definition.baseline}`];
  if (!candidate)
    return [
      `${definition.name}: unknown candidate mode ${definition.candidate}`,
    ];
  return [
    ...(definition.baseline === definition.candidate
      ? [`${definition.name}: baseline and candidate modes must differ`]
      : []),
    ...(baseline.without_skill !== true
      ? [`${definition.name}: baseline mode must set without_skill: true`]
      : []),
    ...(candidate.without_skill === true
      ? [`${definition.name}: candidate mode must mount the skill`]
      : []),
    ...matchedConfigurationErrors(definition.name, baseline, candidate),
  ];
}

function matchedConfigurationErrors(
  name: string,
  baseline: AblationMode,
  candidate: AblationMode,
): string[] {
  return [
    ...((baseline.effort ?? null) !== (candidate.effort ?? null)
      ? [`${name}: effort differs`]
      : []),
    ...(stable(conditionConfiguration(baseline)) !==
    stable(conditionConfiguration(candidate))
      ? [`${name}: condition configuration differs`]
      : []),
    ...(stable(nonSkillConfiguration(baseline)) !==
    stable(nonSkillConfiguration(candidate))
      ? [`${name}: non-skill mode configuration differs`]
      : []),
  ];
}

function comparisonErrors(
  base: ArchivedAblationCase,
  candidate: ArchivedAblationCase,
): string[] {
  const errors = archivalComparisonErrors(
    base as ArchivedCase,
    candidate as ArchivedCase,
  );
  if ((base.condition ?? null) !== (candidate.condition ?? null))
    errors.push("recorded condition differs");
  return errors;
}

function cellsFor(
  cells: ReportCell[],
  mode: string,
  harness: string,
): ReportCell[] {
  return cells.filter((cell) => cell.mode === mode && cell.harness === harness);
}

function duplicateCaseIds(results: ArchivedAblationCase[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const result of results) {
    if (seen.has(result.caseId)) duplicates.add(result.caseId);
    seen.add(result.caseId);
  }
  return [...duplicates].sort();
}

function uniqueCaseIds(
  baseline: ArchivedAblationCase[],
  candidate: ArchivedAblationCase[],
) {
  return [
    ...new Set([...baseline, ...candidate].map((result) => result.caseId)),
  ].sort();
}

function compareHarnessCells(
  definition: AblationDefinition,
  harness: string,
  baselineCell: ReportCell,
  candidateCell: ReportCell,
): { cases: AblationCaseComparison[]; errors: string[] } {
  const baselineDuplicates = duplicateCaseIds(baselineCell.results);
  const candidateDuplicates = duplicateCaseIds(candidateCell.results);
  const errors = [
    ...baselineDuplicates.map(
      (id) => `${definition.name}/${harness}: duplicate baseline case ${id}`,
    ),
    ...candidateDuplicates.map(
      (id) => `${definition.name}/${harness}: duplicate candidate case ${id}`,
    ),
  ];
  const cases: AblationCaseComparison[] = [];
  const caseIds = uniqueCaseIds(baselineCell.results, candidateCell.results);
  for (const caseId of caseIds) {
    if (
      baselineDuplicates.includes(caseId) ||
      candidateDuplicates.includes(caseId)
    )
      continue;
    const base = baselineCell.results.find(
      (result) => result.caseId === caseId,
    );
    const candidate = candidateCell.results.find(
      (result) => result.caseId === caseId,
    );
    if (!base || !candidate) {
      errors.push(
        `${definition.name}/${harness}/${caseId}: missing from ${base ? "candidate" : "baseline"}`,
      );
      continue;
    }
    const matched = compareMatchedCase({
      definition,
      harness,
      caseId,
      baseline: base,
      candidate,
    });
    if (matched.error) errors.push(matched.error);
    if (matched.comparison) cases.push(matched.comparison);
  }
  return { cases, errors };
}

function compareMatchedCase(input: {
  definition: AblationDefinition;
  harness: string;
  caseId: string;
  baseline: ArchivedAblationCase;
  candidate: ArchivedAblationCase;
}): { comparison?: AblationCaseComparison; error?: string } {
  const { definition, harness, caseId, baseline, candidate } = input;
  const prefix = `${definition.name}/${harness}/${caseId}`;
  if (baseline.executionMode === "dry" && candidate.executionMode === "dry")
    return {};
  if (!hasBehavioralEvidence(baseline) || !hasBehavioralEvidence(candidate))
    return { error: `${prefix}: dry or unknown execution is unmeasured` };
  if (baseline.skillDirectory !== null || baseline.mountPluginSkills === true)
    return { error: `${prefix}: baseline mounted a skill` };
  if (!candidate.skillDirectory)
    return { error: `${prefix}: candidate mounted no skill` };
  const mismatches = comparisonErrors(baseline, candidate);
  return mismatches.length
    ? { error: `${prefix}: ${mismatches.join("; ")}` }
    : { comparison: caseComparison(harness, baseline, candidate) };
}

function caseComparison(
  harness: string,
  baseline: ArchivedAblationCase & { passRate: number },
  candidate: ArchivedAblationCase & { passRate: number },
): AblationCaseComparison {
  return {
    harness,
    caseId: baseline.caseId,
    invariant: baseline.invariant,
    baseline,
    candidate,
    passRateDelta: candidate.passRate - baseline.passRate,
    durationDeltaMs: candidate.meanDurationMs - baseline.meanDurationMs,
    tokenDelta:
      baseline.meanTokens === null || candidate.meanTokens === null
        ? null
        : candidate.meanTokens - baseline.meanTokens,
    costDeltaUsd:
      baseline.totalCostUsd === null || candidate.totalCostUsd === null
        ? null
        : candidate.totalCostUsd - baseline.totalCostUsd,
  };
}

function analyzeDefinition(
  cells: ReportCell[],
  definition: AblationDefinition,
): AblationComparison {
  const errors: string[] = [];
  const cases: AblationCaseComparison[] = [];
  const harnesses = [
    ...new Set(
      cells
        .filter(
          (cell) =>
            cell.mode === definition.baseline ||
            cell.mode === definition.candidate,
        )
        .map((cell) => cell.harness),
    ),
  ].sort();
  if (!harnesses.length)
    errors.push(`${definition.name}: no cells found for either mode`);
  for (const harness of harnesses) {
    const baselineCells = cellsFor(cells, definition.baseline, harness);
    const candidateCells = cellsFor(cells, definition.candidate, harness);
    if (baselineCells.length !== 1 || candidateCells.length !== 1) {
      if (baselineCells.length !== 1)
        errors.push(
          `${definition.name}/${harness}: expected one baseline cell, found ${baselineCells.length}`,
        );
      if (candidateCells.length !== 1)
        errors.push(
          `${definition.name}/${harness}: expected one candidate cell, found ${candidateCells.length}`,
        );
      continue;
    }
    const result = compareHarnessCells(
      definition,
      harness,
      baselineCells[0]!,
      candidateCells[0]!,
    );
    errors.push(...result.errors);
    cases.push(...result.cases);
  }
  return { ...definition, cases, errors };
}

function analyzeAblations(
  cells: ReportCell[],
  definitions: AblationDefinition[],
  threshold: number,
  expectedTrials: number,
): AblationAnalysis {
  const comparisons = definitions.map((definition) =>
    analyzeDefinition(cells, definition),
  );
  for (const comparison of comparisons) {
    for (const row of comparison.cases) {
      if (row.baseline.passThreshold !== threshold) {
        comparison.errors.push(
          `${comparison.name}/${row.harness}/${row.caseId}: result threshold ${row.baseline.passThreshold} differs from manifest threshold ${threshold}`,
        );
      }
      if (row.baseline.trials.length !== expectedTrials) {
        comparison.errors.push(
          `${comparison.name}/${row.harness}/${row.caseId}: result trial count ${row.baseline.trials.length} differs from manifest trial count ${expectedTrials}`,
        );
      }
    }
  }
  const globalErrors = comparisons.flatMap((comparison) => comparison.errors);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1)
    globalErrors.push(`invalid pass threshold ${threshold}`);
  if (!Number.isInteger(expectedTrials) || expectedTrials < 1)
    globalErrors.push(`invalid manifest trial count ${expectedTrials}`);
  return {
    format: "darrow-skill-ablation-v1",
    threshold,
    comparisons,
    errors: globalErrors,
    valid: globalErrors.length === 0,
  };
}

function signed(value: number, digits = 0): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function percentTransition(row: AblationCaseComparison): string {
  return `${(row.baseline.passRate! * 100).toFixed(0)}% → ${(row.candidate.passRate! * 100).toFixed(0)}% (${signed(row.passRateDelta * 100)}pp)`;
}

function durationTransition(row: AblationCaseComparison): string {
  return `${(row.baseline.meanDurationMs / 1000).toFixed(1)}s → ${(row.candidate.meanDurationMs / 1000).toFixed(1)}s (${signed(row.durationDeltaMs / 1000, 1)}s)`;
}

function numberTransition(
  baseline: number | null,
  candidate: number | null,
  delta: number | null,
  options: TransitionOptions = {},
): string {
  const { digits = 0, prefix = "" } = options;
  const formattedBaseline =
    baseline === null ? "unknown" : `${prefix}${baseline.toFixed(digits)}`;
  const formattedCandidate =
    candidate === null ? "unknown" : `${prefix}${candidate.toFixed(digits)}`;
  return delta === null
    ? `${formattedBaseline} → ${formattedCandidate} (delta unknown)`
    : `${formattedBaseline} → ${formattedCandidate} (${signed(delta, digits)})`;
}

function renderAblationReport(analysis: AblationAnalysis): string {
  const threshold = Number.isFinite(analysis.threshold)
    ? `${(analysis.threshold * 100).toFixed(0)}%`
    : "unknown";
  const sections = [
    "# Skill ablation report",
    "",
    `Status: **${analysis.valid ? "valid" : "invalid"}**`,
    "",
    `Pass threshold: ${threshold}. Each row preserves one matched task; coverage and a passing candidate do not by themselves prove skill value.`,
  ];
  for (const comparison of analysis.comparisons) {
    sections.push(
      "",
      `## ${comparison.name}`,
      "",
      `Baseline \`${comparison.baseline}\` → candidate \`${comparison.candidate}\`.`,
      "",
      "| Harness | Case | Invariant | Pass rate | Wall mean | Tokens mean | Cost total |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: |",
      ...comparison.cases.map(
        (row) =>
          `| ${row.harness} | ${row.caseId} | ${row.invariant} | ${percentTransition(row)} | ${durationTransition(row)} | ${numberTransition(row.baseline.meanTokens, row.candidate.meanTokens, row.tokenDelta)} | ${numberTransition(row.baseline.totalCostUsd, row.candidate.totalCostUsd, row.costDeltaUsd, { digits: 4, prefix: "$" })} |`,
      ),
    );
    if (comparison.errors.length) {
      sections.push(
        "",
        "Comparison errors:",
        "",
        ...comparison.errors.map((error) => `- ${error}`),
      );
    }
  }
  sections.push(
    "",
    "## Interpretation limits",
    "",
    "- These are recorded archival deltas; they do not establish current evaluator equivalence or live behavioral stability.",
    "- Unknown token or cost measurements remain unknown and are not treated as zero.",
    "- Promotion claims still require enough fresh trials and review of task-level regressions.",
  );
  return sections.join("\n");
}

type ArchiveInput = { path: string; sha256: string | null };
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function readArchive(path: string, inputs: ArchiveInput[]) {
  let input = inputs.find((input) => input.path === path);
  if (!input) {
    input = { path, sha256: null };
    inputs.push(input);
  }
  const bytes = await readFile(path);
  input.sha256 = createHash("sha256").update(bytes).digest("hex");
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

function definitionsFrom(value: unknown): AblationDefinition[] {
  if (!Array.isArray(value) || !value.length)
    throw new Error("suite declares no ablations");
  return value.map((value) => {
    const item = object(value, "ablation definition");
    const name = text(item.name);
    const baseline = text(item.baseline);
    const candidate = text(item.candidate);
    if (!name?.trim() || !baseline?.trim() || !candidate?.trim())
      throw new Error("ablation name, baseline and candidate are required");
    return { name, baseline, candidate };
  });
}

function validateModeFlags(mode: ObjectValue, name: string) {
  for (const field of [
    "without_skill",
    "mount_plugin_skills",
    "require_evaluation_records",
    "apply_expected_goal_routes",
    "apply_case_routes",
  ])
    if (mode[field] !== undefined && typeof mode[field] !== "boolean")
      throw new Error(`${name}: invalid mode ${field}`);
}

function validateModeText(mode: ObjectValue, name: string) {
  for (const field of ["condition", "effort", "goal_expectations", "skill_dir"])
    if (mode[field] !== undefined && !text(mode[field])?.trim())
      throw new Error(`${name}: invalid mode ${field}`);
  if (mode.condition_by_harness !== undefined)
    for (const condition of Object.values(
      object(mode.condition_by_harness, "condition_by_harness"),
    ))
      if (!text(condition)?.trim())
        throw new Error(`${name}: invalid harness condition`);
}

function modesFrom(value: unknown): Record<string, AblationMode> {
  if (value === undefined)
    throw new Error("suite mode definitions are unknown");
  return Object.fromEntries(
    Object.entries(object(value, "suite modes")).map(([name, value]) => {
      const mode = object(value, "suite mode");
      validateModeFlags(mode, name);
      validateModeText(mode, name);
      return [name, mode as AblationMode];
    }),
  );
}

function mountedCase(
  archived: ArchivedCase,
  raw: ObjectValue,
): ArchivedAblationCase {
  if (raw.skillDirectory !== null && !text(raw.skillDirectory)?.trim())
    throw new Error("recorded skill mount is unknown");
  if (
    raw.mountPluginSkills !== undefined &&
    typeof raw.mountPluginSkills !== "boolean"
  )
    throw new Error("invalid recorded plugin skill mount");
  return {
    ...archived,
    skillDirectory: raw.skillDirectory as string | null,
    mountPluginSkills: raw.mountPluginSkills as boolean | undefined,
    meanTokens: archived.meanTokens ?? null,
    totalCostUsd: archived.totalCostUsd ?? null,
    executionMode: "executed",
  };
}

function archivedRow(
  value: unknown,
  cell: ObjectValue,
  path: string,
  manifest: ObjectValue,
): ArchivedAblationCase {
  const raw = object(value, "case result");
  const row = legacyRow(raw, { ...cell, result: path }, manifest);
  if (row.error) throw new Error(row.error);
  if (row.harness !== cell.harness)
    throw new Error("result harness differs from suite cell");
  if (row.executionMode === "dry" && manifest.dry === true)
    return { ...raw, executionMode: "dry" } as ArchivedAblationCase;
  if (row.completeness !== "complete")
    throw new Error(
      `${String(raw.caseId)}: incomplete or unknown cell boundary`,
    );
  if (raw.passThreshold !== manifest.threshold)
    throw new Error(
      `${String(raw.caseId)}: result threshold ${String(raw.passThreshold)} differs from manifest threshold ${String(manifest.threshold)}`,
    );
  return mountedCase(archivalCase(raw, path, { cell, manifest }), raw);
}

type ArchiveContext = {
  manifestPath: string;
  inputs: ArchiveInput[];
  errors: string[];
};
function cellMetadata(value: unknown, manifestPath: string) {
  const sourceCell = object(value, "suite cell");
  const source = text(sourceCell.result);
  const harness = text(sourceCell.harness);
  const mode = text(sourceCell.mode);
  if (!source || !harness || !mode)
    throw new Error("suite cell result, harness and mode are required");
  return {
    sourceCell,
    path: resolve(dirname(manifestPath), source),
    harness,
    mode,
  };
}

async function readCell(
  value: unknown,
  manifest: ObjectValue,
  context: ArchiveContext,
): Promise<{ cell: ReportCell | null; dry: boolean }> {
  let path = context.manifestPath;
  try {
    const metadata = cellMetadata(value, context.manifestPath);
    path = metadata.path;
    const cell: ReportCell = {
      harness: metadata.harness,
      mode: metadata.mode,
      results: [],
    };
    let dry = manifest.dry === true;
    try {
      const data = await readArchive(path, context.inputs);
      if (!Array.isArray(data) || !data.length)
        throw new Error("a nonempty historical result array is required");
      legacyExitCode(metadata.sourceCell.exitCode);
      for (const value of data) {
        try {
          const row = archivedRow(value, metadata.sourceCell, path, manifest);
          dry &&= row.executionMode === "dry";
          cell.results.push(row);
        } catch (error) {
          dry = false;
          context.errors.push(`${path}: ${message(error)}`);
        }
      }
    } catch (error) {
      dry = false;
      context.errors.push(`${path}: ${message(error)}`);
    }
    return { cell, dry };
  } catch (error) {
    context.errors.push(`${path}: ${message(error)}`);
    return { cell: null, dry: false };
  }
}

function protectDeclaredPaths(manifest: ObjectValue, context: ArchiveContext) {
  if (!Array.isArray(manifest.cells)) return;
  for (const value of manifest.cells) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const source = (value as ObjectValue).result;
    if (typeof source !== "string" || !source.trim()) continue;
    const path = resolve(dirname(context.manifestPath), source);
    if (!context.inputs.some((input) => input.path === path))
      context.inputs.push({ path, sha256: null });
  }
}

function thresholdFrom(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 1
  )
    throw new Error("invalid manifest pass threshold");
  return value;
}
function trialsFrom(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error("invalid manifest trial count");
  return value;
}

function eligibleDefinitions(
  manifest: ObjectValue,
  definitions: AblationDefinition[],
  context: ArchiveContext,
) {
  try {
    const modes = modesFrom(manifest.modeDefinitions);
    context.errors.push(...validateAblationDefinitions(modes, definitions));
    return definitions.filter(
      (definition) =>
        definitions.filter((peer) => peer.name === definition.name).length ===
          1 && validateDefinition(modes, definition).length === 0,
    );
  } catch (error) {
    context.errors.push(`${context.manifestPath}: ${message(error)}`);
    return [];
  }
}

async function readSuite(context: ArchiveContext) {
  const manifest = object(
    await readArchive(context.manifestPath, context.inputs),
    "suite manifest",
  );
  // Protect referenced archives even if other suite metadata is invalid.
  protectDeclaredPaths(manifest, context);
  if (manifest.format !== "darrow-orchestration-suite-v1")
    throw new Error(
      `Unsupported historical format: ${String(manifest.format ?? "missing")}`,
    );
  const threshold = thresholdFrom(manifest.threshold);
  const trials = trialsFrom(manifest.trials);
  const definitions = definitionsFrom(manifest.ablations);
  const comparableDefinitions = eligibleDefinitions(
    manifest,
    definitions,
    context,
  );
  if (!Array.isArray(manifest.cells) || !manifest.cells.length)
    throw new Error("nonempty suite cells are required");
  return {
    manifest,
    threshold,
    trials,
    definitions,
    comparableDefinitions,
    sourceCells: manifest.cells,
  };
}

async function historicalAblation(manifestPath: string) {
  const context: ArchiveContext = { manifestPath, inputs: [], errors: [] };
  const cells: ReportCell[] = [];
  let suite: Awaited<ReturnType<typeof readSuite>> = {
    manifest: {},
    threshold: NaN,
    trials: NaN,
    definitions: [],
    comparableDefinitions: [],
    sourceCells: [],
  };
  let allDry = false;
  try {
    suite = await readSuite(context);
    allDry = suite.manifest.dry === true;
    for (const value of suite.sourceCells) {
      const result = await readCell(value, suite.manifest, context);
      allDry &&= result.dry;
      if (result.cell) cells.push(result.cell);
    }
  } catch (error) {
    context.errors.push(`${manifestPath}: ${message(error)}`);
  }
  const analysis = analyzeAblations(
    cells,
    suite.comparableDefinitions,
    suite.threshold,
    suite.trials,
  );
  analysis.errors.push(...context.errors);
  analysis.valid = analysis.valid && !context.errors.length;
  return {
    analysis,
    inputs: context.inputs,
    dry: allDry && cells.length > 0 && analysis.valid,
    definitions: suite.definitions,
  };
}

function hasBehavioralEvidence(
  result: ArchivedAblationCase,
): result is ArchivedAblationCase & { passRate: number } {
  return (
    result.executionMode === "executed" && typeof result.passRate === "number"
  );
}

export async function runLegacyAblation(args: string[]) {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: { output: { type: "string" } },
    });
    if (positionals.length !== 1 || values.output === "")
      throw new Error(
        "usage: legacy-ablation <suite-run.json> [--output ablation.md]",
      );
    const manifestPath = resolve(positionals[0]!);
    const report = await historicalAblation(manifestPath);
    const outputPath =
      values.output !== undefined
        ? resolve(values.output)
        : join(dirname(manifestPath), "ablation.md");
    const content = report.dry
      ? `# Skill ablation — dry run\n\nUnmeasured: ${report.definitions.map((ablation) => ablation.name).join(", ")}. Fixture preparation does not establish a behavioral comparison.\n`
      : renderAblationReport(report.analysis);
    const output = await writeLegacyMarkdown(
      report.inputs,
      outputPath,
      content +
        "\n\n## Inputs\n\n" +
        report.inputs
          .map(
            (input) => `- ${input.path}; SHA-256: ${input.sha256 ?? "unknown"}`,
          )
          .join("\n") +
        "\n\n## Diagnostics\n\n" +
        (report.analysis.errors.length
          ? report.analysis.errors.map((error) => `- ${error}`).join("\n")
          : "None.") +
        "\n",
    );
    process.stdout.write(`Ablation report: ${output}\n`);
    return report.analysis.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${message(error)}\n`);
    return 64;
  }
}

if (import.meta.main)
  process.exitCode = await runLegacyAblation(Bun.argv.slice(2));
