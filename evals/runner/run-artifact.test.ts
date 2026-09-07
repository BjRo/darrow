import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("checkpoints a completed trial when interruption arrives during final result assembly", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-checkpoint-interruption-"));
  const output = join(root, "result.json");
  const preload = join(root, "harness.ts");
  const condition = join(root, "condition.txt");
  const activeDirectory = join(import.meta.dir, "../results/active");
  try {
    await writeFile(condition, root);
    await writeFile(
      preload,
      `
import { codexAdapter } from ${JSON.stringify(join(import.meta.dir, "adapters/codex.ts"))};
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
codexAdapter.sourceCodexPlugin = false;
codexAdapter.skillMounts = [".agents/skills"];
codexAdapter.version = async () => "synthetic-interruption";
codexAdapter.run = async ({ repoDir }) => {
  const resultText = "What subject would you like me to grill?";
  await writeFile(join(repoDir, ".git/last-message.md"), resultText);
  return { ok: true, durationMs: 17, inputTokens: 23, outputTokens: 11,
    costUsd: 0.02, resultText, raw: "completed before interruption",
    // Activation is read during final TrialResult assembly, after grading.
    get skillActivation() {
      process.emit("SIGTERM");
      return { source: "explicit_invocation", complete: true,
        primarySkill: "grilling", observedSkills: ["grilling"] };
    } };
};
`,
    );
    const proc = Bun.spawn(
      [
        process.execPath,
        "--preload",
        preload,
        join(import.meta.dir, "run.ts"),
        "--case",
        "grilling-incomplete-subject",
        "--harness",
        "codex",
        "--trials",
        "2",
        "--jobs",
        "1",
        "--condition",
        condition,
        "--output",
        output,
        "--no-color",
        "--no-emoji",
        "--no-progress",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stderr, code] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    expect(code, stderr).toBe(143);
    expect(await Bun.file(output).exists()).toBe(false);
    const diagnostic = JSON.parse(
      await readFile(`${output}.diagnostic.json`, "utf8"),
    );
    expect(diagnostic.failure).toContain("interrupted by SIGTERM");
    expect(diagnostic.completedTrials).toHaveLength(1);
    const evidence = JSON.parse(
      await readFile(diagnostic.completedTrials[0].artifactPath, "utf8"),
    );
    expect(evidence.case).toMatchObject({
      executionMode: "executed",
      harnessVersion: "synthetic-interruption",
      trials: [
        {
          trial: 1,
          passed: true,
          harness: { raw: "completed before interruption", inputTokens: 23 },
          activation: { passed: true, observedSkills: ["grilling"] },
        },
      ],
    });
    expect(evidence.case.trials[0].checks.length).toBeGreaterThan(0);
  } finally {
    for (const name of await readdir(activeDirectory)) {
      const path = join(activeDirectory, name);
      const record = JSON.parse(await readFile(path, "utf8"));
      if (record.artifactPath !== output) continue;
      await rm(record.evidenceDirectory, { recursive: true, force: true });
      await rm(path);
    }
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);

test("a checkpoint storage failure retains the complete result and fixture for diagnosis", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-checkpoint-failure-"));
  const output = join(root, "result.json");
  const preload = join(root, "harness.ts");
  const fixturePath = join(root, "fixture-path");
  const activeDirectory = join(import.meta.dir, "../results/active");
  try {
    await writeFile(
      preload,
      `
import { codexAdapter } from ${JSON.stringify(join(import.meta.dir, "adapters/codex.ts"))};
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
codexAdapter.sourceCodexPlugin = false;
codexAdapter.skillMounts = [".agents/skills"];
codexAdapter.version = async () => "synthetic";
codexAdapter.run = async ({ repoDir }) => {
  for (const name of await readdir(${JSON.stringify(activeDirectory)})) {
    const path = join(${JSON.stringify(activeDirectory)}, name);
    const record = JSON.parse(await readFile(path, "utf8"));
    if (record.artifactPath !== ${JSON.stringify(output)}) continue;
    await rm(record.evidenceDirectory, { recursive: true });
    await writeFile(record.evidenceDirectory, "blocked storage");
  }
  await writeFile(${JSON.stringify(fixturePath)}, repoDir);
  const resultText = "What subject would you like me to grill?";
  await writeFile(join(repoDir, ".git/last-message.md"), resultText);
  return { ok: true, durationMs: 1, inputTokens: 1, outputTokens: 1,
    costUsd: null, resultText, raw: "storage failure transcript" };
};
`,
    );
    const proc = Bun.spawn(
      [
        process.execPath,
        "--preload",
        preload,
        join(import.meta.dir, "run.ts"),
        "--case",
        "grilling-incomplete-subject",
        "--harness",
        "codex",
        "--trials",
        "1",
        "--output",
        output,
        "--no-color",
        "--no-emoji",
        "--no-progress",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, code] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    expect(code).toBe(1);
    const repo = await readFile(fixturePath, "utf8");
    expect(
      await readFile(join(repo, ".git/retained-harness.jsonl"), "utf8"),
    ).toBe("storage failure transcript");
    expect(stdout).not.toContain("PASS");
    const diagnostic = JSON.parse(
      await readFile(`${output}.diagnostic.json`, "utf8"),
    );
    expect(diagnostic.unpersistedTrials).toHaveLength(1);
    expect(diagnostic.unpersistedTrials[0].case.trials[0].harness.raw).toBe(
      "storage failure transcript",
    );
  } finally {
    if (await Bun.file(fixturePath).exists())
      await rm(await readFile(fixturePath, "utf8"), {
        recursive: true,
        force: true,
      });
    for (const name of await readdir(activeDirectory)) {
      const path = join(activeDirectory, name);
      const record = JSON.parse(await readFile(path, "utf8"));
      if (record.artifactPath !== output) continue;
      await rm(record.evidenceDirectory, { recursive: true, force: true });
      await rm(path);
    }
    await rm(root, { recursive: true, force: true });
  }
}, 15_000);

test.each([1, 3])(
  "retains complete first-trial evidence when a later harness call throws (jobs=%i)",
  async (jobs) => {
    const root = await mkdtemp(join(tmpdir(), "darrow-run-evidence-"));
    const output = join(root, "result.json");
    const preload = join(root, "harness.ts");
    try {
      await writeFile(
        preload,
        `
import { codexAdapter } from ${JSON.stringify(join(import.meta.dir, "adapters/codex.ts"))};
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
codexAdapter.sourceCodexPlugin = false;
codexAdapter.skillMounts = [".agents/skills"];
codexAdapter.version = async () => "synthetic-harness";
let call = 0;
codexAdapter.run = async ({ repoDir }) => {
  if (++call === 2) throw new Error("injected later trial failure");
  const resultText = "What subject would you like me to grill?";
  await writeFile(join(repoDir, ".git/last-message.md"), resultText);
  return { ok: true, durationMs: 17, inputTokens: 23, outputTokens: 11,
    costUsd: 0.02, resultText, raw: "retained transcript marker",
    skillActivation: { source: "explicit_invocation", complete: true,
      primarySkill: "grilling", observedSkills: ["grilling"] } };
};
`,
      );
      const proc = Bun.spawn(
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
          root,
          "--trials",
          String(jobs === 1 ? 2 : 3),
          "--jobs",
          String(jobs),
          "--output",
          output,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      const [stderr, code] = await Promise.all([
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(code, stderr).toBe(1);
      const diagnostic = JSON.parse(
        await readFile(`${output}.diagnostic.json`, "utf8"),
      );
      expect(diagnostic.failure).toContain("injected later trial failure");
      expect(diagnostic.completedTrials).toHaveLength(jobs === 1 ? 1 : 2);
      expect(
        new Set(
          diagnostic.completedTrials.map(
            (trial: { trial: number }) => trial.trial,
          ),
        ).size,
      ).toBe(diagnostic.completedTrials.length);
      for (const completed of diagnostic.completedTrials) {
        const evidence = JSON.parse(
          await readFile(completed.artifactPath, "utf8"),
        );
        expect(evidence.case.trials[0].trial).toBe(completed.trial);
        expect(evidence.case.trials[0].harness.raw).toBe(
          "retained transcript marker",
        );
      }
      const completed = diagnostic.completedTrials[0];
      expect(completed.artifactPath).toEqual(expect.any(String));
      const artifact = JSON.parse(
        await readFile(completed.artifactPath, "utf8"),
      );
      expect(artifact.case).toMatchObject({
        caseId: "grilling-incomplete-subject",
        harnessVersion: "synthetic-harness",
        trials: [
          {
            trial: expect.any(Number),
            passed: true,
            harness: {
              resultText: "What subject would you like me to grill?",
              raw: "retained transcript marker",
              inputTokens: 23,
            },
            activation: { passed: true, observedSkills: ["grilling"] },
          },
        ],
      });
      expect(artifact.case.trials[0].checks.length).toBeGreaterThan(0);
      expect(artifact.case.evaluationDigest).toEqual(expect.any(String));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  15_000,
);

test("checkpoints completed trials and atomically finalizes the active-run record", async () => {
  const root = await mkdtemp(join(tmpdir(), "darrow-run-artifact-"));
  const output = join(root, "result.json");
  const resultsRoot = join(import.meta.dir, "..", "results", "active");
  try {
    const proc = Bun.spawn(
      [
        process.execPath,
        "runner/run.ts",
        "--case",
        "ticket-to-pr-shortcut-delegation",
        "--harness",
        "codex",
        "--dry",
        "--trials",
        "1",
        "--output",
        output,
      ],
      { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe" },
    );
    expect(await proc.exited).toBe(0);
    expect(JSON.parse(await readFile(output, "utf8"))).toHaveLength(1);

    const records = await Promise.all(
      (await readdir(resultsRoot)).map(async (name) =>
        JSON.parse(await readFile(join(resultsRoot, name), "utf8")),
      ),
    );
    const record = records.find((value) => value.artifactPath === output);
    expect(record).toMatchObject({
      format: "darrow-eval-active-run-v1",
      status: "complete",
      artifactPath: output,
      completedTrials: [
        {
          caseId: "ticket-to-pr-shortcut-delegation",
          trial: 1,
        },
      ],
    });
    expect(record.finalizedAt).toEqual(expect.any(String));
  } finally {
    const records = await Promise.all(
      (await readdir(resultsRoot)).map(async (name) => ({
        name,
        value: JSON.parse(await readFile(join(resultsRoot, name), "utf8")),
      })),
    );
    await Promise.all(
      records
        .filter(({ value }) => value.artifactPath === output)
        .map(({ name }) => rm(join(resultsRoot, name))),
    );
    await rm(root, { recursive: true, force: true });
  }
});
