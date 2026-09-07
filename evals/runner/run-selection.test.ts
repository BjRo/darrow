import { afterEach, expect, test } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { CaseResult } from "./types";

const roots: string[] = [];
const skillPath = "plugins/capability/example/skills/create-commit";
const siblingPath = "plugins/capability/example/skills/create-pr";

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function writeCase(root: string, directory: string, id: string) {
  await mkdir(join(root, directory), { recursive: true });
  await writeFile(
    join(root, directory, `${id}.yaml`),
    JSON.stringify({
      id,
      invariant: "SE-C25",
      prompt: "Inspect the fixture.",
      fixture: { files: { "README.md": "fixture\n" }, commit_files: true },
      checks: [],
    }),
  );
}

async function selectionFixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), "darrow-run-selection-")),
  );
  roots.push(root);
  await cp(import.meta.dir, join(root, "evals/runner"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.ts"),
  });
  await symlink(
    resolve(import.meta.dir, "../../node_modules"),
    join(root, "node_modules"),
  );
  for (const directory of [skillPath, siblingPath, `${skillPath}-extra`]) {
    await mkdir(join(root, directory), { recursive: true });
    await writeFile(
      join(root, directory, "SKILL.md"),
      "---\nname: fixture\ndescription: Test fixture\n---\nInspect the fixture.\n",
    );
  }
  await writeCase(root, `${skillPath}/evals`, "alpha");
  await writeCase(root, `${skillPath}/evals`, "beta");
  await writeCase(root, `${siblingPath}/evals`, "create-commit-misleading");
  await writeCase(root, `${skillPath}-extra/evals`, "gamma");
  await writeCase(
    root,
    "evals/experiments/example/cases",
    "create-commit-experiment",
  );
  return root;
}

async function runSelection(root: string, args: readonly string[]) {
  const output = join(root, "result.json");
  const proc = Bun.spawn(
    [
      process.execPath,
      join(root, "evals/runner/run.ts"),
      "--harness",
      "claude",
      "--dry",
      "--trials",
      "1",
      "--jobs",
      "1",
      "--no-color",
      "--no-emoji",
      "--no-progress",
      "--output",
      output,
      ...args,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  const results: CaseResult[] = (await Bun.file(output).exists())
    ? JSON.parse(await readFile(output, "utf8"))
    : [];
  return { stdout, stderr, code, results };
}

test("--skill selects all colocated cases independently of case IDs", async () => {
  const root = await selectionFixture();
  const { code, stderr, results } = await runSelection(root, [
    "--skill",
    "create-commit",
  ]);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual(["alpha", "beta"]);
  expect(results.map((result) => result.skillDirectory)).toEqual([
    join(root, skillPath),
    join(root, skillPath),
  ]);
});

test("--case filters narrow --skill selection and retain OR matching", async () => {
  const root = await selectionFixture();
  const { code, stderr, results } = await runSelection(root, [
    "--skill",
    "create-commit",
    "--case",
    "alp",
    "--case",
    "create-commit",
  ]);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual(["alpha"]);
});

test.each([
  { args: ["--skill", "unknown"] },
  { args: ["--skill", "create"] },
  { args: ["--skill", ""] },
  { args: ["--skill", "create-commit", "--case", "create-commit"] },
])("rejects an empty selection: %j", async ({ args }) => {
  const root = await selectionFixture();
  const { code, stdout, stderr, results } = await runSelection(root, args);
  expect(code).toBe(1);
  expect(stdout).toBe("");
  expect(stderr).toBe("No cases matched.\n");
  expect(results).toEqual([]);
});

test("skill selection excludes unrelated corpus dependencies before resolution", async () => {
  const root = await selectionFixture();
  const path = join(root, siblingPath, "evals/create-commit-misleading.yaml");
  const evalCase = JSON.parse(await readFile(path, "utf8"));
  evalCase.fixture = { source: "unprepared-corpus" };
  await writeFile(path, JSON.stringify(evalCase));
  const { code, stderr, results } = await runSelection(root, [
    "--skill",
    "create-commit",
  ]);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual(["alpha", "beta"]);
});

test("--skill-dir changes mounting after selection", async () => {
  const root = await selectionFixture();
  const { code, stderr, results } = await runSelection(root, [
    "--skill",
    "create-commit",
    "--skill-dir",
    siblingPath,
  ]);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual(["alpha", "beta"]);
  expect(results.map((result) => result.skillDirectory)).toEqual([
    join(root, siblingPath),
    join(root, siblingPath),
  ]);
});

test("--without-skill preserves owning-skill selection", async () => {
  const root = await selectionFixture();
  const { code, stderr, results } = await runSelection(root, [
    "--skill",
    "create-commit",
    "--without-skill",
  ]);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual(["alpha", "beta"]);
  expect(results.map((result) => result.skillDirectory)).toEqual([null, null]);
});

test("case-only selection still matches any supplied substring across owners", async () => {
  const root = await selectionFixture();
  const { code, stderr, results } = await runSelection(root, [
    "--case",
    "alp",
    "--case",
    "create-commit",
  ]);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual([
    "alpha",
    "create-commit-experiment",
    "create-commit-misleading",
  ]);
});

test("unfiltered selection includes every discovered case", async () => {
  const root = await selectionFixture();
  const { code, stderr, results } = await runSelection(root, []);
  expect(code, stderr).toBe(0);
  expect(results.map((result) => result.caseId)).toEqual([
    "alpha",
    "beta",
    "create-commit-experiment",
    "create-commit-misleading",
    "gamma",
  ]);
});
