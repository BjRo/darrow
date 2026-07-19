import {
  chmod,
  cp,
  mkdir,
  readFile,
  realpath,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import type {
  EffectiveRoute,
  Harness,
  Phase,
  Protocol,
  Route,
  Treatment,
} from "./types";
import { command, shellQuote, terminateProcessTree } from "./process";
import { temporalExecutable } from "./toolchain";

export interface InvocationResult {
  ok: boolean;
  waiting: boolean;
  timedOut: boolean;
  setupDurationMs: number;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  raw: string;
  darrowRunId: string | null;
  workspace: string;
  patchBaseCommit: string | null;
}

const CLAUDE_EVALUATION_TOOLS =
  "Bash,Edit,Read,Write,Glob,Grep,StructuredOutput";

function evaluationExecutable(
  harness: Harness,
  route: Route,
  state: string,
): string {
  return harness === "claude"
    ? join(state, "harness-bin", "claude")
    : route.executable;
}

async function prepareClaudeLauncher(
  route: Route,
  state: string,
): Promise<string> {
  const bin = join(state, "harness-bin");
  const launcher = join(bin, "claude");
  await mkdir(bin, { recursive: true });
  await writeFile(
    launcher,
    [
      "#!/bin/sh",
      'if [ "${1-}" = "--version" ]; then',
      `  exec ${shellQuote(route.executable)} "$@"`,
      "fi",
      `exec ${shellQuote(route.executable)} --tools ${shellQuote(CLAUDE_EVALUATION_TOOLS)} --permission-mode acceptEdits --allowedTools ${shellQuote(CLAUDE_EVALUATION_TOOLS)} --setting-sources user,project --no-session-persistence "$@"`,
      "",
    ].join("\n"),
  );
  await chmod(launcher, 0o755);
  return bin;
}

async function commitEvaluationSetup(repo: string): Promise<string> {
  const add = await command(
    ["git", "add", "-A", "--", ".darrow", ".gitignore", ".gitattributes"],
    repo,
  );
  if (add.code !== 0)
    throw new Error(
      `cannot stage evaluator-owned Darrow setup: ${add.stderr.trim()}`,
    );
  const staged = await command(["git", "diff", "--cached", "--quiet"], repo);
  if (staged.code === 1) {
    const commit = await command(
      [
        "git",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-m",
        "chore: configure evaluation workflow",
      ],
      repo,
    );
    if (commit.code !== 0)
      throw new Error(
        `cannot checkpoint evaluator-owned Darrow setup: ${commit.stderr.trim()}`,
      );
  } else if (staged.code !== 0)
    throw new Error(
      `cannot inspect evaluator-owned Darrow setup: ${staged.stderr.trim()}`,
    );
  const revision = await command(["git", "rev-parse", "HEAD"], repo);
  if (revision.code !== 0)
    throw new Error(
      `cannot resolve evaluator setup revision: ${revision.stderr.trim()}`,
    );
  return revision.stdout.trim();
}

function sandboxProfile(
  writeRoot: string,
  hiddenPaths: string[],
  readablePaths: string[],
): string {
  const escaped = hiddenPaths.map((path) =>
    path.replaceAll("\\", "\\\\").replaceAll('"', '\\"'),
  );
  const readable = readablePaths.map((path) =>
    path.replaceAll("\\", "\\\\").replaceAll('"', '\\"'),
  );
  const writable = writeRoot.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  return [
    "(version 1)",
    `(allow file-write*
  (subpath "${writable}")
  (literal "/dev/null")
  (literal "/dev/random")
  (literal "/dev/zero")
  (regex #"^/dev/fd/[0-9]+$"))`,
    ...escaped.flatMap((path) => [
      `(deny file-read* (subpath "${path}"))`,
      `(deny file-write* (subpath "${path}"))`,
    ]),
    "(deny file-write*)",
    "(allow default)",
    ...readable.map((path) => `(allow file-read* (literal "${path}"))`),
  ].join("\n");
}

export async function sandboxed(
  argv: string[],
  state: string,
  hiddenPaths: string[],
  readablePaths: string[] = [],
): Promise<string[]> {
  if (process.platform !== "darwin")
    throw new Error(
      "product-value harness isolation requires macOS sandbox-exec or an external container boundary",
    );
  const profile = join(state, "evaluation.sb");
  const [writeRoot, canonicalHiddenPaths, canonicalReadablePaths] =
    await Promise.all([
      realpath(dirname(state)),
      Promise.all(hiddenPaths.map((path) => realpath(path))),
      Promise.all(readablePaths.map((path) => realpath(path))),
    ]);
  await writeFile(
    profile,
    sandboxProfile(writeRoot, canonicalHiddenPaths, canonicalReadablePaths),
  );
  return ["/usr/bin/sandbox-exec", "-f", profile, ...argv];
}

export async function isolatedEnvironment(
  harness: Harness,
  route: Route,
  state: string,
): Promise<Record<string, string | undefined>> {
  const allowedEnvironment = [
    "PATH",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "TERM",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "CLAUDE_CODE_OAUTH_TOKEN",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
  ];
  const cleanEnvironment = Object.fromEntries(
    allowedEnvironment.flatMap((name) =>
      process.env[name] === undefined ? [] : [[name, process.env[name]]],
    ),
  );
  const sourceRoot =
    harness === "codex"
      ? (process.env.CODEX_HOME ?? resolve(process.env.HOME ?? "", ".codex"))
      : (process.env.CLAUDE_CONFIG_DIR ??
        resolve(process.env.HOME ?? "", ".claude"));
  const targetRoot = join(state, harness);
  const tempRoot = join(state, "tmp");
  await Promise.all([
    mkdir(targetRoot, { recursive: true }),
    mkdir(tempRoot, { recursive: true }),
  ]);
  let copiedCredentials = 0;
  for (const relativePath of route.authFiles) {
    if (harness === "claude" && relativePath === ".credentials.json") continue;
    const source = resolve(sourceRoot, relativePath);
    const target = resolve(targetRoot, relativePath);
    if (await Bun.file(source).exists()) {
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
      await chmod(target, 0o600);
      copiedCredentials += 1;
      continue;
    }
  }
  const environmentCredential =
    harness === "codex"
      ? cleanEnvironment.OPENAI_API_KEY
      : (cleanEnvironment.ANTHROPIC_API_KEY ??
        cleanEnvironment.CLAUDE_CODE_OAUTH_TOKEN);
  if (
    (harness === "claude" || route.authFiles.length > 0) &&
    copiedCredentials === 0 &&
    !environmentCredential
  )
    throw new Error(
      harness === "claude"
        ? "claude evaluation requires ANTHROPIC_API_KEY or a dedicated CLAUDE_CODE_OAUTH_TOKEN; rotating login credentials are not copied"
        : `${harness} credentials are unavailable in the isolated environment`,
    );
  if (harness === "codex") {
    await writeFile(
      join(targetRoot, "config.toml"),
      `approval_policy = "never"\nsandbox_mode = "danger-full-access"\n`,
    );
    return {
      ...cleanEnvironment,
      HOME: state,
      TMPDIR: tempRoot,
      CODEX_HOME: targetRoot,
    };
  }
  const launcherBin = await prepareClaudeLauncher(route, state);
  await writeFile(
    join(targetRoot, "settings.json"),
    JSON.stringify(
      {
        permissions: {
          defaultMode: "acceptEdits",
          allow: ["Bash", "Edit", "Read", "Write", "Glob", "Grep"],
        },
      },
      null,
      2,
    ),
  );
  return {
    ...cleanEnvironment,
    PATH: `${launcherBin}:${cleanEnvironment.PATH ?? ""}`,
    HOME: state,
    TMPDIR: tempRoot,
    CLAUDE_CODE_TMPDIR: tempRoot,
    CLAUDE_CONFIG_DIR: targetRoot,
  };
}

async function runtimePid(path: string): Promise<number | null> {
  try {
    const value = (await Bun.file(path).json()) as { pid?: unknown };
    return Number.isSafeInteger(value.pid) && Number(value.pid) > 1
      ? Number(value.pid)
      : null;
  } catch {
    return null;
  }
}

export async function cleanupDarrowRuntime(
  repo: string,
  graceMs = 1_000,
): Promise<void> {
  const runtime = join(repo, ".darrow", "runtime");
  const [workerPid, servicePid] = await Promise.all([
    runtimePid(join(runtime, "worker.json")),
    runtimePid(join(runtime, "service.json")),
  ]);
  for (const pid of [workerPid, servicePid]) {
    if (pid !== null) await terminateProcessTree(pid, graceMs);
  }
}

function codexUsage(raw: string): {
  input: number | null;
  output: number | null;
} {
  let input: number | null = null;
  let output: number | null = null;
  for (const line of raw.split("\n")) {
    try {
      const event = JSON.parse(line);
      const usage = event.usage ?? event.msg?.info?.total_token_usage;
      if (usage) {
        input = usage.input_tokens ?? input;
        output = usage.output_tokens ?? output;
      }
    } catch {
      // JSONL streams can contain non-JSON diagnostics.
    }
  }
  return { input, output };
}

async function runNative(
  harness: Harness,
  route: EffectiveRoute,
  repo: string,
  state: string,
  prompt: string,
  hiddenPaths: string[],
  timeoutMs: number,
  outputSchema?: string,
): Promise<InvocationResult> {
  const env = await isolatedEnvironment(harness, route, state);
  if (harness === "codex") {
    const result = await command(
      await sandboxed(
        [
          evaluationExecutable(harness, route, state),
          "exec",
          prompt,
          "--json",
          ...(outputSchema ? ["--output-schema", outputSchema] : []),
          "--ephemeral",
          "--ignore-user-config",
          "--ignore-rules",
          "--dangerously-bypass-approvals-and-sandbox",
          "-m",
          route.model,
          "-c",
          `model_reasoning_effort="${route.effort}"`,
          "--skip-git-repo-check",
        ],
        state,
        hiddenPaths,
      ),
      repo,
      env,
      timeoutMs,
    );
    const usage = codexUsage(result.stdout);
    return {
      ok: result.code === 0,
      waiting: false,
      timedOut: result.timedOut,
      setupDurationMs: 0,
      durationMs: result.durationMs,
      inputTokens: usage.input,
      outputTokens: usage.output,
      costUsd: null,
      raw: result.stdout + result.stderr,
      darrowRunId: null,
      workspace: repo,
      patchBaseCommit: null,
    };
  }
  const result = await command(
    await sandboxed(
      [
        evaluationExecutable(harness, route, state),
        "-p",
        prompt,
        "--output-format",
        "json",
        ...(outputSchema ? ["--json-schema", outputSchema] : []),
        "--model",
        route.model,
        "--effort",
        route.effort,
      ],
      state,
      hiddenPaths,
    ),
    repo,
    env,
    timeoutMs,
  );
  let parsed: any = {};
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    // The raw response remains available for failure triage.
  }
  return {
    ok: result.code === 0 && parsed.subtype === "success",
    waiting: false,
    timedOut: result.timedOut,
    setupDurationMs: 0,
    durationMs: result.durationMs,
    inputTokens: parsed.usage?.input_tokens ?? null,
    outputTokens: parsed.usage?.output_tokens ?? null,
    costUsd: parsed.total_cost_usd ?? null,
    raw: result.stdout + result.stderr,
    darrowRunId: null,
    workspace: repo,
    patchBaseCommit: null,
  };
}

export async function invoke(
  protocol: Protocol,
  phase: Phase,
  harness: Harness,
  treatment: Treatment,
  repo: string,
  state: string,
  prompt: string,
  pluginRoot: string,
  bunExecutable: string,
  darrowExecutable: string,
  hiddenPaths: string[],
  outputSchema?: string,
): Promise<InvocationResult> {
  const settings = protocol.phases[phase];
  const timeoutMs = settings.timeoutMinutes * 60_000;
  const route: EffectiveRoute = {
    ...protocol.harnesses[harness],
    effort: settings.effort,
  };
  if (treatment !== "cli")
    return runNative(
      harness,
      route,
      repo,
      state,
      prompt,
      hiddenPaths,
      timeoutMs,
      outputSchema,
    );

  const setupStarted = performance.now();
  const env = await isolatedEnvironment(harness, route, state);
  env.DARROW_PLUGIN_ROOTS = pluginRoot;
  env.DARROW_HOME = join(state, "darrow-home");
  env.DARROW_EXTERNAL_WORKSPACE_SANDBOX_ROOT = await realpath(dirname(state));
  const temporal = await temporalExecutable(protocol);
  env.DARROW_TEMPORAL_BIN = temporal;
  env.DARROW_TOOLCHAIN_HOME = join(state, "toolchain");
  const init = await command(
    await sandboxed(
      [bunExecutable, darrowExecutable, "init", "--json"],
      state,
      hiddenPaths,
      [temporal],
    ),
    repo,
    env,
  );
  if (init.code !== 0)
    return {
      ok: false,
      waiting: false,
      timedOut: init.timedOut,
      setupDurationMs: performance.now() - setupStarted,
      durationMs: init.durationMs,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      raw: init.stdout + init.stderr,
      darrowRunId: null,
      workspace: repo,
      patchBaseCommit: null,
    };
  const profileDirectory = join(repo, ".darrow", "profiles");
  await mkdir(profileDirectory, { recursive: true });
  await writeFile(
    join(profileDirectory, `${harness}.yaml`),
    stringifyYaml({
      schemaVersion: "0.1.0",
      id: harness,
      harness,
      provider: harness === "codex" ? "openai" : "anthropic",
      model: route.model,
      reasoningEffort: route.effort,
      permissions: { inherit: true },
    }),
  );
  const workflowPath = join(
    repo,
    ".darrow",
    "workflows",
    "implement-change.yaml",
  );
  const workflow = await readFile(workflowPath, "utf8");
  await writeFile(
    workflowPath,
    workflow.replace(/^profile: .*$/m, `profile: ${harness}`),
  );
  const patchBaseCommit = await commitEvaluationSetup(repo);
  const setupDurationMs = performance.now() - setupStarted;
  const result = await command(
    await sandboxed(
      [
        bunExecutable,
        darrowExecutable,
        "run",
        "implement-change",
        "--change",
        prompt,
        "--workspace",
        "current",
        "--json",
      ],
      state,
      hiddenPaths,
      [temporal],
    ),
    repo,
    env,
    timeoutMs,
  );
  await cleanupDarrowRuntime(repo);
  let envelope: any = {};
  try {
    envelope = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
  } catch {
    // Preserve raw output below.
  }
  const runId = envelope.data?.runId ?? envelope.data?.id ?? null;
  if (result.code === 0 && envelope.ok === true && runId) {
    const lockPath = join(repo, ".darrow", "runs", runId, "lock.json");
    if (!(await Bun.file(lockPath).exists()))
      throw new Error("Darrow run did not retain its locked harness route");
    const lock = (await Bun.file(lockPath).json()) as {
      routes?: Array<{
        harness?: string;
        model?: string;
        reasoningEffort?: string;
      }>;
    };
    const routes = lock.routes ?? [];
    if (
      routes.length === 0 ||
      routes.some(
        (locked) =>
          locked.harness !== harness ||
          locked.model !== route.model ||
          locked.reasoningEffort !== route.effort,
      )
    )
      throw new Error(
        `Darrow locked a route outside the ${phase} harness block`,
      );
  }
  let workspace =
    (typeof envelope.data?.workspace === "string"
      ? envelope.data.workspace
      : envelope.data?.workspace?.path) ??
    envelope.data?.workspacePath ??
    repo;
  if (workspace === repo && runId) {
    const recordPath = join(repo, ".darrow", "runs", runId, "run.json");
    if (await Bun.file(recordPath).exists()) {
      const record = await Bun.file(recordPath).json();
      if (typeof record.workspace === "string") workspace = record.workspace;
    }
  }
  const waiting = envelope.data?.state === "waiting_for_input";
  const results = Array.isArray(envelope.data?.results)
    ? envelope.data.results
    : [];
  const usage: Array<Record<string, unknown>> = results
    .map((item: any) => item?.usage)
    .filter(
      (item: unknown): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    );
  const sumUsage = (...keys: string[]) => {
    const values = usage.flatMap((item: Record<string, unknown>) => {
      const value = keys.map((key) => item[key]).find(Number.isFinite);
      return typeof value === "number" ? [value] : [];
    });
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  };
  return {
    ok: result.code === 0 && envelope.ok === true && !waiting,
    waiting,
    timedOut: result.timedOut,
    setupDurationMs,
    durationMs: result.durationMs,
    inputTokens:
      envelope.data?.usage?.inputTokens ??
      sumUsage("input_tokens", "inputTokens", "input"),
    outputTokens:
      envelope.data?.usage?.outputTokens ??
      sumUsage("output_tokens", "outputTokens", "output"),
    costUsd:
      envelope.data?.usage?.costUsd ??
      sumUsage("cost_usd", "costUsd", "total_cost_usd"),
    raw: result.stdout + result.stderr,
    darrowRunId: runId,
    workspace,
    patchBaseCommit,
  };
}
