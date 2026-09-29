import { expect, test } from "bun:test";
import { readFixtureCase, runFixtureChecks } from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/file-backed-capability-routing.yaml",
  import.meta.url,
);
const correctNotes =
  "# Notes\nCapability routing survives file-backed goals.\n";
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

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
          run: `${scenario === "correct" ? "test -e" : "test ! -e"} .git/fixture-state/independent-review-invocations`,
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

for (const scenario of ["current", "missing", "duplicate", "stale"] as const) {
  test(`capability review oracle diagnoses ${scenario} evidence`, async () => {
    const canonical = await readFixtureCase(source);
    const check = canonical.checks.find(
      (value) =>
        value.name ===
        "selected independent review remains composed before publication",
    );
    if (!check)
      throw new Error("canonical review composition oracle is missing");
    const record = ".git/fixture-state/independent-review-invocations";
    const alteration = {
      current: "true",
      missing: `: >${record}`,
      duplicate: `cat ${record} >.git/original-review && cat .git/original-review >>${record}`,
      stale: `printf '%s\\tclear\\tcomprehensive\\n' 'WORKTREE@stale' >${record}`,
    }[scenario];
    const diagnosis =
      scenario === "current"
        ? []
        : [
            {
              name: "rejection explains the selected evidence defect",
              run: check.run,
              exit_code: 1,
              expect_regex: {
                missing: "Missing independent review evidence",
                duplicate: "Expected one review record; observed 2",
                stale: "Expected reviewed target:",
              }[scenario],
            },
          ];
    const result = await runFixtureChecks({
      source,
      checks: [
        {
          name: "review and commit current candidate",
          run: `printf '%s' ${quote(correctNotes)} >NOTES.md && independent-review-protocol independent-review-skill-contract-v1 && create-commit-protocol NOTES.md "docs: add routing note" create-commit-skill-contract-v1`,
        },
        { name: "select evidence counterexample", run: alteration },
        check,
        ...diagnosis,
      ],
    });
    const passes = scenario === "current";
    expect(result.exitCode, result.diagnostic).toBe(passes ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(passes ? "passed" : "failed");
    expect(result.checks.slice(0, 2).map((value) => value.status)).toEqual([
      "passed",
      "passed",
    ]);
    expect(result.checks[2]?.status).toBe(passes ? "passed" : "failed");
    if (scenario !== "current") expect(result.checks[3]?.status).toBe("passed");
  }, 20_000);
}
