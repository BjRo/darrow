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
cd "$(mktemp -d)"
bash "$SCRIPT" inspect > /dev/null 2>&1
check "inspect exit 3" 3 $?
bash "$SCRIPT" create feat/x > /dev/null 2>&1
check "create exit 3" 3 $?

if [[ $FAILURES -gt 0 ]]; then
  echo "$FAILURES failure(s)"
  exit 1
fi
echo "all green"
