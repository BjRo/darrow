import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessAdapter, HarnessResult } from "../types";
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
  return code === 0 && result.subtype === "success" && result.is_error !== true;
}

interface ClaudeResultEnvelope {
  subtype?: string;
  is_error?: boolean;
  usage?: ClaudeUsage & { output_tokens?: number };
  total_cost_usd?: unknown;
  result?: unknown;
}

interface ClaudeOutcome {
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  resultText: string;
}

function claudeArgv(prompt: string, model: string, effort: string): string[] {
  return [
    "claude",
    "-p",
    prompt,
    "--output-format",
    "json",
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
}

/**
 * Reads the single JSON envelope `claude -p --output-format json` prints. A
 * missing or malformed envelope is a failed run, not a partially usable one.
 */
async function claudeOutcome(
  repoDir: string,
  out: string,
  code: number,
): Promise<ClaudeOutcome> {
  const outcome: ClaudeOutcome = {
    ok: false,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: null,
    resultText: "",
  };
  try {
    const parsed = JSON.parse(out) as ClaudeResultEnvelope;
    outcome.ok = claudeRunSucceeded(code, parsed);
    outcome.inputTokens = claudeInputTokens(parsed.usage);
    outcome.outputTokens = parsed.usage?.output_tokens ?? 0;
    outcome.costUsd =
      typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : null;
    // Mirror the codex adapter: final agent message under .git/ for checks.
    if (typeof parsed.result === "string") {
      outcome.resultText = parsed.result;
      await writeFile(join(repoDir, ".git", "last-message.md"), parsed.result);
    }
  } catch {
    // A malformed envelope, or an unwritable final message, is a failed run.
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
    const argv = await sandboxedAgentCommand(
      claudeArgv(prompt, model, effort),
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

    return {
      ok: outcome.ok,
      durationMs,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      costUsd: outcome.costUsd,
      resultText: outcome.resultText,
      raw: outcome.ok ? out : out + err,
    };
  },
};
