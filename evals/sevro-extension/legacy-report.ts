import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import {
  legacyExitCode,
  legacyRow as row,
  object,
  text,
  type ObjectValue,
} from "./legacy-evidence";

type Input = { path: string; kind: string; sha256: string | null };
type Diagnostic = { path: string; message: string };

async function readInput(path: string, kind: string, inputs: Input[]) {
  const input: Input = { path, kind, sha256: null };
  inputs.push(input);
  const bytes = await readFile(path);
  input.sha256 = createHash("sha256").update(bytes).digest("hex");
  return JSON.parse(bytes.toString("utf8")) as unknown;
}

async function cellRows(
  value: unknown,
  context: { manifest: ObjectValue; path: string },
  inputs: Input[],
  errors: Diagnostic[],
) {
  const { manifest, path: manifestPath } = context;
  const cell = object(value, "suite cell");
  const source = text(cell.result);
  if (!source) throw new Error("suite cell result path is required");
  const path = resolve(dirname(manifestPath), source);
  try {
    const results = await readInput(path, "results", inputs);
    if (!Array.isArray(results))
      throw new Error("legacy results must be an array");
    legacyExitCode(cell.exitCode);
    return results.map((result) =>
      row(result, { ...cell, result: path }, manifest),
    );
  } catch (error) {
    errors.push(diagnostic(path, error));
    return [];
  }
}

function diagnostic(path: string, error: unknown): Diagnostic {
  return {
    path,
    message: error instanceof Error ? error.message : String(error),
  };
}

async function suiteRows(
  manifest: ObjectValue,
  path: string,
  inputs: Input[],
  errors: Diagnostic[],
) {
  if (!Array.isArray(manifest.cells))
    throw new Error("suite cells must be an array");
  const rows: ReturnType<typeof row>[] = [];
  for (const cell of manifest.cells) {
    try {
      rows.push(...(await cellRows(cell, { manifest, path }, inputs, errors)));
    } catch (error) {
      errors.push(diagnostic(path, error));
    }
  }
  return rows;
}

async function inputRows(
  data: unknown,
  path: string,
  inputs: Input[],
  errors: Diagnostic[],
) {
  if (Array.isArray(data)) {
    inputs[0]!.kind = "results";
    return data.map((result) => row(result, { result: path }, {}));
  }
  const manifest = object(data, "suite manifest");
  if (manifest.format === "darrow-eval-trial-v1") {
    inputs[0]!.kind = "checkpoint";
    return [row(manifest.case, { result: path }, manifest)];
  }
  if (manifest.format !== "darrow-orchestration-suite-v1")
    throw new Error(
      `Unsupported historical format: ${String(manifest.format ?? "missing")}`,
    );
  return suiteRows(manifest, path, inputs, errors);
}

/** Interpret Darrow's historical evidence without executing an evaluator. */
export async function legacyReport(input: string) {
  const path = resolve(input);
  const inputs: Input[] = [];
  const rows: ReturnType<typeof row>[] = [];
  const errors: Diagnostic[] = [];
  try {
    const data = await readInput(path, "suite", inputs);
    rows.push(...(await inputRows(data, path, inputs, errors)));
  } catch (error) {
    errors.push(diagnostic(path, error));
  }
  errors.push(
    ...rows.flatMap((item) =>
      item.error ? [{ path: item.resultFile, message: item.error }] : [],
    ),
  );
  return {
    format: "darrow-legacy-report-v1",
    inputs,
    rows,
    errors,
    comparison: {
      status: "not_assessed",
      reason: "Archive interpretation does not establish evaluator equivalence",
    },
  };
}

function markdownCell(value: unknown) {
  return String(value ?? "unknown")
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ");
}

function markdownRows(report: Awaited<ReturnType<typeof legacyReport>>) {
  return report.rows.map((item) =>
    [
      item.caseId,
      item.harness,
      item.mode,
      item.executionMode,
      item.completeness,
      item.recorded.passRate,
      item.measured.qualityPassRate,
      item.measured.protocolPassRate,
      item.measured.bookkeepingPassRate,
    ]
      .map(markdownCell)
      .join(" | "),
  );
}

function markdown(report: Awaited<ReturnType<typeof legacyReport>>) {
  return [
    "# Historical Darrow evaluation results",
    "",
    report.comparison.reason,
    "",
    "Recorded pass rates are archival claims. Measured rates require complete executed evidence; unknown values remain unknown.",
    "",
    "| Case | Harness | Mode | Execution | Completeness | Recorded pass | Task quality | Protocol | Bookkeeping |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...markdownRows(report).map((value) => `| ${value} |`),
    "",
    "## Inputs",
    "",
    ...report.inputs.map(
      (input) =>
        `- ${markdownCell(input.path)} (${input.kind}); SHA-256: ${input.sha256 ?? "unknown"}`,
    ),
    "",
    "## Diagnostics",
    "",
    ...(report.errors.length
      ? report.errors.map(
          (error) =>
            `- ${markdownCell(error.path)}: ${markdownCell(error.message)}`,
        )
      : ["None."]),
    "",
    "## Retained evidence",
    "",
    "````json",
    JSON.stringify(report.rows, null, 2),
    "````",
    "",
  ].join("\n");
}

function missingPath(error: NodeJS.ErrnoException) {
  if (error.code === "ENOENT" || error.code === "ENOTDIR") return null;
  throw error;
}

async function pathIdentity(path: string) {
  const directory = await realpath(dirname(path)).catch(missingPath);
  const info = await stat(path, { bigint: true }).catch(missingPath);
  return {
    path: resolve(directory ?? dirname(path), basename(path)),
    inode: info ? `${info.dev}:${info.ino}` : null,
  };
}

async function protectedOutput(
  report: Awaited<ReturnType<typeof legacyReport>>,
  output: string,
) {
  const destination = await pathIdentity(output);
  const inputs = await Promise.all(
    report.inputs.map(async (input) => ({
      input: input.path,
      identity: await pathIdentity(input.path),
    })),
  );
  const source = inputs.find(
    ({ identity }) =>
      destination.path === identity.path ||
      (destination.inode !== null && destination.inode === identity.inode),
  );
  if (source)
    throw new Error(`--output cannot replace input archive: ${source.input}`);
  return destination.path;
}

async function writeMarkdown(
  report: Awaited<ReturnType<typeof legacyReport>>,
  requestedOutput: string,
) {
  const output = await protectedOutput(report, requestedOutput);
  const temporary = await mkdtemp(join(dirname(output), ".darrow-report-"));
  try {
    const path = join(temporary, "report.md");
    await writeFile(path, markdown(report));
    await rename(path, output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function emitReport(
  report: Awaited<ReturnType<typeof legacyReport>>,
  values: { json?: boolean; output?: string },
  defaultMarkdownOutput: boolean,
) {
  if (values.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    return;
  }
  const output =
    values.output !== undefined
      ? resolve(values.output)
      : defaultMarkdownOutput
        ? resolve(dirname(report.inputs[0]!.path), "report.md")
        : null;
  if (output) {
    await writeMarkdown(report, output);
    process.stdout.write(`Report: ${output}\n`);
  } else process.stdout.write(markdown(report));
}

export async function runLegacyReport(
  args: string[],
  options: { defaultMarkdownOutput?: boolean } = {},
) {
  try {
    const { positionals, values } = parseArgs({
      args,
      allowPositionals: true,
      options: { json: { type: "boolean" }, output: { type: "string" } },
    });
    if (positionals.length !== 1)
      throw new Error(
        "usage: legacy-report <historical input> [--json | --output report.md]",
      );
    if (values.output === "") throw new Error("--output cannot be empty");
    if (values.json && values.output !== undefined)
      throw new Error(
        "--json writes to standard output; --output requires Markdown",
      );
    const report = await legacyReport(positionals[0]!);
    await emitReport(report, values, options.defaultMarkdownOutput ?? false);
    return report.errors.length ? 1 : 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 64;
  }
}

if (import.meta.main)
  process.exitCode = await runLegacyReport(Bun.argv.slice(2));
