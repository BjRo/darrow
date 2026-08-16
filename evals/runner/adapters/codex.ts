import { readFile, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  HarnessAdapter,
  HarnessResult,
  SkillActivationObservation,
} from "../types";
import { sandboxedAgentCommand } from "../sandbox";
import { isolatedHarnessEnvironment } from "../environment";
import { captureProcess } from "../process";

interface CodexUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface CodexEvent {
  type?: unknown;
  usage?: CodexUsage;
  msg?: { type?: unknown; info?: { total_token_usage?: CodexUsage } };
  info?: { total_token_usage?: CodexUsage };
  item?: {
    type?: unknown;
    command?: unknown;
    exit_code?: unknown;
    status?: unknown;
    aggregated_output?: unknown;
    tool?: unknown;
    prompt?: unknown;
    receiver_thread_ids?: unknown;
    receiverThreadIds?: unknown;
  };
  [key: string]: unknown;
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

function codexStreamMalformed(stream: string): boolean {
  return stream.split("\n").some((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) return false;
    try {
      JSON.parse(trimmed);
      return false;
    } catch {
      return true;
    }
  });
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

function completedCommand(event: CodexEvent): string | undefined {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution" ||
    typeof event.item.command !== "string" ||
    event.item.exit_code !== 0 ||
    event.item.status !== "completed"
  )
    return undefined;
  return event.item.command;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shellPayload(command: string): string | undefined {
  const wrapper = command.match(
    /^\/bin\/(?:ba|z)?sh\s+-lc\s+(["'])([\s\S]*)\1$/,
  );
  return wrapper?.[2] ?? command;
}

type SkillsRoots = string | string[];

function skillReads(command: string, skillsRoots: SkillsRoots): string[] {
  const payload = shellPayload(command);
  if (!payload) return [];
  const reads: string[] = [];
  for (const skillsRoot of [skillsRoots].flat()) {
    const path = `${escapeRegExp(skillsRoot)}/([A-Za-z0-9._-]+)/SKILL\\.md`;
    const reader = new RegExp(
      `^(?:cat|sed(?:\\s+-n)?(?:\\s+['"]?[0-9,$pn;-]+['"]?)?|awk(?:\\s+['"][^'"]+['"])?|head(?:\\s+-n?\\s*[1-9][0-9]*)?|tail(?:\\s+-n?\\s*[1-9][0-9]*)?|less|more)\\s+${path}$`,
    );
    for (const segment of payload.split(/\s*(?:&&|;|\n)\s*/)) {
      const match = segment.match(reader);
      if (match?.[1] && !reads.includes(match[1])) reads.push(match[1]);
    }
  }
  return reads;
}

function malformedCompletedCommand(event: CodexEvent): boolean {
  if (
    event.type !== "item.completed" ||
    event.item?.type !== "command_execution"
  )
    return false;
  return (
    typeof event.item.command !== "string" ||
    typeof event.item.exit_code !== "number" ||
    (event.item.status !== "completed" && event.item.status !== "failed")
  );
}

function observedSkillReads(
  events: CodexEvent[],
  skillsRoots: SkillsRoots,
): string[] {
  const observedSkills: string[] = [];
  for (const event of events) {
    const command = completedCommand(event);
    const output = event.item?.aggregated_output;
    const skills = command ? skillReads(command, skillsRoots) : [];
    for (const skill of skills) {
      if (
        typeof output === "string" &&
        new RegExp(
          `(?:^|\\n)---\\nname:\\s*${escapeRegExp(skill)}(?:\\n|$)`,
        ).test(output) &&
        !observedSkills.includes(skill)
      )
        observedSkills.push(skill);
    }
  }
  return observedSkills;
}

/**
 * Codex exposes command events but no native skill-invocation event. A visible
 * completed mounted SKILL.md read is useful controlled-probe evidence, but an
 * otherwise successful turn with no visible read is unobservable rather than a
 * measured non-selection. Activation evals provide a separate private sentinel
 * for that case.
 */
export function codexSkillActivation(
  stream: string,
  repoDir: string,
  installedSkillsRoots: SkillsRoots = join(repoDir, ".agents", "skills"),
): SkillActivationObservation {
  const events = codexEvents(stream);
  const observedSkills = observedSkillReads(events, installedSkillsRoots);
  let completed = false;
  let failed = false;
  for (const event of events) {
    const types = codexEventTypes(event);
    if (types.includes("turn.completed")) completed = true;
    if (types.includes("turn.failed")) failed = true;
  }
  return {
    source: "skill_file_read_probe",
    complete:
      completed &&
      !failed &&
      !codexStreamMalformed(stream) &&
      !events.some(malformedCompletedCommand) &&
      observedSkills.length > 0,
    primarySkill: observedSkills[0] ?? null,
    observedSkills,
  };
}

function retainedTerminalEvent(event: CodexEvent): unknown | undefined {
  const types = codexEventTypes(event);
  const terminal = types.find(
    (type) => type === "turn.completed" || type === "turn.failed",
  );
  if (!terminal) return undefined;
  const usage = normalizedCodexUsage(codexUsageCandidate(event).value);
  return usage ? { type: terminal, usage } : { type: terminal };
}

function retainedCollaborationEvent(event: CodexEvent): unknown | undefined {
  const item = event.item;
  if (
    event.type !== "item.completed" ||
    item?.type !== "collab_tool_call" ||
    typeof item.tool !== "string" ||
    item.status !== "completed"
  )
    return undefined;
  const prompt =
    typeof item.prompt === "string"
      ? item.prompt
          .split("\n")
          .filter((line) =>
            /^- (?:phase|iteration|stable_child_id|required skill|phase_skill): /.test(
              line,
            ),
          )
          .join("\n")
      : undefined;
  return {
    type: "item.completed",
    item: {
      type: item.type,
      tool: item.tool,
      status: "completed",
      receiver_thread_ids: item.receiver_thread_ids ?? item.receiverThreadIds,
      ...(prompt ? { prompt } : {}),
    },
  };
}

function retainedHostProtocolEvent(event: CodexEvent): unknown | undefined {
  if (
    event.type !== "darrow.route_applied" &&
    event.type !== "darrow.dimensions_applied" &&
    event.type !== "darrow.workflow_loaded"
  )
    return undefined;
  const allowed = [
    "type",
    "accepted",
    "threadId",
    "turnId",
    "selected",
    "effective",
    "appliedBy",
    "stage",
    "workflow",
    "risk",
    "file",
    "sha256",
  ];
  return Object.fromEntries(
    allowed.flatMap((key) =>
      event[key] === undefined ? [] : [[key, event[key]]],
    ),
  );
}

function retainedNestedApplication(event: CodexEvent): unknown | undefined {
  const item = event.item;
  if (
    event.type !== "item.completed" ||
    item?.type !== "command_execution" ||
    item.status !== "completed" ||
    item.exit_code !== 0 ||
    typeof item.aggregated_output !== "string" ||
    !/^format\tdarrow-native-goal-route-application-v1$/m.test(
      item.aggregated_output,
    ) ||
    !/^route_applied_by\tnested-session$/m.test(item.aggregated_output) ||
    !/^route_verified\ttrue$/m.test(item.aggregated_output)
  )
    return undefined;
  const protocol = item.aggregated_output
    .split("\n")
    .filter((line) =>
      /^(?:format|route_applied_by|route_verified|selected_route|effective_route)\t/.test(
        line,
      ),
    );
  const completed = codexEvents(item.aggregated_output)
    .filter((nested) => codexEventTypes(nested).includes("turn.completed"))
    .map(retainedTerminalEvent)
    .filter((nested): nested is object => nested !== undefined);
  return {
    type: "item.completed",
    item: {
      type: "command_execution",
      status: "completed",
      exit_code: 0,
      aggregated_output: [
        ...completed.map((value) => JSON.stringify(value)),
        ...protocol,
      ].join("\n"),
    },
  };
}

/** Retain only bounded activation, orchestration, and terminal accounting evidence. */
export function retainedCodexEvidence(
  stream: string,
  repoDir: string,
  status?: { exitCode: number; stderrPresent: boolean },
  installedSkillsRoots: SkillsRoots = join(repoDir, ".agents", "skills"),
): string {
  const events = codexEvents(stream);
  const retained = events.flatMap((event) => {
    const values = [
      retainedTerminalEvent(event),
      retainedHostProtocolEvent(event),
      retainedCollaborationEvent(event),
      retainedNestedApplication(event),
    ].filter((value): value is object => value !== undefined);
    return values;
  });
  for (const skill of observedSkillReads(events, installedSkillsRoots)) {
    retained.push({
      type: "darrow.skill_read_probe",
      source: "skill_file_read_probe",
      skill,
      status: "completed",
    });
  }
  if (codexStreamMalformed(stream)) retained.push({ type: "malformed_stream" });
  if (status && status.exitCode !== 0)
    retained.push({
      type: "harness_failure",
      exit_code: status.exitCode,
      stderr_present: status.stderrPresent,
    });
  return retained.map((event) => JSON.stringify(event)).join("\n");
}

interface CodexTokenUsage {
  complete: boolean;
  inputTokens: number;
  outputTokens: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function codexUsageCandidate(event: CodexEvent): {
  present: boolean;
  value?: unknown;
} {
  if ("usage" in event) return { present: true, value: event.usage };
  const message = isRecord(event.msg) ? event.msg : undefined;
  const messageInfo = isRecord(message?.info) ? message.info : undefined;
  if (messageInfo && "total_token_usage" in messageInfo)
    return { present: true, value: messageInfo.total_token_usage };
  const info = isRecord(event.info) ? event.info : undefined;
  if (info && "total_token_usage" in info)
    return { present: true, value: info.total_token_usage };
  return { present: false };
}

function normalizedCodexUsage(
  value: unknown,
): { input_tokens: number; output_tokens: number } | null {
  if (!isRecord(value)) return null;
  const input = value.input_tokens;
  const output = value.output_tokens;
  if (
    typeof input !== "number" ||
    !Number.isFinite(input) ||
    input < 0 ||
    typeof output !== "number" ||
    !Number.isFinite(output) ||
    output < 0
  )
    return null;
  return { input_tokens: input, output_tokens: output };
}

/** Codex reports cumulative usage repeatedly; the last report on the stream wins. */
export function codexTokenUsage(stream: string): CodexTokenUsage {
  let lastUsage: unknown;
  let found = false;
  for (const event of codexEvents(stream)) {
    const candidate = codexUsageCandidate(event);
    if (!candidate.present) continue;
    found = true;
    lastUsage = candidate.value;
  }
  const usage = normalizedCodexUsage(lastUsage);
  if (!found || !usage || codexStreamMalformed(stream))
    return { complete: false, inputTokens: 0, outputTokens: 0 };
  return {
    complete: true,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
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
    "--ignore-rules",
    "--dangerously-bypass-approvals-and-sandbox",
    // Final agent message lands under .git/ so checks can read it without
    // it ever appearing in the model's worktree (same trick as fixture-bin).
    "-o",
    join(repoDir, ".git", "last-message.md"),
  ];
}

async function runCodexPluginCommand(
  argv: string[],
  env: Record<string, string>,
): Promise<string> {
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe", env });
  const { out, err, code } = await captureProcess(proc);
  if (code !== 0)
    throw new Error(`Codex eval plugin setup failed (${code}): ${err.trim()}`);
  return out;
}

async function installCodexEvalPlugin(
  repoDir: string,
  env: Record<string, string>,
): Promise<string[]> {
  const marketplace = join(repoDir, ".git", "eval-marketplace");
  const manifest = JSON.parse(
    await readFile(
      join(marketplace, ".claude-plugin", "marketplace.json"),
      "utf8",
    ),
  ) as { plugins?: Array<{ name?: unknown }> };
  const pluginNames = manifest.plugins?.map(({ name }) => name) ?? [];
  if (
    pluginNames.length === 0 ||
    pluginNames.some((name) => typeof name !== "string" || !name)
  )
    throw new Error("Codex eval marketplace has an invalid plugin name");
  await runCodexPluginCommand(
    ["codex", "plugin", "marketplace", "add", marketplace, "--json"],
    env,
  );
  const roots: string[] = [];
  for (const name of pluginNames as string[]) {
    const installed = JSON.parse(
      await runCodexPluginCommand(
        ["codex", "plugin", "add", `${name}@darrow-eval`, "--json"],
        env,
      ),
    ) as { installedPath?: unknown };
    if (typeof installed.installedPath !== "string" || !installed.installedPath)
      throw new Error("Codex eval plugin install returned no installed path");
    roots.push(await realpath(join(installed.installedPath, "skills")));
  }
  return roots;
}

export async function codexEvalSkillsRoots(
  repoDir: string,
  env: Record<string, string>,
): Promise<string[]> {
  const marketplaceManifest = join(
    repoDir,
    ".git",
    "eval-marketplace",
    ".claude-plugin",
    "marketplace.json",
  );
  return existsSync(marketplaceManifest)
    ? installCodexEvalPlugin(repoDir, env)
    : [join(repoDir, ".git", "eval-no-skills")];
}

export async function codexEvalSkillsRoot(
  repoDir: string,
  env: Record<string, string>,
): Promise<string> {
  return (await codexEvalSkillsRoots(repoDir, env))[0]!;
}

async function codexFinalMessage(repoDir: string): Promise<string> {
  try {
    return await readFile(join(repoDir, ".git", "last-message.md"), "utf8");
  } catch {
    // A missing final message is observable to output checks and raw output.
    return "";
  }
}

interface CodexExecution {
  canonicalRepoDir: string;
  installedSkillsRoots: string[];
  out: string;
  err: string;
  code: number;
  durationMs: number;
}

async function executeCodex(
  repoDir: string,
  prompt: string,
  model: string,
  effort: string,
): Promise<CodexExecution> {
  const start = performance.now();
  const canonicalRepoDir = await realpath(repoDir);
  const env = await isolatedHarnessEnvironment("codex", repoDir);
  const installedSkillsRoots = await codexEvalSkillsRoots(repoDir, env);
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
  const { out, err, code } = await captureProcess(proc);
  return {
    canonicalRepoDir,
    installedSkillsRoots,
    out,
    err,
    code,
    durationMs: performance.now() - start,
  };
}

/**
 * Runs the skill via headless Codex (`codex exec`). The fixture source is
 * installed into the isolated Codex plugin cache through a local marketplace,
 * matching installed-plugin discovery without a shadowing project skill.
 * Native approvals are bypassed inside the runner's outer OS sandbox.
 * Codex reports token usage in its JSONL event stream but no cost — costUsd
 * stays null for this adapter.
 */
export const codexAdapter: HarnessAdapter = {
  name: "codex",
  defaultModel: "gpt-5.5",
  skillMounts: [],
  sourceCodexPlugin: true,

  async version(): Promise<string> {
    const proc = Bun.spawn(["codex", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const { out } = await captureProcess(proc);
    return out.trim();
  },

  async run(repoDir, prompt, model, effort): Promise<HarnessResult> {
    const execution = await executeCodex(repoDir, prompt, model, effort);
    const {
      canonicalRepoDir,
      installedSkillsRoots,
      out,
      err,
      code,
      durationMs,
    } = execution;

    const {
      complete: tokenUsageComplete,
      inputTokens,
      outputTokens,
    } = codexTokenUsage(out);
    const ok = codexRunSucceeded(code, out);
    const resultText = await codexFinalMessage(repoDir);
    const skillActivation = codexSkillActivation(
      out,
      canonicalRepoDir,
      installedSkillsRoots,
    );

    return {
      ok,
      durationMs,
      tokenUsageComplete,
      inputTokens,
      outputTokens,
      costUsd: null,
      resultText,
      raw: retainedCodexEvidence(
        out,
        canonicalRepoDir,
        {
          exitCode: code,
          stderrPresent: err.trim().length > 0,
        },
        installedSkillsRoots,
      ),
      skillActivation: {
        ...skillActivation,
        complete: ok && skillActivation.complete,
      },
    };
  },
};
