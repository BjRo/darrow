#!/usr/bin/env bash
set -uo pipefail

backend=$(cd "$(dirname "$0")/../.." && pwd -P)
ENTRYPOINT=(uv run --quiet --frozen --no-dev --project "$backend" darrow-prepare-task-branch)
failures=0

check() {
  local description=$1 expected=$2 actual=$3
  if [[ "$actual" == "$expected" ]]; then
    printf '  ok: %s\n' "$description"
  else
    printf '  FAIL: %s (expected %s, got %s)\n' "$description" "$expected" "$actual"
    failures=$((failures + 1))
  fi
}

fresh_repo() {
  repo=$(mktemp -d)
  cd "$repo" || exit 70
  [[ "$PWD" == "$repo" ]] || exit 70
  git init -qb main ${1:+"$1"}
  git config user.email fixture@example.invalid
  git config user.name Fixture
  printf '%s\n' base >base.txt
  git add base.txt
  git commit -qm 'chore: init'
}

printf '%s\n' '# P1: create, current, and reuse are additive'
fresh_repo
output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123)
check 'create exits zero' 0 $?
printf '%s\n' "$output" | grep -q '^## mode: created$'
check 'create mode reported' 0 $?
check 'created branch active' fix/DAR-123-attribution "$(git branch --show-current)"
printf '%s\n' task >task.txt
git add task.txt
git commit -qm 'fix: task change'
task_tip=$(git rev-parse HEAD)
git tag fix/DAR-123-attribution HEAD^
output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123)
check 'current exits zero' 0 $?
printf '%s\n' "$output" | grep -q '^## mode: current$'
check 'current mode reported' 0 $?
printf '%s\n' "$output" | grep -q "$task_tip"
check 'reported current tip is the exact branch ref despite a same-named tag' 0 $?
git tag -d fix/DAR-123-attribution >/dev/null
git switch -q main
printf '%s\n' advance >advance.txt
git add advance.txt
git commit -qm 'feat: advance main'
output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123)
check 'reuse exits zero' 0 $?
printf '%s\n' "$output" | grep -q '^## mode: reused$'
check 'reuse mode reported' 0 $?
check 'existing branch active' fix/DAR-123-attribution "$(git branch --show-current)"
check 'existing tip unmoved' "$task_tip" "$(git rev-parse HEAD)"
printf '%s\n' "$output" | grep -q "$task_tip"
check 'reported reused tip is the exact branch ref' 0 $?

printf '%s\n' '# P2: incompatible dirty work refuses without loss'
fresh_repo
git branch fix/DAR-123-attribution
git switch -qc feat/conflicting
printf '%s\n' other >base.txt
git commit -qam 'feat: conflicting branch'
printf '%s\n' dirty >>base.txt
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 >/dev/null 2>&1
check 'dirty switch refused' 4 $?
check 'original branch remains active' feat/conflicting "$(git branch --show-current)"
check 'dirty content survives' dirty "$(tail -n 1 base.txt)"
check 'stash remains empty' '' "$(git stash list)"

printf '%s\n' '# P3: exact name and provider token are mandatory'
fresh_repo
"${ENTRYPOINT[@]}" prepare fix/request-attribution >/dev/null 2>&1
check 'missing token refused' 2 $?
"${ENTRYPOINT[@]}" prepare fix/preserve-DAR-123 --ticket-token DAR-123 >/dev/null 2>&1
check 'non-leading token refused' 5 $?
"${ENTRYPOINT[@]}" prepare fix/DAR-123-repeat-DAR-123 --ticket-token DAR-123 >/dev/null 2>&1
check 'repeated token refused' 5 $?
check 'validation refusals leave main active' main "$(git branch --show-current)"

printf '%s\n' '# P4: conflict state stops before branch mutation'
fresh_repo
git switch -qc side
printf '%s\n' side >base.txt
git commit -qam 'feat: side'
git switch -q main
printf '%s\n' main >base.txt
git commit -qam 'feat: main'
git merge side -q >/dev/null 2>&1 || true
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 >/dev/null 2>&1
check 'conflict refused' 8 $?
check 'no task branch created' '' "$(git branch --list fix/DAR-123-attribution)"

printf '%s\n' '# P5: explicit worktree preparation preserves the caller checkout'
fresh_repo
printf '%s\n' dirty >>base.txt
worktree_path="$repo/task-worktree"
output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree --at "$worktree_path")
check 'worktree creation exits zero' 0 $?
printf '%s\n' "$output" | grep -q '^## mode: worktree-created$'
check 'worktree creation mode reported' 0 $?
check 'caller branch remains active' main "$(git branch --show-current)"
check 'caller dirty content survives' dirty "$(tail -n 1 base.txt)"
check 'task branch active in linked worktree' fix/DAR-123-attribution "$(git -C "$worktree_path" branch --show-current)"
printf '%s\n' "$output" | grep -qF "$worktree_path"
check 'absolute worktree execution path reported' 0 $?

fresh_repo
git branch fix/DAR-123-attribution
task_tip=$(git rev-parse refs/heads/fix/DAR-123-attribution)
worktree_path="$repo/reused-worktree"
output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree --at "$worktree_path")
check 'existing branch worktree reuse exits zero' 0 $?
printf '%s\n' "$output" | grep -q '^## mode: worktree-reused$'
check 'existing branch worktree mode reported' 0 $?
check 'caller remains on main after worktree reuse' main "$(git branch --show-current)"
check 'existing worktree branch tip unmoved' "$task_tip" "$(git -C "$worktree_path" rev-parse HEAD)"

fresh_repo
git branch conflict-side
worktree_path="$repo/conflicted-worktree"
git worktree add -q -b fix/DAR-123-attribution "$worktree_path"
printf '%s\n' task >"$worktree_path/base.txt"
git -C "$worktree_path" commit -qam 'fix: task side'
git switch -q conflict-side
printf '%s\n' other >base.txt
git commit -qam 'feat: conflicting side'
git switch -q main
git -C "$worktree_path" merge conflict-side -q >/dev/null 2>&1 || true
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree >/dev/null 2>&1
check 'conflict in an existing task worktree is refused' 8 $?
check 'caller stays on main after target-worktree conflict' main "$(git branch --show-current)"
check 'target worktree remains conflicted' 1 "$(git -C "$worktree_path" diff --name-only --diff-filter=U | wc -l | tr -d '[:space:]')"

fresh_repo
worktree_path="$repo/stale-worktree"
git worktree add -q -b fix/DAR-123-attribution "$worktree_path"
mv "$worktree_path" "$worktree_path.missing"
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree >/dev/null 2>&1
check 'stale registered task worktree is refused' 9 $?
check 'caller stays on main after stale-worktree refusal' main "$(git branch --show-current)"

fresh_repo
caller_repo=$repo
worktree_path="$repo/replaced-worktree"
git worktree add -q -b fix/DAR-123-attribution "$worktree_path"
mv "$worktree_path" "$worktree_path.original"
git init -qb main "$worktree_path"
git -C "$worktree_path" config user.email fixture@example.invalid
git -C "$worktree_path" config user.name Fixture
printf '%s\n' replacement >"$worktree_path/replacement.txt"
git -C "$worktree_path" add replacement.txt
git -C "$worktree_path" commit -qm 'chore: replacement repository'
git -C "$worktree_path" switch -qc fix/DAR-123-attribution
cd "$caller_repo" || exit 70
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree >/dev/null 2>&1
check 'different repository at registered path is refused' 9 $?
check 'caller stays on main after cross-repository refusal' main "$(git branch --show-current)"

fresh_repo
worktree_path="$repo/visible-worktree"
output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree --at "$worktree_path")
check 'custom in-repository worktree exits zero' 0 $?
printf '%s\n' "$output" | grep -q 'not ignored.*git status will list it'
check 'visible custom worktree side effect is reported' 0 $?
git status --porcelain | grep -q 'visible-worktree/'
check 'custom worktree is actually visible in caller status' 0 $?

printf '%s\n' '# P6: concurrent branch creation is never deleted on worktree failure'
fresh_repo
real_git=$(command -v git)
fake_bin="$repo/.git/fake-bin"
mkdir "$fake_bin"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/bin/sh' \
  'if [ "$1" = "worktree" ] && [ "${2:-}" = "add" ]; then' \
  '  "$RACE_REAL_GIT" branch "$RACE_BRANCH"' \
  'fi' \
  'exec "$RACE_REAL_GIT" "$@"' >"$fake_bin/git"
chmod +x "$fake_bin/git"
worktree_path="$repo/race-worktree"
PATH="$fake_bin:$PATH" RACE_REAL_GIT="$real_git" \
  RACE_BRANCH=fix/DAR-123-attribution \
  "${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 \
  --worktree --at "$worktree_path" >/dev/null 2>&1
check 'concurrent branch makes worktree preparation fail' 4 $?
git show-ref -q --verify refs/heads/fix/DAR-123-attribution
check 'concurrently created branch survives refusal' 0 $?
check 'caller stays on main after concurrent creation' main "$(git branch --show-current)"

printf '%s\n' '# P7: failed default worktree setup leaves no repository residue'
fresh_repo
real_git=$(command -v git)
fake_bin="$repo/.git/fake-bin"
mkdir "$fake_bin"
# shellcheck disable=SC2016 # Wrapper variables expand when the fixture runs it.
printf '%s\n' \
  '#!/bin/sh' \
  'if [ "$1" = "worktree" ] && [ "${2:-}" = "add" ]; then' \
  '  echo "simulated worktree refusal" >&2' \
  '  exit 1' \
  'fi' \
  'exec "$FAIL_REAL_GIT" "$@"' >"$fake_bin/git"
chmod +x "$fake_bin/git"
exclude=$(git rev-parse --git-path info/exclude)
exclude_before=$(cat "$exclude")
PATH="$fake_bin:$PATH" FAIL_REAL_GIT="$real_git" \
  "${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 \
  --worktree >/dev/null 2>&1
check 'simulated default worktree preparation fails' 4 $?
check 'exclude file is unchanged after refusal' "$exclude_before" "$(cat "$exclude")"
if [[ ! -e "$repo/.worktrees" ]]; then
  hierarchy_status=0
else
  hierarchy_status=1
fi
check 'default worktree hierarchy is absent after refusal' 0 "$hierarchy_status"
git show-ref -q --verify refs/heads/fix/DAR-123-attribution
check 'failed setup creates no task branch' 1 $?
check 'caller stays on main after failed setup' main "$(git branch --show-current)"

printf '%s\n' '# P8: absent optional excludes support default worktree creation and reuse'
for branch_state in missing existing; do
  fresh_repo --template=
  repo=$(pwd -P)
  exclude=$(git rev-parse --git-path info/exclude)
  if [[ ! -e "$exclude" ]]; then path_status=0; else path_status=1; fi
  check 'empty template supplies no exclude file' 0 "$path_status"
  if [[ "$branch_state" == existing ]]; then
    git branch fix/DAR-123-attribution
    expected_mode=worktree-reused
  else
    expected_mode=worktree-created
  fi
  original_tip=$(git rev-parse HEAD)
  output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree)
  check "$branch_state branch prepares with absent excludes" 0 $?
  grep -qxF "## mode: $expected_mode" <<< "$output"
  check 'correct worktree mode reported' 0 $?
  worktree_path="$repo/.worktrees/fix/DAR-123-attribution"
  grep -qF "$worktree_path" <<< "$output"
  check 'absolute default execution path reported' 0 $?
  check 'prepared task tip unchanged' "$original_tip" "$(git -C "$worktree_path" rev-parse HEAD 2>/dev/null)"
  check 'caller branch unchanged' main "$(git branch --show-current)"
  check 'exclude contains one worktree rule' '/.worktrees/' "$(cat "$exclude" 2>/dev/null)"
  check 'default worktree is ignored' '' "$(git status --porcelain)"
done

printf '%s\n' '# P9: failed creation leaves an absent exclude file absent'
fresh_repo --template=
real_git=$(command -v git)
fake_bin="$repo/.git/fake-bin"
mkdir "$fake_bin"
cat >"$fake_bin/git" <<'EOF'
#!/bin/sh
if [ "$1" = worktree ] && [ "${2:-}" = add ]; then
  echo 'simulated worktree refusal' >&2
  exit 1
fi
exec "$FAIL_REAL_GIT" "$@"
EOF
chmod +x "$fake_bin/git"
PATH="$fake_bin:$PATH" FAIL_REAL_GIT="$real_git" \
  "${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree >/dev/null 2>&1
check 'worktree failure reaches the add operation' 4 $?
if [[ ! -e .git/info/exclude ]]; then path_status=0; else path_status=1; fi
check 'failed worktree does not create exclude file' 0 "$path_status"
if [[ ! -e .worktrees ]]; then path_status=0; else path_status=1; fi
check 'failed worktree leaves no default hierarchy' 0 "$path_status"
check 'failed worktree creates no branch' '' "$(git branch --list fix/DAR-123-attribution)"

printf '%s\n' '# P10: existing unreadable exclude configuration still refuses'
fresh_repo
exclude=$(git rev-parse --git-path info/exclude)
exclude_before=$(cat "$exclude")
chmod 000 "$exclude"
if [[ ! -r "$exclude" ]]; then
  output=$("${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree 2>&1)
  check 'unreadable exclude refuses' 9 $?
  grep -q 'exclude file is unreadable' <<< "$output"
  check 'unreadable configuration is identified' 0 $?
  check 'unreadable configuration creates no branch' '' "$(git branch --list fix/DAR-123-attribution)"
  if [[ ! -e .worktrees ]]; then path_status=0; else path_status=1; fi
  check 'unreadable configuration leaves no default hierarchy' 0 "$path_status"
else
  printf '%s\n' '  unverified: current user can read chmod 000 files'
fi
chmod 644 "$exclude"
check 'unreadable exclude contents preserved' "$exclude_before" "$(cat "$exclude")"

printf '%s\n' '# P11: existing writable excludes do not require a writable parent'
fresh_repo
exclude=$(git rev-parse --git-path info/exclude)
exclude_before=$(cat "$exclude")
chmod 555 .git/info
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree >/dev/null 2>&1
check 'writable existing file can be appended in read-only parent' 0 $?
chmod 755 .git/info
check 'existing exclude rules preserved with appended worktree rule' "$exclude_before"$'\n/.worktrees/' "$(cat "$exclude")"

printf '%s\n' '# P12: broken exclude symlinks are unreadable configuration'
fresh_repo --template=
mkdir -p .git/info
ln -s missing-exclude-target .git/info/exclude
"${ENTRYPOINT[@]}" prepare fix/DAR-123-attribution --ticket-token DAR-123 --worktree >/dev/null 2>&1
check 'broken exclude symlink refuses' 9 $?
if [[ -L .git/info/exclude && ! -e .git/info/missing-exclude-target ]]; then path_status=0; else path_status=1; fi
check 'broken exclude link is left intact' 0 "$path_status"
check 'broken exclude link creates no branch' '' "$(git branch --list fix/DAR-123-attribution)"

if [[ $failures -gt 0 ]]; then
  printf '%s failure(s)\n' "$failures"
  exit 1
fi
printf '%s\n' 'all green'
