import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import type { AssessmentReaders } from "./assessment-readers";

type Row = Record<string, unknown>;
type Status = "passed" | "failed" | "unavailable";
class Conflict extends Error {}
type Capture = { root: string; files: Map<string, string> };
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("missing native object");
  return value as Row;
}
function lines(text: string): Row[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => row(JSON.parse(line)));
}
function blocks(event: Row): Row[] {
  const content = row(event.message).content;
  return Array.isArray(content) ? content.map(row) : [];
}
function capture(text: string | null): Capture {
  if (text === null) throw new Error("missing bundle");
  const bundle = row(JSON.parse(text));
  if (
    bundle.host !== "claude" ||
    bundle.role !== "candidate" ||
    bundle.completeness !== "complete" ||
    !Array.isArray(bundle.issues) ||
    bundle.issues.length ||
    typeof bundle.rootSessionId !== "string" ||
    !bundle.rootSessionId ||
    !["sevro.native-transcripts.v1", "sevro.native-transcripts.v2"].includes(
      String(bundle.format),
    )
  )
    throw new Error("incomplete native capture");
  return { root: bundle.rootSessionId, files: files(bundle) };
}
function safeName(file: Row, existing: Map<string, string>): string {
  const name = file.path;
  if (
    typeof name !== "string" ||
    name.startsWith("/") ||
    name.includes("\\") ||
    name.split("/").some((part) => !part || part === "..") ||
    existing.has(name)
  )
    throw new Error("unsafe or duplicate native path");
  return name;
}
function nativeBytes(file: Row, format: unknown, remaining: number): Buffer {
  const compressed = format === "sevro.native-transcripts.v2";
  const field = compressed ? file.gzipBase64 : file.bytesBase64;
  if (typeof field !== "string") throw new Error("missing native bytes");
  const encoded = Buffer.from(field, "base64");
  const bytes = compressed
    ? gunzipSync(encoded, { maxOutputLength: remaining })
    : encoded;
  if (
    bytes.length > remaining ||
    createHash("sha256").update(bytes).digest("hex") !== file.sha256
  )
    throw new Error("native bytes do not match capture");
  return bytes;
}
function files(bundle: Row): Map<string, string> {
  if (!Array.isArray(bundle.files) || bundle.files.length > 4096)
    throw new Error("invalid native files");
  const result = new Map<string, string>();
  let remaining = 5 * 1024 * 1024;
  for (const value of bundle.files) {
    const file = row(value),
      name = safeName(file, result),
      bytes = nativeBytes(file, bundle.format, remaining);
    remaining -= bytes.length;
    result.set(name, new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }
  return result;
}
function one<T>(values: T[]): T {
  if (values.length !== 1) throw new Error("unbound native identity");
  return values[0]!;
}
type Child = { id: string; parent?: string; route: [string, string] };
function child(native: Capture, call: Row): Child {
  const entries = [...native.files].filter(
    ([name, text]) =>
      name.endsWith(".meta.json") &&
      row(JSON.parse(text)).toolUseId === call.toolUseId,
  );
  const [name, text] = one(entries),
    meta = row(JSON.parse(text));
  const id = /\/agent-([A-Za-z0-9]+)\.meta\.json$/.exec(name)?.[1];
  if (
    !id ||
    !name.includes("/" + native.root + "/subagents/") ||
    meta.finished !== true ||
    meta.requestShape !== "foreground"
  )
    throw new Error("incomplete native child");
  if (meta.agentType !== call.subagentType)
    throw new Conflict("conflicting native agent type");
  const transcript = native.files.get(name.replace(/\.meta\.json$/, ".jsonl"));
  if (!transcript) throw new Error("missing native child transcript");
  const observations = childObservations(transcript, id, native.root);
  return {
    id,
    parent:
      typeof meta.parentAgentId === "string" ? meta.parentAgentId : undefined,
    route: observedRoute(observations),
  };
}
function childObservations(
  transcript: string,
  id: string,
  root: string,
): Row[] {
  const observations = lines(transcript).filter(
    (event) => event.type === "assistant",
  );
  if (
    !observations.length ||
    observations.some(
      (event) => event.agentId !== id || event.sessionId !== root,
    )
  )
    throw new Error("unbound native child observations");
  return observations;
}
function observedRoute(observations: Row[]): [string, string] {
  const routes = observations.map((event) => [
    row(event.message).model,
    event.effort,
  ]);
  if (
    routes.some((route) =>
      route.some((value) => typeof value !== "string" || !value),
    )
  )
    throw new Error("missing effective native route");
  const unique = [...new Set(routes.map((route) => JSON.stringify(route)))];
  if (unique.length !== 1) throw new Conflict("conflicting effective route");
  return JSON.parse(unique[0]!) as [string, string];
}

function result(event: Row): boolean {
  const content = event.content;
  return (
    event.type === "tool_result" &&
    event.is_error !== true &&
    (typeof content === "string"
      ? !!content.trim()
      : Array.isArray(content) && content.length > 0)
  );
}
function bound(
  events: Row[],
  call: Row,
  returned: boolean,
): { block: Row; index: number; batch: string } {
  const matches = events.flatMap((event, index) => {
    if (
      event.type !== (returned ? "user" : "assistant") ||
      (event.parent_tool_use_id ?? null) !== (call.parentToolUseId ?? null)
    )
      return [];
    return blocks(event)
      .filter((block) =>
        returned
          ? block.tool_use_id === call.toolUseId
          : block.id === call.toolUseId,
      )
      .map((block) => ({
        block,
        index,
        batch: String(row(event.message).id ?? ""),
      }));
  });
  return one(matches);
}
type ReaderContext = {
  events: Row[];
  native: Capture;
  expected: AssessmentReaders;
  parent?: string;
};
function pinned(call: Row, input: Row, agent: string): boolean {
  return (
    call.subagentType === agent &&
    call.runInBackground === false &&
    call.model === null &&
    !input.resume &&
    input.run_in_background === false &&
    input.subagent_type === agent
  );
}
function selectedRoute(
  observed: Child,
  selected: NonNullable<AssessmentReaders["claude"]>,
): boolean {
  return (
    selected.model === undefined ||
    (observed.route[0] === selected.model &&
      observed.route[1] === selected.effort)
  );
}
function reader(
  call: Row,
  context: ReaderContext,
): { status: Status; axis: string; batch: string } {
  const { events, native, expected, parent } = context,
    selected = expected.claude!;
  const use = bound(events, call, false),
    end = bound(events, call, true),
    input = row(use.block.input);
  if (!pinned(call, input, selected.agent))
    return { status: "failed", axis: "", batch: "" };
  const axes = [
    ...String(input.prompt).matchAll(/^- review_axis: (standards|spec)\s*$/gm),
  ].map((match) => match[1]!);
  if (
    !use.batch ||
    end.index <= use.index ||
    !result(end.block) ||
    axes.length !== 1
  )
    throw new Error("incomplete reader judgment");
  const observed = child(native, call);
  const matches =
    observed.parent === parent && selectedRoute(observed, selected);
  return {
    status: matches ? "passed" : "failed",
    axis: axes[0]!,
    batch: use.batch,
  };
}
function coordinator(
  tools: Row[],
  native: Capture,
  placement: string,
): { readers: Row[]; parent?: string } {
  const agents = tools.filter((tool) => tool.name === "Agent"),
    parents = agents.filter((tool) => tool.actor === "parent");
  if (placement === "inline") return { readers: parents };
  if (parents.length > 1) throw new Conflict("wrong fallback placement");
  const owner = one(parents),
    observed = child(native, owner);
  if (
    ![
      "darrow-review:assessment-coordinator-sonnet-5-5-medium",
      "darrow-verification:assessment-coordinator-sonnet-5-5-medium",
    ].includes(String(owner.subagentType)) ||
    owner.runInBackground !== false ||
    owner.model !== null ||
    observed.parent !== undefined ||
    observed.route[0] !== "claude-sonnet-5-5" ||
    observed.route[1] !== "medium"
  )
    throw new Conflict("unsupported native coordinator");
  return {
    readers: agents.filter((tool) => tool.parentToolUseId === owner.toolUseId),
    parent: observed.id,
  };
}
function completedEvents(text: string): Row[] {
  const events = lines(text),
    terminal = one(
      events.filter(
        (event) => event.type === "result" && !event.parent_tool_use_id,
      ),
    );
  if (terminal.subtype !== "success" || terminal.is_error !== false)
    throw new Error("incomplete host execution");
  return events;
}
function readerSet(
  facts: { status: Status; axis: string; batch: string }[],
  expected: AssessmentReaders,
): Status {
  if (facts.some((fact) => fact.status === "failed")) return "failed";
  return new Set(facts.map((fact) => fact.batch)).size === 1 &&
    JSON.stringify(facts.map((fact) => fact.axis).sort()) ===
      JSON.stringify([...expected.axes].sort())
    ? "passed"
    : "failed";
}
// Whole-artifact digest is checked by the caller; file digests and native route bindings are checked here.
export function claudeAssessmentReaders(
  expected: AssessmentReaders,
  tools: Row[] | null,
  text: string | null,
  bundle: string | null = null,
): Status {
  if (!tools || text === null || !expected.claude) return "unavailable";
  try {
    const events = completedEvents(text);
    const native = capture(bundle),
      placed = coordinator(tools, native, expected.placement);
    if (placed.readers.length !== expected.axes.length) return "failed";
    const facts = placed.readers.map((call) =>
      reader(call, { events, native, expected, parent: placed.parent }),
    );
    return readerSet(facts, expected);
  } catch (error) {
    return error instanceof Conflict ? "failed" : "unavailable";
  }
}
