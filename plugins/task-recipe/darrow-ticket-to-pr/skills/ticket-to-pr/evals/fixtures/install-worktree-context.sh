#!/usr/bin/env bash
set -eu

repo=$1
fixture_dir=$2

for host_root in .agents .claude; do
  printf '/%s/\n' "$host_root" >>"$repo/.git/info/exclude"
  mkdir -p "$repo/$host_root/skills/assess-implementation-readiness" \
    "$repo/$host_root/skills/prepare-task-branch" \
    "$repo/$host_root/skills/adaptive-goal"
  cp "$fixture_dir/worktree-context/implementation-readiness/SKILL.fixture.md" \
    "$repo/$host_root/skills/assess-implementation-readiness/SKILL.md"
  cp "$fixture_dir/worktree-context/prepare-task-branch/SKILL.fixture.md" \
    "$repo/$host_root/skills/prepare-task-branch/SKILL.md"
  cp "$fixture_dir/worktree-context/adaptive-goal/SKILL.fixture.md" \
    "$repo/$host_root/skills/adaptive-goal/SKILL.md"
done

printf '%s\n' '/.worktrees/' >>"$repo/.git/info/exclude"
