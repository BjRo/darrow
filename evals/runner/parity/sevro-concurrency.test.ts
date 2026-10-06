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

const roots: string[] = [];
const command = resolve(import.meta.dir, "../../sevro-extension/run.ts");

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

test("Darrow exact and filtered callers forward the trial concurrency limit", async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-sevro-jobs-")),
  );
  roots.push(root);
  const project = join(root, "project");
  const cases = join(project, "evals/experiments/example/cases");
  await mkdir(cases, { recursive: true });
  await writeFile(
    join(cases, "selected.yaml"),
    JSON.stringify({
      id: "selected",
      invariant: "SE-C16",
      prompt: "Return ready.",
      fixture: {
        commits: [{ message: "Initial", files: { "README.md": "fixture" } }],
      },
      checks: [],
    }),
  );
  for (const selector of ["--case-id", "--case"]) {
    const child = Bun.spawn(
      [
        process.execPath,
        command,
        selector,
        "selected",
        "--project-root",
        project,
        "--results-root",
        join(root, selector.slice(2)),
        "--",
        "--host",
        "codex",
        "--model",
        "synthetic-codex",
        "--effort",
        "low",
        "--codex-bin",
        process.execPath,
        "--codex-auth-file",
        join(root, "unused-auth.json"),
        "--condition",
        "passive",
        "--dry",
        "--trials",
        "1",
        "--threshold",
        "1",
        "--jobs",
        "2",
      ],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code, stderr + stdout).toBe(0);
    const reply = JSON.parse(stdout);
    const result = selector === "--case-id" ? reply : reply.runs[0].result;
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    expect(evidence.configuration.redacted.jobs).toBe(2);
  }
});
