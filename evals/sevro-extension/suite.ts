#!/usr/bin/env bun
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { selectCaseIds } from "./index";
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
    (key) => key !== "owner_evaluation",
  );
  if (unsupported.length)
    throw new Error(
      `unsupported ${name} mode fields: ${unsupported.join(", ")}`,
    );
  const requested = mode.owner_evaluation ?? "enforced";
  if (requested !== "passive" && requested !== "enforced")
    throw new Error(`invalid ${name} owner_evaluation`);
  const condition: "passive" | "enforced" = requested;
  return { name, condition };
}

function suiteConfig(value: unknown) {
  const suite = object(value, "suite");
  const extra = Object.keys(suite).filter(
    (key) =>
      !["version", "experiment", "harnesses", "case_filter", "modes"].includes(
        key,
      ),
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
  };
}

function forwardedOptions(args: string[]) {
  const owned = new Set(["--condition", "--trials", "--threshold"]);
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

async function saveManifest(resultsRoot: string, manifest: unknown) {
  await writeFile(
    join(resultsRoot, "suite-run.json"),
    JSON.stringify(manifest, null, 2),
  );
}

export async function runSuite(argv: string[]) {
  const request = suiteInvocation(argv);
  const { suitePath, projectRoot, resultsRoot, trials, threshold } = request;
  const source = await readFile(suitePath, "utf8");
  const suite = suiteConfig(parseYaml(source) as unknown);
  const caseIds = await selectCaseIds(projectRoot, suite.filters);
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
    caseIds,
    interrupted: null as Interrupt | null,
    cells: [] as Cell[],
    report: null as Awaited<ReturnType<typeof suiteReports>> | null,
  };
  await mkdir(resultsRoot, { recursive: true });
  cells: for (const mode of suite.modes) {
    for (const caseId of caseIds) {
      const outcome = await runCell(
        request,
        mode,
        caseId,
        manifest.cells.length + 1,
      );
      manifest.cells.push(outcome.cell);
      manifest.interrupted = outcome.interrupted;
      await saveManifest(resultsRoot, manifest);
      if (outcome.interrupted) break cells;
    }
  }
  manifest.report = await suiteReports(resultsRoot, manifest.cells);
  await saveManifest(resultsRoot, manifest);
  return {
    manifest: join(resultsRoot, "suite-run.json"),
    cells: manifest.cells.length,
    failed: manifest.cells.filter((cell) => cell.exitCode !== 0).length,
    interrupted: manifest.interrupted,
    report: manifest.report,
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
          : result.failed || result.report.error
            ? 1
            : 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 64;
  }
}
