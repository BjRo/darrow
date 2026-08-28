#!/usr/bin/env bash
set -eu

repo=$1
fixture_dir=$2
branch=fix/DAR-123-attribution

git -C "$repo" branch "$branch"

for host_root in .agents .claude; do
  printf '/%s/\n' "$host_root" >>"$repo/.git/info/exclude"
  mkdir -p "$repo/$host_root/skills/assess-implementation-readiness" \
    "$repo/$host_root/skills/prepare-task-branch"
  cp "$fixture_dir/implementation-readiness/SKILL.fixture.md" \
    "$repo/$host_root/skills/assess-implementation-readiness/SKILL.md"
  cp "$fixture_dir/prepare-task-branch/SKILL.fixture.md" \
    "$repo/$host_root/skills/prepare-task-branch/SKILL.md"
done

