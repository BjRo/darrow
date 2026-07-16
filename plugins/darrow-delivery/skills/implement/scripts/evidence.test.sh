#!/usr/bin/env bash
set -euo pipefail

SCRIPT=$(cd "$(dirname "$0")" && pwd)/evidence.sh
PASS=0
FAIL=0

check() {
  local name=$1 expected=$2 actual=$3
  if [[ "$expected" == "$actual" ]]; then
    PASS=$((PASS + 1))
  else
    echo "FAIL: $name (expected '$expected', got '$actual')" >&2
    FAIL=$((FAIL + 1))
  fi
}

repo=$(mktemp -d "${TMPDIR:-/tmp}/darrow-evidence-test.XXXXXX")
trap 'rm -rf "$repo"' EXIT
git -C "$repo" init -q
git -C "$repo" config user.email test@example.com
git -C "$repo" config user.name Test
printf 'base\n' >"$repo/base.txt"
git -C "$repo" add base.txt
git -C "$repo" commit -qm base
cd "$repo"

evidence="$repo/.darrow-attempts/one"
"$BASH" "$SCRIPT" run "$evidence" red --expected 'No such file' -- grep -F wanted behavior.txt >/dev/null
check "red nonzero recorded" "2" "$(sed -n 's/^exit_status=//p' "$evidence/red.meta")"

printf 'wanted\n' >behavior.txt
"$BASH" "$SCRIPT" run "$evidence" green -- grep -F wanted behavior.txt >/dev/null
"$BASH" "$SCRIPT" run "$evidence" regression -- sh -c 'test -f base.txt && test -f behavior.txt' >/dev/null
check "complete sequence validates" "0" "$("$BASH" "$SCRIPT" validate "$evidence" >/dev/null 2>&1; echo $?)"
check "focused commands identical" "$(sed -n 's/^command=//p' "$evidence/red.meta")" "$(sed -n 's/^command=//p' "$evidence/green.meta")"

set +e
immutable=$("$BASH" "$SCRIPT" run "$evidence" red --expected wanted -- false 2>&1)
immutable_status=$?
set -e
check "immutable refusal status" "2" "$immutable_status"
case "$immutable" in *"already exists and is immutable"*) check "immutable refusal message" yes yes ;; *) check "immutable refusal message" yes no ;; esac

bad="$repo/.darrow-attempts/bad"
set +e
bad_output=$("$BASH" "$SCRIPT" run "$bad" red --expected behavioral -- sh -c 'echo dependency-missing >&2; exit 1' 2>&1)
bad_status=$?
set -e
check "unrelated red refused" "2" "$bad_status"
case "$bad_output" in *"did not contain expected behavioral failure"*) check "red reason message" yes yes ;; *) check "red reason message" yes no ;; esac

tool_missing="$repo/.darrow-attempts/tool-missing"
set +e
tool_missing_output=$("$BASH" "$SCRIPT" run "$tool_missing" red --expected 'dependency missing' -- sh -c 'echo dependency missing >&2; exit 127' 2>&1)
tool_missing_status=$?
set -e
check "missing tool red refused" "2" "$tool_missing_status"
check "missing tool red not persisted" "no" "$([[ -e "$tool_missing/red.meta" ]] && echo yes || echo no)"
case "$tool_missing_output" in *"not behavioral evidence"*) check "missing tool message" yes yes ;; *) check "missing tool message" yes no ;; esac

missing="$repo/.darrow-attempts/missing"
"$BASH" "$SCRIPT" run "$missing" red --expected expected-missing -- sh -c 'echo expected-missing; exit 1' >/dev/null
set +e
missing_output=$("$BASH" "$SCRIPT" validate "$missing" 2>&1)
missing_status=$?
set -e
check "missing sequence refused" "2" "$missing_status"
case "$missing_output" in *"missing readable evidence"*) check "missing message" yes yes ;; *) check "missing message" yes no ;; esac

tampered="$repo/.darrow-attempts/tampered"
cp -R "$evidence" "$tampered"
chmod 0644 "$tampered/red.stdout"
printf 'forged\n' >"$tampered/red.stdout"
set +e
tampered_output=$("$BASH" "$SCRIPT" validate "$tampered" 2>&1)
tampered_status=$?
set -e
check "tampered output refused" "2" "$tampered_status"
case "$tampered_output" in *"output reference escapes"*|*"changed after capture"*) check "tamper message" yes yes ;; *) check "tamper message" yes no ;; esac

echo "$PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
