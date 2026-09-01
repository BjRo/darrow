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
    printf '%s\n' 'usage: install-implementation-readiness.sh REPO FIXTURE_DIR codex|claude|both' >&2
    exit 2
    ;;
esac
mkdir -p "$repo/.git/fixture-state"
for host_root in $host_roots; do
  printf '/%s/\n' "$host_root" >>"$repo/.git/info/exclude"
  mkdir -p "$repo/$host_root/skills/assess-implementation-readiness" \
    "$repo/$host_root/bin"
  case "$host_root" in
    .claude)
      cp "$fixture_dir/implementation-readiness/SKILL.claude.fixture.md" \
        "$repo/$host_root/skills/assess-implementation-readiness/SKILL.md"
      bash "$fixture_dir/implementation-readiness/implementation-readiness-fixture" \
        "$repo" render-only >"$repo/.git/fixture-state/implementation-readiness-result"
      ;;
    *)
      cp "$fixture_dir/implementation-readiness/SKILL.fixture.md" \
        "$repo/$host_root/skills/assess-implementation-readiness/SKILL.md"
      cp "$fixture_dir/implementation-readiness/implementation-readiness-fixture" \
        "$repo/$host_root/bin/implementation-readiness-fixture"
      chmod +x "$repo/$host_root/bin/implementation-readiness-fixture"
      ;;
  esac
done
