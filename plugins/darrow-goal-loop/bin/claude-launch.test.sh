#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
repo=$(CDPATH= cd -- "$plugin_dir/../.." && pwd)
agents_dir="$plugin_dir/agents"
guide="$plugin_dir/skills/adaptive-goal/references/claude-launch.md"
skill="$plugin_dir/skills/adaptive-goal/SKILL.md"
goal_loop="$plugin_dir/bin/goal-loop"
claude_agent_route="$plugin_dir/bin/claude-agent-route"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

require_line() {
  file=$1
  expected=$2
  grep -F -x -- "$expected" "$file" >/dev/null ||
    fail "$file is missing: $expected"
}

check_runner() {
  suffix=$1
  model=$2
  effort=$3
  agent="$agents_dir/adaptive-goal-$suffix.md"
  test -r "$agent" || fail "missing Claude runner: $agent"
  require_line "$agent" "name: adaptive-goal-$suffix"
  require_line "$agent" "model: $model"
  require_line "$agent" "effort: $effort"
  require_line "$agent" 'background: false'
  grep -F -- 'Adaptive Goal Loop runner' "$agent" >/dev/null ||
    fail "$agent lacks visible Adaptive Goal Loop metadata"
  grep -F -- "darrow-goal-loop:adaptive-goal-$suffix" "$guide" >/dev/null ||
    fail "Claude launch guide does not route $model/$effort to its runner"
  resolved=$(bash "$claude_agent_route" --provider anthropic --model "$model" --effort "$effort")
  case "$resolved" in
    *$'subagent_type\tdarrow-goal-loop:adaptive-goal-'"$suffix"*) ;;
    *) fail "Claude route helper did not select $suffix" ;;
  esac
}

check_runner sonnet-5-low claude-sonnet-5 low
check_runner sonnet-5-medium claude-sonnet-5 medium
check_runner opus-5-high claude-opus-5 high

for profile in routine routine-plus scaled repo-wide judgment; do
  case "$profile" in
    routine) expected=$'selected_route\tclaude\tanthropic\tclaude-sonnet-5\tlow' ;;
    routine-plus|scaled) expected=$'selected_route\tclaude\tanthropic\tclaude-sonnet-5\tmedium' ;;
    repo-wide|judgment) expected=$'selected_route\tclaude\tanthropic\tclaude-opus-5\thigh' ;;
  esac
  route=$(bash "$goal_loop" route --repo "$repo" --host claude --profile "$profile")
  case "$route" in
    *"$expected"*) ;;
    *) fail "Claude policy route for $profile has no exact bundled runner" ;;
  esac
done

runner_count=$(find "$agents_dir" -type f -name 'adaptive-goal-*.md' | wc -l | tr -d ' ')
test "$runner_count" = 3 || fail "expected three bundled-route runners, found $runner_count"

grep -F -- 'no per-invocation `model` override' "$guide" >/dev/null ||
  fail 'Claude launch guide does not preserve the full model ID'
grep -F -- '`run_in_background` set to `false`' "$guide" >/dev/null ||
  fail 'Claude launch guide does not require foreground execution'
grep -F -- 'Do not launch a second' "$guide" >/dev/null ||
  fail 'Claude launch guide does not preserve the single-runner boundary'
grep -F -- 'does not expose its session-scoped `/goal` command' "$guide" >/dev/null ||
  fail 'Claude launch guide does not disclose the native goal limitation'
grep -F -- 'Claude activation is mandatory' "$skill" >/dev/null ||
  fail 'parent skill does not forbid direct Claude implementation'
grep -F -- 'Do not implement directly in the classifier turn' "$skill" >/dev/null ||
  fail 'parent skill does not preserve read-only Claude preflight'

if CLAUDE_CODE_SUBAGENT_MODEL=claude-opus-5 bash "$claude_agent_route" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null 2>&1; then
  fail 'Claude route helper accepted a conflicting model override'
fi
if CLAUDE_CODE_SUBAGENT_MODEL=inherit bash "$claude_agent_route" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null 2>&1; then
  fail 'Claude route helper accepted a version-dependent inherit override'
fi
if CLAUDE_CODE_EFFORT_LEVEL=auto bash "$claude_agent_route" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null 2>&1; then
  fail 'Claude route helper accepted a non-concrete effort override'
fi
if bash "$claude_agent_route" --provider anthropic \
  --model claude-sonnet-5 --effort high >/dev/null 2>&1; then
  fail 'Claude route helper accepted a route without a bundled runner'
fi

printf 'claude launch tests passed\n'
