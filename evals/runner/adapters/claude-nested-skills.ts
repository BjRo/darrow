import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { SkillActivationObservation } from "../types";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : undefined;
const blocks = (entry: RecordValue): RecordValue[] => {
  const content = object(entry.message)?.content;
  return Array.isArray(content)
    ? content.flatMap((v) => (object(v) ? [object(v)!] : []))
    : [];
};
const entries = (text: string): RecordValue[] =>
  text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const value = object(JSON.parse(line));
      if (!value) throw new Error("invalid native entry");
      return value;
    });
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const validInvocation = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_.:-]{1,256}$/.test(value);

export interface NestedSkillReceipt {
  type: "darrow.claude_nested_skill_invocations";
  complete: boolean;
  observedSkills: string[];
  invocations: Array<{ skill: string; invocation: string; agentId?: string }>;
  gaps: string[];
}

export function mergeClaudeNestedSkillActivation(
  observation: SkillActivationObservation,
  receipt: NestedSkillReceipt,
  explicitPrimary?: string,
): SkillActivationObservation {
  if (!receipt.complete) return { ...observation, complete: false };
  const observedSkills = [
    ...new Set([
      ...(explicitPrimary ? [explicitPrimary] : []),
      ...receipt.observedSkills,
    ]),
  ];
  return {
    ...observation,
    observedSkills,
    primarySkill: observedSkills[0] ?? null,
  };
}

interface RecoveryState {
  sessionId: string;
  readAgent: (id: string) => Promise<string>;
  resolveChild?: (toolUseId: string, parentAgentId?: string) => Promise<string>;
  complete: boolean;
  seen: Set<string>;
  gaps: Set<string>;
  observed: Array<NestedSkillReceipt["invocations"][number] & { time: number }>;
}

function observedSkill(
  entry: RecordValue,
  block: RecordValue,
  agentId?: string,
) {
  const invocation = object(block.input)?.skill;
  const time =
    typeof entry.timestamp === "string" ? Date.parse(entry.timestamp) : NaN;
  if (!validInvocation(invocation) || !Number.isFinite(time))
    throw new Error("invalid Skill observation");
  return { skill: invocation.split(":").at(-1)!, invocation, agentId, time };
}

function collectAssistant(
  entry: RecordValue,
  state: RecoveryState,
  pending: Set<string>,
  agentId?: string,
) {
  for (const block of blocks(entry)) {
    if (block.type !== "tool_use") continue;
    if (block.name === "Agent") {
      if (!validId(block.id)) throw new Error("invalid Agent call identity");
      if (object(block.input)?.run_in_background === true)
        throw new Error("background Agent evidence unavailable");
      pending.add(block.id);
    }
    if (block.name !== "Skill") continue;
    if (state.observed.length >= 128)
      throw new Error("excessive Skill metadata");
    state.observed.push(observedSkill(entry, block, agentId));
  }
}

async function completedChild(
  entry: RecordValue,
  pending: Set<string>,
  state: RecoveryState,
  parentAgentId?: string,
): Promise<string | undefined> {
  const matches = blocks(entry).filter(
    (b) =>
      b.type === "tool_result" &&
      typeof b.tool_use_id === "string" &&
      pending.has(b.tool_use_id),
  );
  if (!matches.length) return undefined;
  if (matches.length !== 1 || matches[0]!.is_error === true)
    throw new Error("uncorrelated Agent result");
  const toolUseId = matches[0]!.tool_use_id as string;
  const result = object(entry.toolUseResult);
  let agentId: string;
  if (result) {
    if (result.status !== "completed" || !validId(result.agentId))
      throw new Error("incomplete Agent results");
    agentId = result.agentId;
  } else {
    if (!state.resolveChild) throw new Error("Agent metadata unavailable");
    agentId = await state.resolveChild(toolUseId, parentAgentId);
    if (!validId(agentId)) throw new Error("invalid Agent call identity");
  }
  pending.delete(toolUseId);
  return agentId;
}

async function visitChild(id: string, state: RecoveryState) {
  if (state.seen.has(id) || state.seen.size >= 64)
    throw new Error("repeated or excessive Agent graph");
  state.seen.add(id);
  await visitNative(await state.readAgent(id), state, id);
}

function boundNativeMessages(
  text: string,
  sessionId: string,
  agentId?: string,
) {
  const records = entries(text).filter(
    (entry) => entry.type === "assistant" || entry.type === "user",
  );
  const assistants = records.filter((entry) => entry.type === "assistant");
  if (
    !assistants.length ||
    assistants.some((entry) => entry.agentId !== agentId)
  )
    throw new Error("unbound assistant");
  if (records.some((entry) => entry.sessionId !== sessionId))
    throw new Error("foreign session");
  return records;
}

async function visitNative(
  text: string,
  state: RecoveryState,
  agentId?: string,
): Promise<void> {
  try {
    const records = boundNativeMessages(text, state.sessionId, agentId);
    const pending = new Set<string>();
    for (const entry of records) {
      if (entry.type === "assistant")
        collectAssistant(entry, state, pending, agentId);
      if (entry.type !== "user") continue;
      const child = await completedChild(entry, pending, state, agentId);
      if (child) await visitChild(child, state);
    }
    if (pending.size) {
      state.complete = false;
      state.gaps.add("incomplete Agent results");
    }
  } catch (error) {
    state.complete = false;
    const known = [
      "invalid native entry",
      "invalid Agent call identity",
      "invalid Skill observation",
      "excessive Skill metadata",
      "uncorrelated Agent result",
      "repeated or excessive Agent graph",
      "unbound assistant",
      "foreign session",
      "missing or ambiguous child transcript",
      "incomplete Agent results",
      "Agent metadata unavailable",
      "background Agent evidence unavailable",
    ];
    const reason =
      error instanceof Error && known.includes(error.message)
        ? error.message
        : "native transcript unavailable";
    state.gaps.add(reason);
  }
}

function preservesStreamOrder(
  observedSkills: string[],
  streamSkills: string[],
): boolean {
  let previous = -1;
  for (const skill of streamSkills) {
    const index = observedSkills.indexOf(skill);
    if (index <= previous) return false;
    previous = index;
  }
  return true;
}

/** Follow native completed Agent receipts, never a directory's unrelated files. */
export async function recoverClaudeNestedSkills(input: {
  rootTranscript: string;
  sessionId: string;
  streamSkills: string[];
  readAgent: (id: string) => Promise<string>;
  resolveChild?: (toolUseId: string, parentAgentId?: string) => Promise<string>;
}): Promise<NestedSkillReceipt> {
  const state: RecoveryState = {
    ...input,
    complete: true,
    seen: new Set(),
    observed: [],
    gaps: new Set(),
  };
  await visitNative(input.rootTranscript, state);
  state.observed.sort((a, b) => a.time - b.time);
  const observedSkills = [...new Set(state.observed.map((e) => e.skill))];
  return {
    type: "darrow.claude_nested_skill_invocations",
    complete:
      state.complete &&
      state.observed.length <= 128 &&
      preservesStreamOrder(observedSkills, input.streamSkills),
    observedSkills,
    gaps: [...state.gaps],
    invocations: state.observed
      .slice(0, 128)
      .map(({ skill, invocation, agentId }) => ({
        skill,
        invocation,
        agentId,
      })),
  };
}

export async function observeClaudeNestedSkills(input: {
  repo: string;
  configRoot: string;
  stream: string;
  streamSkills: string[];
  matchingPaths: (
    directory: string,
    filename: string | RegExp,
  ) => Promise<string[]>;
}): Promise<NestedSkillReceipt> {
  const unavailable: NestedSkillReceipt = {
    type: "darrow.claude_nested_skill_invocations",
    complete: false,
    observedSkills: [],
    invocations: [],
    gaps: ["native session evidence unavailable"],
  };
  try {
    const sessions = [
      ...new Set(
        entries(input.stream)
          .filter((e) => e.type === "result")
          .map((e) => e.session_id),
      ),
    ];
    const sessionId = sessions[0];
    if (sessions.length !== 1 || !validId(sessionId)) return unavailable;
    const project = join(
      input.configRoot,
      "projects",
      input.repo.replace(/[^A-Za-z0-9]/g, "-"),
    );
    return await recoverClaudeNestedSkills({
      sessionId,
      streamSkills: input.streamSkills,
      rootTranscript: await readFile(
        join(project, `${sessionId}.jsonl`),
        "utf8",
      ),
      ...nativeGraphReaders(join(project, sessionId), input.matchingPaths),
    });
  } catch {
    return unavailable;
  }
}

function nativeGraphReaders(
  directory: string,
  matchingPaths: (
    directory: string,
    filename: string | RegExp,
  ) => Promise<string[]>,
) {
  return {
    readAgent: async (id: string) => {
      const paths = await matchingPaths(directory, `agent-${id}.jsonl`);
      if (paths.length !== 1)
        throw new Error("missing or ambiguous child transcript");
      return readFile(paths[0]!, "utf8");
    },
    resolveChild: (toolUseId: string, parentAgentId?: string) =>
      resolveNativeChild(directory, matchingPaths, toolUseId, parentAgentId),
  };
}

async function resolveNativeChild(
  directory: string,
  matchingPaths: (
    directory: string,
    filename: string | RegExp,
  ) => Promise<string[]>,
  toolUseId: string,
  parentAgentId?: string,
): Promise<string> {
  const paths = await matchingPaths(
    directory,
    /^agent-[A-Za-z0-9_-]+\.meta\.json$/,
  );
  if (paths.length > 64) throw new Error("Agent metadata unavailable");
  const matches: string[] = [];
  for (const path of paths) {
    const record = object(JSON.parse(await readFile(path, "utf8")));
    if (
      record?.toolUseId === toolUseId &&
      record?.parentAgentId === parentAgentId
    )
      matches.push(basename(path).slice(6, -10));
  }
  if (matches.length !== 1) throw new Error("Agent metadata unavailable");
  return matches[0]!;
}
