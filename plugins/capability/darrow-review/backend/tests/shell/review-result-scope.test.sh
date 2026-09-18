#!/usr/bin/env bash
# Bind aggregate scope records to the pinned manifest, without retyping IDs.
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
RESULT=(uv run --quiet --frozen --no-dev --project "$SCRIPT_DIR/../.." review-result)
SCOPE=(uv run --quiet --frozen --no-dev --project "$SCRIPT_DIR/../.." review-scope)
TEMP_ROOT=$(mktemp -d)
TEMP_ROOT=$(cd "$TEMP_ROOT" && pwd -P)
trap 'rm -rf "$TEMP_ROOT"' EXIT
repo=$TEMP_ROOT/'repo with spaces'
mkdir -p "$repo"
git -C "$repo" init -q
printf 'before\n' >"$repo/file.txt"
git -C "$repo" add file.txt
git -C "$repo" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm base
printf 'after\n' >"$repo/file.txt"
printf 'untracked\n' >"$repo/literal\name.txt"
"${SCOPE[@]}" prepare --repo "$repo" --base HEAD --target WORKTREE >"$TEMP_ROOT/prepared"
manifest=$(awk -F '\t' '$1 == "manifest" { print $2 }' "$TEMP_ROOT/prepared")
result=$(dirname "$manifest")/result.tsv
awk -F '\t' '$1 == "base" || $1 == "target" || $1 == "changed_file"' "$manifest" >"$TEMP_ROOT/expected"
{
  printf 'format\tdarrow-review-result-v1\n'
  cat "$TEMP_ROOT/expected"
  printf 'standards\tpass\nstandards_source\theuristic:fixture\n'
  printf 'spec\tnot_available\nspec_source\tnot_available\n'
  printf 'check\tnone\tnot_applicable\tnot_applicable\tno applicable check\n'
  printf 'verdict\tpass\nrisk\tnone\nnext_action\treturn control to enclosing goal\n'
} >"$result"
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "target" { $2=$2 "x" } { print }' "$result" >"$TEMP_ROOT/wrong-target"
# Establish the observed gap independently: serialization alone accepts drift.
"${RESULT[@]}" validate "$TEMP_ROOT/wrong-target" >/dev/null
printf 'baseline: standalone schema validation accepts a different target\n'

# Nested helpers must use the interpreter under test even with a hostile PATH.
mkdir "$TEMP_ROOT/bin"
printf '#!/bin/sh\nexit 99\n' >"$TEMP_ROOT/bin/bash"
chmod +x "$TEMP_ROOT/bin/bash"
export PATH="$TEMP_ROOT/bin:$PATH"
cd "$TEMP_ROOT"
"${RESULT[@]}" scope-records "$manifest" >"$TEMP_ROOT/actual"
cmp "$TEMP_ROOT/expected" "$TEMP_ROOT/actual"
"${RESULT[@]}" validate-scope "$manifest" "$result"

expect_mismatch() {
  "${RESULT[@]}" validate "$1" >/dev/null
  status=0
  "${RESULT[@]}" validate-scope "$manifest" "$1" >"$TEMP_ROOT/refusal" 2>&1 || status=$?
  [ "$status" -eq 4 ] || { cat "$TEMP_ROOT/refusal"; exit 1; }
  printf 'ok: rejects %s\n' "$2"
}
expect_mismatch "$TEMP_ROOT/wrong-target" 'changed target'
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "base" { $2="different" } { print }' "$result" >"$TEMP_ROOT/wrong-base"
expect_mismatch "$TEMP_ROOT/wrong-base" 'changed base'
awk -F '\t' '$1 != "changed_file" || ++n > 1' "$result" >"$TEMP_ROOT/missing-file"
expect_mismatch "$TEMP_ROOT/missing-file" 'omitted changed file'
awk -F '\t' '{ print } $1 == "changed_file" && ++n == 1 { print }' "$result" >"$TEMP_ROOT/duplicate-file"
expect_mismatch "$TEMP_ROOT/duplicate-file" 'duplicated changed file'
awk -F '\t' '{ print } $1 == "target" { print "changed_file\t/unrelated.txt" }' "$result" >"$TEMP_ROOT/extra-file"
expect_mismatch "$TEMP_ROOT/extra-file" 'extra changed file'
# Valid record ordering does not change the pinned set.
awk -F '\t' '$1 == "changed_file" { rows[++n]=$0; next } { print } END { for (i=n;i>0;i--) print rows[i] }' "$result" >"$TEMP_ROOT/reordered"
"${RESULT[@]}" validate-scope "$manifest" "$TEMP_ROOT/reordered"

for missing in "$TEMP_ROOT/missing" "$TEMP_ROOT"; do
  if "${RESULT[@]}" scope-records "$missing" >"$TEMP_ROOT/output" 2>/dev/null; then exit 1; fi
  test ! -s "$TEMP_ROOT/output"
done
awk -F '\t' '$1 != "target"' "$manifest" >"$TEMP_ROOT/incomplete-scope"
if "${RESULT[@]}" scope-records "$TEMP_ROOT/incomplete-scope" >"$TEMP_ROOT/output" 2>/dev/null; then exit 1; fi
test ! -s "$TEMP_ROOT/output"
expect_invalid_manifest() {
  if "${RESULT[@]}" scope-records "$1" >"$TEMP_ROOT/output" 2>/dev/null; then exit 1; fi
  test ! -s "$TEMP_ROOT/output"
  status=0
  "${RESULT[@]}" validate-scope "$1" "$2" >"$TEMP_ROOT/refusal" 2>&1 || status=$?
  [ "$status" -eq 4 ] || { cat "$TEMP_ROOT/refusal"; exit 1; }
}
# Keep the pinned diff intact: a manifest that loses a file row is incomplete
# even when the aggregate has copied that same incomplete set faithfully.
awk -F '\t' '$1 != "changed_file" || ++n > 1' "$manifest" >"$TEMP_ROOT/missing-file-scope"
expect_invalid_manifest "$TEMP_ROOT/missing-file-scope" "$TEMP_ROOT/missing-file"
awk -F '\t' '$1 != "changed_count"' "$manifest" >"$TEMP_ROOT/missing-count-scope"
expect_invalid_manifest "$TEMP_ROOT/missing-count-scope" "$result"
awk -F '\t' '{ print } $1 == "changed_count" { print }' "$manifest" >"$TEMP_ROOT/duplicate-count-scope"
expect_invalid_manifest "$TEMP_ROOT/duplicate-count-scope" "$result"
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "changed_count" { $2="invalid" } { print }' "$manifest" >"$TEMP_ROOT/invalid-count-scope"
expect_invalid_manifest "$TEMP_ROOT/invalid-count-scope" "$result"
diff_path=$(awk -F '\t' '$1 == "diff" { print $2 }' "$manifest")
printf 'tampered\n' >>"$diff_path"
if "${RESULT[@]}" scope-records "$manifest" >"$TEMP_ROOT/output" 2>/dev/null; then exit 1; fi
test ! -s "$TEMP_ROOT/output"
printf 'PASS: pinned scope identity and complete file set\n'
