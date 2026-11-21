#!/usr/bin/env bash
set -euo pipefail
case_dir=$(cd "$(dirname "$0")/.." && pwd -P)
test_parent=${TMPDIR:-/tmp}
test_parent=$(cd "$test_parent" && pwd -P)
test_dir=$(mktemp -d "$test_parent/darrow-guide-fixture.XXXXXX")
test_dir=$(cd "$test_dir" && pwd -P)
trap 'rm -rf "$test_dir"' EXIT
cd "$test_dir"
git init -q
DARROW_EVAL_CASE_DIR="$case_dir" "$BASH" "$case_dir/fixtures/setup.sh" conflict
test -f docs/python-quality.md
test -f docs/decisions/ADR-0014-keep-current-documentation-with-its-owner.md
cmp "$case_dir/../../../../evals/sevro-extension/index.ts" evals/sevro-extension/index.ts
if [ ! -f plugins/capability/darrow-matt-pocock/skills/writing-for-agents/SKILL.md ]; then
  printf 'missing public skill source: darrow-matt-pocock/writing-for-agents\n' >&2
  exit 1
fi
source_root=$(cd "$case_dir/../../../.." && pwd -P)
git -C "$source_root" ls-files 'plugins/*/*/skills/**' 'plugins/*/*/references/**' |
  while IFS= read -r file; do
    case "$file" in */evals/*) continue ;; esac
    [ -f "$source_root/$file" ] || continue
    printf '%s\n' "$file"
  done > .git/guide-expected-public-files
while IFS= read -r file; do
  cmp "$source_root/$file" "$file"
done < .git/guide-expected-public-files
git ls-files 'plugins/*/*/skills/**' 'plugins/*/*/references/**' > .git/guide-copied-public-files
cmp .git/guide-expected-public-files .git/guide-copied-public-files
test -z "$(find plugins -type d \( -name evals -o -name .git -o -name .fixture-state -o -path '*/backend/tests' \) -print)"
test ! -e evals/runner
test -f plugins/capability/darrow-git/.codex-plugin/plugin.json
test -f plugins/automation/darrow-artificer/backend/src/darrow_artificer/cli.py
test -f plugins/automation/darrow-artificer/skills/manage-artificer/SKILL.md
test ! -e plugins/automation/darrow-artificer/skills/manage-artificer/evals
test -f plugins/capability/darrow-matt-pocock/.codex-plugin/plugin.json
test -f plugins/capability/darrow-pstack/.claude-plugin/plugin.json
test ! -e .agents/skills/darrow-guide/evals/inventory.json
grep -F 'Complex work starts adaptive-goal automatically' plugins/orchestration/darrow-adaptive-goal/README.md >/dev/null
test "$(git rev-parse HEAD)" = "$(cat .git/guide-base)"
test -z "$(git status --porcelain --untracked-files=all)"
test ! -s .fixture-state/guide-effects
cmp .git/config .git/guide-config
global_modules=$(".git/fixture-bin/npm" root -g)
case "$global_modules" in
  "$test_dir"/*) test -d "$global_modules" ;;
  *) printf 'npm root returned a directory outside the fixture\n' >&2; exit 1 ;;
esac
test ! -s .fixture-state/guide-effects
test -z "$(git status --porcelain --untracked-files=all)"
cmp .git/config .git/guide-config
for command in install publish view; do
  if ".git/fixture-bin/npm" "$command"; then
    printf 'npm %s unexpectedly succeeded\n' "$command" >&2
    exit 1
  else
    test "$?" -eq 73
  fi
done
if ".git/fixture-bin/npm" root -g extra; then
  printf 'npm root with extra arguments unexpectedly succeeded\n' >&2
  exit 1
else
  test "$?" -eq 73
fi
test "$(wc -l < .fixture-state/guide-effects | tr -d ' ')" -eq 4
test "$(sort -u .fixture-state/guide-effects)" = npm
: > .fixture-state/guide-effects
for tool in gh curl wget npm npx; do
  if ".git/fixture-bin/$tool"; then
    printf 'mock unexpectedly succeeded: %s\n' "$tool" >&2
    exit 1
  else
    test "$?" -eq 73
  fi
done
test "$(wc -l < .fixture-state/guide-effects | tr -d ' ')" -eq 5
mkdir -p scratch/nested
if (cd scratch/nested && "$test_dir/.git/fixture-bin/curl"); then
  printf 'nested command unexpectedly succeeded\n' >&2
  exit 1
else
  test "$?" -eq 73
fi
test "$(wc -l < .fixture-state/guide-effects | tr -d ' ')" -eq 6
test ! -e scratch/nested/.fixture-state/guide-effects
rmdir scratch/nested scratch
DARROW_EVAL_CASE_DIR="$case_dir" "$BASH" "$case_dir/fixtures/setup.sh" diagnosis
cmp .agents/skills/diagnose-plugin/SKILL.md .claude/skills/diagnose-plugin/SKILL.md
test -z "$(git status --porcelain --untracked-files=all)"
printf 'guide fixture snapshot and optional states passed\n'
