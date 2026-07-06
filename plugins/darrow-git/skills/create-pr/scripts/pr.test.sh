#!/usr/bin/env bash
# Deterministic tests for pr.sh. Covers the script-enforced invariants so
# model evals only need to cover judgment. gh is mocked (records pr-create
# args under .git/fixture-gh/); the remote is a local bare repo, so push
# behavior is tested for real. Run: bash pr.test.sh
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/pr.sh"
BASE_PATH=$PATH
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
  export PATH="$REPO/.git/fixture-bin:$BASE_PATH"
  git init -qb main
  git config user.email t@t.local
  git config user.name t
  echo base > base.txt
  git add base.txt
  git commit -qm "chore: init"
}

# Local bare remote inside .git so it is invisible to git status.
add_remote() {
  git init -q --bare .git/remote.git
  git remote add origin "$REPO/.git/remote.git"
  git push -qu origin main
  git remote set-head origin main
}

# Same shape as the eval fixtures' gh mock.
mock_gh() {
  mkdir -p "$REPO/.git/fixture-bin"
  cat > "$REPO/.git/fixture-bin/gh" <<'EOF'
#!/bin/sh
d="$(git rev-parse --git-dir)/fixture-gh"
case "$1 $2" in
  "pr list")
    if [ -f "$(git rev-parse --git-dir)/fixture-gh-fail" ]; then
      echo "HTTP 502: bad gateway" >&2
      exit 1
    fi
    if [ -f "$(git rev-parse --git-dir)/fixture-gh-existing" ]; then
      cat "$(git rev-parse --git-dir)/fixture-gh-existing"
    fi
    ;;
  "pr create")
    mkdir -p "$d"
    shift 2
    while [ $# -gt 0 ]; do
      case "$1" in
        --title) printf '%s' "$2" > "$d/title"; shift 2 ;;
        --body) printf '%s' "$2" > "$d/body"; shift 2 ;;
        --base) printf '%s' "$2" > "$d/base"; shift 2 ;;
        --head) printf '%s' "$2" > "$d/head"; shift 2 ;;
        --draft) : > "$d/draft"; shift ;;
        *) shift ;;
      esac
    done
    echo "https://github.com/fixture/repo/pull/1"
    ;;
  *)
    echo "mock gh: unsupported: $*" >&2
    exit 1
    ;;
esac
EOF
  chmod +x "$REPO/.git/fixture-bin/gh"
}

feature_branch() {
  git checkout -qb fix/timeout-retry
  echo fix > fix.txt
  git add fix.txt
  git commit -qm "fix: retry request on timeout"
}

ready_repo() {
  fresh_repo
  add_remote
  mock_gh
  feature_branch
}

echo "# P1: usage and argument errors"
ready_repo
bash "$SCRIPT" > /dev/null 2>&1
check "no command, exit 64" 64 $?
bash "$SCRIPT" create > /dev/null 2>&1
check "no title, exit 2" 2 $?
bash "$SCRIPT" create --title "fix: x" > /dev/null 2>&1
check "no body, exit 2" 2 $?
bash "$SCRIPT" create --title > /dev/null 2>&1
check "dangling --title, exit 2" 2 $?
bash "$SCRIPT" create --title "fix: x" -b > /dev/null 2>&1
check "dangling -b, exit 2" 2 $?
bash "$SCRIPT" create --title "fix: x" -b why --base > /dev/null 2>&1
check "dangling --base, exit 2" 2 $?
bash "$SCRIPT" create --title "fix: x" -b why --force > /dev/null 2>&1
check "unknown flag, exit 2" 2 $?
bash "$SCRIPT" create --title "fix: x" -b "   " > /dev/null 2>&1
check "whitespace-only -b, exit 2" 2 $?

echo "# P2: environment guards (exit 3)"
cd "$(mktemp -d)"
bash "$SCRIPT" inspect > /dev/null 2>&1
check "outside work tree, inspect exit 3" 3 $?
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "outside work tree, create exit 3" 3 $?
UNBORN=$(mktemp -d)
cd "$UNBORN" && git init -qb main
out=$(bash "$SCRIPT" inspect)
check "unborn inspect exit 0" 0 $?
echo "$out" | grep -q "mode: empty"
check "unborn reports mode empty" 0 $?
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "unborn create exit 3" 3 $?
fresh_repo
git checkout -qb fix/no-remote
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: no-remote"
check "no origin reported by inspect" 0 $?
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "no origin, create exit 3" 3 $?
ready_repo
git checkout -q --detach
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: wrong-branch"
check "detached reported wrong-branch" 0 $?
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "detached create exit 3" 3 $?
ready_repo
PATH="/usr/bin:/bin" bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "gh missing, create exit 3" 3 $?

echo "# P3: default branch refused (exit 9)"
fresh_repo
add_remote
mock_gh
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: wrong-branch"
check "on default branch reported wrong-branch" 0 $?
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "create on default branch, exit 9" 9 $?
git branch -q develop
git push -q origin develop
bash "$SCRIPT" create --title "fix: x" -b why --base develop > /dev/null 2>&1
check "explicit --base does not bypass, exit 9" 9 $?
check "nothing captured" "" "$(ls .git/fixture-gh 2>/dev/null || true)"

echo "# P4: in-progress states block PR creation"
ready_repo
git checkout -q main
echo main > fix.txt && git add fix.txt && git commit -qm "fix: main side"
git merge fix/timeout-retry -q > /dev/null 2>&1 || true
out=$(bash "$SCRIPT" inspect)
check "inspect exit 0 in conflict" 0 $?
echo "$out" | grep -q "mode: conflict"
check "conflict marker present" 0 $?
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "create refused, exit 8" 8 $?
mkdir -p sub
out=$(cd sub && bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: conflict"
check "conflict detected from subdirectory" 0 $?

echo "# P5: title validation (exit 5), nothing pushed"
ready_repo
bash "$SCRIPT" create --title "add retry logic" -b why > /dev/null 2>&1
check "non-conventional title, exit 5" 5 $?
long="fix: $(printf 'a%.0s' $(seq 1 70))"
bash "$SCRIPT" create --title "$long" -b why > /dev/null 2>&1
check "title >72 chars, exit 5" 5 $?
bash "$SCRIPT" create --title "fix: retry on timeout." -b why > /dev/null 2>&1
check "trailing period, exit 5" 5 $?
bash "$SCRIPT" create --title "Fix: retry on timeout" -b why > /dev/null 2>&1
check "uppercase type, exit 5" 5 $?
check "branch not pushed" "" "$(git -C .git/remote.git for-each-ref refs/heads/fix/timeout-retry)"
bash "$SCRIPT" create --title "fix!: drop retry config flag" -b why > /dev/null 2>&1
check "breaking-change marker accepted" 0 $?
rm -rf .git/fixture-gh
bash "$SCRIPT" create --title "fix(http): retry request on timeout" -b why > /dev/null 2>&1
check "scoped title accepted" 0 $?
exact72="fix: $(printf 'a%.0s' $(seq 1 67))"
rm -rf .git/fixture-gh
bash "$SCRIPT" create --title "$exact72" -b why > /dev/null 2>&1
check "exactly 72 chars accepted" 0 $?

echo "# P6: AI attribution rejected (exit 6), nothing pushed"
ready_repo
bash "$SCRIPT" create --title "fix: retry on timeout" -b "Generated with Claude Code" > /dev/null 2>&1
check "generated-with body, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout" -b why -b "Co-authored-by: Claude <noreply@anthropic.com>" > /dev/null 2>&1
check "AI co-author body, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout 🤖" -b why > /dev/null 2>&1
check "robot emoji title, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout" -b "This was written by claude" > /dev/null 2>&1
check "written-by body, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout" -b "Generated using Claude Code" > /dev/null 2>&1
check "generated-using body, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout" -b "Built with Claude Code" > /dev/null 2>&1
check "built-with body, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout" -b "Co-authored by Claude" > /dev/null 2>&1
check "co-authored without colon, exit 6" 6 $?
bash "$SCRIPT" create --title "fix: retry on timeout" -b "Reviewed by an AI assistant before merge... just kidding. Written by an AI" > /dev/null 2>&1
check "written by an AI, exit 6" 6 $?
check "branch not pushed" "" "$(git -C .git/remote.git for-each-ref refs/heads/fix/timeout-retry)"
bash "$SCRIPT" create --title "chore: regenerate api client" -b "The client is now generated by openapi-generator from the v2 spec." > /dev/null 2>&1
check "legitimate generated-by prose accepted" 0 $?

echo "# P7: base handling"
ready_repo
bash "$SCRIPT" create --title "fix: retry request on timeout" -b "Requests died on flaky links." > /dev/null 2>&1
check "create ok" 0 $?
check "default base is main" main "$(cat .git/fixture-gh/base)"
ready_repo
git branch -q develop main
git push -q origin develop
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why --base develop > /dev/null 2>&1
check "create ok" 0 $?
check "named base used" develop "$(cat .git/fixture-gh/base)"
ready_repo
bash "$SCRIPT" create --title "fix: x" -b why --base no-such > /dev/null 2>&1
check "unknown base, exit 2" 2 $?
git branch -q local-only main
bash "$SCRIPT" create --title "fix: x" -b why --base local-only > /dev/null 2>&1
check "local-only base not on origin, exit 2" 2 $?
bash "$SCRIPT" create --title "fix: x" -b why --base fix/timeout-retry > /dev/null 2>&1
check "base equals head, exit 2" 2 $?
check "nothing pushed on base errors" "" "$(git -C .git/remote.git for-each-ref refs/heads/fix/timeout-retry)"

echo "# P8: nothing to propose (exit 3)"
fresh_repo
add_remote
mock_gh
git checkout -qb fix/empty-branch
bash "$SCRIPT" create --title "fix: x" -b why > /dev/null 2>&1
check "no commits ahead, exit 3" 3 $?
check "branch not pushed" "" "$(git -C .git/remote.git for-each-ref refs/heads/fix/empty-branch)"

echo "# P9: existing open PR not duplicated (exit 9)"
ready_repo
echo "#7  fix: earlier attempt  fix/timeout-retry" > .git/fixture-gh-existing
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: exists"
check "inspect reports mode exists" 0 $?
echo "$out" | grep -q "#7"
check "existing PR shown" 0 $?
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "create refused, exit 9" 9 $?
check "branch not pushed" "" "$(git -C .git/remote.git for-each-ref refs/heads/fix/timeout-retry)"
check "nothing captured" "" "$(ls .git/fixture-gh 2>/dev/null || true)"

echo "# P9b: failed PR check aborts — never treated as 'no duplicates'"
ready_repo
touch .git/fixture-gh-fail
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "mode: ready"
check "inspect still ready" 0 $?
echo "$out" | grep -q "could not check for an existing open PR"
check "inspect flags the failed check" 0 $?
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "create aborts, exit 4" 4 $?
check "nothing pushed" "" "$(git -C .git/remote.git for-each-ref refs/heads/fix/timeout-retry)"
check "no PR created" "" "$(ls .git/fixture-gh 2>/dev/null || true)"

echo "# P10: push behavior — upstream set, updates pushed, never forced"
ready_repo
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "create ok" 0 $?
check "upstream set" origin/fix/timeout-retry "$(git rev-parse --abbrev-ref '@{u}')"
check "remote has the branch tip" "$(git rev-parse HEAD)" "$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)"
echo more > fix.txt && git commit -qam "fix: widen retry window"
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "create ok with existing upstream" 0 $?
check "new commit pushed" "$(git rev-parse HEAD)" "$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)"
# Diverge: advance the remote branch independently, then commit locally.
git checkout -qb tmp fix/timeout-retry
echo remote-side > remote.txt && git add remote.txt && git commit -qm "fix: remote side"
git push -q origin tmp:fix/timeout-retry
git checkout -q fix/timeout-retry
echo local-side > local.txt && git add local.txt && git commit -qm "fix: local side"
git fetch -q origin
remote_tip=$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)
rm -rf .git/fixture-gh
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "diverged push refused, exit 4" 4 $?
check "remote tip unchanged (no force)" "$remote_tip" "$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)"
check "no PR created after failed push" "" "$(ls .git/fixture-gh 2>/dev/null || true)"

echo "# P10b: push config never widens the push (explicit refspec)"
ready_repo
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "first push ok" 0 $?
git config push.default matching
git checkout -q main
echo advance > main.txt && git add main.txt && git commit -qm "chore: advance local main"
git checkout -q fix/timeout-retry
echo more >> fix.txt && git commit -qam "fix: widen retry window"
remote_main=$(git -C .git/remote.git rev-parse refs/heads/main)
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "create ok under push.default=matching" 0 $?
check "feature branch pushed" "$(git rev-parse HEAD)" "$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)"
check "local main NOT published" "$remote_main" "$(git -C .git/remote.git rev-parse refs/heads/main)"

echo "# P10c: upstream on another remote — origin still gets the branch"
ready_repo
git init -q --bare .git/fork.git
git remote add fork "$REPO/.git/fork.git"
git push -qu fork fix/timeout-retry
out=$(bash "$SCRIPT" create --title "fix: retry request on timeout" -b why)
check "create ok with fork upstream" 0 $?
check "origin received the branch" "$(git rev-parse HEAD)" "$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)"
echo "$out" | grep -q "note: upstream is fork/fix/timeout-retry"
check "upstream mismatch noted" 0 $?
check "PR head pinned to branch" fix/timeout-retry "$(cat .git/fixture-gh/head)"

echo "# P10d: differently-named upstream — pushed ref matches the PR head"
ready_repo
git push -q origin HEAD:refs/heads/fix/old-name
git branch -q --set-upstream-to=origin/fix/old-name
old_tip=$(git rev-parse HEAD)
echo more >> fix.txt && git commit -qam "fix: widen retry window"
out=$(bash "$SCRIPT" create --title "fix: retry request on timeout" -b why)
check "create ok with renamed upstream" 0 $?
check "same-name remote branch created" "$(git rev-parse HEAD)" "$(git -C .git/remote.git rev-parse refs/heads/fix/timeout-retry)"
check "old upstream name untouched" "$old_tip" "$(git -C .git/remote.git rev-parse refs/heads/fix/old-name)"
echo "$out" | grep -q "note: upstream is origin/fix/old-name"
check "upstream mismatch noted" 0 $?

echo "# P11: success output and captured arguments"
ready_repo
out=$(bash "$SCRIPT" create --title "fix: retry request on timeout" -b "Requests died on flaky links." -b "Retries twice with backoff.")
check "create ok" 0 $?
check "reports url, head and base" "https://github.com/fixture/repo/pull/1 (fix/timeout-retry -> main)" "$out"
check "title captured" "fix: retry request on timeout" "$(cat .git/fixture-gh/title)"
check "head pinned" fix/timeout-retry "$(cat .git/fixture-gh/head)"
check "body sections joined with blank line" "Requests died on flaky links.

Retries twice with backoff." "$(cat .git/fixture-gh/body)"
check "not draft" "" "$(ls .git/fixture-gh/draft 2>/dev/null || true)"
ready_repo
out=$(bash "$SCRIPT" create --title "fix: retry request on timeout" -b why --draft)
check "draft create ok" 0 $?
[[ -f .git/fixture-gh/draft ]]
check "draft flag passed through" 0 $?
echo "$out" | grep -q ", draft)"
check "draft stated in report" 0 $?

echo "# P12: inspect ready output"
ready_repo
out=$(bash "$SCRIPT" inspect)
check "exit 0" 0 $?
echo "$out" | grep -q "mode: ready"
check "ready marker" 0 $?
echo "$out" | grep -q "cur branch: fix/timeout-retry"
check "current branch shown" 0 $?
echo "$out" | grep -q "base branch (default): main"
check "default base shown" 0 $?
echo "$out" | grep -q "upstream: none"
check "missing upstream shown" 0 $?
echo "$out" | grep -q "fix: retry request on timeout"
check "branch commits listed" 0 $?
echo "$out" | grep -q "fix.txt"
check "diffstat present" 0 $?
echo "$out" | grep -q "clean"
check "clean tree reported" 0 $?
echo dirty >> fix.txt
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q " M fix.txt"
check "dirty file listed" 0 $?
echo "$out" | grep -q "will NOT be in the PR"
check "dirty warning present" 0 $?

echo "# P12b: inspect reports no-commits instead of ready"
fresh_repo
add_remote
mock_gh
git switch -qc fix/empty-branch
out=$(bash "$SCRIPT" inspect)
check "exit 0" 0 $?
echo "$out" | grep -q "mode: no-commits"
check "no-commits marker" 0 $?

echo "# P12c: default branch resolved from the remote when origin/HEAD unset"
fresh_repo
git init -q --bare .git/remote.git
git remote add origin "$REPO/.git/remote.git"
git push -q origin main
git branch -q develop main
git push -q origin develop
git -C .git/remote.git symbolic-ref HEAD refs/heads/develop
mock_gh
git switch -qc feat/on-develop develop
echo f > f.txt && git add f.txt && git commit -qm "feat: on develop"
out=$(bash "$SCRIPT" inspect)
echo "$out" | grep -q "base branch (default): develop"
check "remote HEAD wins over local main" 0 $?
bash "$SCRIPT" create --title "feat: on develop" -b why > /dev/null 2>&1
check "create ok" 0 $?
check "PR based on remote default" develop "$(cat .git/fixture-gh/base)"

echo "# P12d: guessed default is flagged"
fresh_repo
git remote add origin "$REPO/.git/nonexistent.git"
mock_gh
git switch -qc fix/offline
echo f > f.txt && git add f.txt && git commit -qm "fix: offline"
out=$(bash "$SCRIPT" inspect)
check "inspect exit 0" 0 $?
echo "$out" | grep -q "mode: ready"
check "still ready" 0 $?
echo "$out" | grep -q "guessed from local branches"
check "guess flagged" 0 $?

echo "# P13: uncommitted changes stay out and stay put"
ready_repo
echo dirty >> fix.txt
echo scratch > notes.txt
bash "$SCRIPT" create --title "fix: retry request on timeout" -b why > /dev/null 2>&1
check "create ok" 0 $?
git status --porcelain | grep -q "^ M fix.txt"
check "modified file still dirty" 0 $?
git status --porcelain | grep -q "^?? notes.txt"
check "untracked file untouched" 0 $?
check "stash empty" "" "$(git stash list)"
check "no commit created" 2 "$(git rev-list --count HEAD)"

echo "# P14: works from a subdirectory"
ready_repo
mkdir -p sub
out=$(cd sub && bash "$SCRIPT" create --title "fix: retry request on timeout" -b why)
check "create ok from subdir" 0 $?
check "title captured from subdir" "fix: retry request on timeout" "$(cat .git/fixture-gh/title)"

if [[ $FAILURES -gt 0 ]]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all green"
