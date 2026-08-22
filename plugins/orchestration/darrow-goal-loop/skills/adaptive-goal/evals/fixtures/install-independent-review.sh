#!/usr/bin/env bash
set -eu

repo=$1
fixture_dir=$2
host=${3:-}
case "$host" in
  codex) host_roots=.agents ;;
  claude) host_roots=.claude ;;
  both) host_roots='.agents .claude' ;;
  *)
    printf '%s\n' 'usage: install-independent-review.sh REPO FIXTURE_DIR codex|claude|both' >&2
    exit 2
    ;;
esac
for host_root in $host_roots; do
  mkdir -p "$repo/$host_root/skills/independent-code-review" "$repo/$host_root/bin"
  cp "$fixture_dir/independent-review/SKILL.fixture.md" "$repo/$host_root/skills/independent-code-review/SKILL.md"
  cp "$fixture_dir/independent-review/independent-review-fixture" "$repo/$host_root/bin/independent-review-fixture"
  chmod +x "$repo/$host_root/bin/independent-review-fixture"
done
