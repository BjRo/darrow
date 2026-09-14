#!/usr/bin/env bash
set -eu
repo=$1
fixture_dir=$2
"$BASH" "$fixture_dir/install-independent-review.sh" "$repo" "$fixture_dir" both
printf '%s\n' '.agents/' '.claude/' >>"$repo/.git/info/exclude"
for host_root in .agents .claude; do
  mkdir -p "$repo/$host_root/skills/assess-candidate"
  cp "$fixture_dir/verification/SKILL.fixture.md" "$repo/$host_root/skills/assess-candidate/SKILL.md"
  cp "$fixture_dir/verification/verification-fixture" "$repo/$host_root/bin/verification-fixture"
  chmod +x "$repo/$host_root/bin/verification-fixture"
done
