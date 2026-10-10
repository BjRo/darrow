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

const command = resolve(import.meta.dir, "../runner/suite.ts");

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
    version: "0.1.0-rc.4",
  });
  const result = JSON.parse(await readFile(manifest.cells[0].result, "utf8"));
  expect(result.task.verdict).toBe("not_assessed");
}, 30_000);
