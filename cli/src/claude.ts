import {
  executeHarnessCommand,
  type CommandHarnessAdapter,
  type NativeHarnessOutput,
} from "./codex";
import type { ActivityInput, CommandResult } from "./types";

function numericUsage(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usage = Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] =>
      Number.isFinite(entry[1]),
    ),
  );
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function projectClaudeOutputSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return schema;
  }

  const {
    $schema: _schemaDialect,
    $id: _schemaId,
    oneOf: _rootOneOf,
    allOf: _rootAllOf,
    anyOf: _rootAnyOf,
    ...projected
  } = schema as Record<string, unknown>;
  return projected;
}

const claudeAdapter: CommandHarnessAdapter = {
  displayName: "Claude Code",
  async invocation(input, outputSchema, _outputFile, locked) {
    const schema = await Bun.file(outputSchema).json();
    const localSettings = locked.configurationSources.find(
      (source) => source.scope === "local" && source.present !== false,
    )?.path;
    const args = [
      locked.executable,
      "--print",
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      input.effectiveRoute.model,
      "--effort",
      input.effectiveRoute.reasoningEffort,
      "--json-schema",
      JSON.stringify(projectClaudeOutputSchema(schema)),
      "--setting-sources",
      "user,project",
    ];
    if (localSettings) args.push("--settings", localSettings);
    return args;
  },
  parseOutput(stdout): NativeHarnessOutput {
    const output: NativeHarnessOutput = {};
    for (const line of stdout.split("\n").filter(Boolean)) {
      try {
        const item = JSON.parse(line) as {
          type?: string;
          subtype?: string;
          is_error?: boolean;
          session_id?: string;
          usage?: unknown;
          structured_output?: unknown;
          permission_denials?: unknown[];
          result?: unknown;
          error?: unknown;
        };
        if (typeof item.session_id === "string")
          output.nativeSessionId = item.session_id;
        if (item.type !== "result") continue;
        output.usage = numericUsage(item.usage);
        if (
          item.structured_output &&
          typeof item.structured_output === "object" &&
          !Array.isArray(item.structured_output)
        )
          output.payload = item.structured_output as Record<string, unknown>;
        if (
          Array.isArray(item.permission_denials) &&
          item.permission_denials.length > 0
        ) {
          output.errorCategory = "permission_denied";
          output.errorMessage = "Claude Code denied a required permission";
        } else if (item.is_error || item.subtype !== "success") {
          output.errorCategory = /model|unavailable|unsupported/i.test(
            String(item.result ?? item.error ?? ""),
          )
            ? "model_unavailable"
            : "harness";
          output.errorMessage = String(
            item.result ?? item.error ?? "Claude Code invocation failed",
          );
        }
      } catch {
        /* preserve malformed native output in the transcript */
      }
    }
    return output;
  },
};

export async function executeClaudeCommand(
  input: ActivityInput,
): Promise<CommandResult> {
  return executeHarnessCommand(input, claudeAdapter);
}
