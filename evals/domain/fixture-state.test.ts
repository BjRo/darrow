import { expect, test } from "bun:test";
import { runFixtureChecks } from "./fixture-command";

test("Darrow prepares fixture state before canonical setup", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/failed-check-blocks-publication.yaml",
      import.meta.url,
    ),
    setupPrefix: "test -d .git/fixture-state || exit 9",
    checks: [
      { name: "fixture state exists", run: "test -d .git/fixture-state" },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks[0]?.status).toBe("passed");
}, 20_000);

test("Darrow setup resolves system Git before declared wrappers", async () => {
  const git = Bun.which("git");
  if (!git) throw new Error("system Git is unavailable");
  const quoted = `'${git.replaceAll("'", "'\\''")}'`;
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/file-backed-capability-routing.yaml",
      import.meta.url,
    ),
    setupPrefix:
      'case "$(command -v git)" in */.git/fixture-bin/*) exit 9 ;; esac',
    checks: [
      {
        name: "setup bound system Git",
        run: `test "$(cat .git/real-git-path)" = ${quoted}`,
      },
      {
        name: "declared Git wrapper remains usable during grading",
        run: 'case "$(command -v git)" in */.git/fixture-bin/git) git rev-parse --verify HEAD >/dev/null ;; *) exit 1 ;; esac',
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
  ]);
}, 20_000);

test("Darrow prepares state for a canonical fixture without setup", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/capability/darrow-git/skills/create-commit/evals/clean-tree.yaml",
      import.meta.url,
    ),
    checks: [
      { name: "fixture state exists", run: "test -d .git/fixture-state" },
      {
        name: "history is unchanged",
        run: 'test "$(git rev-list --count HEAD)" -eq 1',
      },
    ],
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "passed",
  ]);
}, 20_000);
