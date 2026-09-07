#!/usr/bin/env bash
# Deterministic coverage for review check evidence capture.
set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
CHECK=$SCRIPT_DIR/review-check
SHELL_UNDER_TEST=${BASH:-bash}
TAB=$(printf '\t')
FAILURES=0

temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template=/darrow-review-check.XXXXXX ;;
  */) temp_template=${temp_parent}darrow-review-check.XXXXXX ;;
  *) temp_template=${temp_parent}/darrow-review-check.XXXXXX ;;
esac
WORK_DIR=$(mktemp -d "$temp_template") || exit 1
WORK_DIR=$(cd "$WORK_DIR" && pwd -P) || exit 1
trap 'rm -rf "$WORK_DIR"' EXIT

fail() {
  printf '  FAIL: %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

contains() {
  name=$1
  needle=$2
  haystack=$3
  case "$haystack" in
    *"$needle"*) printf '  ok: %s\n' "$name" ;;
    *) fail "$name (missing: $needle)" ;;
  esac
}

equal() {
  name=$1
  expected=$2
  actual=$3
  if [ "$actual" = "$expected" ]; then
    printf '  ok: %s\n' "$name"
  else
    fail "$name (expected $expected, got $actual)"
  fi
}

repo=$WORK_DIR/repo
mkdir -p "$repo"
git -C "$repo" init -qb main
git -C "$repo" config user.name test
git -C "$repo" config user.email test@example.invalid
printf '#!/usr/bin/env bash\nprintf "seeded failure\\n"\nexit 1\n' >"$repo/check.sh"
mkdir -p "$repo/.git/darrow-review.test"

echo "failed check"
failed_record=$repo/.git/darrow-review.test/failed.tsv
out=$(cd "$repo" && "$SHELL_UNDER_TEST" "$CHECK" run --output "$failed_record" --command 'bash check.sh')
status=$?
equal "capture succeeds when the check fails" 0 "$status"
equal "reports the absolute record path" "check_record${TAB}$failed_record" "$out"
record=$(cat "$failed_record")
contains "retains the exact failing check row" "check${TAB}bash check.sh${TAB}applicable${TAB}fail${TAB}exited 1: seeded failure" "$record"
contains "retains the real exit code" "exit_code${TAB}1" "$record"

echo "passing check"
passing_record=$repo/.git/darrow-review.test/passing.tsv
out=$(cd "$repo" && "$SHELL_UNDER_TEST" "$CHECK" run --output "$passing_record" --command 'printf "ok\n"')
status=$?
equal "capture succeeds when the check passes" 0 "$status"
record=$(cat "$passing_record")
contains "retains the exact passing check row" "check${TAB}printf \"ok\n\"${TAB}applicable${TAB}pass${TAB}exited 0: ok" "$record"
contains "retains the zero exit code" "exit_code${TAB}0" "$record"

echo "unavailable check"
blocked_record=$repo/.git/darrow-review.test/blocked.tsv
out=$(cd "$repo" && "$SHELL_UNDER_TEST" "$CHECK" run --output "$blocked_record" --command 'darrow-command-that-does-not-exist')
status=$?
equal "capture succeeds when the command is unavailable" 0 "$status"
record=$(cat "$blocked_record")
contains "classifies an unavailable command as blocked" "check${TAB}darrow-command-that-does-not-exist${TAB}applicable${TAB}blocked${TAB}exited 127:" "$record"
contains "retains the unavailable exit code" "exit_code${TAB}127" "$record"

echo "output boundary"
set +e
out=$(cd "$repo" && "$SHELL_UNDER_TEST" "$CHECK" run --output "$WORK_DIR/outside.tsv" --command 'true' 2>&1)
status=$?
set -e
equal "refuses output outside the Git directory" 2 "$status"
contains "explains the output boundary" "output must be beneath the repository Git directory" "$out"

if [ "$FAILURES" -gt 0 ]; then
  printf '\n%d test(s) failed\n' "$FAILURES"
  exit 1
fi

printf '\nall review check tests passed\n'
