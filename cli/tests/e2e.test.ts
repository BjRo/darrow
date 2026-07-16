import { afterEach, expect, test } from "bun:test";
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { CLI_ROOT } from "../src/paths";

const temps: string[] = [];
afterEach(async () => {
  await Promise.all(
    temps.splice(0).map(async (path) => {
      for (const name of ["worker.json", "service.json"]) {
        try {
          process.kill(
            (
              (await Bun.file(
                resolve(path, ".darrow", "runtime", name),
              ).json()) as { pid: number }
            ).pid,
            "SIGTERM",
          );
        } catch {
          /* not started or already stopped */
        }
      }
      await Bun.spawn(["chmod", "-R", "u+w", path]).exited;
      await rm(path, { recursive: true, force: true });
    }),
  );
});

function command(
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(args, {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

const temporal = process.env.DARROW_E2E_TEMPORAL_BIN;

test.skipIf(!temporal)(
  "fresh repository reaches terminal completion through Temporal and Codex",
  async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-e2e-"));
    temps.push(root);
    expect(command(["git", "init", "-q"], root).code).toBe(0);
    command(["git", "config", "user.name", "Test"], root);
    command(["git", "config", "user.email", "test@example.com"], root);
    await writeFile(resolve(root, "behavior.txt"), "old\n");
    command(["git", "add", "behavior.txt"], root);
    command(["git", "commit", "-qm", "fixture"], root);
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
marker="$(dirname "$0")/unavailable-once"
if [[ ! -f "$marker" ]]; then touch "$marker"; echo 'requested model unavailable' >&2; exit 1; fi
touch "$(dirname "$0")/activity-started"
sleep 1
output=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then output=$2; shift 2; else shift; fi
done
prompt=$(cat)
printf '%s' "$prompt" > "$(dirname "$0")/last-prompt"
skill=$(printf '%s\n' "$prompt" | sed -n 's/^Read and follow \\(.*\\/SKILL.md\\) exactly\\.$/\\1/p')
evidence=$(printf '%s\n' "$prompt" | sed -n 's/^Evidence directory: //p')
workspace=$(basename "$PWD")
change=$(sed -n 's/^Requested change: //p' <<<"$prompt")
if [[ "$change" == 'review current implementation' ]]; then kind=review; else kind=implement; fi
counter="$(dirname "$0")/count-$workspace-$kind"
count=$(($(cat "$counter" 2>/dev/null || echo 0) + 1))
printf '%s\n' "$count" > "$counter"
if grep -F 'Supplemental human instructions:' <<<"$prompt" >/dev/null; then
  grep -E 'Use the restart-safe path.|Address the rejected outcome.' <<<"$prompt"
  touch "$(dirname "$0")/received-instructions"
fi
if [[ "$kind" == implement && "$count" -eq 2 ]]; then
  grep -F 'Address the rejected outcome.' <<<"$prompt"
  grep -F 'Prior attempt artifact:' <<<"$prompt"
fi
if [[ "$kind" == review ]]; then
  grep -F 'Prior attempt artifact:' <<<"$prompt"
  if [[ "$count" -eq 1 ]]; then target=reviewed; summary='Review rejected'; else target=reviewed-again; summary=Approved; fi
else
  if [[ "$count" -eq 1 ]]; then target=new; summary=Implemented; else target=newer; summary=Implemented; fi
fi
git switch -q "feat/$workspace" 2>/dev/null || git switch -q -c "feat/$workspace"
focused="grep -F '$target' behavior.txt || { echo expected-$target; exit 1; }"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" red --expected "expected-$target" -- sh -c "$focused"
printf '%s\n' "$target" > behavior.txt
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" green -- sh -c "$focused"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" regression -- git diff --check
mkdir -p "$(dirname "$output")"
printf '{"branch":"feat/%s","summary":"%s","changedPaths":["behavior.txt"],"evidence":{"red":{},"green":{},"regression":{}}}\n' "$workspace" "$summary" > "$output"
printf '%s\n' '{"type":"thread.started","thread_id":"e2e-thread"}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'
`,
      { mode: 0o755 },
    );
    const cli = resolve(CLI_ROOT, "src", "index.ts");
    const env = {
      DARROW_TEMPORAL_BIN: temporal!,
      DARROW_PLUGIN_ROOTS: resolve(CLI_ROOT, "..", "plugins"),
      CODEX_HOME: resolve(root, "codex-home"),
      PATH: `${bin}:${process.env.PATH}`,
    };
    const init = command(["bun", cli, "init", "--json"], root, env);
    expect(init.code, init.stderr).toBe(0);
    await writeFile(
      resolve(root, ".darrow", "workflows", "implement-change.yaml"),
      `schemaVersion: 0.1.0
id: implement-change
version: 0.1.0
engine: ^0.1.0
inputs:
  change: { type: string, required: true }
requirements:
  capabilities:
    - { contract: git.branch.create, version: ^1.0.0 }
profile: codex
loops:
  - id: implementation-review
    steps: [implement, review]
    maxAttempts: 2
    until: { stepId: review, output: summary, equals: Approved }
    waiver:
      id: review-rejection
      description: Accept the implementation despite the rejected outcome.
      instructionsTo: null
steps:
  - id: implement
    dependsOn: []
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: "\${inputs.change}" }
  - id: review
    dependsOn: [implement]
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: review current implementation }
`,
    );
    const requested = command(
      [
        "bun",
        cli,
        "run",
        "implement-change",
        "--change",
        "write new",
        "--json",
      ],
      root,
      env,
    );
    expect(requested.code, `${requested.stderr}\n${requested.stdout}`).toBe(0);
    const waiting = JSON.parse(requested.stdout.trim()) as {
      data: {
        runId: string;
        state: string;
        request: {
          requestId: string;
          version: number;
          reason: string;
          choices: Array<{ id: string; consequence: string }>;
        };
      };
    };
    expect(waiting.data.state).toBe("waiting_for_input");
    expect(waiting.data.request.reason).toBe("dirty_checkout");
    expect(waiting.data.request.choices.map((choice) => choice.id)).toEqual([
      "head",
      "current",
      "abort",
    ]);
    const handoff = command(
      ["bun", cli, "inspect", waiting.data.runId],
      root,
      env,
    );
    expect(handoff.code, handoff.stderr).toBe(0);
    expect(handoff.stdout).toContain(
      "Question: How should Darrow handle the uncommitted invoking checkout?",
    );
    expect(handoff.stdout.trim().split("\n").at(-1)).toBe(
      `Continue: darrow continue ${waiting.data.runId}`,
    );
    const uncorrelated = command(
      [
        "bun",
        cli,
        "continue",
        waiting.data.runId,
        "--choice",
        "head",
        "--json",
      ],
      root,
      env,
    );
    expect(uncorrelated.code).not.toBe(0);
    expect(uncorrelated.stderr).toContain(
      "requires --request and --version in non-interactive mode",
    );
    const allocated = command(
      [
        "bun",
        cli,
        "continue",
        waiting.data.runId,
        "--request",
        waiting.data.request.requestId,
        "--version",
        String(waiting.data.request.version),
        "--choice",
        "head",
        "--json",
      ],
      root,
      env,
    );
    expect(allocated.code, `${allocated.stderr}\n${allocated.stdout}`).toBe(0);
    const modelWait = JSON.parse(allocated.stdout.trim()) as {
      data: {
        runId: string;
        state: string;
        request: {
          requestId: string;
          version: number;
          reason: string;
          choices: Array<{ id: string; acceptsInstructions: boolean }>;
        };
      };
    };
    expect(modelWait.data.state).toBe("waiting_for_input");
    expect(modelWait.data.request.reason).toBe("model_unavailable");
    expect(
      modelWait.data.request.choices.find((choice) => choice.id === "retry")
        ?.acceptsInstructions,
    ).toBe(true);
    const stale = command(
      [
        "bun",
        cli,
        "continue",
        waiting.data.runId,
        "--request",
        modelWait.data.request.requestId,
        "--version",
        String(modelWait.data.request.version + 1),
        "--choice",
        "retry",
        "--json",
      ],
      root,
      env,
    );
    expect(stale.code).not.toBe(0);
    expect(stale.stderr).toContain("stale continuation");
    const firstWorker = (await Bun.file(
      resolve(root, ".darrow", "runtime", "worker.json"),
    ).json()) as { pid: number };
    process.kill(firstWorker.pid, "SIGTERM");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        process.kill(firstWorker.pid, 0);
        await Bun.sleep(20);
      } catch {
        break;
      }
    }
    const instructions = resolve(root, "continuation-instructions.txt");
    await writeFile(instructions, "Use the restart-safe path.\n");
    const foreground = Bun.spawn(
      [
        "bun",
        cli,
        "continue",
        waiting.data.runId,
        "--request",
        modelWait.data.request.requestId,
        "--version",
        String(modelWait.data.request.version),
        "--choice",
        "retry",
        "--instructions-file",
        instructions,
        "--actor",
        "e2e-user",
        "--harness",
        "codex",
        "--json",
      ],
      {
        cwd: root,
        env: { ...process.env, ...env },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    for (
      let attempt = 0;
      attempt < 100 &&
      !(await Bun.file(resolve(bin, "activity-started")).exists());
      attempt += 1
    )
      await Bun.sleep(20);
    expect(await Bun.file(resolve(bin, "activity-started")).exists()).toBe(
      true,
    );
    const restartedWorker = (await Bun.file(
      resolve(root, ".darrow", "runtime", "worker.json"),
    ).json()) as { pid: number };
    expect(restartedWorker.pid).not.toBe(firstWorker.pid);
    foreground.kill("SIGTERM");
    await foreground.exited;
    const execution = command(
      ["bun", cli, "resume", waiting.data.runId, "--json"],
      root,
      env,
    );
    expect(execution.code, `${execution.stderr}\n${execution.stdout}`).toBe(0);
    const loopWait = JSON.parse(execution.stdout.trim()) as {
      data: {
        runId: string;
        state: string;
        request: {
          requestId: string;
          version: number;
          reason: string;
          choices: Array<{ id: string }>;
        };
      };
    };
    expect(loopWait.data.state).toBe("waiting_for_input");
    expect(loopWait.data.request.reason).toBe("loop_outcome");
    expect(loopWait.data.request.choices.map((choice) => choice.id)).toEqual([
      "retry",
      "waive",
      "abort",
    ]);
    const loopInstructions = resolve(root, "loop-instructions.txt");
    await writeFile(loopInstructions, "Address the rejected outcome.\n");
    const converged = command(
      [
        "bun",
        cli,
        "continue",
        waiting.data.runId,
        "--request",
        loopWait.data.request.requestId,
        "--version",
        String(loopWait.data.request.version),
        "--choice",
        "retry",
        "--instructions-file",
        loopInstructions,
        "--json",
      ],
      root,
      env,
    );
    expect(converged.code, `${converged.stderr}\n${converged.stdout}`).toBe(0);
    const envelope = JSON.parse(converged.stdout.trim()) as {
      data: { runId: string; conclusion: string; workspace: string };
    };
    expect(envelope.data.conclusion).toBe("succeeded");
    expect(envelope.data.runId).toBe(waiting.data.runId);
    expect(envelope.data.workspace).toContain(
      resolve(root, ".darrow", "worktrees"),
    );
    expect(await Bun.file(resolve(bin, "received-instructions")).exists()).toBe(
      true,
    );
    const runDir = resolve(root, ".darrow", "runs", envelope.data.runId);
    expect(
      await readdir(
        resolve(runDir, "snapshot", "commands", "darrow-delivery", "implement"),
      ),
    ).toContain("SKILL.md");
    expect(
      await readdir(
        resolve(runDir, "artifacts", "implement", "attempt-implement-3"),
      ),
    ).toContain("artifact.json");
    expect(
      await readdir(resolve(runDir, "artifacts", "review", "attempt-review-2")),
    ).toContain("artifact.json");
    const inspect = command(
      ["bun", cli, "inspect", envelope.data.runId, "--json"],
      root,
      env,
    );
    expect(inspect.code, inspect.stderr).toBe(0);
    const inspected = JSON.parse(inspect.stdout.trim()) as {
      data: {
        state: string;
        conclusion: string;
        steps: Array<{ stepId: string; state: string; attempt: number }>;
        counts: { events: number };
      };
    };
    expect(inspected.data.state).toBe("completed");
    expect(inspected.data.conclusion).toBe("succeeded");
    expect(inspected.data.steps).toEqual([
      { stepId: "implement", state: "succeeded", attempt: 3 },
      { stepId: "review", state: "succeeded", attempt: 2 },
    ]);
    expect(inspected.data.counts.events).toBeGreaterThan(5);
    const events = await Bun.file(resolve(runDir, "events.jsonl")).text();
    expect(events).not.toContain("Use the restart-safe path.");
    expect(events).not.toContain("Address the rejected outcome.");
    const received = events
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .find(
        (item) =>
          item.type === "human.input.received" &&
          item.data.requestId === modelWait.data.request.requestId,
      );
    expect(received.data.actor).toEqual({
      id: "e2e-user",
      harness: "codex",
      verified: false,
    });
    expect(received.data.instructions.contentHash).toMatch(/^sha256:/);
    expect(
      await Bun.file(resolve(root, received.data.instructions.location)).text(),
    ).toBe("Use the restart-safe path.\n");

    const waiverWorkflow = await Bun.file(
      resolve(root, ".darrow", "workflows", "implement-change.yaml"),
    ).text();
    await writeFile(
      resolve(root, ".darrow", "workflows", "implement-change.yaml"),
      waiverWorkflow
        .replace("maxAttempts: 2", "maxAttempts: 1")
        .replace("equals: Approved", "equals: Never"),
    );
    const waiverRun = command(
      [
        "bun",
        cli,
        "run",
        "implement-change",
        "--change",
        "accept known limitation",
        "--base",
        "HEAD",
        "--json",
      ],
      root,
      env,
    );
    expect(waiverRun.code, `${waiverRun.stderr}\n${waiverRun.stdout}`).toBe(0);
    const waiverWait = JSON.parse(waiverRun.stdout.trim()) as {
      data: {
        runId: string;
        request: {
          requestId: string;
          version: number;
          choices: Array<{ id: string }>;
        };
      };
    };
    expect(waiverWait.data.request.choices.map((choice) => choice.id)).toEqual([
      "waive",
      "abort",
    ]);
    const rationale = resolve(root, "waiver-rationale.txt");
    const missingRationale = command(
      [
        "bun",
        cli,
        "continue",
        waiverWait.data.runId,
        "--request",
        waiverWait.data.request.requestId,
        "--version",
        String(waiverWait.data.request.version),
        "--choice",
        "waive",
        "--json",
      ],
      root,
      env,
    );
    expect(missingRationale.code).not.toBe(0);
    expect(missingRationale.stderr).toContain("requires --rationale-file");
    await writeFile(rationale, "The remaining limitation is acceptable.\n");
    const waived = command(
      [
        "bun",
        cli,
        "continue",
        waiverWait.data.runId,
        "--request",
        waiverWait.data.request.requestId,
        "--version",
        String(waiverWait.data.request.version),
        "--choice",
        "waive",
        "--rationale-file",
        rationale,
        "--actor",
        "e2e-user",
        "--json",
      ],
      root,
      env,
    );
    expect(waived.code, `${waived.stderr}\n${waived.stdout}`).toBe(0);
    const waivedEnvelope = JSON.parse(waived.stdout.trim()) as {
      data: {
        conclusion: string;
        waivers: Array<{ rationale: { location: string } }>;
      };
    };
    expect(waivedEnvelope.data.conclusion).toBe("succeeded_with_waivers");
    expect(waivedEnvelope.data.waivers).toHaveLength(1);
    expect(
      await Bun.file(
        resolve(root, waivedEnvelope.data.waivers[0]!.rationale.location),
      ).text(),
    ).toBe("The remaining limitation is acceptable.\n");
    const waiverEvents = await Bun.file(
      resolve(root, ".darrow", "runs", waiverWait.data.runId, "events.jsonl"),
    ).text();
    expect(waiverEvents).toContain('"type":"waiver.accepted"');
    expect(waiverEvents).not.toContain(
      "The remaining limitation is acceptable.",
    );
    const storedRationale = resolve(
      root,
      waivedEnvelope.data.waivers[0]!.rationale.location,
    );
    await chmod(storedRationale, 0o644);
    await writeFile(storedRationale, "forged rationale\n");
    const corrupted = command(
      ["bun", cli, "inspect", waiverWait.data.runId, "--json"],
      root,
      env,
    );
    expect(corrupted.code).not.toBe(0);
    expect(corrupted.stderr).toContain("failed verification");
  },
  120_000,
);
