#!/usr/bin/env bash
set -euo pipefail
printf '/.agents/\n/.claude/\n' >> .git/info/exclude
source_root=$(cd "$DARROW_EVAL_CASE_DIR/../../../.." && pwd -P)
mkdir -p .git/fixture-bin
for tool in gh curl wget npm npx; do
  # The generated mock expands $0 at invocation, not during fixture setup.
  # shellcheck disable=SC2016
  printf '%s\n' '#!/bin/sh' 'printf "%s\n" "${0##*/}" >> .git/guide-effects' 'exit 73' > ".git/fixture-bin/$tool"
  chmod +x ".git/fixture-bin/$tool"
done
for file in README.md CONTRIBUTING.md LICENSE package.json; do
  cp "$source_root/$file" "$file"
done
mkdir -p docs evals/runner .claude-plugin
for file in "$source_root"/docs/*.md; do cp "$file" docs/; done
for directory in specs decisions assets; do cp -R "$source_root/docs/$directory" docs/; done
mkdir -p docs/research
for file in "$source_root"/docs/research/*.md; do
  # Keep public research available without exposing this task's acceptance ledger.
  [ "$(basename "$file")" = repository-guide-98-delivery.md ] && continue
  cp "$file" docs/research/
done
cp "$source_root/evals/runner/run.ts" evals/runner/run.ts
cp "$source_root/.claude-plugin/marketplace.json" .claude-plugin/marketplace.json
for category in "$source_root"/plugins/*; do
  mkdir -p "plugins/$(basename "$category")"
  if [ -f "$category/README.md" ]; then cp "$category/README.md" "plugins/$(basename "$category")/README.md"; fi
  for plugin in "$category"/*; do
    [ -d "$plugin" ] || continue
    destination="plugins/$(basename "$category")/$(basename "$plugin")"
    mkdir -p "$destination/.claude-plugin" "$destination/.codex-plugin"
    cp "$plugin/README.md" "$destination/README.md"
    cp "$plugin/.claude-plugin/plugin.json" "$destination/.claude-plugin/plugin.json"
    cp "$plugin/.codex-plugin/plugin.json" "$destination/.codex-plugin/plugin.json"
  done
done
if [ "${1:-}" = conflict ]; then
  printf '\n## Activation claim\n\nComplex work starts adaptive-delivery automatically without explicit invocation.\n' >> plugins/orchestration/darrow-adaptive-delivery/README.md
fi
if [ "${1:-}" = diagnosis ]; then
  mkdir -p .agents/skills/diagnose-plugin .claude/skills/diagnose-plugin
  cp "$DARROW_EVAL_CASE_DIR/fixtures/diagnose-plugin.template.md" .agents/skills/diagnose-plugin/SKILL.md
  cp "$DARROW_EVAL_CASE_DIR/fixtures/diagnose-plugin.template.md" .claude/skills/diagnose-plugin/SKILL.md
fi
: > .git/guide-effects
git add README.md CONTRIBUTING.md LICENSE package.json docs evals/runner .claude-plugin plugins
git -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm "chore: snapshot guide sources"
git rev-parse HEAD > .git/guide-base
cp .git/config .git/guide-config
