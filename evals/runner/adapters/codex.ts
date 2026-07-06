import { join } from "node:path";
import type { HarnessAdapter, HarnessResult } from "../types";

/**
 * Runs the skill via headless Codex (`codex exec`). The skill is mounted in
 * the fixture repo at .agents/skills/ (Codex agent-skills discovery).
 * Sandbox/approvals are bypassed: the fixture is a disposable temp repo.
 * Codex reports token usage in its JSONL event stream but no cost — costUsd
 * stays 0 for this adapter.
 */
export const codexAdapter: HarnessAdapter = {
  name: "codex",
  defaultModel: "gpt-5.5",
  skillMounts: [".agents/skills"],

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const start = performance.now();
    const proc = Bun.spawn(
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
        "--dangerously-bypass-approvals-and-sandbox",
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
    let ok = code === 0;
    let sawFailure = false;

    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try {
        const event = JSON.parse(trimmed);
        const type: string = event.type ?? event.msg?.type ?? "";
        if (type.includes("failed") || type.includes("error")) sawFailure = true;
        const usage = event.usage ?? event.msg?.info?.total_token_usage ?? event.info?.total_token_usage;
        if (usage) {
          inputTokens = usage.input_tokens ?? inputTokens;
          outputTokens = usage.output_tokens ?? outputTokens;
        }
      } catch {
        // non-JSON noise in the stream is fine
      }
    }
    ok = ok && !sawFailure;

    return {
      ok,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd: 0,
      raw: ok ? out : out + err,
    };
  },
};
