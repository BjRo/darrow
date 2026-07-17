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
  await writeJson(resolve(runDir, "lock.json"), {
    adapter: {
      nativePermissions: {
        configurationSources: [
          {
            path: localSettings,
            scope: "local",
            digest: await hashFile(localSettings),
          },
        ],
      },
    },
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
        source: commandDir,
        digest: await hashDirectory(commandDir),
        input: { change: "write new" },
        publish: null,
      },
      profile: {
        schemaVersion: "0.1.0",
        id: "claude",
        harness: "claude",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        reasoningEffort: "high",
        permissions: { inherit: true },
        source: "/profile",
        digest: `sha256:${"b".repeat(64)}`,
      },
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
focused='grep -F new behavior.txt || { echo expected-new; exit 1; }'
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" red --expected expected-new -- sh -c "$focused"
printf 'new\\n' > behavior.txt
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" green -- sh -c "$focused"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" regression -- git diff --check
printf '%s\\n' '{"type":"system","session_id":"claude-session-1"}'
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"session_id":"claude-session-1","usage":{"input_tokens":12,"output_tokens":7},"permission_denials":[],"structured_output":{"branch":"feat/claude-change","summary":"Implemented with Claude Code","changedPaths":["behavior.txt"],"evidence":{"red":{},"green":{},"regression":{}}}}'
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

  test("refuses changed native permission settings before invoking Claude Code", async () => {
    const { root, input, bin } = await fixture(`#!/usr/bin/env bash
set -euo pipefail
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
        adapter: {
          nativePermissions: { inherit: true, configurationSources },
        },
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
