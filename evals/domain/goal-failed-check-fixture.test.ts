import { expect, test } from "bun:test";
import {
  readFixtureCase,
  runFixtureChecks,
  type OracleCheck,
} from "./fixture-command";

const source = new URL(
  "../../plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/failed-check-blocks-publication.yaml",
  import.meta.url,
);
const localEdit: OracleCheck = {
  name: "local edit",
  run: "printf '%s\\n' '# Notes' 'Publication waits for green checks.' > NOTES.md",
};

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
    test(`${protocol} ${arg} performs no effects`, async () => {
      const result = await runFixtureChecks({
        source,
        checks: [
          localEdit,
          {
            name: "protocol usage",
            run: `${protocol} ${arg}`,
            exit_code: exitCode,
          },
          {
            name: "usage has no effects",
            run: 'test ! -e .git/fixture-state/gate-events && test ! -e .git/fixture-state/pull-requests && test "$(git rev-list --count HEAD)" -eq 1 && test -z "$(git --git-dir=.git/fixture-remote.git for-each-ref --format=\'%(refname)\' refs/heads)"',
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
    for (const protectedEffect of ["review", "commit", "publication"])
      expect(
        checks.find(
          (check) => check.name === `failed check prevents ${protectedEffect}`,
        )?.status,
      ).toBe(effect === protectedEffect ? "failed" : "passed");
  }, 20_000);
}
