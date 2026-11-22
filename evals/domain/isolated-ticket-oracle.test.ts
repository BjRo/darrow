import { test } from "bun:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/isolated-ticket-serial.yaml",
  import.meta.url,
);
const selected = parse(readFileSync(source, "utf8")) as {
  fixture: unknown;
  checks: { name: string; run: string }[];
};
const integrated = selected.checks.find(
  (check) =>
    check.name ===
    "worker commit is retained in its separate linked worktree and integrated",
);
assert.ok(integrated);

test("native serial host cases share the same fixture and effect oracles", () => {
  const claude = parse(
    readFileSync(new URL("isolated-ticket-serial-claude.yaml", source), "utf8"),
  ) as typeof selected;
  assert.deepEqual(claude.fixture, selected.fixture);
  assert.deepEqual(
    claude.checks.map((check) => ({
      ...check,
      run: check.run.replace("--host claude", "--host codex"),
    })),
    selected.checks,
  );
});

for (const branch of ["feat/issue-41-versions", "worktree-agent-opaque"]) {
  test(`isolated ticket oracle retains and integrates ${branch}`, () => {
    const root = mkdtempSync(join(tmpdir(), "darrow-isolated-ticket-oracle-"));
    const repo = join(root, "integration");
    const worker = join(root, "worker");
    const run = (args: string[], cwd = repo) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    const accepted = () =>
      spawnSync("/bin/sh", ["-c", integrated.run], { cwd: repo }).status === 0;

    try {
      run(["init", "--initial-branch=main", repo], root);
      run(["config", "user.name", "Fixture"]);
      run(["config", "user.email", "fixture@example.invalid"]);
      mkdirSync(join(repo, "src"));
      mkdirSync(join(repo, ".git/eval-checks"));
      copyFileSync(
        new URL(
          "../../../backend/tests/evals/isolated_ticket_batch.py",
          source,
        ),
        join(repo, ".git/eval-checks/isolated_ticket_batch.py"),
      );
      writeFileSync(join(repo, "src/versions.js"), "initial\n");
      run(["add", "src/versions.js"]);
      run(["commit", "-m", "chore: initial"]);
      const base = run(["rev-parse", "HEAD"]);
      writeFileSync(join(repo, ".git/integration-branch"), "main\n");
      writeFileSync(join(repo, ".git", "integration-base"), base + "\n");
      assert.equal(accepted(), false, "missing worker must fail");

      run(["worktree", "add", "-b", branch, worker, base]);
      writeFileSync(join(worker, "src/versions.js"), "implemented\n");
      run(["add", "src/versions.js"], worker);
      run(["commit", "-m", "feat: implement versions"], worker);
      const implementation = run(["rev-parse", "HEAD"], worker);
      assert.equal(accepted(), false, "unlanded worker commit must fail");

      writeFileSync(join(repo, "other.txt"), "independent integration\n");
      run(["add", "other.txt"]);
      run(["commit", "-m", "feat: independent ticket"]);
      run(["cherry-pick", implementation]);
      assert.notEqual(run(["rev-parse", "HEAD"]), implementation);
      assert.equal(accepted(), true, "patch-equivalent cherry-pick must pass");

      writeFileSync(join(worker, "src/versions.js"), "unintegrated repair\n");
      run(["add", "src/versions.js"], worker);
      run(["commit", "-m", "fix: pending repair"], worker);
      assert.equal(accepted(), false, "a later unlanded commit must fail");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
