#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
repo=$(CDPATH='' cd -- "$plugin_dir/../.." && pwd)
agents_dir="$plugin_dir/agents"
guide="$plugin_dir/skills/adaptive-goal/references/claude-launch.md"
skill="$plugin_dir/skills/adaptive-goal/SKILL.md"
goal_loop="$plugin_dir/bin/goal-loop"
claude_agent_route="$plugin_dir/bin/claude-agent-route"
claude_verify_route="$plugin_dir/bin/claude-verify-route"

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

# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- 'no per-invocation `model` override' "$guide" >/dev/null ||
  fail 'Claude launch guide does not preserve the full model ID'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- '`run_in_background` set to `false`' "$guide" >/dev/null ||
  fail 'Claude launch guide does not require foreground execution'
grep -F -- 'Do not launch a second' "$guide" >/dev/null ||
  fail 'Claude launch guide does not preserve the single-runner boundary'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
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

grep -F -- 'claude-verify-route' "$guide" >/dev/null ||
  fail 'Claude launch guide does not require transcript-based route verification'
grep -F -- 'self-report prove neither model nor effort' "$guide" >/dev/null ||
  fail 'Claude launch guide no longer discloses that self-report proves nothing'
grep -F -- 'still confidently self-report the selected model' "$guide" >/dev/null ||
  fail 'Claude launch guide does not warn that self-report can be wrong'
test -x "$claude_verify_route" || fail "claude-verify-route is not executable: $claude_verify_route"

# --- claude-verify-route: synthetic transcript fixtures, no live Agent call ---
verify_tmp=$(mktemp -d)
trap 'rm -rf "$verify_tmp"' EXIT
fixture_repo="$verify_tmp/repo"
mkdir -p "$fixture_repo"
projects_root="$verify_tmp/projects"
fixture_repo_real=$(CDPATH='' cd -- "$fixture_repo" && pwd)
slug=$(printf '%s' "$fixture_repo_real" | sed 's#^/##; s#/#-#g')
slug="-$slug"
session_dir="$projects_root/$slug"
mkdir -p "$session_dir"

write_turn() {
  # write_turn <file> <agent-id> <model> <effort>
  printf '{"parentUuid":null,"isSidechain":true,"message":{"model":"%s","id":"msg_x","type":"message","role":"assistant","content":[]},"requestId":"req_x","type":"assistant","uuid":"u1","timestamp":"t","effort":"%s","session_id":"%s","userType":"agent"}\n' \
    "$3" "$4" "$2" >>"$1"
}

good_transcript="$session_dir/good.jsonl"
write_turn "$good_transcript" agentgood claude-sonnet-5 low
write_turn "$good_transcript" agentgood claude-sonnet-5 low

resolved=$(bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentgood \
  --projects-dir "$projects_root")
case "$resolved" in
  *$'observed_route\tclaude\tanthropic\tclaude-sonnet-5\tlow'*) ;;
  *) fail 'claude-verify-route did not derive the consistent observed route' ;;
esac

if bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentmissing \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail 'claude-verify-route accepted an agent id with no transcript evidence'
fi

mixed_transcript="$session_dir/mixed.jsonl"
write_turn "$mixed_transcript" agentmixed claude-sonnet-5 low
write_turn "$mixed_transcript" agentmixed claude-opus-5 low
if bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentmixed \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail 'claude-verify-route accepted inconsistent model evidence across turns'
fi

# The gate confirm-route provides only rejects a mismatch when fed a real
# observed value; prove the two compose, not just that each rejects in
# isolation.
if bash "$goal_loop" confirm-route \
  --selected  'claude|anthropic|claude-opus-5|high' \
  --effective 'claude|anthropic|claude-sonnet-5|high' \
  --applied-by native-subagent >/dev/null 2>&1; then
  fail 'confirm-route accepted a transcript-observed model that differs from the selected model'
fi

printf 'claude launch tests passed\n'
