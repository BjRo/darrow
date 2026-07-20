#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
GUARD="$SCRIPT_DIR/workspace-guard.sh"
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/darrow-review-guard-test.XXXXXX")
TMP_ROOT=$(CDPATH= cd -- "$TMP_ROOT" && pwd -P)
trap 'rm -rf "$TMP_ROOT"' EXIT

fail() {
  printf 'workspace-guard test: %s\n' "$1" >&2
  exit 1
}

git -C "$TMP_ROOT" init -q -b main 2>/dev/null || git -C "$TMP_ROOT" init -q
git -C "$TMP_ROOT" config user.name Test
git -C "$TMP_ROOT" config user.email test@example.com
printf 'base\n' >"$TMP_ROOT/tracked file.txt"
git -C "$TMP_ROOT" add "tracked file.txt"
git -C "$TMP_ROOT" commit -qm 'chore: initialize fixture'
printf 'changed\n' >"$TMP_ROOT/tracked file.txt"
printf 'new\n' >"$TMP_ROOT/new file.txt"
mkdir -p "$TMP_ROOT/.darrow-attempts/run/attempt"
printf 'runtime evidence\n' >"$TMP_ROOT/.darrow-attempts/run/attempt/internal.json"

capture=$(cd "$TMP_ROOT" && bash "$GUARD" capture)
guard=$(sed -n 's/^guard=//p' <<<"$capture")
[[ "$guard" == /* && -r "$guard" ]] || fail "capture did not return readable absolute state"
grep -F "$TMP_ROOT/tracked\\ file.txt" <<<"$capture" >/dev/null ||
  fail "capture omitted the absolute tracked path"
grep -F "$TMP_ROOT/new\\ file.txt" <<<"$capture" >/dev/null ||
  fail "capture omitted the absolute untracked path"
if grep -F '.darrow-attempts' <<<"$capture" >/dev/null; then
  fail "capture exposed Darrow runtime paths as implementation changes"
fi
validated=$(cd "$TMP_ROOT" && bash "$GUARD" validate "$guard")
grep -F 'git_boundary=preserved' <<<"$validated" >/dev/null ||
  fail "unchanged boundary did not validate"
[[ ! -e "$guard" ]] || fail "successful validation leaked guard state"

capture=$(cd "$TMP_ROOT" && bash "$GUARD" capture)
guard=$(sed -n 's/^guard=//p' <<<"$capture")
git -C "$TMP_ROOT" add "tracked file.txt"
if error=$(cd "$TMP_ROOT" && bash "$GUARD" validate "$guard" 2>&1); then
  fail "changed index was accepted"
fi
grep -F 'Git index state changed' <<<"$error" >/dev/null ||
  fail "changed index error was not actionable"
[[ ! -e "$guard" ]] || fail "failed validation leaked guard state"
git -C "$TMP_ROOT" reset -q

capture=$(cd "$TMP_ROOT" && bash "$GUARD" capture)
guard=$(sed -n 's/^guard=//p' <<<"$capture")
git -C "$TMP_ROOT" switch -q -c unexpected
if error=$(cd "$TMP_ROOT" && bash "$GUARD" validate "$guard" 2>&1); then
  fail "active branch switch was accepted"
fi
grep -F 'active branch changed' <<<"$error" >/dev/null ||
  fail "active branch error was not actionable"
git -C "$TMP_ROOT" switch -q main
git -C "$TMP_ROOT" branch -D unexpected >/dev/null

CONCURRENT="$TMP_ROOT-concurrent"
git -C "$TMP_ROOT" worktree add -q -b concurrent "$CONCURRENT"
capture=$(cd "$TMP_ROOT" && bash "$GUARD" capture)
guard=$(sed -n 's/^guard=//p' <<<"$capture")
printf 'concurrent\n' >"$CONCURRENT/concurrent.txt"
git -C "$CONCURRENT" add concurrent.txt
git -C "$CONCURRENT" commit -qm 'test: advance unrelated worktree'
validated=$(cd "$TMP_ROOT" && bash "$GUARD" validate "$guard")
grep -F 'git_boundary=preserved' <<<"$validated" >/dev/null ||
  fail "unrelated concurrent branch movement invalidated the workspace"
git -C "$TMP_ROOT" worktree remove --force "$CONCURRENT"
git -C "$TMP_ROOT" branch -D concurrent >/dev/null

printf 'keep me\n' >"$TMP_ROOT/victim.txt"
if error=$(cd "$TMP_ROOT" && bash "$GUARD" validate "$TMP_ROOT/victim.txt" 2>&1); then
  fail "arbitrary readable path was accepted as guard state"
fi
grep -F 'outside the current Git worktree or has an invalid name' <<<"$error" >/dev/null ||
  fail "arbitrary state path error was not actionable"
grep -Fx 'keep me' "$TMP_ROOT/victim.txt" >/dev/null ||
  fail "refused arbitrary state path was deleted or changed"

if error=$(cd "$TMP_ROOT" && bash "$GUARD" validate "$TMP_ROOT/missing" 2>&1); then
  fail "missing guard state was accepted"
fi
grep -F 'guard state is unreadable' <<<"$error" >/dev/null ||
  fail "missing state error was not actionable"

printf 'workspace-guard tests passed\n'
