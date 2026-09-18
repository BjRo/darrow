import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import { runOutputChecks, validateRegexChecks } from "./checks";
import type { EvalCase } from "./types";

const caseRoot = resolve(
  import.meta.dir,
  "../../plugins/capability/darrow-explanation/skills/explain-visually/evals",
);
const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

async function load(name: string): Promise<EvalCase> {
  return parse(
    await readFile(join(caseRoot, `${name}.yaml`), "utf8"),
  ) as EvalCase;
}

const examples = [
  {
    name: "algorithm-pseudocode",
    valid:
      "if attempt < 1: reject\nreturn randomized upper half of capped exponential delay",
    invalid: "Read the database and cache the result.",
  },
  {
    name: "direct-call-flow",
    valid:
      "Observed src/jobs.ts\nsubmitJob\n  validateJob\n  storeJob\n  enqueueJob",
    invalid:
      "Observed src/jobs.ts\nsubmitJob\n  storeJob\n  validateJob\n  enqueueJob",
  },
  {
    name: "file-responsibility",
    valid:
      "src/\n|-- commands/ # parses commands\n|-- sessions/ # session state\n`-- transport/ # API requests",
    invalid:
      "src/ contains commands/, sessions/, transport/. They own parsing, session state and API requests.",
  },
  {
    name: "incomplete-subject",
    valid: "What subject would you like explained?",
    invalid: "What about the inventory service?",
  },
  {
    name: "indirect-state-transitions",
    valid:
      "queued -> running\nrunning -> succeeded\nrunning -> failed\nrunning -> queued: attempts remain",
    invalid:
      "queued -> running -> succeeded\nrunning -> failed\nrunning -> paused: attempts remain",
  },
  {
    name: "structural-diff",
    valid:
      "Proposed target\n-transport.ts\n+transport/\n+  client.ts\n+  stream.ts",
    invalid:
      "Proposed target\n-\ntransport.ts\n+\ntransport/\nclient.ts\nstream.ts",
  },
  {
    name: "no-trigger-html-artifact",
    valid: "Created architecture.html.",
    invalid: "I cannot create files because this is a read-only capability.",
  },
  {
    name: "no-trigger-implementation",
    valid: "Implemented double(value).",
    invalid: "Observed view: a call tree",
  },
];

for (const example of examples) {
  test(`${example.name}: valid LF, CRLF and native path forms pass; counterexample fails`, async () => {
    const item = await load(example.name);
    const checks = item.output_checks ?? [];
    expect(checks.length).toBeGreaterThan(0);
    expect(validateRegexChecks(checks, item.id)).toEqual([]);
    for (const text of [
      example.valid,
      example.valid.replaceAll("\n", "\r\n"),
      example.valid.replaceAll("/", "\\"),
    ]) {
      expect(
        (await runOutputChecks(text, checks)).every((check) => check.passed),
      ).toBe(true);
    }
    expect(
      (await runOutputChecks(example.invalid, checks)).some(
        (check) => !check.passed,
      ),
    ).toBe(true);
  });
}

test("compactness checks reject one line beyond their declared bounds", async () => {
  for (const [name, limit] of [
    ["algorithm-pseudocode", 24],
    ["direct-call-flow", 24],
    ["file-responsibility", 22],
    ["incomplete-subject", 8],
    ["indirect-state-transitions", 28],
    ["structural-diff", 24],
  ] as const) {
    const checks = (await load(name)).output_checks!.filter(
      (check) => check.name === "response stays compact",
    );
    expect(checks).toHaveLength(1);
    for (const newline of ["\n", "\r\n"]) {
      const message = Array<string>(limit).fill("line").join(newline);
      expect(
        (await runOutputChecks(message + newline, checks))[0]!.passed,
      ).toBe(true);
      expect(
        (await runOutputChecks(message + newline + "extra", checks))[0]!.passed,
      ).toBe(false);
    }
  }
});

async function git(root: string, args: string[]): Promise<string> {
  const proc = Bun.spawn(["git", ...args], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  expect(code, err).toBe(0);
  return out;
}

async function fixture(item: EvalCase) {
  const root = await mkdtemp(join(tmpdir(), "explanation ü "));
  roots.push(root);
  await git(root, ["init"]);
  await git(root, ["config", "user.name", "Fixture"]);
  await git(root, ["config", "user.email", "fixture@example.invalid"]);
  await git(root, ["config", "core.autocrlf", "false"]);
  for (const commit of item.fixture.commits ?? []) {
    await files(root, commit.files);
    await git(root, ["add", "."]);
    await git(root, [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "-m",
      commit.message,
    ]);
  }
  await files(root, item.fixture.files ?? {});
  return root;
}

async function files(root: string, entries: Record<string, string>) {
  for (const [path, content] of Object.entries(entries)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

// The shared live runner currently launches checks through /bin/sh. Bun's
// shell lets CI exercise these exact Git-only checks on native Windows too.
async function passes(root: string, item: EvalCase) {
  const outcomes = [];
  for (const check of item.checks) {
    expect(check.run).toMatch(/^git /);
    expect(check.run).not.toMatch(/[;\n]|&&|\|\||\$\(/);
    const result = await Bun.$`${{ raw: check.run }}`
      .cwd(root)
      .quiet()
      .nothrow();
    const out = result.text().replace(/\r?\n$/, "");
    outcomes.push(
      result.exitCode === (check.exit_code ?? 0) &&
        (check.expect_exact === undefined || out === check.expect_exact) &&
        (check.expect_regex === undefined ||
          new RegExp(check.expect_regex, "m").test(out)),
    );
  }
  return outcomes.every(Boolean);
}

test("read-only cases reject edits and created artifacts", async () => {
  for (const name of examples
    .filter((item) => !item.name.startsWith("no-trigger"))
    .map((item) => item.name)) {
    const item = await load(name);
    expect(item.fixture.setup).toBeUndefined();
    const root = await fixture(item);
    expect(await passes(root, item)).toBe(true);
    await writeFile(join(root, "unrequested.html"), "artifact");
    expect(await passes(root, item)).toBe(false);
    await rm(join(root, "unrequested.html"));
    const tracked = Object.keys(item.fixture.commits![0]!.files)[0]!;
    await writeFile(join(root, tracked), "modified");
    expect(await passes(root, item)).toBe(false);
  }
});

test("pressure preserves untracked bytes as well as status", async () => {
  const item = await load("pressure-insufficient-evidence");
  expect(item.fixture.setup).toBeUndefined();
  const root = await fixture(item);
  expect(await passes(root, item)).toBe(true);
  await writeFile(join(root, "local-note.txt"), "different content\n");
  expect(await passes(root, item)).toBe(false);
  await rm(join(root, "local-note.txt"));
  expect(await passes(root, item)).toBe(false);
});

test("HTML case rejects missing or non-HTML files", async () => {
  const item = await load("no-trigger-html-artifact");
  const root = await fixture(item);
  expect(await passes(root, item)).toBe(false);
  await writeFile(join(root, "architecture.html"), "not HTML");
  expect(await passes(root, item)).toBe(false);
  await writeFile(
    join(root, "architecture.html"),
    "<!doctype html><html></html>",
  );
  expect(await passes(root, item)).toBe(true);
});

test("implementation case requires a changed doubling expression", async () => {
  const item = await load("no-trigger-implementation");
  const root = await fixture(item);
  expect(await passes(root, item)).toBe(false);
  await writeFile(
    join(root, "src/math.js"),
    "export const double = (value) => value * 3;\n",
  );
  expect(await passes(root, item)).toBe(false);
  await writeFile(
    join(root, "src/math.js"),
    "export const double = (value) => value * 2;\n",
  );
  expect(await passes(root, item)).toBe(true);
  await git(root, ["add", "src/math.js"]);
  expect(await passes(root, item)).toBe(true);
});
