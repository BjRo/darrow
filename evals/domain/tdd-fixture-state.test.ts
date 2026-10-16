import { expect, test } from "bun:test";
import { runFixtureChecks } from "./fixture-command";

const runtimeConfig = new URL(
  "../sevro-extension/runtime-repository-skills.json",
  import.meta.url,
);

for (const [name, expectedExit] of [
  ["integration-test-intent", 0],
  ["meaningful-red", 1],
  ["product-value-bug-fix", 0],
  ["public-red-green", 0],
  ["vertical-slices", 0],
] as const) {
  test(`TDD ${name} retains telemetry outside Git metadata`, async () => {
    const result = await runFixtureChecks({
      source: new URL(
        `../../plugins/capability/darrow-tdd/skills/tdd/evals/${name}.yaml`,
        import.meta.url,
      ),
      runtimeConfig,
      checks: [
        {
          name: "both supported shell commands preserve the baseline outcome",
          run: `for shell in bash /bin/bash; do
  status=0
  "$shell" test.sh >.fixture-state/baseline-output 2>&1 || status=$?
  test "$status" -eq ${expectedExit} || exit 1
  test -s .fixture-state/test-output || exit 1
done
test "$(wc -l <.fixture-state/tdd-trace | tr -d ' ')" -eq 2
test ! -e .git/tdd-trace && test ! -e .git/test-output
! grep -E 'Operation not permitted|Permission denied' .fixture-state/baseline-output`,
        },
        {
          name: "telemetry changes neither product files nor the wrapper",
          run: "git status --porcelain --untracked-files=all",
          expect_exact: "",
        },
      ],
    });
    expect(result.value.execution.status, result.diagnostic).toBe("completed");
    expect(result.value.grading.status, result.diagnostic).toBe("completed");
    expect(result.exitCode, result.diagnostic).toBe(0);
  }, 120_000);
}

test("TDD invalid-red fixture records the original failures without Git writes", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/capability/darrow-tdd/skills/tdd/evals/invalid-red-causes.yaml",
      import.meta.url,
    ),
    runtimeConfig,
    checks: [
      {
        name: "syntax, fixture, and environment failures remain distinct",
        run: `for shell in bash /bin/bash; do
  for mode in syntax fixture environment; do
    status=0
    "$shell" test.sh "$mode" >".fixture-state/$mode-output" 2>&1 || status=$?
    case "$mode" in
      syntax) test "$status" -eq 1 && grep -F SyntaxError ".fixture-state/$mode-output" >/dev/null ;;
      fixture) test "$status" -eq 1 && grep -F 'ENOENT: missing fixture' ".fixture-state/$mode-output" >/dev/null ;;
      environment) test "$status" -eq 127 && grep -F 'command not found: fixture-test-runner' ".fixture-state/$mode-output" >/dev/null ;;
    esac || exit 1
    ! grep -E 'Operation not permitted|Permission denied' ".fixture-state/$mode-output" || exit 1
  done
done
test "$(wc -l <.fixture-state/preflight-trace | tr -d ' ')" -eq 6
test ! -e .git/preflight-trace`,
      },
      {
        name: "diagnostic receipts do not change product state",
        run: "git status --porcelain --untracked-files=all",
        expect_exact: "",
      },
    ],
  });
  expect(result.value.execution.status, result.diagnostic).toBe("completed");
  expect(result.value.grading.status, result.diagnostic).toBe("completed");
  expect(result.exitCode, result.diagnostic).toBe(0);
}, 120_000);
