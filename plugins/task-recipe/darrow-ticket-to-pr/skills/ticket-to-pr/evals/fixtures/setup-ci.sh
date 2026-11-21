#!/usr/bin/env bash
set -euo pipefail
fixtures=$(cd "$1" && pwd -P)
mkdir -p .git/fixture-bin
cp "$fixtures/fixture-ci" .git/fixture-bin/fixture-ci
chmod +x .git/fixture-bin/fixture-ci
printf '%s\n' success >.git/fixture-ci-state
for host in .agents .claude; do
  mkdir -p "$host/skills/observe-ci"
  cp "$fixtures/observe-ci.fixture.md" "$host/skills/observe-ci/SKILL.md"
done
printf '%s\n' '/.agents/skills/observe-ci/SKILL.md' '/.claude/skills/observe-ci/SKILL.md' >>.git/info/exclude
