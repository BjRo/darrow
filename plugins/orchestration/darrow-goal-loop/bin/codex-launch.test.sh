#!/usr/bin/env bash
# shellcheck disable=SC2016
# The single-quoted backticks below are literal Markdown contract text.
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
skill="$plugin_dir/skills/adaptive-delivery/SKILL.md"
guide="$plugin_dir/skills/adaptive-delivery/references/codex-launch.md"

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

require_line() {
  grep -F -- "$2" "$1" >/dev/null || fail "missing contract text: $2"
}

require_line "$skill" 'launch exactly one route-selected subagent owner'
require_line "$skill" '- phase: adaptive-delivery-owner'
require_line "$skill" 'A direct shell, Git, forge,'
require_line "$guide" '`fork_turns` set to `none`'
require_line "$guide" '`model` set to the selected concrete Codex model'
require_line "$guide" '`reasoning_effort` set to the selected effort'
# Assert the host controls, not one prose rendering of idle/active feedback.
# Live continuation cases cover the same-owner behavior at the public seam.
require_line "$guide" '`followup_task`'
require_line "$guide" '`send_message`'

# Mentioning a host control in a prohibition is not a lifecycle invocation.
# Live transcript checks cover create_goal/update_goal usage, including mirrors.
if grep -E 'goal-loop step|Protocol ledger|materialize-objective|darrow-native-goal-report' \
  "$skill" "$guide" >/dev/null; then
  fail "Codex launch surface retained removed lifecycle protocol"
fi

printf 'ok - Codex separate-owner launch contract\n'
