import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import {
  oneRow as row,
  oneValue as value,
  parseRecords,
} from "./review-records";

type JsonObject = Record<string, unknown>;
type JsonEntry = { line: number; value: JsonObject };

export type ClaudeReviewProofOptions = {
  parent: string;
  artifactDir: string;
  output?: string;
};

type Route = { host: string; provider: string; model: string; effort: string };
type Axis = "standards" | "spec";
type AxisRecords = {
  axis: Axis;
  agentId: string;
  transcript: string;
  transcriptHash: string;
};
type ToolResultInput = {
  entries: JsonEntry[];
  axis: Axis;
  toolUseId: string;
  toolCallLine: number;
  records: AxisRecords;
  route: Route;
};

const object = (value: unknown, label: string): JsonObject => {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  return value as JsonObject;
};

const string = (value: unknown, label: string): string => {
  if (typeof value !== "string" || !value)
    throw new Error(`${label} must be a non-empty string`);
  return value;
};

function jsonLines(content: string, label: string): JsonEntry[] {
  return content
    .split("\n")
    .filter(Boolean)
    .map((line, index) => ({
      line: index + 1,
      value: object(JSON.parse(line), `${label} line ${index + 1}`),
    }));
}

function selectedRoute(content: string): Route {
  const selected = row(parseRecords(content), "selected_route");
  if (selected.length !== 4 || selected.some((field) => !field))
    throw new Error("selected_route must contain four fields");
  const [host, provider, model, effort] = selected as [
    string,
    string,
    string,
    string,
  ];
  if (host !== "claude" || provider !== "anthropic")
    throw new Error("native Claude proof requires claude/anthropic");
  return { host, provider, model, effort };
}

function sameRoute(rows: Map<string, string[][]>, key: string, route: Route) {
  const expected = [route.host, route.provider, route.model, route.effort];
  if (JSON.stringify(row(rows, key)) !== JSON.stringify(expected))
    throw new Error(`${key} does not match the selected route`);
}

function verifyChildTranscript(
  content: string,
  axis: Axis,
  agentId: string,
  route: Route,
) {
  const assistant = jsonLines(content, `${axis} transcript`).filter(
    (entry) => entry.value.type === "assistant",
  );
  if (!assistant.length)
    throw new Error(`${axis} transcript has no assistant turn`);
  for (const entry of assistant) {
    const message = object(entry.value.message, `${axis} child message`);
    if (
      entry.value.agentId !== agentId ||
      entry.value.effort !== route.effort ||
      message.model !== route.model ||
      message.role !== "assistant"
    )
      throw new Error(
        `${axis} transcript route does not match the selected route`,
      );
  }
}

async function axisRecords(
  artifactDir: string,
  axis: Axis,
  route: Route,
): Promise<AxisRecords> {
  const [observedText, applicationText] = await Promise.all([
    readFile(join(artifactDir, `${axis}-observed-route.json`), "utf8"),
    readFile(join(artifactDir, `${axis}-route.json`), "utf8"),
  ]);
  const observed = parseRecords(observedText);
  const application = parseRecords(applicationText);
  sameRoute(observed, "observed_route", route);
  sameRoute(application, "selected_route", route);
  sameRoute(application, "observed_route", route);
  if (
    value(observed, "provider_evidence") !==
      "current-host-environment-default" ||
    value(application, "provider_evidence") !==
      "current-host-environment-default"
  )
    throw new Error(`${axis} provider evidence is not native-host observed`);
  if (
    value(application, "axis") !== axis ||
    value(application, "route_bound") !== "true"
  )
    throw new Error(`${axis} application record is not bound`);
  const agentId = value(observed, "agent_id");
  if (value(application, "agent_id") !== agentId)
    throw new Error(`${axis} application and observed child IDs differ`);
  const transcript = value(observed, "transcript");
  if (
    !isAbsolute(transcript) ||
    basename(transcript) !== `agent-${agentId}.jsonl`
  )
    throw new Error(`${axis} transcript path does not bind the child ID`);
  const transcriptText = await readFile(transcript, "utf8");
  verifyChildTranscript(transcriptText, axis, agentId, route);
  return {
    axis,
    agentId,
    transcript,
    transcriptHash: createHash("sha256").update(transcriptText).digest("hex"),
  };
}

function agentBlocks(entries: JsonEntry[]) {
  return entries.flatMap((entry) => {
    if (entry.value.type !== "assistant") return [];
    const message = object(
      entry.value.message,
      `parent line ${entry.line} message`,
    );
    const content = Array.isArray(message.content) ? message.content : [];
    return content.flatMap((candidate) => {
      const block = object(candidate, `parent line ${entry.line} content`);
      return block.type === "tool_use" && block.name === "Agent"
        ? [{ entry, message, block }]
        : [];
    });
  });
}

function toolCall(entries: JsonEntry[], axis: Axis, route: Route) {
  const expectedType = `darrow-review:review-reader-${route.model}-${route.effort}`;
  const calls = agentBlocks(entries).filter(({ block }) => {
    const input = object(block.input, `${axis} Agent input`);
    const prompt = input.prompt;
    return (
      typeof prompt === "string" &&
      prompt.startsWith(`- review_axis: ${axis}\n`)
    );
  });
  if (calls.length !== 1)
    throw new Error(`expected one ${axis} Agent call, found ${calls.length}`);
  const call = calls[0]!;
  const input = object(call.block.input, `${axis} Agent input`);
  if (
    input.subagent_type !== expectedType ||
    input.run_in_background !== false ||
    Object.hasOwn(input, "model")
  )
    throw new Error(
      `${axis} Agent call does not use the selected foreground tuple`,
    );
  return {
    toolCallLine: call.entry.line,
    messageId: string(call.message.id, `${axis} parent message id`),
    toolUseId: string(call.block.id, `${axis} tool-use id`),
    subagentType: expectedType,
  };
}

function toolResult(input: ToolResultInput) {
  const { entries, axis, toolUseId, toolCallLine, records, route } = input;
  const matches = entries.filter((entry) => {
    if (entry.value.type !== "user") return false;
    const message = object(entry.value.message, `${axis} result message`);
    const content = Array.isArray(message.content) ? message.content : [];
    return content.some((candidate) => {
      const block = object(candidate, `${axis} result block`);
      return block.type === "tool_result" && block.tool_use_id === toolUseId;
    });
  });
  if (matches.length !== 1)
    throw new Error(
      `expected one ${axis} Agent result, found ${matches.length}`,
    );
  const entry = matches[0]!;
  if (entry.line <= toolCallLine)
    throw new Error(`${axis} Agent result precedes its call`);
  const result = object(entry.value.toolUseResult, `${axis} host result`);
  if (
    result.status !== "completed" ||
    result.agentId !== records.agentId ||
    result.resolvedModel !== route.model ||
    result.agentType !==
      `darrow-review:review-reader-${route.model}-${route.effort}`
  )
    throw new Error(`${axis} host result does not bind the selected child`);
  return { hostResultLine: entry.line, agentId: records.agentId };
}

type RetainedLaunch = {
  messageId: string;
  toolCallLine: number;
  hostResultLine: number;
  toolUseId: string;
};

function verifyRetainedLaunchBatch(
  entries: JsonEntry[],
  launches: RetainedLaunch[],
) {
  if (launches[0]?.messageId !== launches[1]?.messageId)
    throw new Error("Claude Agent calls were not in one assistant turn");
  const messageId = launches[0]?.messageId;
  const lastCall = Math.max(...launches.map((launch) => launch.toolCallLine));
  const firstCall = Math.min(...launches.map((launch) => launch.toolCallLine));
  const firstResult = Math.min(
    ...launches.map((launch) => launch.hostResultLine),
  );
  if (firstResult <= lastCall)
    throw new Error("Claude Agent results began before all calls were issued");
  const expectedToolIds = new Set(launches.map((launch) => launch.toolUseId));
  const retainedBatch = agentBlocks(entries).filter(({ entry, message }) => {
    const sameMessage = message.id === messageId && entry.line < firstResult;
    const inLaunchWindow = entry.line >= firstCall && entry.line < firstResult;
    return sameMessage || inLaunchWindow;
  });
  if (
    retainedBatch.length !== launches.length ||
    retainedBatch.some(
      ({ block }) =>
        typeof block.id !== "string" || !expectedToolIds.has(block.id),
    )
  )
    throw new Error(
      `Claude launch batch contains ${retainedBatch.length} Agent calls; expected exactly two bound readers`,
    );
}

function joinLaunches(
  entries: JsonEntry[],
  records: AxisRecords[],
  route: Route,
) {
  const launches = records.map((record) => {
    const call = toolCall(entries, record.axis, route);
    const result = toolResult({
      entries,
      axis: record.axis,
      toolUseId: call.toolUseId,
      toolCallLine: call.toolCallLine,
      records: record,
      route,
    });
    return {
      axis: record.axis,
      ...call,
      ...result,
      transcript: record.transcript,
      transcriptSha256: record.transcriptHash,
    };
  });
  verifyRetainedLaunchBatch(entries, launches);
  if (launches[0]?.agentId === launches[1]?.agentId)
    throw new Error("Claude axes did not use distinct children");
  return launches;
}

export async function buildClaudeReviewProof(
  options: ClaudeReviewProofOptions,
) {
  if (!isAbsolute(options.parent) || !isAbsolute(options.artifactDir))
    throw new Error("parent and artifactDir must be absolute paths");
  const [parentText, routeText] = await Promise.all([
    readFile(options.parent, "utf8"),
    readFile(join(options.artifactDir, "reviewer-route.json"), "utf8"),
  ]);
  const route = selectedRoute(routeText);
  const entries = jsonLines(parentText, "parent transcript");
  const records = await Promise.all([
    axisRecords(options.artifactDir, "standards", route),
    axisRecords(options.artifactDir, "spec", route),
  ]);
  const launches = joinLaunches(entries, records, route);
  return {
    format: "darrow-code-review-claude-live-v1",
    outcome: "pass",
    parentTranscript: options.parent,
    parentEvidenceSha256: createHash("sha256")
      .update(launches.map((launch) => JSON.stringify(launch)).join("\n"))
      .digest("hex"),
    selectedRoute: route,
    launches,
    checks: {
      sameAssistantTurn: true,
      exactRetainedLaunchBatch: true,
      foregroundExactTuple: true,
      distinctHostChildren: true,
      parentResultsBoundToChildren: true,
      everyChildAssistantTurnObserved: true,
    },
    limitations: [
      "N=1 Claude Code mechanism smoke check; this is not a full code-review quality trial.",
      "The check proves exact-tuple route application and isolation, not cross-run variance.",
    ],
  };
}

function cliOptions(args: string[]): ClaudeReviewProofOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const item = args[index + 1];
    if (!flag?.startsWith("--") || !item)
      throw new Error("arguments must be --name value pairs");
    values.set(flag.slice(2), item);
  }
  for (const key of ["parent", "artifact-dir", "output"])
    if (!values.get(key)) throw new Error(`missing --${key}`);
  return {
    parent: values.get("parent")!,
    artifactDir: values.get("artifact-dir")!,
    output: values.get("output")!,
  };
}

async function main() {
  const options = cliOptions(process.argv.slice(2));
  if (!options.output || !isAbsolute(options.output))
    throw new Error("output must be absolute");
  const proof = await buildClaudeReviewProof(options);
  await mkdir(dirname(options.output), { recursive: true });
  const temporary = `${options.output}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(proof, null, 2)}\n`, {
    flag: "wx",
  });
  await rename(temporary, options.output);
  console.log(options.output);
}

if (import.meta.main) await main();
