import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { ReportCell } from "./report";
import type { CaseResult } from "./types";

export interface AblationMode {
  without_skill?: boolean;
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

export interface AblationCaseComparison {
  harness: string;
  caseId: string;
  invariant: string;
  baseline: CaseResult;
  candidate: CaseResult;
  passRateDelta: number;
  durationDeltaMs: number;
  tokenDelta: number | null;
  costDeltaUsd: number | null;
}

export interface AblationComparison {
  name: string;
  baseline: string;
  candidate: string;
  cases: AblationCaseComparison[];
  errors: string[];
}

export interface AblationAnalysis {
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
  return {
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

function comparisonErrors(base: CaseResult, candidate: CaseResult): string[] {
  const errors: string[] = [];
  for (const key of [
    "invariant",
    "evaluationDigest",
    "passThreshold",
    "harness",
    "harnessVersion",
    "model",
    "effort",
  ] as const) {
    if (base[key] !== candidate[key])
      errors.push(
        `${key} differs (${base[key] ?? "unknown"} vs ${candidate[key] ?? "unknown"})`,
      );
  }
  if (base.trials.length !== candidate.trials.length)
    errors.push(
      `trial count differs (${base.trials.length} vs ${candidate.trials.length})`,
    );
  if (!base.trials.length || !candidate.trials.length)
    errors.push("trial count must be positive");
  return errors;
}

function cellsFor(
  cells: ReportCell[],
  mode: string,
  harness: string,
): ReportCell[] {
  return cells.filter((cell) => cell.mode === mode && cell.harness === harness);
}

function duplicateCaseIds(results: CaseResult[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const result of results) {
    if (seen.has(result.caseId)) duplicates.add(result.caseId);
    seen.add(result.caseId);
  }
  return [...duplicates].sort();
}

function compareHarnessCells(
  definition: AblationDefinition,
  harness: string,
  baselineCell: ReportCell,
  candidateCell: ReportCell,
): { cases: AblationCaseComparison[]; errors: string[] } {
  const errors = [
    ...duplicateCaseIds(baselineCell.results).map(
      (id) => `${definition.name}/${harness}: duplicate baseline case ${id}`,
    ),
    ...duplicateCaseIds(candidateCell.results).map(
      (id) => `${definition.name}/${harness}: duplicate candidate case ${id}`,
    ),
  ];
  const cases: AblationCaseComparison[] = [];
  const caseIds = [
    ...new Set(
      [...baselineCell.results, ...candidateCell.results].map(
        (result) => result.caseId,
      ),
    ),
  ].sort();
  for (const caseId of caseIds) {
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
  baseline: CaseResult;
  candidate: CaseResult;
}): { comparison?: AblationCaseComparison; error?: string } {
  const { definition, harness, caseId, baseline, candidate } = input;
  const prefix = `${definition.name}/${harness}/${caseId}`;
  if (baseline.skillDirectory !== null)
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
  baseline: CaseResult,
  candidate: CaseResult,
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

export function analyzeAblations(
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
  return `${(row.baseline.passRate * 100).toFixed(0)}% → ${(row.candidate.passRate * 100).toFixed(0)}% (${signed(row.passRateDelta * 100)}pp)`;
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

export function renderAblationReport(analysis: AblationAnalysis): string {
  const sections = [
    "# Skill ablation report",
    "",
    `Status: **${analysis.valid ? "valid" : "invalid"}**`,
    "",
    `Pass threshold: ${(analysis.threshold * 100).toFixed(0)}%. Each row preserves one matched task; coverage and a passing candidate do not by themselves prove skill value.`,
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
    "- The report attributes observed deltas only to the matched mounted-skill difference in this sample.",
    "- Unknown token or cost measurements remain unknown and are not treated as zero.",
    "- Promotion claims still require enough fresh trials and review of task-level regressions.",
  );
  return sections.join("\n");
}

if (import.meta.main) {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: { output: { type: "string" } },
  });
  if (positionals.length !== 1)
    throw new Error(
      "usage: bun evals/runner/ablation.ts <suite-run.json> [--output ablation.md]",
    );
  const manifestPath = resolve(process.cwd(), positionals[0]!);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    trials: number;
    threshold: number;
    ablations?: AblationDefinition[];
    cells: Array<{ harness: string; mode: string; result: string }>;
  };
  if (!manifest.ablations?.length)
    throw new Error(`${manifestPath} declares no ablations`);
  const cells: ReportCell[] = [];
  for (const cell of manifest.cells) {
    cells.push({
      harness: cell.harness,
      mode: cell.mode,
      results: JSON.parse(await readFile(cell.result, "utf8")) as CaseResult[],
    });
  }
  const analysis = analyzeAblations(
    cells,
    manifest.ablations,
    manifest.threshold,
    manifest.trials,
  );
  const outputPath = values.output
    ? resolve(process.cwd(), values.output)
    : join(dirname(manifestPath), "ablation.md");
  await writeFile(outputPath, renderAblationReport(analysis));
  console.log(`Ablation report: ${outputPath}`);
  if (!analysis.valid) process.exitCode = 1;
}
