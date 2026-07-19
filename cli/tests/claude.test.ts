import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { verifyArtifacts } from "../src/artifacts";
import { executeClaudeCommand } from "../src/claude";
import { executeCommand } from "../src/harness";
import {
  exists,
  hashDirectory,
  hashFile,
  replaceJson,
  writeJson,
} from "../src/io";
import { CLI_ROOT } from "../src/paths";
import type { ActivityInput } from "../src/types";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (path) => {
      await Bun.spawn(["chmod", "-R", "u+w", path]).exited;
      await rm(path, { recursive: true, force: true });
    }),
  );
});

function git(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
}

async function fixture(script?: string): Promise<{
  root: string;
  input: ActivityInput;
  bin: string;
}> {
  const root = await mkdtemp(resolve(tmpdir(), "darrow-claude-"));
  temps.push(root);
  git(root, ["init", "-q"]);
  git(root, ["config", "user.name", "Test"]);
  git(root, ["config", "user.email", "test@example.com"]);
  await writeFile(resolve(root, "behavior.txt"), "old\n");
  git(root, ["add", "behavior.txt"]);
  git(root, ["commit", "-qm", "fixture"]);
  const runDir = resolve(root, ".darrow", "runs", "run-claude");
  const snapshotDir = resolve(runDir, "snapshot");
  for (const name of ["content", "results", "artifacts"])
    await mkdir(resolve(runDir, name), { recursive: true });
  const commandDir = resolve(
    snapshotDir,
    "commands",
    "claude",
    "darrow-delivery",
    "implement",
  );
  await mkdir(resolve(commandDir, ".."), { recursive: true });
  await cp(
    resolve(
      CLI_ROOT,
      "..",
      "plugins",
      "darrow-delivery",
      "skills",
      "implement",
    ),
    commandDir,
    { recursive: true },
  );
  const localSettings = resolve(root, ".claude", "settings.local.json");
  await mkdir(resolve(localSettings, ".."), { recursive: true });
  await writeFile(localSettings, '{"permissions":{"deny":[]}}\n');
  const route = {
    routeId: `sha256:${"a".repeat(64)}`,
    profileId: "claude",
    profileDigest: `sha256:${"b".repeat(64)}`,
    harness: "claude",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    reasoningEffort: "high",
    permissions: { inherit: true },
    limits: {},
    adapter: { id: "claude-code", version: "0.1.0" },
    selectionSource: "fixed_plan",
  } as const;
  await writeJson(resolve(runDir, "lock.json"), {
    adapters: [
      {
        id: "claude-code",
        executable: resolve(root, "mock-bin", "claude"),
        detectedVersion: "2.1.185 (Claude Code)",
        routeIds: [route.routeId],
        nativePermissions: {
          configurationEnvironment: { PATH: process.env.PATH ?? "" },
          configurationSources: [
            {
              path: localSettings,
              scope: "local",
              digest: await hashFile(localSettings),
            },
          ],
        },
      },
    ],
  });
  const bin = resolve(root, "mock-bin");
  await mkdir(bin);
  if (script) await writeFile(resolve(bin, "claude"), script, { mode: 0o755 });
  return {
    root,
    bin,
    input: {
      runId: "run-claude",
      repoRoot: root,
      runDir,
      workspace: root,
      snapshotDir,
      attemptId: "attempt-1",
      instructions: [],
      priorArtifacts: [],
      planCapabilities: [],
      step: {
        id: "implement",
        dependsOn: [],
        commandId: "darrow-delivery:implement",
        contractVersion: "0.1.0",
        cancellation: "wait_for_boundary",
        role: "default",
        route,
        source: commandDir,
        digest: await hashDirectory(commandDir),
        input: { change: "write new" },
        publish: null,
      },
      effectiveRoute: route,
      routeAmendment: null,
    },
  };
}

describe("Claude Code command adapter", () => {
  test("normalizes structured output, usage, and session identity without bypassing native permissions", async () => {
    const { root, input, bin } = await fixture(`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo '2.1.185 (Claude Code)'; exit 0; fi
for arg in "$@"; do
  [[ "$arg" != "--dangerously-skip-permissions" ]]
  [[ "$arg" != "--permission-mode" ]]
done
printf '%s\\n' "$@" > "$(dirname "$0")/args"
prompt=$(cat)
skill=$(sed -n 's/^Read and follow \\(.*\\/SKILL.md\\) exactly\\.$/\\1/p' <<<"$prompt")
evidence=$(sed -n 's/^Evidence directory: //p' <<<"$prompt")
git switch -q -c feat/claude-change
printf 'new\\n' > behavior.txt
git diff --check
printf '%s\\n' '{"type":"system","session_id":"claude-session-1"}'
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"session_id":"claude-session-1","usage":{"input_tokens":12,"output_tokens":7},"permission_denials":[],"structured_output":{"branch":"feat/claude-change","summary":"Implemented with Claude Code","changedPaths":["behavior.txt"]}}'
`);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      const result = await executeCommand(input);
      expect(result.status, result.error?.message).toBe("succeeded");
      expect(result.nativeSessionId).toBe("claude-session-1");
      expect(result.usage).toEqual({ input_tokens: 12, output_tokens: 7 });
      expect(result.payload?.summary).toBe("Implemented with Claude Code");
      expect(await readFile(resolve(root, "behavior.txt"), "utf8")).toBe(
        "new\n",
      );
      const args = await readFile(resolve(bin, "args"), "utf8");
      expect(args).toContain("--setting-sources\nuser,project");
      expect(args).toContain(
        `--settings\n${resolve(root, ".claude", "settings.local.json")}`,
      );
      expect(args).not.toContain("dangerously-skip-permissions");
      await expect(
        verifyArtifacts(root, input.runDir),
      ).resolves.toBeUndefined();
    } finally {
      process.env.PATH = previousPath;
    }
  });

  test("normalizes native permission denials", async () => {
    const { input, bin } = await fixture(`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo '2.1.185 (Claude Code)'; exit 0; fi
cat >/dev/null
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"session_id":"denied-session","usage":{},"permission_denials":[{"tool_name":"Bash"}]}'
`);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      const result = await executeClaudeCommand(input);
      expect(result.status).toBe("failed");
      expect(result.error).toEqual({
        category: "permission_denied",
        message: "Claude Code denied a required permission",
      });
      expect(result.nativeSessionId).toBe("denied-session");
    } finally {
      process.env.PATH = previousPath;
    }
  });

  test("does not pass a local settings path locked as absent", async () => {
    const { root, input, bin } = await fixture(`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo '2.1.185 (Claude Code)'; exit 0; fi
printf '%s\n' "$@" > "$(dirname "$0")/args"
cat >/dev/null
printf '%s\n' '{"type":"result","subtype":"error","is_error":true,"session_id":"absent-settings","usage":{},"permission_denials":[],"result":"fixture failure"}'
`);
    const localSettings = resolve(root, ".claude", "settings.local.json");
    await rm(localSettings);
    const lockPath = resolve(input.runDir, "lock.json");
    const lock = await Bun.file(lockPath).json();
    lock.adapters[0].nativePermissions.configurationSources[0].present = false;
    await replaceJson(lockPath, lock);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      const result = await executeClaudeCommand(input);
      expect(result.status).toBe("failed");
      const args = await readFile(resolve(bin, "args"), "utf8");
      expect(args).not.toContain("--settings");
      expect(args).toContain("--setting-sources\nuser,project");
    } finally {
      process.env.PATH = previousPath;
    }
  });

  test("refuses changed native permission settings before invoking Claude Code", async () => {
    const { root, input, bin } = await fixture(`#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo '2.1.185 (Claude Code)'; exit 0; fi
touch "$(dirname "$0")/invoked"
`);
    await writeFile(
      resolve(root, ".claude", "settings.local.json"),
      '{"permissions":{"deny":["Bash"]}}\n',
    );
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      const result = await executeClaudeCommand(input);
      expect(result.status).toBe("failed");
      expect(result.error?.category).toBe("preflight_stale");
      expect(await exists(resolve(bin, "invoked"))).toBe(false);
    } finally {
      process.env.PATH = previousPath;
    }
  });

  test("executes a generic metadata-owned command with the locked Claude environment", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-claude-generic-"));
    temps.push(root);
    const workspace = resolve(root, "workspace");
    const runDir = resolve(root, ".darrow", "runs", "run-generic");
    const snapshotDir = resolve(runDir, "snapshot");
    const commandDir = resolve(
      snapshotDir,
      "commands",
      "claude",
      "example",
      "generic",
    );
    for (const path of [workspace, commandDir, resolve(runDir, "results")])
      await mkdir(path, { recursive: true });
    await writeFile(resolve(commandDir, "SKILL.md"), "# generic\n");
    await writeJson(resolve(commandDir, "darrow.json"), {
      schemaVersion: 1,
      kind: "command",
      contractVersion: "1.0.0",
      inputSchema: "./request.contract.json",
      outputSchema: "./response.contract.json",
    });
    await writeJson(resolve(commandDir, "request.contract.json"), {
      type: "object",
      additionalProperties: false,
      required: ["topic", "depth"],
      properties: {
        topic: { type: "string" },
        depth: { type: "integer" },
      },
    });
    await writeJson(resolve(commandDir, "response.contract.json"), {
      type: "object",
      additionalProperties: false,
      required: ["answer"],
      properties: { answer: { type: "string" } },
    });
    const lockedBin = resolve(root, "locked-bin");
    const changedBin = resolve(root, "changed-bin");
    const lockedHome = resolve(root, "locked-claude-home");
    const changedHome = resolve(root, "changed-claude-home");
    for (const path of [lockedBin, changedBin, lockedHome, changedHome])
      await mkdir(path);
    const lockedSettings = resolve(lockedHome, "settings.json");
    await writeFile(lockedSettings, '{"permissions":{"deny":[]}}\n');
    await writeFile(
      resolve(lockedBin, "claude"),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo 'Claude Code locked'; exit 0; fi
printf '%s' "\${CLAUDE_CONFIG_DIR:-}" > "$(dirname "$0")/home"
printf '%s\\n' "$@" > "$(dirname "$0")/args"
prompt=$(cat)
printf '%s' "$prompt" > "$(dirname "$0")/prompt"
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"session_id":"generic-claude","usage":{},"permission_denials":[],"structured_output":{"answer":"generic succeeded"}}'
`,
      { mode: 0o755 },
    );
    await writeFile(
      resolve(changedBin, "claude"),
      `#!/usr/bin/env bash
touch "$(dirname "$0")/invoked"
echo 'Claude Code changed'
`,
      { mode: 0o755 },
    );
    await writeFile(
      resolve(changedBin, "bash"),
      `#!/bin/sh
touch "$(dirname "$0")/interpreter-invoked"
exit 99
`,
      { mode: 0o755 },
    );
    const route = {
      routeId: `sha256:${"f".repeat(64)}`,
      profileId: "claude",
      profileDigest: `sha256:${"a".repeat(64)}`,
      harness: "claude",
      provider: "anthropic",
      model: "claude-test",
      reasoningEffort: "high",
      permissions: { inherit: true },
      limits: {},
      adapter: { id: "claude-code", version: "0.1.0" },
      selectionSource: "fixed_plan",
    } as const;
    await writeJson(resolve(runDir, "lock.json"), {
      adapters: [
        {
          id: "claude-code",
          executable: resolve(lockedBin, "claude"),
          detectedVersion: "Claude Code locked",
          routeIds: [route.routeId],
          nativePermissions: {
            configurationEnvironment: {
              CLAUDE_CONFIG_DIR: lockedHome,
              PATH: process.env.PATH ?? "",
            },
            configurationSources: [
              {
                path: lockedSettings,
                scope: "user",
                digest: await hashFile(lockedSettings),
              },
            ],
          },
        },
      ],
    });
    const previousPath = process.env.PATH;
    const previousHome = process.env.CLAUDE_CONFIG_DIR;
    process.env.PATH = `${changedBin}:${previousPath}`;
    process.env.CLAUDE_CONFIG_DIR = changedHome;
    try {
      const result = await executeClaudeCommand({
        runId: "run-generic",
        repoRoot: root,
        runDir,
        workspace,
        snapshotDir,
        attemptId: "attempt-1",
        instructions: [],
        priorArtifacts: [],
        planCapabilities: [],
        step: {
          id: "generic",
          dependsOn: [],
          commandId: "example:generic",
          contractVersion: "1.0.0",
          cancellation: "wait_for_boundary",
          role: "default",
          route,
          source: commandDir,
          digest: await hashDirectory(commandDir),
          input: { topic: "runtime", depth: 3 },
          publish: null,
        },
        effectiveRoute: route,
        routeAmendment: null,
      });
      expect(result.status, result.error?.message).toBe("succeeded");
      expect(result.payload).toEqual({ answer: "generic succeeded" });
      expect(result.artifacts).toEqual([]);
      expect(await readFile(resolve(lockedBin, "home"), "utf8")).toBe(
        lockedHome,
      );
      expect(await readFile(resolve(lockedBin, "prompt"), "utf8")).toContain(
        'Command input (JSON): {"depth":3,"topic":"runtime"}',
      );
      expect(await readFile(resolve(lockedBin, "args"), "utf8")).toContain(
        '"required":["answer"]',
      );
      expect(await exists(resolve(changedBin, "invoked"))).toBe(false);
      expect(await exists(resolve(changedBin, "interpreter-invoked"))).toBe(
        false,
      );
    } finally {
      process.env.PATH = previousPath;
      if (previousHome === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousHome;
    }
  });

  test.skipIf(process.env.DARROW_LIVE_CLAUDE !== "1")(
    "completes a real Claude Code invocation through the production adapter",
    async () => {
      if (!Bun.which("claude")) throw new Error("Claude Code is unavailable");
      const { input } = await fixture();
      const claudeHome =
        process.env.CLAUDE_CONFIG_DIR ??
        (process.env.HOME ? resolve(process.env.HOME, ".claude") : null);
      const settings = claudeHome ? resolve(claudeHome, "settings.json") : null;
      const configurationSources =
        settings && (await exists(settings))
          ? [
              {
                path: settings,
                scope: "user",
                digest: await hashFile(settings),
              },
            ]
          : [
              {
                path: "environment-defaults",
                scope: "environment",
                digest: `sha256:${"a".repeat(64)}`,
              },
            ];
      await replaceJson(resolve(input.runDir, "lock.json"), {
        adapters: [
          {
            id: "claude-code",
            executable: Bun.which("claude")!,
            detectedVersion: Bun.spawnSync(["claude", "--version"], {
              stdout: "pipe",
            })
              .stdout.toString()
              .trim(),
            routeIds: [input.effectiveRoute.routeId],
            nativePermissions: {
              inherit: true,
              configurationEnvironment: claudeHome
                ? {
                    CLAUDE_CONFIG_DIR: claudeHome,
                    PATH: process.env.PATH ?? "",
                  }
                : { PATH: process.env.PATH ?? "" },
              configurationSources,
            },
          },
        ],
      });
      const result = await executeCommand(input);
      expect(result.status, result.error?.message).toBe("succeeded");
      expect(typeof result.nativeSessionId).toBe("string");
      expect(result.payload?.changedPaths).toContain("behavior.txt");
      expect(
        await Bun.file(resolve(input.workspace, "behavior.txt")).text(),
      ).toBe("new\n");
    },
    300_000,
  );
});
