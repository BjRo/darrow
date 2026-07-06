import { join } from "node:path";
import type { HarnessAdapter, HarnessResult } from "../types";

/**
 * Runs the skill via headless Claude Code (`claude -p`). The skill is already
 * mounted in the fixture repo at .claude/skills/ (project-level discovery).
 * Permissions are skipped: the fixture is a disposable temp repo.
 */
export const claudeAdapter: HarnessAdapter = {
  name: "claude",
  defaultModel: "claude-sonnet-4-6",
  skillMounts: [".claude/skills"],

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const start = performance.now();
    const proc = Bun.spawn(
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
        "--dangerously-skip-permissions",
      ],
      {
        cwd: repoDir,
        stdout: "pipe",
        stderr: "pipe",
        // Fixture mocks (e.g. gh) shadow real network tools for the harness
        // and every subprocess it spawns.
        env: { ...process.env, PATH: `${join(repoDir, ".git", "fixture-bin")}:${process.env.PATH}` },
      },
    );
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    const durationMs = performance.now() - start;

    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let ok = code === 0;
    try {
      const parsed = JSON.parse(out);
      ok = ok && parsed.subtype === "success";
      inputTokens = parsed.usage?.input_tokens ?? 0;
      outputTokens = parsed.usage?.output_tokens ?? 0;
      costUsd = parsed.total_cost_usd ?? 0;
    } catch {
      ok = false;
    }

    return { ok, durationMs, inputTokens, outputTokens, costUsd, raw: ok ? out : out + err };
  },
};
