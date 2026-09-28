import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import cliResultSchema from "./schemas/cli-result-v1.schema.json";
import { invocation } from "./run";
import { selectRunCaseIds } from "./index";

const validateCliResult = new Ajv2020({ strict: false }).compile(
  cliResultSchema,
);

function caseArguments(argv: string[], caseId: string, resultsRoot: string) {
  const separator = argv.indexOf("--");
  const own: string[] = [];
  for (let index = 0; index < separator; index++) {
    const token = argv[index]!;
    const name = token.split("=", 1)[0]!;
    if (["--skill", "--plugin", "--case", "--results-root"].includes(name)) {
      if (!token.includes("=")) index++;
    } else own.push(token);
  }
  return [
    ...own,
    "--case-id",
    caseId,
    "--results-root",
    resultsRoot,
    "--",
    ...argv.slice(separator + 1),
  ];
}

type SelectionOptions = {
  projectRoot: string;
  resultsRoot: string | undefined;
  skill: string | undefined;
  plugin: string | undefined;
  filters: string[];
};
type SelectionCell = { caseId: string; resultsRoot: string; args: string[] };
type SelectionRun = {
  caseId: string;
  exitCode: number;
  resultPath: string;
  result: unknown;
  resultError: string | null;
  stderr: string;
};
type SelectionManifest = {
  format: string;
  projectRoot: string;
  resultsRoot: string;
  attemptId: string;
  manifestPath: string;
  caseIds: string[];
  runs: SelectionRun[];
  interrupted: boolean;
};
type CancellationState = {
  active: ReturnType<typeof Bun.spawn> | undefined;
  exitCode: number | undefined;
};

function selectionRoots(options: SelectionOptions) {
  if (
    !isAbsolute(options.projectRoot) ||
    !options.resultsRoot ||
    !isAbsolute(options.resultsRoot)
  )
    throw new Error("project and results roots must be absolute");
  return { projectRoot: options.projectRoot, resultsRoot: options.resultsRoot };
}

function selectionCells(argv: string[], caseIds: string[], root: string) {
  return caseIds.map((caseId) => {
    const name = createHash("sha256").update(caseId).digest("hex");
    const resultsRoot = join(root, "cases", name);
    const args = caseArguments(argv, caseId, resultsRoot);
    invocation(args);
    return { caseId, resultsRoot, args };
  });
}

function cancellationControl(manifest: SelectionManifest) {
  const state: CancellationState = { active: undefined, exitCode: undefined };
  const cancel = (signal: "SIGINT" | "SIGTERM") => {
    manifest.interrupted = true;
    state.exitCode ??= signal === "SIGINT" ? 130 : 143;
    state.active?.kill(signal);
  };
  const interrupt = () => cancel("SIGINT");
  const terminate = () => cancel("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  return {
    state,
    async dispose() {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", terminate);
      if (state.active) {
        state.active.kill("SIGTERM");
        await state.active.exited;
      }
    },
  };
}

async function captureCell(
  cell: SelectionCell,
  state: CancellationState,
): Promise<SelectionRun> {
  const child = Bun.spawn(
    [process.execPath, join(import.meta.dir, "run.ts"), ...cell.args],
    {
      stdin: "inherit",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  state.active = child;
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  state.active = undefined;
  const resultPath = join(cell.resultsRoot, "cli-result.json");
  await writeFile(resultPath, stdout);
  return {
    caseId: cell.caseId,
    exitCode,
    resultPath,
    ...publicResult(stdout, exitCode, cell.caseId),
    stderr,
  };
}

function resultRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function publicField(value: unknown, field: string) {
  return resultRecord(value)?.[field];
}

function publicOutcomes(result: Record<string, unknown>, exitCode: number) {
  const execution = publicField(result.execution, "status");
  const grading = publicField(result.grading, "status");
  const task = publicField(result.task, "verdict");
  if (exitCode !== 0) return true;
  return (
    (execution === "completed" || execution === "not_run") &&
    (grading === "completed" || grading === "not_requested") &&
    (task === "passed" || task === "not_assessed")
  );
}

function publicCase(
  result: Record<string, unknown>,
  exitCode: number,
  caseId: string,
) {
  if (!Array.isArray(result.cases)) return false;
  if (!result.cases.length) return exitCode === 64 || exitCode === 70;
  return (
    result.cases.length === 1 &&
    resultRecord(result.cases[0])?.caseId === caseId
  );
}

function publicProvenance(result: Record<string, unknown>, exitCode: number) {
  const validRun = typeof result.runId === "string" && result.runId.length > 0;
  const validPath =
    typeof result.evidencePath === "string" && isAbsolute(result.evidencePath);
  if (exitCode === 64 || exitCode === 70)
    return (
      (validRun || result.runId === null) &&
      (validPath || result.evidencePath === null)
    );
  return validRun && validPath;
}

function supportedResult(value: unknown, exitCode: number, caseId: string) {
  const result = resultRecord(value);
  if (!result || !validateCliResult(result) || result.exitCode !== exitCode)
    return false;
  return (
    publicOutcomes(result, exitCode) &&
    publicCase(result, exitCode, caseId) &&
    publicProvenance(result, exitCode)
  );
}

function publicResult(stdout: string, exitCode: number, caseId: string) {
  try {
    const result = JSON.parse(stdout) as unknown;
    if (supportedResult(result, exitCode, caseId))
      return { result, resultError: null };
  } catch {
    /* Preserve the raw output separately. */
  }
  return {
    result: null,
    resultError: "Sevro returned invalid or unsupported CLI JSON",
  };
}

async function runCells(cells: SelectionCell[], manifest: SelectionManifest) {
  const control = cancellationControl(manifest);
  try {
    for (const cell of cells) {
      if (manifest.interrupted) break;
      await mkdir(cell.resultsRoot, { recursive: true });
      if (manifest.interrupted) break;
      const run = await captureCell(cell, control.state);
      if (run.exitCode === 130 || run.exitCode === 143) {
        manifest.interrupted = true;
        control.state.exitCode ??= run.exitCode;
      }
      manifest.runs.push(run);
      await publishManifest(manifest);
    }
  } finally {
    await control.dispose();
  }
  return control.state.exitCode;
}

async function atomicWrite(path: string, contents: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, contents, { flag: "wx" });
  await rename(temporary, path);
}

async function publishManifest(manifest: SelectionManifest) {
  const contents = JSON.stringify(manifest, null, 2);
  await atomicWrite(manifest.manifestPath, contents);
  await atomicWrite(join(manifest.resultsRoot, "selection-run.json"), contents);
}

/** Retain each selected public CLI result without combining its outcome axes. */
export async function runSelection(argv: string[], options: SelectionOptions) {
  const roots = selectionRoots(options);
  const caseIds = await selectRunCaseIds(roots.projectRoot, options.filters, {
    skill: options.skill,
    plugin: options.plugin,
  });
  const attemptId = randomUUID();
  const attemptRoot = join(roots.resultsRoot, "attempts", attemptId);
  const cells = selectionCells(argv, caseIds, attemptRoot);
  const manifest: SelectionManifest = {
    format: "darrow-sevro-selection-v1",
    ...roots,
    attemptId,
    manifestPath: join(attemptRoot, "selection-run.json"),
    caseIds,
    runs: [],
    interrupted: false,
  };
  await mkdir(join(roots.resultsRoot, "attempts"), { recursive: true });
  await mkdir(attemptRoot);
  await publishManifest(manifest);
  const interruptedExit = await runCells(cells, manifest);
  await publishManifest(manifest);
  process.stdout.write(`${JSON.stringify(manifest)}\n`);
  return manifest.interrupted
    ? (interruptedExit ?? 130)
    : manifest.runs.every(
          (run) => run.exitCode === 0 && run.resultError === null,
        )
      ? 0
      : 1;
}
