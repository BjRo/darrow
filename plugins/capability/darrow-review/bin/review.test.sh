#!/usr/bin/env bash
# Deterministic coverage for scope pinning and structured review validation.
set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
SCOPE=$SCRIPT_DIR/review-scope
RESULT=$SCRIPT_DIR/review-result
REPORT=$SCRIPT_DIR/review-report
SHELL_UNDER_TEST=${BASH:-bash}
TAB=$(printf '\t')
FAILURES=0
TEMP_REPOS=

cleanup() {
  cd /
  repo=
  for repo in $TEMP_REPOS; do
    rm -rf "$repo"
  done
}
trap cleanup EXIT

check_contains() {
  name=$1
  needle=$2
  output=$3
  case "$output" in
    *"$needle"*) printf '  ok: %s\n' "$name" ;;
    *)
      printf '  FAIL: %s (missing: %s)\n' "$name" "$needle"
      FAILURES=$((FAILURES + 1))
      ;;
  esac
}

check_not_contains() {
  name=$1
  needle=$2
  output=$3
  case "$output" in
    *"$needle"*)
      printf '  FAIL: %s (unexpected: %s)\n' "$name" "$needle"
      FAILURES=$((FAILURES + 1))
      ;;
    *) printf '  ok: %s\n' "$name" ;;
  esac
}

check_equal() {
  name=$1
  expected=$2
  actual=$3
  if [ "$actual" = "$expected" ]; then
    printf '  ok: %s\n' "$name"
  else
    printf '  FAIL: %s (expected %s, got %s)\n' "$name" "$expected" "$actual"
    FAILURES=$((FAILURES + 1))
  fi
}

fresh_repo() {
  REPO=$(mktemp -d)
  REPO=$(cd "$REPO" && pwd -P)
  TEMP_REPOS="$TEMP_REPOS $REPO"
  git -C "$REPO" init -qb main
  git -C "$REPO" config user.name test
  git -C "$REPO" config user.email test@example.invalid
  mkdir -p "$REPO/src"
  printf 'one\n' >"$REPO/src/value.txt"
  git -C "$REPO" add src/value.txt
  git -C "$REPO" commit -qm "chore: init"
}

manifest_from() {
  awk -F '\t' '$1 == "manifest" { print $2 }' <<<"$1"
}

echo "explicit repository ignores hostile ambient Git context"
fresh_repo
TARGET_REPO=$REPO
printf 'two\n' >"$TARGET_REPO/src/value.txt"
fresh_repo
HOSTILE_REPO=$REPO
set +e
out=$(cd / && GIT_DIR="$HOSTILE_REPO/.git" GIT_WORK_TREE="$HOSTILE_REPO" \
  "$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$TARGET_REPO" --base HEAD --target WORKTREE 2>&1)
status=$?
set -e
check_equal "explicit repository remains authoritative" 0 "$status"
check_contains "hostile context cannot replace the repository" "repository${TAB}$TARGET_REPO" "$out"
manifest=$(manifest_from "$out")
case "$manifest" in
  "$TARGET_REPO/.git"/*) printf '  ok: scope artifact stays beneath the target Git directory\n' ;;
  *)
    printf '  FAIL: scope artifact escaped the target Git directory (%s)\n' "$manifest"
    FAILURES=$((FAILURES + 1))
    ;;
esac

echo "committed scope"
fresh_repo
base=$(git -C "$REPO" rev-parse HEAD)
printf 'two\n' >"$REPO/src/value.txt"
git -C "$REPO" add src/value.txt
git -C "$REPO" commit -qm "feat: change value"
target=$(git -C "$REPO" rev-parse HEAD)
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO/src" --base "$base" --target "$target")
manifest=$(manifest_from "$out")
check_contains "resolves an absolute repository" "repository${TAB}$REPO" "$out"
check_contains "pins the base OID" "base${TAB}$base" "$out"
check_contains "pins the target OID" "target${TAB}$target" "$out"
check_contains "lists an absolute changed path" "changed_file${TAB}$REPO/src/value.txt" "$out"
patch=$("$SHELL_UNDER_TEST" "$SCOPE" show --manifest "$manifest")
check_contains "renders the committed layer" "layer=committed" "$patch"
check_contains "renders committed content" "+two" "$patch"

echo "complete and selective working-tree scope"
fresh_repo
printf 'staged\n' >"$REPO/src/value.txt"
git -C "$REPO" add src/value.txt
printf 'staged\nunstaged\n' >"$REPO/src/value.txt"
printf 'new\n' >"$REPO/new file.txt"
before=$(git -C "$REPO" status --porcelain --untracked-files=all)
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target WORKTREE)
manifest=$(manifest_from "$out")
patch=$("$SHELL_UNDER_TEST" "$SCOPE" show --manifest "$manifest")
check_contains "includes the staged layer" "layer=staged" "$patch"
check_contains "includes the unstaged layer" "layer=unstaged" "$patch"
check_contains "includes the untracked layer" "layer=untracked" "$patch"
check_contains "captures staged content" "+staged" "$patch"
check_contains "captures unstaged content" "+unstaged" "$patch"
check_contains "captures untracked content" "+new" "$patch"
changed_count=$(awk -F '\t' '$1 == "changed_file" { count++ } END { print count + 0 }' <<<"$out")
check_equal "deduplicates paths across layers" 2 "$changed_count"
after=$(git -C "$REPO" status --porcelain --untracked-files=all)
check_equal "scope preparation preserves working-tree state" "$before" "$after"

out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target HEAD --staged)
manifest=$(manifest_from "$out")
patch=$("$SHELL_UNDER_TEST" "$SCOPE" show --manifest "$manifest")
check_contains "selective scope keeps staged content" "+staged" "$patch"
check_not_contains "selective scope excludes unstaged content" "+unstaged" "$patch"
check_not_contains "selective scope excludes untracked content" "+new" "$patch"

echo "invalid and empty scopes"
fresh_repo
set +e
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base does-not-exist --target HEAD 2>&1)
status=$?
set -e
check_equal "invalid base exits before review" 2 "$status"
check_contains "invalid base is explicit" "invalid base" "$out"
set +e
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target HEAD 2>&1)
status=$?
set -e
check_equal "empty diff exits before review" 3 "$status"
check_contains "empty diff is explicit" "declared review scope is empty" "$out"

set +e
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target HEAD --allow-empty 2>&1)
status=$?
set -e
check_equal "empty fix scope requires a prior manifest" 2 "$status"
check_contains "empty fix scope restriction is explicit" "valid only with --prior-manifest" "$out"

printf 'two\n' >"$REPO/src/value.txt"
prior_out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target WORKTREE)
prior_manifest=$(manifest_from "$prior_out")
printf 'one\n' >"$REPO/src/value.txt"
current_out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target WORKTREE --allow-empty --prior-manifest "$prior_manifest")
current_manifest=$(manifest_from "$current_out")
check_contains "repair scope permits a restored base" "changed_count${TAB}0" "$current_out"
repair_delta=$("$SHELL_UNDER_TEST" "$SCOPE" compare --prior-manifest "$prior_manifest" --current-manifest "$current_manifest")
check_contains "repair delta binds the prior target" "prior_target${TAB}" "$repair_delta"
check_contains "repair delta binds the current target" "current_target${TAB}" "$repair_delta"
check_contains "repair delta shows the removed repair packet" "-+two" "$repair_delta"

printf 'base-two\n' >"$REPO/src/value.txt"
git -C "$REPO" add src/value.txt
git -C "$REPO" commit -qm "chore: establish another base"
set +e
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base HEAD --target WORKTREE --allow-empty --prior-manifest "$prior_manifest" 2>&1)
status=$?
set -e
check_equal "repair scope rejects a changed effective base" 2 "$status"
check_contains "repair base mismatch is explicit" "does not share the current effective base" "$out"

echo "merge-base branch scope"
fresh_repo
root_commit=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" checkout -qb feature
printf 'feature\n' >"$REPO/src/feature.txt"
git -C "$REPO" add src/feature.txt
git -C "$REPO" commit -qm "feat: feature"
feature_commit=$(git -C "$REPO" rev-parse HEAD)
git -C "$REPO" checkout -q main
printf 'main\n' >"$REPO/src/main.txt"
git -C "$REPO" add src/main.txt
git -C "$REPO" commit -qm "feat: main"
out=$("$SHELL_UNDER_TEST" "$SCOPE" prepare --repo "$REPO" --base main --target "$feature_commit" --merge-base)
check_contains "uses the unique merge base" "base${TAB}$root_commit" "$out"
check_contains "includes only the feature branch path" "$REPO/src/feature.txt" "$out"
check_not_contains "excludes base-branch-only paths" "$REPO/src/main.txt" "$out"

echo "pinned diff integrity"
manifest=$(manifest_from "$out")
diff_path=$(awk -F '\t' '$1 == "diff" { print $2 }' "$manifest")
printf 'tampered\n' >>"$diff_path"
set +e
tamper_out=$("$SHELL_UNDER_TEST" "$SCOPE" show --manifest "$manifest" 2>&1)
status=$?
set -e
check_equal "tampered pinned diff is refused" 2 "$status"
check_contains "tamper reason is explicit" "checksum does not match" "$tamper_out"

echo "axis and aggregate result validation"
fresh_repo
axis=$REPO/.git/standards.tsv
{
  printf 'format\tdarrow-review-axis-v1\n'
  printf 'axis\tstandards\n'
  printf 'status\tfail\n'
  printf 'source\t%s/AGENTS.md\n' "$REPO"
  printf 'finding\thigh\tblocking\tsrc/value.txt:1\t%s/AGENTS.md#Values\tThe changed value violates the rule\n' "$REPO"
} >"$axis"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-axis standards "$axis")
check_contains "accepts a structured axis result" "valid: darrow-review-axis-v1" "$out"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-axis spec "$axis" 2>&1)
status=$?
set -e
check_equal "rejects an axis mismatch" 4 "$status"

echo "axis status follows blocking disposition, not finding count"
for axis_name in standards spec; do
  for axis_status in pass fail; do
    for disposition in advisory blocking; do
      {
        printf 'format\tdarrow-review-axis-v1\n'
        printf 'axis\t%s\n' "$axis_name"
        printf 'status\t%s\n' "$axis_status"
        printf 'source\tuser-supplied repository rule or requirement\n'
        printf 'finding\tlow\t%s\tsrc/value.txt:1\tuser-supplied clause\tConcrete changed evidence\n' "$disposition"
      } >"$axis"
      set +e
      out=$("$SHELL_UNDER_TEST" "$RESULT" validate-axis "$axis_name" "$axis" 2>&1)
      status=$?
      set -e
      case "$axis_status:$disposition" in
        pass:advisory|fail:blocking) expected_status=0 ;;
        *) expected_status=4 ;;
      esac
      check_equal "$axis_name $axis_status with $disposition finding" "$expected_status" "$status"
      if [ "$axis_status:$disposition" = fail:advisory ]; then
        check_contains "advisory-only failure explains the evidence mismatch" \
          "failing axis requires a blocking finding" "$out"
      fi
    done
  done
done

result=$REPO/.git/result.tsv
{
  printf 'format\tdarrow-review-result-v1\n'
  printf 'base\t%s\n' "$root_commit"
  printf 'target\t%s\n' "$feature_commit"
  printf 'changed_file\t%s/src/feature.txt\n' "$REPO"
  printf 'standards\tpass\n'
  printf 'standards_source\t%s/AGENTS.md\n' "$REPO"
  printf 'spec\tpass\n'
  printf 'spec_source\tuser objective: add feature\n'
  printf 'check\tbash test.sh\tapplicable\tpass\tAll tests passed\n'
  printf 'verdict\tpass\n'
  printf 'risk\tnone observed\n'
  printf 'next_action\tnone\n'
} >"$result"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate "$result")
check_contains "accepts a complete passing result" "valid: darrow-review-result-v1" "$out"

# shellcheck disable=SC2016 # Fixture content intentionally contains Markdown backticks.
printf 'finding\tstandards\thigh\tblocking\t%s/src/feature.txt:1\t%s/AGENTS.md#Heading\tUse <safe> & `literal` | evidence\n' "$REPO" "$REPO" >>"$result"
awk -F '\t' 'BEGIN { OFS="\t" } $1 == "standards" { $2="fail" } $1 == "verdict" { $2="fail" } { print }' "$result" >"$result.render"
out=$("$SHELL_UNDER_TEST" "$REPORT" render "$result.render")
check_contains "renders a Markdown verdict heading" "# Code review — FAIL" "$out"
check_contains "leads with semantic finding counts" "**Findings:** 1 (1 blocking, 0 advisory)" "$out"
check_contains "preserves finding axis and severity" "HIGH — BLOCKING (Standards)" "$out"
# shellcheck disable=SC2016 # Expected literal intentionally contains Markdown backticks.
check_contains "escapes Markdown-hostile evidence" '&lt;safe&gt;' "$out"
check_contains "escapes Markdown backticks" '&#96;literal&#96;' "$out"
check_contains "escapes Markdown pipes" '&#124; evidence' "$out"
check_contains "renders compact checks" "## Checks" "$out"
check_contains "renders scope after findings" "## Scope" "$out"
check_contains "renders sources after scope" "## Sources" "$out"
check_not_contains "does not duplicate the raw TSV" "format${TAB}darrow-review-result-v1" "$out"

golden=$REPO/.git/golden.tsv
{
  printf 'format\tdarrow-review-result-v1\n'
  printf 'base\tbase-oid\n'
  printf 'target\ttarget-fingerprint\n'
  printf 'changed_file\t%s/src/one.js\n' "$REPO"
  printf 'changed_file\t%s/src/two.js\n' "$REPO"
  printf 'standards\tfail\nstandards_source\t%s/AGENTS.md\n' "$REPO"
  printf 'spec\tpass\nspec_source\tobjective <v1> & details\n'
  # shellcheck disable=SC2016 # Fixture content intentionally contains Markdown backticks.
  printf 'finding\tstandards\thigh\tblocking\tsrc/one.js:1\t%s/AGENTS.md\tAvoid `debug` output\n' "$REPO"
  printf 'finding\tspec\tmedium\tadvisory\tsrc/two.js:2\tobjective <v1> & details\tKeep [evidence] intact\n'
  printf 'check\tbash test.sh\tapplicable\tpass\tAll tests passed\n'
  printf 'check\tnone\tnot_applicable\tnot_applicable\tNo typecheck applies\n'
  printf 'verdict\tfail\n'
  printf 'risk\tRisk <one> & two\nrisk\tSecond risk\n'
  # shellcheck disable=SC2016 # Fixture content intentionally contains Markdown backticks.
  printf 'next_action\tReturn `findings` to owner\n'
} >"$golden"
out=$("$SHELL_UNDER_TEST" "$REPORT" render "$golden")
expected=$REPO/.git/golden.md
cat >"$expected" <<EOF
# Code review — FAIL

**Verdict:** fail · **Findings:** 2 (1 blocking, 1 advisory)

## Findings

### 1. HIGH — BLOCKING (Standards)
- **Location:** <code>src/one.js:1</code>
- **Source:** <code>$REPO/AGENTS.md</code>
- **Evidence:** Avoid &#96;debug&#96; output

### 2. MEDIUM — ADVISORY (Spec)
- **Location:** <code>src/two.js:2</code>
- **Source:** <code>objective &lt;v1&gt; &amp; details</code>
- **Evidence:** Keep &#91;evidence&#93; intact

## Checks
- **PASS** (applicable) — <code>bash test.sh</code>: All tests passed
- **NOT_APPLICABLE** (not_applicable) — <code>none</code>: No typecheck applies

## Risks
- Risk &lt;one&gt; &amp; two
- Second risk

## Next action
Return &#96;findings&#96; to owner

## Scope
- **Base:** <code>base-oid</code>
- **Target:** <code>target-fingerprint</code>
- **Changed files:**
  - <code>$REPO/src/one.js</code>
  - <code>$REPO/src/two.js</code>

## Sources
- **Standards (fail):**
  - <code>$REPO/AGENTS.md</code>
- **Spec (pass):** <code>objective &lt;v1&gt; &amp; details</code>
EOF
actual=$REPO/.git/golden.actual.md
printf '%s\n' "$out" >"$actual"
if cmp -s "$expected" "$actual"; then
  printf '  ok: golden rendering preserves every byte\n'
else
  printf '  FAIL: golden rendering preserves every byte\n'
  diff -u "$expected" "$actual" || true
  FAILURES=$((FAILURES + 1))
fi
check_contains "golden preserves both changed files" "src/two.js" "$out"
check_contains "golden preserves check applicability" "**NOT_APPLICABLE** (not_applicable)" "$out"
check_contains "golden preserves multiple risks" "Second risk" "$out"
check_contains "golden escapes all hostile semantic fields" "&lt;v1&gt; &amp; details" "$out"
check_contains "golden preserves next action" "Return &#96;findings&#96; to owner" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "verdict" { $2="blocked" } { print }' "$result" >"$result.bad"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate "$result.bad" 2>&1)
status=$?
set -e
check_equal "rejects a dishonest verdict" 4 "$status"
check_contains "states the derived verdict" "verdict must be pass" "$out"

{
  printf 'format\tdarrow-review-axis-v1\n'
  printf 'axis\tspec\n'
  printf 'status\tfail\n'
  printf 'source\tuser objective\n'
  printf 'finding\thigh\tblocking\tsrc/value.txt:1\tnone\tThe behavior is missing\n'
} >"$axis"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-axis spec "$axis" 2>&1)
status=$?
set -e
check_equal "rejects untraceable blocking Spec finding" 4 "$status"
check_contains "requires an originating requirement" "must cite an originating requirement" "$out"

echo "repair verification result validation"
verification=$REPO/.git/verification.tsv
original_target="WORKTREE@base+original"
prior_target=$original_target
current_target="WORKTREE@base+repair-one"
standards_key="standards:1:$original_target"
spec_key="spec:2:$original_target"
regression_key="regression:1:$standards_key"

fix_axis=$REPO/.git/fix-axis.tsv
{
  printf 'format\tdarrow-review-fix-axis-v1\n'
  printf 'axis\tstandards\n'
  printf 'original\t%s\n' "$standards_key"
  printf 'prior_regression\t%s\t%s\n' "$regression_key" "$standards_key"
  printf 'attempt\t%s\tresolved\tresolved\tOriginal blocker remains fixed\n' "$standards_key"
  printf 'regression_attempt\t%s\tresolved\tresolved\tRegression repair is present\n' "$regression_key"
} >"$fix_axis"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-fix-axis standards "$fix_axis")
check_contains "accepts a structured fix-axis result" "valid: darrow-review-fix-axis-v1" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "regression_attempt" { $2="regression:99:unknown" } { print }' "$fix_axis" >"$fix_axis.unknown"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-fix-axis standards "$fix_axis.unknown" 2>&1)
status=$?
set -e
check_equal "rejects an unknown carried regression" 4 "$status"
check_contains "reports unknown carried regression" "regression_attempt references an unknown prior regression" "$out"

awk -F '\t' '$1 != "regression_attempt"' "$fix_axis" >"$fix_axis.missing-regression"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-fix-axis standards "$fix_axis.missing-regression" 2>&1)
status=$?
set -e
check_equal "rejects an omitted carried regression state" 4 "$status"
check_contains "requires every carried regression state" "prior regression is missing its fix-axis attempt" "$out"

{
  printf 'format\tdarrow-review-verification-v1\n'
  printf 'original_target\t%s\n' "$original_target"
  printf 'prior_target\t%s\n' "$prior_target"
  printf 'current_target\t%s\n' "$current_target"
  printf 'previous_verification\tnone\tnone\n'
  printf 'original_finding\t%s\tstandards\t1\thigh\tblocking\tsrc/value.txt:1\t%s/AGENTS.md\tOriginal standards evidence\n' "$standards_key" "$REPO"
  printf 'original_finding\t%s\tspec\t2\tlow\tadvisory\tsrc/value.txt:2\tuser objective\tOriginal advisory evidence\n' "$spec_key"
  printf 'attempt\t%s\tresolved\tresolved\tThe violation is absent from the repair\n' "$standards_key"
  printf 'attempt\t%s\tunresolved\tunchanged\tThe advisory remains\n' "$spec_key"
  printf 'regression\t%s\t%s\t1\tstandards\thigh\tresolved\tresolved\tsrc/value.txt:3\t%s/AGENTS.md\tThe repair-caused regression is fixed\n' "$regression_key" "$standards_key" "$REPO"
  printf 'check\tbash test.sh\tapplicable\tpass\tAll tests passed\n'
  printf 'outcome\tclear\n'
  printf 'next_action\treturn control to enclosing goal\n'
} >"$verification"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification")
check_contains "accepts a complete clear verification" "valid: darrow-review-verification-v1" "$out"

out=$("$SHELL_UNDER_TEST" "$REPORT" render-verification "$verification")
check_contains "renders a verification outcome heading" "# Repair verification — CLEAR" "$out"
check_contains "renders stable finding status" "$standards_key" "$out"
check_contains "renders repair-caused regression provenance" "$regression_key" "$out"
check_contains "renders repair-caused regression axis" "**Axis:** <code>standards</code>" "$out"
check_contains "renders verification target binding" "## Target binding" "$out"
check_not_contains "verification Markdown omits raw TSV" "format${TAB}darrow-review-verification-v1" "$out"

awk -F '\t' -v repeated="$prior_target" 'BEGIN { OFS="\t" } $1 == "current_target" { $2=repeated } $1 == "outcome" { $2="no_progress" } { print }' "$verification" >"$verification.oscillation"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.oscillation")
check_contains "accepts oscillation as no progress" "valid: darrow-review-verification-v1" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "attempt" && $2 ~ /^standards:/ { $3="unresolved"; $4="progressing"; $5="Failure narrowed to one branch" } $1 == "regression" { next } $1 == "outcome" { $2="continue" } { print }' "$verification" >"$verification.progress"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.progress")
check_contains "accepts materially progressing blocker" "valid: darrow-review-verification-v1" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "attempt" && $2 ~ /^standards:/ { $3="unresolved"; $4="unchanged"; $5="Same failure evidence" } $1 == "regression" { next } $1 == "outcome" { $2="no_progress" } { print }' "$verification" >"$verification.unchanged"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.unchanged")
check_contains "accepts unchanged blocker as no progress" "valid: darrow-review-verification-v1" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "attempt" && $2 ~ /^standards:/ { $3="blocked"; $4="unavailable"; $5="Required evidence unavailable" } $1 == "regression" { next } $1 == "outcome" { $2="blocked" } { print }' "$verification" >"$verification.blocked"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.blocked")
check_contains "accepts unavailable evidence as blocked" "valid: darrow-review-verification-v1" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "attempt" && $2 ~ /^spec:/ { $2="spec:99:WORKTREE@base+original" } { print }' "$verification" >"$verification.unknown"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.unknown" 2>&1)
status=$?
set -e
check_equal "rejects attempt outside the closed finding set" 4 "$status"
check_contains "reports unknown stable finding membership" "attempt references an unknown original finding" "$out"

awk -F '\t' '1; $1 == "attempt" && $2 ~ /^standards:/' "$verification" >"$verification.duplicate"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.duplicate" 2>&1)
status=$?
set -e
check_equal "rejects duplicate attempted finding IDs" 4 "$status"
check_contains "reports duplicate attempted finding IDs" "duplicate attempt finding key" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "regression" { $3="standards:99:WORKTREE@base+original" } { print }' "$verification" >"$verification.bad-cause"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.bad-cause" 2>&1)
status=$?
set -e
check_equal "rejects regression without a causal original finding" 4 "$status"
check_contains "reports unknown regression cause" "regression caused_by references an unknown original finding" "$out"

awk -F '\t' -v cause="$spec_key" 'BEGIN { OFS="\t" } $1 == "attempt" && $2 == cause { next } $1 == "regression" { $2="regression:1:" cause; $3=cause; $5="spec" } { print }' "$verification" >"$verification.unattempted-cause"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.unattempted-cause" 2>&1)
status=$?
set -e
check_equal "rejects regression tied to an unattempted original finding" 4 "$status"
check_contains "requires an attempted regression cause" "regression caused_by references an unattempted original finding" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "attempt" && $2 ~ /^standards:/ { $3="unresolved"; $4="progressing"; $5="Failure narrowed" } $1 == "regression" { next } $1 == "check" { $4="fail"; $5="The repair broke a deterministic check" } $1 == "outcome" { $2="continue" } { print }' "$verification" >"$verification.unscoped-check"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.unscoped-check" 2>&1)
status=$?
set -e
check_equal "rejects a failed check without a scoped regression" 4 "$status"
check_contains "requires regression evidence for a failed check" "failing deterministic check requires an unresolved or blocked repair-caused regression" "$out"

previous_hash=$(git -C "$REPO" hash-object "$verification")
next_verification=$REPO/.git/verification-next.tsv
awk -F '\t' -v path="$verification" -v hash="$previous_hash" -v prior="$current_target" -v history="$prior_target" 'BEGIN { OFS="\t" }
  $1 == "prior_target" { $2=prior }
  $1 == "current_target" { $2="WORKTREE@base+repair-two"; print; print "history_target", history; next }
  $1 == "previous_verification" { $2=hash; $3=path }
  { print }
' "$verification" >"$next_verification"
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$next_verification")
check_contains "accepts a checksum-bound later regression verification" "valid: darrow-review-verification-v1" "$out"

awk -F '\t' '$1 != "history_target"' "$next_verification" >"$next_verification.no-history"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$next_verification.no-history" 2>&1)
status=$?
set -e
check_equal "rejects dropped repair target history" 4 "$status"
check_contains "preserves repair target history" "prior repair target is missing from target history" "$out"

awk -F '\t' '$1 != "regression"' "$next_verification" >"$next_verification.dropped"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$next_verification.dropped" 2>&1)
status=$?
set -e
check_equal "rejects a dropped carried regression" 4 "$status"
check_contains "preserves carried regression identity" "prior regression is missing from current verification" "$out"

awk -F '\t' 'BEGIN { OFS="\t" } $1 == "outcome" { $2="continue" } { print }' "$verification" >"$verification.dishonest"
set +e
out=$("$SHELL_UNDER_TEST" "$RESULT" validate-verification "$verification.dishonest" 2>&1)
status=$?
set -e
check_equal "rejects a dishonest verification outcome" 4 "$status"
check_contains "states the mechanically derived verification outcome" "outcome must be clear" "$out"

if [ "$FAILURES" -gt 0 ]; then
  printf '\n%d test(s) failed\n' "$FAILURES"
  exit 1
fi

printf '\nall review mechanics tests passed\n'
