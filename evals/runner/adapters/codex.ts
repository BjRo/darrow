import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessAdapter, HarnessResult } from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";

export function codexRunSucceeded(code: number, stream: string): boolean {
  let completed = false;
  let failed = false;
  for (const line of stream.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const event = JSON.parse(trimmed);
      const types = [event.type, event.msg?.type].filter(
        (type): type is string => typeof type === "string",
      );
      if (types.includes("turn.completed")) completed = true;
      if (types.includes("turn.failed")) failed = true;
    } catch {
      // non-JSON noise in the stream is fine
    }
  }
  return code === 0 && completed && !failed;
}

/**
 * Runs the skill via headless Codex (`codex exec`). The skill is mounted in
 * the fixture repo at .agents/skills/ (Codex agent-skills discovery).
 * Native approvals are bypassed inside the runner's outer OS sandbox.
 * Codex reports token usage in its JSONL event stream but no cost — costUsd
 * stays 0 for this adapter.
 */
export const codexAdapter: HarnessAdapter = {
  name: "codex",
  defaultModel: "gpt-5.5",
  skillMounts: [".agents/skills"],

  async version(): Promise<string> {
    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    await proc.exited;
    return out.trim();
  },

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const start = performance.now();
    const env = await isolatedHarnessEnvironment("codex", repoDir);
    const argv = await sandboxedAgentCommand(
      [
        "codex",
        "exec",
        prompt,
        "--json",
        "-m",
        model,
        "-c",
        `model_reasoning_effort="${effort}"`,
        "--skip-git-repo-check",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--dangerously-bypass-approvals-and-sandbox",
        // Final agent message lands under .git/ so checks can read it without
        // it ever appearing in the model's worktree (same trick as fixture-bin).
        "-o",
        join(repoDir, ".git", "last-message.md"),
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

    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const event = JSON.parse(trimmed);
        const usage =
          event.usage ??
          event.msg?.info?.total_token_usage ??
          event.info?.total_token_usage;
        if (usage) {
          inputTokens = usage.input_tokens ?? inputTokens;
          outputTokens = usage.output_tokens ?? outputTokens;
        }
      } catch {
        // non-JSON noise in the stream is fine
      }
    }
    const ok = codexRunSucceeded(code, out);
    let resultText = "";
    try {
      resultText = await readFile(
        join(repoDir, ".git", "last-message.md"),
        "utf8",
      );
    } catch {
      // A missing final message is observable to output checks and raw output.
    }

    return {
      ok,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd: 0,
      resultText,
      raw: ok ? out : out + err,
    };
  },
};
