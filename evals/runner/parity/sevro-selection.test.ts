import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const roots: string[] = [];
const runCommand = resolve(import.meta.dir, "../../sevro-extension/run.ts");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-selection-"));
  roots.push(root);
  return {
    root,
    project: join(root, "project"),
    results: join(root, "results"),
  };
}

async function caseFile(project: string, source: string, id: string) {
  const path = join(project, source);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(
    path,
    JSON.stringify({
      id,
      invariant: "SE-C29",
      prompt: "Return ready.",
      fixture: {
        commits: [
          { message: "chore: initial", files: { "README.md": "fixture\n" } },
        ],
      },
      checks: [],
      output_checks: [{ name: "answer", expect_exact: "ready" }],
    }),
  );
}

async function drySelection(
  project: string,
  results: string,
  selectors: string[],
  env: Record<string, string | undefined> = process.env,
) {
  const child = Bun.spawn(
    [
      process.execPath,
      runCommand,
      "--project-root",
      project,
      "--results-root",
      results,
      ...selectors,
      "--without-skill",
      "--",
      "--host",
      "codex",
      "--codex-bin",
      process.execPath,
      "--codex-auth-file",
      join(project, "unused-auth.json"),
      "--model",
      "synthetic-codex",
      "--effort",
      "low",
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
      "--dry",
    ],
    { stdout: "pipe", stderr: "pipe", env },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

function successfulFrame(root: string) {
  const states = {
    execution: { status: "completed" },
    grading: { status: "completed" },
    task: { verdict: "passed" },
  };
  return {
    format: "sevro.cli-result.v1",
    exitCode: 0,
    runId: "synthetic-run",
    ...states,
    evidencePath: join(root, "evidence.json"),
    cases: [
      {
        caseId: "selected",
        ...states,
        trials: [{ trial: 1, ...states, checks: [], artifactPath: null }],
      },
    ],
  };
}

async function frameSelection(
  { root, project }: { root: string; project: string },
  results: string,
  value: unknown,
  exitCode = 0,
) {
  const binary = join(root, "synthetic-sevro");
  const raw = JSON.stringify(value);
  await writeFile(
    binary,
    `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(raw)});\nprocess.exitCode = ${exitCode};\n`,
    { mode: 0o700 },
  );
  const env: Record<string, string | undefined> = {
    ...process.env,
    SEVRO_PACKAGE_BIN: binary,
  };
  delete env.SEVRO_CHECKOUT;
  const run = await drySelection(project, results, ["--case", "selected"], env);
  return { ...run, raw };
}

test("Darrow selection rejects array-valued outcome states", async () => {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/selected.yaml",
    "selected",
  );
  const frame = successfulFrame(root);
  const invalid = [
    { ...frame, task: { verdict: ["passed"] } },
    {
      ...frame,
      execution: { status: ["completed"] },
      task: { verdict: "not_assessed" },
    },
    {
      ...frame,
      grading: { status: ["completed"] },
      task: { verdict: "not_assessed" },
    },
  ];
  for (const [index, value] of invalid.entries()) {
    const run = await frameSelection(
      { root, project },
      join(results, String(index)),
      value,
    );
    expect(run.code, run.stderr).toBe(1);
    const reply = JSON.parse(run.stdout);
    expect(reply.runs[0]).toMatchObject({ exitCode: 0, result: null });
    expect(reply.runs[0].resultError).toContain("CLI JSON");
    expect(await readFile(reply.runs[0].resultPath, "utf8")).toBe(run.raw);
  }
});

test("Darrow selection validates complete nested public frames", async () => {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/selected.yaml",
    "selected",
  );
  const frame = successfulFrame(root);
  const selected = frame.cases[0]!;
  const trial = selected.trials[0]!;
  const trialFrame = (value: unknown) => ({
    ...frame,
    cases: [{ ...selected, trials: [value] }],
  });
  const invalid = [
    { ...frame, cases: [{ caseId: "selected" }] },
    trialFrame({ trial: 1 }),
    trialFrame({ ...trial, execution: { status: "failed" } }),
    trialFrame({ ...trial, grading: { status: "not_requested" } }),
    trialFrame({ ...trial, trial: 0 }),
    trialFrame({ ...trial, artifactPath: 42 }),
    trialFrame({
      ...trial,
      checks: [{ id: "check", grader: "test", status: "unknown" }],
    }),
    trialFrame({
      ...trial,
      domainOutcomes: [
        {
          id: "domain.check",
          status: "passed",
          evidenceRefs: ["same", "same"],
        },
      ],
    }),
    { ...frame, diagnostic: { code: "error" } },
    { ...frame, unexpected: true },
  ];
  for (const [index, value] of invalid.entries()) {
    const run = await frameSelection(
      { root, project },
      join(results, String(index)),
      value,
    );
    expect(run.code, run.stderr).toBe(1);
    const reply = JSON.parse(run.stdout);
    expect(reply.runs[0]).toMatchObject({ exitCode: 0, result: null });
    expect(reply.runs[0].resultError).toContain("CLI JSON");
    expect(await readFile(reply.runs[0].resultPath, "utf8")).toBe(run.raw);
  }
  const unsupported = await frameSelection(
    { root, project },
    join(results, "exit-category"),
    { ...frame, exitCode: 5 },
    5,
  );
  expect(unsupported.code, unsupported.stderr).toBe(1);
  expect(JSON.parse(unsupported.stdout).runs[0]).toMatchObject({
    exitCode: 5,
    result: null,
  });
});

test("Darrow selection preserves a successful attempt across a failed retry", async () => {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/selected.yaml",
    "selected",
  );
  const frame = successfulFrame(root);
  const firstRun = await frameSelection({ root, project }, results, frame);
  expect(firstRun.code, firstRun.stderr).toBe(0);
  const first = JSON.parse(firstRun.stdout);
  const failedStates = {
    execution: { status: "completed" },
    grading: { status: "completed" },
    task: { verdict: "failed" },
  };
  const failed = {
    ...frame,
    ...failedStates,
    exitCode: 1,
    cases: [
      {
        ...frame.cases[0],
        ...failedStates,
        trials: [{ ...frame.cases[0]!.trials[0], ...failedStates }],
      },
    ],
  };
  const secondRun = await frameSelection({ root, project }, results, failed, 1);
  expect(secondRun.code, secondRun.stderr).toBe(1);
  const second = JSON.parse(secondRun.stdout);
  expect(await readFile(first.runs[0].resultPath, "utf8")).toBe(firstRun.raw);
  expect(JSON.parse(await readFile(first.manifestPath, "utf8"))).toEqual(first);
  expect(second.manifestPath).not.toBe(first.manifestPath);
  expect(second.runs[0].resultPath).not.toBe(first.runs[0].resultPath);
  expect(await readFile(second.runs[0].resultPath, "utf8")).toBe(secondRun.raw);
  expect(JSON.parse(await readFile(second.manifestPath, "utf8"))).toEqual(
    second,
  );
  expect(second.runs[0]).toMatchObject({
    exitCode: 1,
    resultError: null,
    result: { task: { verdict: "failed" } },
  });
  expect(
    JSON.parse(await readFile(join(results, "selection-run.json"), "utf8")),
  ).toEqual(second);
});

test("Darrow selects a skill by owning directory before the Sevro run", async () => {
  const { project, results } = await fixture();
  await caseFile(
    project,
    "plugins/capability/example/skills/chosen/evals/keep.yaml",
    "unrelated-selected-id",
  );
  await caseFile(
    project,
    "plugins/capability/example/skills/other/evals/keep.yaml",
    "chosen-selected-id",
  );
  await caseFile(
    project,
    "evals/experiments/example/cases/keep.yaml",
    "chosen-experiment-selected-id",
  );
  const run = await drySelection(project, results, [
    "--skill",
    "chosen",
    "--case",
    "selected-id",
  ]);
  expect(run.code, run.stderr).toBe(0);
  const reply = JSON.parse(run.stdout);
  expect(reply.format).toBe("darrow-sevro-selection-v1");
  expect(reply.caseIds).toEqual(["unrelated-selected-id"]);
  expect(reply.runs).toHaveLength(1);
  expect(reply.runs[0]).toMatchObject({
    caseId: "unrelated-selected-id",
    exitCode: 0,
    result: {
      execution: { status: "not_run" },
      task: { verdict: "not_assessed" },
    },
  });
  expect(JSON.parse(await readFile(reply.runs[0].resultPath, "utf8"))).toEqual(
    reply.runs[0].result,
  );
  expect(
    JSON.parse(await readFile(join(results, "selection-run.json"), "utf8")),
  ).toEqual(reply);
});

test("Darrow intersects exact plugin and skill owners with repeatable case filters", async () => {
  const { project, results } = await fixture();
  await caseFile(
    project,
    "plugins/foundation/chosen-plugin/skills/chosen/evals/z.yaml",
    "z-keep",
  );
  await caseFile(
    project,
    "plugins/foundation/chosen-plugin/skills/chosen/evals/a.yaml",
    "a-beta",
  );
  await caseFile(
    project,
    "plugins/foundation/chosen-plugin/skills/chosen/evals/skip.yaml",
    "skip",
  );
  await caseFile(
    project,
    "plugins/foundation/chosen-plugin/skills/other/evals/other.yaml",
    "other-keep",
  );
  await caseFile(
    project,
    "plugins/capability/chosen-plugin-like/skills/chosen/evals/other.yaml",
    "prefix-keep",
  );
  await caseFile(
    project,
    ".agents/skills/chosen/evals/other.yaml",
    "repository-keep",
  );
  await caseFile(
    project,
    "evals/experiments/example/cases/other.yaml",
    "experiment-keep",
  );
  const run = await drySelection(project, results, [
    "--plugin=chosen-plugin",
    "--skill",
    "chosen",
    "--case",
    "keep",
    "--case=beta",
  ]);
  expect(run.code, run.stderr).toBe(0);
  const reply = JSON.parse(run.stdout);
  expect(reply.caseIds).toEqual(["a-beta", "z-keep"]);
  expect(reply.runs.map((row: { caseId: string }) => row.caseId)).toEqual([
    "a-beta",
    "z-keep",
  ]);
  expect(reply.runs.map((row: { exitCode: number }) => row.exitCode)).toEqual([
    0, 0,
  ]);
  expect(
    reply.runs.map((row: { result: unknown }) => row.result),
  ).toMatchObject([
    { execution: { status: "not_run" }, task: { verdict: "not_assessed" } },
    { execution: { status: "not_run" }, task: { verdict: "not_assessed" } },
  ]);
  expect(reply.runs[0].resultPath).not.toBe(reply.runs[1].resultPath);
  expect(
    JSON.parse(await readFile(join(results, "selection-run.json"), "utf8")),
  ).toEqual(reply);
});

async function cancellation(
  signal: "SIGINT" | "SIGTERM",
  expectedCode: number,
) {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/first.yaml",
    "selected-first",
  );
  await caseFile(
    project,
    "evals/experiments/example/cases/second.yaml",
    "selected-second",
  );
  const ready = join(root, "candidate-ready.json");
  const adapter = join(root, "adapter.ts");
  await writeFile(
    adapter,
    `import { writeFile } from "node:fs/promises";
export default {
  id: "test.selection-wait", model: "synthetic", effort: "low", capabilities: ["sevro.host.exec"],
  async run({ signal }) {
    await writeFile(${JSON.stringify(ready)}, JSON.stringify({ pid: process.pid }));
    await new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    });
  },
};\n`,
  );
  const child = Bun.spawn(
    [
      process.execPath,
      runCommand,
      "--case",
      "selected-",
      "--project-root",
      project,
      "--results-root",
      results,
      "--",
      "--adapter-module",
      adapter,
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const output = new Response(child.stdout).text();
  const errors = new Response(child.stderr).text();
  let candidatePid: number | undefined;
  try {
    const deadline = Date.now() + 5000;
    while (!(await Bun.file(ready).exists())) {
      if (Date.now() >= deadline)
        throw new Error("candidate did not reach the public run");
      await Bun.sleep(20);
    }
    candidatePid = JSON.parse(await readFile(ready, "utf8")).pid;
    child.kill(signal);
    const [stdout, stderr, code] = await Promise.all([
      output,
      errors,
      child.exited,
    ]);
    expect(code, stderr).toBe(expectedCode);
    const manifest = JSON.parse(
      await readFile(join(results, "selection-run.json"), "utf8"),
    );
    expect(manifest.runs).toHaveLength(1);
    expect(manifest.interrupted).toBe(true);
    expect(manifest.caseIds).toEqual(["selected-first", "selected-second"]);
    expect(manifest.runs[0]).toMatchObject({
      caseId: "selected-first",
      exitCode: expectedCode,
      result: {
        execution: { status: "cancelled" },
        task: { verdict: "not_assessed" },
      },
    });
    expect(JSON.parse(stdout)).toEqual(manifest);
    const evidence = JSON.parse(
      await readFile(manifest.runs[0].result.evidencePath, "utf8"),
    );
    expect(evidence.result.execution.status).toBe("cancelled");
  } finally {
    child.kill("SIGTERM");
    if (candidatePid !== undefined) {
      try {
        process.kill(candidatePid, "SIGTERM");
      } catch {
        /* The candidate already exited. */
      }
    }
    await child.exited;
  }
}

test(
  "Darrow selection retains cancellation and never starts the next case",
  () => cancellation("SIGINT", 130),
  10_000,
);
test(
  "Darrow selection preserves the SIGTERM exit category",
  () => cancellation("SIGTERM", 143),
  10_000,
);

test("Darrow ownership selectors work without case substrings", async () => {
  const { project, results } = await fixture();
  await caseFile(
    project,
    "plugins/capability/example/skills/chosen/evals/a.yaml",
    "plugin-chosen",
  );
  await caseFile(
    project,
    "plugins/capability/example/skills/other/evals/b.yaml",
    "plugin-other",
  );
  await caseFile(
    project,
    ".agents/skills/chosen/evals/c.yaml",
    "repository-chosen",
  );
  await caseFile(
    project,
    "evals/experiments/example/cases/d.yaml",
    "experiment",
  );
  const skill = await drySelection(project, join(results, "skill"), [
    "--skill",
    "chosen",
  ]);
  expect(skill.code, skill.stderr).toBe(0);
  expect(JSON.parse(skill.stdout).caseIds).toEqual([
    "plugin-chosen",
    "repository-chosen",
  ]);
  const plugin = await drySelection(project, join(results, "plugin"), [
    "--plugin",
    "example",
  ]);
  expect(plugin.code, plugin.stderr).toBe(0);
  expect(JSON.parse(plugin.stdout).caseIds).toEqual([
    "plugin-chosen",
    "plugin-other",
  ]);
});

test("Darrow refuses invalid or ambiguous selection before creating results", async () => {
  const { project, results } = await fixture();
  await caseFile(project, "evals/experiments/example/cases/a.yaml", "kept");
  for (const selectors of [
    ["--skill", "missing"],
    ["--plugin", "missing"],
    ["--case", "missing"],
    ["--skill="],
    ["--plugin", " "],
    ["--case="],
    ["--case-id", "kept", "--case", "kept"],
  ]) {
    const run = await drySelection(project, results, selectors);
    expect(run.code, run.stderr).toBe(64);
    expect(run.stderr).toMatch(
      /No cases matched|nonempty selectors|cannot be combined/,
    );
    expect(await Bun.file(join(results, "selection-run.json")).exists()).toBe(
      false,
    );
  }
  await caseFile(project, ".agents/skills/chosen/evals/b.yaml", "kept");
  const duplicate = await drySelection(project, results, ["--case", "kept"]);
  expect(duplicate.code, duplicate.stderr).toBe(64);
  expect(duplicate.stderr).toContain("duplicate case ID: kept");
  expect(await Bun.file(join(results, "selection-run.json")).exists()).toBe(
    false,
  );
});

test("Darrow selection retains a failed assessment and runs the later case", async () => {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/first.yaml",
    "selected-first",
  );
  await caseFile(
    project,
    "evals/experiments/example/cases/second.yaml",
    "selected-second",
  );
  const count = join(root, "count");
  await writeFile(count, "0");
  const adapter = join(root, "adapter.ts");
  await writeFile(
    adapter,
    `import { readFile, writeFile } from "node:fs/promises";
export default {
  id: "test.selection-answer", model: "synthetic", effort: "low", capabilities: ["sevro.host.exec"],
  async run({ condition }) {
    const count = Number(await readFile(${JSON.stringify(count)}, "utf8"));
    await writeFile(${JSON.stringify(count)}, String(count + 1));
    return { finalMessage: count === 0 ? "wrong" : "ready", complete: true, actualCondition: condition,
      inputTokens: 1, outputTokens: 1, costUsd: null, usageComplete: true };
  },
};\n`,
  );
  const child = Bun.spawn(
    [
      process.execPath,
      runCommand,
      "--case",
      "selected-",
      "--project-root",
      project,
      "--results-root",
      results,
      "--",
      "--adapter-module",
      adapter,
      "--condition",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code, stderr).toBe(1);
  const reply = JSON.parse(stdout);
  expect(reply.interrupted).toBe(false);
  expect(reply.runs.map((row: { exitCode: number }) => row.exitCode)).toEqual([
    1, 0,
  ]);
  expect(
    reply.runs.map((row: { result: unknown }) => row.result),
  ).toMatchObject([
    {
      execution: { status: "completed" },
      grading: { status: "completed" },
      task: { verdict: "failed" },
    },
    {
      execution: { status: "completed" },
      grading: { status: "completed" },
      task: { verdict: "passed" },
    },
  ]);
  expect(await readFile(count, "utf8")).toBe("2");
  expect(
    JSON.parse(await readFile(join(results, "selection-run.json"), "utf8")),
  ).toEqual(reply);
});

test("Darrow selection refuses success without public CLI JSON", async () => {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/selected.yaml",
    "selected",
  );
  const binary = join(root, "invalid-sevro");
  await writeFile(
    binary,
    `#!${process.execPath}\nprocess.stdout.write("unstructured\\n");\n`,
    { mode: 0o700 },
  );
  const env: Record<string, string | undefined> = {
    ...process.env,
    SEVRO_PACKAGE_BIN: binary,
  };
  delete env.SEVRO_CHECKOUT;
  const run = await drySelection(project, results, ["--case", "selected"], env);
  expect(run.code, run.stderr).toBe(1);
  const reply = JSON.parse(run.stdout);
  expect(reply.runs[0]).toMatchObject({
    caseId: "selected",
    exitCode: 0,
    result: null,
  });
  expect(reply.runs[0].resultError).toContain("CLI JSON");
  expect(await readFile(reply.runs[0].resultPath, "utf8")).toBe(
    "unstructured\n",
  );
});

test("Darrow selection rejects incomplete or contradictory public result frames", async () => {
  const { root, project, results } = await fixture();
  await caseFile(
    project,
    "evals/experiments/example/cases/selected.yaml",
    "selected",
  );
  const binary = join(root, "invalid-sevro");
  const frame = successfulFrame(root);
  const invalid = [
    { format: "sevro.cli-result.v1", exitCode: 0 },
    null,
    { ...frame, format: "sevro.cli-result.v2" },
    { ...frame, exitCode: 1 },
    { ...frame, execution: { status: "failed" } },
    { ...frame, grading: { status: "unavailable" } },
    { ...frame, task: { verdict: "failed" } },
    { ...frame, cases: [{ caseId: "foreign" }] },
    { ...frame, cases: [] },
    { ...frame, evidencePath: "relative.json" },
  ];
  const env: Record<string, string | undefined> = {
    ...process.env,
    SEVRO_PACKAGE_BIN: binary,
  };
  delete env.SEVRO_CHECKOUT;
  for (const [index, value] of invalid.entries()) {
    await writeFile(
      binary,
      `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(value))});\n`,
      { mode: 0o700 },
    );
    const run = await drySelection(
      project,
      join(results, String(index)),
      ["--case", "selected"],
      env,
    );
    expect(run.code, run.stderr + JSON.stringify(value)).toBe(1);
    const reply = JSON.parse(run.stdout);
    expect(reply.runs[0]).toMatchObject({ exitCode: 0, result: null });
    expect(reply.runs[0].resultError).toContain("CLI JSON");
  }
});
