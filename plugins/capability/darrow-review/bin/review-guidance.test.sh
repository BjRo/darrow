#!/usr/bin/env bash
# Guidance survives the public result, renderer, and verification boundaries.
set -eu
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
RESULT=$SCRIPT_DIR/review-result
REPORT=$SCRIPT_DIR/review-report
TEMP_ROOT=$(mktemp -d)
TEMP_ROOT=$(cd "$TEMP_ROOT" && pwd -P)
trap 'rm -rf "$TEMP_ROOT"' EXIT
cd "$TEMP_ROOT"
mkdir fake-bin
printf '#!/bin/sh\nexit 99\n' >fake-bin/bash
chmod +x fake-bin/bash
PATH=$TEMP_ROOT/fake-bin:$PATH
export PATH

cat >original.tsv <<'EOF'
format	darrow-review-result-v1
base	base
target	original
changed_file	/workspace/config.js
standards	pass
standards_source	/workspace/AGENTS.md
spec	fail
spec_source	requirement: retries remain 3
finding	standards	low	advisory	/workspace/config.js:1	/workspace/AGENTS.md	Legacy evidence remains supported
finding	spec	high	blocking	/workspace/config.js:2	requirement: retries remain 3	An assignment changes retries to 0, disabling required retries	Restore <3> via a constant; preserve C:\path and avoid [new API](url) changes	Calling retry must make exactly 3 attempts
check	none	not_applicable	not_applicable	fixture
verdict	fail
risk	none
next_action	return findings
EOF
"$BASH" "$RESULT" validate original.tsv
"$BASH" "$RESULT" original-findings original.tsv >original-rows.tsv
awk -F '\t' '$1 == "original_finding" { if (($3 == "spec" && NF != 11) || ($3 == "standards" && NF != 9)) exit 1; n++ } END { if (n != 2) exit 1 }' original-rows.tsv
{
  printf 'format\tdarrow-review-verification-v1\noriginal_target\toriginal\nprior_target\toriginal\ncurrent_target\trepair\nprevious_verification\tnone\tnone\n'
  cat original-rows.tsv
  printf 'attempt\tspec:2:original\tresolved\tresolved\tAn alternative expression restores exactly three retries\n'
  printf 'check\tnone\tnot_applicable\tnot_applicable\tfixture\noutcome\tclear\nnext_action\treturn control\n'
} >verification.tsv
"$BASH" "$RESULT" validate-original original.tsv verification.tsv
"$BASH" "$REPORT" render original.tsv >report.md
"$BASH" "$REPORT" render-verification verification.tsv >verification.md
for report in report.md verification.md; do
  grep -F 'Repair guidance (advisory)' "$report" >/dev/null
  grep -F 'Restore &lt;3&gt; via a constant; preserve C:&#92;path and avoid &#91;new API&#93;(url) changes' "$report" >/dev/null
  grep -F 'Resolution evidence' "$report" >/dev/null
  grep -F 'Calling retry must make exactly 3 attempts' "$report" >/dev/null
done

refuse() {
  if "$BASH" "$RESULT" "$@" >refusal 2>&1; then
    printf 'FAIL: accepted %s\n' "$*" >&2
    exit 1
  fi
  test -s refusal
}
for field in 10 11; do
  awk -F '\t' -v f="$field" 'BEGIN { OFS="\t" } $1 == "original_finding" && $3 == "spec" { $f="changed" } { print }' verification.tsv >changed.tsv
  "$BASH" "$RESULT" validate-verification changed.tsv >/dev/null
  refuse validate-original original.tsv changed.tsv
done
for fields in 8 10; do
  awk -F '\t' -v n="$fields" 'BEGIN { OFS="\t" } $1 == "finding" && $2 == "spec" { NF=n } { print }' original.tsv >bad.tsv
  refuse validate bad.tsv
done
for field in 8 9; do
  awk -F '\t' -v f="$field" 'BEGIN { OFS="\t" } $1 == "finding" && $2 == "spec" { $f="" } { print }' original.tsv >bad.tsv
  refuse validate bad.tsv
done

{
  printf 'format\tdarrow-review-axis-v1\naxis\tspec\nstatus\tfail\nsource\trequirement\n'
  awk -F '\t' 'BEGIN { OFS="\t" } $1 == "finding" && $2 == "spec" { print $1,$3,$4,$5,$6,$7,$8,$9 }' original.tsv
} >axis.tsv
"$BASH" "$RESULT" validate-axis spec axis.tsv
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "finding" { $8="" } { print }' axis.tsv >bad.tsv
refuse validate-axis spec bad.tsv

cat >fix.tsv <<'EOF'
format	darrow-review-fix-axis-v1
axis	spec
original	spec:2:original
attempt	spec:2:original	resolved	resolved	Three retries now occur
regression	spec:2:original	high	/workspace/config.js:3	requirement: retain timeout	Removing timeout disables the deadline	Cannot recommend a safe timeout mechanism without the external scheduler contract	An expired deadline must cancel remaining retries
EOF
"$BASH" "$RESULT" validate-fix-axis spec fix.tsv
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "regression" { NF=7 } { print }' fix.tsv >bad.tsv
refuse validate-fix-axis spec bad.tsv
awk -F '\t' 'BEGIN { OFS="\t" }
  $1 == "outcome" { $2="continue" }
  $1 == "check" { print "regression","regression:1:spec:2:original","spec:2:original",1,"spec","high","unresolved","progressing","/workspace/config.js:3","requirement: retain timeout","Removing timeout disables the deadline","Cannot recommend a safe timeout mechanism without the external scheduler contract","An expired deadline must cancel remaining retries" }
  { print }' verification.tsv >first.tsv
"$BASH" "$RESULT" validate-original original.tsv first.tsv
"$BASH" "$REPORT" render-verification first.tsv >first.md
grep -F 'Cannot recommend a safe timeout mechanism' first.md >/dev/null
hash=$(git hash-object --no-filters first.tsv)
{
  while IFS= read -r row; do
    case "$row" in
      previous_verification*) printf 'previous_verification\t%s\t%s/first.tsv\n' "$hash" "$TEMP_ROOT" ;;
      *) printf '%s\n' "$row" ;;
    esac
  done <first.tsv
} | awk -F '\t' 'BEGIN { OFS="\t" }
  $1 == "prior_target" { $2="repair" }
  $1 == "current_target" { $2="second-repair"; print; print "history_target","original"; next }
  $1 == "regression" { $7="resolved"; $8="resolved"; $11="Deadline cancels retries" }
  $1 == "outcome" { $2="clear" }
  { print }' >second.tsv
"$BASH" "$RESULT" validate-verification second.tsv
for field in 12 13; do
  awk -F '\t' -v f="$field" 'BEGIN { OFS="\t" } $1 == "regression" { $f="changed" } { print }' second.tsv >bad.tsv
  refuse validate-verification bad.tsv
done
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "regression" { NF=11 } { print }' second.tsv >bad.tsv
refuse validate-verification bad.tsv
printf 'PASS: advisory guidance preservation and compatibility\n'
