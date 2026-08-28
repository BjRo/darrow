#!/usr/bin/env bash
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
repo=$(mktemp -d)
git -C "$repo" init -qb main

bash "$script_dir/install-worktree-context.sh" "$repo" "$script_dir"

for host_root in .agents .claude; do
  test -f "$repo/$host_root/skills/assess-implementation-readiness/SKILL.md"
  test -f "$repo/$host_root/skills/prepare-task-branch/SKILL.md"
  test -f "$repo/$host_root/skills/adaptive-goal/SKILL.md"
done
grep -qxF '/.worktrees/' "$repo/.git/info/exclude"
printf '%s\n' 'worktree context fixture installer tests passed'
