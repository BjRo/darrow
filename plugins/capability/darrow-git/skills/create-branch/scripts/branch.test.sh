#!/usr/bin/env bash
# Deterministic tests for branch.sh. Covers the script-enforced invariants so
# model evals only need to cover judgment. Run: bash branch.test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/branch.sh"
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

# NOT a cmd substitution: cd must affect the caller, never the src repo.
fresh_repo() {
  REPO=$(mktemp -d)
  cd "$REPO" || exit 70
  # Guard: every git op below must happen inside the temp repo.
  [[ "$PWD" == "$REPO" ]] || { echo "abort: not in temp repo" >&2; exit 70; }
  git init -qb main
  git config user.email t@t.local
  git config user.name t
  echo base > base.txt
  git add base.txt
  git commit -qm "chore: init"
}

echo "# N1: valid names accepted"
fresh_repo
out=$(bash "$SCRIPT" create feat/add-login)
check "exit 0" 0 $?
check "reports name + base" "feat/add-login (from main)" "$out"
check "on new branch" feat/add-login "$(git symbolic-ref --short HEAD)"
bash "$SCRIPT" create fix/DAR-123-null-check > /dev/null 2>&1
check "ticket-id caps accepted" 0 $?
bash "$SCRIPT" create feat/dar-456-retry > /dev/null 2>&1
check "lowercased ticket accepted" 0 $?
name60="feat/$(printf 'a%.0s' $(seq 1 55))"
bash "$SCRIPT" create "$name60" > /dev/null 2>&1
check "exactly 60 chars accepted" 0 $?
fresh_repo
out=$(bash "$SCRIPT" create fix/issue-64-preserve-ticket-identifiers --ticket-token issue-64)
check "issue token preserved at slug start" 0 $?
check "issue token branch exact" "fix/issue-64-preserve-ticket-identifiers (from main)" "$out"
fresh_repo
out=$(bash "$SCRIPT" create feat/DAR-123-retry-logic --ticket-token DAR-123)
check "opaque provider token preserved" 0 $?
check "opaque provider token branch exact" "feat/DAR-123-retry-logic (from main)" "$out"
fresh_repo
out=$(bash "$SCRIPT" create feat/ABC_42-retry-logic --ticket-token ABC_42)
check "underscore provider token preserved" 0 $?
check "underscore provider token branch exact" "feat/ABC_42-retry-logic (from main)" "$out"
fresh_repo
out=$(bash "$SCRIPT" create feat/Dar-123-retry-logic --ticket-token Dar-123)
check "mixed-case provider token preserved" 0 $?
check "mixed-case provider token branch exact" "feat/Dar-123-retry-logic (from main)" "$out"
fresh_repo
bash "$SCRIPT" create fix/preserve-issue-64 --ticket-token issue-64 > /dev/null 2>&1
check "refuse non-leading token" 5 $?
check "refusal creates no branch" 1 "$(git for-each-ref refs/heads | wc -l | tr -d ' ')"
fresh_repo
bash "$SCRIPT" create fix/issue-64-preserve-issue-64 --ticket-token issue-64 > /dev/null 2>&1
check "refuse repeated token" 5 $?
check "repeat refusal creates no branch" 1 "$(git for-each-ref refs/heads | wc -l | tr -d ' ')"

echo "# N2: invalid names rejected (exit 5)"
fresh_repo
for name in "add-login" "feature/add-login" "feat/Add-Login" "feat/addLogin" "feat/add_login" "feat/add--login" "feat/-login" "feat/ADD-LOGIN" "feat/X" "feat/DAR-abc"; do
  bash "$SCRIPT" create "$name" > /dev/null 2>&1
  check "reject '$name'" 5 $?
done
long="feat/$(printf 'a%.0s' $(seq 1 60))"
bash "$SCRIPT" create "$long" > /dev/null 2>&1
check "reject >60 chars" 5 $?
check "no branch created" 1 "$(git for-each-ref refs/heads | wc -l | tr -d ' ')"

echo "# N3: existing branch not clobbered (exit 9)"
fresh_repo
git branch feat/login
echo more > base.txt && git commit -qam "feat: advance main"
bash "$SCRIPT" create feat/login > /dev/null 2>&1
check "exit 9" 9 $?
check "tip unmoved" 1 "$(git rev-list --count feat/login)"
check "still on main" main "$(git symbolic-ref --short HEAD)"
git branch feat/CAPS-1-loose
bash "$SCRIPT" create feat/caps-1-loose > /dev/null 2>&1
check "case-variant of loose ref, exit 9" 9 $?
git branch feat/PACKED-1-x
git pack-refs --all
bash "$SCRIPT" create feat/packed-1-x > /dev/null 2>&1
check "case-variant of packed ref, exit 9" 9 $?
check "packed tip unmoved" "$(git rev-parse main)" "$(git rev-parse feat/PACKED-1-x)"

echo "# N4: in-progress states block branching"
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
bash "$SCRIPT" create chore/cleanup > /dev/null 2>&1
check "create refused, exit 8" 8 $?
mkdir -p sub
out=$(cd sub && bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: conflict"
check "conflict detected from subdirectory" 0 $?
git add base.txt
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: conflict"
check "resolved-but-uncommitted merge still blocks" 0 $?
bash "$SCRIPT" create chore/cleanup > /dev/null 2>&1
check "create refused mid-merge, exit 8" 8 $?

echo "# N5: dirty tree travels along, nothing stashed"
fresh_repo
echo dirty >> base.txt
bash "$SCRIPT" create fix/typo > /dev/null 2>&1
check "exit 0" 0 $?
check "on new branch" fix/typo "$(git symbolic-ref --short HEAD)"
check "change still present" " M base.txt" "$(git status --porcelain)"
check "stash empty" "" "$(git stash list)"

echo "# N6: --from base handling"
fresh_repo
git checkout -qb feat/other
echo other > other.txt && git add other.txt && git commit -qm "feat: other"
out=$(bash "$SCRIPT" create fix/from-main --from main)
check "exit 0" 0 $?
check "reports given base" "fix/from-main (from main)" "$out"
check "tip equals main" "$(git rev-parse main)" "$(git rev-parse HEAD)"
bash "$SCRIPT" create fix/x --from no-such-ref > /dev/null 2>&1
check "unknown base, exit 2" 2 $?
bash "$SCRIPT" create fix/x --from > /dev/null 2>&1
check "dangling --from, exit 2" 2 $?

echo "# N7: usage errors"
fresh_repo
bash "$SCRIPT" > /dev/null 2>&1
check "no command, exit 64" 64 $?
bash "$SCRIPT" create > /dev/null 2>&1
check "no name, exit 2" 2 $?
bash "$SCRIPT" create feat/a feat/b > /dev/null 2>&1
check "two names, exit 2" 2 $?
bash "$SCRIPT" create feat/a -f > /dev/null 2>&1
check "unknown flag, exit 2" 2 $?

echo "# N8: inspect output"
fresh_repo
out=$(bash "$SCRIPT" inspect)
check "exit 0" 0 $?
echo "$out" | grep -q "mode: ready"
check "ready marker" 0 $?
echo "$out" | grep -q "clean"
check "clean tree reported" 0 $?
echo "$out" | grep -q "current branch: main"
check "current branch shown" 0 $?
echo dirty >> base.txt
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q " M base.txt"
check "dirty file listed" 0 $?
git checkout -q --detach
out=$(bash "$SCRIPT" inspect)
check "inspect exit 0 on detached HEAD" 0 $?
echo "$out" | grep -q "detached @"
check "detached reported" 0 $?

echo "# N9: switch refusal relays verbatim, loses nothing (exit 4)"
fresh_repo
git checkout -qb feat/other
echo other > base.txt && git commit -qam "feat: other"
echo dirty >> base.txt
bash "$SCRIPT" create fix/refused --from main > /dev/null 2>&1
check "switch refused, exit 4" 4 $?
check "still on feat/other" feat/other "$(git symbolic-ref --short HEAD)"
grep -q dirty base.txt
check "dirty change intact" 0 $?
check "no branch created" "" "$(git for-each-ref refs/heads --format='%(refname:short)' | grep fix/refused || true)"
check "stash empty" "" "$(git stash list)"

echo "# N10: create works from detached HEAD"
fresh_repo
git checkout -q --detach
out=$(bash "$SCRIPT" create feat/from-detached)
check "exit 0" 0 $?
check "on new branch" feat/from-detached "$(git symbolic-ref --short HEAD)"
echo "$out" | grep -q "detached @"
check "detached base reported" 0 $?

echo "# N11: unborn repo refused (exit 3)"
UNBORN=$(mktemp -d)
cd "$UNBORN" && git init -qb main
bash "$SCRIPT" create feat/first > /dev/null 2>&1
check "create refused, exit 3" 3 $?
check "no half-made branch" "" "$(git for-each-ref refs/heads)"
bash "$SCRIPT" inspect > /dev/null 2>&1
check "inspect still works" 0 $?

echo "# N12: outside a work tree refused (exit 3)"
cd "$(mktemp -d)" || exit 1
bash "$SCRIPT" inspect > /dev/null 2>&1
check "inspect exit 3" 3 $?
bash "$SCRIPT" create feat/x > /dev/null 2>&1
check "create exit 3" 3 $?

echo "# N13: worktree default path"
fresh_repo
TOP=$(git rev-parse --show-toplevel)  # mktemp path may be a symlink on macOS
out=$(bash "$SCRIPT" create feat/wt-default --worktree)
check "exit 0" 0 $?
check "reports name, base, path" "feat/wt-default (from main) at $TOP/.worktrees/feat/wt-default" "$out"
check "worktree registered" 2 "$(git worktree list --porcelain | grep -c '^worktree ')"
check "branch checked out there" feat/wt-default "$(git -C .worktrees/feat/wt-default symbolic-ref --short HEAD)"
check "current checkout untouched" main "$(git symbolic-ref --short HEAD)"
check "status stays clean (excluded)" "" "$(git status --porcelain)"
bash "$SCRIPT" create feat/wt-second --worktree > /dev/null
check "second worktree ok" 0 $?
check "exclude entry not duplicated" 1 "$(grep -cxF '/.worktrees/' .git/info/exclude)"
mkdir -p sub
out=$(cd sub && bash "$SCRIPT" create feat/wt-subdir --worktree)
check "default path is toplevel-based from subdir" "feat/wt-subdir (from main) at $TOP/.worktrees/feat/wt-subdir" "$out"
out=$(cd .worktrees/feat/wt-default && bash "$SCRIPT" create feat/wt-nested --worktree)
check "anchored at main root from linked worktree" "feat/wt-nested (from feat/wt-default) at $TOP/.worktrees/feat/wt-nested" "$out"

echo "# N14: worktree --at custom path"
fresh_repo
CALLER=$PWD
AT=$(mktemp -d)/custom-wt
out=$(bash "$SCRIPT" create fix/at-outside --worktree --at "$AT")
check "exit 0" 0 $?
check "path used verbatim" "fix/at-outside (from main) at $AT" "$out"
check "branch checked out there" fix/at-outside "$(git -C "$AT" symbolic-ref --short HEAD)"
echo "$out" | grep -q "## note:.*git status"
check "no status note for outside path" 1 $?
out=$(bash "$SCRIPT" create fix/at-inside --worktree --at inside-wt)
check "inside-repo path accepted" 0 $?
echo "$out" | grep -q "fix/at-inside (from main) at $CALLER/inside-wt"
check "relative custom path is reported as absolute" 0 $?
echo "$out" | grep -q "## note: $CALLER/inside-wt is inside the repository and not ignored"
check "status-visibility note printed" 0 $?
bash "$SCRIPT" create fix/at-alone --at somewhere > /dev/null 2>&1
check "--at without --worktree, exit 2" 2 $?
bash "$SCRIPT" create fix/at-dangling --worktree --at > /dev/null 2>&1
check "dangling --at, exit 2" 2 $?
bash "$SCRIPT" create fix/at-empty --worktree --at "" > /dev/null 2>&1
check "empty --at rejected, exit 2" 2 $?
bash "$SCRIPT" create fix/at-empty2 --at "" > /dev/null 2>&1
check "empty --at without --worktree, exit 2" 2 $?
check "nothing created for empty --at" "" "$(git for-each-ref refs/heads --format='%(refname:short)' | grep at-empty || true)"
bash "$SCRIPT" create fix/at-gitdir --worktree --at .git/inner-wt > /dev/null 2>&1
check "--at inside .git rejected, exit 2" 2 $?

echo "# N15: worktree path and branch collisions (exit 9)"
fresh_repo
mkdir -p .worktrees/feat/wt-clash
bash "$SCRIPT" create feat/wt-clash --worktree > /dev/null 2>&1
check "existing default path, exit 9" 9 $?
check "no branch created" "" "$(git for-each-ref refs/heads --format='%(refname:short)' | grep wt-clash || true)"
check "no exclude side effect before refusal" "" "$(grep -xF '/.worktrees/' .git/info/exclude 2>/dev/null || true)"
touch clashfile
bash "$SCRIPT" create feat/wt-file --worktree --at clashfile > /dev/null 2>&1
check "existing file at --at, exit 9" 9 $?
bash "$SCRIPT" create feat/wt-slash --worktree --at clashfile/ > /dev/null 2>&1
check "trailing-slash file caught, exit 9" 9 $?
git branch feat/wt-exists
bash "$SCRIPT" create feat/wt-exists --worktree > /dev/null 2>&1
check "existing branch with --worktree, exit 9" 9 $?
check "no worktree created" 1 "$(git worktree list --porcelain | grep -c '^worktree ')"
fresh_repo
touch .worktrees
bash "$SCRIPT" create feat/wt-parentfile --worktree > /dev/null 2>&1
check ".worktrees as regular file, exit 9" 9 $?
check "no branch created" "" "$(git for-each-ref refs/heads --format='%(refname:short)' | grep parentfile || true)"

echo "# N16: worktree leaves dirty tree behind"
fresh_repo
echo dirty >> base.txt
out=$(bash "$SCRIPT" create fix/wt-dirty --worktree)
check "exit 0" 0 $?
echo "$out" | grep -q "## note: uncommitted changes stay in the current worktree"
check "stay-behind note printed" 0 $?
check "change still in current checkout" " M base.txt" "$(git status --porcelain)"
check "worktree checkout clean" "" "$(git -C .worktrees/fix/wt-dirty status --porcelain)"
check "stash empty" "" "$(git stash list)"

echo "# N17: worktree --from base"
fresh_repo
git checkout -qb feat/other
echo other > other.txt && git add other.txt && git commit -qm "feat: other"
out=$(bash "$SCRIPT" create fix/wt-from --worktree --from main)
check "exit 0" 0 $?
echo "$out" | grep -q "^fix/wt-from (from main) at "
check "reports given base" 0 $?
check "tip equals main" "$(git rev-parse main)" "$(git rev-parse fix/wt-from)"

echo "# N18: worktree inherits create guards"
fresh_repo
git checkout -qb side
echo side > base.txt && git commit -qam "feat: side"
git checkout -q main
echo main > base.txt && git commit -qam "feat: main"
git merge side -q > /dev/null 2>&1 || true
bash "$SCRIPT" create chore/wt-mid-merge --worktree > /dev/null 2>&1
check "mid-merge refused, exit 8" 8 $?
fresh_repo
bash "$SCRIPT" create "feat/Bad_Name" --worktree > /dev/null 2>&1
check "invalid name with --worktree, exit 5" 5 $?
UNBORN=$(mktemp -d)
cd "$UNBORN" && git init -qb main
bash "$SCRIPT" create feat/wt-unborn --worktree > /dev/null 2>&1
check "unborn repo with --worktree, exit 3" 3 $?

echo "# N19: inspect lists other worktrees"
fresh_repo
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "other worktrees"
check "no worktree section without worktrees" 1 $?
bash "$SCRIPT" create feat/wt-listed --worktree > /dev/null
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "## other worktrees"
check "worktree section present" 0 $?
echo "$out" | grep -q "\.worktrees/feat/wt-listed \[feat/wt-listed\]"
check "worktree path and branch listed" 0 $?
out=$(cd .worktrees/feat/wt-listed && bash "$SCRIPT" inspect)
echo "$out" | grep -q "\[main\]"
check "main listed as other from linked worktree" 0 $?
echo "$out" | grep -q "\.worktrees/feat/wt-listed"
check "current worktree not listed as other" 1 $?

echo "# N20: failed worktree add never deletes the created branch"
fresh_repo
touch exfile
bash "$SCRIPT" create feat/stray --worktree --at exfile/sub > /dev/null 2>&1
check "add fails, exit 4" 4 $?
git show-ref -q --verify refs/heads/feat/stray
check "created branch survives worktree failure" 0 $?
STRAY_TIP=$(git rev-parse refs/heads/feat/stray)
bash "$SCRIPT" create feat/stray --worktree > /dev/null 2>&1
check "retry refuses to reuse the surviving branch" 9 $?
check "surviving branch tip is unchanged" "$STRAY_TIP" "$(git rev-parse refs/heads/feat/stray)"

echo "# N21: concurrent branch creation is never deleted on worktree failure"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
REAL_GIT=$(command -v git)
FAKE_BIN="$TOP/.git/fake-bin"
mkdir "$FAKE_BIN"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "$1" == "worktree" && "${2:-}" == "add" ]]; then' \
  '  "$RACE_REAL_GIT" branch "$RACE_BRANCH"' \
  '  echo "simulated worktree refusal" >&2' \
  '  exit 1' \
  'fi' \
  'exec "$RACE_REAL_GIT" "$@"' > "$FAKE_BIN/git"
chmod +x "$FAKE_BIN/git"
PATH="$FAKE_BIN:$PATH" RACE_REAL_GIT="$REAL_GIT" RACE_BRANCH=feat/concurrent \
  bash "$SCRIPT" create feat/concurrent --worktree --at "$TOP/race-worktree" > /dev/null 2>&1
check "concurrent branch makes worktree creation fail" 4 $?
git show-ref -q --verify refs/heads/feat/concurrent
check "concurrently created branch survives refusal" 0 $?
check "caller stays on main after concurrent creation" main "$(git branch --show-current)"

echo "# N22: failed default worktree setup does not change local excludes"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
REAL_GIT=$(command -v git)
FAKE_BIN="$TOP/.git/fake-bin"
mkdir "$FAKE_BIN"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "$1" == "worktree" && "${2:-}" == "add" ]]; then' \
  '  echo "simulated worktree refusal" >&2' \
  '  exit 1' \
  'fi' \
  'exec "$FAIL_REAL_GIT" "$@"' > "$FAKE_BIN/git"
chmod +x "$FAKE_BIN/git"
EXCLUDE=$(git rev-parse --git-path info/exclude)
EXCLUDE_BEFORE=$(cat "$EXCLUDE")
PATH="$FAKE_BIN:$PATH" FAIL_REAL_GIT="$REAL_GIT" \
  bash "$SCRIPT" create feat/default-refusal --worktree > /dev/null 2>&1
check "simulated default worktree creation fails" 4 $?
check "exclude file is unchanged after refusal" "$EXCLUDE_BEFORE" "$(cat "$EXCLUDE")"
if [[ -d "$TOP/.worktrees" ]]; then
  hierarchy_entries=$(find "$TOP/.worktrees" ! -type d -print | wc -l | tr -d '[:space:]')
else
  hierarchy_entries=0
fi
check "failed setup leaves at most empty default directories" 0 "$hierarchy_entries"
check "caller stays on main after default refusal" main "$(git branch --show-current)"

echo "# N23: inspect preserves backslashes in the current worktree path"
BACKSLASH_PARENT=$(mktemp -d)
REPO="$BACKSLASH_PARENT/repo\\test"
mkdir "$REPO"
cd "$REPO" || exit 70
git init -qb main
git config user.email t@t.local
git config user.name t
echo base > base.txt
git add base.txt
git commit -qm "chore: init"
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "## other worktrees"
check "backslash path is not listed as another worktree" 1 $?

echo "# N24: failed setup preserves a concurrently created default directory"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
REAL_GIT=$(command -v git)
REAL_MKDIR=$(command -v mkdir)
FAKE_BIN="$TOP/.git/fake-bin"
mkdir "$FAKE_BIN"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "$1" == "worktree" && "${2:-}" == "add" ]]; then' \
  '  echo "simulated worktree refusal" >&2' \
  '  exit 1' \
  'fi' \
  'exec "$DIR_RACE_REAL_GIT" "$@"' > "$FAKE_BIN/git"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'target=$1' \
  'if [[ "$target" == "-p" ]]; then target=${2:-}; fi' \
  'if [[ "$target" == "$DIR_RACE_PATH" && ! -e "$target" ]]; then' \
  '  "$DIR_RACE_REAL_MKDIR" -p "$target"' \
  'fi' \
  'exec "$DIR_RACE_REAL_MKDIR" "$@"' > "$FAKE_BIN/mkdir"
chmod +x "$FAKE_BIN/git" "$FAKE_BIN/mkdir"
PATH="$FAKE_BIN:$PATH" DIR_RACE_REAL_GIT="$REAL_GIT" \
  DIR_RACE_REAL_MKDIR="$REAL_MKDIR" DIR_RACE_PATH="$TOP/.worktrees/feat" \
  bash "$SCRIPT" create feat/directory-race --worktree > /dev/null 2>&1
check "directory race worktree creation fails" 4 $?
if [[ -d "$TOP/.worktrees/feat" ]]; then
  concurrent_directory_status=0
else
  concurrent_directory_status=1
fi
check "concurrently created default directory survives refusal" 0 "$concurrent_directory_status"

echo "# N25: failed setup preserves a replaced default directory"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
REAL_GIT=$(command -v git)
REAL_MKDIR=$(command -v mkdir)
REAL_RMDIR=$(command -v rmdir)
FAKE_BIN="$TOP/.git/fake-bin"
mkdir "$FAKE_BIN"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "$1" == "worktree" && "${2:-}" == "add" ]]; then' \
  '  "$REPLACE_REAL_RMDIR" "$REPLACE_PATH"' \
  '  "$REPLACE_REAL_MKDIR" "$REPLACE_PATH"' \
  '  echo "simulated worktree refusal" >&2' \
  '  exit 1' \
  'fi' \
  'exec "$REPLACE_REAL_GIT" "$@"' > "$FAKE_BIN/git"
chmod +x "$FAKE_BIN/git"
PATH="$FAKE_BIN:$PATH" REPLACE_REAL_GIT="$REAL_GIT" \
  REPLACE_REAL_MKDIR="$REAL_MKDIR" REPLACE_REAL_RMDIR="$REAL_RMDIR" \
  REPLACE_PATH="$TOP/.worktrees/feat" \
  bash "$SCRIPT" create feat/directory-replacement --worktree > /dev/null 2>&1
check "directory replacement worktree creation fails" 4 $?
if [[ -d "$TOP/.worktrees/feat" ]]; then
  replaced_directory_status=0
else
  replaced_directory_status=1
fi
check "replaced default directory survives refusal" 0 "$replaced_directory_status"

echo "# N26: unreadable local excludes refuse default worktree creation"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
EXCLUDE=$(git rev-parse --git-path info/exclude)
chmod a-r "$EXCLUDE"
bash "$SCRIPT" create feat/unreadable-exclude --worktree > /dev/null 2>&1
check "unreadable exclude is refused" 9 $?
chmod u+r "$EXCLUDE"
git show-ref -q --verify refs/heads/feat/unreadable-exclude
check "unreadable exclude creates no branch" 1 $?
if [[ -d "$TOP/.worktrees" ]]; then
  unreadable_hierarchy_entries=$(find "$TOP/.worktrees" ! -type d -print | wc -l | tr -d '[:space:]')
else
  unreadable_hierarchy_entries=0
fi
check "unreadable exclude leaves at most empty default directories" 0 "$unreadable_hierarchy_entries"
check "caller stays on main after unreadable exclude" main "$(git branch --show-current)"

echo "# N27: post-create exclude update failure is reported"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
REAL_GIT=$(command -v git)
EXCLUDE=$(git rev-parse --git-path info/exclude)
[[ "$EXCLUDE" == /* ]] || EXCLUDE="$TOP/$EXCLUDE"
FAKE_BIN="$TOP/.git/fake-bin"
mkdir "$FAKE_BIN"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "$1" == "worktree" && "${2:-}" == "add" ]]; then' \
  '  "$APPEND_FAIL_REAL_GIT" "$@"' \
  '  status=$?' \
  '  if [[ $status -eq 0 ]]; then chmod a-w "$APPEND_FAIL_EXCLUDE"; fi' \
  '  exit "$status"' \
  'fi' \
  'exec "$APPEND_FAIL_REAL_GIT" "$@"' > "$FAKE_BIN/git"
chmod +x "$FAKE_BIN/git"
output=$(PATH="$FAKE_BIN:$PATH" APPEND_FAIL_REAL_GIT="$REAL_GIT" \
  APPEND_FAIL_EXCLUDE="$EXCLUDE" \
  bash "$SCRIPT" create feat/exclude-append-failure --worktree 2>&1)
append_failure_status=$?
chmod u+w "$EXCLUDE"
check "post-create exclude update failure is nonzero" 9 "$append_failure_status"
echo "$output" | grep -q "worktree created but cannot update repository exclude file"
check "post-create exclude failure identifies the partial result" 0 $?
git show-ref -q --verify refs/heads/feat/exclude-append-failure
check "created branch remains after exclude update failure" 0 $?
git worktree list --porcelain | grep -q "branch refs/heads/feat/exclude-append-failure"
check "created worktree remains after exclude update failure" 0 $?
check "caller stays on main after exclude update failure" main "$(git branch --show-current)"

echo "# N28: exclude preflight preserves a replaced default directory"
fresh_repo
TOP=$(git rev-parse --show-toplevel)
REAL_GIT=$(command -v git)
REAL_MKDIR=$(command -v mkdir)
REAL_RMDIR=$(command -v rmdir)
EXCLUDE=$(git rev-parse --git-path info/exclude)
chmod a-r "$EXCLUDE"
FAKE_BIN="$TOP/.git/fake-bin"
mkdir "$FAKE_BIN"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'if [[ "$1" == "rev-parse" && "${2:-}" == "--git-path" && "${3:-}" == "info/exclude" ]]; then' \
  '  "$PREFLIGHT_REAL_RMDIR" "$PREFLIGHT_REPLACE_PATH"' \
  '  "$PREFLIGHT_REAL_MKDIR" "$PREFLIGHT_REPLACE_PATH"' \
  'fi' \
  'exec "$PREFLIGHT_REAL_GIT" "$@"' > "$FAKE_BIN/git"
chmod +x "$FAKE_BIN/git"
PATH="$FAKE_BIN:$PATH" PREFLIGHT_REAL_GIT="$REAL_GIT" \
  PREFLIGHT_REAL_MKDIR="$REAL_MKDIR" PREFLIGHT_REAL_RMDIR="$REAL_RMDIR" \
  PREFLIGHT_REPLACE_PATH="$TOP/.worktrees/feat" \
  bash "$SCRIPT" create feat/preflight-replacement --worktree > /dev/null 2>&1
check "preflight replacement is refused" 9 $?
chmod u+r "$EXCLUDE"
if [[ -d "$TOP/.worktrees/feat" ]]; then
  preflight_replacement_status=0
else
  preflight_replacement_status=1
fi
check "preflight replacement directory survives refusal" 0 "$preflight_replacement_status"

if [[ $FAILURES -gt 0 ]]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all green"
