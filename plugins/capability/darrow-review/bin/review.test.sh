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

if [ "$FAILURES" -gt 0 ]; then
  printf '\n%d test(s) failed\n' "$FAILURES"
  exit 1
fi

printf '\nall review mechanics tests passed\n'
