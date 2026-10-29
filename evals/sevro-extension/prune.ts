import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parseArgs } from "node:util";
import { retentionTransaction } from "./retention-lock";

function duration(value: string | undefined) {
  if (value === undefined) return null;
  const match = /^(\d+(?:\.\d+)?)([smhdwy])$/.exec(value);
  const units: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000,
    y: 31536000000,
  };
  const milliseconds = match ? Number(match[1]) * units[match[2]!]! : NaN;
  if (
    !Number.isFinite(milliseconds) ||
    milliseconds <= 0 ||
    milliseconds > Number.MAX_SAFE_INTEGER
  )
    throw new Error(
      "duration must be a positive finite number with s, m, h, d, w, or y",
    );
  return milliseconds;
}
function record(path: string): Record<string, unknown> {
  if (!lstatSync(path).isFile())
    throw new Error("metadata must be a regular file");
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid metadata");
  return value;
}
function contained(root: string, path: string) {
  const part = relative(root, path);
  return (
    part !== "" &&
    !part.startsWith(`..${sep}`) &&
    part !== ".." &&
    !isAbsolute(part)
  );
}
function safeTree(path: string) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
    throw new Error("symlink or unsupported file in attempt");
  let modified = stat.mtimeMs;
  if (stat.isDirectory())
    for (const name of readdirSync(path))
      modified = Math.max(modified, safeTree(join(path, name)));
  return modified;
}
function references(value: unknown, root: string) {
  if (typeof value === "string" && isAbsolute(value) && !contained(root, value))
    throw new Error("external evidence reference");
  if (Array.isArray(value)) for (const entry of value) references(entry, root);
  else if (value && typeof value === "object")
    for (const entry of Object.values(value)) references(entry, root);
}
function absoluteReferences(value: unknown): string[] {
  if (typeof value === "string") return isAbsolute(value) ? [value] : [];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(absoluteReferences);
}
function publication(path: string, legacyModified: number) {
  if (!existsSync(join(path, "retention.json"))) return legacyModified;
  const metadata = record(join(path, "retention.json"));
  if (metadata.format !== "darrow-retention-v1")
    throw new Error("unsupported retention metadata");
  if (!["completed", "failed", "interrupted"].includes(String(metadata.status)))
    throw new Error("active or unknown publication state");
  if (metadata.outputPath !== null)
    throw new Error("exported output pins attempt");
  const published =
    typeof metadata.publishedAt === "string"
      ? Date.parse(metadata.publishedAt)
      : NaN;
  if (
    !Number.isFinite(published) ||
    new Date(published).toISOString() !== metadata.publishedAt
  )
    throw new Error("invalid publication timestamp");
  return published;
}
function ownedManifest(path: string, root: string) {
  const manifest = record(join(path, "selection-run.json"));
  if (
    manifest.format !== "darrow-sevro-selection-v1" ||
    manifest.attemptId !== basename(path) ||
    manifest.resultsRoot !== root ||
    manifest.manifestPath !== join(path, "selection-run.json") ||
    !Array.isArray(manifest.caseIds) ||
    !Array.isArray(manifest.runs) ||
    typeof manifest.interrupted !== "boolean"
  )
    throw new Error("invalid attempt ownership");
  references(manifest.runs, path);
}
function eligibility(
  path: string,
  root: string,
  age: number | null,
  now: number,
) {
  const modified = safeTree(path);
  const published = publication(path, modified);
  ownedManifest(path, root);
  if (age !== null && published >= now - age)
    return "attempt is not older than cutoff";
  return null;
}
function request() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "results-root": { type: "string" },
      "older-than": { type: "string" },
      apply: { type: "boolean" },
    },
  });
  const age = duration(values["older-than"]);
  const now = Date.now();
  const resultsRoot = resolve(values["results-root"] ?? "evals/results");
  return { resultsRoot, age, now, apply: values.apply ?? false };
}
type Request = ReturnType<typeof request>;
type Plan = { remove: string[]; preserve: { path: string; reason: string }[] };
function directory(path: string) {
  if (
    existsSync(path) &&
    (!lstatSync(path).isDirectory() || lstatSync(path).isSymbolicLink())
  )
    throw new Error(`${path} must be a real directory`);
}
function pinnedAttempts(attempts: string, ids: string[]) {
  const pinned = new Set<string>();
  for (const id of ids) {
    const source = join(attempts, id);
    if (lstatSync(source).isSymbolicLink()) continue;
    const path = join(source, "selection-run.json");
    if (!existsSync(path)) continue;
    const refs = absoluteReferences(record(path).runs);
    for (const other of ids) {
      const target = join(attempts, other);
      if (
        other !== id &&
        refs.some((ref) => ref === target || contained(target, ref))
      )
        pinned.add(target);
    }
  }
  return pinned;
}
function selectAttempt(
  path: string,
  input: Request,
  protection: { pinned: Set<string>; campaign: boolean },
  plan: Plan,
) {
  try {
    const reason = protection.campaign
      ? "suite campaign evidence is outside selection retention"
      : protection.pinned.has(path)
        ? "referenced by another retained attempt"
        : eligibility(path, input.resultsRoot, input.age, input.now);
    if (reason) plan.preserve.push({ path, reason });
    else plan.remove.push(path);
  } catch (error) {
    plan.preserve.push({
      path,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
function selectionAlias(
  resultsRoot: string,
  attempts: string,
  remove: string[],
) {
  const alias = join(resultsRoot, "selection-run.json");
  if (existsSync(alias)) {
    const manifest = record(alias);
    if (
      typeof manifest.attemptId !== "string" ||
      manifest.manifestPath !==
        join(attempts, manifest.attemptId, "selection-run.json")
    )
      throw new Error("invalid root selection alias");
    if (
      readFileSync(alias, "utf8") !==
      readFileSync(String(manifest.manifestPath), "utf8")
    )
      throw new Error("root alias differs from attempt manifest");
    if (remove.includes(join(attempts, manifest.attemptId))) {
      remove.push(alias);
    }
  }
}
function execute(input: Request) {
  const { resultsRoot, age, now, apply } = input;
  const attempts = join(resultsRoot, "attempts");
  directory(attempts);
  const ids = existsSync(attempts) ? readdirSync(attempts).sort() : [];
  const pinned = pinnedAttempts(attempts, ids);
  const campaign = existsSync(join(resultsRoot, "suite-run.json"));
  const plan: Plan = { remove: [], preserve: [] };
  for (const id of ids)
    selectAttempt(join(attempts, id), input, { pinned, campaign }, plan);
  selectionAlias(resultsRoot, attempts, plan.remove);
  console.log(
    JSON.stringify({
      resultsRoot,
      apply,
      cutoff: age === null ? null : new Date(now - age).toISOString(),
      ...plan,
    }),
  );
  if (apply)
    for (const path of [...plan.remove].reverse())
      rmSync(path, { recursive: true });
}
function main() {
  const input = request();
  directory(input.resultsRoot);
  if (existsSync(input.resultsRoot))
    retentionTransaction(input.resultsRoot, () => execute(input));
  else execute(input);
}
try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
