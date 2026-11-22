import { expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/native-git-commit-composition.yaml",
  import.meta.url,
);
const notes = "# Notes\nNative Git commits compose.\n";
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const reviewAssets = {
  fixtureAssets: new URL(
    "../../plugins/orchestration/darrow-adaptive-goal/",
    import.meta.url,
  ),
  fixtureAssetFiles: ["backend/tests/evals/review_receipts.py"],
};
function publicationActions(): OracleCheck[] {
  return [
    {
      name: "write requested note",
      run: `printf '%s' ${quote(notes)} >NOTES.md`,
    },
    { name: "current check", run: "bash check.sh" },
    { name: "actual review", run: "independent-review-protocol" },
    {
      name: "native commit reports hook failure",
      run: "git add -- NOTES.md && git commit -m 'docs: add native-commit note'",
      exit_code: 1,
    },
    {
      name: "native Git retries after the hook-directed check",
      run: "grep -Fx 'Native Git commits compose.' NOTES.md >/dev/null && git add -- NOTES.md && git commit -m 'docs: add native-commit note'",
    },
    {
      name: "publish and inspect fixture PR",
      run: "git push -u origin HEAD && gh pr create --title 'Add note' --body 'Add requested note' --base main --head fix/native-git-commit-composition && gh repo view fixture/repository && gh pr list --repo fixture/repository",
    },
  ];
}

test("native commit composes after read-only reviewer usage", async () => {
  const canonical = await readFixtureCase(source);
  const usage: OracleCheck[] = [];
  for (const [arg, exitCode] of [
    ["--help", 0],
    ["-h", 0],
    ["unexpected", 2],
  ] as const) {
    usage.push(
      {
        name: `reviewer usage: ${arg}`,
        run: `independent-review-protocol ${arg}`,
        exit_code: exitCode,
      },
      {
        name: `${arg} has no assessment or mutation`,
        run: 'test ! -e .fixture-state/composition-events && test ! -e .fixture-state/pull-requests && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git status --porcelain)"',
      },
    );
  }
  // Receipt counterexamples share the dedicated fixture-state matrix.
  const checks = [...usage, ...publicationActions(), ...canonical.checks];
  const result = await runFixtureChecks({
    ...reviewAssets,
    source,
    fixture: canonical.fixture,
    checks,
  });
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((entry) => entry.status)).toEqual(
    checks.map(() => "passed"),
  );
}, 30_000);

for (const scenario of [
  "correct",
  "wrong-content",
  "failed-check",
  "extra-file",
] as const) {
  test(`native commit reviewer checks current acceptance: ${scenario}`, async () => {
    const canonical = await readFixtureCase(source);
    if (scenario === "failed-check") {
      const files = canonical.fixture.commits?.[0]?.files;
      if (!files) throw new Error("canonical initial files are missing");
      files["check.sh"] = "#!/usr/bin/env bash\nexit 7\n";
    }
    const contents =
      scenario === "wrong-content" ? "# Notes\nWrong line.\n" : notes;
    const recorded = `awk -F '\\t' '$1 == "review" { found = 1 } END { exit !found }' .fixture-state/composition-events`;
    const result = await runFixtureChecks({
      ...reviewAssets,
      source,
      fixture: canonical.fixture,
      checks: [
        {
          name: "prepare current candidate",
          run: `printf '%s' ${quote(contents)} >NOTES.md${scenario === "extra-file" ? " && printf '%s\\n' 'Unrequested content' >unrelated.txt" : ""}`,
        },
        {
          name: "current independent evidence",
          run: "independent-review-protocol",
          ...(scenario === "correct"
            ? {
                expect_regex:
                  "Acceptance evidence:[\\s\\S]+Standards evidence:[\\s\\S]+Check evidence: bash check.sh passed",
              }
            : { exit_code: 1 }),
        },
        {
          name: "review record matches acceptance",
          run:
            scenario === "correct"
              ? recorded
              : `if test -f .fixture-state/composition-events; then ! ${recorded}; fi`,
        },
      ],
    });
    expect(result.exitCode, result.diagnostic).toBe(0);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe("passed");
    expect(result.checks.map((entry) => entry.status)).toEqual([
      "passed",
      "passed",
      "passed",
    ]);
  }, 30_000);
}
