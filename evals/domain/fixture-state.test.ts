import { expect, test } from "bun:test";
import { runFixtureChecks } from "./fixture-command";

test("Darrow prepares fixture state before canonical setup", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/failed-check-blocks-publication.yaml",
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
