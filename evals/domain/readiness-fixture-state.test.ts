import { expect, test } from "bun:test";
import { runFixtureChecks } from "./fixture-command";

test("readiness recorder rejects an empty upstream result without consuming a slot", async () => {
  const result = await runFixtureChecks({
    source: new URL(
      "../../plugins/capability/darrow-readiness-gate/skills/assess-implementation-readiness/evals/caller-resolution-continuation.yaml",
      import.meta.url,
    ),
    runtimeConfig: new URL(
      "../sevro-extension/runtime-repository-skills.json",
      import.meta.url,
    ),
    checks: [
      {
        name: "empty input, retry, and two exact retained assessments",
        run: `set -eu
recorder=$(command -v capture-readiness)
for shell in bash /bin/bash; do
  rm -f .fixture-state/readiness-*.json .fixture-state/config-at-*.json
  status=0
  "$shell" "$recorder" </dev/null 2>.fixture-state/empty-error || status=$?
  test "$status" -eq 2
  grep -F 'assessment input is empty' .fixture-state/empty-error >/dev/null
  test ! -e .fixture-state/readiness-first.json
  test ! -e .fixture-state/config-at-first.json
  printf '%s\\n' '{"verdict":"needs-decision"}' | "$shell" "$recorder"
  printf '%s\\n' '{"verdict":"ready"}' | "$shell" "$recorder"
  test "$(cat .fixture-state/readiness-first.json)" = '{"verdict":"needs-decision"}'
  test "$(cat .fixture-state/readiness-resolved.json)" = '{"verdict":"ready"}'
  cmp config.json .fixture-state/config-at-first.json
  cmp config.json .fixture-state/config-at-resolved.json
  test ! -e .git/readiness-first.json
done
test -z "$(git status --porcelain --untracked-files=all)"`,
      },
      {
        name: "declared private temporary storage supports a shell heredoc",
        run: `test -d "$TMPDIR"
/bin/zsh -c 'cat <<EOF
private temporary storage works
EOF'`,
        expect_exact: "private temporary storage works",
      },
    ],
  });
  expect(result.value.execution.status, result.diagnostic).toBe("completed");
  expect(result.value.grading.status, result.diagnostic).toBe("completed");
  expect(result.exitCode, result.diagnostic).toBe(0);
}, 120_000);
