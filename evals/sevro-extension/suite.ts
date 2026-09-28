#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { preflightCaseDetails, selectCaseIds } from "./index";
import { pathToFileURL } from "node:url";
import { sevroCommand } from "./sevro-command";
import { activationGate, type ActivationExpectation } from "./activation";
import { activationReports } from "./activation-report";
import { qualityReports } from "./quality-report";
import {
  candidateArguments,
  candidateRouteMatches,
  modeRouteConfig,
  optionValue,
  requestedCandidateRoute,
  suiteCaseRoutes,
  type CandidateRoute,
  type CaseRoutes,
} from "./suite-routes";
import {
  conditionArguments,
  conditionEvidenceMatches,
  loadSuiteConditions,
  modeConditionConfig,
  preflightConfiguration,
  type ConditionInput,
  type SuiteConditions,
} from "./suite-conditions";
import type { BenchmarkCondition } from "./benchmark-condition";
import {
  benchmarkArguments,
  modeBenchmarkPolicy,
  requestedBenchmarkPolicy,
} from "./benchmark-policy";
import {
  loadSkillOverride,
  modeSkillConfig,
  skillArguments,
  skillMountConfiguration,
} from "./skill-mount";

const repositoryRoot = resolve(import.meta.dir, "../..");
type Harness = "codex" | "claude";

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function modeConfig(name: string, raw: unknown) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error(`invalid mode: ${name}`);
  const mode = object(raw, `mode ${name}`);
  const unsupported = Object.keys(mode).filter(
    (key) =>
      ![
        "owner_evaluation",
        "without_skill",
        "model_by_harness",
        "effort",
        "condition",
        "condition_by_harness",
        "skill_dir",
        "mount_plugin_skills",
        "require_evaluation_records",
        "effective_owner_routes",
        "apply_case_routes",
      ].includes(key),
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
  return {
    name,
    condition,
    withoutSkill: mode.without_skill === true,
    ...modeRouteConfig(mode),
    ...modeConditionConfig(mode),
    ...modeSkillConfig(mode),
    ...modeBenchmarkPolicy(mode),
  };
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

function suiteHarnesses(raw: unknown): Harness[] {
  if (
    !Array.isArray(raw) ||
    !raw.length ||
    raw.some((host) => host !== "codex" && host !== "claude") ||
    new Set(raw).size !== raw.length
  )
    throw new Error(
      "harnesses must be a unique nonempty list of codex or claude",
    );
  return raw as Harness[];
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
        "case_routes",
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
  const harnesses = suiteHarnesses(
    suite.harnesses === undefined ? ["claude", "codex"] : suite.harnesses,
  );
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
    harnesses,
    filters: filters as string[],
    caseRoutes: suiteCaseRoutes(suite.case_routes),
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
      harness: { type: "string", multiple: true },
      mode: { type: "string", multiple: true },
      case: { type: "string", multiple: true },
      "project-root": { type: "string" },
      "results-root": { type: "string" },
      trials: { type: "string", default: "5" },
      threshold: { type: "string", default: "0.8" },
      "host-options-file": { type: "string" },
    },
    strict: true,
  });
  const suitePath = values.suite;
  const projectRoot = values["project-root"] ?? repositoryRoot;
  const resultsRoot = values["results-root"];
  const hostOptionsFile = values["host-options-file"];
  if (
    !suitePath ||
    !resultsRoot ||
    ![suitePath, projectRoot, resultsRoot].every(isAbsolute) ||
    (hostOptionsFile !== undefined && !isAbsolute(hostOptionsFile))
  )
    throw new Error("suite and results roots must be absolute");
  return {
    suitePath,
    projectRoot,
    resultsRoot,
    hostOptionsFile,
    harnesses: values.harness,
    modes: values.mode,
    cases: values.case,
    hostOptions: null as Partial<Record<Harness, string[]>> | null,
    caseRoutes: {} as CaseRoutes,
    benchmarkConditions: {} as SuiteConditions,
    benchmarkConditionDefinitions: new Map<string, BenchmarkCondition>(),
    ...evidenceLimits(values.trials!, values.threshold!),
    forwarded: forwardedOptions(argv.slice(separator + 1)),
  };
}

type SuiteRequest = ReturnType<typeof suiteInvocation>;
type SuiteConfig = ReturnType<typeof suiteConfig>;

function selectedModes(
  names: string[] | undefined,
  modes: SuiteConfig["modes"],
) {
  const selected = names ?? modes.map((mode) => mode.name);
  if (!selected.length || new Set(selected).size !== selected.length)
    throw new Error("mode selection must be unique and nonempty");
  return selected.map((name) => {
    const mode = modes.find((entry) => entry.name === name);
    if (!mode) throw new Error(`unknown suite mode: ${name}`);
    return mode;
  });
}

function selectedSuite(suite: SuiteConfig, request: SuiteRequest) {
  const harnesses = suiteHarnesses(request.harnesses ?? suite.harnesses);
  if (harnesses.some((host) => !suite.harnesses.includes(host)))
    throw new Error("suite does not support a selected harness");
  return {
    ...suite,
    harnesses,
    allowedHarnesses: suite.harnesses,
    modes: selectedModes(request.modes, suite.modes),
    filters: request.cases ?? suite.filters,
  };
}

function hostArguments(value: unknown, harness: Harness): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 256 ||
    value.some((arg) => typeof arg !== "string" || !arg)
  )
    throw new Error(`invalid ${harness} host argument list`);
  const args = forwardedOptions(value as string[]);
  const host = optionValue(args, "--host");
  const adapter = optionValue(args, "--adapter-module");
  if ((!host && !adapter) || (host && adapter) || (host && host !== harness))
    throw new Error(`${harness}: declare one matching host or adapter route`);
  return args;
}

function verifySharedOptions(shared: string[], routes: string[][]) {
  const candidateOptions = new Set([
    "--host",
    "--model",
    "--effort",
    "--adapter-module",
  ]);
  const routeOptions = new Set(
    routes
      .flat()
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => arg.split("=", 1)[0]!),
  );
  for (const arg of shared.filter((token) => token.startsWith("--"))) {
    const name = arg.split("=", 1)[0]!;
    if (
      candidateOptions.has(name) ||
      name.startsWith("--claude-") ||
      routeOptions.has(name)
    )
      throw new Error(`shared option conflicts with host routes: ${name}`);
  }
}

async function loadHostOptions(
  request: SuiteRequest,
  harnesses: Harness[],
  allowedHarnesses: Harness[],
) {
  const path = request.hostOptionsFile;
  if (!path) {
    if (harnesses.length > 1)
      throw new Error("multiple harnesses require --host-options-file");
    const host = optionValue(request.forwarded, "--host");
    if (host && host !== harnesses[0])
      throw new Error("forwarded host differs from suite harness");
    return { options: null, digest: null };
  }
  if ((await stat(path)).size > 64 * 1024)
    throw new Error("host options file exceeds 64 KiB");
  const source = await readFile(path, "utf8");
  if (Buffer.byteLength(source, "utf8") > 64 * 1024)
    throw new Error("host options file exceeds 64 KiB");
  const raw = object(JSON.parse(source) as unknown, "host options");
  if (
    Object.keys(raw).some(
      (host) => !allowedHarnesses.includes(host as Harness),
    ) ||
    harnesses.some((host) => !Object.hasOwn(raw, host))
  )
    throw new Error("host options must cover selected and supported harnesses");
  const declared = Object.fromEntries(
    Object.entries(raw).map(([host, args]) => [
      host,
      hostArguments(args, host as Harness),
    ]),
  );
  const options = Object.fromEntries(
    harnesses.map((host) => [host, declared[host]!]),
  );
  verifySharedOptions(request.forwarded, Object.values(options));
  return { options, digest: createHash("sha256").update(source).digest("hex") };
}

type Cell = {
  caseId: string;
  harness: Harness;
  mode: string;
  condition: "passive" | "enforced";
  result: string | null;
  evidencePath: string | null;
  provenance: EvidenceSummary | null;
  activation: ReturnType<typeof activationGate>;
  requestedRoute: CandidateRoute;
  benchmarkCondition: ConditionInput | null;
  exitCode: number;
  recordChecksRequested: boolean;
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
  harness: Harness;
  condition: "passive" | "enforced";
  trials: number;
  threshold: number;
  exitCode: number;
  activation: ActivationExpectation | null;
  requestedRoute: CandidateRoute;
  benchmarkCondition: ConditionInput | null;
  withoutSkill: boolean;
  skillDir?: string;
  mountPluginSkills?: true;
  requireEvaluationRecords?: true;
  effectiveOwnerRoute?: import("./benchmark-owner").OwnerRoute;
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
  const candidateRoutes = Array.isArray(evidence.routes)
    ? evidence.routes.filter(
        (route) => object(route, "host route").role === "candidate",
      )
    : [];
  const matches = [
    evidence.format === "sevro.run-evidence.v1",
    evidence.runId === result.runId,
    retained.exitCode === result.exitCode,
    isDeepStrictEqual(retained.cases, result.cases),
    isDeepStrictEqual(retained.execution, result.execution),
    isDeepStrictEqual(retained.grading, result.grading),
    isDeepStrictEqual(retained.task, result.task),
    result.exitCode === expected.exitCode,
    Array.isArray(selected) &&
      selected.length === 1 &&
      object(selected[0], "retained case").caseId === expected.caseId,
    dimensions.condition === expected.condition,
    dimensions.trialCount === expected.trials,
    dimensions.passThreshold === expected.threshold,
    typeof identity.digest === "string",
    candidateRoutes.length === 1 &&
      candidateRouteMatches(candidateRoutes[0], expected),
    conditionEvidenceMatches(
      object(
        object(evidence.configuration, "retained configuration").redacted,
        "redacted configuration",
      ).extensionConfiguration,
      expected.benchmarkCondition,
      expected.withoutSkill,
      expected,
    ),
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
) {
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
  const provenance: EvidenceSummary = {
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
  const retained = object(evidence.result, "retained result");
  return {
    provenance,
    activation: activationGate(
      expected.activation,
      expected,
      (retained.cases as unknown[])[0],
    ),
  };
}

async function cellProvenance(
  result: Record<string, unknown> | null,
  expected: ExpectedCell,
) {
  const missing = {
    provenance: null,
    activation: activationGate(expected.activation, expected, null),
  };
  if (!result) return { ...missing, evidenceError: false };
  if (!result.evidencePath)
    return { ...missing, evidenceError: result.exitCode === 0 };
  try {
    return {
      ...(await retainedSummary(result, expected)),
      evidenceError: false,
    };
  } catch {
    return { ...missing, evidenceError: true };
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

type CellSelection = {
  mode: SuiteConfig["modes"][number];
  caseId: string;
  harness: Harness;
  index: number;
  activation: ActivationExpectation | null;
  recordChecksRequested: boolean;
};

function cellCommand(request: SuiteRequest, selected: CellSelection) {
  const { mode, caseId, harness, index } = selected;
  const cellRoot = join(request.resultsRoot, `cell-${index}`);
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
    ...conditionArguments(request.benchmarkConditions[mode.name]?.[harness]),
    ...skillArguments(mode, request.projectRoot),
    ...benchmarkArguments(requestedBenchmarkPolicy(mode, caseId), caseId),
    "--",
    ...candidateArguments(
      [...request.forwarded, ...(request.hostOptions?.[harness] ?? [])],
      requestedCandidateRoute(mode, harness, caseId, request.caseRoutes),
    ),
    "--condition",
    mode.condition,
    "--trials",
    String(request.trials),
    "--threshold",
    String(request.threshold),
  ];
}

function cellExpectation(
  request: SuiteRequest,
  selected: CellSelection,
  exitCode: number,
): ExpectedCell {
  const { mode, caseId, harness } = selected;
  return {
    caseId,
    harness,
    condition: mode.condition,
    trials: request.trials,
    threshold: request.threshold,
    exitCode,
    activation: selected.activation,
    requestedRoute: requestedCandidateRoute(
      mode,
      harness,
      caseId,
      request.caseRoutes,
    ),
    benchmarkCondition:
      request.benchmarkConditions[mode.name]?.[harness] ?? null,
    withoutSkill: mode.withoutSkill,
    ...(mode.skillDir ? { skillDir: mode.skillDir } : {}),
    ...(mode.mountPluginSkills ? { mountPluginSkills: true } : {}),
    ...requestedBenchmarkPolicy(mode, caseId),
  };
}

async function runCell(
  request: SuiteRequest,
  selected: CellSelection,
): Promise<{ cell: Cell; interrupted: Interrupt | null }> {
  const { mode, caseId, harness, index } = selected;
  const cellRoot = join(request.resultsRoot, `cell-${index}`);
  const child = Bun.spawn(cellCommand(request, selected), {
    stdout: "pipe",
    stderr: "pipe",
    stdin: "inherit",
  });
  const { stdout, exitCode, interrupted } = await captureCell(child);
  const expected = cellExpectation(request, selected, exitCode);
  const { requestedRoute, benchmarkCondition } = expected;
  let result: Record<string, unknown> | null = null;
  try {
    result = object(JSON.parse(stdout) as unknown, "Sevro result");
  } catch {
    // A failed invocation can return only stderr; retain that failure in the manifest.
  }
  const resultPath = result ? join(cellRoot, "result.json") : null;
  if (resultPath) await writeFile(resultPath, JSON.stringify(result, null, 2));
  const { provenance, activation, evidenceError } = await cellProvenance(
    result,
    expected,
  );
  const cell: Cell = {
    caseId,
    harness,
    mode: mode.name,
    condition: mode.condition,
    result: resultPath,
    evidencePath:
      typeof result?.evidencePath === "string" ? result.evidencePath : null,
    provenance,
    activation,
    requestedRoute,
    ...cellStatus(result, exitCode, evidenceError),
    recordChecksRequested: selected.recordChecksRequested,
    benchmarkCondition,
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
      harness: baseline.harness,
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
  harnesses: Harness[];
}) {
  const { definition, caseIds, cells, rows, hasReport, harnesses } = input;
  const errors: string[] = [];
  const cases: NonNullable<ReturnType<typeof matchedCell>["comparison"]>[] = [];
  if (!hasReport) errors.push("public Sevro report is unavailable");
  for (const { caseId, harness } of harnesses.flatMap((harness) =>
    caseIds.map((caseId) => ({ caseId, harness })),
  )) {
    const baseline = cells.filter(
      (cell) =>
        cell.caseId === caseId &&
        cell.harness === harness &&
        cell.mode === definition.baseline,
    );
    const candidate = cells.filter(
      (cell) =>
        cell.caseId === caseId &&
        cell.harness === harness &&
        cell.mode === definition.candidate,
    );
    if (baseline.length !== 1 || candidate.length !== 1) {
      errors.push(
        `${harness}/${caseId}: expected one baseline and candidate cell`,
      );
      continue;
    }
    const matched = matchedCell(
      { definition, caseId, baseline: baseline[0]!, candidate: candidate[0]! },
      rows,
    );
    errors.push(
      ...matched.errors.map((error) => `${harness}/${caseId}: ${error}`),
    );
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
  return `| ${name} | ${row.harness} | ${row.caseId} | ${cells.join(" | ")} |`;
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
    "| Ablation | Harness | Case | Pass rate baseline / candidate / delta | Time ms baseline / candidate / delta | Tokens baseline / candidate / delta | Cost USD baseline / candidate / delta |",
    "| --- | --- | --- | --- | --- | --- | --- |",
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
  harnesses: Harness[];
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
      harnesses: input.harnesses,
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
  request: SuiteRequest,
  suite: SuiteConfig,
  caseIds: string[],
) {
  const expectations = new Map<
    string,
    {
      activation: ActivationExpectation | null;
      recordChecksRequested: boolean;
    }
  >();
  for (const mode of suite.modes) {
    for (const harness of suite.harnesses) {
      for (const caseId of caseIds) {
        requestedCandidateRoute(mode, harness, caseId, request.caseRoutes);
        const policy = preflightBenchmarkPolicy(mode, harness, caseId);
        const details = await preflightCaseDetails({
          projectRoot: pathToFileURL(request.projectRoot).href,
          selectors: { caseIds: [caseId] },
          configuration: {
            ...preflightConfiguration(
              request.benchmarkConditions[mode.name]?.[harness],
              request.benchmarkConditionDefinitions,
            ),
            ...skillMountConfiguration(mode),
            ...policy,
          },
        });
        if (mode.withoutSkill && details.invocation !== undefined)
          throw new Error(
            `${caseId}: explicit skill invocation cannot run without skills`,
          );
        if (suite.ablations.length && details.mount === undefined)
          throw new Error(`${caseId}: ablation candidate has no owning skill`);
        expectations.set(JSON.stringify([mode.name, harness, caseId]), {
          activation:
            (details.activation as ActivationExpectation | undefined) ?? null,
          recordChecksRequested: details.benchmarkRecords === true,
        });
      }
    }
  }
  return expectations;
}

function preflightBenchmarkPolicy(
  mode: SuiteConfig["modes"][number],
  harness: Harness,
  caseId: string,
) {
  const policy = requestedBenchmarkPolicy(mode, caseId);
  if (policy.effectiveOwnerRoute && harness !== "codex")
    throw new Error(`${caseId}: native effective owner routes require Codex`);
  return policy;
}

async function runSelectedCells(
  request: SuiteRequest,
  suite: SuiteConfig,
  selection: {
    caseIds: string[];
    expectations: Awaited<ReturnType<typeof preflightCases>>;
  },
  manifest: { cells: Cell[]; interrupted: Interrupt | null },
) {
  const { caseIds, expectations } = selection;
  cells: for (const mode of suite.modes) {
    for (const selected of suite.harnesses.flatMap((harness) =>
      caseIds.map((caseId) => ({ harness, caseId })),
    )) {
      const expectation = expectations.get(
        JSON.stringify([mode.name, selected.harness, selected.caseId]),
      )!;
      const outcome = await runCell(request, {
        ...selected,
        mode,
        index: manifest.cells.length + 1,
        activation: mode.withoutSkill ? null : expectation.activation,
        recordChecksRequested: expectation.recordChecksRequested,
      });
      manifest.cells.push(outcome.cell);
      manifest.interrupted = outcome.interrupted;
      await saveManifest(request.resultsRoot, manifest);
      if (outcome.interrupted) break cells;
    }
  }
}

function suiteManifest(
  request: SuiteRequest,
  suite: SuiteConfig,
  inputs: {
    source: string;
    caseIds: string[];
    hostOptionsDigest: string | null;
  },
) {
  return {
    format: "darrow-sevro-suite-v1",
    suite: request.suitePath,
    suiteSha256: createHash("sha256").update(inputs.source).digest("hex"),
    experiment: suite.experiment,
    projectRoot: request.projectRoot,
    trials: request.trials,
    threshold: request.threshold,
    harnesses: suite.harnesses,
    hostOptionsFile: request.hostOptionsFile ?? null,
    hostOptionsSha256: inputs.hostOptionsDigest,
    modes: suite.modes,
    caseRoutes: suite.caseRoutes,
    benchmarkConditions: request.benchmarkConditions,
    ablations: suite.ablations,
    caseIds: inputs.caseIds,
    caseFilters: suite.filters,
    interrupted: null as Interrupt | null,
    cells: [] as Cell[],
    report: null as Awaited<ReturnType<typeof suiteReports>> | null,
    qualityReport: null as Awaited<ReturnType<typeof qualityReports>> | null,
    activationReport: null as Awaited<
      ReturnType<typeof activationReports>
    > | null,
    ablationReport: null as Awaited<ReturnType<typeof ablationReports>>,
  };
}

function suiteCounts(cells: Cell[]) {
  return {
    cells: cells.length,
    failed: cells.filter((cell) => cell.exitCode !== 0).length,
    activationFailed: cells.filter(
      (cell) => cell.activation.status === "failed",
    ).length,
    activationUnavailable: cells.filter(
      (cell) => cell.activation.status === "unavailable",
    ).length,
  };
}

async function suiteInputs(request: SuiteRequest) {
  const { suitePath, projectRoot, resultsRoot } = request;
  const source = await readFile(suitePath, "utf8");
  const suite = selectedSuite(
    suiteConfig(parseYaml(source) as unknown),
    request,
  );
  request.caseRoutes = suite.caseRoutes;
  const hostOptions = await loadHostOptions(
    request,
    suite.harnesses,
    suite.allowedHarnesses,
  );
  request.hostOptions = hostOptions.options;
  const conditions = await loadSuiteConditions(
    suitePath,
    suite.modes,
    suite.harnesses,
  );
  request.benchmarkConditions = conditions.inputs;
  request.benchmarkConditionDefinitions = conditions.definitions;
  for (const mode of suite.modes) {
    if (mode.skillDir)
      mode.skillDir = await loadSkillOverride(
        projectRoot,
        resolve(dirname(suitePath), mode.skillDir),
      );
  }
  if (
    suite.ablations.length &&
    (resultsRoot === projectRoot ||
      resultsRoot.startsWith(`${projectRoot}${sep}`))
  )
    throw new Error("ablation results root must be outside the project root");
  const caseIds = await selectCaseIds(projectRoot, suite.filters);
  const expectations = await preflightCases(request, suite, caseIds);
  return {
    source,
    suite,
    caseIds,
    expectations,
    hostOptionsDigest: hostOptions.digest,
  };
}

export async function runSuite(argv: string[]) {
  const request = suiteInvocation(argv);
  const { resultsRoot } = request;
  const inputs = await suiteInputs(request);
  const { suite, caseIds, expectations } = inputs;
  const manifest = suiteManifest(request, suite, inputs);
  await mkdir(resultsRoot, { recursive: true });
  await runSelectedCells(request, suite, { caseIds, expectations }, manifest);
  manifest.report = await suiteReports(resultsRoot, manifest.cells);
  manifest.qualityReport = await qualityReports(
    resultsRoot,
    manifest.cells,
    request.trials,
  );
  manifest.activationReport = await activationReports(
    resultsRoot,
    manifest.cells,
  );
  manifest.ablationReport = await ablationReports({
    resultsRoot,
    definitions: suite.ablations,
    caseIds,
    cells: manifest.cells,
    reportPath: manifest.report.jsonPath,
    harnesses: suite.harnesses,
  });
  await saveManifest(resultsRoot, manifest);
  return {
    manifest: join(resultsRoot, "suite-run.json"),
    ...suiteCounts(manifest.cells),
    interrupted: manifest.interrupted,
    report: manifest.report,
    qualityReport: manifest.qualityReport,
    activationReport: manifest.activationReport,
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
              result.activationFailed ||
              result.activationUnavailable ||
              result.report.error ||
              result.qualityReport.error ||
              result.ablationReport?.valid === false
            ? 1
            : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 64;
  }
}
