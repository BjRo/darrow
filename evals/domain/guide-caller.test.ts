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

async function invoke(
  root: string,
  results: string,
  args: string[],
  packageBin?: string,
) {
  const child = Bun.spawn(
    [
      process.execPath,
      command,
      "--project-root",
      root,
      "--results-root",
      results,
      ...args,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      env: packageBin
        ? {
            ...process.env,
            SEVRO_CHECKOUT: undefined,
            SEVRO_PACKAGE_BIN: packageBin,
          }
        : process.env,
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return {
    stdout,
    stderr,
    code,
    output: stdout.match(/^Guide evidence: (.+)$/m)?.[1],
  };
}

async function successfulTaskHost(root: string, binary: string) {
  const realCodex = Bun.which("codex")!;
  const calls = join(root, "calls.jsonl");
  await writeFile(
    binary,
    `#!${process.execPath}
import { appendFile } from "node:fs/promises";
const argv = process.argv.slice(2);
if (argv[0] === "sandbox") {
  const child = Bun.spawn([${JSON.stringify(realCodex)}, ...argv], { stdout: "inherit", stderr: "inherit" });
  process.exit(await child.exited);
}
if (argv[0] === "--version") { console.log("synthetic-guide-codex"); process.exit(0); }
const prompt = await Bun.stdin.text();
const propositions = prompt.match(/<propositions-json>\\n([\\s\\S]*?)\\n<\\/propositions-json>/);
const text = propositions ? JSON.stringify({ checks: JSON.parse(propositions[1]).map(({ id }) => ({ id, verdict: "pass", reason: "Synthetic fixture supports the proposition." })) }) : "ready";
if (!propositions) await appendFile(${JSON.stringify(calls)}, JSON.stringify({ prompt }) + "\\n");
for (const event of [
  { type: "thread.started", thread_id: "synthetic-guide" },
  { type: "item.completed", item: { type: "agent_message", text } },
  { type: "turn.completed", usage: { input_tokens: 1, output_tokens: 1 } },
]) console.log(JSON.stringify(event));
`,
    { mode: 0o700 },
  );
  return calls;
}

test("guide caller stops after failed activation despite a passed task", async () => {
  const { root, binary, credential, results } = await fixture();
  const calls = await successfulTaskHost(root, binary);
  const run = await invoke(root, results, [
    "--harness",
    "codex",
    "--",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
  ]);
  const result = JSON.parse(
    await readFile(join(run.output!, "guide-alpha-codex.json"), "utf8"),
  );
  const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
  expect(run.code, run.stdout + run.stderr).toBe(1);
  expect(evidence.result).toEqual(result);
  expect(result.execution.status).toBe("completed");
  expect(result.grading.status).toBe("completed");
  expect(result.task.verdict).toBe("passed");
  expect(result.cases[0].trials[0].domainOutcomes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "darrow.evals.activation",
        status: "failed",
      }),
    ]),
  );
  expect(
    await Bun.file(join(run.output!, "guide-beta-codex.json")).exists(),
  ).toBe(false);
  expect((await readFile(calls, "utf8")).trim().split("\n")).toHaveLength(1);
}, 30_000);

for (const [exit, raw] of [
  [0, '{"format":"sevro.cli-result.v99"}\n'],
  [2, '{"format":'],
  [64, ""],
] as const)
  test(`guide caller retains invalid output and process exit ${exit}`, async () => {
    const { root, binary, credential, results } = await fixture();
    const packageBin = join(root, "sevro");
    await writeFile(
      packageBin,
      `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(raw)});\nprocess.exit(${exit});\n`,
      { mode: 0o700 },
    );
    const run = await invoke(
      root,
      results,
      [
        "--harness",
        "codex",
        "--dry",
        "--",
        "--codex-bin",
        binary,
        "--codex-auth-file",
        credential,
      ],
      packageBin,
    );
    expect(run.code, run.stdout + run.stderr).toBe(exit || 1);
    const diagnostic = JSON.parse(
      await readFile(
        join(run.output!, "guide-alpha-codex/guide-result-error.json"),
        "utf8",
      ),
    );
    expect(diagnostic.processExitCode).toBe(exit);
    expect(diagnostic.result).toBeNull();
    expect(diagnostic.rawOutputPath).toBe(
      join(run.output!, "guide-alpha-codex.json"),
    );
    expect(diagnostic.error).toBeString();
    expect(diagnostic.error.length).toBeGreaterThan(0);
    expect(run.stderr).toContain("Guide result unavailable");
    expect(
      await readFile(join(run.output!, "guide-alpha-codex.json"), "utf8"),
    ).toBe(raw);
    expect(
      await Bun.file(join(run.output!, "guide-beta-codex.json")).exists(),
    ).toBe(false);
  });

for (const [signal, exit] of [
  ["SIGINT", 130],
  ["SIGTERM", 143],
] as const)
  test(`guide caller retains partial startup output on ${signal}`, async () => {
    const { root, binary, credential, results } = await fixture();
    const ready = join(root, "startup-ready");
    const raw = '{"format":';
    const packageBin = join(root, "sevro");
    await writeFile(
      packageBin,
      `#!${process.execPath}
import { writeFile } from "node:fs/promises";
process.on("${signal}", () => process.exit(${exit}));
process.stdout.write(${JSON.stringify(raw)});
await writeFile(${JSON.stringify(ready)}, "ready");
await new Promise(() => { setInterval(() => {}, 1000); });
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
        results,
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
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...process.env,
          SEVRO_CHECKOUT: undefined,
          SEVRO_PACKAGE_BIN: packageBin,
        },
      },
    );
    const captured = Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    try {
      const deadline = Date.now() + 10_000;
      while (!(await Bun.file(ready).exists()) && Date.now() < deadline)
        await Bun.sleep(20);
      expect(await Bun.file(ready).exists()).toBe(true);
      child.kill(signal);
      const [stdout, stderr, code] = await captured;
      expect(code, stdout + stderr).toBe(exit);
      const output = stdout.match(/^Guide evidence: (.+)$/m)![1]!;
      const diagnostic = JSON.parse(
        await readFile(
          join(output, "guide-alpha-codex/guide-result-error.json"),
          "utf8",
        ),
      );
      expect(diagnostic.processExitCode).toBe(exit);
      expect(diagnostic.cancellationExitCode).toBe(exit);
      expect(diagnostic.result).toBeNull();
      expect(diagnostic.error.length).toBeGreaterThan(0);
      expect(stderr).toContain("Guide result unavailable");
      expect(await readFile(diagnostic.rawOutputPath, "utf8")).toBe(raw);
      expect(
        await Bun.file(join(output, "guide-beta-codex.json")).exists(),
      ).toBe(false);
    } finally {
      child.kill("SIGTERM");
      await captured;
    }
  }, 30_000);

test("guide caller refuses caller-owned forwarded options before execution", async () => {
  const { root, binary, credential, results } = await fixture();
  const run = await invoke(root, results, [
    "--harness",
    "codex",
    "--dry",
    "--",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
    "--trials=2",
  ]);
  expect(run.code, run.stdout + run.stderr).toBe(1);
  expect(run.stderr).toContain("Guide option cannot be overridden: --trials");
  expect(
    await Bun.file(join(run.output!, "guide-alpha-codex.json")).exists(),
  ).toBe(false);
});

test("guide caller runs unmounted controls in inventory order", async () => {
  const { root, binary, credential, results } = await fixture();
  const calls = await successfulTaskHost(root, binary);
  const run = await invoke(root, results, [
    "--harness",
    "codex",
    "--without-skill",
    "--",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
  ]);
  expect(run.code, run.stdout + run.stderr).toBe(0);
  for (const id of ["guide-alpha", "guide-beta"]) {
    const result = JSON.parse(
      await readFile(join(run.output!, `${id}-codex.json`), "utf8"),
    );
    expect(result.task.verdict).toBe("passed");
    expect(result.cases[0].trials[0].domainOutcomes).toEqual([]);
  }
  expect(
    (await readFile(calls, "utf8"))
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line).prompt),
  ).toEqual(["guide-alpha", "guide-beta"]);
}, 30_000);

test("guide caller stops after task failure and retains its public exit", async () => {
  const { root, binary, credential, results } = await fixture();
  const calls = await successfulTaskHost(root, binary);
  await writeFile(
    binary,
    (await readFile(binary, "utf8")).replace(': "ready";', ': "wrong";'),
  );
  const run = await invoke(root, results, [
    "--harness",
    "codex",
    "--without-skill",
    "--",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
  ]);
  expect(run.code, run.stdout + run.stderr).toBe(1);
  const result = JSON.parse(
    await readFile(join(run.output!, "guide-alpha-codex.json"), "utf8"),
  );
  expect(result.execution.status).toBe("completed");
  expect(result.grading.status).toBe("completed");
  expect(result.task.verdict).toBe("failed");
  expect(result.exitCode).toBe(1);
  expect(
    await Bun.file(join(run.output!, "guide-beta-codex.json")).exists(),
  ).toBe(false);
  expect((await readFile(calls, "utf8")).trim().split("\n")).toHaveLength(1);
}, 30_000);

test("guide caller retains interrupted evidence and stops later cells", async () => {
  for (const [signal, exit] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ] as const) {
    const { root, binary, credential, results } = await fixture();
    const calls = await successfulTaskHost(root, binary);
    await writeFile(
      binary,
      (await readFile(binary, "utf8")).replace(
        "for (const event of [",
        "await new Promise(() => { setInterval(() => {}, 1000); });\nfor (const event of [",
      ),
    );
    const child = Bun.spawn(
      [
        process.execPath,
        command,
        "--project-root",
        root,
        "--results-root",
        results,
        "--harness",
        "codex",
        "--without-skill",
        "--",
        "--codex-bin",
        binary,
        "--codex-auth-file",
        credential,
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const captured = Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    try {
      const deadline = Date.now() + 10_000;
      while (!(await Bun.file(calls).exists()) && Date.now() < deadline)
        await Bun.sleep(20);
      expect(await Bun.file(calls).exists()).toBe(true);
      child.kill(signal);
      const [stdout, stderr, code] = await captured;
      expect(code, stdout + stderr).toBe(exit);
      const output = stdout.match(/^Guide evidence: (.+)$/m)![1]!;
      const result = JSON.parse(
        await readFile(join(output, "guide-alpha-codex.json"), "utf8"),
      );
      expect(result.exitCode).toBe(exit);
      expect(result.execution.status).toBe("cancelled");
      expect(result.task.verdict).toBe("not_assessed");
      const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
      expect(evidence.result).toEqual(result);
      expect(
        await Bun.file(join(output, "guide-beta-codex.json")).exists(),
      ).toBe(false);
      expect((await readFile(calls, "utf8")).trim().split("\n")).toHaveLength(
        1,
      );
    } finally {
      child.kill("SIGTERM");
      await captured;
    }
  }
}, 30_000);

test("guide caller uses separate roots and explicit routes on both hosts", async () => {
  const { root, binary, credential, results } = await fixture();
  const run = await invoke(root, results, [
    "--only",
    "guide-alpha",
    "--dry",
    "--",
    "--model=guide-candidate",
    "--effort",
    "high",
    "--semantic-model",
    "guide-judge",
    "--semantic-effort=low",
    "--codex-bin",
    binary,
    "--codex-auth-file",
    credential,
    "--claude-bin",
    binary,
    "--claude-credential-file",
    credential,
  ]);
  expect(run.code, run.stdout + run.stderr).toBe(0);
  expect(run.output!.startsWith(results + "/guide-v7/")).toBe(true);
  for (const host of ["codex", "claude"]) {
    const result = JSON.parse(
      await readFile(join(run.output!, `guide-alpha-${host}.json`), "utf8"),
    );
    expect(result.cases.map((row: { caseId: string }) => row.caseId)).toEqual([
      "guide-alpha",
    ]);
    expect(result.task.verdict).toBe("not_assessed");
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    expect(evidence.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "candidate",
          host: `sevro.host.${host}`,
          model: "guide-candidate",
          effort: "high",
        }),
        expect.objectContaining({
          role: "semantic",
          model: "guide-judge",
          effort: "low",
        }),
      ]),
    );
    expect(
      await Bun.file(join(run.output!, `guide-beta-${host}.json`)).exists(),
    ).toBe(false);
  }
}, 30_000);
