import { afterEach, expect, test } from "bun:test";

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";

import { tmpdir } from "node:os";

import { join, resolve } from "node:path";

const outputRoots: string[] = [];

const repository = resolve(import.meta.dir, "../..");

const command = join(repository, "evals/repository-guide.ts");

afterEach(async () => {
  await Promise.all(
    outputRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("guide caller retains a public unassessed dry result", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      command,
      "--only",
      "guide-negative",
      "--harness",
      "codex",
      "--dry",
    ],
    { cwd: repository, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const output = stdout.match(/^Guide evidence: (.+)$/m)?.[1];
  expect(output, stdout + stderr).toBeDefined();
  outputRoots.push(output!);
  expect(code, stderr).toBe(0);
  const result = JSON.parse(
    await readFile(join(output!, "guide-negative-codex.json"), "utf8"),
  );
  expect(result.format).toBe("sevro.cli-result.v1");
  expect(result.execution.status).toBe("not_run");
  expect(result.grading.status).toBe("not_requested");
  expect(result.task.verdict).toBe("not_assessed");
  expect(result.cases.map((row: { caseId: string }) => row.caseId)).toEqual([
    "guide-negative",
  ]);
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(evidence.result).toEqual(result);
  expect(evidence.configuration.redacted.jobs).toBe(1);
  expect(evidence.routes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        role: "candidate",
        host: "sevro.host.codex",
        model: "gpt-6-luna",
        effort: "medium",
      }),
      expect.objectContaining({
        role: "semantic",
        host: "sevro.host.codex",
        model: "gpt-6-luna",
        effort: "medium",
      }),
    ]),
  );
}, 30_000);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "darrow-sevro-guide-"));
  outputRoots.push(root);
  const skill = join(root, ".agents/skills/darrow-guide");
  await mkdir(join(skill, "evals"), { recursive: true });
  await mkdir(join(root, ".claude/skills/darrow-guide"), { recursive: true });
  const body =
    "---\nname: darrow-guide\ndescription: Explain this checkout.\n---\nUse local sources.\n";
  await writeFile(join(skill, "SKILL.md"), body);
  await writeFile(join(root, ".claude/skills/darrow-guide/SKILL.md"), body);
  await writeFile(
    join(skill, "evals/inventory.json"),
    JSON.stringify({
      version: 7,
      questions: [{ id: "guide-alpha" }, { id: "guide-beta" }],
    }),
  );
  for (const id of ["guide-alpha", "guide-beta"])
    await writeFile(
      join(skill, `evals/${id}.yaml`),
      JSON.stringify({
        id,
        invariant: "RG-C1",
        activation: "positive",
        prompt: id,
        fixture: {
          commits: [
            { message: "chore: fixture", files: { "README.md": "source\n" } },
          ],
        },
        checks: [],
        output_checks: [{ name: "answer", expect_exact: "ready" }],
        semantic_output_checks: [
          { name: "meaning", proposition: "The answer is ready." },
        ],
      }),
    );
  const binaryRoot = await mkdtemp(join(tmpdir(), "darrow-sevro-guide-bin-"));
  outputRoots.push(binaryRoot);
  const binary = join(binaryRoot, "host");
  await writeFile(binary, "#!/bin/sh\nexit 99\n", { mode: 0o700 });
  const credential = join(root, "auth.json");
  await writeFile(credential, '{"synthetic":"credential"}', { mode: 0o600 });
  return { root, binary, credential, results: join(root, "results") };
}

test("guide caller uses the frozen package without route overrides", async () => {
  const { root, binary, credential, results } = await fixture();
  const child = Bun.spawn(
    [
      process.execPath,
      command,
      "--project-root",
      root,
      "--results-root",
      results,
      "--only",
      "guide-beta",
      "--harness",
      "codex",
      "--dry",
      "--",
      "--codex-bin",
      binary,
      "--codex-auth-file",
      credential,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        SEVRO_CHECKOUT: undefined,
        SEVRO_PACKAGE_BIN: undefined,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(code, stderr + stdout).toBe(0);
  const output = stdout.match(/^Guide evidence: (.+)$/m)?.[1];
  expect(output, stderr + stdout).toBeDefined();
  const result = JSON.parse(
    await readFile(join(output!, "guide-beta-codex.json"), "utf8"),
  );
  expect(result).toMatchObject({
    format: "sevro.cli-result.v1",
    task: { verdict: "not_assessed" },
    cases: [{ caseId: "guide-beta" }],
  });
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(evidence.runner).toMatchObject({
    source: "package",
    packageName: "@bjoernrochel/sevro",
    version: "0.1.0-rc.2",
  });
}, 30_000);
