#!/usr/bin/env bash
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT HUP INT TERM

git -C "$repo" init -q
git -C "$repo" config user.name Fixture
git -C "$repo" config user.email fixture@example.invalid
printf '%s\n' base >"$repo/README.md"
git -C "$repo" add README.md
git -C "$repo" commit -qm 'chore: init'

bash "$script_dir/install-pre-readiness-branch.sh" "$repo" "$script_dir"

test "$(git -C "$repo" branch --list fix/DAR-123-attribution)" = \
  '  fix/DAR-123-attribution'
test -f "$repo/.agents/skills/assess-implementation-readiness/SKILL.md"
test -f "$repo/.claude/skills/prepare-task-branch/SKILL.md"
printf '%s\n' 'pre-readiness branch fixture installer tests passed'
