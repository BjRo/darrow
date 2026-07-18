import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Observation } from "./types";

interface Annotation {
  runId: string;
  humanAttentionMinutes: number;
  interventions: number;
  retries: number;
  recovered: boolean;
  reworkCount: number;
  note: string;
}

export async function importAnnotations(
  resultsRoot: string,
  annotationsPath: string,
): Promise<{ observations: number }> {
  const rows = (await readFile(annotationsPath, "utf8"))
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Annotation);
  if (new Set(rows.map((row) => row.runId)).size !== rows.length)
    throw new Error("annotation file contains duplicate run IDs");
  for (const row of rows) {
    if (
      !Number.isFinite(row.humanAttentionMinutes) ||
      row.humanAttentionMinutes < 0 ||
      !Number.isSafeInteger(row.interventions) ||
      row.interventions < 0 ||
      !Number.isSafeInteger(row.retries) ||
      row.retries < 0 ||
      !Number.isSafeInteger(row.reworkCount) ||
      row.reworkCount < 0 ||
      typeof row.recovered !== "boolean" ||
      typeof row.note !== "string"
    )
      throw new Error(`invalid annotation: ${row.runId}`);
    const path = join(resultsRoot, "runs", row.runId, "observation.json");
    if (!(await Bun.file(path).exists()))
      throw new Error(`unknown run: ${row.runId}`);
    const observation: Observation & { operatorNote?: string } = JSON.parse(
      await readFile(path, "utf8"),
    );
    observation.humanAttentionMinutes = row.humanAttentionMinutes;
    observation.interventions = row.interventions;
    observation.retries = row.retries;
    observation.recovered = row.recovered;
    observation.reworkCount = row.reworkCount;
    observation.operatorNote = row.note;
    await writeFile(path, JSON.stringify(observation, null, 2) + "\n");
  }
  return { observations: rows.length };
}
