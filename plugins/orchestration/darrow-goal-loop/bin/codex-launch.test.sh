#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
skill="$plugin_dir/skills/adaptive-goal/SKILL.md"
guide="$plugin_dir/skills/adaptive-goal/references/codex-launch.md"
readme="$plugin_dir/README.md"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_text() {
  file=$1
  expected=$2
  grep -F -- "$expected" "$file" >/dev/null ||
    fail "$file is missing: $expected"
}

reject_text() {
  file=$1
  rejected=$2
  if grep -F -- "$rejected" "$file" >/dev/null; then
    fail "$file still contains: $rejected"
  fi
}

require_text "$guide" 'Close the subagent when the goal has been fulfilled'
require_text "$guide" 'Absence or failure of a close'
require_text "$guide" 'control does not invalidate'
require_text "$guide" 'materialize-objective'
# shellcheck disable=SC2016 # literal Markdown code span
require_text "$guide" 'before the first `create_goal` call'
# shellcheck disable=SC2016 # literal Markdown code span
require_text "$guide" 'Do not retry `create_goal`'
require_text "$guide" 'Initial independent review: blocking —'
require_text "$guide" 'Fix verification: <outcome>.'
# shellcheck disable=SC2016 # literal Markdown code span
require_text "$guide" 'Do not run `confirm-route`'
require_text "$skill" 'without requiring a close control'
require_text "$skill" 'The creator never runs'
require_text "$skill" 'file-backed objective'
require_text "$readme" 'exposes a close control, closes each child'

reject_text "$skill" 'A spawn-only surface is unavailable.'
reject_text "$skill" 'A missing or failed close is incomplete cleanup, not successful completion.'
reject_text "$guide" "exposes both \`spawn_agent\` and \`close_agent\`"
reject_text "$guide" 'If closing fails, report the cleanup failure and do not claim complete.'

printf 'codex launch contract tests passed\n'
