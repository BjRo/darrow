import { afterEach, describe, expect, test } from "bun:test";
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  executeCodexCommand,
  guardEnvironment,
  startEvidenceBroker,
} from "../src/codex";
import { hashDirectory } from "../src/io";
import { CLI_ROOT } from "../src/paths";
import type { ActivityInput } from "../src/types";
import { verifyArtifacts } from "../src/artifacts";

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

describe("Codex command adapter", () => {
  test("rejects replacement of a runtime-attested phase", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-attestation-"));
    temps.push(root);
    git(root, ["init", "-q"]);
    const evidence = resolve(root, "evidence");
    await mkdir(evidence);
    const commandDir = resolve(
      CLI_ROOT,
      "..",
      "plugins",
      "darrow-delivery",
      "skills",
      "implement",
    );
    const broker = await startEvidenceBroker(
      commandDir,
      evidence,
      root,
      resolve(root, "attestations"),
    );
    try {
      const env = { ...process.env, ...broker.env };
      const first = Bun.spawn(
        [
          "bash",
          resolve(commandDir, "scripts", "evidence.sh"),
          "run",
          evidence,
          "red",
          "--expected",
          "expected",
          "--",
          "sh",
          "-c",
          "echo expected; exit 1",
        ],
        { cwd: root, env, stdout: "pipe", stderr: "pipe" },
      );
      const firstError = new Response(first.stderr).text();
      expect(await first.exited, await firstError).toBe(0);
      for (const suffix of ["meta", "stdout", "stderr"])
        await rm(resolve(evidence, `red.${suffix}`), { force: true });
      const duplicate = Bun.spawn(
        [
          "bash",
          resolve(commandDir, "scripts", "evidence.sh"),
          "run",
          evidence,
          "red",
          "--expected",
          "expected",
          "--",
          "sh",
          "-c",
          "echo expected; exit 1",
        ],
        { cwd: root, env, stdout: "pipe", stderr: "pipe" },
      );
      expect(await duplicate.exited).not.toBe(0);
      expect(await new Response(duplicate.stderr).text()).toContain(
        "out of order or already completed",
      );
      await expect(broker.verify()).rejects.toThrow("incomplete");
    } finally {
      broker.stop();
    }
  });

  test("blocks bypass attempts for commits and dependency installation", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-guards-"));
    temps.push(root);
    const env = { ...process.env, ...(await guardEnvironment(root)) };
    const commit = Bun.spawnSync(
      [
        "git",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "--no-verify",
        "-m",
        "bypass",
      ],
      { cwd: root, env, stdout: "pipe", stderr: "pipe" },
    );
    expect(commit.exitCode).not.toBe(0);
    expect(commit.stderr.toString()).toContain("forbids git commit");
    if (Bun.which("npm")) {
      const install = Bun.spawnSync(["npm", "install"], {
        cwd: root,
        env,
        stdout: "pipe",
        stderr: "pipe",
      });
      expect(install.exitCode).not.toBe(0);
      expect(install.stderr.toString()).toContain("forbids dependency changes");
    }
  });

  test("captures ordered TDD evidence and checkpoints it without committing", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-codex-"));
    temps.push(root);
    git(root, ["init", "-q"]);
    git(root, ["config", "user.name", "Test"]);
    git(root, ["config", "user.email", "test@example.com"]);
    await writeFile(resolve(root, "behavior.txt"), "old\n");
    git(root, ["add", "behavior.txt"]);
    git(root, ["commit", "-qm", "fixture"]);
    const originalHead = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
      cwd: root,
      stdout: "pipe",
    })
      .stdout.toString()
      .trim();
    const runDir = resolve(root, ".darrow", "runs", "run-1");
    const snapshotDir = resolve(runDir, "snapshot");
    await mkdir(resolve(runDir, "content"), { recursive: true });
    await mkdir(resolve(runDir, "results"), { recursive: true });
    await mkdir(resolve(runDir, "artifacts"), { recursive: true });
    await mkdir(resolve(snapshotDir, "commands", "darrow-delivery"), {
      recursive: true,
    });
    await cp(
      resolve(
        CLI_ROOT,
        "..",
        "plugins",
        "darrow-delivery",
        "skills",
        "implement",
      ),
      resolve(snapshotDir, "commands", "darrow-delivery", "implement"),
      { recursive: true },
    );
    const bin = resolve(root, "mock-bin");
    await mkdir(bin);
    await writeFile(
      resolve(bin, "codex"),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo 'codex-cli 1.0.0'; exit 0; fi
if [[ "\${1:-}" == "sandbox" ]]; then
  shift; cwd=''
  while [[ $# -gt 0 && "$1" != "--" ]]; do if [[ "$1" == "-C" ]]; then cwd=$2; shift 2; else shift; fi; done
  shift; [[ -z "$cwd" ]] || cd "$cwd"; exec "$@"
fi
output=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then output=$2; shift 2; else shift; fi
done
prompt=$(cat)
skill=$(printf '%s\n' "$prompt" | sed -n 's/^Read and follow \\(.*\\/SKILL.md\\) exactly\\.$/\\1/p')
evidence=$(printf '%s\n' "$prompt" | sed -n 's/^Evidence directory: //p')
git switch -q -c feat/mock-change
focused='grep -F new behavior.txt || { echo expected-new; exit 1; }'
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" red --expected expected-new -- sh -c "$focused"
printf 'new\n' > behavior.txt
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" green -- sh -c "$focused"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" regression -- git diff --check
mkdir -p "$(dirname "$output")"
printf '%s\n' '{"branch":"feat/mock-change","summary":"Implemented the requested behavior","changedPaths":["behavior.txt"],"evidence":{"red":{},"green":{},"regression":{}}}' > "$output"
printf '%s\n' '{"type":"thread.started","thread_id":"thread-1"}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'
`,
      { mode: 0o755 },
    );
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      const input: ActivityInput = {
        runId: "run-1",
        repoRoot: root,
        runDir,
        workspace: root,
        snapshotDir,
        attemptId: "attempt-1",
        instructions: [],
        planCapabilities: [],
        step: {
          id: "implement",
          dependsOn: [],
          commandId: "darrow-delivery:implement",
          contractVersion: "0.1.0",
          source: resolve(
            snapshotDir,
            "commands",
            "darrow-delivery",
            "implement",
          ),
          digest: await hashDirectory(
            resolve(snapshotDir, "commands", "darrow-delivery", "implement"),
          ),
          input: { change: "write new" },
        },
        profile: {
          schemaVersion: "0.1.0",
          id: "codex",
          harness: "codex",
          provider: "openai",
          model: "gpt-5.6-sol",
          reasoningEffort: "high",
          permissions: { inherit: true },
          source: "/profile",
          digest: "sha256:" + "b".repeat(64),
        },
      };
      const result = await executeCodexCommand(input);
      expect(result.status, result.error?.message).toBe("succeeded");
      expect(result.nativeSessionId).toBe("thread-1");
      expect(result.artifacts).toHaveLength(1);
      expect(
        (result.payload?.evidence as Record<string, unknown>).red,
      ).toBeDefined();
      expect(await readFile(resolve(root, "behavior.txt"), "utf8")).toBe(
        "new\n",
      );
      const head = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
        cwd: root,
        stdout: "pipe",
      })
        .stdout.toString()
        .trim();
      expect(head).toBe(originalHead);
      await expect(verifyArtifacts(root, runDir)).resolves.toBeUndefined();
      const artifactRoot = resolve(root, result.artifacts[0]!.location);
      const attemptRoot = resolve(artifactRoot, "..");
      const hiddenAttempt = `${attemptRoot}.deleted`;
      await rename(attemptRoot, hiddenAttempt);
      await expect(verifyArtifacts(root, runDir)).rejects.toThrow(
        "missing artifact record",
      );
      await rename(hiddenAttempt, attemptRoot);
      await chmod(resolve(artifactRoot, "red.stdout"), 0o644);
      await writeFile(resolve(artifactRoot, "red.stdout"), "forged\n");
      await expect(verifyArtifacts(root, runDir)).rejects.toThrow(
        "artifact content digest mismatch",
      );
    } finally {
      process.env.PATH = previousPath;
    }
  });
});
