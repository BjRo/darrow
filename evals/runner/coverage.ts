import { readdir, readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";

export interface CoverageLocation {
  path: string;
  line?: number;
}

export interface CoverageCase extends CoverageLocation {
  id: string;
}

export interface CoveredInvariant {
  id: string;
  definitions: CoverageLocation[];
  cases: CoverageCase[];
}

export interface CoverageReference {
  id: string;
  cases: CoverageCase[];
}

export interface InvariantCoverageReport {
  format: "darrow-invariant-coverage-v1";
  root: string;
  specificationFiles: string[];
  evalFiles: string[];
  invariants: CoveredInvariant[];
  uncovered: string[];
  unknownReferences: CoverageReference[];
  duplicateDefinitions: Array<{
    id: string;
    definitions: CoverageLocation[];
  }>;
  valid: boolean;
  strictValid: boolean;
}

export interface CoverageScanOptions {
  root: string;
  specInputs: string[];
  evalInputs: string[];
}

interface ParsedEvalCase {
  id: string;
  invariant: string;
  prompt: string;
  fixture: Record<string, unknown>;
  checks: unknown[];
}

interface InvariantDefinitionLocation extends CoverageLocation {
  id: string;
}

const INVARIANT_DEFINITION =
  /^\s*(?:[-*]|\d+\.)\s+\*\*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)\s+—/g;

function absolute(root: string, path: string): string {
  return isAbsolute(path) ? path : resolve(root, path);
}

async function filesBelow(path: string, extension: string): Promise<string[]> {
  let entry;
  try {
    entry = await stat(path);
  } catch (error) {
    throw new Error(`cannot read coverage input ${path}`, { cause: error });
  }
  if (entry.isFile()) return extname(path) === extension ? [path] : [];
  if (!entry.isDirectory()) return [];

  const files: string[] = [];
  for (const child of await readdir(path, { withFileTypes: true })) {
    const childPath = join(path, child.name);
    if (child.isDirectory()) {
      files.push(...(await filesBelow(childPath, extension)));
    } else if (child.isFile() && extname(child.name) === extension) {
      files.push(childPath);
    }
  }
  return files;
}

async function collectInputs(
  root: string,
  inputs: string[],
  extension: string,
  evalOnly = false,
): Promise<string[]> {
  const files = (
    await Promise.all(
      inputs.map((input) => filesBelow(absolute(root, input), extension)),
    )
  )
    .flat()
    .filter((path) =>
      evalOnly
        ? path.split(/[\\/]/).includes("evals") ||
          inputs.map((input) => absolute(root, input)).includes(path)
        : true,
    );
  return [...new Set(files)].sort();
}

function definitions(
  path: string,
  text: string,
): InvariantDefinitionLocation[] {
  const found: InvariantDefinitionLocation[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    for (const match of line.matchAll(INVARIANT_DEFINITION)) {
      found.push({ path, line: index + 1, id: match[1]! });
    }
  }
  return found;
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim())
    throw new Error(`eval case ${path} must define a non-empty ${key}`);
  return value;
}

function requiredObject(
  record: Record<string, unknown>,
  key: string,
  path: string,
): Record<string, unknown> {
  const value = record[key];
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`eval case ${path} must define a ${key} object`);
  return value as Record<string, unknown>;
}

function requiredArray(
  record: Record<string, unknown>,
  key: string,
  path: string,
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value))
    throw new Error(`eval case ${path} must define a ${key} array`);
  return value;
}

function parseCase(path: string, text: string): ParsedEvalCase {
  let value: unknown;
  try {
    value = parseYaml(text);
  } catch (error) {
    throw new Error(`cannot parse eval case ${path}`, { cause: error });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`eval case ${path} must be one YAML object`);
  }
  const record = value as Record<string, unknown>;
  return {
    id: requiredString(record, "id", path),
    invariant: requiredString(record, "invariant", path),
    prompt: requiredString(record, "prompt", path),
    fixture: requiredObject(record, "fixture", path),
    checks: requiredArray(record, "checks", path),
  };
}

async function loadDefinitions(
  specificationFiles: string[],
): Promise<Map<string, CoverageLocation[]>> {
  const definitionMap = new Map<string, CoverageLocation[]>();
  for (const path of specificationFiles) {
    for (const { id, ...definition } of definitions(
      path,
      await readFile(path, "utf8"),
    )) {
      definitionMap.set(id, [...(definitionMap.get(id) ?? []), definition]);
    }
  }
  return definitionMap;
}

async function loadReferences(
  evalFiles: string[],
): Promise<Map<string, CoverageCase[]>> {
  const referenceMap = new Map<string, CoverageCase[]>();
  for (const path of evalFiles) {
    const evalCase = parseCase(path, await readFile(path, "utf8"));
    const ids = evalCase.invariant.split(",").map((id) => id.trim());
    if (ids.some((id) => !id))
      throw new Error(
        `eval case ${path} contains an empty invariant reference`,
      );
    for (const id of new Set(ids)) {
      referenceMap.set(id, [
        ...(referenceMap.get(id) ?? []),
        { id: evalCase.id, path },
      ]);
    }
  }
  return referenceMap;
}

function buildCoverageReport(
  inputs: Pick<
    InvariantCoverageReport,
    "root" | "specificationFiles" | "evalFiles"
  > & {
    definitionMap: Map<string, CoverageLocation[]>;
    referenceMap: Map<string, CoverageCase[]>;
  },
): InvariantCoverageReport {
  const { root, specificationFiles, evalFiles, definitionMap, referenceMap } =
    inputs;
  const invariants = [...definitionMap]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, invariantDefinitions]) => ({
      id,
      definitions: invariantDefinitions,
      cases: [...(referenceMap.get(id) ?? [])].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    }));
  const uncovered = invariants
    .filter((invariant) => !invariant.cases.length)
    .map((invariant) => invariant.id);
  const unknownReferences = [...referenceMap]
    .filter(([id]) => !definitionMap.has(id))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, cases]) => ({ id, cases }));
  const duplicateDefinitions = [...definitionMap]
    .filter(([, locations]) => locations.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, invariantDefinitions]) => ({
      id,
      definitions: invariantDefinitions,
    }));
  const valid =
    unknownReferences.length === 0 && duplicateDefinitions.length === 0;
  return {
    format: "darrow-invariant-coverage-v1",
    root,
    specificationFiles,
    evalFiles,
    invariants,
    uncovered,
    unknownReferences,
    duplicateDefinitions,
    valid,
    strictValid: valid && uncovered.length === 0,
  };
}

export async function scanInvariantCoverage(
  options: CoverageScanOptions,
): Promise<InvariantCoverageReport> {
  const root = resolve(options.root);
  const specificationFiles = await collectInputs(
    root,
    options.specInputs,
    ".md",
  );
  const evalFiles = await collectInputs(
    root,
    options.evalInputs,
    ".yaml",
    true,
  );
  if (!specificationFiles.length)
    throw new Error("no specification files found in the selected scope");
  if (!evalFiles.length)
    throw new Error("no eval files found in the selected scope");

  const definitionMap = await loadDefinitions(specificationFiles);
  if (!definitionMap.size)
    throw new Error(
      "no normative invariant definitions found in the selected scope",
    );
  return buildCoverageReport({
    root,
    specificationFiles,
    evalFiles,
    definitionMap,
    referenceMap: await loadReferences(evalFiles),
  });
}

function location(value: CoverageLocation): string {
  return `${value.path}${value.line ? `:${value.line}` : ""}`;
}

export function renderCoverageReport(report: InvariantCoverageReport): string {
  const covered = report.invariants.filter(
    (invariant) => invariant.cases.length,
  );
  return [
    "format\tdarrow-invariant-coverage-v1",
    `root\t${report.root}`,
    `status\t${report.valid ? "valid" : "invalid"}`,
    `strict_status\t${report.strictValid ? "valid" : "gaps"}`,
    `specification_files\t${report.specificationFiles.length}`,
    `eval_files\t${report.evalFiles.length}`,
    `invariants\t${report.invariants.length}`,
    `covered\t${covered.length}`,
    `uncovered\t${report.uncovered.length}`,
    "",
    "covered invariants:",
    ...(covered.length
      ? covered.map(
          (invariant) =>
            `${invariant.id} — ${invariant.cases.map((item) => item.id).join(", ")}`,
        )
      : ["none"]),
    "",
    "uncovered invariants:",
    ...(report.uncovered.length
      ? report.uncovered.map(
          (id) => `${id} — no eval case references this invariant`,
        )
      : ["none"]),
    "",
    "unknown or retired references:",
    ...(report.unknownReferences.length
      ? report.unknownReferences.map(
          (reference) =>
            `${reference.id} — referenced by ${reference.cases.map((item) => item.id).join(", ")}`,
        )
      : ["none"]),
    "",
    "duplicate definitions:",
    ...(report.duplicateDefinitions.length
      ? report.duplicateDefinitions.map(
          (duplicate) =>
            `${duplicate.id} — ${duplicate.definitions.map(location).join(", ")}`,
        )
      : ["none"]),
    "",
    "note\tcoverage records exercised claims; it does not prove live behavior passes",
  ].join("\n");
}

if (import.meta.main) {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      root: { type: "string", default: process.cwd() },
      spec: { type: "string", multiple: true },
      "eval-root": { type: "string", multiple: true },
      json: { type: "boolean", default: false },
      strict: { type: "boolean", default: false },
    },
  });
  const root = resolve(values.root!);
  const report = await scanInvariantCoverage({
    root,
    specInputs: values.spec ?? [join(root, "docs", "specs")],
    evalInputs: values["eval-root"] ?? [join(root, "plugins")],
  });
  console.log(
    values.json
      ? JSON.stringify(report, null, 2)
      : renderCoverageReport(report),
  );
  if (!report.valid || (values.strict && !report.strictValid))
    process.exitCode = 1;
}
