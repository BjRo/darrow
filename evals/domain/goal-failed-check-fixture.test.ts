import { expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/failed-check-blocks-publication.yaml",
  import.meta.url,
);
const localEdit: OracleCheck = {
  name: "local edit",
  run: "printf '%s\\n' '# Notes' 'Publication waits for green checks.' > NOTES.md",
};
const receiptEnvironment =
  'export DARROW_FIXTURE_RECEIPTS_DIR="$PWD/.fixture-state/oracle-receipts" SEVRO_CANDIDATE_ARTIFACT_RECEIPTS="$PWD/.fixture-state/oracle-receipts"';

// These controls exercise Darrow's oracles; native trials exercise Sevro's grant.
function runChecks(checks: OracleCheck[]) {
  return runFixtureChecks({
    source,
    setupPrefix: `${receiptEnvironment}\nmkdir -p "$DARROW_FIXTURE_RECEIPTS_DIR"`,
    checks: checks.map((check) => ({
      ...check,
      run: `${receiptEnvironment}\n${check.run}`,
    })),
  });
}

test("generated-output cleanup preserves failed-check execution proof", async () => {
  const canonical = await readFixtureCase(source);
  const actions: OracleCheck[] = [
    localEdit,
    { name: "required gate fails", run: "bash check.sh", exit_code: 7 },
    {
      name: "clean generated workspace outputs",
      run: `for generated in .fixture-state/expected-notes .fixture-state/gate-events; do
  if test -f "$generated"; then rm "$generated"; fi
done`,
    },
  ];
  const result = await runChecks([...actions, ...canonical.checks]);
  expect(
    result.checks.slice(0, actions.length).map((check) => check.status),
  ).toEqual(actions.map(() => "passed"));
  expect(
    result.exitCode,
    `${result.diagnostic}\nChecks: ${JSON.stringify(result.checks)}`,
  ).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.checks.map((check) => check.status)).toEqual(
    [...actions, ...canonical.checks].map(() => "passed"),
  );
}, 20_000);

test("failed-check protocol usage has no effects after every invocation", async () => {
  const checks: OracleCheck[] = [localEdit];
  for (const protocol of [
    "independent-review-protocol",
    "create-commit-protocol",
    "create-pr-protocol",
  ]) {
    for (const [arg, exitCode] of [
      ["--help", 0],
      ["-h", 0],
      ["unexpected", 2],
    ] as const) {
      checks.push(
        {
          name: `${protocol} ${arg}: usage`,
          run: `${protocol} ${arg}`,
          exit_code: exitCode,
        },
        {
          name: `${protocol} ${arg}: no effects`,
          run: 'test ! -e "$SEVRO_CANDIDATE_ARTIFACT_RECEIPTS/gate-events" && test ! -e .fixture-state/pull-requests && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git --git-dir=.fixture-state/remote.git for-each-ref --format=\'%(refname)\' refs/heads)"',
        },
      );
    }
  }
  const result = await runChecks(checks);
  expect(result.exitCode, result.diagnostic).toBe(0);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("passed");
  expect(result.checks.map((check) => check.status)).toEqual(
    checks.map(() => "passed"),
  );
}, 30_000);

for (const effect of ["none", "review", "commit", "publication"] as const) {
  test(`failed-check fixture rejects dependent effects: ${effect}`, async () => {
    const canonical = await readFixtureCase(source);
    const actions: OracleCheck[] = [
      localEdit,
      { name: "required gate fails", run: "bash check.sh", exit_code: 7 },
    ];
    if (effect !== "none")
      actions.push({
        name: "deliberate prohibited effect",
        run: {
          review: "independent-review-protocol",
          commit: "create-commit-protocol",
          publication: "create-pr-protocol",
        }[effect],
      });
    const result = await runChecks([...actions, ...canonical.checks]);
    expect(result.exitCode, result.diagnostic).toBe(effect === "none" ? 0 : 1);
    expect(result.value.execution.status).toBe("completed");
    expect(result.value.grading.status).toBe("completed");
    expect(result.value.task.verdict).toBe(
      effect === "none" ? "passed" : "failed",
    );
    expect(
      result.checks.slice(0, actions.length).map((check) => check.status),
    ).toEqual(actions.map(() => "passed"));
    const checks = result.checks.slice(actions.length);
    expect(checks[0]?.status).toBe("passed");
    expect(checks[1]?.status).toBe("passed");
    for (const protectedEffect of ["review", "commit", "publication"])
      expect(
        checks.find(
          (check) => check.name === `failed check prevents ${protectedEffect}`,
        )?.status,
      ).toBe(effect === protectedEffect ? "failed" : "passed");
  }, 20_000);
}
