import { afterEach, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const command = resolve(import.meta.dir, "../suite.ts");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-benchmark-caller-")),
  );
  roots.push(root);
  expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  for (const id of ["caller-alpha", "caller-beta"])
    await writeFile(
      join(cases, `${id}.yaml`),
      JSON.stringify({
        id,
        invariant: "EXAMPLE-C1",
        prompt: "Return ready.",
        fixture: {
          commits: [
            { message: "chore: init", files: { "README.md": "ready\n" } },
          ],
        },
        checks: [],
        output_checks: [{ name: "response", expect_exact: "ready" }],
        semantic_output_checks: [
          { name: "meaning", proposition: "The answer is ready." },
        ],
      }),
    );
  const binaryRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-benchmark-host-")),
  );
  roots.push(binaryRoot);
  const binary = join(binaryRoot, "host");
  await writeFile(binary, '#!/bin/sh\nprintf "synthetic-benchmark-host\\n"\n', {
    mode: 0o700,
  });
  const credential = join(root, "auth.json");
  await writeFile(credential, '{"synthetic":"credential"}', { mode: 0o600 });
  const suite = join(root, "suite.yaml");
  await writeFile(
    suite,
    JSON.stringify({
      version: 1,
      experiment: "caller-example",
      harnesses: ["codex", "claude"],
      case_filter: "caller-",
      modes: {
        baseline: { owner_evaluation: "passive" },
        candidate: {
          owner_evaluation: "passive",
          model_by_harness: { codex: "mode-codex", claude: "mode-claude" },
          effort: "high",
        },
      },
    }),
  );
  return { root, suite, binary, credential, output: join(root, "results") };
}

async function invoke(
  root: string,
  args: string[],
  environment: Record<string, string | undefined> = {},
) {
  const child = Bun.spawn([process.execPath, command, ...args], {
    cwd: root,
    env: { ...process.env, ...environment },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

test("benchmark caller routes a filtered dry suite through Sevro", async () => {
  const { root, binary, credential, output } = await fixture();
  const run = await invoke(root, [
    "--suite",
    "suite.yaml",
    "--project-root",
    root,
    "--output",
    "results",
    "--case",
    "beta",
    "--trials",
    "2",
    "--threshold",
    "0.5",
    "--seed",
    "existing-order-1",
    "--codex-model",
    "base-codex",
    "--claude-model",
    "base-claude",
    "--effort",
    "low",
    "--dry",
    "--no-judge",
    "--",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
    "--claude-bin",
    binary,
    "--claude-credential-file",
    credential,
  ]);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  expect(run.stderr).toContain(`Suite evidence: ${output}`);
  expect(JSON.parse(run.stdout)).toMatchObject({
    manifest: join(output, "suite-run.json"),
    cells: 4,
    failed: 0,
  });
  const manifest = JSON.parse(
    await readFile(join(output, "suite-run.json"), "utf8"),
  );
  expect(manifest.caseIds).toEqual(["caller-beta"]);
  expect(manifest.trials).toBe(2);
  expect(manifest.threshold).toBe(0.5);
  expect(manifest.orderSeed).toBe("existing-order-1");
  expect(
    manifest.cells.map(
      (cell: { provenance: { routes: unknown[] } }) => cell.provenance.routes,
    ),
  ).toEqual([
    [
      {
        role: "candidate",
        host: "sevro.host.codex",
        model: "base-codex",
        effort: "low",
      },
      {
        role: "semantic",
        host: "sevro.host.codex",
        model: "gpt-5.6-luna",
        effort: "low",
      },
    ],
    [
      {
        role: "candidate",
        host: "sevro.host.claude",
        model: "base-claude",
        effort: "low",
      },
      {
        role: "semantic",
        host: "sevro.host.codex",
        model: "gpt-5.6-luna",
        effort: "low",
      },
    ],
    [
      {
        role: "candidate",
        host: "sevro.host.codex",
        model: "mode-codex",
        effort: "high",
      },
      {
        role: "semantic",
        host: "sevro.host.codex",
        model: "gpt-5.6-luna",
        effort: "low",
      },
    ],
    [
      {
        role: "candidate",
        host: "sevro.host.claude",
        model: "mode-claude",
        effort: "high",
      },
      {
        role: "semantic",
        host: "sevro.host.codex",
        model: "gpt-5.6-luna",
        effort: "low",
      },
    ],
  ]);
  for (const cell of manifest.cells) {
    const result = JSON.parse(await readFile(cell.result, "utf8"));
    expect(result.execution.status).toBe("not_run");
    expect(result.task.verdict).toBe("not_assessed");
    expect(cell.condition).toBe("passive");
    expect(cell.provenance.runner.source).toBe(
      process.env.SEVRO_CHECKOUT ? "checkout" : "package",
    );
  }
}, 30_000);

test("benchmark caller uses the frozen package without route overrides", async () => {
  const { root, binary, credential, output } = await fixture();
  const run = await invoke(
    root,
    [
      "--suite",
      "suite.yaml",
      "--project-root",
      root,
      "--output",
      output,
      "--mode",
      "baseline",
      "--harness",
      "codex",
      "--case",
      "alpha",
      "--dry",
      "--no-judge",
      "--",
      "--codex-bin",
      binary,
      "--codex-auth-file",
      credential,
    ],
    { SEVRO_CHECKOUT: undefined, SEVRO_PACKAGE_BIN: undefined },
  );
  expect(run.code, run.stderr + run.stdout).toBe(0);
  expect(JSON.parse(run.stdout)).toMatchObject({ cells: 1, failed: 0 });
  const manifest = JSON.parse(
    await readFile(join(output, "suite-run.json"), "utf8"),
  );
  expect(manifest.caseIds).toEqual(["caller-alpha"]);
  expect(manifest.cells[0].provenance.runner).toMatchObject({
    source: "package",
    packageName: "@bjoernrochel/sevro",
    version: "0.1.0-rc.1",
  });
  const result = JSON.parse(await readFile(manifest.cells[0].result, "utf8"));
  expect(result.task.verdict).toBe("not_assessed");
}, 30_000);

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "benchmark caller keeps grader routes separate and continues after task failure",
  async () => {
    const { root, binary, credential, output } = await fixture();
    await writeFile(
      binary,
      `#!${process.execPath}
const argv = process.argv.slice(2);
if (argv[0] === "sandbox") {
  const child = Bun.spawn([${JSON.stringify(Bun.which("codex"))}, ...argv], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (argv[0] === "--version") { console.log("synthetic-benchmark-codex"); process.exit(0); }
const prompt = await Bun.stdin.text();
const propositions = prompt.match(/<propositions-json>\\n([\\s\\S]*?)\\n<\\/propositions-json>/);
const model = argv[argv.indexOf("-m") + 1];
const text = propositions
  ? JSON.stringify({ checks: JSON.parse(propositions[1]).map(({ id }) => ({ id, verdict: "pass", reason: "Synthetic proposition evidence." })) })
  : prompt.startsWith("You are an independent software-change reviewer.")
    ? JSON.stringify({ verdict: "fail", overallScore: 2, dimensions: { correctness: 2, maintainability: 2, testQuality: 2, scopeDiscipline: 2 }, strengths: [], weaknesses: ["Synthetic advisory finding."], summary: "Synthetic advisory failure." })
    : model === "base-codex" ? "wrong" : "ready";
for (const event of [
  { type: "thread.started", thread_id: "synthetic-benchmark" },
  { type: "item.completed", item: { type: "agent_message", text } },
  { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } },
]) console.log(JSON.stringify(event));
`,
      { mode: 0o700 },
    );
    const run = await invoke(root, [
      "--suite",
      "suite.yaml",
      "--project-root",
      root,
      "--output",
      "results",
      "--harness",
      "codex",
      "--case",
      "alpha",
      "--trials",
      "1",
      "--threshold",
      "1",
      "--seed",
      "existing-order-1",
      "--codex-model",
      "base-codex",
      "--effort",
      "medium",
      "--semantic-check-model",
      "semantic-model",
      "--semantic-check-effort",
      "low",
      "--judge-model",
      "advisory-model",
      "--judge-effort",
      "high",
      "--",
      "--codex-bin",
      binary,
      "--codex-auth-file",
      credential,
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(1);
    const manifest = JSON.parse(
      await readFile(join(output, "suite-run.json"), "utf8"),
    );
    const results = await Promise.all(
      manifest.cells.map(async (cell: { result: string }) =>
        JSON.parse(await readFile(cell.result, "utf8")),
      ),
    );
    expect(JSON.parse(run.stdout), JSON.stringify(results)).toMatchObject({
      cells: 2,
      failed: 1,
    });
    expect(
      manifest.cells.map((cell: { exitCode: number }) => cell.exitCode),
    ).toEqual([1, 0]);
    for (const [index, cell] of manifest.cells.entries()) {
      expect(cell.provenance.routes).toEqual([
        {
          role: "candidate",
          host: "sevro.host.codex",
          model: index === 0 ? "base-codex" : "mode-codex",
          effort: index === 0 ? "medium" : "high",
        },
        {
          role: "semantic",
          host: "sevro.host.codex",
          model: "semantic-model",
          effort: "low",
        },
        {
          role: "advisory",
          host: "sevro.host.codex",
          model: "advisory-model",
          effort: "high",
        },
      ]);
      const result = JSON.parse(await readFile(cell.result, "utf8"));
      expect(result.execution.status).toBe("completed");
      expect(result.grading.status).toBe("completed");
      expect(result.task.verdict).toBe(index === 0 ? "failed" : "passed");
      const trial = JSON.parse(
        await readFile(result.cases[0].trials[0].artifactPath, "utf8"),
      );
      expect(trial.format).toBe("sevro.trial-evidence.v1");
      expect(trial.evidence.advisoryReview.assessment.verdict).toBe("fail");
    }
  },
  30_000,
);

test("benchmark caller retains default storage and rejects route overrides", async () => {
  const { root, binary, credential } = await fixture();
  const common = [
    "--suite",
    "suite.yaml",
    "--project-root",
    root,
    "--harness",
    "codex",
    "--mode",
    "baseline",
    "--case",
    "beta",
    "--trials",
    "1",
    "--dry",
  ];
  const native = ["--codex-bin", binary, "--codex-auth-file", credential];
  const run = await invoke(root, [...common, "--", ...native]);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const summary = JSON.parse(run.stdout);
  expect(summary.manifest).toStartWith(
    join(root, "evals/results/caller-example/"),
  );
  expect(summary.cells).toBe(1);
  for (const override of [
    ["--condition", "passive"],
    ["--model", "other-model"],
    ["--semantic-adapter-module", binary],
  ]) {
    const invalid = await invoke(root, [
      ...common,
      "--",
      ...native,
      ...override,
    ]);
    expect(invalid.code, invalid.stderr).toBe(64);
    expect(invalid.stderr).toContain("Benchmark option cannot be forwarded");
  }
});

test("benchmark caller rejects invalid explicit Sevro routes without fallback", async () => {
  const { root } = await fixture();
  for (const environment of [
    { SEVRO_CHECKOUT: root, SEVRO_PACKAGE_BIN: join(root, "sevro") },
    { SEVRO_CHECKOUT: "", SEVRO_PACKAGE_BIN: undefined },
    { SEVRO_CHECKOUT: "relative/sevro", SEVRO_PACKAGE_BIN: undefined },
  ]) {
    const run = await invoke(
      root,
      ["--suite", "suite.yaml", "--project-root", root],
      environment,
    );
    expect(run.code, run.stderr).toBe(64);
    expect(run.stdout).toBe("");
    expect(await Bun.file(join(root, "evals/results")).exists()).toBe(false);
  }
});

test("benchmark caller preserves an unsupported enforced request", async () => {
  const { root, suite, binary, credential, output } = await fixture();
  const definition = JSON.parse(await readFile(suite, "utf8"));
  definition.modes.baseline.owner_evaluation = "enforced";
  await writeFile(suite, JSON.stringify(definition));
  const called = join(root, "candidate-started");
  await writeFile(
    binary,
    `#!${process.execPath}
if (process.argv[2] === "exec") await Bun.write(${JSON.stringify(called)}, "unexpected execution");
console.log("synthetic-benchmark-host");
`,
    { mode: 0o700 },
  );
  const run = await invoke(root, [
    "--suite",
    suite,
    "--project-root",
    root,
    "--output",
    output,
    "--harness",
    "codex",
    "--mode",
    "baseline",
    "--case",
    "alpha",
    "--trials",
    "1",
    "--no-judge",
    "--",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
  ]);
  expect(run.code, run.stderr + run.stdout).toBe(1);
  const manifest = JSON.parse(
    await readFile(join(output, "suite-run.json"), "utf8"),
  );
  expect(manifest.cells).toHaveLength(1);
  expect(manifest.cells[0].condition).toBe("enforced");
  expect(manifest.cells[0].exitCode).not.toBe(0);
  expect(await Bun.file(called).exists()).toBe(false);
  const result = JSON.parse(await readFile(manifest.cells[0].result, "utf8"));
  expect(result.task.verdict).toBe("not_assessed");
});

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "benchmark caller forwards cancellation and retains the cancelled prefix",
  async () => {
    const { root, suite, binary, credential, output } = await fixture();
    const ready = join(root, "ready");
    await writeFile(
      binary,
      `#!${process.execPath}
if (process.argv[2] === "sandbox") {
  const child = Bun.spawn([${JSON.stringify(Bun.which("codex"))}, ...process.argv.slice(2)], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (process.argv[2] === "--version") { console.log("synthetic-benchmark-host"); process.exit(0); }
await Bun.stdin.text();
await Bun.write(${JSON.stringify(ready)}, "ready");
await new Promise(() => setInterval(() => {}, 1000));
`,
      { mode: 0o700 },
    );
    const child = Bun.spawn(
      [
        process.execPath,
        command,
        "--suite",
        suite,
        "--project-root",
        root,
        "--output",
        output,
        "--harness",
        "codex",
        "--trials",
        "1",
        "--seed",
        "existing-order-1",
        "--no-judge",
        "--",
        "--codex-bin",
        binary,
        "--codex-auth-file",
        credential,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    try {
      const deadline = Date.now() + 15_000;
      while (!(await Bun.file(ready).exists())) {
        if (Date.now() > deadline)
          throw new Error("Synthetic host did not start");
        await Bun.sleep(20);
      }
      const initial = JSON.parse(
        await readFile(join(output, "suite-run.json"), "utf8"),
      );
      expect(initial.cellPlan).toHaveLength(4);
      expect(initial.cells).toEqual([]);
      child.kill("SIGTERM");
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect(code, stderr + stdout).toBe(143);
      expect(JSON.parse(stdout)).toMatchObject({
        cells: 1,
        interrupted: "SIGTERM",
      });
      const manifest = JSON.parse(
        await readFile(join(output, "suite-run.json"), "utf8"),
      );
      expect(manifest.cellPlan).toEqual(initial.cellPlan);
      expect(manifest.cells[0]).toMatchObject(initial.cellPlan[0]);
      const result = JSON.parse(
        await readFile(manifest.cells[0].result, "utf8"),
      );
      expect(result.execution.status).toBe("cancelled");
      expect(result.task.verdict).toBe("not_assessed");
    } finally {
      child.kill("SIGKILL");
      await child.exited;
    }
  },
  30_000,
);
