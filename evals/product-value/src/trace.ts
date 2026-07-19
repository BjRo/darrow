import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { InvocationResult } from "./harness";
import type { Treatment } from "./types";

interface PhaseTrace {
  exitStatus: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

const COMMAND_CATEGORIES = [
  "evidence",
  "test",
  "dependency_setup",
  "git",
  "inspection",
  "other",
] as const;

type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

const EVIDENCE_OPERATIONS = ["red", "green", "regression", "validate"] as const;
const NONZERO_REASONS = [
  "evidence_expected_mismatch",
  "evidence_usage",
  "missing_dependency",
  "test_failure",
  "other",
] as const;
type EvidenceOperation = (typeof EVIDENCE_OPERATIONS)[number];
type NonZeroReason = (typeof NONZERO_REASONS)[number];

function commandCategory(command: string): CommandCategory {
  if (/(?:^|[\/\s])evidence(?:\.sh)?(?:\s|$)/i.test(command)) return "evidence";
  if (
    /\b(vitest|jest|mocha|pytest|cargo\s+test|go\s+test)\b/i.test(command) ||
    /\b(bun|npm|pnpm|yarn)\s+(?:run\s+)?test\b/i.test(command)
  )
    return "test";
  if (
    /\b(node_path|(?:bun|npm|pnpm|yarn)\s+install)\b/i.test(command) ||
    /\b(ln|cp|mv|rm|mkdir)\b[^\n;]*(node_modules|\.vite)\b/i.test(command)
  )
    return "dependency_setup";
  if (
    /\bgit\s+(status|diff|show|log|branch|switch|checkout|add|commit)\b/i.test(
      command,
    )
  )
    return "git";
  if (/\b(rg|sed|cat|find|ls|pwd|head|tail|wc)\b/i.test(command))
    return "inspection";
  return "other";
}

function evidenceOperation(command: string): EvidenceOperation | null {
  if (!/(?:^|[\/\s])evidence(?:\.sh)?(?:\s|$)/i.test(command)) return null;
  for (const phase of ["red", "green", "regression"])
    if (new RegExp(`\\srun\\s+\\S+\\s+${phase}(?:\\s|$)`, "i").test(command))
      return phase as EvidenceOperation;
  return /\svalidate\s+\S+/i.test(command) ? "validate" : null;
}

function nonZeroReason(output: string): NonZeroReason {
  if (output.includes("red output did not contain expected behavioral failure"))
    return "evidence_expected_mismatch";
  if (/usage: evidence\.sh|expected text must|red requires/i.test(output))
    return "evidence_usage";
  if (
    /Cannot find (package|module)|MODULE_NOT_FOUND|command not found/i.test(
      output,
    )
  )
    return "missing_dependency";
  if (/Failed Tests|Failed Suites|Test Files.*failed|\bFAIL\b/i.test(output))
    return "test_failure";
  return "other";
}

function duration(startedAt: unknown, finishedAt: unknown): number | null {
  if (typeof startedAt !== "string" || typeof finishedAt !== "string")
    return null;
  const value = Date.parse(finishedAt) - Date.parse(startedAt);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function modelTrace(raw: string): Record<string, unknown> {
  const eventTypes: Record<string, number> = {};
  const itemTypes: Record<string, number> = {};
  const toolTypes: Record<string, number> = {};
  const pendingClaudeCommands = new Map<
    string,
    { category: CommandCategory; operation: EvidenceOperation | null }
  >();
  let jsonEvents = 0;
  let nonJsonLines = 0;
  let usage: Record<string, unknown> | null = null;
  let costUsd: number | null = null;
  const commands = {
    total: 0,
    nonZero: 0,
    categories: Object.fromEntries(
      COMMAND_CATEGORIES.map((category) => [
        category,
        { total: 0, nonZero: 0 },
      ]),
    ) as Record<CommandCategory, { total: number; nonZero: number }>,
    evidenceOperations: Object.fromEntries(
      EVIDENCE_OPERATIONS.map((operation) => [
        operation,
        { total: 0, nonZero: 0 },
      ]),
    ) as Record<string, { total: number; nonZero: number }>,
    nonZeroReasons: Object.fromEntries(
      NONZERO_REASONS.map((reason) => [reason, 0]),
    ) as Record<string, number>,
  };
  const markCommandFailure = (
    category: CommandCategory,
    operation: EvidenceOperation | null,
    output: string,
  ): void => {
    commands.nonZero += 1;
    commands.categories[category].nonZero += 1;
    if (operation) {
      const operationStats = commands.evidenceOperations[operation];
      if (operationStats) operationStats.nonZero += 1;
    }
    const reason = nonZeroReason(output);
    commands.nonZeroReasons[reason] =
      (commands.nonZeroReasons[reason] ?? 0) + 1;
  };
  for (const line of raw.split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      jsonEvents += 1;
      if (typeof event.type === "string")
        eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
      if (
        event.type === "item.completed" &&
        typeof event.item?.type === "string"
      )
        itemTypes[event.item.type] = (itemTypes[event.item.type] ?? 0) + 1;
      if (event.type === "assistant" && Array.isArray(event.message?.content)) {
        for (const item of event.message.content) {
          if (item?.type !== "tool_use" || typeof item.name !== "string") {
            continue;
          }
          toolTypes[item.name] = (toolTypes[item.name] ?? 0) + 1;
          if (
            item.name !== "Bash" ||
            typeof item.id !== "string" ||
            typeof item.input?.command !== "string"
          ) {
            continue;
          }
          const category = commandCategory(item.input.command);
          const operation = evidenceOperation(item.input.command);
          commands.total += 1;
          commands.categories[category].total += 1;
          if (operation) {
            const operationStats = commands.evidenceOperations[operation];
            if (operationStats) operationStats.total += 1;
          }
          pendingClaudeCommands.set(item.id, { category, operation });
        }
      }
      if (event.type === "user" && Array.isArray(event.message?.content)) {
        for (const item of event.message.content) {
          if (
            item?.type !== "tool_result" ||
            typeof item.tool_use_id !== "string"
          ) {
            continue;
          }
          const command = pendingClaudeCommands.get(item.tool_use_id);
          if (!command) continue;
          if (item.is_error === true) {
            markCommandFailure(
              command.category,
              command.operation,
              typeof item.content === "string" ? item.content : "",
            );
          }
          pendingClaudeCommands.delete(item.tool_use_id);
        }
      }
      if (
        event.type === "item.completed" &&
        event.item?.type === "command_execution"
      ) {
        const category = commandCategory(
          typeof event.item.command === "string" ? event.item.command : "",
        );
        const nonZero =
          typeof event.item.exit_code === "number" &&
          event.item.exit_code !== 0;
        commands.total += 1;
        commands.categories[category].total += 1;
        const operation = evidenceOperation(
          typeof event.item.command === "string" ? event.item.command : "",
        );
        if (operation) {
          const operationStats = commands.evidenceOperations[operation];
          if (operationStats) operationStats.total += 1;
        }
        if (nonZero) {
          markCommandFailure(
            category,
            operation,
            typeof event.item.aggregated_output === "string"
              ? event.item.aggregated_output
              : "",
          );
        }
      }
      const candidate = event.usage ?? event.msg?.info?.total_token_usage;
      if (candidate && typeof candidate === "object") usage = candidate;
      if (
        typeof event.total_cost_usd === "number" &&
        Number.isFinite(event.total_cost_usd)
      )
        costUsd = event.total_cost_usd;
    } catch {
      nonJsonLines += 1;
    }
  }
  return {
    jsonEvents,
    nonJsonLines,
    eventTypes,
    itemTypes,
    toolTypes,
    commands,
    usage,
    costUsd,
  };
}

function addCounts(
  target: Record<string, number>,
  source: Record<string, number>,
): void {
  for (const [key, value] of Object.entries(source))
    target[key] = (target[key] ?? 0) + value;
}

function aggregateModelTraces(
  traces: Array<Record<string, any>>,
): Record<string, unknown> {
  const eventTypes: Record<string, number> = {};
  const itemTypes: Record<string, number> = {};
  const toolTypes: Record<string, number> = {};
  const usage: Record<string, number> = {};
  const commands = {
    total: 0,
    nonZero: 0,
    categories: Object.fromEntries(
      COMMAND_CATEGORIES.map((category) => [
        category,
        { total: 0, nonZero: 0 },
      ]),
    ) as Record<CommandCategory, { total: number; nonZero: number }>,
    evidenceOperations: Object.fromEntries(
      EVIDENCE_OPERATIONS.map((operation) => [
        operation,
        { total: 0, nonZero: 0 },
      ]),
    ) as Record<string, { total: number; nonZero: number }>,
    nonZeroReasons: Object.fromEntries(
      NONZERO_REASONS.map((reason) => [reason, 0]),
    ) as Record<string, number>,
  };
  let jsonEvents = 0;
  let nonJsonLines = 0;
  let costUsd = 0;
  let hasCost = false;
  let hasUsage = false;
  for (const trace of traces) {
    jsonEvents += trace.jsonEvents ?? 0;
    nonJsonLines += trace.nonJsonLines ?? 0;
    addCounts(eventTypes, trace.eventTypes ?? {});
    addCounts(itemTypes, trace.itemTypes ?? {});
    addCounts(toolTypes, trace.toolTypes ?? {});
    commands.total += trace.commands?.total ?? 0;
    commands.nonZero += trace.commands?.nonZero ?? 0;
    for (const category of COMMAND_CATEGORIES) {
      commands.categories[category].total +=
        trace.commands?.categories?.[category]?.total ?? 0;
      commands.categories[category].nonZero +=
        trace.commands?.categories?.[category]?.nonZero ?? 0;
    }
    for (const operation of EVIDENCE_OPERATIONS) {
      commands.evidenceOperations[operation]!.total +=
        trace.commands?.evidenceOperations?.[operation]?.total ?? 0;
      commands.evidenceOperations[operation]!.nonZero +=
        trace.commands?.evidenceOperations?.[operation]?.nonZero ?? 0;
    }
    for (const reason of NONZERO_REASONS)
      commands.nonZeroReasons[reason] +=
        trace.commands?.nonZeroReasons?.[reason] ?? 0;
    if (trace.usage && typeof trace.usage === "object") {
      for (const [key, value] of Object.entries(trace.usage)) {
        if (typeof value !== "number" || !Number.isFinite(value)) continue;
        usage[key] = (usage[key] ?? 0) + value;
        hasUsage = true;
      }
    }
    if (typeof trace.costUsd === "number" && Number.isFinite(trace.costUsd)) {
      costUsd += trace.costUsd;
      hasCost = true;
    }
  }
  return {
    jsonEvents,
    nonJsonLines,
    eventTypes,
    itemTypes,
    toolTypes,
    commands,
    usage: hasUsage ? usage : null,
    costUsd: hasCost ? costUsd : null,
  };
}

function finiteUsageValue(
  usage: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const key of keys) {
    const value = usage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function traceTokenUsage(trace: Record<string, unknown>): {
  inputTokens: number | null;
  outputTokens: number | null;
} {
  const model = trace.model;
  if (!model || typeof model !== "object")
    return { inputTokens: null, outputTokens: null };
  const usage = (model as Record<string, unknown>).usage;
  if (!usage || typeof usage !== "object")
    return { inputTokens: null, outputTokens: null };
  const values = usage as Record<string, unknown>;
  return {
    inputTokens: finiteUsageValue(
      values,
      "input_tokens",
      "inputTokens",
      "input",
    ),
    outputTokens: finiteUsageValue(
      values,
      "output_tokens",
      "outputTokens",
      "output",
    ),
  };
}

export function traceCostUsd(trace: Record<string, unknown>): number | null {
  const model = trace.model;
  if (!model || typeof model !== "object") return null;
  const value = (model as Record<string, unknown>).costUsd;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function envelope(raw: string): any {
  for (const line of raw.trim().split("\n").reverse()) {
    try {
      const value = JSON.parse(line);
      if (value?.data?.results) return value;
    } catch {
      // Darrow may emit compact diagnostics before its final JSON envelope.
    }
  }
  return null;
}

function phaseFromEnvelope(value: any): PhaseTrace | null {
  const phaseDuration = duration(value?.startedAt, value?.finishedAt);
  if (
    phaseDuration === null ||
    !Number.isSafeInteger(value?.exitStatus) ||
    value.exitStatus < 0
  )
    return null;
  return {
    exitStatus: value.exitStatus,
    startedAt: value.startedAt,
    finishedAt: value.finishedAt,
    durationMs: phaseDuration,
  };
}

async function phaseFromMeta(
  evidenceDirectory: string,
  phase: string,
): Promise<PhaseTrace | null> {
  const path = join(evidenceDirectory, `${phase}.meta`);
  if (!(await Bun.file(path).exists())) return null;
  const values = Object.fromEntries(
    (await readFile(path, "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
  return phaseFromEnvelope({
    exitStatus: Number(values.exit_status),
    startedAt: values.started_at,
    finishedAt: values.finished_at,
  });
}

async function cliEvidenceDirectory(
  invocation: InvocationResult,
): Promise<string | null> {
  if (!invocation.darrowRunId) return null;
  const root = join(
    invocation.workspace,
    ".darrow-attempts",
    invocation.darrowRunId,
  );
  try {
    const attempts = (await readdir(root, { withFileTypes: true }))
      .filter(
        (entry) => entry.isDirectory() && entry.name.startsWith("attempt-"),
      )
      .map((entry) => entry.name)
      .sort();
    return attempts.length ? join(root, attempts.at(-1)!) : null;
  } catch {
    return null;
  }
}

function phaseTimeline(
  result: any,
  phases: Record<string, PhaseTrace>,
): Record<string, number> | null {
  const red = phases.red;
  const green = phases.green;
  const regression = phases.regression;
  if (!red) return null;
  const values: Record<string, number | null> = {
    beforeRedMs: duration(result?.timing?.startedAt, red.startedAt),
    redExecutionMs: red.durationMs,
  };
  if (!green)
    values.afterRedWithoutGreenMs = duration(
      red.finishedAt,
      result?.timing?.finishedAt,
    );
  else {
    values.redToGreenMs = duration(red.finishedAt, green.startedAt);
    values.greenExecutionMs = green.durationMs;
    if (!regression)
      values.afterGreenWithoutRegressionMs = duration(
        green.finishedAt,
        result?.timing?.finishedAt,
      );
    else {
      values.greenToRegressionMs = duration(
        green.finishedAt,
        regression.startedAt,
      );
      values.regressionExecutionMs = regression.durationMs;
      values.afterRegressionMs = duration(
        regression.finishedAt,
        result?.timing?.finishedAt,
      );
    }
  }
  return Object.values(values).every((value) => value !== null)
    ? (values as Record<string, number>)
    : null;
}

export async function createExecutionTrace(
  invocation: InvocationResult,
  treatment: Treatment,
  evidenceDirectory?: string,
): Promise<Record<string, unknown>> {
  const darrow = treatment === "cli" ? envelope(invocation.raw) : null;
  const results: any[] = Array.isArray(darrow?.data?.results)
    ? darrow.data.results
    : [];
  const result =
    results.find((item) => item?.commandId === "darrow-delivery:implement") ??
    results[0];
  const modelInvocations: Array<{
    invocationId: string | null;
    commandId: string | null;
    durationMs: number | null;
    transcriptAvailable: boolean;
  }> = [];
  const transcripts: string[] = [];
  if (treatment !== "cli") {
    transcripts.push(invocation.raw);
    modelInvocations.push({
      invocationId: null,
      commandId: null,
      durationMs: invocation.durationMs,
      transcriptAvailable: true,
    });
  } else {
    for (const item of results) {
      const transcriptPath =
        typeof item?.transcript === "string"
          ? item.transcript
          : invocation.darrowRunId && typeof item?.invocationId === "string"
            ? join(
                invocation.workspace,
                ".darrow",
                "runs",
                invocation.darrowRunId,
                "content",
                `${item.invocationId}.jsonl`,
              )
            : null;
      let transcript = "";
      let transcriptAvailable = false;
      if (transcriptPath) {
        try {
          transcript = await readFile(transcriptPath, "utf8");
          transcriptAvailable = true;
          transcripts.push(transcript);
        } catch {
          // Keep the observability gap explicit below.
        }
      }
      modelInvocations.push({
        invocationId:
          typeof item?.invocationId === "string" ? item.invocationId : null,
        commandId: typeof item?.commandId === "string" ? item.commandId : null,
        durationMs: duration(item?.timing?.startedAt, item?.timing?.finishedAt),
        transcriptAvailable,
      });
    }
  }
  const durations = modelInvocations.map((item) => item.durationMs);
  const innerDurationMs =
    durations.length > 0 && durations.every((value) => value !== null)
      ? (durations as number[]).reduce((sum, value) => sum + value, 0)
      : null;
  const transcriptAvailable =
    modelInvocations.length > 0 &&
    modelInvocations.every((item) => item.transcriptAvailable);
  const resolvedEvidenceDirectory =
    evidenceDirectory ??
    (treatment === "cli" ? await cliEvidenceDirectory(invocation) : null);
  const phases = Object.fromEntries(
    (
      await Promise.all(
        ["red", "green", "regression"].map(async (phase) => {
          const value = result?.payload?.evidence?.[phase]
            ? phaseFromEnvelope(result.payload.evidence[phase])
            : resolvedEvidenceDirectory
              ? await phaseFromMeta(resolvedEvidenceDirectory, phase)
              : null;
          return value ? [[phase, value] as const] : [];
        }),
      )
    ).flat(),
  ) as Record<string, PhaseTrace>;
  return {
    schemaVersion: "1.3.0",
    treatment,
    treatmentSetupDurationMs: invocation.setupDurationMs,
    harnessDurationMs: invocation.durationMs,
    modelInvocationDurationMs:
      innerDurationMs ?? (treatment === "cli" ? null : invocation.durationMs),
    runtimeWrapperDurationMs:
      innerDurationMs === null
        ? null
        : Math.max(0, invocation.durationMs - innerDurationMs),
    transcriptAvailableForSummary: transcriptAvailable,
    modelInvocationCount: modelInvocations.length,
    modelInvocations,
    model: aggregateModelTraces(transcripts.map(modelTrace)),
    phases,
    timeline: phaseTimeline(result, phases),
  };
}
