import { executeClaudeCommand } from "./claude";
import { executeCodexCommand } from "./codex";
import { DarrowError } from "./errors";
import type { ActivityInput, CommandResult } from "./types";

export async function executeCommand(
  input: ActivityInput,
): Promise<CommandResult> {
  if (input.profile.harness === "codex") return executeCodexCommand(input);
  if (input.profile.harness === "claude") return executeClaudeCommand(input);
  throw new DarrowError(
    `unsupported harness: ${String(input.profile.harness)}`,
    "preflight",
  );
}
