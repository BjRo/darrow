import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessAdapter, HarnessResult } from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";

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
    let ok = code === 0;
    try {
      const parsed = JSON.parse(out);
      ok = ok && parsed.subtype === "success";
      inputTokens = parsed.usage?.input_tokens ?? 0;
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
