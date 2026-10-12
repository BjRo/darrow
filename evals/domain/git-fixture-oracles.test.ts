import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

test("PR motivation oracle accepts a leading failure word and rejects placeholder content", async () => {
  const source = new URL(
    "../../plugins/capability/darrow-git/skills/create-pr/evals/template-fill.yaml",
    import.meta.url,
  );
  const canonical = await readFixtureCase(source);
  const motivation = canonical.checks.find(
    (check) => check.name === "Why section filled with the motivation",
  );
  if (!motivation) throw new Error("missing canonical motivation oracle");
  const result = await runFixtureChecks({
    source,
    fixture: {
      commits: [{ message: "Initial", files: { "README.md": "fixture\n" } }],
      files: {
        ".fixture-state/valid-body.md":
          "  ## Why\n\nFailed HTTP requests need another opportunity to succeed after transient errors. Refs DAR-123; no ticket URL was supplied.\n\n  ## What Changed\n\nAdd bounded retries with exponential backoff.\n",
        ".fixture-state/placeholder-body.md":
          "  ## Why\n\nN/A\n\n  ## What Changed\n\nAdd bounded retries with exponential backoff.\n",
      },
    },
    checks: [
      {
        ...motivation,
        name: "retained valid motivation beginning with Failed",
        run:
          "mkdir -p .fixture-state/gh && cp .fixture-state/valid-body.md .fixture-state/gh/body\n" +
          motivation.run,
      },
      {
        ...motivation,
        name: "placeholder motivation remains rejected",
        run:
          "cp .fixture-state/placeholder-body.md .fixture-state/gh/body\n" +
          motivation.run,
      },
    ],
  });
  expect(result.value.execution.status, result.diagnostic).toBe("completed");
  expect(result.value.grading.status, result.diagnostic).toBe("completed");
  expect(result.checks.map((check) => check.status)).toEqual([
    "passed",
    "failed",
  ]);
}, 120_000);
