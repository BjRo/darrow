#!/usr/bin/env bash
# Deterministic coverage for ADR inventory, numbering, structure, lifecycle,
# relationships, bounded output, and read-only behavior.
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/decision"
SHELL_UNDER_TEST=${BASH:-bash}
FAILURES=0
TEMP_REPOS=""

cleanup() {
  cd /
  local repo
  for repo in $TEMP_REPOS; do rm -rf "$repo"; done
}
trap cleanup EXIT

check_contains() {
  local name=$1 needle=$2 output=$3
  if [[ "$output" == *"$needle"* ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (missing: $needle)"
    printf '%s\n' "$output" | awk 'NR <= 20'
    FAILURES=$((FAILURES + 1))
  fi
}

check_not_contains() {
  local name=$1 needle=$2 output=$3
  if [[ "$output" != *"$needle"* ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (unexpected: $needle)"
    FAILURES=$((FAILURES + 1))
  fi
}

check_equal() {
  local name=$1 expected=$2 actual=$3
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (expected $expected, got $actual)"
    FAILURES=$((FAILURES + 1))
  fi
}

check_file_exists() {
  local name=$1 path=$2
  if [[ -f "$path" ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (missing file: $path)"
    FAILURES=$((FAILURES + 1))
  fi
}

check_order() {
  local name=$1 first=$2 second=$3 output=$4
  case "$output" in
    *"$first"*"$second"*) echo "  ok: $name" ;;
    *)
      echo "  FAIL: $name ($first was not before $second)"
      FAILURES=$((FAILURES + 1))
      ;;
  esac
}

fresh_repo() {
  REPO=$(mktemp -d)
  REPO=$(cd "$REPO" && pwd -P)
  TEMP_REPOS="$TEMP_REPOS $REPO"
  git -C "$REPO" init -qb main
  git -C "$REPO" config user.email t@t.local
  git -C "$REPO" config user.name t
  mkdir -p "$REPO/src" "$REPO/docs/decisions"
  printf '# Fixture\n' > "$REPO/README.md"
  git -C "$REPO" add README.md
  git -C "$REPO" commit -qm "chore: init"
}

write_adr() {
  local id=$1 status=$2 title=$3 supersedes=${4:-} superseded_by=${5:-} revisit=${6:-}
  local file="$REPO/docs/decisions/$id-test.md"
  {
    printf '# %s: %s\n\n' "$id" "$title"
    printf 'Status: %s\n' "$status"
    printf 'Date: 2026-07-19\n'
    printf 'Summary: Use %s.\n' "$title"
    [[ -z "$supersedes" ]] || printf 'Supersedes: %s\n' "$supersedes"
    [[ -z "$superseded_by" ]] || printf 'Superseded by: %s\n' "$superseded_by"
    [[ -z "$revisit" ]] || printf 'Revisit when: %s\n' "$revisit"
    printf '\n## Context\n\nContext for %s.\n' "$title"
    printf '\n## Decision\n\nUse %s.\n' "$title"
    printf '\n## Consequences\n\nThe choice is explicit.\n'
  } > "$file"
}

echo "basic inventory, filters, numbering, and read-only behavior"
fresh_repo
write_adr ADR-0001 Accepted "SQLite for local state" "" "" "Hosted concurrency becomes necessary"
git -C "$REPO" add docs/decisions
git -C "$REPO" commit -qm "docs: add fixture decision"
before=$(git -C "$REPO" status --porcelain --untracked-files=all)
before_hash=$(git -C "$REPO" hash-object "$REPO/docs/decisions/ADR-0001-test.md")
out=$("$SHELL_UNDER_TEST" "$SCRIPT" inspect --repo "$REPO/src")
check_contains "resolves the repository root from a subdirectory" "root: $REPO" "$out"
check_contains "reports an absolute ADR directory" "adr-directory: $REPO/docs/decisions" "$out"
check_contains "counts ADRs" "adr-records: 1" "$out"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search sqlite --status Accepted)
check_contains "search is case-insensitive" "ADR-0001 Accepted architecture" "$out"
check_contains "list paths are absolute" "$REPO/docs/decisions/ADR-0001-test.md" "$out"
check_contains "list states its filters" "status=Accepted, search=sqlite" "$out"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Proposed)
check_contains "empty filtered result is honest" "total: 0 (status=Proposed" "$out"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" next-id --repo "$REPO" --title "Checkpointed local state")
check_contains "allocates the next identifier" "id: ADR-0002" "$out"
check_contains "renders an absolute proposed path" "path: $REPO/docs/decisions/ADR-0002-checkpointed-local-state.md" "$out"
after=$(git -C "$REPO" status --porcelain --untracked-files=all)
after_hash=$(git -C "$REPO" hash-object "$REPO/docs/decisions/ADR-0001-test.md")
check_equal "inspection commands are read-only" "$before" "$after"
check_equal "inspection preserves tracked ADR content" "$before_hash" "$after_hash"

echo "deterministic non-authoritative Markdown ADR catalog"
fresh_repo
write_adr ADR-0001 Accepted "SQLite for local state"
write_adr ADR-0002 Proposed "PostgreSQL for hosted state"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "rebuilds a Markdown ADR catalog" 0 "$rc"
check_contains "rebuild reports the absolute catalog path" "catalog: $REPO/docs/decisions/README.md" "$out"
catalog="$REPO/docs/decisions/README.md"
check_file_exists "rebuild creates the checked-in catalog surface" "$catalog"
if [[ -f "$catalog" ]]; then
  first_hash=$(git hash-object "$catalog")
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO")
  second_hash=$(git hash-object "$catalog")
  check_equal "repeated rebuilds produce identical bytes" "$first_hash" "$second_hash"
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog check --repo "$REPO")
  check_contains "freshness check accepts the rebuilt catalog" "fresh: $catalog" "$out"
  check_contains "catalog identifies itself as derived" "derived, non-authoritative" "$(cat "$catalog")"
  check_contains "catalog visibly links the accepted ADR" "[ADR-0001: SQLite for local state](ADR-0001-test.md)" "$(cat "$catalog")"
  check_contains "catalog visibly lists its Summary" "Use SQLite for local state." "$(cat "$catalog")"
  check_contains "catalog includes every supported state" "## Superseded" "$(cat "$catalog")"
fi
git -C "$REPO" add docs/decisions
git -C "$REPO" commit -qm "docs: add generated catalog"
cp "$REPO/docs/decisions/README.md" "$REPO/catalog.saved"
git -C "$REPO" update-index --assume-unchanged docs/decisions/README.md
printf '\n' >> "$REPO/docs/decisions/README.md"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
check_contains "assume-unchanged catalog warns as stale" "warning: ADR catalog is stale" "$out"
check_contains "assume-unchanged catalog falls back to full scan" "ADR-0001 Accepted" "$out"
git -C "$REPO" update-index --no-assume-unchanged docs/decisions/README.md
mv "$REPO/catalog.saved" "$REPO/docs/decisions/README.md"
git -C "$REPO" update-index --refresh >/dev/null

echo "fresh catalog inventory routing and deliberate full-text body scan"
if [[ -f "$catalog" ]]; then
  mkdir "$REPO/read-bin"
  real_awk=$(command -v awk)
  real_grep=$(command -v grep)
  real_git=$(command -v git)
  # shellcheck disable=SC2016 # generated wrappers intentionally expand at runtime
  printf '#!/bin/sh\nfor arg in "$@"; do case "$arg" in */docs/decisions/ADR-*.md) printf "awk\\t%%s\\n" "$arg" >> "$ADR_READ_LOG";; esac; done\nexec %s "$@"\n' "$real_awk" > "$REPO/read-bin/awk"
  # shellcheck disable=SC2016 # generated wrappers intentionally expand at runtime
  printf '#!/bin/sh\nfor arg in "$@"; do case "$arg" in */docs/decisions/ADR-*.md) printf "grep\\t%%s\\n" "$arg" >> "$ADR_READ_LOG";; esac; done\nexec %s "$@"\n' "$real_grep" > "$REPO/read-bin/grep"
  # shellcheck disable=SC2016 # generated wrapper intentionally expands at runtime
  printf '#!/bin/sh\nseen_hash=0\nfor arg in "$@"; do [ "$arg" != hash-object ] || seen_hash=1; if [ "$seen_hash" -eq 1 ]; then case "$arg" in */docs/decisions/ADR-*.md) printf "git-hash-object\\t%%s\\n" "$arg" >> "$ADR_READ_LOG";; esac; fi; done\nexec %s "$@"\n' "$real_git" > "$REPO/read-bin/git"
  chmod +x "$REPO/read-bin/awk" "$REPO/read-bin/grep" "$REPO/read-bin/git"
  : > "$REPO/adr-reads"
  out=$(ADR_READ_LOG="$REPO/adr-reads" PATH="$REPO/read-bin:$PATH" "$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted)
  check_contains "catalog listing preserves the metadata match" "ADR-0001 Accepted" "$out"
  check_not_contains "catalog listing omits the filtered status" "ADR-0002 Proposed" "$out"
  reads=$(awk 'END {print NR + 0}' "$REPO/adr-reads")
  check_equal "fresh catalog answers metadata filters without ADR body reads" 0 "$reads"
  cp "$REPO/docs/decisions/ADR-0001-test.md" "$REPO/ADR-0001.saved"
  git -C "$REPO" update-index --assume-unchanged docs/decisions/ADR-0001-test.md
  printf '\nHidden worktree mutation.\n' >> "$REPO/docs/decisions/ADR-0001-test.md"
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
  check_contains "assume-unchanged ADR warns as stale" "warning: ADR catalog is stale" "$out"
  check_contains "assume-unchanged ADR falls back to full scan" "ADR-0001 Accepted" "$out"
  "$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
  expected_fingerprint=$(git -C "$REPO" hash-object --path=docs/decisions/ADR-0001-test.md "$REPO/docs/decisions/ADR-0001-test.md")
  actual_fingerprint=$(sed -n '/ADR-0001-test\.md -->$/s/^<!-- darrow-source: \([0-9a-f]*\) .*/\1/p' "$REPO/docs/decisions/README.md")
  check_equal "hidden ADR rebuild records the worktree blob fingerprint" "$expected_fingerprint" "$actual_fingerprint"
  set +e
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog check --repo "$REPO" 2>&1)
  rc=$?
  set -e
  check_equal "rebuild fingerprints hidden ADR worktree content" 0 "$rc"
  check_contains "hidden ADR rebuild becomes fresh" "records: 2" "$out"
  git -C "$REPO" update-index --no-assume-unchanged docs/decisions/ADR-0001-test.md
  mv "$REPO/ADR-0001.saved" "$REPO/docs/decisions/ADR-0001-test.md"
  : > "$REPO/adr-reads"
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search "SQLite for local")
  check_contains "full-body scan preserves literal phrases" "ADR-0001 Accepted" "$out"
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search "SQLite hosted")
  check_contains "separate body terms do not become false exact matches" "total: 0" "$out"
  printf '\nA body-only quasar marker.\n' >> "$REPO/docs/decisions/ADR-0002-test.md"
  "$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
  : > "$REPO/adr-reads"
  out=$(ADR_READ_LOG="$REPO/adr-reads" PATH="$REPO/read-bin:$PATH" "$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search quasar)
  check_contains "term absent from summaries remains an exact match" "ADR-0002 Proposed" "$out"
  reads=$(awk 'END {print NR + 0}' "$REPO/adr-reads")
  check_equal "full-text search deliberately scans every ADR body" 4 "$reads"
fi

echo "catalog fallback and stale-catalog counterexample"
fresh_repo
write_adr ADR-0001 Accepted "Alpha storage"
write_adr ADR-0002 Accepted "Beta transport"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
rc=$?
set -e
check_equal "missing catalog remains compatible" 0 "$rc"
check_contains "missing catalog warns before full scan" "warning: ADR catalog is missing" "$out"
check_contains "missing catalog full scan preserves matches" "ADR-0001 Accepted" "$out"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "validation rejects a missing catalog" 4 "$rc"
check_contains "missing catalog validation is explicit" "ADR catalog is missing" "$out"

"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null 2>&1
write_adr ADR-0003 Accepted "Gamma queue"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
rc=$?
set -e
check_equal "stale catalog membership falls back successfully" 0 "$rc"
check_contains "stale membership warns" "warning: ADR catalog is stale" "$out"
check_contains "stale catalog cannot hide a new ADR" "ADR-0003 Accepted" "$out"
printf '\nA newly recorded zephyr constraint.\n' >> "$REPO/docs/decisions/ADR-0002-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search zephyr 2>&1)
rc=$?
set -e
check_equal "stale catalog falls back successfully" 0 "$rc"
check_contains "stale catalog warns" "warning: ADR catalog is stale" "$out"
check_contains "stale data cannot hide a new body match" "ADR-0002 Accepted" "$out"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog check --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "explicit freshness check rejects stale data" 4 "$rc"

printf '# Broken catalog\n\n<!-- darrow-adr-catalog-v1 -->\n' > "$REPO/docs/decisions/README.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search Alpha 2>&1)
rc=$?
set -e
check_equal "malformed catalog falls back successfully" 0 "$rc"
check_contains "modified malformed catalog warns" "warning: ADR catalog is stale" "$out"
check_contains "malformed catalog cannot hide matches" "ADR-0001 Accepted" "$out"

"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null 2>&1
chmod 000 "$REPO/docs/decisions/README.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search Alpha 2>&1)
rc=$?
set -e
chmod 600 "$REPO/docs/decisions/README.md"
if [[ $(id -u) -eq 0 ]]; then
  echo "  ok: unreadable catalog fallback skipped for root test user"
else
  check_equal "unreadable catalog falls back successfully" 0 "$rc"
  check_contains "unreadable catalog warns" "warning: ADR catalog is unreadable" "$out"
  check_contains "unreadable catalog cannot hide matches" "ADR-0001 Accepted" "$out"
fi

"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null 2>&1
printf '\nAnother stale change.\n' >> "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "validation rejects checked-in catalog drift" 4 "$rc"
check_contains "validation names stale catalog" "ADR catalog is stale" "$out"

"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null 2>&1
git -C "$REPO" add docs/decisions
git -C "$REPO" commit -qm "docs: add catalog fixture"
sed 's/| Accepted |/| Proposed |/' "$REPO/docs/decisions/README.md" > "$REPO/docs/decisions/README.md.new"
mv "$REPO/docs/decisions/README.md.new" "$REPO/docs/decisions/README.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
rc=$?
set -e
check_equal "modified catalog falls back successfully" 0 "$rc"
check_contains "modified catalog warns as stale" "warning: ADR catalog is stale" "$out"
check_contains "modified catalog cannot forge status metadata" "ADR-0001 Accepted" "$out"

fresh_repo
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
sed '/darrow-adr-catalog-v1/d' "$REPO/docs/decisions/README.md" > "$REPO/docs/decisions/README.md.new"
mv "$REPO/docs/decisions/README.md.new" "$REPO/docs/decisions/README.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "validation rejects malformed empty catalog" 4 "$rc"
check_contains "empty catalog validation names malformed data" "ADR catalog is malformed" "$out"

fresh_repo
write_adr ADR-0001 Accepted "Rendered table"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
sed -e '/^| Decision | Status | Date | Summary | Relationships |$/d' -e '/^| --- | --- | --- | --- | --- |$/d' \
  "$REPO/docs/decisions/README.md" > "$REPO/docs/decisions/README.md.new"
mv "$REPO/docs/decisions/README.md.new" "$REPO/docs/decisions/README.md"
git -C "$REPO" add docs/decisions
git -C "$REPO" commit -qm "docs: commit headerless catalog fixture"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
rc=$?
set -e
check_equal "headerless catalog falls back successfully" 0 "$rc"
check_contains "headerless catalog warns as malformed" "warning: ADR catalog is malformed" "$out"
check_contains "headerless catalog cannot hide a record" "ADR-0001 Accepted" "$out"

fresh_repo
write_adr ADR-0001 Accepted "Closed grammar"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
sed '1a\
Injected catalog prose.' "$REPO/docs/decisions/README.md" > "$REPO/docs/decisions/README.md.new"
mv "$REPO/docs/decisions/README.md.new" "$REPO/docs/decisions/README.md"
git -C "$REPO" add docs/decisions
git -C "$REPO" commit -qm "docs: commit injected catalog fixture"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
rc=$?
set -e
check_equal "injected catalog prose falls back successfully" 0 "$rc"
check_contains "injected catalog prose warns as malformed" "warning: ADR catalog is malformed" "$out"
check_contains "injected catalog prose cannot hide a record" "ADR-0001 Accepted" "$out"

echo "catalog replacement safety and Markdown escaping"
fresh_repo
printf '# Team decision guide\n' > "$REPO/docs/decisions/README.md"
write_adr ADR-0001 Accepted "First"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "human-authored README replacement is refused" 4 "$rc"
check_contains "README refusal names the missing derived marker" "refusing to replace a README without the derived ADR catalog marker" "$out"
check_equal "human-authored README remains intact" "# Team decision guide" "$(cat "$REPO/docs/decisions/README.md")"

fresh_repo
write_adr ADR-0001 Accepted "Pipe | title <visible>"
mv "$REPO/docs/decisions/ADR-0001-test.md" "$REPO/docs/decisions/ADR-0001-special#query?-->.md"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO")
check_contains "catalog rebuild accepts escapable Markdown names" "records: 1" "$out"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog check --repo "$REPO")
check_contains "escaped catalog validates" "records: 1" "$out"
catalog_text=$(cat "$REPO/docs/decisions/README.md")
check_contains "pipe in title stays in one table cell" 'ADR-0001: Pipe \| title &#60;visible&#62;' "$catalog_text"
check_contains "HTML delimiters remain visible metadata" 'Use Pipe \| title &#60;visible&#62;.' "$catalog_text"
check_contains "special link target is canonical" 'ADR-0001-special%23query%3F--%3E.md' "$catalog_text"
check_not_contains "source filename cannot terminate its comment" 'query?-->.md -->' "$catalog_text"
mv "$REPO/docs/decisions/ADR-0001-special#query?-->.md" "$REPO/docs/decisions/ADR-0001-special|pipe.md"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
out=$("$SHELL_UNDER_TEST" "$SCRIPT" catalog check --repo "$REPO")
check_contains "pipe filename catalog validates" "records: 1" "$out"
check_contains "pipe filename link is canonical" 'ADR-0001-special%7Cpipe.md' "$(cat "$REPO/docs/decisions/README.md")"
mv "$REPO/docs/decisions/ADR-0001-special|pipe.md" "$REPO/docs/decisions/ADR-0001-back\\slash-é.md"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
git -C "$REPO" add docs/decisions
git -C "$REPO" commit -qm "docs: commit byte-safe catalog fixture"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --status Accepted 2>&1)
check_contains "fresh catalog accepts backslash and non-ASCII filename" "ADR-0001 Accepted" "$out"
check_not_contains "byte-safe filename remains on catalog fast path" "using full scan" "$out"

echo "lifecycle transitions"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" check-transition --from Proposed --to Accepted)
check_contains "allows proposal acceptance" "Proposed -> Accepted: allowed" "$out"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" check-transition --from Rejected --to Accepted 2>&1)
rc=$?
set -e
check_equal "rejects terminal transition" 3 "$rc"
check_contains "names the rejected transition" "Rejected -> Accepted" "$out"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" check-transition --from Draft --to Accepted 2>&1)
rc=$?
set -e
check_equal "rejects unsupported status" 2 "$rc"
check_contains "names the unsupported status" "unsupported decision status: Draft" "$out"

echo "valid reciprocal supersession"
fresh_repo
write_adr ADR-0001 Superseded "Files for local state" "" "ADR-0002"
write_adr ADR-0002 Accepted "SQLite for local state" "ADR-0001"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO")
check_contains "accepts reciprocal relations" "valid: 2 ADR(s)" "$out"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --related-to ADR-0001)
check_contains "filters by relationship" "ADR-0002 Accepted" "$out"
check_contains "shows supersedes relation" "supersedes: ADR-0001" "$out"

echo "broken and cyclic supersession"
fresh_repo
write_adr ADR-0001 Accepted "First choice" "ADR-0002"
write_adr ADR-0002 Accepted "Second choice" "ADR-0001"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "invalid relationships fail validation" 4 "$rc"
check_contains "reports wrong target status" "must have status Superseded" "$out"
check_contains "reports cycles" "supersession relationship cycle" "$out"

echo "structure, identifiers, dates, and readability"
fresh_repo
write_adr ADR-0001 Accepted "Missing summary"
sed '/^Summary:/d' "$REPO/docs/decisions/ADR-0001-test.md" > "$REPO/docs/decisions/ADR-0001-test.md.new"
mv "$REPO/docs/decisions/ADR-0001-test.md.new" "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "missing canonical Summary fails" 4 "$rc"
check_contains "reports the required Summary field" "expected exactly one Summary field; found 0" "$out"

fresh_repo
write_adr ADR-0001 Accepted "Duplicate summary"
sed '/^Summary:/a\
Summary: A conflicting second summary.' "$REPO/docs/decisions/ADR-0001-test.md" > "$REPO/docs/decisions/ADR-0001-test.md.new"
mv "$REPO/docs/decisions/ADR-0001-test.md.new" "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "duplicate canonical Summary fails" 4 "$rc"
check_contains "reports exactly one Summary field" "expected exactly one Summary field; found 2" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
cp "$REPO/docs/decisions/ADR-0001-test.md" "$REPO/docs/decisions/ADR-0001-copy.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "duplicate identifiers fail" 4 "$rc"
check_contains "reports duplicate identifiers" "duplicate ADR identifier: ADR-0001" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
mv "$REPO/docs/decisions/ADR-0001-test.md" "$REPO/docs/decisions/ADR-0002-mismatch.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "filename disagreement fails" 4 "$rc"
check_contains "reports filename and heading disagreement" "ADR-0002 disagrees with heading identifier ADR-0001" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
sed 's/Date: 2026-07-19/Date: 2026-02-30/' "$REPO/docs/decisions/ADR-0001-test.md" > "$REPO/docs/decisions/ADR-0001-test.md.new"
mv "$REPO/docs/decisions/ADR-0001-test.md.new" "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "invalid calendar date fails" 4 "$rc"
check_contains "reports invalid ISO date" "not a valid ISO calendar date" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
chmod 000 "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
chmod 600 "$REPO/docs/decisions/ADR-0001-test.md"
if [[ $(id -u) -eq 0 ]]; then
  echo "  ok: unreadable ADR refusal skipped for root test user"
else
  check_equal "unreadable ADR fails" 4 "$rc"
  check_contains "unreadable ADR is named" "Markdown file is not readable" "$out"
fi

echo "Markdown fences and UTF-8 BOM"
fresh_repo
{
  printf '\357\273\277# ADR-0001: Fence-safe parsing\n\n'
  printf 'Status: Accepted\nDate: 2026-07-19\nSummary: Ignore fenced metadata.\n\n'
  # shellcheck disable=SC2016 # literal Markdown fence backticks, not command substitution
  printf '## Context\n\n```md\n## Decision\nStatus: Rejected\n```\n\n'
  printf '## Decision\n\nIgnore headings inside fences.\n\n'
  printf '## Consequences\n\nPortable parsing remains deterministic.\n'
} > "$REPO/docs/decisions/ADR-0001-fences.md"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO")
check_contains "ignores fenced fake headings and strips BOM" "valid: 1 ADR(s)" "$out"

fresh_repo
{
  printf '# ADR-0001: Empty fenced context\n\nStatus: Accepted\nDate: 2026-07-19\nSummary: Detect empty fenced context.\n\n'
  # shellcheck disable=SC2016 # literal Markdown fence backticks, not command substitution
  printf '## Context\n\n```text\n```\n\n## Decision\n\nUse it.\n\n## Consequences\n\nIt applies.\n'
} > "$REPO/docs/decisions/ADR-0001-empty-fence.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "empty fence does not satisfy a section" 4 "$rc"
check_contains "reports empty fenced Context" "Context section must occur once and contain content" "$out"

fresh_repo
{
  printf '# ADR-0001: Invalid fence close\n\nStatus: Accepted\nDate: 2026-07-19\nSummary: Detect unclosed fences.\n\n'
  # shellcheck disable=SC2016 # literal Markdown fence backticks, not command substitution
  printf '## Context\n\n```text\ncontent\n``` trailing\n## Decision\n\nhidden\n'
} > "$REPO/docs/decisions/ADR-0001-invalid-fence.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "trailing text does not close a fence" 4 "$rc"
check_contains "reports unclosed fence" "Markdown fence is not closed" "$out"

echo "ambiguous directories and occupied proposed paths"
fresh_repo
mkdir -p "$REPO/adrs"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" inspect --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "ambiguous ADR directories require selection" 3 "$rc"
check_contains "reports both candidate directories" "$REPO/docs/decisions" "$out"
check_contains "reports alternate candidate" "$REPO/adrs" "$out"

fresh_repo
mv "$REPO/docs/decisions" "$REPO/real-decisions"
ln -s ../real-decisions "$REPO/docs/decisions"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" inspect --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "in-repository ADR directory symlink fails" 2 "$rc"
check_contains "rejects in-repository ADR directory symlink" "ADR directory symlinks are not allowed" "$out"
for bypass in docs/decisions/ docs/decisions/.; do
  set +e
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" inspect --repo "$REPO" --dir "$bypass" 2>&1)
  rc=$?
  set -e
  check_equal "explicit symlink directory bypass fails: $bypass" 2 "$rc"
  check_contains "rejects explicit symlink directory bypass: $bypass" "ADR directory symlinks are not allowed" "$out"
done

fresh_repo
write_adr ADR-0001 Accepted "First"
ln -s missing "$REPO/docs/decisions/ADR-0002-checkpointed-local-state.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" next-id --repo "$REPO" --title "Checkpointed local state" 2>&1)
rc=$?
set -e
check_equal "unsafe occupied ADR entry fails before allocation" 4 "$rc"
check_contains "names occupied symlink ADR path" "ADR symlinks are not allowed" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
mkdir "$REPO/mock-bin"
real_sed=$(command -v sed)
# shellcheck disable=SC2016 # $@/$?/$rc/$OCCUPY_PATH must stay literal for the generated stub
printf '#!/bin/sh\n%s "$@"\nrc=$?\n: > "$OCCUPY_PATH"\nexit "$rc"\n' "$real_sed" > "$REPO/mock-bin/sed"
chmod +x "$REPO/mock-bin/sed"
occupied="$REPO/docs/decisions/ADR-0002-checkpointed-local-state.md"
set +e
out=$(OCCUPY_PATH="$occupied" PATH="$REPO/mock-bin:$PATH" "$SHELL_UNDER_TEST" "$SCRIPT" next-id --repo "$REPO" --title "Checkpointed local state" 2>&1)
rc=$?
set -e
check_equal "late occupied proposed path fails" 4 "$rc"
check_contains "reports late occupied proposed path" "next ADR path is already occupied: $occupied" "$out"

echo "unsafe entries, bounded metadata, and relationship edge cases"
fresh_repo
printf '# unrelated notes\n' > "$REPO/docs/decisions/notes.md"
mkdir "$REPO/docs/decisions/ADR-0002-directory.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "malformed Markdown and occupied directory fail" 4 "$rc"
check_contains "does not silently skip unrelated Markdown" "notes.md: filename does not carry its ADR identifier" "$out"
check_contains "rejects unsupported Markdown entry type" "unsupported file type" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
ln -s "$REPO/README.md" "$REPO/docs/decisions/ADR-0002-escape.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "symlinked ADR record fails" 4 "$rc"
check_contains "rejects symlinked ADR record" "ADR symlinks are not allowed" "$out"

fresh_repo
outside=$(mktemp -d)
TEMP_REPOS="$TEMP_REPOS $outside"
rmdir "$REPO/docs/decisions"
ln -s "$outside" "$REPO/docs/decisions"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" inspect --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "symlinked ADR directory escape fails" 2 "$rc"
check_contains "rejects symlinked ADR directory escape" "ADR directory symlinks are not allowed" "$out"

fresh_repo
control_path="$REPO/docs/decisions/"$'ADR-0001-bad\nname.md'
printf '# ADR-0001: Bad filename\n' > "$control_path"
printf '# ADR-0002: Bad escape\n' > "$REPO/docs/decisions/"$'ADR-0002-bad\033name.md'
printf '# ADR-0003: Bad bell\n' > "$REPO/docs/decisions/"$'ADR-0003-bad\007name.md'
printf '# ADR-0004: Bad delete\n' > "$REPO/docs/decisions/"$'ADR-0004-bad\177name.md'
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "control character filename fails" 4 "$rc"
check_contains "reports control byte filenames safely" "4 ADR filename(s) contain unsupported control bytes" "$out"
check_not_contains "does not emit escape from filename" $'\033' "$out"
check_not_contains "does not emit bell from filename" $'\007' "$out"
check_not_contains "does not emit delete from filename" $'\177' "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
sed -e 's/Status: Accepted/Status: /' -e 's/Date: 2026-07-19/Date: 2026-07-19\
Supersedes: /' "$REPO/docs/decisions/ADR-0001-test.md" > "$REPO/docs/decisions/rewrite"
mv "$REPO/docs/decisions/rewrite" "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "blank metadata fails" 4 "$rc"
check_contains "reports blank optional metadata" "Supersedes field is blank" "$out"

fresh_repo
write_adr ADR-0001 Superseded "Old" "" "ADR-0002"
write_adr ADR-0002 Accepted "New" "ADR-0001, ADR-0001"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "duplicate relationship target fails" 4 "$rc"
check_contains "reports duplicate relationship target" "duplicate Supersedes target: ADR-0001" "$out"

fresh_repo
write_adr ADR-999999999999999999 Accepted "Last identifier"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" next-id --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "identifier exhaustion fails" 4 "$rc"
check_contains "reports identifier exhaustion" "identifier space is exhausted" "$out"

fresh_repo
write_adr ADR-1000000000000000000 Accepted "Too wide"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "wider than 18 digits fails" 4 "$rc"
check_contains "reports identifier digit limit" "18-digit limit" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First"
long_search=$(printf '%0201d' 0)
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search "$long_search" 2>&1)
rc=$?
set -e
check_equal "oversized search fails" 2 "$rc"
check_contains "reports search cap" "--search must be at most 200 bytes" "$out"

for control in $'\033' $'\007' $'\177'; do
  set +e
  out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --search "missing${control}control" 2>&1)
  rc=$?
  set -e
  check_equal "control byte search fails" 2 "$rc"
  check_contains "reports unsafe search generically" "--search contains unsupported control bytes" "$out"
  check_not_contains "does not echo unsafe search byte" "$control" "$out"
done

fresh_repo
long_title=$(printf '%0241d' 0)
long_summary=$(printf 'S%0500d' 0)
long_relation=$(printf 'A%01000d' 0)
long_revisit=$(printf 'R%0500d' 0)
write_adr ADR-0001 Accepted "$long_title" "$long_relation" "" "$long_revisit"
sed "s/^Summary:.*/Summary: $long_summary/" "$REPO/docs/decisions/ADR-0001-test.md" > "$REPO/docs/decisions/ADR-0001-test.md.new"
mv "$REPO/docs/decisions/ADR-0001-test.md.new" "$REPO/docs/decisions/ADR-0001-test.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "oversized metadata fails" 4 "$rc"
check_contains "reports title cap" "title exceeds 240 bytes" "$out"
check_contains "reports Summary cap" "Summary exceeds 500 bytes" "$out"
check_contains "reports relation cap" "Supersedes exceeds 1000 bytes" "$out"
check_contains "reports revisit cap" "Revisit when exceeds 500 bytes" "$out"

echo "deterministic tool failure handling"
fresh_repo
mkdir "$REPO/mock-bin"
printf '#!/bin/sh\nexit 7\n' > "$REPO/mock-bin/find"
chmod +x "$REPO/mock-bin/find"
set +e
out=$(PATH="$REPO/mock-bin:$PATH" "$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "find failure is refused" 4 "$rc"
check_contains "names find failure" "cannot enumerate Markdown entries" "$out"

printf '#!/bin/sh\nexit 7\n' > "$REPO/mock-bin/sort"
chmod +x "$REPO/mock-bin/sort"
rm "$REPO/mock-bin/find"
write_adr ADR-0001 Accepted "First"
set +e
out=$(PATH="$REPO/mock-bin:$PATH" "$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "sort failure is refused" 4 "$rc"
check_contains "names sort failure" "cannot sort ADR paths" "$out"

real_awk=$(command -v awk)
printf '#!/bin/sh\ncase "$*" in *ADR-0001-test.md*) exit 7;; esac\nexec %s "$@"\n' "$real_awk" > "$REPO/mock-bin/awk"
chmod +x "$REPO/mock-bin/awk"
rm "$REPO/mock-bin/sort"
set +e
out=$(PATH="$REPO/mock-bin:$PATH" "$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "ADR parser failure is refused" 4 "$rc"
check_contains "names ADR parser failure" "cannot parse ADR file" "$out"

echo "deterministic malformed path diagnostics"
fresh_repo
printf '# malformed z\n' > "$REPO/docs/decisions/z.md"
printf '# malformed a\n' > "$REPO/docs/decisions/a.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "malformed paths fail" 4 "$rc"
check_order "malformed path diagnostics are sorted" "$REPO/docs/decisions/a.md" "$REPO/docs/decisions/z.md" "$out"

echo "canonical model-facing record paths"
fresh_repo
write_adr ADR-0001 Accepted "Canonical path"
record="$REPO/docs/decisions/ADR-0001-test.md"
before=$(git -C "$REPO" status --porcelain --untracked-files=all)
before_hash=$(git -C "$REPO" hash-object "$record")
out=$("$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path docs/decisions/ADR-0001-test.md)
check_equal "resolves relative record path" "path: $record" "$out"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path "$record")
check_equal "preserves absolute record path" "path: $record" "$out"
ln -s "$record" "$REPO/docs/decisions/linked.md"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path docs/decisions/linked.md 2>&1)
rc=$?
set -e
check_equal "symlinked canonical record is refused" 2 "$rc"
check_contains "names symlink refusal" "canonical record symlinks are not allowed" "$out"
rm "$REPO/docs/decisions/linked.md"
ln -s "$REPO/docs/decisions" "$REPO/linked-decisions"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path linked-decisions/ADR-0001-test.md 2>&1)
rc=$?
set -e
check_equal "symlinked ancestor is refused" 2 "$rc"
check_contains "names ancestor symlink refusal" "canonical record symlinks are not allowed" "$out"
rm "$REPO/linked-decisions"
outside="$(dirname "$REPO")/darrow-decisions-outside-$$"
TEMP_REPOS="$TEMP_REPOS $outside"
printf 'outside\n' > "$outside"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path "$outside" 2>&1)
rc=$?
set -e
check_equal "existing outside record is refused" 2 "$rc"
check_contains "names containment refusal" "canonical record escapes the repository root" "$out"
long_path=$(awk 'BEGIN {for (i=0; i<2000; i++) printf "x"}')
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path "$long_path" 2>&1)
rc=$?
set -e
check_equal "large path is refused" 2 "$rc"
check_equal "large path refusal stays bounded" "error: --path must be at most 1000 bytes" "$out"
set +e
"$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path "$record" --dir docs/decisions >/dev/null 2>&1
rc_dir=$?
"$SHELL_UNDER_TEST" "$SCRIPT" canonical-path --repo "$REPO" --path "$record" --limit 50 >/dev/null 2>&1
rc_limit=$?
set -e
check_equal "canonical path refuses --dir" 2 "$rc_dir"
check_equal "canonical path refuses --limit" 2 "$rc_limit"
after=$(git -C "$REPO" status --porcelain --untracked-files=all)
after_hash=$(git -C "$REPO" hash-object "$record")
check_equal "canonical path leaves repository status unchanged" "$before" "$after"
check_equal "canonical path leaves record content unchanged" "$before_hash" "$after_hash"

echo "large reciprocal fan-out and deterministic cycle diagnostics"
fresh_repo
relations=""
i=1
while [[ $i -le 40 ]]; do
  printf -v id 'ADR-%04d' "$i"
  write_adr "$id" Superseded "Old $i" "" "ADR-0041"
  if [[ -z "$relations" ]]; then relations=$id; else relations="$relations, $id"; fi
  i=$((i + 1))
done
write_adr ADR-0041 Accepted "Consolidated" "$relations"
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO")
check_contains "validates large reciprocal fan-out" "valid: 41 ADR(s)" "$out"

fresh_repo
write_adr ADR-0001 Accepted "First choice" "ADR-0002"
write_adr ADR-0002 Accepted "Second choice" "ADR-0001"
set +e
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO" 2>&1)
rc=$?
set -e
check_equal "cyclic graph remains invalid" 4 "$rc"
check_contains "cycle diagnostic names absolute path" "$REPO/docs/decisions/ADR-0002-test.md: supersession relationship cycle" "$out"

echo "bounded output and large input"
fresh_repo
write_adr ADR-0001 Accepted "Decision one"
write_adr ADR-0002 Accepted "Decision two"
write_adr ADR-0003 Accepted "Decision three"
out=$("$SHELL_UNDER_TEST" "$SCRIPT" list --repo "$REPO" --limit 2)
check_contains "states output cap" "note: showing first 2 of 3 matching ADRs" "$out"
check_not_contains "does not print third capped record" "ADR-0003 Accepted" "$out"
i=0
while [[ $i -lt 6000 ]]; do printf 'Large context line %s with \\ paths.\n' "$i" >> "$REPO/docs/decisions/ADR-0003-test.md"; i=$((i + 1)); done
"$SHELL_UNDER_TEST" "$SCRIPT" catalog rebuild --repo "$REPO" >/dev/null
out=$("$SHELL_UNDER_TEST" "$SCRIPT" validate --repo "$REPO")
check_contains "handles large ADR content" "valid: 3 ADR(s)" "$out"

if [[ $FAILURES -ne 0 ]]; then
  echo "$FAILURES test(s) failed" >&2
  exit 1
fi
echo "all decision facade tests passed"
