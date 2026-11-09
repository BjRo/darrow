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
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/isolated-ticket-batch.yaml",
  import.meta.url,
);
const selected = parse(readFileSync(source, "utf8")) as {
  fixture: unknown;
  checks: { name: string; run: string }[];
};

function addLaterRepair(
  state: string,
  root: string,
  git: (args: string[], cwd?: string) => string,
) {
  if (state !== "later repair" && state !== "unlanded repair") return;
  const worker = join(root, "41");
  writeFileSync(join(worker, "repair.txt"), "assurance repair\n");
  git(["add", "repair.txt"], worker);
  git(["commit", "-m", "repair"], worker);
  if (state === "later repair")
    git(["cherry-pick", git(["rev-parse", "HEAD"], worker)]);
}

test("native batch hosts use identical fixtures and effect assertions", () => {
  const other = parse(
    readFileSync(new URL("isolated-ticket-batch-claude.yaml", source), "utf8"),
  ) as typeof selected;
  assert.deepEqual(other.fixture, selected.fixture);
  assert.deepEqual(
    other.checks.map((check) => ({
      ...check,
      run: check.run.replace("--host claude", "--host codex"),
    })),
    selected.checks,
  );
});

for (const state of [
  "valid",
  "different base",
  "missing dependency",
  "unlanded",
  "later repair",
  "unlanded repair",
] as const) {
  test(`batch Git oracle: ${state}`, () => {
    const root = mkdtempSync(join(tmpdir(), "darrow-ticket-batch-"));
    const repo = join(root, "repo");
    mkdirSync(repo);
    const git = (args: string[], cwd = repo) => {
      const result = spawnSync("git", args, { cwd, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout.trim();
    };
    try {
      git(["init", "-b", "feat/issue-41-delivery"]);
      git(["config", "user.name", "Fixture"]);
      git(["config", "user.email", "fixture@example.invalid"]);
      git(["commit", "--allow-empty", "-m", "initial"]);
      const base = git(["rev-parse", "HEAD"]);
      writeFileSync(
        join(repo, ".git/integration-branch"),
        "feat/issue-41-delivery\n",
      );
      writeFileSync(join(repo, ".git/integration-base"), base + "\n");
      mkdirSync(join(repo, ".git/eval-checks"));
      copyFileSync(
        new URL(
          "../../../backend/tests/evals/isolated_ticket_batch.py",
          source,
        ),
        join(repo, ".git/eval-checks/isolated_ticket_batch.py"),
      );
      writeFileSync(join(repo, ".git/hooks/post-commit"), "");
      writeFileSync(join(repo, ".git/eval-checks/expected-post-commit"), "");
      const commits: string[] = [];
      for (const ticket of [41, 42]) {
        if (ticket === 42 && state === "different base")
          git(["cherry-pick", commits[0]!]);
        const worker = join(root, String(ticket));
        git(["worktree", "add", "-b", `feat/issue-${ticket}-worker`, worker]);
        mkdirSync(join(worker, "src"), { recursive: true });
        writeFileSync(
          join(worker, "src", ticket === 41 ? "versions.js" : "expenses.js"),
          ticket === 41
            ? "export const parseVersion = true;\n"
            : "export const normalizeExpenses = true;\n",
        );
        git(["add", "src"], worker);
        git(["commit", "-m", `ticket ${ticket}`], worker);
        commits.push(git(["rev-parse", "HEAD"], worker));
      }
      if (state !== "different base") git(["cherry-pick", commits[0]!]);
      if (state !== "missing dependency") git(["cherry-pick", commits[1]!]);
      const dependent = join(root, "43");
      git(["worktree", "add", "-b", "feat/issue-43-worker", dependent]);
      writeFileSync(
        join(dependent, "summary.js"),
        "export const summary = true;\n",
      );
      git(["add", "summary.js"], dependent);
      git(["commit", "-m", "ticket 43"], dependent);
      if (state !== "unlanded")
        git(["cherry-pick", git(["rev-parse", "HEAD"], dependent)]);
      addLaterRepair(state, root, git);
      const check = selected.checks.find(
        (c) =>
          c.name ===
          "distinct workers share the batch base and dependent sees landed prerequisites",
      );
      assert.ok(check);
      const result = spawnSync("bash", ["-c", check.run], {
        cwd: repo,
        encoding: "utf8",
      });
      assert.equal(
        result.status === 0,
        state === "valid" || state === "later repair",
        result.stdout + result.stderr,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
