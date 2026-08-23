#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
skill="$plugin_dir/skills/adaptive-goal/SKILL.md"
guide="$plugin_dir/skills/adaptive-goal/references/codex-launch.md"
review_lifecycle="$plugin_dir/skills/adaptive-goal/references/review-lifecycle.md"
readme="$plugin_dir/README.md"
hook_manifest="$plugin_dir/hooks/hooks.json"
hook_helper="$plugin_dir/bin/goal-loop-hook"
hook_test="$plugin_dir/bin/goal-loop-hook.test.sh"

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
require_text "$guide" 'step materialize'
require_text "$guide" 'step activate'
require_text "$skill" 'step report'
reject_text "$readme" 'helper+codex-hooks'
reject_text "$readme" 'helper+claude-hooks'
test ! -e "$hook_manifest" || fail "$hook_manifest is still packaged"
test ! -e "$hook_helper" || fail "$hook_helper is still packaged"
test ! -e "$hook_test" || fail "$hook_test is still packaged"
# shellcheck disable=SC2016 # literal Markdown code span
require_text "$guide" 'before the first `create_goal` call'
# shellcheck disable=SC2016 # literal Markdown code span
require_text "$guide" 'Do not retry `create_goal`'
require_text "$guide" 'review-lifecycle.md'
require_text "$skill" 'Initial independent review: blocking —'
require_text "$skill" 'Fix verification: <clear|continue|no_progress|blocked|unavailable|inconclusive>.'
require_text "$review_lifecycle" 'materially progresses'
# shellcheck disable=SC2016 # literal Markdown code span
require_text "$guide" 'Do not run `confirm-route`'
require_text "$guide" 'Absence or failure of a close'
require_text "$guide" 'control does not invalidate'
require_text "$guide" 'The creator never performs'
require_text "$skill" 'file-backed objective'
require_text "$readme" 'exposes a close control, closes each child'

reject_text "$skill" 'A spawn-only surface is unavailable.'
reject_text "$skill" 'A missing or failed close is incomplete cleanup, not successful completion.'
reject_text "$guide" "exposes both \`spawn_agent\` and \`close_agent\`"
reject_text "$guide" 'If closing fails, report the cleanup failure and do not claim complete.'

printf 'codex launch contract tests passed\n'
