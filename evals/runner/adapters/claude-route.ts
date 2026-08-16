import {
  readFile,
  readdir,
  readlink,
  realpath,
  mkdir,
  symlink,
} from "node:fs/promises";
import { basename, join } from "node:path";
import type { GoalRoute } from "../types";

export interface ClaudeAgentRouteEvidence {
  type: "darrow.claude_agent_route";
  status: "completed";
  agentId: string;
  selected: GoalRoute;
  effective: GoalRoute;
  appliedBy: "native-subagent";
  launchBoundary: "native_subagent";
}

interface TranscriptProjectKeys {
  observed: string;
  compatibility: string[];
}

function verifierProjectKey(path: string): string {
  return `-${path.replace(/^\/+/, "").replaceAll("/", "-")}`;
}

function observedProjectKey(path: string): string {
  return path.replace(/[^A-Za-z0-9-]/g, "-");
}

export function claudeTranscriptProjectKeys(
  logicalRepo: string,
  physicalRepo: string,
): TranscriptProjectKeys {
  const observed = observedProjectKey(physicalRepo);
  return {
    observed,
    compatibility: [
      ...new Set([
        verifierProjectKey(logicalRepo),
        verifierProjectKey(physicalRepo),
      ]),
    ].filter((key) => key !== observed),
  };
}

async function ensureTranscriptAlias(alias: string, target: string) {
  try {
    await symlink(target, alias, "dir");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if ((await readlink(alias)) !== target)
      throw new Error(
        `Claude transcript alias has unexpected target: ${alias}`,
        { cause: error },
      );
  }
}

export async function provisionClaudeTranscriptAliases(
  repoDir: string,
  configRoot: string,
): Promise<void> {
  const projectsRoot = join(configRoot, "projects");
  await mkdir(projectsRoot, { recursive: true });
  const keys = claudeTranscriptProjectKeys(repoDir, await realpath(repoDir));
  const target = join(projectsRoot, keys.observed);
  await Promise.all(
    keys.compatibility.map((key) =>
      ensureTranscriptAlias(join(projectsRoot, key), target),
    ),
  );
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function transcriptEvents(text: string): Record<string, unknown>[] {
  return text.split("\n").flatMap((line) => {
    if (!line.trim()) return [];
    try {
      return [recordOf(JSON.parse(line))];
    } catch {
      return [];
    }
  });
}

function contentBlocks(event: Record<string, unknown>) {
  const content = recordOf(event.message).content;
  return Array.isArray(content) ? content.map(recordOf) : [];
}

function adaptiveAgentToolIds(events: Record<string, unknown>[]) {
  return events.flatMap((event) =>
    contentBlocks(event).flatMap((block) => {
      const input = recordOf(block.input);
      return block.type === "tool_use" &&
        block.name === "Agent" &&
        typeof block.id === "string" &&
        typeof input.subagent_type === "string" &&
        /(?:^|:)adaptive-goal-(?:sonnet-(?:5|4-6)-(?:low|medium)|opus-(?:5|4-6)-high)$/.test(
          input.subagent_type,
        )
        ? [{ toolId: block.id, subagentType: input.subagent_type }]
        : [];
    }),
  );
}

function resultAgentId(
  events: Record<string, unknown>[],
  toolId: string,
): string | undefined {
  for (const event of events) {
    const matchingResult = contentBlocks(event).some(
      (block) => block.type === "tool_result" && block.tool_use_id === toolId,
    );
    const agentId = recordOf(event.toolUseResult).agentId;
    if (matchingResult && typeof agentId === "string") return agentId;
  }
  return undefined;
}

function selectedRoute(subagentType: string): GoalRoute | undefined {
  const match = subagentType.match(
    /(?:^|:)adaptive-goal-((?:sonnet|opus)-(?:5|4-6))-(low|medium|high)$/,
  );
  return match
    ? {
        harness: "claude",
        provider: "anthropic",
        model: `claude-${match[1]}`,
        effort: match[2]!,
      }
    : undefined;
}

function exactChildRoute(
  childTranscript: string,
  agentId: string,
): GoalRoute | undefined {
  const assistantEvents = transcriptEvents(childTranscript).filter(
    (event) => event.type === "assistant" && event.agentId === agentId,
  );
  const models = new Set(
    assistantEvents
      .map((event) => recordOf(event.message).model)
      .filter((model): model is string => typeof model === "string"),
  );
  const efforts = new Set(
    assistantEvents
      .map((event) => event.effort)
      .filter((effort): effort is string => typeof effort === "string"),
  );
  if (models.size !== 1 || efforts.size !== 1) return undefined;
  return {
    harness: "claude",
    provider: "anthropic",
    model: [...models][0]!,
    effort: [...efforts][0]!,
  };
}

export function claudeAgentRouteEvidence(
  mainTranscript: string,
  childTranscripts: Record<string, string>,
): ClaudeAgentRouteEvidence | undefined {
  const events = transcriptEvents(mainTranscript);
  const tools = adaptiveAgentToolIds(events);
  if (tools.length !== 1) return undefined;
  const tool = tools[0]!;
  const agentId = resultAgentId(events, tool.toolId);
  if (!agentId || !/^[A-Za-z0-9]+$/.test(agentId)) return undefined;
  const selected = selectedRoute(tool.subagentType);
  const child = childTranscripts[agentId];
  const effective = child ? exactChildRoute(child, agentId) : undefined;
  if (!selected || !effective) return undefined;
  return {
    type: "darrow.claude_agent_route",
    status: "completed",
    agentId,
    selected,
    effective,
    appliedBy: "native-subagent",
    launchBoundary: "native_subagent",
  };
}

async function transcriptFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

export async function observeClaudeAgentRoute(
  repoDir: string,
  configRoot: string,
): Promise<ClaudeAgentRouteEvidence | undefined> {
  const keys = claudeTranscriptProjectKeys(repoDir, await realpath(repoDir));
  const projectDir = join(configRoot, "projects", keys.observed);
  let entries;
  try {
    entries = await readdir(projectDir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const sessions = entries.filter(
    (entry) => entry.isFile() && entry.name.endsWith(".jsonl"),
  );
  if (sessions.length !== 1) return undefined;
  const session = sessions[0]!.name;
  const main = await transcriptFile(join(projectDir, session));
  if (!main) return undefined;
  const subagentsDir = join(
    projectDir,
    basename(session, ".jsonl"),
    "subagents",
  );
  let childEntries;
  try {
    childEntries = await readdir(subagentsDir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  const children: Record<string, string> = {};
  for (const entry of childEntries) {
    const match =
      entry.isFile() && entry.name.match(/^agent-([A-Za-z0-9]+)\.jsonl$/);
    if (!match) continue;
    const content = await transcriptFile(join(subagentsDir, entry.name));
    if (content) children[match[1]!] = content;
  }
  return claudeAgentRouteEvidence(main, children);
}
