import { expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/authorized-publication.yaml",
  import.meta.url,
);

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

const commands = `
import assert from "node:assert/strict";
const run = (args) => Bun.spawnSync(args, {
  cwd: process.cwd(), stdout: "pipe", stderr: "pipe",
});
const checked = (args) => {
  const result = run(args);
  assert.equal(result.exitCode, 0, result.stderr.toString());
  return result.stdout.toString();
};
const gh = (args) => ["/bin/bash", ".git/fixture-bin/gh", ...args];
`;

function fixtureProgram(name: string, code: string): OracleCheck {
  return {
    name,
    run: `${shellQuote(process.execPath)} -e ${shellQuote(commands + code)}`,
  };
}

const helpCheck = fixtureProgram(
  "publication help preserves all state",
  `
import { existsSync } from "node:fs";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
async function publicationState() {
  const directory = ".git/fixture-state";
  const entries = (await readdir(directory, { recursive: true })).sort();
  const fixtureState = await Promise.all(entries.map(async (name) => {
    const path = join(directory, name);
    return [name, (await lstat(path)).isFile()
      ? (await readFile(path)).toString("base64") : "directory"];
  }));
  return {
    worktree: checked(["git", "status", "--porcelain", "--untracked-files=all"]),
    localRefs: checked(["git", "for-each-ref", "--format=%(refname) %(objectname)"]),
    remoteRefs: checked(["git", "--git-dir=.git/fixture-remote.git", "for-each-ref", "--format=%(refname) %(objectname)"]),
    fixtureState,
  };
}
const log = ".git/fixture-state/gh-pr-calls";
for (const flag of ["--help", "-h"]) {
  const before = await publicationState();
  assert.equal(before.worktree, "");
  assert.ok(checked(gh(["pr", "create", flag])).includes("--draft"));
  assert.equal(existsSync(log), false);
  assert.deepEqual(await publicationState(), before);
}
checked(gh(["pr", "create", "--draft"]));
const beforeHelp = await readFile(log, "utf8");
assert.equal(beforeHelp.trim().split("\\n").length, 1);
assert.ok(beforeHelp.includes("pr create --draft"));
const published = await publicationState();
checked(gh(["pr", "create", "--help"]));
assert.equal(await readFile(log, "utf8"), beforeHelp);
assert.deepEqual(await publicationState(), published);
assert.notEqual(run(gh(["pr", "merge"])).exitCode, 0);
assert.equal(await readFile(log, "utf8"), beforeHelp);
`,
);

const evidenceCheck = fixtureProgram(
  "draft and remote commit evidence",
  `
assert.deepEqual(JSON.parse(checked(gh(["pr", "list", "--json", "number"]))), []);
assert.notEqual(run(gh(["pr", "view", "1"])).exitCode, 0);
checked(["git", "push", "origin", "HEAD"]);
const remoteTip = checked(["git", "rev-parse", "HEAD"]).trim();
checked(gh(["pr", "create"]));
const read = () => JSON.parse(checked(gh(["pr", "view", "1", "--json", "state,isDraft,headRefOid"])));
let observed = read();
assert.equal(observed.state, "OPEN");
assert.equal(observed.isDraft, false);
assert.equal(observed.headRefOid, remoteTip);
for (const args of [
  ["--head", "different-branch"], ["--base", "different-base"],
  ["--repo", "other/repo"], ["--state", "closed"],
]) {
  assert.deepEqual(JSON.parse(checked(gh(["pr", "list", ...args, "--json", "number"]))), []);
}
assert.notEqual(run(gh(["pr", "view", "2", "--json", "number"])).exitCode, 0);
checked(["git", "-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "test: unpublished commit"]);
assert.notEqual(checked(["git", "rev-parse", "HEAD"]).trim(), remoteTip);
assert.equal(read().headRefOid, remoteTip);
checked(gh(["pr", "create", "--draft"]));
observed = read();
assert.equal(observed.isDraft, true);
assert.equal(observed.headRefOid, remoteTip);
`,
);

for (const scenario of [
  { name: "long draft flag", args: ["--draft"], creations: 1, passes: true },
  { name: "short draft flag", args: ["-d"], creations: 1, passes: true },
  {
    name: "assigned draft flag",
    args: ["--draft=true"],
    creations: 1,
    passes: true,
  },
  { name: "no draft flag", args: [], creations: 1, passes: false },
  {
    name: "draft mention in body text",
    args: ["--body", "Do not use --draft for this PR"],
    creations: 1,
    passes: false,
  },
  {
    name: "duplicate draft creation",
    args: ["--draft"],
    creations: 2,
    passes: false,
  },
]) {
  test(`publication draft oracle: ${scenario.name}`, async () => {
    const canonical = await readFixtureCase(source);
    const oracle = canonical.checks.find(
      (check) => check.name === "exactly one draft pull request was opened",
    );
    if (!oracle) throw new Error("canonical draft oracle is missing");
    const run = [
      "/bin/bash",
      ".git/fixture-bin/gh",
      "pr",
      "create",
      ...scenario.args,
    ]
      .map(shellQuote)
      .join(" ");
    const actions = Array.from({ length: scenario.creations }, (_, index) => ({
      name: `fixture creation ${index + 1}`,
      run,
    }));
    const result = await runFixtureChecks({
      source,
      checks: [...actions, oracle],
    });
    expect(result.exitCode, result.diagnostic).toBe(scenario.passes ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(
      scenario.passes ? "passed" : "failed",
    );
    expect(
      result.checks.slice(0, actions.length).map((check) => check.status),
    ).toEqual(actions.map(() => "passed"));
    expect(result.checks.at(-1)?.status).toBe(
      scenario.passes ? "passed" : "failed",
    );
  }, 20_000);
}

test("publication fixture help is read-only and preserves the single creation allowance", async () => {
  const result = await runFixtureChecks({ source, checks: [helpCheck] });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks[0]?.status).toBe("passed");
}, 20_000);

test("publication evidence reflects the actual draft flag and remote commit", async () => {
  const result = await runFixtureChecks({ source, checks: [evidenceCheck] });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks[0]?.status).toBe("passed");
}, 20_000);
