import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { HARNESSES, TREATMENTS, type Corpus, type Protocol } from "./types";

export const SUITE_ROOT = resolve(import.meta.dir, "..");
export const REPO_ROOT = resolve(SUITE_ROOT, "..", "..");

export async function loadProtocol(
  path = resolve(SUITE_ROOT, "protocol.yaml"),
): Promise<Protocol> {
  const value = parseYaml(await readFile(path, "utf8")) as Protocol;
  if (value.schemaVersion !== "1.0.0")
    throw new Error(`unsupported protocol schema: ${value.schemaVersion}`);
  if (
    value.treatments.length !== TREATMENTS.length ||
    TREATMENTS.some((t) => !value.treatments.includes(t))
  )
    throw new Error("protocol must contain each treatment exactly once");
  for (const harness of HARNESSES) {
    const route = value.harnesses[harness];
    if (!route?.executable || !route.version || !route.model || !route.effort)
      throw new Error(`protocol route is incomplete: ${harness}`);
  }
  if (!Number.isSafeInteger(value.repeats) || value.repeats < 2)
    throw new Error("protocol repeats must be an integer >= 2");
  return value;
}

export async function loadCorpus(
  path = resolve(SUITE_ROOT, "corpus.yaml"),
): Promise<Corpus> {
  const value = parseYaml(await readFile(path, "utf8"), {
    merge: true,
  }) as Corpus;
  if (value.schemaVersion !== "1.0.0")
    throw new Error(`unsupported corpus schema: ${value.schemaVersion}`);
  const repos = new Set(value.repositories.map((r) => r.id));
  const ids = new Set<string>();
  for (const task of value.tasks) {
    if (ids.has(task.id)) throw new Error(`duplicate task id: ${task.id}`);
    ids.add(task.id);
    if (!repos.has(task.repository))
      throw new Error(`task ${task.id} names unknown repository`);
    if (!task.prompt.trim() || !task.verificationCommand.trim())
      throw new Error(`task ${task.id} is incomplete`);
    if (task.grading !== "deterministic" && task.grading !== "mixed")
      throw new Error(`task ${task.id} has invalid grading mode`);
    if (!task.rubric.length) throw new Error(`task ${task.id} has no rubric`);
  }
  return value;
}

export function parseSourceArgs(values: string[]): Map<string, string> {
  const sources = new Map<string, string>();
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator < 1) throw new Error(`invalid --source: ${value}`);
    sources.set(value.slice(0, separator), resolve(value.slice(separator + 1)));
  }
  return sources;
}
