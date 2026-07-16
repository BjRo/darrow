import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { CLI_ROOT } from "../src/paths";

const temps: string[] = [];
afterEach(async () => { await Promise.all(temps.splice(0).map(async (path) => {
  for (const name of ["worker.json", "service.json"]) {
    try { process.kill((await Bun.file(resolve(path, ".darrow", "runtime", name)).json() as { pid: number }).pid, "SIGTERM"); } catch { /* not started or already stopped */ }
  }
  await Bun.spawn(["chmod", "-R", "u+w", path]).exited;
  await rm(path, { recursive: true, force: true });
})); });

function command(args: string[], cwd: string, env?: Record<string, string>): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync(args, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

const temporal = process.env.DARROW_E2E_TEMPORAL_BIN;

test.skipIf(!temporal)("fresh repository reaches terminal completion through Temporal and Codex", async () => {
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
  await writeFile(resolve(bin, "codex"), `#!/usr/bin/env bash
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
skill=$(printf '%s\n' "$prompt" | sed -n 's/^Read and follow \\(.*\\/SKILL.md\\) exactly\\.$/\\1/p')
evidence=$(printf '%s\n' "$prompt" | sed -n 's/^Evidence directory: //p')
git switch -q -c feat/e2e-change
focused='grep -F new behavior.txt || { echo expected-new; exit 1; }'
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" red --expected expected-new -- sh -c "$focused"
printf 'new\n' > behavior.txt
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" green -- sh -c "$focused"
bash "$(dirname "$skill")/scripts/evidence.sh" run "$evidence" regression -- git diff --check
mkdir -p "$(dirname "$output")"
printf '%s\n' '{"branch":"feat/e2e-change","summary":"Implemented the requested behavior","changedPaths":["behavior.txt"],"evidence":{"red":{},"green":{},"regression":{}}}' > "$output"
printf '%s\n' '{"type":"thread.started","thread_id":"e2e-thread"}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'
`, { mode: 0o755 });
  const cli = resolve(CLI_ROOT, "src", "index.ts");
  const env = { DARROW_TEMPORAL_BIN: temporal!, DARROW_PLUGIN_ROOTS: resolve(CLI_ROOT, "..", "plugins"), PATH: `${bin}:${process.env.PATH}` };
  const init = command(["bun", cli, "init", "--json"], root, env);
  expect(init.code, init.stderr).toBe(0);
  const requested = command(["bun", cli, "run", "implement-change", "--change", "write new", "--json"], root, env);
  expect(requested.code, `${requested.stderr}\n${requested.stdout}`).toBe(0);
  const waiting = JSON.parse(requested.stdout.trim()) as { data: { runId: string; state: string } };
  expect(waiting.data.state).toBe("waiting_for_input");
  const allocated = command(["bun", cli, "continue", waiting.data.runId, "--choice", "head", "--json"], root, env);
  expect(allocated.code, `${allocated.stderr}\n${allocated.stdout}`).toBe(0);
  const modelWait = JSON.parse(allocated.stdout.trim()) as { data: { runId: string; state: string } };
  expect(modelWait.data.state).toBe("waiting_for_input");
  const foreground = Bun.spawn(["bun", cli, "continue", waiting.data.runId, "--choice", "retry", "--json"], { cwd: root, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  for (let attempt = 0; attempt < 100 && !await Bun.file(resolve(bin, "activity-started")).exists(); attempt += 1) await Bun.sleep(20);
  expect(await Bun.file(resolve(bin, "activity-started")).exists()).toBe(true);
  foreground.kill("SIGTERM");
  await foreground.exited;
  const execution = command(["bun", cli, "resume", waiting.data.runId, "--json"], root, env);
  expect(execution.code, `${execution.stderr}\n${execution.stdout}`).toBe(0);
  const envelope = JSON.parse(execution.stdout.trim()) as { data: { runId: string; conclusion: string; workspace: string } };
  expect(envelope.data.conclusion).toBe("succeeded");
  expect(envelope.data.runId).toBe(waiting.data.runId);
  expect(envelope.data.workspace).toContain(resolve(root, ".darrow", "worktrees"));
  const runDir = resolve(root, ".darrow", "runs", envelope.data.runId);
  expect(await readdir(resolve(runDir, "snapshot", "commands", "darrow-delivery", "implement"))).toContain("SKILL.md");
  expect(await readdir(resolve(runDir, "artifacts", "implement", "attempt-1-2"))).toContain("artifact.json");
  const inspect = command(["bun", cli, "inspect", envelope.data.runId, "--json"], root, env);
  expect(inspect.code, inspect.stderr).toBe(0);
  const inspected = JSON.parse(inspect.stdout.trim()) as { data: { state: string; conclusion: string; counts: { events: number } } };
  expect(inspected.data.state).toBe("completed");
  expect(inspected.data.conclusion).toBe("succeeded");
  expect(inspected.data.counts.events).toBeGreaterThan(5);
}, 120_000);
