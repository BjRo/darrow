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

const command = resolve(import.meta.dir, "../runner/run.ts");

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
      model: "gpt-6-luna",
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
    version: "0.1.0-rc.2",
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
