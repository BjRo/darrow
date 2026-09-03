#!/usr/bin/env bash
set -u

SCRIPT="$(cd "$(dirname "$0")" 2>/dev/null && pwd -P)/verify-shell-tests"
TAB=$(printf '\t')
FAILURES=0
TEMPS=()

cleanup() {
  local directory
  for directory in "${TEMPS[@]}"; do
    rm -rf "$directory"
  done
}
trap cleanup EXIT HUP INT TERM

pass() {
  printf '  ok: %s\n' "$1"
}

fail() {
  printf '  FAIL: %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

expect_status() {
  local name=$1 expected=$2 actual=$3
  if [ "$actual" -eq "$expected" ]; then
    pass "$name"
  else
    fail "$name (expected $expected, got $actual)"
  fi
}

expect_contains() {
  local name=$1 needle=$2 value=$3
  case "$value" in
    *"$needle"*) pass "$name" ;;
    *) fail "$name (missing: $needle)" ;;
  esac
}

make_interpreter() {
  local path=$1 major=$2 minor=$3 version=$4 label=$5
  printf '%s\n' \
    '#!/bin/sh' \
    "if [ \"\${1:-}\" = -c ]; then" \
    "  printf '%s\\t%s\\t%s\\n' '$major' '$minor' '$version'" \
    '  exit 0' \
    'fi' \
    "printf '%s\\n' '$label' >>\"\$RUN_LOG\"" \
    "exec /bin/bash \"\$@\"" \
    >"$path"
  chmod +x "$path"
}

temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template='/darrow shell matrix.XXXXXX' ;;
  */) temp_template="${temp_parent}darrow shell matrix.XXXXXX" ;;
  *) temp_template="${temp_parent}/darrow shell matrix.XXXXXX" ;;
esac
ROOT=$(mktemp -d "$temp_template") || exit 1
ROOT=$(cd "$ROOT" 2>/dev/null && pwd -P) || exit 1
TEMPS[${#TEMPS[@]}]=$ROOT
RUN_LOG=$ROOT/run.log
export RUN_LOG

BASH_3=$ROOT/bash-3
BASH_5=$ROOT/bash-5
make_interpreter "$BASH_3" 3 2 3.2.57-test bash-3
make_interpreter "$BASH_5" 5 2 5.2.0-test bash-5

PASS_TEST="$ROOT/passing test.sh"
FAIL_TEST="$ROOT/failing test.sh"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' >"$PASS_TEST"
printf '%s\n' '#!/usr/bin/env bash' 'exit 9' >"$FAIL_TEST"

printf '%s\n' 'complete version matrix'
: >"$RUN_LOG"
set +e
output=$(bash "$SCRIPT" --shell "$BASH_3" --shell "$BASH_5" -- "$PASS_TEST" 2>&1)
status=$?
set -e
expect_status "complete matrix succeeds" 0 "$status"
expect_contains "reports stable format" "format${TAB}darrow-shell-test-matrix-v1" "$output"
expect_contains "identifies Bash 3.2" "interpreter${TAB}bash-3.2${TAB}available${TAB}$BASH_3${TAB}3.2.57-test" "$output"
expect_contains "identifies Bash 5" "interpreter${TAB}bash-5${TAB}available${TAB}$BASH_5${TAB}5.2.0-test" "$output"
expect_contains "reports complete matrix" "matrix_status${TAB}complete" "$output"
run_count=$(wc -l <"$RUN_LOG" | tr -d ' ')
expect_status "runs once under each distinct target" 2 "$run_count"

printf '%s\n' 'duplicate interpreter evidence'
: >"$RUN_LOG"
set +e
output=$(bash "$SCRIPT" --shell "$BASH_3" --shell "$BASH_3" --shell "$BASH_5" -- "$PASS_TEST" 2>&1)
status=$?
set -e
expect_status "duplicate matrix succeeds" 0 "$status"
run_count=$(wc -l <"$RUN_LOG" | tr -d ' ')
expect_status "equivalent interpreter is deduplicated" 2 "$run_count"

printf '%s\n' 'unavailable required version'
: >"$RUN_LOG"
set +e
output=$(bash "$SCRIPT" --shell "$BASH_3" -- "$PASS_TEST" 2>&1)
status=$?
set -e
expect_status "incomplete matrix has distinct status" 3 "$status"
expect_contains "reports Bash 5 unavailable" "interpreter${TAB}bash-5${TAB}unavailable" "$output"
expect_contains "reports unverified matrix" "matrix_status${TAB}unverified" "$output"

printf '%s\n' 'test failure'
: >"$RUN_LOG"
set +e
output=$(bash "$SCRIPT" --shell "$BASH_3" --shell "$BASH_5" -- "$FAIL_TEST" 2>&1)
status=$?
set -e
expect_status "test failure fails the matrix" 1 "$status"
expect_contains "reports failed matrix" "matrix_status${TAB}failed" "$output"

printf '%s\n' 'invalid input'
set +e
output=$(bash "$SCRIPT" --shell "$ROOT/missing-bash" -- "$PASS_TEST" 2>&1)
status=$?
set -e
expect_status "missing explicit interpreter fails closed" 2 "$status"
expect_contains "missing interpreter is identified" "$ROOT/missing-bash" "$output"

if [ "$FAILURES" -ne 0 ]; then
  printf '%s test(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf '%s\n' 'all verify-shell-tests tests passed'
