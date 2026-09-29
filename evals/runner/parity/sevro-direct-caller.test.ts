import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";

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

const command = resolve(import.meta.dir, "../run.ts");
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function fixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-direct-caller-")),
  );
  roots.push(root);
  expect(Bun.spawnSync(["git", "init", "--quiet", root]).exitCode).toBe(0);
  const cases = join(root, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  for (const id of ["direct-alpha", "direct-beta"]) {
    await writeFile(
      join(cases, id + ".yaml"),
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
  }
  const binaryRoot = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-direct-host-")),
  );
  roots.push(binaryRoot);
  const binary = join(binaryRoot, "host");
  await writeFile(binary, '#!/bin/sh\nprintf "synthetic-direct-host\\n"\n', {
    mode: 0o700,
  });
  const credential = join(root, "auth.json");
  await writeFile(credential, '{"synthetic":"credential"}', { mode: 0o600 });
  return { root, binary, credential, output: join(root, "results") };
}

function nativeArgs(binary: string, credential: string) {
  return [
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
    "--claude-bin",
    binary,
    "--claude-credential-file",
    credential,
  ];
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

test("direct caller routes a filtered dry evaluation through Sevro", async () => {
  const { root, binary, credential, output } = await fixture();
  const run = await invoke(root, [
    "--project-root",
    ".",
    "--results-root",
    "results",
    "--harness",
    "codex",
    "--owner-evaluation",
    "passive",
    "--case",
    "beta",
    "--trials",
    "2",
    "--threshold",
    "0.5",
    "--jobs",
    "1",
    "--dry",
    "--no-color",
    "--no-progress",
    "--",
    ...nativeArgs(binary, credential),
  ]);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const manifest = JSON.parse(run.stdout);
  expect(manifest).toMatchObject({
    format: "darrow-sevro-selection-v1",
    projectRoot: root,
    resultsRoot: output,
    caseIds: ["direct-beta"],
    interrupted: false,
    humanReviewMinutes: null,
    humanReviewMinutesSource: null,
  });
  expect(manifest.runs).toHaveLength(1);
  const cell = manifest.runs[0];
  expect(cell.resultError).toBeNull();
  expect(JSON.parse(await readFile(cell.resultPath, "utf8"))).toEqual(
    cell.result,
  );
  expect(cell.result).toMatchObject({
    format: "sevro.cli-result.v1",
    execution: { status: "not_run" },
    grading: { status: "not_requested" },
    task: { verdict: "not_assessed" },
    exitCode: 0,
  });
  const evidence = JSON.parse(await readFile(cell.result.evidencePath, "utf8"));
  expect(evidence.configuration.redacted).toMatchObject({
    condition: "passive",
    trialCount: 2,
    jobs: 1,
    passThreshold: 0.5,
  });
  expect(evidence.routes).toEqual([
    {
      role: "candidate",
      host: "sevro.host.codex",
      model: "gpt-5.6-terra",
      effort: "medium",
    },
    {
      role: "semantic",
      host: "sevro.host.codex",
      model: "gpt-5.6-luna",
      effort: "low",
    },
  ]);
  expect(evidence.runner.source).toBe(
    process.env.SEVRO_CHECKOUT ? "checkout" : "package",
  );
}, 30_000);

test("direct caller uses the frozen package without route overrides", async () => {
  const { root, binary, credential, output } = await fixture();
  const run = await invoke(
    root,
    reviewArguments(root, binary, credential, output),
    { SEVRO_CHECKOUT: undefined, SEVRO_PACKAGE_BIN: undefined },
  );
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const manifest = JSON.parse(run.stdout);
  expect(manifest).toMatchObject({
    format: "darrow-sevro-selection-v1",
    projectRoot: root,
    caseIds: ["direct-alpha"],
  });
  const result = manifest.runs[0].result;
  expect(result.task.verdict).toBe("not_assessed");
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(evidence.runner).toMatchObject({
    source: "package",
    packageName: "@bjoernrochel/sevro",
    version: "0.1.0-rc.1",
  });
}, 30_000);

function reviewArguments(
  root: string,
  binary: string,
  credential: string,
  resultsRoot: string,
) {
  return [
    "--project-root",
    root,
    "--results-root",
    resultsRoot,
    "--harness",
    "codex",
    "--owner-evaluation",
    "passive",
    "--case",
    "alpha",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--jobs",
    "1",
    "--dry",
    "--",
    ...nativeArgs(binary, credential),
  ];
}

test("direct caller retains supplied review minutes as an annotation", async () => {
  const { root, binary, credential } = await fixture();
  const results = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-review-minutes-")),
  );
  roots.push(results);
  const args = reviewArguments(root, binary, credential, results);
  const identities: string[] = [];
  for (const minutes of ["0", "2.5"]) {
    const run = await invoke(root, [
      "--human-review-minutes",
      minutes,
      "--output",
      join(results, "output.json"),
      ...args,
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(0);
    const manifest = JSON.parse(run.stdout);
    expect(manifest).toMatchObject({
      humanReviewMinutes: Number(minutes),
      humanReviewMinutesSource: "user_supplied",
    });
    for (const path of [
      manifest.manifestPath,
      join(results, "selection-run.json"),
      join(results, "output.json"),
    ]) {
      expect(JSON.parse(await readFile(path, "utf8"))).toEqual(manifest);
    }
    const result = manifest.runs[0].result;
    expect(result).toMatchObject({
      execution: { status: "not_run" },
      grading: { status: "not_requested" },
      task: { verdict: "not_assessed" },
      exitCode: 0,
    });
    expect(
      JSON.parse(await readFile(manifest.runs[0].resultPath, "utf8")),
    ).toEqual(result);
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    expect(evidence.trials[0].metrics).toEqual([]);
    identities.push(evidence.evaluationIdentity.digest);
  }
  expect(identities[0]).toMatch(/^[a-f0-9]{64}$/);
  expect(identities[1]).toBe(identities[0]);
}, 30_000);

test.each(["-1", "NaN", "Infinity", "-Infinity", "", " "])(
  "direct caller refuses invalid review minutes before selection: %s",
  async (minutes) => {
    const { root, binary, credential } = await fixture();
    const results = join(root, "invalid-review-results");
    const run = await invoke(root, [
      "--human-review-minutes=" + minutes,
      ...reviewArguments(root, binary, credential, results),
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(64);
    expect(run.stderr).toContain("--human-review-minutes");
    expect(run.stdout).toBe("");
    expect(await Bun.file(join(results, "selection-run.json")).exists()).toBe(
      false,
    );
    expect(existsSync(results)).toBe(false);
  },
);

test("direct caller rejects forwarded overrides and unsupported legacy policies", async () => {
  const { root, binary, credential } = await fixture();
  const base = [
    "--project-root",
    root,
    "--harness",
    "codex",
    "--case",
    "alpha",
    "--dry",
  ];
  for (const forwarded of [
    ["--model", "override"],
    ["--human-review-minutes", "2"],
    ["--condition", "passive"],
    ["--jobs", "1"],
    ["--config-root", root],
    ["--run-state-root", root],
    ["--semantic-host", "codex"],
  ]) {
    const run = await invoke(root, [
      ...base,
      "--",
      ...nativeArgs(binary, credential),
      ...forwarded,
    ]);
    expect(run.code, run.stderr).toBe(64);
    expect(run.stderr).toContain("cannot be forwarded");
  }
  for (const args of [
    ["--expected-goal-routes", "{}"],
    ["--assert-goal-routes", "{}"],
    ["--assert-goal-dimensions", "{}"],
  ]) {
    const run = await invoke(root, [...base, ...args]);
    expect(run.code, run.stderr).toBe(64);
    expect(run.stderr).toContain(args[0]!);
  }
  for (const args of [
    ["--judge-harness", "claude"],
    ["--semantic-check-harness", "claude"],
    ["--case-routes", '{"direct-alpha":{"model":"missing-effort"}}'],
  ]) {
    const run = await invoke(root, [...base, ...args]);
    expect(run.code, run.stderr).toBe(64);
    expect(run.stdout).toBe("");
  }
}, 30_000);

test("direct caller rejects invalid explicit Sevro routes without fallback", async () => {
  const { root } = await fixture();
  for (const environment of [
    { SEVRO_CHECKOUT: "", SEVRO_PACKAGE_BIN: undefined },
    { SEVRO_CHECKOUT: "relative", SEVRO_PACKAGE_BIN: undefined },
    { SEVRO_CHECKOUT: "/unused/checkout", SEVRO_PACKAGE_BIN: "/unused/sevro" },
  ]) {
    const run = await invoke(
      root,
      ["--project-root", root, "--harness", "codex", "--dry"],
      environment,
    );
    expect(run.code, run.stderr).toBe(64);
    expect(run.stdout).toBe("");
  }
});

test("direct caller keeps the default enforced condition distinct from passive", async () => {
  const { root, binary, credential } = await fixture();
  const called = join(root, "candidate-called");
  await writeFile(
    binary,
    `#!/bin/sh
if [ "$1" = "--version" ]; then printf "synthetic-direct-host\\n"; exit 0; fi
touch '${called.replaceAll("'", "'\\''")}'
`,
    { mode: 0o700 },
  );
  const run = await invoke(root, [
    "--project-root",
    root,
    "--harness",
    "codex",
    "--case",
    "alpha",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--",
    ...nativeArgs(binary, credential),
  ]);
  expect(run.code, run.stderr + run.stdout).toBe(1);
  const manifest = JSON.parse(run.stdout);
  const result = manifest.runs[0].result;
  expect(result.task.verdict).toBe("not_assessed");
  expect(manifest.runs[0].exitCode).not.toBe(0);
  expect(await Bun.file(called).exists()).toBe(false);
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.condition).toBe("enforced");
}, 30_000);

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "direct caller forwards interruption and retains the cancelled prefix",
  async () => {
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const { root, binary, credential, output } = await fixture();
      const ready = join(root, "ready");
      await writeFile(
        binary,
        `#!${process.execPath}
if (process.argv[2] === "sandbox") {
  const child = Bun.spawn([${JSON.stringify(Bun.which("codex"))}, ...process.argv.slice(2)], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (process.argv[2] === "--version") { console.log("synthetic-direct-host"); process.exit(0); }
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
          "--project-root",
          root,
          "--results-root",
          output,
          "--harness",
          "codex",
          "--owner-evaluation",
          "passive",
          "--case",
          "direct-",
          "--trials",
          "1",
          "--threshold",
          "1",
          "--human-review-minutes",
          "1.25",
          "--",
          ...nativeArgs(binary, credential),
        ],
        { cwd: root, stdout: "pipe", stderr: "pipe" },
      );
      try {
        const deadline = Date.now() + 15_000;
        while (!(await Bun.file(ready).exists())) {
          if (Date.now() > deadline)
            throw new Error("Synthetic host did not start");
          await Bun.sleep(20);
        }
        const initial = JSON.parse(
          await readFile(join(output, "selection-run.json"), "utf8"),
        );
        expect(initial.caseIds).toEqual(["direct-alpha", "direct-beta"]);
        expect(initial).toMatchObject({
          humanReviewMinutes: 1.25,
          humanReviewMinutesSource: "user_supplied",
        });
        expect(initial.runs).toEqual([]);
        child.kill(signal);
        const [stdout, stderr, code] = await Promise.all([
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
          child.exited,
        ]);
        expect(code, stderr + stdout).toBe(signal === "SIGINT" ? 130 : 143);
        const manifest = JSON.parse(stdout);
        expect(manifest.interrupted).toBe(true);
        expect(manifest).toMatchObject({
          humanReviewMinutes: 1.25,
          humanReviewMinutesSource: "user_supplied",
        });
        expect(manifest.runs).toHaveLength(1);
        expect(manifest.runs[0]).toMatchObject({
          caseId: "direct-alpha",
          resultError: null,
          result: {
            execution: { status: "cancelled" },
            task: { verdict: "not_assessed" },
          },
        });
      } finally {
        child.kill("SIGKILL");
        await child.exited;
      }
    }
  },
  30_000,
);

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "direct caller retains failed tasks and protects fresh output storage",
  async () => {
    const { root, binary, credential } = await fixture();
    const outputRoot = await realpath(
      await mkdtemp(join(tmpdir(), "darrow-direct-output-")),
    );
    roots.push(outputRoot);
    const outputPath = join(outputRoot, "summary.json");
    const hiddenPath = join(outputRoot, "hidden.txt");
    await writeFile(hiddenPath, "synthetic-private-evidence");
    for (const id of ["direct-alpha", "direct-beta"]) {
      const path = join(root, "evals/experiments/example/cases", id + ".yaml");
      const evalCase = JSON.parse(await readFile(path, "utf8"));
      evalCase.checks = [
        {
          name: "output storage protected",
          run:
            "if cat '" +
            hiddenPath.replaceAll("'", "'\\''") +
            "' >/dev/null 2>&1; then exit 1; fi",
          expect_exit: 0,
        },
      ];
      await writeFile(path, JSON.stringify(evalCase));
    }
    await writeFile(
      binary,
      `#!${process.execPath}
const argv = process.argv.slice(2);
if (argv[0] === "sandbox") {
  const child = Bun.spawn([${JSON.stringify(Bun.which("codex"))}, ...argv], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (argv[0] === "--version") { console.log("synthetic-direct-codex"); process.exit(0); }
const prompt = await Bun.stdin.text();
const propositions = prompt.match(/<propositions-json>\\n([\\s\\S]*?)\\n<\\/propositions-json>/);
const text = propositions
  ? JSON.stringify({ checks: JSON.parse(propositions[1]).map(({ id }) => ({ id, verdict: "pass", reason: "Synthetic semantic evidence." })) })
  : argv[argv.indexOf("-m") + 1] === "alpha-model" ? "wrong" : "ready";
for (const event of [
  { type: "thread.started", thread_id: "synthetic-direct" },
  { type: "item.completed", item: { type: "agent_message", text } },
  { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }
]) console.log(JSON.stringify(event));
`,
      { mode: 0o700 },
    );
    const run = await invoke(root, [
      "--project-root",
      root,
      "--harness",
      "codex",
      "--case",
      "direct-",
      "--owner-evaluation",
      "passive",
      "--trials",
      "1",
      "--threshold",
      "1",
      "--output",
      outputPath,
      "--human-review-minutes",
      "3.5",
      "--case-routes",
      JSON.stringify({
        "direct-alpha": { model: "alpha-model", effort: "high" },
      }),
      "--",
      ...nativeArgs(binary, credential),
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(1);
    const manifest = JSON.parse(run.stdout);
    expect(manifest.caseIds).toEqual(["direct-alpha", "direct-beta"]);
    expect(manifest).toMatchObject({
      humanReviewMinutes: 3.5,
      humanReviewMinutesSource: "user_supplied",
    });
    expect(
      manifest.runs.map((cell: { exitCode: number }) => cell.exitCode),
      run.stdout,
    ).toEqual([1, 0]);
    expect(manifest.runs[0].result.task.verdict).toBe("failed");
    expect(manifest.runs[1].result.task.verdict).toBe("passed");
    expect(manifest.runs[1].result.execution.status).toBe("completed");
    expect(await readFile(outputPath, "utf8")).toBe(run.stdout);
    expect(await readFile(hiddenPath, "utf8")).toBe(
      "synthetic-private-evidence",
    );
  },
  30_000,
);

test("direct caller rejects invalid limits before launching Sevro", async () => {
  const { root, binary, credential } = await fixture();
  for (const args of [
    ["--trials", "0"],
    ["--jobs", "1.5"],
    ["--threshold", "2"],
    ["--owner-evaluation", "unknown"],
  ]) {
    const run = await invoke(root, [
      "--project-root",
      root,
      "--harness",
      "codex",
      "--case",
      "alpha",
      "--dry",
      ...args,
      "--",
      ...nativeArgs(binary, credential),
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(64);
    expect(run.stdout).toBe("");
  }
}, 30_000);

test("direct caller retains evaluation-record and effective-owner policy", async () => {
  const { root, binary, credential } = await fixture();
  const run = await invoke(root, [
    "--project-root",
    root,
    "--harness",
    "codex",
    "--case",
    "alpha",
    "--owner-evaluation",
    "passive",
    "--require-evaluation-records",
    "--assert-effective-owner-routes",
    JSON.stringify({
      "direct-alpha": { model: "owner-model", effort: "high" },
    }),
    "--trials",
    "1",
    "--threshold",
    "1",
    "--dry",
    "--",
    ...nativeArgs(binary, credential),
  ]);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  const manifest = JSON.parse(run.stdout);
  expect(manifest.resultsRoot).toBe(join(root, "evals/results"));
  const result = manifest.runs[0].result;
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.extensionConfiguration).toMatchObject({
    requireEvaluationRecords: true,
    effectiveOwnerRoute: { model: "owner-model", effort: "high" },
  });
  expect(evidence.routes[0]).toMatchObject({
    model: "gpt-5.6-terra",
    effort: "medium",
  });
  expect(result.task.verdict).toBe("not_assessed");
}, 30_000);

test("direct caller preserves skill controls and writes the selection output", async () => {
  const { root, binary, credential, output } = await fixture();
  const skill = join(root, ".agents/skills/example");
  await mkdir(join(skill, "evals"), { recursive: true });
  await writeFile(
    join(skill, "SKILL.md"),
    "---\nname: example\ndescription: Example.\n---\nReturn ready.\n",
  );
  for (const suffix of ["alpha", "beta"]) {
    const original = JSON.parse(
      await readFile(
        join(
          root,
          "evals/experiments/example/cases/direct-" + suffix + ".yaml",
        ),
        "utf8",
      ),
    );
    original.id = "owned-" + suffix;
    await writeFile(
      join(skill, "evals", suffix + ".yaml"),
      JSON.stringify(original),
    );
  }
  await mkdir(join(root, "configuration/.codex"), { recursive: true });
  await writeFile(
    join(root, "configuration/.codex/config.toml"),
    "[agents]\nmax_concurrent_threads_per_session = 7\n",
  );
  await writeFile(join(root, "condition.txt"), "Keep the answer short.\n");
  const run = await invoke(root, [
    "--project-root",
    ".",
    "--config-root",
    "configuration",
    "--results-root",
    "results",
    "--run-state-root",
    "active",
    "--output",
    "summary.json",
    "--harness",
    "codex",
    "--skill",
    "example",
    "--case",
    "beta",
    "--skill-dir",
    ".agents/skills/example",
    "--without-skill",
    "--condition",
    "condition.txt",
    "--condition-label",
    "short",
    "--owner-evaluation",
    "passive",
    "--trials",
    "1",
    "--threshold",
    "1",
    "--dry",
    "--",
    ...nativeArgs(binary, credential),
  ]);
  expect(run.code, run.stderr + run.stdout).toBe(0);
  expect(await readFile(join(root, "summary.json"), "utf8")).toBe(run.stdout);
  const manifest = JSON.parse(run.stdout);
  expect(manifest.caseIds).toEqual(["owned-beta"]);
  expect(manifest.resultsRoot).toBe(output);
  const cell = manifest.runs[0];
  const evidence = JSON.parse(await readFile(cell.result.evidencePath, "utf8"));
  expect(evidence.configuration.redacted.extensionConfiguration).toMatchObject({
    withoutSkill: true,
    skillDir: ".agents/skills/example",
    benchmarkCondition: { label: "short" },
  });
  expect(evidence.configuration.redacted.hostConfiguration.candidate).toEqual({
    "sevro.codex.agent-concurrency-limit": 7,
  });
  expect(cell.result.task.verdict).toBe("not_assessed");
}, 30_000);

test("direct caller preserves per-case candidate routes and independent graders", async () => {
  const { root, binary, credential, output } = await fixture();
  for (const harness of ["codex", "claude"]) {
    const run = await invoke(root, [
      "--project-root",
      ".",
      "--results-root",
      join(output, harness),
      "--harness",
      harness,
      "--owner-evaluation",
      "passive",
      "--case",
      "direct-",
      "--model",
      "base-model",
      "--effort",
      "low",
      "--case-routes",
      JSON.stringify({
        "direct-alpha": { model: "alpha-model", effort: "high" },
      }),
      "--semantic-check-model",
      "semantic-model",
      "--semantic-check-effort",
      "medium",
      "--judge-harness",
      "codex",
      "--judge-model",
      "advisory-model",
      "--judge-effort",
      "high",
      "--trials",
      "1",
      "--threshold",
      "1",
      "--dry",
      "--",
      ...nativeArgs(binary, credential),
    ]);
    expect(run.code, run.stderr + run.stdout).toBe(0);
    const manifest = JSON.parse(run.stdout);
    expect(manifest.caseIds).toEqual(["direct-alpha", "direct-beta"]);
    for (const cell of manifest.runs) {
      const evidence = JSON.parse(
        await readFile(cell.result.evidencePath, "utf8"),
      );
      expect(evidence.routes).toEqual([
        {
          role: "candidate",
          host: "sevro.host." + harness,
          model: cell.caseId === "direct-alpha" ? "alpha-model" : "base-model",
          effort: cell.caseId === "direct-alpha" ? "high" : "low",
        },
        {
          role: "semantic",
          host: "sevro.host.codex",
          model: "semantic-model",
          effort: "medium",
        },
        {
          role: "advisory",
          host: "sevro.host.codex",
          model: "advisory-model",
          effort: "high",
        },
      ]);
      expect(cell.result.task.verdict).toBe("not_assessed");
    }
  }
}, 30_000);

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "direct caller gates activation independently from task success",
  async () => {
    const scenarios = [
      ["failed", 1, "failed", []],
      ["unavailable", 1, "unavailable", []],
      ["passed", 0, "passed", []],
      ["dry", 0, "not_run", ["--dry"]],
      ["control", 0, "not_requested", ["--without-skill"]],
    ] as const;
    for (const [scenario, exitCode, status, controls] of scenarios) {
      const { root, binary, credential } = await fixture();
      const skill = join(root, ".agents/skills/probe");
      await mkdir(join(skill, "evals"), { recursive: true });
      const body =
        "---\nname: probe\ndescription: Return ready.\n---\nReturn ready.\n";
      await writeFile(join(skill, "SKILL.md"), body);
      await writeFile(
        join(skill, "evals/activation.yaml"),
        JSON.stringify({
          id: "direct-activation",
          invariant: "EXAMPLE-ACTIVATION",
          activation: "positive",
          prompt: "Return ready.",
          fixture: {
            commits: [
              { message: "chore: init", files: { "README.md": "ready\n" } },
            ],
          },
          checks: [],
          output_checks: [{ name: "response", expect_exact: "ready" }],
        }),
      );
      const count = join(root, "synthetic-trials");
      await writeFile(
        binary,
        `#!${process.execPath}
const argv = process.argv.slice(2);
if (argv[0] === "sandbox") {
  const child = Bun.spawn([${JSON.stringify(Bun.which("codex"))}, ...argv], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (argv[0] === "--version") { console.log("synthetic-activation"); process.exit(0); }
await Bun.stdin.text();
const countFile = Bun.file(${JSON.stringify(count)});
const ordinal = await countFile.exists() ? Number(await countFile.text()) + 1 : 1;
await Bun.write(countFile, String(ordinal));
const scenario = ${JSON.stringify(scenario)};
const events = [{ type: "thread.started", thread_id: "synthetic-activation" }];
if (scenario === "passed" || (scenario === "failed" && ordinal === 1))
  events.push({ type: "item.completed", item: {
    type: "command_execution", command: "cat .agents/skills/probe/SKILL.md",
    aggregated_output: ${JSON.stringify(body)}, exit_code: 0, status: "completed"
  } });
if (scenario === "unavailable")
  events.push({ type: "item.started", item: { id: "unfinished-read", type: "command_execution", command: "cat .agents/skills/probe/SKILL.md" } });
events.push(
  { type: "item.completed", item: { type: "agent_message", text: "ready" } },
  { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }
);
for (const event of events) console.log(JSON.stringify(event));
`,
        { mode: 0o700 },
      );
      const run = await invoke(root, [
        "--project-root",
        root,
        "--harness",
        "codex",
        "--skill",
        "probe",
        "--owner-evaluation",
        "passive",
        "--trials",
        "2",
        "--jobs",
        "1",
        "--threshold",
        "1",
        ...controls,
        "--",
        ...nativeArgs(binary, credential),
      ]);
      const manifest = JSON.parse(run.stdout);
      const cell = manifest.runs[0];
      expect(cell.exitCode, run.stderr + run.stdout).toBe(0);
      expect(cell.result.task.verdict).toBe(
        scenario === "dry" ? "not_assessed" : "passed",
      );
      expect(run.code, run.stderr + run.stdout).toBe(exitCode);
      expect(cell.activation.status).toBe(status);
      if (scenario === "failed")
        expect(cell.activation).toMatchObject({
          passRate: 0.5,
          passed: 1,
          failed: 1,
          threshold: 1,
        });
      if (scenario === "unavailable")
        expect(cell.activation).toMatchObject({
          passRate: null,
          unavailable: 2,
          threshold: 1,
        });
      expect(cell.resultError).toBeNull();
      expect(cell.activationError).toBeNull();
    }
  },
  60_000,
);

test.skipIf(process.platform !== "darwin" || !Bun.which("codex"))(
  "direct caller protects the whole external results root",
  async () => {
    for (const withOutput of [false, true]) {
      const { root, binary, credential } = await fixture();
      const storage = await realpath(
        await mkdtemp(join(tmpdir(), "darrow-direct-storage-")),
      );
      roots.push(storage);
      const prior = join(storage, "attempts/prior/cases/sibling");
      await mkdir(prior, { recursive: true });
      const paths = [join(storage, "sentinel"), join(prior, "evidence.json")];
      for (const path of paths) await writeFile(path, "retained-evidence");
      const checks = paths
        .map((path) => {
          const quoted = "'" + path.replaceAll("'", "'\\''") + "'";
          return (
            "if /bin/cat " +
            quoted +
            " >/dev/null 2>&1; then exit 1; fi\n" +
            "if /bin/sh -c " +
            "'" +
            ("printf tampered > " + quoted).replaceAll("'", "'\\''") +
            "' 2>/dev/null; then exit 1; fi"
          );
        })
        .join("\n");
      for (const id of ["direct-alpha", "direct-beta"]) {
        const path = join(
          root,
          "evals/experiments/example/cases",
          id + ".yaml",
        );
        const evalCase = JSON.parse(await readFile(path, "utf8"));
        evalCase.semantic_output_checks = [];
        evalCase.checks = [
          { name: "retained storage protected", run: checks, expect_exit: 0 },
        ];
        await writeFile(path, JSON.stringify(evalCase));
      }
      await writeFile(
        binary,
        `#!${process.execPath}
const argv = process.argv.slice(2);
const codex = ${JSON.stringify(Bun.which("codex"))};
if (argv[0] === "sandbox") {
  const child = Bun.spawn([codex, ...argv], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (argv[0] === "--version") { console.log("synthetic-direct-codex"); process.exit(0); }
await Bun.stdin.text();
const profile = JSON.parse(argv.find((arg) => arg.startsWith("default_permissions=")).split("=")[1]);
const child = Bun.spawn([codex, "sandbox", "-P", profile, "-C", process.cwd(), "/bin/sh", "-c", ${JSON.stringify(checks)}], { stdout: "pipe", stderr: "pipe" });
const [, , code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
for (const event of [
  { type: "thread.started", thread_id: "synthetic-storage" },
  { type: "item.completed", item: { type: "agent_message", text: code === 0 ? "ready" : "storage-accessible" } },
  { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } }
]) console.log(JSON.stringify(event));
`,
        { mode: 0o700 },
      );
      const outputPath = join(storage, "summary.json");
      const run = await invoke(root, [
        "--project-root",
        root,
        "--results-root",
        storage,
        "--harness",
        "codex",
        "--case",
        "direct-",
        "--owner-evaluation",
        "passive",
        "--trials",
        "1",
        "--threshold",
        "1",
        ...(withOutput ? ["--output", outputPath] : []),
        "--",
        ...nativeArgs(binary, credential),
      ]);
      const manifest = JSON.parse(run.stdout);
      expect(
        manifest.runs.map((cell: { exitCode: number }) => cell.exitCode),
        run.stderr + run.stdout,
      ).toEqual([0, 0]);
      expect(run.code, run.stderr + run.stdout).toBe(0);
      expect(
        manifest.runs.map(
          (cell: { result: { task: { verdict: string } } }) =>
            cell.result.task.verdict,
        ),
      ).toEqual(["passed", "passed"]);
      for (const path of paths)
        expect(await readFile(path, "utf8")).toBe("retained-evidence");
      const retained = JSON.parse(
        await readFile(join(storage, "selection-run.json"), "utf8"),
      );
      expect(retained).toEqual(manifest);
      if (withOutput)
        expect(await readFile(outputPath, "utf8")).toBe(run.stdout);
    }
  },
  60_000,
);
