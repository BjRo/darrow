import { cp, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { Harness, Protocol, Route, Treatment } from "./types";
import { command } from "./process";

export interface InvocationResult {
  ok: boolean;
  waiting: boolean;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  raw: string;
  darrowRunId: string | null;
  workspace: string;
}

function sandboxProfile(hiddenPaths: string[]): string {
  const escaped = hiddenPaths.map((path) =>
    path.replaceAll("\\", "\\\\").replaceAll('"', '\\"'),
  );
  return [
    "(version 1)",
    "(allow default)",
    ...escaped.flatMap((path) => [
      `(deny file-read* (subpath "${path}"))`,
      `(deny file-write* (subpath "${path}"))`,
    ]),
  ].join("\n");
}

async function sandboxed(
  argv: string[],
  state: string,
  hiddenPaths: string[],
): Promise<string[]> {
  if (process.platform !== "darwin")
    throw new Error(
      "product-value harness isolation requires macOS sandbox-exec or an external container boundary",
    );
  const profile = join(state, "evaluation.sb");
  const canonicalHiddenPaths = await Promise.all(
    hiddenPaths.map((path) => realpath(path)),
  );
  await writeFile(profile, sandboxProfile(canonicalHiddenPaths));
  return ["/usr/bin/sandbox-exec", "-f", profile, ...argv];
}

async function copyAuth(
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
  await mkdir(targetRoot, { recursive: true });
  for (const relativePath of route.authFiles) {
    const source = resolve(sourceRoot, relativePath);
    if (!(await Bun.file(source).exists())) continue;
    const target = resolve(targetRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target);
  }
  if (harness === "codex") {
    await writeFile(
      join(targetRoot, "config.toml"),
      `approval_policy = "never"\nsandbox_mode = "workspace-write"\n`,
    );
    return { ...cleanEnvironment, HOME: state, CODEX_HOME: targetRoot };
  }
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
    HOME: state,
    CLAUDE_CONFIG_DIR: targetRoot,
  };
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
  route: Route,
  repo: string,
  state: string,
  prompt: string,
  hiddenPaths: string[],
): Promise<InvocationResult> {
  const env = await copyAuth(harness, route, state);
  if (harness === "codex") {
    const result = await command(
      await sandboxed(
        [
          route.executable,
          "exec",
          prompt,
          "--json",
          "--ephemeral",
          "--ignore-user-config",
          "--ignore-rules",
          "--sandbox",
          "workspace-write",
          "-c",
          'approval_policy="never"',
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
    );
    const usage = codexUsage(result.stdout);
    return {
      ok: result.code === 0,
      waiting: false,
      durationMs: result.durationMs,
      inputTokens: usage.input,
      outputTokens: usage.output,
      costUsd: null,
      raw: result.stdout + result.stderr,
      darrowRunId: null,
      workspace: repo,
    };
  }
  const result = await command(
    await sandboxed(
      [
        route.executable,
        "-p",
        prompt,
        "--output-format",
        "json",
        "--model",
        route.model,
        "--effort",
        route.effort,
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Bash,Edit,Read,Write,Glob,Grep",
        "--no-session-persistence",
      ],
      state,
      hiddenPaths,
    ),
    repo,
    env,
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
    durationMs: result.durationMs,
    inputTokens: parsed.usage?.input_tokens ?? null,
    outputTokens: parsed.usage?.output_tokens ?? null,
    costUsd: parsed.total_cost_usd ?? null,
    raw: result.stdout + result.stderr,
    darrowRunId: null,
    workspace: repo,
  };
}

export async function invoke(
  protocol: Protocol,
  harness: Harness,
  treatment: Treatment,
  repo: string,
  state: string,
  prompt: string,
  pluginRoot: string,
  bunExecutable: string,
  darrowExecutable: string,
  hiddenPaths: string[],
): Promise<InvocationResult> {
  const route = protocol.harnesses[harness];
  if (treatment !== "cli")
    return runNative(harness, route, repo, state, prompt, hiddenPaths);

  const env = await copyAuth(harness, route, state);
  env.DARROW_PLUGIN_ROOTS = pluginRoot;
  env.DARROW_HOME = join(state, "darrow-home");
  env.DARROW_TOOLCHAIN_HOME = resolve(
    protocol.paths.toolchainHome.startsWith("/")
      ? protocol.paths.toolchainHome
      : join(dirname(pluginRoot), protocol.paths.toolchainHome),
  );
  const init = await command(
    await sandboxed(
      [bunExecutable, darrowExecutable, "init", "--json"],
      state,
      hiddenPaths,
    ),
    repo,
    env,
  );
  if (init.code !== 0)
    return {
      ok: false,
      waiting: false,
      durationMs: init.durationMs,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      raw: init.stdout + init.stderr,
      darrowRunId: null,
      workspace: repo,
    };
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
  const result = await command(
    await sandboxed(
      [
        bunExecutable,
        darrowExecutable,
        "run",
        "implement-change",
        "--change",
        prompt,
        "--base",
        "HEAD",
        "--json",
      ],
      state,
      hiddenPaths,
    ),
    repo,
    env,
    60 * 60_000,
  );
  let envelope: any = {};
  try {
    envelope = JSON.parse(result.stdout.trim().split("\n").at(-1)!);
  } catch {
    // Preserve raw output below.
  }
  const runId = envelope.data?.runId ?? envelope.data?.id ?? null;
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
  };
}
