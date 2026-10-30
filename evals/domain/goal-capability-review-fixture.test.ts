import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/file-backed-capability-routing.yaml",
  import.meta.url,
);
const correctNotes =
  "# Notes\nCapability routing survives file-backed goals.\n";
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const reviewAssets = {
  fixtureAssets: new URL(
    "../../plugins/orchestration/darrow-adaptive-goal/",
    import.meta.url,
  ),
  fixtureAssetFiles: ["backend/tests/evals/review_receipts.py"],
};

for (const scenario of [
  "correct",
  "wrong-content",
  "failed-check",
  "extra-file",
] as const) {
  test(`capability review supplies current evidence: ${scenario}`, async () => {
    const canonical = await readFixtureCase(source);
    if (scenario === "failed-check") {
      const files = canonical.fixture.commits?.[0]?.files;
      if (!files) throw new Error("canonical initial files are missing");
      files["check.sh"] = "#!/usr/bin/env bash\nexit 7\n";
    }
    const notes =
      scenario === "wrong-content" ? "# Notes\nWrong line.\n" : correctNotes;
    const result = await runFixtureChecks({
      ...reviewAssets,
      source,
      fixture: canonical.fixture,
      checks: [
        {
          name: "prepare current candidate",
          run: `printf '%s' ${quote(notes)} >NOTES.md${scenario === "extra-file" ? " && printf '%s\\n' 'Unrequested content' >unrelated.txt" : ""}`,
        },
        {
          name: "current independent evidence",
          run: "independent-review-protocol independent-review-skill-contract-v1",
          ...(scenario === "correct"
            ? {
                expect_regex:
                  "Acceptance evidence:[\\s\\S]+Standards evidence:[\\s\\S]+Check evidence: bash check.sh passed",
              }
            : { exit_code: 1 }),
        },
        {
          name: "review record matches acceptance",
          run: `${scenario === "correct" ? "test -e" : "test ! -e"} .fixture-state/independent-review-invocations`,
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
      "passed",
    ]);
  }, 20_000);
}
