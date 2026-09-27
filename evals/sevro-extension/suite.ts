#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { resolveCase, selectCaseIds } from "./index";
import { pathToFileURL } from "node:url";
import { sevroCommand } from "./sevro-command";

const repositoryRoot = resolve(import.meta.dir, "../..");

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function modeConfig(name: string, raw: unknown) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`invalid mode: ${name}`);
  const mode = object(raw, `mode ${name}`);
  const unsupported = Object.keys(mode).filter(
    (key) => key !== "owner_evaluation" && key !== "without_skill",
  );
  if (unsupported.length)
    throw new Error(
      `unsupported ${name} mode fields: ${unsupported.join(", ")}`,
    );
  const requested = mode.owner_evaluation ?? "enforced";
  if (requested !== "passive" && requested !== "enforced")
    throw new Error(`invalid ${name} owner_evaluation`);
  const condition: "passive" | "enforced" = requested;
  if (mode.without_skill !== undefined && mode.without_skill !== true)
    throw new Error(`invalid ${name} without_skill`);
  return { name, condition, withoutSkill: mode.without_skill === true };
}

type Ablation = { name: string; baseline: string; candidate: string };

function ablationNames(
  selected: Record<string, unknown>,
  names: Set<string>,
): Ablation {
  const { name, baseline, candidate } = selected;
  if (
    typeof name !== "string" ||
    !/^[A-Za-z0-9._-]+$/.test(name) ||
    names.has(name) ||
    typeof baseline !== "string" ||
    typeof candidate !== "string" ||
    baseline === candidate
  )
    throw new Error("ablation needs a unique name and distinct modes");
  names.add(name);
  return { name, baseline, candidate };
}

function ablationEntry(
  entry: unknown,
  modes: ReturnType<typeof modeConfig>[],
  names: Set<string>,
): Ablation {
  const selected = object(entry, "ablation");
  const extra = Object.keys(selected).filter(
    (key) => !["name", "baseline", "candidate"].includes(key),
  );
  if (extra.length)
    throw new Error(`unsupported ablation fields: ${extra.join(", ")}`);
  const { name, baseline, candidate } = ablationNames(selected, names);
  const base = modes.find((mode) => mode.name === baseline);
  const selectedCandidate = modes.find((mode) => mode.name === candidate);
  if (
    !base?.withoutSkill ||
    !selectedCandidate ||
    selectedCandidate.withoutSkill
  )
    throw new Error(
      `${name}: baseline must omit skills and candidate must mount them`,
    );
  if (base.condition !== selectedCandidate.condition)
    throw new Error(`${name}: owner evaluation differs`);
  return { name, baseline, candidate };
}

function ablationConfig(raw: unknown, modes: ReturnType<typeof modeConfig>[]) {
  if (raw === undefined) return [] as Ablation[];
  if (!Array.isArray(raw) || !raw.length)
    throw new Error("ablations must be a nonempty list");
  const names = new Set<string>();
  return raw.map((entry) => ablationEntry(entry, modes, names));
}

function suiteConfig(value: unknown) {
  const suite = object(value, "suite");
  const extra = Object.keys(suite).filter(
    (key) =>
      ![
        "version",
        "experiment",
        "harnesses",
        "case_filter",
        "modes",
        "ablations",
      ].includes(key),
  );
  if (extra.length)
    throw new Error(`unsupported suite fields: ${extra.join(", ")}`);
  if (
    suite.version !== 1 ||
    typeof suite.experiment !== "string" ||
    !suite.experiment
  )
    throw new Error("suite needs version 1 and an experiment name");
  if (JSON.stringify(suite.harnesses) !== JSON.stringify(["codex"]))
    throw new Error("Sevro suites currently require harnesses: [codex]");
  const filters = Array.isArray(suite.case_filter)
    ? suite.case_filter
    : [suite.case_filter];
  if (
    !filters.length ||
    filters.some((filter) => typeof filter !== "string" || !filter.trim())
  )
    throw new Error("suite needs nonempty case filters");
  const modes = object(suite.modes, "suite modes");
  if (!Object.keys(modes).length) throw new Error("suite needs a mode");
  const selectedModes = Object.entries(modes).map(([name, raw]) =>
    modeConfig(name, raw),
  );
  return {
    experiment: suite.experiment,
    filters: filters as string[],
    modes: selectedModes,
    ablations: ablationConfig(suite.ablations, selectedModes),
  };
}

function forwardedOptions(args: string[]) {
  const owned = new Set([
    "--condition",
    "--trials",
    "--threshold",
    "--extension-configuration-file",
    "--extension-redacted-configuration-file",
  ]);
  for (const token of args) {
    if (token === "--" || owned.has(token.split("=", 1)[0]!))
      throw new Error(`suite option is owned by Darrow: ${token}`);
  }
  return args;
}

function evidenceLimits(rawTrials: string, rawThreshold: string) {
  const trials = Number(rawTrials);
  const threshold = Number(rawThreshold);
  if (
    !Number.isSafeInteger(trials) ||
    trials < 1 ||
    !Number.isFinite(threshold) ||
    threshold <= 0 ||
    threshold > 1
  )
    throw new Error("invalid trials or threshold");
  return { trials, threshold };
}

function suiteInvocation(argv: string[]) {
  const separator = argv.indexOf("--");
  if (separator < 0) throw new Error("separate Sevro run options with --");
  const { values } = parseArgs({
    args: argv.slice(0, separator),
    options: {
      suite: { type: "string" },
      "project-root": { type: "string" },
      "results-root": { type: "string" },
      trials: { type: "string", default: "5" },
      threshold: { type: "string", default: "0.8" },
    },
    strict: true,
  });
  const suitePath = values.suite;
  const projectRoot = values["project-root"] ?? repositoryRoot;
  const resultsRoot = values["results-root"];
  if (
    !suitePath ||
    !resultsRoot ||
    ![suitePath, projectRoot, resultsRoot].every(isAbsolute)
  )
    throw new Error("suite and results roots must be absolute");
  return {
    suitePath,
    projectRoot,
    resultsRoot,
    ...evidenceLimits(values.trials!, values.threshold!),
    forwarded: forwardedOptions(argv.slice(separator + 1)),
  };
}

type SuiteRequest = ReturnType<typeof suiteInvocation>;
type SuiteConfig = ReturnType<typeof suiteConfig>;
type Cell = {
  caseId: string;
  mode: string;
  condition: "passive" | "enforced";
  result: string | null;
  evidencePath: string | null;
  provenance: EvidenceSummary | null;
  exitCode: number;
  error?: string;
};
type Interrupt = "SIGINT" | "SIGTERM";
type EvidenceSummary = {
  evaluationDigest: string;
  dimensions: Record<string, unknown>;
  runner: Record<string, unknown>;
  project: Record<string, unknown>;
  extension: Record<string, unknown> | null;
  routes: Array<{ role: string; host: string; model: string; effort: string }>;
};
type ExpectedCell = {
  caseId: string;
  condition: "passive" | "enforced";
  trials: number;
  threshold: number;
  exitCode: number;
};

function verifyEvidence(
  evidence: Record<string, unknown>,
  result: Record<string, unknown>,
  expected: ExpectedCell,
) {
  const identity = object(evidence.evaluationIdentity, "evaluation identity");
  const dimensions = object(identity.dimensions, "identity dimensions");
  const retained = object(evidence.result, "retained result");
  const selected = retained.cases;
  const matches = [
    evidence.format === "sevro.run-evidence.v1",
    evidence.runId === result.runId,
    retained.exitCode === result.exitCode,
    result.exitCode === expected.exitCode,
    Array.isArray(selected) &&
      selected.length === 1 &&
      object(selected[0], "retained case").caseId === expected.caseId,
    dimensions.condition === expected.condition,
    dimensions.trialCount === expected.trials,
    dimensions.passThreshold === expected.threshold,
    typeof identity.digest === "string",
  ];
  if (matches.some((matched) => !matched))
    throw new Error("retained Sevro evidence differs from suite cell");
  return identity.digest as string;
}

function routeSummary(value: unknown): EvidenceSummary["routes"][number] {
  const route = object(value, "host route");
  if (
    ["role", "host", "model", "effort"].some(
      (key) => typeof route[key] !== "string",
    )
  )
    throw new Error("retained Sevro route is invalid");
  return route as EvidenceSummary["routes"][number];
}

async function retainedSummary(
  result: Record<string, unknown>,
  expected: ExpectedCell,
): Promise<EvidenceSummary> {
  const path = result.evidencePath;
  if (typeof path !== "string" || !isAbsolute(path))
    throw new Error("retained evidence path is missing");
  const evidence = object(
    JSON.parse(await readFile(path, "utf8")) as unknown,
    "Sevro evidence",
  );
  const evaluationDigest = verifyEvidence(evidence, result, expected);
  const routes = evidence.routes;
  if (!Array.isArray(routes))
    throw new Error("retained Sevro routes are missing");
  return {
    evaluationDigest,
    dimensions: object(
      object(evidence.evaluationIdentity, "evaluation identity").dimensions,
      "identity dimensions",
    ),
    runner: object(evidence.runner, "runner provenance"),
    project: object(evidence.project, "project provenance"),
    extension:
      evidence.extension === null
        ? null
        : object(evidence.extension, "extension provenance"),
    routes: routes.map(routeSummary),
  };
}

async function cellProvenance(
  result: Record<string, unknown> | null,
  expected: ExpectedCell,
) {
  if (!result) return { provenance: null, evidenceError: false };
  if (!result.evidencePath)
    return { provenance: null, evidenceError: result.exitCode === 0 };
  try {
    return {
      provenance: await retainedSummary(result, expected),
      evidenceError: false,
    };
  } catch {
    return { provenance: null, evidenceError: true };
  }
}

function cellStatus(
  result: Record<string, unknown> | null,
  exitCode: number,
  evidenceError: boolean,
) {
  if (evidenceError)
    return {
      exitCode: 70,
      error: "Retained Sevro evidence is unavailable or inconsistent",
    };
  if (!result)
    return { exitCode: exitCode || 70, error: "Sevro did not return JSON" };
  return { exitCode };
}

function cellCommand(
  request: SuiteRequest,
  mode: SuiteConfig["modes"][number],
  caseId: string,
  cellRoot: string,
) {
  return [
    process.execPath,
    join(import.meta.dir, "run.ts"),
    "--case-id",
    caseId,
    "--project-root",
    request.projectRoot,
    "--results-root",
    cellRoot,
    ...(mode.withoutSkill ? ["--without-skill"] : []),
    "--",
    ...request.forwarded,
    "--condition",
    mode.condition,
    "--trials",
    String(request.trials),
    "--threshold",
    String(request.threshold),
  ];
}

async function runCell(
  request: SuiteRequest,
  mode: SuiteConfig["modes"][number],
  caseId: string,
  index: number,
): Promise<{ cell: Cell; interrupted: Interrupt | null }> {
  const cellRoot = join(request.resultsRoot, `cell-${index}`);
  const child = Bun.spawn(cellCommand(request, mode, caseId, cellRoot), {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "inherit",
  });
  const { stdout, exitCode, interrupted } = await captureCell(child);
  let result: Record<string, unknown> | null = null;
  try {
    result = object(JSON.parse(stdout) as unknown, "Sevro result");
  } catch {
    // A failed invocation can return only stderr; retain that failure in the manifest.
  }
  const resultPath = result ? join(cellRoot, "result.json") : null;
  if (resultPath) await writeFile(resultPath, JSON.stringify(result, null, 2));
  const { provenance, evidenceError } = await cellProvenance(result, {
    caseId,
    condition: mode.condition,
    trials: request.trials,
    threshold: request.threshold,
    exitCode,
  });
  const cell: Cell = {
    caseId,
    mode: mode.name,
    condition: mode.condition,
    result: resultPath,
    evidencePath:
      typeof result?.evidencePath === "string" ? result.evidencePath : null,
    provenance,
    ...cellStatus(result, exitCode, evidenceError),
  };
  return { cell, interrupted };
}

async function captureCell(child: {
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
  kill(signal: Interrupt): void;
}) {
  let interrupted: Interrupt | null = null;
  const forward = (signal: Interrupt) => {
    interrupted ??= signal;
    child.kill(signal);
  };
  const onInterrupt = () => forward("SIGINT");
  const onTerminate = () => forward("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
  try {
    const [stdout, , exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, exitCode, interrupted };
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

async function publicReport(paths: string[], json: boolean): Promise<string> {
  const route = sevroCommand();
  const child = Bun.spawn(
    [
      ...route.launch,
      "report",
      ...(json ? ["--json"] : []),
      ...paths.flatMap((path) => ["--result-file", path]),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, , code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error("public Sevro report failed");
  return stdout;
}

async function suiteReports(resultsRoot: string, cells: Cell[]) {
  const paths = cells.flatMap((cell) => (cell.result ? [cell.result] : []));
  const omittedCells = cells.length - paths.length;
  if (!paths.length)
    return {
      jsonPath: null,
      markdownPath: null,
      omittedCells,
      error: "No Sevro result files available",
    };
  try {
    const json = await publicReport(paths, true);
    const parsed = object(JSON.parse(json) as unknown, "Sevro report");
    const inputs = parsed.inputs;
    if (
      parsed.format !== "sevro.report.v1" ||
      !Array.isArray(inputs) ||
      inputs.length !== paths.length ||
      inputs.some(
        (input, index) =>
          object(input, "report input").resultFile !== paths[index],
      )
    )
      throw new Error("public Sevro report omitted a suite result");
    const markdown = await publicReport(paths, false);
    const jsonPath = join(resultsRoot, "report.json");
    const markdownPath = join(resultsRoot, "report.md");
    await Promise.all([
      writeFile(jsonPath, json),
      writeFile(markdownPath, markdown),
    ]);
    return { jsonPath, markdownPath, omittedCells, error: null };
  } catch {
    return {
      jsonPath: null,
      markdownPath: null,
      omittedCells,
      error: "Public Sevro report failed",
    };
  }
}

function comparisonValue(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`invalid ${label}`);
  return value;
}

function measuredDelta(baseline: number | null, candidate: number | null) {
  return baseline === null || candidate === null ? null : candidate - baseline;
}

function metricPair(baseline: number | null, candidate: number | null) {
  return { baseline, candidate, delta: measuredDelta(baseline, candidate) };
}

function rowMetrics(value: Record<string, unknown>) {
  const input = comparisonValue(value.inputTokens, "input tokens");
  const output = comparisonValue(value.outputTokens, "output tokens");
  return {
    passRate: comparisonValue(value.taskPassRate, "pass rate"),
    durationMs: comparisonValue(value.candidateDurationMs, "duration"),
    tokens: input === null || output === null ? null : input + output,
    costUsd: comparisonValue(value.costUsd, "cost"),
  };
}

type MatchedPair = {
  definition: Ablation;
  caseId: string;
  baseline: Cell;
  candidate: Cell;
};

function identityErrors(baseline: Cell, candidate: Cell): string[] {
  const errors: string[] = [];
  const base = baseline.provenance;
  const selected = candidate.provenance;
  if (!base || !selected) return ["retained evidence is missing"];
  const allowed = new Set([
    "configurationDigest",
    "fixtureDigest",
    "evaluatorDigest",
  ]);
  for (const key of Object.keys(base.dimensions)) {
    if (!allowed.has(key) && base.dimensions[key] !== selected.dimensions[key])
      errors.push(`${key} differs`);
  }
  if (
    base.dimensions.configurationDigest ===
    selected.dimensions.configurationDigest
  )
    errors.push("extension configuration did not change");
  if (base.dimensions.fixtureDigest === selected.dimensions.fixtureDigest)
    errors.push("skill mount did not change the fixture");
  return errors;
}

function matchedCell(pair: MatchedPair, rows: Record<string, unknown>[]) {
  const { definition, caseId, baseline, candidate } = pair;
  const errors = identityErrors(baseline, candidate);
  const baselineRows = rows.filter((row) => row.resultFile === baseline.result);
  const candidateRows = rows.filter(
    (row) => row.resultFile === candidate.result,
  );
  if (baselineRows.length !== 1 || candidateRows.length !== 1)
    errors.push("expected one public report row per mode");
  if (errors.length) return { errors, comparison: null };
  const baselineRow = baselineRows[0]!;
  const candidateRow = candidateRows[0]!;
  if (baselineRow.caseId !== caseId || candidateRow.caseId !== caseId)
    errors.push("public report case differs");
  const baseMetrics = rowMetrics(baselineRow);
  const candidateMetrics = rowMetrics(candidateRow);
  if (baseMetrics.passRate === null || candidateMetrics.passRate === null)
    errors.push("task pass rate is unmeasured");
  if (errors.length) return { errors, comparison: null };
  return {
    errors,
    comparison: {
      caseId,
      baseline: definition.baseline,
      candidate: definition.candidate,
      passRate: metricPair(baseMetrics.passRate, candidateMetrics.passRate),
      durationMs: metricPair(
        baseMetrics.durationMs,
        candidateMetrics.durationMs,
      ),
      tokens: metricPair(baseMetrics.tokens, candidateMetrics.tokens),
      costUsd: metricPair(baseMetrics.costUsd, candidateMetrics.costUsd),
      resultFiles: [baseline.result, candidate.result],
    },
  };
}

function metricText(value: number | null): string {
  return value === null ? "unknown" : String(value);
}

function compareDefinition(input: {
  definition: Ablation;
  caseIds: string[];
  cells: Cell[];
  rows: Record<string, unknown>[];
  hasReport: boolean;
}) {
  const { definition, caseIds, cells, rows, hasReport } = input;
  const errors: string[] = [];
  const cases: NonNullable<ReturnType<typeof matchedCell>["comparison"]>[] = [];
  if (!hasReport) errors.push("public Sevro report is unavailable");
  for (const caseId of caseIds) {
    const baseline = cells.filter(
      (cell) => cell.caseId === caseId && cell.mode === definition.baseline,
    );
    const candidate = cells.filter(
      (cell) => cell.caseId === caseId && cell.mode === definition.candidate,
    );
    if (baseline.length !== 1 || candidate.length !== 1) {
      errors.push(`${caseId}: expected one baseline and candidate cell`);
      continue;
    }
    const matched = matchedCell(
      { definition, caseId, baseline: baseline[0]!, candidate: candidate[0]! },
      rows,
    );
    errors.push(...matched.errors.map((error) => `${caseId}: ${error}`));
    if (matched.comparison) cases.push(matched.comparison);
  }
  return { ...definition, cases, errors };
}

function markdownRow(
  name: string,
  row: NonNullable<ReturnType<typeof matchedCell>["comparison"]>,
) {
  const cells = [row.passRate, row.durationMs, row.tokens, row.costUsd].map(
    (metric) =>
      `${metricText(metric.baseline)} / ${metricText(metric.candidate)} / ${metricText(metric.delta)}`,
  );
  return `| ${name} | ${row.caseId} | ${cells.join(" | ")} |`;
}

function ablationMarkdown(analysis: {
  valid: boolean;
  comparisons: ReturnType<typeof compareDefinition>[];
  errors: string[];
}) {
  const { comparisons, errors } = analysis;
  return [
    "# Sevro skill ablations",
    "",
    `Valid: ${analysis.valid ? "yes" : "no"}`,
    "",
    "| Ablation | Case | Pass rate baseline / candidate / delta | Time ms baseline / candidate / delta | Tokens baseline / candidate / delta | Cost USD baseline / candidate / delta |",
    "| --- | --- | --- | --- | --- | --- |",
    ...comparisons.flatMap((comparison) =>
      comparison.cases.map((row) => markdownRow(comparison.name, row)),
    ),
    ...(errors.length
      ? ["", "## Errors", "", ...errors.map((error) => `- ${error}`)]
      : []),
    "",
  ].join("\n");
}

async function ablationReports(input: {
  resultsRoot: string;
  definitions: Ablation[];
  caseIds: string[];
  cells: Cell[];
  reportPath: string | null;
}) {
  const { resultsRoot, definitions, caseIds, cells, reportPath } = input;
  if (!definitions.length) return null;
  const report = reportPath
    ? object(
        JSON.parse(await readFile(reportPath, "utf8")) as unknown,
        "Sevro report",
      )
    : null;
  const reportRows = Array.isArray(report?.rows)
    ? report.rows.map((row) => object(row, "public report row"))
    : [];
  const comparisons = definitions.map((definition) =>
    compareDefinition({
      definition,
      caseIds,
      cells,
      rows: reportRows,
      hasReport: report !== null,
    }),
  );
  const errors = comparisons.flatMap((comparison) =>
    comparison.errors.map((error) => `${comparison.name}: ${error}`),
  );
  const analysis = {
    format: "darrow-sevro-ablation-v1",
    valid: errors.length === 0,
    comparisons,
    errors,
  };
  const jsonPath = join(resultsRoot, "ablation-report.json");
  const markdownPath = join(resultsRoot, "ablation-report.md");
  await Promise.all([
    writeFile(jsonPath, JSON.stringify(analysis, null, 2)),
    writeFile(markdownPath, ablationMarkdown(analysis)),
  ]);
  return { jsonPath, markdownPath, valid: analysis.valid, errors };
}

async function saveManifest(resultsRoot: string, manifest: unknown) {
  await writeFile(
    join(resultsRoot, "suite-run.json"),
    JSON.stringify(manifest, null, 2),
  );
}

async function preflightCases(
  projectRoot: string,
  suite: SuiteConfig,
  caseIds: string[],
) {
  if (!suite.modes.some((mode) => mode.withoutSkill)) return;
  for (const caseId of caseIds) {
    const selected = await resolveCase({
      projectRoot: pathToFileURL(projectRoot).href,
      selectors: { caseIds: [caseId] },
    });
    const data = object(
      selected.cases[0]?.extensionData,
      "case extension data",
    );
    const details = object(data["darrow.case"], "Darrow case data");
    if (details.invocation !== undefined)
      throw new Error(
        `${caseId}: explicit skill invocation cannot run without skills`,
      );
    if (suite.ablations.length && details.mount === undefined)
      throw new Error(`${caseId}: ablation candidate has no owning skill`);
  }
}

async function runSelectedCells(
  request: SuiteRequest,
  modes: SuiteConfig["modes"],
  caseIds: string[],
  manifest: { cells: Cell[]; interrupted: Interrupt | null },
) {
  cells: for (const mode of modes) {
    for (const caseId of caseIds) {
      const outcome = await runCell(
        request,
        mode,
        caseId,
        manifest.cells.length + 1,
      );
      manifest.cells.push(outcome.cell);
      manifest.interrupted = outcome.interrupted;
      await saveManifest(request.resultsRoot, manifest);
      if (outcome.interrupted) break cells;
    }
  }
}

export async function runSuite(argv: string[]) {
  const request = suiteInvocation(argv);
  const { suitePath, projectRoot, resultsRoot, trials, threshold } = request;
  const source = await readFile(suitePath, "utf8");
  const suite = suiteConfig(parseYaml(source) as unknown);
  if (
    suite.ablations.length &&
    (resultsRoot === projectRoot ||
      resultsRoot.startsWith(`${projectRoot}${sep}`))
  )
    throw new Error("ablation results root must be outside the project root");
  const caseIds = await selectCaseIds(projectRoot, suite.filters);
  await preflightCases(projectRoot, suite, caseIds);
  const manifest = {
    format: "darrow-sevro-suite-v1",
    suite: suitePath,
    suiteSha256: createHash("sha256").update(source).digest("hex"),
    experiment: suite.experiment,
    projectRoot,
    trials,
    threshold,
    harnesses: ["codex"],
    modes: suite.modes,
    ablations: suite.ablations,
    caseIds,
    interrupted: null as Interrupt | null,
    cells: [] as Cell[],
    report: null as Awaited<ReturnType<typeof suiteReports>> | null,
    ablationReport: null as Awaited<ReturnType<typeof ablationReports>>,
  };
  await mkdir(resultsRoot, { recursive: true });
  await runSelectedCells(request, suite.modes, caseIds, manifest);
  manifest.report = await suiteReports(resultsRoot, manifest.cells);
  manifest.ablationReport = await ablationReports({
    resultsRoot,
    definitions: suite.ablations,
    caseIds,
    cells: manifest.cells,
    reportPath: manifest.report.jsonPath,
  });
  await saveManifest(resultsRoot, manifest);
  return {
    manifest: join(resultsRoot, "suite-run.json"),
    cells: manifest.cells.length,
    failed: manifest.cells.filter((cell) => cell.exitCode !== 0).length,
    interrupted: manifest.interrupted,
    report: manifest.report,
    ablationReport: manifest.ablationReport,
  };
}

if (import.meta.main) {
  try {
    const result = await runSuite(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exitCode =
      result.interrupted === "SIGINT"
        ? 130
        : result.interrupted === "SIGTERM"
          ? 143
          : result.failed ||
              result.report.error ||
              result.ablationReport?.valid === false
            ? 1
            : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 64;
  }
}
