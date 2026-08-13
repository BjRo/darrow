import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  HarnessAdapter,
  HarnessResult,
  SkillActivationObservation,
} from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";

export interface ClaudeUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function claudeInputTokens(usage: ClaudeUsage | undefined): number {
  return (
    (usage?.input_tokens ?? 0) +
    (usage?.cache_creation_input_tokens ?? 0) +
    (usage?.cache_read_input_tokens ?? 0)
  );
}

export function claudeRunSucceeded(
  code: number,
  result: { subtype?: string; is_error?: boolean },
): boolean {
  return (
    code === 0 && result.subtype === "success" && result.is_error === false
  );
}

interface ClaudeResultEnvelope {
  type?: unknown;
  subtype?: string;
  is_error?: boolean;
  usage?: unknown;
  total_cost_usd?: unknown;
  result?: unknown;
  message?: unknown;
}

interface ClaudeOutcome {
  ok: boolean;
  tokenUsageComplete: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  resultText: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validAssistantContentBlock(
  value: unknown,
): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (value.type !== "tool_use" || value.name !== "Skill") return true;
  return (
    isRecord(value.input) &&
    typeof value.input.skill === "string" &&
    !!value.input.skill.split(":").pop()?.trim()
  );
}

function validResultEnvelope(value: Record<string, unknown>): boolean {
  return (
    typeof value.subtype === "string" &&
    !!value.subtype.trim() &&
    typeof value.is_error === "boolean" &&
    typeof value.result === "string"
  );
}

function validStreamEvent(value: unknown): value is ClaudeResultEnvelope {
  if (!isRecord(value)) return false;
  if (value.type === "result") return validResultEnvelope(value);
  if (value.type !== "assistant") return true;
  const message = value.message;
  return (
    isRecord(message) &&
    Array.isArray(message.content) &&
    message.content.every(validAssistantContentBlock)
  );
}

function isNonnegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

type CompleteClaudeUsage = Required<Pick<ClaudeUsage, "input_tokens">> & {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens: number;
};

function completeClaudeUsage(value: unknown): CompleteClaudeUsage | null {
  if (!isRecord(value)) return null;
  const optionalBuckets = [
    value.cache_creation_input_tokens,
    value.cache_read_input_tokens,
  ];
  if (
    !isNonnegativeFiniteNumber(value.input_tokens) ||
    !isNonnegativeFiniteNumber(value.output_tokens) ||
    optionalBuckets.some(
      (bucket) => bucket !== undefined && !isNonnegativeFiniteNumber(bucket),
    )
  )
    return null;
  return value as CompleteClaudeUsage;
}

function sumKnownCosts(results: ClaudeResultEnvelope[]): number | null {
  const costs = results.map((result) => result.total_cost_usd);
  return costs.every(isNonnegativeFiniteNumber)
    ? costs.reduce((total, cost) => total + cost, 0)
    : null;
}

interface ClaudeStream {
  events: ClaudeResultEnvelope[];
  malformed: boolean;
}

function claudeStream(stream: string): ClaudeStream {
  const events: ClaudeResultEnvelope[] = [];
  let malformed = false;
  for (const line of stream.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event: unknown = JSON.parse(line);
      if (validStreamEvent(event)) events.push(event);
      else malformed = true;
    } catch {
      malformed = true;
    }
  }
  return { events, malformed };
}

export function claudeResultAccounting(
  streamText: string,
  code: number,
): ClaudeOutcome {
  const stream = claudeStream(streamText);
  const results = stream.events.filter((event) => event.type === "result");
  const final = results.at(-1);
  const usages = results.map((result) => completeClaudeUsage(result.usage));
  return {
    ok:
      !stream.malformed &&
      !!final &&
      claudeRunSucceeded(code, final) &&
      results.every((result) => claudeRunSucceeded(0, result)),
    tokenUsageComplete:
      !stream.malformed && results.length > 0 && usages.every(Boolean),
    inputTokens: usages.reduce(
      (total, usage) => total + claudeInputTokens(usage ?? undefined),
      0,
    ),
    outputTokens: usages.reduce(
      (total, usage) => total + (usage?.output_tokens ?? 0),
      0,
    ),
    costUsd:
      !stream.malformed && results.length ? sumKnownCosts(results) : null,
    resultText: typeof final?.result === "string" ? final.result : "",
  };
}

function claudeContent(event: ClaudeResultEnvelope): Record<string, unknown>[] {
  if (!isRecord(event.message) || !Array.isArray(event.message.content))
    return [];
  return event.message.content.filter(isRecord);
}

function claudeSkillName(block: unknown): string | undefined {
  if (!isRecord(block)) return undefined;
  const input = isRecord(block.input) ? block.input : undefined;
  if (
    block.type !== "tool_use" ||
    block.name !== "Skill" ||
    typeof input?.skill !== "string"
  )
    return undefined;
  return input.skill.split(":").pop()?.trim() || undefined;
}

function uniqueSkills(events: ClaudeResultEnvelope[]): string[] {
  const skills = events.flatMap((event) =>
    event.type === "assistant" ? claudeContent(event).map(claudeSkillName) : [],
  );
  return [...new Set(skills.filter((skill): skill is string => !!skill))];
}

function retainedSkillBlocks(event: ClaudeResultEnvelope) {
  if (event.type !== "assistant") return [];
  return claudeContent(event).flatMap((block) => {
    const skill = claudeSkillName(block);
    return skill ? [{ type: "tool_use", name: "Skill", input: { skill } }] : [];
  });
}

/** Normalize Claude's direct Skill tool-use events without retaining messages. */
export function claudeSkillActivation(
  stream: string,
): SkillActivationObservation {
  const parsed = claudeStream(stream);
  const observedSkills = uniqueSkills(parsed.events);
  return {
    source: "harness_event",
    complete:
      !parsed.malformed &&
      parsed.events.some((event) => event.type === "result"),
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

function retainedResultEnvelope(event: ClaudeResultEnvelope) {
  const completeUsage = completeClaudeUsage(event.usage);
  const usage = completeUsage
    ? {
        input_tokens: completeUsage.input_tokens,
        cache_creation_input_tokens: completeUsage.cache_creation_input_tokens,
        cache_read_input_tokens: completeUsage.cache_read_input_tokens,
        output_tokens: completeUsage.output_tokens,
      }
    : undefined;
  return {
    type: "result",
    subtype: event.subtype,
    is_error: event.is_error,
    ...(usage ? { usage } : {}),
    ...(typeof event.total_cost_usd === "number"
      ? { total_cost_usd: event.total_cost_usd }
      : {}),
  };
}

/** Retain bounded accounting and reduced Skill events, not result text. */
export function retainedClaudeEvidence(
  stream: string,
  status?: { exitCode: number; stderrPresent: boolean },
): string {
  const parsed = claudeStream(stream);
  const retained: unknown[] = [];
  for (const event of parsed.events) {
    if (event.type === "result") {
      retained.push(retainedResultEnvelope(event));
      continue;
    }
    const skills = retainedSkillBlocks(event);
    if (skills.length)
      retained.push({ type: "assistant", message: { content: skills } });
  }
  if (parsed.malformed) retained.push({ type: "malformed_stream" });
  if (status && status.exitCode !== 0)
    retained.push({
      type: "harness_failure",
      exit_code: status.exitCode,
      stderr_present: status.stderrPresent,
    });
  return retained.map((event) => JSON.stringify(event)).join("\n");
}

export function claudeArgv(
  prompt: string,
  model: string,
  effort: string,
  pluginDir?: string,
): string[] {
  const argv = [
    "claude",
    "-p",
    prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    model,
    "--effort",
    effort,
    "--setting-sources",
    "project,local",
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--no-chrome",
    "--no-session-persistence",
    "--dangerously-skip-permissions",
  ];
  if (pluginDir) argv.push("--plugin-dir", pluginDir);
  return argv;
}

/**
 * Reads the terminal result envelope from Claude's JSONL stream. A missing or
 * malformed stream is a failed run, not a partially usable one.
 */
async function claudeOutcome(
  repoDir: string,
  out: string,
  code: number,
): Promise<ClaudeOutcome> {
  const outcome: ClaudeOutcome = {
    ok: false,
    tokenUsageComplete: false,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
    resultText: "",
  };
  try {
    Object.assign(outcome, claudeResultAccounting(out, code));
    // Mirror the codex adapter: final agent message under .git/ for checks.
    if (outcome.resultText) {
      await writeFile(
        join(repoDir, ".git", "last-message.md"),
        outcome.resultText,
      );
    }
  } catch {
    // A malformed stream, or an unwritable final message, is a failed run.
    outcome.ok = false;
  }
  return outcome;
}

/**
 * Runs the skill via headless Claude Code (`claude -p`). The skill is already
 * mounted in the fixture repo at .claude/skills/ (project-level discovery).
 * Native permissions are skipped inside the runner's outer OS sandbox.
 */
export const claudeAdapter: HarnessAdapter = {
  name: "claude",
  defaultModel: "claude-sonnet-5",
  skillMounts: [".claude/skills"],

  async version(): Promise<string> {
    const proc = Bun.spawn(["claude", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim();
  },

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const start = performance.now();
    const env = await isolatedHarnessEnvironment("claude", repoDir);
    const evalPlugin = join(repoDir, ".git", "eval-plugin");
    const argv = await sandboxedAgentCommand(
      claudeArgv(
        prompt,
        model,
        effort,
        existsSync(evalPlugin) ? evalPlugin : undefined,
      ),
      repoDir,
    );
    const proc = Bun.spawn(argv, {
      cwd: repoDir,
      stdout: "pipe",
      stderr: "pipe",
      // Fixture mocks (e.g. gh) shadow real network tools for the harness
      // and every subprocess it spawns.
      env: {
        ...env,
        DARROW_GOAL_LOOP_EXTERNAL_SANDBOX: "1",
        PATH: `${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`,
      },
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const durationMs = performance.now() - start;
    const outcome = await claudeOutcome(repoDir, out, code);
    const skillActivation = claudeSkillActivation(out);

    return {
      ok: outcome.ok,
      durationMs,
      tokenUsageComplete: outcome.tokenUsageComplete,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      costUsd: outcome.costUsd,
      resultText: outcome.resultText,
      raw: retainedClaudeEvidence(out, {
        exitCode: code,
        stderrPresent: err.trim().length > 0,
      }),
      skillActivation: {
        ...skillActivation,
        complete: outcome.ok && skillActivation.complete,
      },
    };
  },
};
