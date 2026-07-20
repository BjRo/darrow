import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupDarrowRuntime,
  invoke,
  isolatedEnvironment,
} from "../src/harness";
import {
  probeDarrowWorkerBundle,
  probeHarnessAuthentication,
} from "../src/preflight";
import { checked } from "../src/process";
import { createExecutionTrace } from "../src/trace";
import type { Protocol } from "../src/types";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

function testProtocol(
  executable: string,
  toolchainHome = "toolchain",
): Protocol {
  return {
    schemaVersion: "1.1.0",
    preregisteredAt: new Date(0).toISOString(),
    amendedAt: new Date(0).toISOString(),
    frozenSeed: "test",
    treatments: ["native", "plugins", "cli"],
    harnesses: {
      codex: {
        executable,
        version: "fake",
        model: "fake",
        permissionMode: "test",
        authFiles: [],
      },
      claude: {
        executable,
        version: "fake",
        model: "fake",
        permissionMode: "test",
        authFiles: [],
      },
    },
    phases: {
      smoke: {
        taskId: "task",
        repeats: 1,
        timeoutMinutes: 0.1,
        effort: "medium",
      },
      pilot: { repeats: 1, timeoutMinutes: 15, effort: "medium" },
      confirmatory: { repeats: 2, timeoutMinutes: 60, effort: "high" },
    },
    design: {
      alpha: 0.05,
      power: 0.8,
      pairedTaskSd: 0.18,
      qualityNonInferiorityMargin: 0.05,
      usefulQualityGain: 0.1,
      usefulAttentionReduction: 0.2,
      maxCostRatio: 1.5,
      maxWallTimeRatio: 1.75,
      maxOperationalFailureRate: 0.05,
      bootstrapSamples: 100,
      randomizationSamples: 100,
    },
    budgets: {
      smoke: { costUsd: 1, tokens: 100 },
      pilot: { costUsd: 1, tokens: 100 },
      confirmatory: { costUsd: 1, tokens: 100 },
    },
    paths: {
      pluginRoot: "plugins",
      bunExecutable: Bun.which("bun")!,
      darrowExecutable: "cli.ts",
      toolchainHome,
    },
  };
}

async function initializeRepository(repo: string): Promise<void> {
  await checked(["git", "init", "-b", "main"], repo);
  await checked(["git", "config", "user.name", "Evaluation Test"], repo);
  await checked(["git", "config", "user.email", "eval@example.test"], repo);
  await writeFile(join(repo, "README.md"), "fixture\n");
  await checked(["git", "add", "README.md"], repo);
  await checked(["git", "commit", "-m", "test: initialize fixture"], repo);
}

describe("product-value harness isolation (PV-3, PV-6)", () => {
  test("allows workspace changes but denies the hidden source", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-harness-test-"));
    roots.push(root);
    const repo = join(root, "repo");
    const state = join(root, "state");
    const hidden = join(root, "hidden-source");
    await Promise.all([mkdir(repo), mkdir(state), mkdir(hidden)]);
    await writeFile(join(hidden, "oracle.txt"), "not visible\n");
    const outsideRoot = await mkdtemp(join(tmpdir(), "darrow-outside-test-"));
    roots.push(outsideRoot);
    const outside = join(outsideRoot, "escaped.txt");
    const executable = join(root, "fake-codex");
    await writeFile(
      executable,
      `#!/bin/sh
if /bin/cat '${join(hidden, "oracle.txt")}' >/dev/null 2>&1; then
  printf leaked > leaked.txt
  exit 7
fi
if printf escaped > '${outside}' 2>/dev/null; then
  exit 8
fi
printf safe > changed.txt
printf '%s' "$*" > invocation-args.txt
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":12,"output_tokens":3}}'
`,
    );
    await chmod(executable, 0o755);
    const protocol = testProtocol(executable);

    const result = await invoke(
      protocol,
      "smoke",
      "codex",
      "native",
      repo,
      state,
      "task",
      join(root, "plugins"),
      Bun.which("bun")!,
      join(root, "cli.ts"),
      [hidden],
    );

    expect(result.ok).toBe(true);
    expect(result.inputTokens).toBe(12);
    expect(await Bun.file(join(repo, "changed.txt")).text()).toBe("safe");
    expect(await Bun.file(join(repo, "leaked.txt")).exists()).toBe(false);
    expect(await Bun.file(outside).exists()).toBe(false);
    expect(await Bun.file(join(repo, "invocation-args.txt")).text()).toContain(
      "--dangerously-bypass-approvals-and-sandbox",
    );
    expect(
      await Bun.file(join(state, "codex", "config.toml")).text(),
    ).toContain('sandbox_mode = "danger-full-access"');
  });

  test("terminates a smoke invocation at its phase deadline", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-timeout-test-"));
    roots.push(root);
    const repo = join(root, "repo");
    const state = join(root, "state");
    await Promise.all([mkdir(repo), mkdir(state)]);
    const executable = join(root, "slow-codex");
    const childMarker = join(root, "child-survived");
    await writeFile(
      executable,
      `#!/bin/sh
( /bin/sleep 0.3; printf survived > '${childMarker}' ) &
/bin/sleep 5
`,
    );
    await chmod(executable, 0o755);
    const protocol = testProtocol(executable);
    protocol.phases.smoke.timeoutMinutes = 0.001;

    const result = await invoke(
      protocol,
      "smoke",
      "codex",
      "native",
      repo,
      state,
      "task",
      join(root, "plugins"),
      Bun.which("bun")!,
      join(root, "cli.ts"),
      [],
    );

    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.durationMs).toBeLessThan(2_000);
    await Bun.sleep(500);
    expect(await Bun.file(childMarker).exists()).toBe(false);
  });

  test("uses the same bounded Claude tool launcher for native and CLI paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-tools-test-"));
    roots.push(root);
    const state = join(root, "state");
    await mkdir(state);
    const executable = join(root, "claude-real");
    await writeFile(executable, "#!/bin/sh\nexit 0\n");
    await chmod(executable, 0o755);
    const previousToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "fake-setup-token";
    try {
      const env = await isolatedEnvironment(
        "claude",
        {
          executable,
          version: "fake",
          model: "fake",
          permissionMode: "test",
          authFiles: [],
        },
        state,
      );
      const launcher = join(state, "harness-bin", "claude");
      expect(env.PATH?.split(":")[0]).toBe(join(state, "harness-bin"));
      expect(env.CLAUDE_CODE_TMPDIR).toBe(join(state, "tmp"));
      expect(await Bun.file(launcher).text()).toContain(
        "--tools 'Bash,Edit,Read,Write,Glob,Grep,StructuredOutput'",
      );
      expect(await Bun.file(launcher).text()).toContain(
        "--no-session-persistence",
      );
      expect((await stat(launcher)).mode & 0o111).not.toBe(0);
    } finally {
      if (previousToken === undefined)
        delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
      else process.env.CLAUDE_CODE_OAUTH_TOKEN = previousToken;
    }
  });

  test("captures direct Claude tool events and terminal usage from stream JSON", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-trace-test-"));
    roots.push(root);
    const repo = join(root, "repo");
    const state = join(root, "state");
    await Promise.all([mkdir(repo), mkdir(state)]);
    const executable = join(root, "claude-real");
    await writeFile(
      executable,
      `#!/bin/sh
printf '%s' "$*" > invocation-args.txt
printf '%s\n' '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool-1","name":"Bash","input":{"command":"bun test focused.test.ts"}},{"type":"tool_use","id":"tool-2","name":"Read","input":{"file_path":"private.ts"}}]}}'
printf '%s\n' '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","is_error":true,"content":"Failed Tests: expected red"}]}}'
printf '%s\n' '{"type":"result","subtype":"success","is_error":false,"usage":{"input_tokens":21,"output_tokens":8},"total_cost_usd":0.25}'
`,
    );
    await chmod(executable, 0o755);
    const protocol = testProtocol(executable);
    protocol.harnesses.claude.executable = executable;
    const previousToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "fake-setup-token";
    try {
      const result = await invoke(
        protocol,
        "smoke",
        "claude",
        "native",
        repo,
        state,
        "task",
        join(root, "plugins"),
        Bun.which("bun")!,
        join(root, "cli.ts"),
        [],
      );

      expect(result.ok).toBe(true);
      expect(result.inputTokens).toBe(21);
      expect(result.outputTokens).toBe(8);
      expect(result.costUsd).toBe(0.25);
      expect(
        await Bun.file(join(repo, "invocation-args.txt")).text(),
      ).toContain("--output-format stream-json --verbose");
      const trace = await createExecutionTrace(result, "native");
      expect((trace.model as any).toolTypes).toEqual({ Bash: 1, Read: 1 });
      expect((trace.model as any).commands.categories.test).toEqual({
        total: 1,
        nonZero: 1,
      });
      expect((trace.model as any).usage).toEqual({
        input_tokens: 21,
        output_tokens: 8,
      });
      expect((trace.model as any).costUsd).toBe(0.25);
    } finally {
      if (previousToken === undefined)
        delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
      else process.env.CLAUDE_CODE_OAUTH_TOKEN = previousToken;
    }
  });

  test("stops daemonized Darrow runtime processes after an invocation", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-runtime-cleanup-test-"));
    roots.push(root);
    const runtime = join(root, ".darrow", "runtime");
    await mkdir(runtime, { recursive: true });
    const service = Bun.spawn(["/bin/sleep", "30"]);
    const worker = Bun.spawn(["/bin/sh", "-c", "/bin/sleep 30 & wait"]);
    await Promise.all([
      writeFile(
        join(runtime, "service.json"),
        JSON.stringify({ pid: service.pid }),
      ),
      writeFile(
        join(runtime, "worker.json"),
        JSON.stringify({ pid: worker.pid }),
      ),
    ]);
    await cleanupDarrowRuntime(root, 25);
    await Promise.all([service.exited, worker.exited]);
    expect(() => process.kill(service.pid, 0)).toThrow();
    expect(() => process.kill(worker.pid, 0)).toThrow();
  });

  test("copies Codex credentials into restrictive disposable state", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-auth-test-"));
    roots.push(root);
    const source = join(root, "source");
    const state = join(root, "state");
    const workspace = join(root, "workspace");
    await Promise.all([mkdir(source), mkdir(state), mkdir(workspace)]);
    await writeFile(join(source, "auth.json"), '{"token":"fake"}\n');
    const previous = process.env.CODEX_HOME;
    process.env.CODEX_HOME = source;
    try {
      const env = await isolatedEnvironment(
        "codex",
        {
          executable: "fake",
          version: "fake",
          model: "fake",
          permissionMode: "test",
          authFiles: ["auth.json"],
        },
        state,
        workspace,
      );
      const target = join(state, "codex", "auth.json");
      expect(env.CODEX_HOME).toBe(join(state, "codex"));
      expect(await Bun.file(target).text()).toBe('{"token":"fake"}\n');
      expect((await stat(target)).mode & 0o077).toBe(0);
      expect(
        await Bun.file(join(state, "codex", "config.toml")).text(),
      ).toContain(`[projects.${JSON.stringify(await realpath(workspace))}]`);
    } finally {
      if (previous === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previous;
    }
  });

  test("refuses rotating Claude login credentials and accepts a setup token", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-claude-auth-test-"));
    roots.push(root);
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, ".credentials.json"), '{"token":"fake"}\n');
    const previousConfig = process.env.CLAUDE_CONFIG_DIR;
    const previousToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    const previousKey = process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDE_CONFIG_DIR = source;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.ANTHROPIC_API_KEY;
    const route = {
      executable: "fake",
      version: "fake",
      model: "fake",
      permissionMode: "test",
      authFiles: [".credentials.json"],
    };
    try {
      await expect(
        isolatedEnvironment("claude", route, join(root, "refused")),
      ).rejects.toThrow("rotating login credentials are not copied");
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "fake-setup-token";
      const env = await isolatedEnvironment(
        "claude",
        route,
        join(root, "accepted"),
      );
      expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe("fake-setup-token");
      expect(
        await Bun.file(
          join(root, "accepted", "claude", ".credentials.json"),
        ).exists(),
      ).toBe(false);
    } finally {
      if (previousConfig === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousConfig;
      if (previousToken === undefined)
        delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
      else process.env.CLAUDE_CODE_OAUTH_TOKEN = previousToken;
      if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousKey;
    }
  });

  test("preflight proves authentication with real isolated inference", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-inference-probe-test-"));
    roots.push(root);
    const codex = join(root, "fake-codex");
    const claude = join(root, "fake-claude");
    await writeFile(
      codex,
      `#!/bin/sh
case "$*" in
  *"Reply with exactly OK."*"model_reasoning_effort=\\\"medium\\\""*)
    printf '%s\n' '{"type":"turn.completed"}' ;;
  *) exit 9 ;;
esac
`,
    );
    await writeFile(
      claude,
      `#!/bin/sh
case "$*" in
  *"Reply with exactly OK."*"--effort medium"*)
    printf '%s\n' '{"subtype":"success","is_error":false}' ;;
  *) exit 9 ;;
esac
`,
    );
    await Promise.all([chmod(codex, 0o755), chmod(claude, 0o755)]);
    const protocol = testProtocol(codex);
    protocol.harnesses.claude.executable = claude;
    const previousToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "fake-setup-token";
    try {
      expect(
        await probeHarnessAuthentication("codex", protocol, "smoke", []),
      ).toBe("isolated-config");
      expect(
        await probeHarnessAuthentication("claude", protocol, "smoke", []),
      ).toBe("setup-token");
    } finally {
      if (previousToken === undefined)
        delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
      else process.env.CLAUDE_CODE_OAUTH_TOKEN = previousToken;
    }
  });

  test("preflight bundles the Darrow worker and refuses missing dependencies", async () => {
    const protocol = testProtocol("fake");
    expect(await probeDarrowWorkerBundle(protocol)).toBe("ready");

    const root = await mkdtemp(join(tmpdir(), "darrow-worker-probe-test-"));
    roots.push(root);
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "src", "temporal-workflow.ts"),
      "export async function workflow() {}\n",
    );
    await expect(probeDarrowWorkerBundle(protocol, root)).rejects.toThrow(
      "Darrow worker dependencies are unavailable",
    );
  }, 10_000);

  test("exposes only the pinned Temporal binary from hidden evaluator state", async () => {
    const root = await mkdtemp(join(tmpdir(), "darrow-cli-harness-test-"));
    roots.push(root);
    const repo = join(root, "repo");
    const state = join(root, "state");
    const hidden = join(root, "hidden-evaluator");
    const temporal = join(
      hidden,
      "temporal",
      "1.8.0",
      "darwin-arm64",
      "temporal",
    );
    await Promise.all([
      mkdir(repo),
      mkdir(state),
      mkdir(join(temporal, ".."), { recursive: true }),
    ]);
    await initializeRepository(repo);
    await writeFile(join(hidden, "oracle.txt"), "not visible\n");
    await writeFile(
      temporal,
      '#!/bin/sh\nprintf "temporal version 1.8.0\\n"\n',
    );
    await chmod(temporal, 0o755);
    const darrow = join(root, "fake-darrow.ts");
    await writeFile(
      darrow,
      `import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
if (process.argv[2] === "init") {
  await mkdir(join(process.cwd(), ".darrow", "workflows"), { recursive: true });
  await writeFile(join(process.cwd(), ".darrow", "workflows", "implement-change.yaml"), "profile: codex\\n");
  await writeFile(join(process.cwd(), ".darrow", "project.yaml"), "schemaVersion: 0.1.0\\n");
  await writeFile(join(process.cwd(), ".gitignore"), ".darrow/runs/\\n");
  await writeFile(join(process.cwd(), ".gitattributes"), ".darrow/tickets/** linguist-generated\\n");
  console.log(JSON.stringify({ ok: true }));
} else {
  const args = process.argv.slice(3);
  const workspace = args.indexOf("--workspace");
  if (workspace < 0 || args[workspace + 1] !== "current" || args.includes("--base")) process.exit(11);
  try {
    await Bun.file(${JSON.stringify(join(hidden, "oracle.txt"))}).text();
    process.exit(8);
  } catch {}
  const runtime = Bun.spawnSync([process.env.DARROW_TEMPORAL_BIN!, "--version"]);
  if (runtime.exitCode !== 0) process.exit(9);
  const profile = await Bun.file(join(process.cwd(), ".darrow", "profiles", "codex.yaml")).text();
  if (!profile.includes("reasoningEffort:")) process.exit(10);
  const run = join(process.cwd(), ".darrow", "runs", "fake");
  await mkdir(run, { recursive: true });
  await writeFile(join(run, "lock.json"), JSON.stringify({ routes: [{ harness: "codex", model: "fake", reasoningEffort: "medium" }] }));
  console.log(JSON.stringify({ ok: true, data: { runId: "fake", state: "completed", workspace: process.cwd(), results: [] } }));
}
`,
    );
    const protocol = testProtocol("fake", hidden);
    const result = await invoke(
      protocol,
      "smoke",
      "codex",
      "cli",
      repo,
      state,
      "task",
      join(root, "plugins"),
      Bun.which("bun")!,
      darrow,
      [hidden],
    );

    expect(result.ok).toBe(true);
    expect(result.darrowRunId).toBe("fake");
    expect(result.workspace).toBe(await realpath(repo));
    expect(
      await Bun.file(join(repo, ".darrow", "profiles", "codex.yaml")).text(),
    ).toContain("reasoningEffort: medium");

    const mismatchedRepo = join(root, "mismatched-repo");
    const mismatchedState = join(root, "mismatched-state");
    await Promise.all([mkdir(mismatchedRepo), mkdir(mismatchedState)]);
    await initializeRepository(mismatchedRepo);
    protocol.phases.smoke.effort = "low";
    await expect(
      invoke(
        protocol,
        "smoke",
        "codex",
        "cli",
        mismatchedRepo,
        mismatchedState,
        "task",
        join(root, "plugins"),
        Bun.which("bun")!,
        darrow,
        [hidden],
      ),
    ).rejects.toThrow("outside the smoke harness block");
  });
});
