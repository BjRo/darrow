import { executeClaudeCommand } from "./claude";
import { executeCodexCommand } from "./codex";
import { DarrowError } from "./errors";
import type { ActivityInput, CommandResult } from "./types";

export async function executeCommand(
  input: ActivityInput,
): Promise<CommandResult> {
  if (
    input.effectiveRoute.harness === "codex" &&
    input.effectiveRoute.adapter.id === "codex-cli"
  )
    return executeCodexCommand(input);
  if (
    input.effectiveRoute.harness === "claude" &&
    input.effectiveRoute.adapter.id === "claude-code"
  )
    return executeClaudeCommand(input);
  throw new DarrowError(
    `unsupported execution route: ${input.effectiveRoute.harness}/${input.effectiveRoute.adapter.id}`,
    "preflight",
  );
}
