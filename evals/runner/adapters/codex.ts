import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HarnessAdapter, HarnessResult } from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface CodexEvent {
  type?: unknown;
  usage?: CodexUsage;
  msg?: { type?: unknown; info?: { total_token_usage?: CodexUsage } };
  info?: { total_token_usage?: CodexUsage };
}

/** JSONL events from the `codex exec --json` stream; non-JSON noise is fine. */
function codexEvents(stream: string): CodexEvent[] {
  const events: CodexEvent[] = [];
  for (const line of stream.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed) as CodexEvent);
    } catch {
      // non-JSON noise in the stream is fine
    }
  }
  return events;
}

function codexEventTypes(event: CodexEvent): string[] {
  return [event.type, event.msg?.type].filter(
    (type): type is string => typeof type === "string",
  );
}

export function codexRunSucceeded(code: number, stream: string): boolean {
  let completed = false;
  let failed = false;
  for (const event of codexEvents(stream)) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return code === 0 && completed && !failed;
}

interface CodexTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Codex reports cumulative usage repeatedly; the last report on the stream wins. */
function codexTokenUsage(stream: string): CodexTokenUsage {
  const totals: CodexTokenUsage = { inputTokens: 0, outputTokens: 0 };
  for (const event of codexEvents(stream)) {
    const usage =
      event.usage ??
      event.msg?.info?.total_token_usage ??
      event.info?.total_token_usage;
    if (usage) {
      totals.inputTokens = usage.input_tokens ?? totals.inputTokens;
      totals.outputTokens = usage.output_tokens ?? totals.outputTokens;
    }
  }
  return totals;
}

function codexArgv(
  repoDir: string,
  prompt: string,
  model: string,
  effort: string,
): string[] {
  return [
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
  ];
}

async function codexFinalMessage(repoDir: string): Promise<string> {
  try {
    return await readFile(join(repoDir, ".git", "last-message.md"), "utf8");
  } catch {
    // A missing final message is observable to output checks and raw output.
    return "";
  }
}

/**
 * Runs the skill via headless Codex (`codex exec`). The skill is mounted in
 * the fixture repo at .agents/skills/ (Codex agent-skills discovery).
 * Native approvals are bypassed inside the runner's outer OS sandbox.
 * Codex reports token usage in its JSONL event stream but no cost — costUsd
 * stays null for this adapter.
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
      codexArgv(repoDir, prompt, model, effort),
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

    const { inputTokens, outputTokens } = codexTokenUsage(out);
    const ok = codexRunSucceeded(code, out);
    const resultText = await codexFinalMessage(repoDir);

    return {
      ok,
      durationMs,
      inputTokens,
      outputTokens,
      costUsd: null,
      resultText,
      raw: ok ? out : out + err,
    };
  },
};
