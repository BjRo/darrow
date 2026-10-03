import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Malformed native session record");
  return value as RecordValue;
}
function records(text: string): RecordValue[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => record(JSON.parse(line)));
}

function goalAttachment(event: RecordValue) {
  if (event.isSidechain === true || event.type !== "attachment") return [];
  const attachment = record(event.attachment);
  if (attachment.type !== "goal_status") return [];
  const characters =
    typeof attachment.condition === "string"
      ? [...attachment.condition].length
      : 0;
  if (!characters || characters > 4000 || typeof attachment.met !== "boolean")
    throw new Error("Malformed native goal attachment");
  return [
    { status: attachmentStatus(attachment), characters, at: event.timestamp },
  ];
}

function attachmentStatus(attachment: RecordValue): string {
  if (attachment.failed === true) return "blocked";
  if (!attachment.met) return "active";
  return attachment.sentinel === true ? "cleared" : "complete";
}

function requireSuccessfulResult(stream: string, sessionId: string): void {
  const result = records(stream)
    .filter((event) => event.type === "result")
    .at(-1);
  if (
    !result ||
    result.session_id !== sessionId ||
    result.subtype !== "success" ||
    result.is_error !== false
  )
    throw new Error("Native session did not finish successfully");
}

/** Claude's native persisted goal attachments; sentinel clearance is not success. */
export function claudeNativeGoalEvidence(
  stream: string,
  transcript: string,
  sessionId: string,
) {
  const events = records(transcript);
  for (const event of events) {
    if (event.sessionId && event.sessionId !== sessionId)
      throw new Error("Foreign native session record");
  }
  if (!events.some((event) => event.sessionId === sessionId))
    throw new Error("Original native session not retained");
  requireSuccessfulResult(stream, sessionId);
  const goals = events.flatMap(goalAttachment);
  return {
    type: "darrow.eval.claude_native_goal",
    threadId: sessionId,
    goals,
    goalStatus: goals.at(-1)?.status ?? null,
  };
}

async function sessionPaths(
  path: string,
  sessionId: string,
): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? sessionPaths(join(path, entry.name), sessionId)
          : basename(entry.name) === `${sessionId}.jsonl`
            ? [join(path, entry.name)]
            : [],
      ),
    )
  ).flat();
}

/** Read only this trial's original native session; never manufacture a goal. */
export async function observeClaudeNativeGoal(
  configRoot: string,
  stream: string,
): Promise<string> {
  try {
    const initializations = records(stream).filter(
      (event) => event.type === "system" && event.subtype === "init",
    );
    const ids = new Set(initializations.map((event) => event.session_id));
    const id = [...ids][0];
    if (
      ids.size !== 1 ||
      typeof id !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(id)
    )
      throw new Error("Missing or ambiguous original Claude session");
    const paths = await sessionPaths(join(configRoot, "projects"), id);
    if (paths.length !== 1)
      throw new Error("Missing or ambiguous native transcript");
    return JSON.stringify(
      claudeNativeGoalEvidence(stream, await readFile(paths[0]!, "utf8"), id),
    );
  } catch (error) {
    return JSON.stringify({
      type: "darrow.eval.claude_native_goal",
      failure:
        error instanceof Error
          ? error.message
          : "Native observation unavailable",
    });
  }
}
