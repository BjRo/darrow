import { isAbsolute, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  literalExecutorCommand,
  type LiteralExecutorCommand,
} from "./codex-executor-command";

interface NativeEntry {
  ordinal: number;
  payload: Record<string, unknown>;
}

interface YieldedChunk {
  process: string;
  id: string;
  output: string;
}

export interface RecoveredCommandOutput {
  output: string;
  chunks: number;
  completedCall?: boolean;
  literalCommandCall?: boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function processId(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return /^(?:[1-9][0-9]*)$/.test(String(value)) ? String(value) : undefined;
}

function yieldedChunk(
  value: Record<string, unknown>,
): YieldedChunk | undefined {
  const process = processId(value.session_id);
  if (!process || value.exit_code != null || typeof value.output !== "string")
    return undefined;
  if (
    typeof value.chunk_id !== "string" ||
    !/^[\w-]{1,64}$/.test(value.chunk_id)
  )
    return undefined;
  if (
    typeof value.wall_time_seconds !== "number" ||
    !Number.isFinite(value.wall_time_seconds) ||
    value.wall_time_seconds < 0
  )
    return undefined;
  return { process, id: value.chunk_id, output: value.output };
}

// Decode only host result/content envelopes, never arbitrary object properties,
// prose containing JSON, or JSON printed inside a command's output.
function resultChunks(value: unknown, depth = 0): YieldedChunk[] {
  if (depth > 6) return [];
  if (typeof value === "string") {
    try {
      return resultChunks(JSON.parse(value), depth + 1);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value))
    return value.flatMap((part) => resultChunks(part, depth + 1));
  if (!record(value)) return [];
  if (value.type === "input_text" || value.type === "text")
    return resultChunks(value.text, depth + 1);
  const chunk = yieldedChunk(value);
  return chunk ? [chunk] : [];
}

function execCall(payload: Record<string, unknown>): boolean {
  if (payload.type !== "custom_tool_call" && payload.type !== "function_call")
    return false;
  const namespace = payload.namespace;
  if (namespace !== undefined && namespace !== "functions") return false;
  const names = [
    "exec",
    "exec_command",
    "write_stdin",
    "functions.exec",
    "functions.exec_command",
    "functions.write_stdin",
  ];
  return typeof payload.name === "string" && names.includes(payload.name);
}

function chunksAtEntry(
  entry: NativeEntry,
  entries: NativeEntry[],
): YieldedChunk[] {
  const { payload, ordinal } = entry;
  if (
    payload.type !== "custom_tool_call_output" &&
    payload.type !== "function_call_output"
  )
    return [];
  if (typeof payload.call_id !== "string") return [];
  const calls = entries.filter(
    (other) =>
      execCall(other.payload) && other.payload.call_id === payload.call_id,
  );
  if (calls.length !== 1 || calls[0]!.ordinal >= ordinal) return [];
  return resultChunks(payload.output);
}

function commandProcess(entry: NativeEntry): string | undefined {
  const { payload } = entry;
  if (payload.type !== "item_completed" || !record(payload.item))
    return undefined;
  if (
    payload.item.type !== "CommandExecution" ||
    payload.item.source !== "unified_exec_startup"
  )
    return undefined;
  return processId(payload.item.process_id);
}

function executorTextBlocks(value: unknown): string[] | undefined {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const text: string[] = [];
  for (const block of value) {
    if (
      !record(block) ||
      !["input_text", "text"].includes(String(block.type)) ||
      typeof block.text !== "string"
    )
      return undefined;
    text.push(block.text);
  }
  return text;
}

function structuredExecResult(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return record(value) && ("output" in value || "session_id" in value);
  } catch {
    return false;
  }
}

function completedText(value: unknown): string | undefined {
  const text = executorTextBlocks(value);
  if (!text) return undefined;
  if (
    !/^Script completed\nWall time [0-9]+(?:\.[0-9]+)? seconds\nOutput:\n$/.test(
      text[0]!,
    )
  )
    return undefined;
  const content = text.slice(1);
  // Structured exec chunks keep their process-identity rules above. Do not
  // reinterpret a late yielded chunk as a plain completed-call result.
  return content.some(structuredExecResult) ? undefined : content.join("\n");
}

function uniqueExecutorCall(
  result: NativeEntry,
  results: NativeEntry[],
  entries: NativeEntry[],
): NativeEntry | undefined {
  const id = result.payload.call_id;
  if (
    typeof id !== "string" ||
    results.filter((other) => other.payload.call_id === id).length !== 1
  )
    return undefined;
  const calls = entries.filter(
    (entry) => execCall(entry.payload) && entry.payload.call_id === id,
  );
  return calls.length === 1 && calls[0]!.ordinal < result.ordinal
    ? calls[0]
    : undefined;
}

function uniqueCommandIdentity(
  command: NativeEntry,
  entries: NativeEntry[],
): boolean {
  const process = commandProcess(command);
  if (
    !process ||
    entries.filter((entry) => commandProcess(entry) === process).length !== 1
  )
    return false;
  const item = command.payload.item as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    entries.filter(
      ({ payload }) =>
        payload.type === "item_completed" &&
        record(payload.item) &&
        payload.item.id === item.id,
    ).length === 1
  );
}

function soleCompletedCommand(
  call: NativeEntry,
  result: NativeEntry,
  entries: NativeEntry[],
): NativeEntry | undefined {
  const between = entries.filter(
    (entry) => entry.ordinal > call.ordinal && entry.ordinal < result.ordinal,
  );
  if (
    between.some(({ payload }) =>
      ["custom_tool_call", "function_call"].includes(String(payload.type)),
    )
  )
    return undefined;
  const commands = between.filter(
    ({ payload }) =>
      payload.type === "item_completed" &&
      record(payload.item) &&
      payload.item.type === "CommandExecution",
  );
  return commands.length === 1 && uniqueCommandIdentity(commands[0]!, entries)
    ? commands[0]
    : undefined;
}

function completedCallOutputs(entries: NativeEntry[]): Map<number, string> {
  const outputs = new Map<number, string>();
  const results = entries.filter(({ payload }) =>
    ["custom_tool_call_output", "function_call_output"].includes(
      String(payload.type),
    ),
  );
  for (const result of results) {
    const call = uniqueExecutorCall(result, results, entries);
    if (!call) continue;
    const command = soleCompletedCommand(call, result, entries);
    if (!command) continue;
    const item = command.payload.item as Record<string, unknown>;
    const output = completedText(result.payload.output);
    if (
      output !== undefined &&
      !(
        typeof item.aggregated_output === "string" &&
        item.aggregated_output.includes(output)
      )
    )
      outputs.set(command.ordinal, output);
  }
  return outputs;
}

function literalCommandMatches(
  item: Record<string, unknown>,
  command: LiteralExecutorCommand,
): boolean {
  const argv = item.command;
  if (
    !Array.isArray(argv) ||
    argv.length !== 3 ||
    !["-c", "-lc"].includes(argv[1]) ||
    argv[2] !== command.command ||
    (command.shell !== undefined && argv[0] !== command.shell)
  )
    return false;
  if (command.cwd === undefined) return true;
  return matchingCwd(item.cwd, command.cwd);
}

function matchingCwd(observed: unknown, requested: string): boolean {
  if (!isAbsolute(requested) || typeof observed !== "string") return false;
  try {
    const cwd = observed.startsWith("file:")
      ? fileURLToPath(observed)
      : observed;
    return isAbsolute(cwd) && normalize(cwd) === normalize(requested);
  } catch {
    return false;
  }
}

function literalCallOutputs(entries: NativeEntry[]): Map<number, string> {
  const outputs = new Map<number, string>();
  const results = entries.filter(({ payload }) =>
    ["custom_tool_call_output", "function_call_output"].includes(
      String(payload.type),
    ),
  );
  for (const result of results) {
    const output = completedText(result.payload.output);
    if (output === undefined) continue;
    const call = uniqueExecutorCall(result, results, entries);
    const command = call && literalCallCommand(call.payload);
    if (!call || !command) continue;
    const matches = entries.filter(
      (entry) =>
        commandProcess(entry) &&
        literalCommandMatches(
          entry.payload.item as Record<string, unknown>,
          command,
        ),
    );
    if (
      matches.length !== 1 ||
      matches[0]!.ordinal <= result.ordinal ||
      !uniqueCommandIdentity(matches[0]!, entries)
    )
      continue;
    const sameCalls = entries.filter(
      (entry) =>
        execCall(entry.payload) &&
        literalCallCommand(entry.payload)?.command === command.command,
    );
    if (sameCalls.length !== 1) continue;
    outputs.set(matches[0]!.ordinal, output);
  }
  return outputs;
}

function literalCallCommand(
  payload: Record<string, unknown>,
): LiteralExecutorCommand | undefined {
  if (
    payload.type !== "custom_tool_call" ||
    !["exec", "functions.exec"].includes(String(payload.name))
  )
    return undefined;
  return literalExecutorCommand(payload.input);
}

function mergeLiteralOutputs(
  outputs: Map<number, RecoveredCommandOutput>,
  entries: NativeEntry[],
): void {
  for (const [ordinal, output] of literalCallOutputs(entries)) {
    const earlier = outputs.get(ordinal);
    outputs.set(ordinal, {
      ...earlier,
      output: output + (earlier?.output ?? ""),
      chunks: earlier?.chunks ?? 0,
      literalCommandCall: true,
    });
  }
}

/** Actor-local tool output bound to one native command completion. */
export function nativeCommandOutputs(
  entries: NativeEntry[],
): Map<number, RecoveredCommandOutput> {
  const completions = entries.flatMap((entry) => {
    const process = commandProcess(entry);
    return process ? [{ process, entry }] : [];
  });
  const chunks = entries.flatMap((entry) =>
    chunksAtEntry(entry, entries).map((chunk) => ({
      ...chunk,
      ordinal: entry.ordinal,
    })),
  );
  const outputs = new Map<number, RecoveredCommandOutput>();
  for (const { process, entry } of completions) {
    // A reused or duplicated process identifier cannot bind a result uniquely.
    if (completions.filter((other) => other.process === process).length !== 1)
      continue;
    const earlier = chunks
      .filter(
        (chunk) => chunk.process === process && chunk.ordinal < entry.ordinal,
      )
      .sort((a, b) => a.ordinal - b.ordinal);
    if (
      !earlier.length ||
      new Set(earlier.map((chunk) => chunk.id)).size !== earlier.length
    )
      continue;
    outputs.set(entry.ordinal, {
      output: earlier.map((chunk) => chunk.output).join(""),
      chunks: earlier.length,
    });
  }
  for (const [ordinal, output] of completedCallOutputs(entries)) {
    const earlier = outputs.get(ordinal);
    outputs.set(ordinal, {
      output: (earlier?.output ?? "") + output,
      chunks: earlier?.chunks ?? 0,
      completedCall: true,
    });
  }
  mergeLiteralOutputs(outputs, entries);
  return outputs;
}
