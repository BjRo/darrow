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
import { hashDirectory, hashFile, writeJson } from "../src/io";
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
    const commandDir = resolve(CLI_ROOT, "fixtures", "delivery-tdd");
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

  test("refuses an unconfined external evidence sandbox declaration", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-external-sandbox-"));
    temps.push(root);
    git(root, ["init", "-q"]);
    const evidence = resolve(root, "evidence");
    await mkdir(evidence);
    const commandDir = resolve(CLI_ROOT, "fixtures", "delivery-tdd");
    const broker = await startEvidenceBroker(
      commandDir,
      evidence,
      root,
      resolve(root, "attestations"),
      {
        environment: {
          ...process.env,
          DARROW_EXTERNAL_WORKSPACE_SANDBOX_ROOT: root,
        },
      },
    );
    try {
      const proc = Bun.spawn(
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
        {
          cwd: root,
          env: { ...process.env, ...broker.env },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      expect(await proc.exited).not.toBe(0);
      expect(await new Response(proc.stderr).text()).toContain(
        "not confining writes",
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
    await mkdir(resolve(snapshotDir, "commands", "codex", "darrow-delivery"), {
      recursive: true,
    });
    await cp(
      resolve(CLI_ROOT, "fixtures", "delivery-tdd"),
      resolve(snapshotDir, "commands", "codex", "darrow-delivery", "implement"),
      { recursive: true },
    );
    const outputSchema = resolve(
      snapshotDir,
      "commands",
      "codex",
      "darrow-delivery",
      "implement",
      "output.schema.json",
    );
    const completeSchema = await Bun.file(outputSchema).json();
    completeSchema.allOf = [
      {
        properties: { summary: { type: "string", minLength: 1 } },
      },
    ];
    await writeFile(
      outputSchema,
      `${JSON.stringify(completeSchema, null, 2)}\n`,
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
output=''; schema=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then output=$2; shift 2
  elif [[ "$1" == "--output-schema" ]]; then schema=$2; shift 2
  else shift; fi
done
if grep -Eq '"(uniqueItems|allOf)"' "$schema"; then exit 66; fi
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
      const route = {
        routeId: `sha256:${"a".repeat(64)}`,
        profileId: "codex",
        profileDigest: `sha256:${"b".repeat(64)}`,
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
        permissions: { inherit: true },
        limits: {},
        adapter: { id: "codex-cli", version: "0.1.0" },
        selectionSource: "fixed_plan",
      } as const;
      const input: ActivityInput = {
        runId: "run-1",
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
          source: resolve(
            snapshotDir,
            "commands",
            "darrow-delivery",
            "implement",
          ),
          digest: await hashDirectory(
            resolve(
              snapshotDir,
              "commands",
              "codex",
              "darrow-delivery",
              "implement",
            ),
          ),
          input: { change: "write new" },
          publish: null,
        },
        effectiveRoute: route,
        routeAmendment: null,
      };
      await writeJson(resolve(runDir, "lock.json"), {
        adapters: [
          {
            id: "codex-cli",
            executable: resolve(bin, "codex"),
            detectedVersion: "codex-cli 1.0.0",
            routeIds: [route.routeId],
            nativePermissions: {
              configurationEnvironment: { PATH: previousPath ?? "" },
              configurationSources: [
                {
                  path: "environment-defaults",
                  scope: "environment",
                  digest: `sha256:${"c".repeat(64)}`,
                },
              ],
            },
          },
        ],
      });
      const result = await executeCodexCommand(input);
      expect(result.status, result.error?.message).toBe("succeeded");
      expect(result.nativeSessionId).toBe("thread-1");
      expect(result.route).toEqual(route);
      expect(
        await Bun.file(
          resolve(runDir, "results", "implement-attempt-1.json"),
        ).json(),
      ).toMatchObject({ route });
      expect(result.artifacts).toHaveLength(1);
      const providerSchema = await Bun.file(
        resolve(
          runDir,
          "runtime",
          "schemas",
          "implement-attempt-1.codex-output.json",
        ),
      ).text();
      expect(providerSchema).not.toContain('"uniqueItems"');
      expect(providerSchema).not.toContain('"allOf"');
      expect(
        await Bun.file(
          resolve(
            snapshotDir,
            "commands",
            "codex",
            "darrow-delivery",
            "implement",
            "output.schema.json",
          ),
        ).text(),
      ).toContain('"allOf"');
      expect(
        (result.payload?.evidence as Record<string, unknown>).red,
      ).toBeDefined();
      expect(await readFile(resolve(root, "behavior.txt"), "utf8")).toBe(
        "new\n",
      );
      const invocationEvents = (
        await Bun.file(resolve(runDir, "events.jsonl")).text()
      )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { data: Record<string, unknown> });
      expect(invocationEvents[0]?.data).toMatchObject({
        role: "default",
        profileId: "codex",
        profileDigest: route.profileDigest,
        routeId: route.routeId,
        harness: "codex",
        provider: "openai",
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
        adapter: "codex-cli",
        routeSelectionSource: "fixed_plan",
      });
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

  test("uses locked execution identity and generic command metadata", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-codex-generic-"));
    temps.push(root);
    const workspace = resolve(root, "workspace");
    const runDir = resolve(root, ".darrow", "runs", "run-generic");
    const snapshotDir = resolve(runDir, "snapshot");
    const commandDir = resolve(
      snapshotDir,
      "commands",
      "codex",
      "example",
      "generic",
    );
    for (const path of [workspace, commandDir, resolve(runDir, "results")])
      await mkdir(path, { recursive: true });
    await writeFile(resolve(commandDir, "SKILL.md"), "# generic\n");
    await writeFile(
      resolve(commandDir, "darrow.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        kind: "command",
        contractVersion: "1.0.0",
        inputSchema: "./request.contract.json",
        outputSchema: "./response.contract.json",
      })}\n`,
    );
    await writeFile(
      resolve(commandDir, "request.contract.json"),
      `${JSON.stringify({
        type: "object",
        additionalProperties: false,
        required: ["subject", "count"],
        properties: {
          subject: { type: "string" },
          count: { type: "integer" },
        },
      })}\n`,
    );
    await writeFile(
      resolve(commandDir, "response.contract.json"),
      `${JSON.stringify({
        type: "object",
        additionalProperties: false,
        required: ["message"],
        properties: { message: { type: "string" } },
      })}\n`,
    );
    const lockedBin = resolve(root, "locked-bin");
    const changedBin = resolve(root, "changed-bin");
    const lockedHome = resolve(root, "locked-codex-home");
    const changedHome = resolve(root, "changed-codex-home");
    for (const path of [lockedBin, changedBin, lockedHome, changedHome])
      await mkdir(path);
    const lockedConfig = resolve(lockedHome, "config.toml");
    await writeFile(lockedConfig, "approval_policy = 'never'\n");
    await writeFile(
      resolve(lockedBin, "codex"),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo 'codex-cli locked'; exit 0; fi
printf '%s' "\${CODEX_HOME:-}" > "$(dirname "$0")/home"
printf '%s\\n' "$@" > "$(dirname "$0")/args"
output=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then output=$2; shift 2; else shift; fi
done
prompt=$(cat)
printf '%s' "$prompt" > "$(dirname "$0")/prompt"
printf '%s\\n' '{"message":"generic succeeded"}' > "$output"
printf '%s\\n' '{"type":"thread.started","thread_id":"generic-thread"}'
`,
      { mode: 0o755 },
    );
    await writeFile(
      resolve(changedBin, "codex"),
      `#!/usr/bin/env bash
touch "$(dirname "$0")/invoked"
echo 'codex-cli changed'
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
      routeId: `sha256:${"d".repeat(64)}`,
      profileId: "codex",
      profileDigest: `sha256:${"e".repeat(64)}`,
      harness: "codex",
      provider: "openai",
      model: "gpt-test",
      reasoningEffort: "high",
      permissions: { inherit: true },
      limits: {},
      adapter: { id: "codex-cli", version: "0.1.0" },
      selectionSource: "fixed_plan",
    } as const;
    await writeJson(resolve(runDir, "lock.json"), {
      adapters: [
        {
          id: "codex-cli",
          executable: resolve(lockedBin, "codex"),
          detectedVersion: "codex-cli locked",
          routeIds: [route.routeId],
          nativePermissions: {
            configurationEnvironment: {
              CODEX_HOME: lockedHome,
              PATH: process.env.PATH ?? "",
            },
            configurationSources: [
              {
                path: lockedConfig,
                scope: "user",
                digest: await hashFile(lockedConfig),
              },
            ],
          },
        },
      ],
    });
    const previousPath = process.env.PATH;
    const previousHome = process.env.CODEX_HOME;
    process.env.PATH = `${changedBin}:${previousPath}`;
    process.env.CODEX_HOME = changedHome;
    try {
      const result = await executeCodexCommand({
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
          input: { subject: "alpha", count: 2 },
          publish: null,
        },
        effectiveRoute: route,
        routeAmendment: null,
      });
      expect(result.status, result.error?.message).toBe("succeeded");
      expect(result.payload).toEqual({ message: "generic succeeded" });
      expect(result.artifacts).toEqual([]);
      expect(await readFile(resolve(lockedBin, "home"), "utf8")).toBe(
        lockedHome,
      );
      expect(await readFile(resolve(lockedBin, "prompt"), "utf8")).toContain(
        'Command input (JSON): {"count":2,"subject":"alpha"}',
      );
      expect(await readFile(resolve(lockedBin, "args"), "utf8")).toContain(
        resolve(
          runDir,
          "runtime",
          "schemas",
          "generic-attempt-1.codex-output.json",
        ),
      );
      expect(await Bun.file(resolve(changedBin, "invoked")).exists()).toBe(
        false,
      );
      expect(
        await Bun.file(resolve(changedBin, "interpreter-invoked")).exists(),
      ).toBe(false);
    } finally {
      process.env.PATH = previousPath;
      if (previousHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousHome;
    }
  });
});
