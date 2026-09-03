import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("requires an explicit harness", async () => {
  const proc = Bun.spawn(
    ["bun", "runner/run.ts", "--case", "no-such-case", "--dry"],
    {
      cwd: join(import.meta.dir, ".."),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  expect(exitCode).toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toBe("--harness is required; available: claude, codex\n");
});

test("rejects invalid job counts", async () => {
  for (const jobs of ["0", "1.5", "many"]) {
    const proc = Bun.spawn(
      ["bun", "runner/run.ts", "--harness", "codex", "--jobs", jobs, "--dry"],
      {
        cwd: join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(1);
    expect(stdout).toBe("");
    expect(stderr).toBe("--jobs must be a positive integer\n");
  }
});

test("emits stable plain logs and an absolute result path", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "darrow-eval-cli-"));
  const resultPath = join(temporary, "result.json");
  try {
    const proc = Bun.spawn(
      [
        "bun",
        "runner/run.ts",
        "--harness",
        "codex",
        "--case",
        "grilling-incomplete-subject",
        "--trials",
        "2",
        "--dry",
        "--no-color",
        "--no-emoji",
        "--no-progress",
        "--output",
        resultPath,
      ],
      {
        cwd: join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("Darrow Eval");
    expect(stdout).toContain("2 trials · 2 total · jobs 3");
    expect(stdout).toContain("RUN 1/2");
    expect(stdout).toContain("RUN 2/2");
    expect(stdout).toContain("1 prepared · dry run · 1 cases · 2 trials");
    expect(stdout).toContain(`Results: ${resultPath}`);
    expect(stdout).not.toContain("\u001B");
    expect(stdout).not.toMatch(/[✓✕🧪📄✨]/u);
    const results = JSON.parse(await readFile(resultPath, "utf8"));
    expect(results).toHaveLength(1);
    expect(
      results[0].trials.map((trial: { trial: number }) => trial.trial),
    ).toEqual([1, 2]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
