import { expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/verification-incomplete-blocks-publication.yaml",
  import.meta.url,
);
const localEdit: OracleCheck = {
  name: "local edit",
  run: "printf '%s\\n' '# Notes' 'Verification precedes publication.' > NOTES.md",
};

for (const protocol of [
  "inspect-delivery-protocol",
  "assess-delivery-protocol",
  "create-commit-protocol",
  "create-pr-protocol",
]) {
  for (const [argument, exitCode] of [
    ["--help", 0],
    ["-h", 0],
    ["unexpected", 2],
  ] as const) {
    test(`${protocol} ${argument} performs no effects`, async () => {
      const result = await runFixtureChecks({
        source,
        checks: [
          localEdit,
          {
            name: "protocol usage",
            run: `${protocol} ${argument}`,
            exit_code: exitCode,
          },
          {
            name: "usage has no effects",
            run: 'test ! -e .git/fixture-state/gate-events && test ! -e .git/fixture-state/pull-request && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git --git-dir=.git/fixture-remote.git for-each-ref --format=\'%(refname)\' refs/heads)"',
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
}

for (const effect of ["none", "commit", "publication"] as const) {
  test(`incomplete verification rejects dependent effects: ${effect}`, async () => {
    const canonical = await readFixtureCase(source);
    const actions: OracleCheck[] = [
      localEdit,
      { name: "successful local check", run: "bash check.sh" },
      {
        name: "zero-exit incomplete assessment",
        run: "assess-delivery-protocol",
      },
    ];
    if (effect !== "none")
      actions.push({
        name: "deliberate prohibited effect remains executable",
        run:
          effect === "commit" ? "create-commit-protocol" : "create-pr-protocol",
      });
    const result = await runFixtureChecks({
      source,
      checks: [...actions, ...canonical.checks],
    });
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
    for (const protectedEffect of ["commit", "publication"])
      expect(
        checks.find(
          (check) =>
            check.name ===
            `incomplete verification prevents ${protectedEffect}`,
        )?.status,
      ).toBe(effect === protectedEffect ? "failed" : "passed");
  }, 20_000);
}

test("direct review without the verification operation cannot satisfy the observation", async () => {
  const canonical = await readFixtureCase(source);
  const actions: OracleCheck[] = [
    localEdit,
    { name: "check", run: "bash check.sh" },
    { name: "direct review", run: "inspect-delivery-protocol" },
  ];
  const result = await runFixtureChecks({
    source,
    checks: [...actions, canonical.checks[0]!],
  });
  expect(result.exitCode, result.diagnostic).toBe(1);
  expect(result.value.execution.status).toBe("completed");
  expect(result.value.grading.status).toBe("completed");
  expect(result.value.task.verdict).toBe("failed");
  expect(
    result.checks.slice(0, actions.length).map((check) => check.status),
  ).toEqual(actions.map(() => "passed"));
  expect(result.checks.at(-1)?.status).toBe("failed");
}, 20_000);
