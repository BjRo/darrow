#!/usr/bin/env bash
# Preserve the original comprehensive finding set through the first follow-up.
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
RESULT=$SCRIPT_DIR/review-result
TEMP_ROOT=$(mktemp -d)
trap 'rm -rf "$TEMP_ROOT"' EXIT
original=$TEMP_ROOT/original.tsv
verification=$TEMP_ROOT/verification.tsv
cat >"$original" <<'EOF'
format	darrow-review-result-v1
base	base
target	WORKTREE@base+original
changed_file	/workspace/src/config.js
standards	pass
standards_source	heuristic:example
spec	fail
spec_source	user requirement
finding	standards	low	advisory	/workspace/src/config.js:1	heuristic:example	Keep literal C:\path and full advisory evidence
finding	spec	high	blocking	/workspace/src/config.js:2	user requirement	RETRY_COUNT is 0; it must remain 3
check	bash check.sh	applicable	pass	exited 0
verdict	fail
risk	none
next_action	return findings to enclosing goal
EOF
cat >"$TEMP_ROOT/expected" <<'EOF'
original_finding	standards:1:WORKTREE@base+original	standards	1	low	advisory	/workspace/src/config.js:1	heuristic:example	Keep literal C:\path and full advisory evidence
original_finding	spec:2:WORKTREE@base+original	spec	2	high	blocking	/workspace/src/config.js:2	user requirement	RETRY_COUNT is 0; it must remain 3
EOF
"$BASH" "$RESULT" original-findings "$original" >"$TEMP_ROOT/actual"
cmp "$TEMP_ROOT/expected" "$TEMP_ROOT/actual"
{
  printf 'format\tdarrow-review-verification-v1\n'
  printf 'original_target\tWORKTREE@base+original\n'
  printf 'prior_target\tWORKTREE@base+original\n'
  printf 'current_target\tWORKTREE@base+repair\n'
  printf 'previous_verification\tnone\tnone\n'
  cat "$TEMP_ROOT/actual"
  printf 'attempt\tspec:2:WORKTREE@base+original\tresolved\tresolved\tNow 3\n'
  printf 'check\tbash check.sh\tapplicable\tpass\texited 0\n'
  printf 'outcome\tclear\n'
  printf 'next_action\treturn control to enclosing goal\n'
} >"$verification"
"$BASH" "$RESULT" validate-original "$original" "$verification"

expect_refusal() {
  # Each counterexample is internally valid; only its original binding is wrong.
  "$BASH" "$RESULT" validate-verification "$1" >/dev/null
  if "$BASH" "$RESULT" validate-original "$original" "$1" >"$TEMP_ROOT/refusal" 2>&1; then
    printf 'FAIL: accepted %s\n' "$2" >&2
    exit 1
  fi
  printf 'ok: rejects %s\n' "$2"
}
for field in 5 6 7 8 9; do
  awk -F '\t' -v field="$field" 'BEGIN { OFS="\t" }
    $1 == "original_finding" && field == 6 && $3 == "spec" { $6 = "advisory" }
    $1 == "original_finding" && field != 6 && $3 == "standards" {
      $field = field == 5 ? "medium" : "changed"
    }
    { print }' "$verification" >"$TEMP_ROOT/changed"
  expect_refusal "$TEMP_ROOT/changed" "changed immutable field $field"
done
awk -F '\t' '$1 != "original_finding" || $3 != "standards"' "$verification" >"$TEMP_ROOT/omitted"
expect_refusal "$TEMP_ROOT/omitted" 'omitted advisory'
awk -F '\t' 'BEGIN { OFS="\t" }
  $1 == "original_finding" { $4 = 3 - $4; $2 = $3 ":" $4 ":WORKTREE@base+original" }
  $1 == "attempt" { $2 = "spec:1:WORKTREE@base+original" }
  { print }' "$verification" >"$TEMP_ROOT/renumbered"
expect_refusal "$TEMP_ROOT/renumbered" 'renumbered cross-axis identities'
awk -F '\t' 'BEGIN { OFS="\t" }
  $1 == "original_target" || $1 == "prior_target" { $2 = "wrong" }
  $1 == "original_finding" { $2 = $3 ":" $4 ":wrong" }
  $1 == "attempt" { $2 = "spec:2:wrong" }
  { print }' "$verification" >"$TEMP_ROOT/wrong-target"
expect_refusal "$TEMP_ROOT/wrong-target" 'different original target'
if "$BASH" "$RESULT" original-findings "$TEMP_ROOT/missing" >"$TEMP_ROOT/missing-output" 2>/dev/null; then
  printf 'FAIL: accepted missing original result\n' >&2
  exit 1
fi
test ! -s "$TEMP_ROOT/missing-output"
printf 'PASS: original finding preservation\n'
