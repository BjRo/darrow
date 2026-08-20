#!/usr/bin/env bash
# Deterministic tests for commit.sh. Covers the script-enforced invariants so
# model evals only need to cover judgment. Run: bash commit.test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/commit.sh"
FAILURES=0

check() {
  local desc=$1 expected=$2 actual=$3
  if [[ "$actual" == "$expected" ]]; then
    echo "  ok: $desc"
  else
    echo "  FAIL: $desc (expected $expected, got $actual)"
    FAILURES=$((FAILURES + 1))
  fi
}

# NOT a command substitution: cd must affect the caller, never the source repo.
fresh_repo() {
  REPO=$(mktemp -d)
  cd "$REPO" || exit 70
  # Guard: every git operation below must happen inside the temp repo.
  [[ "$PWD" == "$REPO" ]] || { echo "abort: not in temp repo" >&2; exit 70; }
  git init -qb main
  git config user.email t@t.local
  git config user.name t
  echo base > base.txt
  git add base.txt
  git commit -qm "chore: init"
}

echo "# H1: large diff must not SIGPIPE (exit 141)"
fresh_repo
for i in $(seq 1 5000); do echo "padding line $i for a diff far beyond the truncation cutoff"; done > big.txt
git add big.txt
bash "$SCRIPT" inspect > /dev/null 2>&1
check "inspect exit 0 on huge staged diff" 0 $?
echo change >> base.txt
bash "$SCRIPT" diff base.txt > /dev/null 2>&1
check "diff exit 0" 0 $?

echo "# H2: staged set + extra paths rejected"
fresh_repo
echo a > a.txt && echo b > b.txt && git add a.txt
bash "$SCRIPT" commit -m "feat: a" b.txt > /dev/null 2>&1
check "exit 7" 7 $?
check "b.txt not staged" "" "$(git diff --cached --name-only | grep b.txt || true)"

echo "# H3: authorized staged retry refreshes only an existing staged path"
fresh_repo
echo base > tracked.txt && echo base > preserved.txt
git add tracked.txt preserved.txt && git commit -qm "chore: track files"
echo staged > tracked.txt && echo staged-preserved > preserved.txt
git add tracked.txt preserved.txt
echo worktree-preserved > preserved.txt
echo outside > outside.txt
mkdir -p .git/hooks
printf '#!/bin/sh\necho "run: printf corrected > tracked.txt" >&2\ngit show :tracked.txt | grep -qx corrected\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
bash "$SCRIPT" commit -m "fix: correct tracked file" > /dev/null 2>&1
check "hook failure preserves history" 2 "$(git rev-list --count HEAD)"
echo corrected > tracked.txt
bash "$SCRIPT" retry --after-hook-failure --refresh-staged tracked.txt -m "fix: correct tracked file" > /dev/null 2>&1
check "authorized retry commits" 0 $?
check "retry commits corrected content" "corrected" "$(git show HEAD:tracked.txt)"
check "retry preserves other staged blob" "staged-preserved" "$(git show HEAD:preserved.txt)"
check "retry leaves other worktree correction unstaged" "worktree-preserved" "$(cat preserved.txt)"
check "outside file remains untracked" "?? outside.txt" "$(git status --short outside.txt)"

echo "# H4: retry refuses an outside-staged path without mutation"
fresh_repo
echo staged > tracked.txt && git add tracked.txt
echo outside > outside.txt
before_index=$(git write-tree)
before_head=$(git rev-parse HEAD)
bash "$SCRIPT" retry --after-hook-failure --refresh-staged outside.txt -m "fix: correct tracked file" > /dev/null 2>&1
check "outside staged retry rejected" 7 $?
check "outside refusal preserves index" "$before_index" "$(git write-tree)"
check "outside refusal preserves history" "$before_head" "$(git rev-parse HEAD)"
check "outside refusal preserves worktree" "outside" "$(cat outside.txt)"

echo "# H5: retry refuses a directory pathspec without mutation"
fresh_repo
mkdir src
echo base > src/staged.txt && git add src/staged.txt && git commit -qm "chore: track source"
echo staged > src/staged.txt && git add src/staged.txt
echo unrelated > src/untracked.txt
before_index=$(git write-tree)
before_head=$(git rev-parse HEAD)
bash "$SCRIPT" retry --after-hook-failure --refresh-staged src -m "fix: correct tracked file" > /dev/null 2>&1
check "directory retry rejected" 7 $?
check "directory refusal preserves index" "$before_index" "$(git write-tree)"
check "directory refusal preserves history" "$before_head" "$(git rev-parse HEAD)"
check "directory refusal preserves untracked file" "unrelated" "$(cat src/untracked.txt)"

echo "# H6: hook-directed remediation preserves the staged retry boundary"
fresh_repo
echo base > tracked.txt && git add tracked.txt && git commit -qm "chore: track file"
echo stale > tracked.txt && git add tracked.txt
mkdir -p .git/hooks
printf '#!/bin/sh\necho "run: printf corrected > tracked.txt" >&2\ngit show :tracked.txt | grep -qx corrected\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
bash "$SCRIPT" commit -m "fix: correct tracked file" > /dev/null 2>&1
check "hook failure preserves remediation precondition" 2 "$(git rev-list --count HEAD)"
bash "$SCRIPT" remediate --after-hook-failure --command "printf corrected > tracked.txt" --refresh-staged tracked.txt -m "fix: correct tracked file" > /dev/null 2>&1
check "unambiguous remediation commits" 0 $?
check "remediation commits corrected content" "corrected" "$(git show HEAD:tracked.txt)"

echo "# H7: remediation index mutation is restored and refused"
fresh_repo
echo base > tracked.txt && git add tracked.txt && git commit -qm "chore: track file"
echo stale > tracked.txt && git add tracked.txt
echo outside > outside.txt
mkdir -p .git/hooks
printf '#!/bin/sh\necho "run: git add outside.txt" >&2\nexit 1\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
bash "$SCRIPT" commit -m "fix: correct tracked file" > /dev/null 2>&1
before_index=$(git write-tree)
before_head=$(git rev-parse HEAD)
bash "$SCRIPT" remediate --after-hook-failure --command "git add outside.txt" --refresh-staged tracked.txt -m "fix: correct tracked file" > /dev/null 2>&1
check "index-mutating remediation rejected" 7 $?
check "index-mutating remediation restores index" "$before_index" "$(git write-tree)"
check "index-mutating remediation preserves history" "$before_head" "$(git rev-parse HEAD)"
check "index-mutating remediation preserves worktree" "outside" "$(cat outside.txt)"

echo "# H8: remediation not present in hook diagnostics is refused"
fresh_repo
echo stale > tracked.txt && git add tracked.txt
mkdir -p .git/hooks
printf '#!/bin/sh\necho "run: printf corrected > tracked.txt" >&2\nexit 1\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
bash "$SCRIPT" commit -m "fix: correct tracked file" > /dev/null 2>&1
before_index=$(git write-tree)
before_head=$(git rev-parse HEAD)
bash "$SCRIPT" remediate --after-hook-failure --command "printf unrelated > tracked.txt" --refresh-staged tracked.txt -m "fix: correct tracked file" > /dev/null 2>&1
check "unreported remediation rejected" 7 $?
check "unreported remediation preserves index" "$before_index" "$(git write-tree)"
check "unreported remediation preserves history" "$before_head" "$(git rev-parse HEAD)"

echo "# M1: sweep shortcuts rejected"
fresh_repo
echo x > x.txt
for arg in "." ".." "*.txt" "-A" ":/"; do
  bash "$SCRIPT" commit -m "feat: sweep" "$arg" > /dev/null 2>&1
  check "reject '$arg'" 7 $?
done

echo "# M2: human co-author accepted"
fresh_repo
echo x > x.txt && git add x.txt
bash "$SCRIPT" commit -m "feat: x" -m "Co-authored-by: Nicolai Parlog <nicolai@example.org>" > /dev/null 2>&1
check "human trailer commits" 0 $?

echo "# M3: attribution variants rejected"
for msg in "Generated with Claude Code" "Generated by Claude" "Generated using Claude Code" "Built with Claude Code" "Assisted by Codex" "Written by claude" "Written by an AI" "Co-authored by Claude" "Co-authored-by: Claude <noreply@anthropic.com>"; do
  fresh_repo
  echo x > x.txt && git add x.txt
  bash "$SCRIPT" commit -m "feat: x" -m "$msg" > /dev/null 2>&1
  check "reject '$msg'" 6 $?
done

echo "# M3c: attribution at the end of a huge message still caught"
fresh_repo
echo x > x.txt && git add x.txt
big=$(awk 'BEGIN{for(i=0;i<20000;i++) printf "word %d ab. ", i}')
bash "$SCRIPT" commit -m "feat: x" -m "$big" -m "Generated with Claude Code" > /dev/null 2>&1
check "200KB message attribution rejected (no SIGPIPE bypass)" 6 $?

echo "# M3b: legitimate tool prose accepted"
fresh_repo
echo x > x.txt && git add x.txt
bash "$SCRIPT" commit -m "chore: regenerate api client" -m "The client is now generated by openapi-generator from the v2 spec." > /dev/null 2>&1
check "generated-by non-AI tool commits" 0 $?

echo "# M4: conflict state detected"
fresh_repo
git checkout -qb side
echo side > base.txt && git commit -qam "feat: side"
git checkout -q main
echo main > base.txt && git commit -qam "feat: main"
git merge side -q > /dev/null 2>&1 || true
out=$(bash "$SCRIPT" inspect)
check "inspect exit 0 in conflict" 0 $?
echo "$out" | grep -q "mode: conflict"
check "conflict marker present" 0 $?
bash "$SCRIPT" commit -m "feat: merge" > /dev/null 2>&1
check "commit refused, exit 8" 8 $?

echo "# L1: dangling -m explains itself"
fresh_repo
err=$(bash "$SCRIPT" commit -m 2>&1 >/dev/null)
status=$?
check "exit 2" 2 $status
echo "$err" | grep -q "needs a value"
check "explanatory error" 0 $?

echo "# L3: diff works for untracked files"
fresh_repo
echo new > brand-new.txt
out=$(bash "$SCRIPT" diff brand-new.txt)
check "exit 0" 0 $?
echo "$out" | grep -q "brand-new"
check "shows content as new-file diff" 0 $?

echo "# L5: subject rules apply to first line only"
fresh_repo
echo x > x.txt && git add x.txt
bash "$SCRIPT" commit -m "feat: x
this second line inside msgs[0] may be long and end with a period." > /dev/null 2>&1
check "multi-line msgs[0] with valid first line commits" 0 $?

echo "# format guards still hold"
fresh_repo
echo x > x.txt && git add x.txt
bash "$SCRIPT" commit -m "updated stuff" > /dev/null 2>&1
check "non-conventional subject rejected" 5 $?
bash "$SCRIPT" commit -m "feat: x." > /dev/null 2>&1
check "trailing period rejected" 5 $?

echo
if [[ $FAILURES -gt 0 ]]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all green"
