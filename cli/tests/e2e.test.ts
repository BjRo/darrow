import { afterEach, expect, test } from "bun:test";
import {
  chmod,
  cp,
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

async function waitForText(path: string): Promise<string> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (await Bun.file(path).exists()) {
      const value = (await Bun.file(path).text()).trim();
      if (value) return value;
    }
    await Bun.sleep(20);
  }
  return "";
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
trap 'exit 143' TERM
if [[ "\${1:-}" == "--version" ]]; then echo 'codex-cli 1.0.0'; exit 0; fi
if [[ "\${1:-}" == "sandbox" ]]; then
  shift; cwd=''
  while [[ $# -gt 0 && "$1" != "--" ]]; do if [[ "$1" == "-C" ]]; then cwd=$2; shift 2; else shift; fi; done
  shift; [[ -z "$cwd" ]] || cd "$cwd"; exec "$@"
fi
marker="$(dirname "$0")/unavailable-once"
if [[ ! -f "$marker" ]]; then touch "$marker"; echo 'requested model unavailable' >&2; exit 1; fi
touch "$(dirname "$0")/activity-started"
basename "$PWD" > "$(dirname "$0")/active-run"
if [[ -f "$(dirname "$0")/pause-next" ]]; then
  rm "$(dirname "$0")/pause-next"
  sleep 3
else
  sleep 1
fi
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
if [[ "$change" == 'review current implementation' ]]; then kind=review
elif [[ "$change" == 'publish retained evidence' ]]; then kind=publish
else kind=implement
fi
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
elif [[ "$kind" == publish ]]; then
  target=published; summary='Published retained evidence'
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
  - id: publish
    dependsOn: [review]
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: publish retained evidence }
    publish:
      ticket:
        backend: github
        project: BjRo/darrow
        nativeId: "4"
        url: https://github.com/BjRo/darrow/issues/4
      artifactTypes: [darrow.tdd-evidence]
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
      data: {
        runId: string;
        conclusion: string;
        workspace: string;
        publications: Array<{
          ticketKey: string;
          artifacts: Array<{ location: string; publicationId: string }>;
        }>;
      };
    };
    expect(envelope.data.conclusion).toBe("succeeded");
    expect(envelope.data.runId).toBe(waiting.data.runId);
    expect(envelope.data.workspace).toContain(
      resolve(root, ".darrow", "worktrees"),
    );
    expect(envelope.data.publications).toHaveLength(1);
    expect(envelope.data.publications[0]!.artifacts).toHaveLength(1);
    expect(
      await Bun.file(
        resolve(
          root,
          envelope.data.publications[0]!.artifacts[0]!.location,
          "green.meta",
        ),
      ).exists(),
    ).toBe(true);
    expect(
      await Bun.file(
        resolve(
          root,
          ".darrow",
          "tickets",
          envelope.data.publications[0]!.ticketKey,
          "ticket.json",
        ),
      ).exists(),
    ).toBe(true);
    expect(await Bun.file(resolve(bin, "received-instructions")).exists()).toBe(
      true,
    );
    const runDir = resolve(root, ".darrow", "runs", envelope.data.runId);
    const plan = (await Bun.file(resolve(runDir, "plan.json")).json()) as {
      roles: Array<{ id: string; profile: { digest: string } }>;
      steps: Array<{
        role: string;
        route: { routeId: string; profileDigest: string };
      }>;
    };
    expect(plan.roles.map((role) => role.id)).toEqual(["default"]);
    expect(new Set(plan.steps.map((step) => step.route.routeId)).size).toBe(1);
    expect(
      plan.steps.every(
        (step) =>
          step.role === "default" &&
          step.route.profileDigest === plan.roles[0]!.profile.digest,
      ),
    ).toBe(true);
    const lock = (await Bun.file(resolve(runDir, "lock.json")).json()) as {
      routes: Array<{ routeId: string }>;
      adapters: Array<{ id: string; routeIds: string[] }>;
    };
    expect(lock.routes.map((route) => route.routeId)).toEqual([
      plan.steps[0]!.route.routeId,
    ]);
    expect(lock.adapters).toMatchObject([
      {
        id: "codex-cli",
        routeIds: [plan.steps[0]!.route.routeId],
      },
    ]);
    expect(
      await readdir(
        resolve(
          runDir,
          "snapshot",
          "commands",
          "codex",
          "darrow-delivery",
          "implement",
        ),
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
      { stepId: "publish", state: "succeeded", attempt: 1 },
    ]);
    expect(inspected.data.counts.events).toBeGreaterThan(5);
    const events = await Bun.file(resolve(runDir, "events.jsonl")).text();
    expect(events).not.toContain("Use the restart-safe path.");
    expect(events).not.toContain("Address the rejected outcome.");
    expect(events).toContain('"type":"ticket.artifacts.published"');
    const invocationEvents = events
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((item) => item.type.startsWith("command.invocation."));
    expect(invocationEvents.length).toBeGreaterThan(3);
    expect(
      invocationEvents.every(
        (item) =>
          item.data.role === "default" &&
          item.data.profileDigest === plan.roles[0]!.profile.digest &&
          item.data.routeId === plan.steps[0]!.route.routeId &&
          item.data.routeSelectionSource === "fixed_plan",
      ),
    ).toBe(true);
    const persistedResults = await Promise.all(
      (await readdir(resolve(runDir, "results")))
        .filter((name) => name.endsWith(".json"))
        .map((name) => Bun.file(resolve(runDir, "results", name)).json()),
    );
    expect(
      persistedResults.every(
        (result) =>
          result.route?.routeId === plan.steps[0]!.route.routeId &&
          result.route?.selectionSource === "fixed_plan",
      ),
    ).toBe(true);
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

    const waitingCancellation = command(
      [
        "bun",
        cli,
        "run",
        "implement-change",
        "--change",
        "cancel before allocation",
        "--json",
      ],
      root,
      env,
    );
    expect(waitingCancellation.code, waitingCancellation.stderr).toBe(0);
    const waitingCancellationRun = JSON.parse(waitingCancellation.stdout.trim())
      .data.runId as string;
    const cancelledWhileWaiting = command(
      ["bun", cli, "cancel", waitingCancellationRun, "--json"],
      root,
      env,
    );
    expect(
      cancelledWhileWaiting.code,
      `${cancelledWhileWaiting.stderr}\n${cancelledWhileWaiting.stdout}`,
    ).toBe(0);
    const waitingCancelledData = JSON.parse(cancelledWhileWaiting.stdout.trim())
      .data as {
      conclusion: string;
      cancellation: { completed: string[]; incomplete: string[] };
    };
    expect(waitingCancelledData.conclusion).toBe("cancelled");
    expect(waitingCancelledData.cancellation.completed).toEqual([]);
    expect(waitingCancelledData.cancellation.incomplete).toEqual([
      "implement",
      "review",
      "publish",
    ]);

    await rm(resolve(bin, "unavailable-once"), { force: true });
    const restartWait = command(
      [
        "bun",
        cli,
        "run",
        "implement-change",
        "--change",
        "cancel after worker restart",
        "--base",
        "HEAD",
        "--json",
      ],
      root,
      env,
    );
    expect(
      restartWait.code,
      `${restartWait.stderr}\n${restartWait.stdout}`,
    ).toBe(0);
    const restartWaitRunId = JSON.parse(restartWait.stdout.trim()).data
      .runId as string;
    const workerBeforeCancellation = (await Bun.file(
      resolve(root, ".darrow", "runtime", "worker.json"),
    ).json()) as { pid: number };
    process.kill(workerBeforeCancellation.pid, "SIGTERM");
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        process.kill(workerBeforeCancellation.pid, 0);
        await Bun.sleep(20);
      } catch {
        break;
      }
    }
    const cancelledAfterRestart = command(
      ["bun", cli, "cancel", restartWaitRunId, "--json"],
      root,
      env,
    );
    expect(
      cancelledAfterRestart.code,
      `${cancelledAfterRestart.stderr}\n${cancelledAfterRestart.stdout}`,
    ).toBe(0);
    expect(
      JSON.parse(cancelledAfterRestart.stdout.trim()).data.conclusion,
    ).toBe("cancelled");
    const workerAfterCancellation = (await Bun.file(
      resolve(root, ".darrow", "runtime", "worker.json"),
    ).json()) as { pid: number };
    expect(workerAfterCancellation.pid).not.toBe(workerBeforeCancellation.pid);

    await rm(resolve(bin, "activity-started"), { force: true });
    await rm(resolve(bin, "active-run"), { force: true });
    await writeFile(resolve(bin, "pause-next"), "pause\n");
    const boundaryForeground = Bun.spawn(
      [
        "bun",
        cli,
        "run",
        "implement-change",
        "--change",
        "cancel at safe boundary",
        "--base",
        "HEAD",
        "--json",
      ],
      {
        cwd: root,
        env: { ...process.env, ...env },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const boundaryRunId = await waitForText(resolve(bin, "active-run"));
    expect(boundaryRunId).not.toBe("");
    const boundaryCancellation = command(
      ["bun", cli, "cancel", boundaryRunId, "--json"],
      root,
      env,
    );
    expect(
      boundaryCancellation.code,
      `${boundaryCancellation.stderr}\n${boundaryCancellation.stdout}`,
    ).toBe(0);
    await boundaryForeground.exited;
    const boundaryData = JSON.parse(boundaryCancellation.stdout.trim())
      .data as {
      conclusion: string;
      cancellation: {
        completed: string[];
        incomplete: string[];
        uncertain: string[];
      };
    };
    expect(boundaryData.conclusion).toBe("cancelled");
    expect(boundaryData.cancellation).toMatchObject({
      completed: ["implement"],
      incomplete: ["review", "publish"],
      uncertain: [],
    });
    const repeatedCancellation = command(
      ["bun", cli, "cancel", boundaryRunId, "--json"],
      root,
      env,
    );
    expect(repeatedCancellation.code, repeatedCancellation.stderr).toBe(0);
    const boundaryEvents = await Bun.file(
      resolve(root, ".darrow", "runs", boundaryRunId, "events.jsonl"),
    ).text();
    expect(boundaryEvents.match(/"type":"run.cancel.requested"/g)).toHaveLength(
      1,
    );
    expect(boundaryEvents.match(/"type":"run.completed"/g)).toHaveLength(1);

    const interruptPlugins = resolve(root, "interrupt-plugins");
    await mkdir(interruptPlugins);
    for (const plugin of ["darrow-delivery", "darrow-git"])
      await cp(
        resolve(CLI_ROOT, "..", "plugins", plugin),
        resolve(interruptPlugins, plugin),
        { recursive: true },
      );
    const interruptMetadataPath = resolve(
      interruptPlugins,
      "darrow-delivery",
      "skills",
      "implement",
      "darrow.json",
    );
    const interruptMetadata = (await Bun.file(
      interruptMetadataPath,
    ).json()) as Record<string, unknown>;
    interruptMetadata.cancellation = "interrupt";
    await writeFile(
      interruptMetadataPath,
      `${JSON.stringify(interruptMetadata, null, 2)}\n`,
    );
    const interruptEnv = {
      ...env,
      DARROW_PLUGIN_ROOTS: interruptPlugins,
    };
    await rm(resolve(bin, "activity-started"), { force: true });
    await rm(resolve(bin, "active-run"), { force: true });
    await writeFile(resolve(bin, "pause-next"), "pause\n");
    const interruptForeground = Bun.spawn(
      [
        "bun",
        cli,
        "run",
        "implement-change",
        "--change",
        "interrupt active command",
        "--base",
        "HEAD",
        "--json",
      ],
      {
        cwd: root,
        env: { ...process.env, ...interruptEnv },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const interruptRunId = await waitForText(resolve(bin, "active-run"));
    expect(interruptRunId).not.toBe("");
    const interrupted = command(
      ["bun", cli, "cancel", interruptRunId, "--json"],
      root,
      interruptEnv,
    );
    expect(
      interrupted.code,
      `${interrupted.stderr}\n${interrupted.stdout}`,
    ).toBe(0);
    await interruptForeground.exited;
    const interruptedData = JSON.parse(interrupted.stdout.trim()).data as {
      conclusion: string;
      cancellation: {
        completed: string[];
        incomplete: string[];
        uncertain: string[];
      };
    };
    expect(interruptedData.conclusion).toBe("cancelled");
    expect(interruptedData.cancellation).toMatchObject({
      completed: [],
      incomplete: ["review", "publish"],
      uncertain: ["implement"],
    });
    const interruptEvents = await Bun.file(
      resolve(root, ".darrow", "runs", interruptRunId, "events.jsonl"),
    ).text();
    expect(interruptEvents).toContain('"type":"command.invocation.cancelled"');
    const unaffected = command(
      ["bun", cli, "inspect", envelope.data.runId, "--json"],
      root,
      env,
    );
    expect(unaffected.code, unaffected.stderr).toBe(0);
    expect(JSON.parse(unaffected.stdout.trim()).data.conclusion).toBe(
      "succeeded",
    );
    const cleanupReport = command(
      ["bun", cli, "clean", "--run", envelope.data.runId, "--json"],
      root,
      env,
    );
    expect(cleanupReport.code, cleanupReport.stderr).toBe(0);
    const reportData = JSON.parse(cleanupReport.stdout.trim()).data as {
      mode: string;
      deleted: string[];
      items: Array<{ kind: string; eligible: boolean }>;
    };
    expect(reportData.mode).toBe("report");
    expect(reportData.deleted).toEqual([]);
    expect(
      reportData.items
        .filter(
          (item) => item.kind !== "worktree" && item.kind !== "ticket_artifact",
        )
        .every((item) => item.eligible),
    ).toBe(true);
    expect(reportData.items).toContainEqual(
      expect.objectContaining({
        kind: "ticket_artifact",
        eligible: false,
        reason: "dirty_ticket_artifact",
      }),
    );
    const cleaned = command(
      [
        "bun",
        cli,
        "clean",
        "--run",
        envelope.data.runId,
        "--run-data",
        "--json",
      ],
      root,
      env,
    );
    expect(cleaned.code, `${cleaned.stderr}\n${cleaned.stdout}`).toBe(0);
    expect(JSON.parse(cleaned.stdout.trim()).data.deleted).toEqual([
      `${envelope.data.runId}:artifacts`,
      `${envelope.data.runId}:snapshot`,
      `${envelope.data.runId}:content`,
      `${envelope.data.runId}:results`,
    ]);
    const inspectedAfterCleanup = command(
      ["bun", cli, "inspect", envelope.data.runId, "--json"],
      root,
      env,
    );
    expect(inspectedAfterCleanup.code, inspectedAfterCleanup.stderr).toBe(0);
    const cleanedInspection = JSON.parse(inspectedAfterCleanup.stdout.trim())
      .data as {
      conclusion: string;
      cleanup: { resources: Array<{ completedAt: string }> };
      counts: { results: number };
    };
    expect(cleanedInspection.conclusion).toBe("succeeded");
    expect(cleanedInspection.cleanup.resources).toHaveLength(4);
    expect(cleanedInspection.counts.results).toBe(0);

    const ticketKey = envelope.data.publications[0]!.ticketKey;
    const publicationId =
      envelope.data.publications[0]!.artifacts[0]!.publicationId;
    const ticketDirectory = resolve(root, ".darrow", "tickets", ticketKey);
    expect(command(["git", "add", ticketDirectory], root).code).toBe(0);
    expect(
      command(["git", "commit", "-qm", "checkpoint ticket publication"], root)
        .code,
    ).toBe(0);
    const ticketCleaned = command(
      [
        "bun",
        cli,
        "clean",
        "--run",
        envelope.data.runId,
        "--tickets",
        "--json",
      ],
      root,
      env,
    );
    expect(
      ticketCleaned.code,
      `${ticketCleaned.stderr}\n${ticketCleaned.stdout}`,
    ).toBe(0);
    expect(JSON.parse(ticketCleaned.stdout.trim()).data.deleted).toEqual([
      `ticket:${ticketKey}:${publicationId}`,
    ]);
    expect(
      (await Bun.file(resolve(ticketDirectory, "ticket.json")).json())
        .publications,
    ).toEqual([]);
    const inspectedAfterTicketCleanup = command(
      ["bun", cli, "inspect", envelope.data.runId, "--json"],
      root,
      env,
    );
    expect(
      inspectedAfterTicketCleanup.code,
      inspectedAfterTicketCleanup.stderr,
    ).toBe(0);
    expect(
      JSON.parse(inspectedAfterTicketCleanup.stdout.trim()).data.cleanup
        .resources,
    ).toHaveLength(5);

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

test.skipIf(!temporal)(
  "dependent command steps execute through independently locked Codex and Claude roles",
  async () => {
    const root = await mkdtemp(resolve(tmpdir(), "darrow-mixed-e2e-"));
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
printf '%s\\n' "$@" > "$(dirname "$0")/codex-args"
output=''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == "--output-last-message" ]]; then output=$2; shift 2; else shift; fi
done
prompt=$(cat)
skill=$(sed -n 's/^Read and follow \\(.*\\/SKILL.md\\) exactly\\.$/\\1/p' <<<"$prompt")
evidence=$(sed -n 's/^Evidence directory: //p' <<<"$prompt")
git switch -q -c feat/mixed
focused='grep -F codex behavior.txt || { echo expected-codex; exit 1; }'
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" red --expected expected-codex -- sh -c "$focused"
printf 'codex\\n' > behavior.txt
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" green -- sh -c "$focused"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" regression -- git diff --check
mkdir -p "$(dirname "$output")"
printf '%s\\n' '{"branch":"feat/mixed","summary":"Implemented with Codex","changedPaths":["behavior.txt"],"evidence":{"red":{},"green":{},"regression":{}}}' > "$output"
printf '%s\\n' '{"type":"thread.started","thread_id":"mixed-codex"}'
printf '%s\\n' '{"type":"turn.completed","usage":{"input_tokens":4,"output_tokens":2}}'
`,
      { mode: 0o755 },
    );
    await writeFile(
      resolve(bin, "claude"),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${1:-}" == "--version" ]]; then echo '2.1.185 (Claude Code)'; exit 0; fi
printf '%s\\n' "$@" > "$(dirname "$0")/claude-args"
prompt=$(cat)
skill=$(sed -n 's/^Read and follow \\(.*\\/SKILL.md\\) exactly\\.$/\\1/p' <<<"$prompt")
evidence=$(sed -n 's/^Evidence directory: //p' <<<"$prompt")
focused='grep -F claude behavior.txt || { echo expected-claude; exit 1; }'
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" red --expected expected-claude -- sh -c "$focused"
printf 'claude\\n' >> behavior.txt
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" green -- sh -c "$focused"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" regression -- git diff --check
printf '%s\\n' '{"type":"result","subtype":"success","is_error":false,"session_id":"mixed-claude","usage":{"input_tokens":5,"output_tokens":3},"permission_denials":[],"structured_output":{"branch":"feat/mixed","summary":"Reviewed with Claude","changedPaths":["behavior.txt"],"evidence":{"red":{},"green":{},"regression":{}}}}'
`,
      { mode: 0o755 },
    );
    const cli = resolve(CLI_ROOT, "src", "index.ts");
    const env = {
      DARROW_TEMPORAL_BIN: temporal!,
      DARROW_PLUGIN_ROOTS: resolve(CLI_ROOT, "..", "plugins"),
      CODEX_HOME: resolve(root, "codex-home"),
      CLAUDE_CONFIG_DIR: resolve(root, "claude-home"),
      PATH: `${bin}:${process.env.PATH}`,
    };
    const init = command(["bun", cli, "init", "--json"], root, env);
    expect(init.code, init.stderr).toBe(0);
    await mkdir(resolve(root, ".darrow", "profiles"), { recursive: true });
    await writeFile(
      resolve(root, ".darrow", "profiles", "claude-review.yaml"),
      `schemaVersion: 0.1.0
id: claude-review
harness: claude
provider: anthropic
model: claude-sonnet-4-6
reasoningEffort: medium
permissions:
  inherit: true
`,
    );
    await writeFile(
      resolve(root, ".darrow", "workflows", "mixed-review.yaml"),
      `schemaVersion: 0.1.0
id: mixed-review
version: 0.1.0
engine: ^0.1.0
inputs:
  change: { type: string, required: true }
requirements:
  capabilities:
    - { contract: git.branch.create, version: ^1.0.0 }
roles:
  implement: { profile: codex }
  review: { profile: claude-review }
loops: []
steps:
  - id: implement
    role: implement
    dependsOn: []
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: "\${inputs.change}" }
  - id: review
    role: review
    dependsOn: [implement]
    command: { id: darrow-delivery:implement, version: ^0.1.0 }
    with: { change: review current implementation }
`,
    );
    const execution = command(
      [
        "bun",
        cli,
        "run",
        "mixed-review",
        "--change",
        "write codex",
        "--base",
        "HEAD",
        "--json",
      ],
      root,
      env,
    );
    expect(execution.code, `${execution.stderr}\n${execution.stdout}`).toBe(0);
    const envelope = JSON.parse(execution.stdout.trim()) as {
      data: { runId: string; conclusion: string };
    };
    expect(envelope.data.conclusion).toBe("succeeded");
    const runDir = resolve(root, ".darrow", "runs", envelope.data.runId);
    const plan = (await Bun.file(resolve(runDir, "plan.json")).json()) as {
      roles: Array<{ id: string; profile: { harness: string } }>;
      steps: Array<{
        id: string;
        role: string;
        route: {
          routeId: string;
          harness: string;
          model: string;
          reasoningEffort: string;
        };
      }>;
    };
    expect(plan.roles.map(({ id, profile }) => [id, profile.harness])).toEqual([
      ["implement", "codex"],
      ["review", "claude"],
    ]);
    expect(
      plan.steps.map(({ id, role, route }) => [
        id,
        role,
        route.harness,
        route.model,
        route.reasoningEffort,
      ]),
    ).toEqual([
      ["implement", "implement", "codex", "gpt-5.6-sol", "high"],
      ["review", "review", "claude", "claude-sonnet-4-6", "medium"],
    ]);
    const lock = (await Bun.file(resolve(runDir, "lock.json")).json()) as {
      routes: Array<{ routeId: string }>;
      adapters: Array<{ id: string; routeIds: string[] }>;
    };
    expect(lock.routes).toHaveLength(2);
    expect(lock.adapters.map(({ id }) => id)).toEqual([
      "codex-cli",
      "claude-code",
    ]);
    expect(await Bun.file(resolve(bin, "codex-args")).text()).toContain(
      "gpt-5.6-sol",
    );
    expect(await Bun.file(resolve(bin, "claude-args")).text()).toContain(
      "claude-sonnet-4-6",
    );
    expect(await Bun.file(resolve(bin, "claude-args")).text()).toContain(
      "medium",
    );
    const results = await Promise.all(
      (await readdir(resolve(runDir, "results")))
        .filter((name) => name.endsWith(".json"))
        .map((name) => Bun.file(resolve(runDir, "results", name)).json()),
    );
    expect(results.map((result) => result.route.harness).sort()).toEqual([
      "claude",
      "codex",
    ]);
  },
  60_000,
);
