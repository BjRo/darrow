#!/usr/bin/env bash
# shellcheck disable=SC2016
# The single-quoted backticks below are literal Markdown contract text.
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
skill="$plugin_dir/skills/adaptive-goal/SKILL.md"
guide="$plugin_dir/skills/adaptive-goal/references/codex-launch.md"

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

require_line() {
  grep -F -- "$2" "$1" >/dev/null || fail "missing contract text: $2"
}

require_line "$skill" 'launch exactly one route-selected subagent owner'
require_line "$skill" '- phase: adaptive-goal-owner'
require_line "$skill" 'A direct shell, Git, forge,'
require_line "$guide" '`fork_turns` set to `none`'
require_line "$guide" '`model` set to the selected concrete Codex model'
require_line "$guide" '`reasoning_effort` set to the selected effort'
require_line "$guide" 'Call `followup_task` exactly once'

if grep -E 'goal-loop step|Protocol ledger|create_goal|materialize-objective|darrow-native-goal-report' \
  "$skill" "$guide" >/dev/null; then
  fail "Codex launch surface retained removed lifecycle protocol"
fi

printf 'ok - Codex separate-owner launch contract\n'
