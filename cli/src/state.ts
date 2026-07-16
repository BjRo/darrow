import { resolve } from "node:path";
import { appendLine, readJson, replaceJson } from "./io";
import { validateSchema } from "./schema";
import type { RunRecord } from "./types";

export async function readRun(runDir: string): Promise<RunRecord> {
  const record = await readJson<RunRecord>(resolve(runDir, "run.json"));
  await validateSchema("run.schema.json", record, "run record");
  return record;
}

export async function saveRun(
  runDir: string,
  record: RunRecord,
): Promise<void> {
  record.updatedAt = new Date().toISOString();
  await validateSchema("run.schema.json", record, "run record");
  await replaceJson(resolve(runDir, "run.json"), record);
}

export async function event(
  runDir: string,
  runId: string,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const item = {
    schemaVersion: "0.1.0",
    eventId: crypto.randomUUID(),
    runId,
    timestamp: new Date().toISOString(),
    type,
    data,
  };
  await validateSchema("event.schema.json", item, `event ${type}`);
  await appendLine(resolve(runDir, "events.jsonl"), JSON.stringify(item));
}
