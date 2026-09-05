import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

async function waitForFile(path: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!(await Bun.file(path).exists())) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await Bun.sleep(20);
  }
}

async function recoveryFixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-recovery-"));
  const output = join(root, "result.json");
  const ready = join(root, "ready");
  const preload = join(root, "harness.ts");
  const condition = join(root, "condition.md");
  await writeFile(condition, `Synthetic run ${root}`);
  await writeFile(
    preload,
    `
import { codexAdapter } from ${JSON.stringify(join(import.meta.dir, "adapters/codex.ts"))};
import { runChecks } from ${JSON.stringify(join(import.meta.dir, "checks.ts"))};
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
codexAdapter.sourceCodexPlugin = false;
codexAdapter.skillMounts = [".agents/skills"];
codexAdapter.version = async () => "synthetic";
codexAdapter.run = async ({ repoDir }) => {
  await writeFile(${JSON.stringify(ready)}, repoDir);
  if (process.env.RECOVERY_WAIT === "1") {
    await writeFile(join(repoDir, ".git/wait.sh"), "echo $$ > .git/child.pid\\ntrap '' TERM\\nwhile :; do sleep 1; done\\n");
    await runChecks(repoDir, [{ name: "waiting candidate child", run: "sh .git/wait.sh" }]);
  }
  const resultText = "What subject would you like me to grill?";
  await writeFile(join(repoDir, ".git/last-message.md"), resultText);
  return { ok: true, durationMs: 1, inputTokens: 1, outputTokens: 1, costUsd: null,
    resultText, raw: "completed synthetic turn", skillActivation: {
      source: "explicit_invocation", complete: true, primarySkill: "grilling", observedSkills: ["grilling"] } };
};
`,
  );
  const start = (wait: boolean) =>
    Bun.spawn(
      [
        process.execPath,
        "--preload",
        preload,
        join(import.meta.dir, "run.ts"),
        "--case",
        "grilling-incomplete-subject",
        "--harness",
        "codex",
        "--model",
        "synthetic",
        "--condition",
        condition,
        "--trials",
        "1",
        "--jobs",
        "1",
        "--output",
        output,
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, RECOVERY_WAIT: wait ? "1" : "0" },
      },
    );
  return { root, output, ready, start };
}

async function cleanupRun(root: string, output: string) {
  const active = join(import.meta.dir, "../results/active");
  for (const name of await readdir(active)) {
    const path = join(active, name);
    const record = JSON.parse(await readFile(path, "utf8"));
    if (record.artifactPath !== output) continue;
    if (record.evidenceDirectory)
      await rm(record.evidenceDirectory, { recursive: true, force: true });
    await rm(path, { force: true });
  }
  await rm(root, { recursive: true, force: true });
}

async function activeRecord(output: string) {
  const active = join(import.meta.dir, "../results/active");
  for (const name of await readdir(active)) {
    const path = join(active, name);
    const record = JSON.parse(await readFile(path, "utf8"));
    if (record.artifactPath === output) return { path, record };
  }
  throw new Error(`no active record for ${output}`);
}

test("competing retries acquire one owner and a live duplicate remains blocked", async () => {
  const fixture = await recoveryFixture();
  const prior = fixture.start(true);
  const retries: ReturnType<typeof fixture.start>[] = [];
  try {
    await waitForFile(fixture.ready);
    const previous = await activeRecord(fixture.output);
    prior.kill("SIGTERM");
    await prior.exited;
    await rm(fixture.ready);
    retries.push(fixture.start(true), fixture.start(true));
    const loserCode = await Promise.race(retries.map((proc) => proc.exited));
    expect(loserCode).toBe(1);
    await waitForFile(fixture.ready);
    expect(retries.filter((proc) => proc.exitCode === null)).toHaveLength(1);
    const duplicate = fixture.start(false);
    const [stderr, code] = await Promise.all([
      new Response(duplicate.stderr).text(),
      duplicate.exited,
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain("an equivalent evaluation is still active");
    const preserved = JSON.parse(
      await readFile(
        join(previous.record.evidenceDirectory, "run.json"),
        "utf8",
      ),
    );
    expect(preserved.status).toBe("interrupted");
  } finally {
    for (const proc of [prior, ...retries]) proc.kill("SIGTERM");
    await Promise.all([prior, ...retries].map((proc) => proc.exited));
    await cleanupRun(fixture.root, fixture.output);
  }
}, 15_000);

test.each(["reused-pid", "legacy"] as const)(
  "recovery handles %s ownership conservatively",
  async (kind) => {
    const fixture = await recoveryFixture();
    const prior = fixture.start(true);
    try {
      await waitForFile(fixture.ready);
      prior.kill("SIGTERM");
      await prior.exited;
      const { path, record } = await activeRecord(fixture.output);
      record.status = "active";
      if (kind === "legacy") delete record.owner;
      else
        record.owner = {
          ...record.owner,
          pid: process.pid,
          startedAt: "a different process birth",
        };
      await writeFile(path, JSON.stringify(record));
      const retry = fixture.start(false);
      const [stderr, code] = await Promise.all([
        new Response(retry.stderr).text(),
        retry.exited,
      ]);
      expect(code, stderr).toBe(kind === "legacy" ? 1 : 0);
      if (kind === "legacy")
        expect(stderr).toContain("ownership is unverifiable");
    } finally {
      prior.kill("SIGTERM");
      await prior.exited;
      await cleanupRun(fixture.root, fixture.output);
    }
  },
  15_000,
);

test.each(["SIGTERM", "SIGKILL"] as const)(
  "an equivalent CLI retry recovers after %s and confirmed exit",
  async (signal) => {
    const fixture = await recoveryFixture();
    const first = fixture.start(true);
    try {
      await waitForFile(fixture.ready);
      first.kill(signal);
      await first.exited;
      const retry = fixture.start(false);
      const [stderr, code] = await Promise.all([
        new Response(retry.stderr).text(),
        retry.exited,
      ]);
      expect(code, stderr).toBe(0);
      const results = JSON.parse(await readFile(fixture.output, "utf8"));
      expect(results[0].trials[0].passed).toBe(true);
    } finally {
      first.kill();
      await first.exited;
      if (await Bun.file(fixture.ready).exists()) {
        await rm(await readFile(fixture.ready, "utf8"), {
          recursive: true,
          force: true,
        });
      }
      await cleanupRun(fixture.root, fixture.output);
    }
  },
  15_000,
);

test("SIGTERM settles grading children before finalizing interruption evidence", async () => {
  const fixture = await recoveryFixture();
  const runner = fixture.start(true);
  let child: number | undefined;
  try {
    await waitForFile(fixture.ready);
    const repo = await readFile(fixture.ready, "utf8");
    await waitForFile(join(repo, ".git/child.pid"));
    child = Number(await readFile(join(repo, ".git/child.pid"), "utf8"));
    runner.kill("SIGTERM");
    await runner.exited;
    const status = Bun.spawnSync(
      ["/bin/ps", "-p", String(child), "-o", "stat="],
      { stdout: "pipe" },
    );
    expect(status.stdout.toString().trim()).toMatch(/^(?:Z.*)?$/);
    const diagnostic = JSON.parse(
      await readFile(`${fixture.output}.diagnostic.json`, "utf8"),
    );
    expect(diagnostic.failure).toContain("SIGTERM");
  } finally {
    runner.kill("SIGKILL");
    await runner.exited;
    if (child) {
      try {
        process.kill(child, "SIGKILL");
      } catch {
        /* already exited */
      }
    }
    await cleanupRun(fixture.root, fixture.output);
  }
}, 15_000);
