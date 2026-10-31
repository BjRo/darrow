import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { parseArgs } from "node:util";
import { gunzipSync } from "node:zlib";

export interface Tokens {
  input_tokens: number;
  cached_input_tokens: number;
  cache_write_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}
interface Event {
  type: string;
  payload: {
    id?: string;
    model?: string;
    type?: string;
    source?: {
      subagent?: {
        thread_spawn?: {
          parent_thread_id: string;
          depth?: number;
          agent_path?: string;
        };
      };
    };
    info?: { total_token_usage: Tokens; last_token_usage: Tokens } | null;
  };
}
interface CapturedFile {
  path: string;
  sha256: string;
  gzipBase64: string;
}
interface Bundle {
  rootSessionId: string;
  completeness: string;
  issues: string[];
  files: CapturedFile[];
}
interface Measurement {
  track: string;
  task: string;
  mode: string;
  execution: string;
  candidateSeconds: number;
  rawEvidence: string;
}
const rates: Record<string, { input: number; cached: number; output: number }> =
  {
    "gpt-6.1-sol": { input: 2, cached: 0.1, output: 10 },
    "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  };
function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
function validateTokens(tokens: Tokens) {
  const keys: Array<keyof Tokens> = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
  ];
  if (
    keys.some((key) => !Number.isSafeInteger(tokens[key]) || tokens[key] < 0) ||
    tokens.total_tokens !== tokens.input_tokens + tokens.output_tokens ||
    tokens.cached_input_tokens + tokens.cache_write_input_tokens >
      tokens.input_tokens ||
    tokens.reasoning_output_tokens > tokens.output_tokens
  )
    throw new Error("Invalid native token counters");
}
function validateIncrement(
  previous: Tokens | null,
  next: Tokens,
  last: Tokens,
) {
  const keys = Object.keys(next) as Array<keyof Tokens>;
  if (previous && keys.every((key) => previous[key] === next[key])) return;
  if (keys.some((key) => next[key] - (previous?.[key] ?? 0) !== last[key]))
    throw new Error(
      "Cumulative counters do not reconcile with per-request usage",
    );
}
function counters(events: Event[]) {
  let usage: Tokens | null = null;
  let maxPromptInput = 0;
  let lastUsage = -1;
  let lastComplete = -1;
  let requestCount = 0;
  let previousTotal = 0;
  for (const [index, event] of events.entries()) {
    if (event.type !== "event_msg") continue;
    if (event.payload.type === "task_complete") lastComplete = index;
    if (event.payload.type !== "token_count" || !event.payload.info) continue;
    const next = event.payload.info.total_token_usage;
    validateTokens(next);
    validateTokens(event.payload.info.last_token_usage);
    if (
      usage &&
      (Object.keys(next) as Array<keyof Tokens>).some(
        (key) => next[key] < usage![key],
      )
    )
      throw new Error("Native cumulative usage regressed");
    validateIncrement(usage, next, event.payload.info.last_token_usage);
    if (next.total_tokens > previousTotal) requestCount++;
    previousTotal = next.total_tokens;
    usage = next;
    lastUsage = index;
    maxPromptInput = Math.max(
      maxPromptInput,
      event.payload.info.last_token_usage.input_tokens,
    );
  }
  return {
    usage,
    maxPromptInput,
    requestCount,
    completed: lastComplete > lastUsage,
  };
}

function sessionProvenance(metadata: Event["payload"]) {
  const spawned = metadata.source?.subagent?.thread_spawn;
  return {
    parentId: spawned?.parent_thread_id ?? null,
    depth: spawned ? (spawned.depth ?? null) : 0,
    agentPath: spawned?.agent_path ?? null,
  };
}
/** Retrospective only: read counters, never execute transcript contents. */
export function summarizeTranscript(text: string) {
  const events = text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Event);
  const metadata = events.find(
    (event) => event.type === "session_meta",
  )?.payload;
  const models = new Set(
    events
      .filter((event) => event.type === "turn_context")
      .map((event) => event.payload.model),
  );
  if (!metadata?.id || models.size !== 1 || models.has(undefined))
    throw new Error("Missing session identity or ambiguous model");
  return {
    sessionId: metadata.id,
    ...sessionProvenance(metadata),
    model: [...models][0]!,
    ...counters(events),
  };
}

export function standardApiCost(
  model: string,
  usage: Tokens,
  maxPrompt: number,
) {
  const rate = rates[model];
  if (!rate || maxPrompt > 272000 || usage.cache_write_input_tokens !== 0)
    throw new Error(
      "Pricing requires a known short-context model and no cache writes",
    );
  return (
    ((usage.input_tokens - usage.cached_input_tokens) * rate.input +
      usage.cached_input_tokens * rate.cached +
      usage.output_tokens * rate.output) /
    1e6
  );
}
function sumTokens(values: Tokens[]) {
  if (values.length === 0) return null;
  return values.reduce(
    (total, value) => {
      for (const key of Object.keys(total) as Array<keyof Tokens>)
        total[key] += value[key];
      return total;
    },
    {
      input_tokens: 0,
      cached_input_tokens: 0,
      cache_write_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 0,
    },
  );
}
function readCapturedSession(file: CapturedFile) {
  const bytes = gunzipSync(Buffer.from(file.gzipBase64, "base64"));
  if (digest(bytes) !== file.sha256)
    throw new Error("Transcript hash mismatch");
  const session = summarizeTranscript(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  return {
    ...session,
    path: file.path,
    sha256: file.sha256,
    standardApiEquivalentUsd: session.usage
      ? standardApiCost(session.model, session.usage, session.maxPromptInput)
      : null,
  };
}
export function recoverBundle(bundle: Bundle) {
  const sessions = new Map<string, ReturnType<typeof readCapturedSession>>();
  for (const file of bundle.files) {
    const session = readCapturedSession(file);
    const previous = sessions.get(session.sessionId);
    if (previous && previous.sha256 !== file.sha256)
      throw new Error("Conflicting copies of one native session");
    sessions.set(session.sessionId, session);
  }
  const retained = [...sessions.values()];
  if (!sessions.has(bundle.rootSessionId))
    throw new Error("Root session missing");
  const complete =
    bundle.completeness === "complete" &&
    bundle.issues.length === 0 &&
    retained.every(
      (s) =>
        s.usage && s.completed && (!s.parentId || sessions.has(s.parentId)),
    );
  return {
    completeness: complete ? "complete" : "lower_bound",
    captureCompleteness: bundle.completeness,
    captureIssues: bundle.issues,
    observedTokens: sumTokens(
      retained.flatMap((s) => (s.usage ? [s.usage] : [])),
    ),
    standardApiEquivalentUsd: retained.some((s) => s.usage)
      ? retained.reduce((sum, s) => sum + (s.standardApiEquivalentUsd ?? 0), 0)
      : null,
    rootSessionId: bundle.rootSessionId,
    sessions: retained,
  };
}
async function recoverRow(row: Measurement) {
  const evidence = JSON.parse(await readFile(row.rawEvidence, "utf8"));
  const artifact = evidence.trials[0].artifactRefs.find(
    (value: { id: string }) => value.id === "sevro.native-transcripts.bundle",
  );
  if (!artifact)
    throw new Error("No retained native transcripts for " + row.task);
  const bytes = await readFile(new URL(artifact.path));
  if (digest(bytes) !== artifact.sha256)
    throw new Error("Bundle hash mismatch");
  return {
    track: row.track,
    task: row.task,
    mode: row.mode,
    execution: row.execution,
    candidateSeconds: row.candidateSeconds,
    sourceEvidence: row.rawEvidence,
    bundle: { path: artifact.path, sha256: artifact.sha256 },
    ...recoverBundle(JSON.parse(bytes.toString()) as Bundle),
  };
}
type Recovered = Awaited<ReturnType<typeof recoverRow>>;
function sessionGroups(rows: Recovered[]) {
  const groups = new Map<
    string,
    {
      model: string;
      depth: number | null;
      sessions: number;
      tokens: number;
      usd: number;
    }
  >();
  for (const row of rows)
    for (const session of row.sessions) {
      if (!session.usage || session.standardApiEquivalentUsd === null) continue;
      const key = `${session.model}:${session.depth}`;
      const group = groups.get(key) ?? {
        model: session.model,
        depth: session.depth,
        sessions: 0,
        tokens: 0,
        usd: 0,
      };
      group.sessions++;
      group.tokens += session.usage.total_tokens;
      group.usd += session.standardApiEquivalentUsd;
      groups.set(key, group);
    }
  return [...groups.values()].map((group) => ({
    model: group.model,
    depth: group.depth,
    observedSessions: group.sessions,
    meanObservedTokens: group.tokens / rows.length,
    meanStandardApiEquivalentUsd: group.usd / rows.length,
  }));
}
function mainThreadUsage(rows: Recovered[]) {
  const mains = rows.map((row) =>
    row.sessions.find((session) => session.sessionId === row.rootSessionId)!,
  );
  const requests = mains.reduce((sum, main) => sum + main.requestCount, 0);
  return {
    meanRequestsPerTask: requests / rows.length,
    meanPromptInput: requests
      ? mains.reduce((sum, main) => sum + main.usage!.input_tokens, 0) /
        requests
      : null,
  };
}
function aggregate(rows: Recovered[]) {
  if (rows.length === 0) throw new Error("Empty usage comparison");
  if (
    rows.some(
      (row) =>
        row.observedTokens === null || row.standardApiEquivalentUsd === null,
    )
  )
    throw new Error("Missing usage cannot be aggregated as zero");
  return {
    sessionGroups: sessionGroups(rows),
    mainThreadUsage: mainThreadUsage(rows),
    attempts: rows.length,
    completeness: rows.every((r) => r.completeness === "complete")
      ? "complete"
      : "lower_bound",
    meanSeconds:
      rows.reduce((sum, r) => sum + r.candidateSeconds, 0) / rows.length,
    meanObservedTokens:
      rows.reduce((sum, r) => sum + r.observedTokens!.total_tokens, 0) /
      rows.length,
    meanStandardApiEquivalentUsd:
      rows.reduce((sum, r) => sum + r.standardApiEquivalentUsd!, 0) /
      rows.length,
    observedTokens: sumTokens(rows.map((r) => r.observedTokens!)),
  };
}
function comparisons(rows: Recovered[]) {
  return ["implementation", "delivery"].map((track) => {
    const mode = track === "implementation" ? "adaptive-goal" : "ticket-to-pr";
    const candidate = rows.filter(
      (r) =>
        r.track === track && r.mode === mode && r.execution === "completed",
    );
    const vanilla = rows.filter(
      (r) =>
        r.track === track &&
        r.mode === "vanilla" &&
        candidate.some((c) => c.task === r.task),
    );
    return {
      track,
      tasks: candidate.map((r) => r.task),
      vanilla: aggregate(vanilla),
      candidate: aggregate(candidate),
    };
  });
}

export async function recoverValueUsage(snapshot: string) {
  const bytes = await readFile(snapshot);
  const source = JSON.parse(bytes.toString()) as { rows: Measurement[] };
  const rows = await Promise.all(source.rows.map(recoverRow));
  const script = await readFile(new URL(import.meta.url));
  return {
    format: "darrow-current-value-native-usage-v1",
    reconstruction: {
      script: "evals/experiments/orchestration/recover-value-usage.ts",
      sha256: digest(script),
    },
    sourceSnapshot: { path: snapshot, sha256: digest(bytes) },
    pricing: {
      date: "2026-10-30",
      source: "https://developers.openai.com/api/docs/pricing",
      basis:
        "Standard short-context API equivalent; not a Codex subscription charge",
      ratesPerMillionTokens: rates,
      cacheWritesObserved: 0,
      longContextRequestsObserved: 0,
      maxPromptInputTokensObserved: Math.max(
        ...rows.flatMap((row) =>
          row.sessions.map((session) => session.maxPromptInput),
        ),
      ),
    },
    methodology:
      "Final cumulative counters once per distinct retained session; include parent and delegates. Each cumulative increment is reconciled with per-request usage. Cached input and reasoning output are subsets. Partial bundles remain lower bounds. Original Sevro usage fields are unchanged.",
    aggregates: ["implementation", "delivery"].flatMap((track) => {
      const modes =
        track === "implementation"
          ? ["vanilla", "adaptive-goal"]
          : ["vanilla", "ticket-to-pr"];
      return modes.map((mode) => ({
        track,
        mode,
        ...aggregate(rows.filter((r) => r.track === track && r.mode === mode)),
      }));
    }),
    pairedComparisons: comparisons(rows),
    rows,
  };
}
if (import.meta.main) {
  const { values } = parseArgs({
    options: { snapshot: { type: "string" }, output: { type: "string" } },
  });
  if (
    !values.snapshot ||
    !values.output ||
    !isAbsolute(values.snapshot) ||
    !isAbsolute(values.output) ||
    values.snapshot === values.output
  )
    throw new Error("Supply distinct absolute --snapshot and --output paths");
  const result = await recoverValueUsage(values.snapshot);
  await writeFile(values.output, JSON.stringify(result, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        output: values.output,
        aggregates: result.aggregates,
        pairedComparisons: result.pairedComparisons,
      },
      null,
      2,
    ),
  );
}
