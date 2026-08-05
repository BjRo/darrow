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

/**
 * Runs the skill via headless Claude Code (`claude -p`). The skill is already
 * mounted in the fixture repo at .claude/skills/ (project-level discovery).
 * Native permissions are skipped inside the runner's outer OS sandbox.
 */
export const claudeAdapter: HarnessAdapter = {
  name: "claude",
  defaultModel: "claude-sonnet-4-6",
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
      [
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
      ],
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
        PATH: `${join(repoDir, ".git", "fixture-bin")}:${env.PATH ?? ""}`,
      },
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const durationMs = performance.now() - start;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let resultText = "";
    let ok = false;
    try {
      const parsed = JSON.parse(out);
      ok = claudeRunSucceeded(code, parsed);
      inputTokens = claudeInputTokens(parsed.usage);
      outputTokens = parsed.usage?.output_tokens ?? 0;
      costUsd = parsed.total_cost_usd ?? 0;
      // Mirror the codex adapter: final agent message under .git/ for checks.
      if (typeof parsed.result === "string") {
        resultText = parsed.result;
        await writeFile(
          join(repoDir, ".git", "last-message.md"),
          parsed.result,
        );
      }
    } catch {
      ok = false;
    }

    return {
      ok,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd,
      resultText,
      raw: ok ? out : out + err,
    };
  },
};
