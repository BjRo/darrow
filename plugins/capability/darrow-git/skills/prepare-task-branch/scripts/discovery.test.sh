#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
script="$script_dir/branch.sh"
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template=/task-discovery.XXXXXX ;;
  */) temp_template=${temp_parent}task-discovery.XXXXXX ;;
  *) temp_template=${temp_parent}/task-discovery.XXXXXX ;;
esac
repo=$(mktemp -d "$temp_template")
repo=$(cd "$repo" && pwd -P)
cd "$repo"
git init -qb main
git config user.email fixture@example.invalid
git config user.name Fixture
git commit -qm 'chore: init' --allow-empty
git branch fix/DAR-123-original-suffix
tip=$(git rev-parse HEAD)
before=$(git show-ref)
output=$("$BASH" "$script" discover --ticket-token DAR-123) || {
  printf '%s\n' 'FAIL: complete ticket discovery is unavailable' >&2
  exit 1
}
grep -Fx '## mode: discovered' <<< "$output"
grep -Fx '## matches: 1' <<< "$output"
grep -Fx "fix/DAR-123-original-suffix (at $tip)" <<< "$output"
test "$(git branch --show-current)" = main
test "$(git show-ref)" = "$before"
"$BASH" "$script" prepare fix/DAR-123-original-suffix --ticket-token DAR-123 --from main
test "$(git rev-parse HEAD)" = "$tip"
test "$(git branch --show-current)" = fix/DAR-123-original-suffix
test "$(git show-ref)" = "$before"
git switch -q main
status=0
output=$("$BASH" "$script" prepare feat/DAR-123-different-suffix --ticket-token DAR-123 2>&1) || status=$?
test "$status" = 9 || {
  printf 'FAIL: creation with a prior correlated branch must refuse (got %s)\n' "$status" >&2
  exit 1
}
grep -Fx '## matches: 1' <<< "$output"
test "$(git show-ref)" = "$before"
test "$(git branch --show-current)" = main
git branch feat/DAR-123-second
before=$(git show-ref)
worktrees=$(git worktree list --porcelain)
exclude=$(git rev-parse --git-path info/exclude)
exclude_before=$(cksum < "$exclude")
printf '%s\n' preserve >untracked.txt
dirty=$(git status --porcelain)
output=$("$BASH" "$script" discover --ticket-token DAR-123)
grep -Fx '## matches: 2' <<< "$output"
test "$(printf '%s\n' "$output" | sed -n '4p')" = "feat/DAR-123-second (at $tip)"
status=0
output=$("$BASH" "$script" prepare feat/DAR-123-third --ticket-token DAR-123 --worktree 2>&1) || status=$?
test "$status" = 9
grep -Fx '## matches: 2' <<< "$output"
test "$(git show-ref)" = "$before"
test "$(git worktree list --porcelain)" = "$worktrees"
test "$(cksum < "$exclude")" = "$exclude_before"
test "$(git status --porcelain)" = "$dirty"
test ! -e .worktrees
test "$(git branch --show-current)" = main
# Explicit selection remains usable even when discovery returned several names.
"$BASH" "$script" prepare feat/DAR-123-second --ticket-token DAR-123
test "$(git show-ref)" = "$before"
git switch -q main

# Complete discovery must not rely on the bounded general inspection listing.
i=1
while [[ $i -le 65 ]]; do
  git branch "chore/unrelated-$i"
  i=$((i + 1))
done
git branch fix/issue-84-original
git branch fix/issue-840-similar
git branch fix/Issue-84-case
git branch fix/prefix-issue-84-substring
git branch fix/issue-84-repeat-issue-84
git branch custom/issue-84-type
git branch fix/issue-84-Upper
git update-ref refs/remotes/origin/fix/issue-84-remote HEAD
before=$(git show-ref)
output=$("$BASH" "$script" discover --ticket-token issue-84)
grep -Fx '## matches: 1' <<< "$output"
grep -Fx "fix/issue-84-original (at $tip)" <<< "$output"
test "$(git show-ref)" = "$before"
output=$("$BASH" "$script" discover --ticket-token issue-85)
grep -Fx '## matches: 0' <<< "$output"
"$BASH" "$script" prepare fix/issue-85-new --ticket-token issue-85
test "$(git branch --show-current)" = fix/issue-85-new
test "$(git rev-parse HEAD)" = "$tip"
test "$(git worktree list --porcelain | grep -c '^worktree ')" = 1
test "$(git status --porcelain)" = "$dirty"

before=$(git show-ref)
for bad_token in '' 'issue 84' '-84' 'issue/84' 'a:b' 'a..b' \
  '12345678901234567890123456789012345678901234567890123456'; do
  status=0
  output=$("$BASH" "$script" discover --ticket-token "$bad_token" 2>&1) || status=$?
  test "$status" != 0 || {
    printf 'FAIL: invalid token must refuse discovery: %s\n' "$bad_token" >&2
    exit 1
  }
  if grep -F '## matches:' <<< "$output"; then exit 1; fi
done
test "$(git show-ref)" = "$before"
long_token=1234567890123456789012345678901234567890123456789012345
output=$("$BASH" "$script" discover --ticket-token "$long_token")
grep -Fx '## matches: 0' <<< "$output"
"$BASH" "$script" prepare "ci/${long_token}-a" --ticket-token "$long_token"
output=$("$BASH" "$script" discover --ticket-token "$long_token")
grep -Fx '## matches: 1' <<< "$output"
test "$(git rev-parse HEAD)" = "$tip"
before=$(git show-ref)
real_git=$(command -v git)
mkdir .git/fake-bin
# These variables expand only when the isolated failure fixture executes.
# shellcheck disable=SC2016
printf '%s\n' '#!/usr/bin/env bash' \
  'if [[ "$1" == for-each-ref ]]; then exit 1; fi' \
  'exec "$DISCOVERY_REAL_GIT" "$@"' > .git/fake-bin/git
chmod +x .git/fake-bin/git
status=0
output=$(PATH="$repo/.git/fake-bin:$PATH" DISCOVERY_REAL_GIT="$real_git" \
  "$BASH" "$script" discover --ticket-token issue-84 2>&1) || status=$?
test "$status" = 3
if grep -F '## matches:' <<< "$output"; then exit 1; fi
test "$(git show-ref)" = "$before"
printf '%s\n' 'all green'
