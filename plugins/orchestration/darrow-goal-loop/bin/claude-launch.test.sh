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
claude_route_gate="$plugin_dir/bin/claude-route-gate"

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
  grep -F -- 'Read its ordinary response semantically' "$agent" >/dev/null ||
    fail "$agent does not interpret selected independent-review evidence"
  grep -F -- 'Independent review:' "$agent" >/dev/null ||
    fail "$agent does not return the canonical initial-review outcome"
  grep -F -- 'Fix verification:' "$agent" >/dev/null ||
    fail "$agent does not return the canonical repair-verification outcome"
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
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- 'no `resume` on the initial call' "$guide" >/dev/null ||
  fail 'Claude launch guide does not distinguish initial launch from resume'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- '`SendMessage` once with `to` set to that exact host-reported agent id' "$guide" >/dev/null ||
  fail 'Claude launch guide does not resume the same blocked Agent'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- '`task_notification` with the same task id' "$guide" >/dev/null ||
  fail 'Claude launch guide does not bind the resumed completion to the same Agent'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- 'wraps the delivered payload in fixed coordinator-message text' "$guide" >/dev/null ||
  fail 'Claude launch guide does not account for SendMessage transport framing'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- 'without calling `ScheduleWakeup`' "$guide" >/dev/null ||
  fail 'Claude launch guide adds a continuation scheduler'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- '`- phase: blocked-goal-response`' "$guide" >/dev/null ||
  fail 'Claude launch guide does not bind the blocked response turn'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- '`SendMessage` does not create' "$guide" >/dev/null ||
  fail 'Claude resume incorrectly counts a replacement owner'
grep -F -- 'Do not release or close' "$guide" >/dev/null ||
  fail 'Claude launch guide does not retain blocked lifecycle state'
grep -F -- 'goal-loop step report' "$guide" >/dev/null ||
  fail 'Claude launch guide does not render resumable blocked snapshots'
grep -F -- 'Do not launch a second' "$guide" >/dev/null ||
  fail 'Claude launch guide does not preserve the single-runner boundary'
grep -F -- 'do not parse or reproduce its output' "$guide" >/dev/null ||
  fail 'Claude launch guide couples selected review to an output format'
# shellcheck disable=SC2016 # literal grep -F needle; the backticks are Markdown code spans
grep -F -- 'does not expose its session-scoped `/goal` command' "$guide" >/dev/null ||
  fail 'Claude launch guide does not disclose the native goal limitation'
grep -F -- 'The helper protocol is mandatory' "$skill" >/dev/null ||
  fail 'parent skill does not forbid direct Claude implementation'
grep -F -- 'directly in the classifier turn' "$skill" >/dev/null ||
  fail 'parent skill does not preserve read-only Claude preflight'
require_line "$guide" '/bin/bash <absolute-plugin-bin>/goal-loop step start --repo <absolute-repo> --host claude'
require_line "$guide" '/bin/bash <absolute-plugin-bin>/goal-loop step prepare --ledger <absolute-ledger>'
require_line "$guide" "/bin/bash <absolute-plugin-bin>/goal-loop step route --ledger <absolute-ledger> \\"
require_line "$guide" "/bin/bash <absolute-plugin-bin>/goal-loop step stage --ledger <absolute-ledger> \\"
require_line "$guide" "/bin/bash <absolute-plugin-bin>/goal-loop step materialize --ledger <absolute-ledger> \\"
require_line "$guide" "/bin/bash <absolute-plugin-bin>/goal-loop step release-staging \\"
require_line "$guide" "/bin/bash <absolute-plugin-bin>/goal-loop step release-objective \\"
require_line "$guide" "/bin/bash <absolute-plugin-bin>/goal-loop step runner --ledger <absolute-ledger> \\"
require_line "$guide" "/bin/bash <absolute-plugin-bin>/claude-route-gate --repo <absolute-repo> \\"

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

grep -F -- 'claude-route-gate' "$guide" >/dev/null ||
  fail 'Claude launch guide does not require the bounded route gate'
grep -F -- 'self-report prove neither model nor effort' "$guide" >/dev/null ||
  fail 'Claude launch guide no longer discloses that self-report proves nothing'
grep -F -- 'still confidently self-report the selected model' "$guide" >/dev/null ||
  fail 'Claude launch guide does not warn that self-report can be wrong'
test -x "$claude_verify_route" || fail "claude-verify-route is not executable: $claude_verify_route"
test -x "$claude_route_gate" || fail "claude-route-gate is not executable: $claude_route_gate"

# --- claude-verify-route: synthetic transcript fixtures, no live Agent call ---
verify_tmp=$(mktemp -d)
trap 'rm -rf "$verify_tmp"' EXIT
fixture_repo="$verify_tmp/repo"
mkdir -p "$fixture_repo"
projects_root="$verify_tmp/projects"
fixture_repo_real=$(CDPATH='' cd -- "$fixture_repo" && pwd -P)
slug=$(printf '%s' "$fixture_repo_real" | sed 's#[^A-Za-z0-9]#-#g')
session_dir="$projects_root/$slug"
mkdir -p "$session_dir"

write_turn() {
  # write_turn <file> <agent-id> <model> <effort>
  printf '{"parentUuid":null,"isSidechain":true,"message":{"model":"%s","id":"msg_x","type":"message","role":"assistant","content":[]},"requestId":"req_x","type":"assistant","uuid":"u1","timestamp":"t","effort":"%s","session_id":"%s","userType":"agent"}\n' \
    "$3" "$4" "$2" >>"$1"
}

write_current_turn() {
  # write_current_turn <file> <agent-id> <model> <effort>
  printf '{"parentUuid":null,"isSidechain":true,"agentId":"%s","message":{"model":"%s","id":"msg_x","type":"message","role":"assistant","content":[]},"requestId":"req_x","type":"assistant","uuid":"u1","timestamp":"t","effort":"%s","userType":"external"}\n' \
    "$2" "$3" "$4" >>"$1"
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

current_subagents="$session_dir/current-session/subagents"
mkdir -p "$current_subagents"
current_transcript="$current_subagents/agent-agentcurrent.jsonl"
write_current_turn "$current_transcript" agentcurrent claude-sonnet-5 low
write_current_turn "$current_transcript" agentcurrent claude-sonnet-5 low
current_resolved=$(bash "$claude_verify_route" --repo "$fixture_repo" \
  --agent-id agentcurrent --projects-dir "$projects_root")
case "$current_resolved" in
  *$'observed_route\tclaude\tanthropic\tclaude-sonnet-5\tlow'*) ;;
  *) fail 'claude-verify-route did not accept the current Agent transcript schema' ;;
esac

gate_record=$(CLAUDE_CONFIG_DIR="$verify_tmp" bash "$claude_route_gate" \
  --repo "$fixture_repo" --agent-id agentgood \
  --selected 'claude|anthropic|claude-sonnet-5|low')
case "$gate_record" in
  $'format\tdarrow-claude-route-gate-v1\nagent_id\tagentgood\nobserved_route\tclaude\tanthropic\tclaude-sonnet-5\tlow\nconfirmation\tconfirmed') ;;
  *) fail 'claude-route-gate did not bind and confirm the observed Agent route' ;;
esac
case "$gate_record" in
  *transcript*) fail 'claude-route-gate exposed a transcript path' ;;
esac

untrusted_record=$(DARROW_CLAUDE_ROUTE_TELEMETRY=untrusted \
  CLAUDE_CONFIG_DIR="$verify_tmp" bash "$claude_route_gate" \
  --repo "$fixture_repo" --agent-id agentgood \
  --selected 'claude|anthropic|claude-sonnet-5|low')
case "$untrusted_record" in
  $'format\tdarrow-claude-route-gate-v1\nagent_id\tagentgood\nobservation\tunavailable') ;;
  *) fail 'claude-route-gate trusted telemetry marked untrusted by its host' ;;
esac

mismatch_status=0
mismatch_record=$(CLAUDE_CONFIG_DIR="$verify_tmp" bash "$claude_route_gate" \
  --repo "$fixture_repo" --agent-id agentgood \
  --selected 'claude|anthropic|claude-opus-5|high') || mismatch_status=$?
test "$mismatch_status" -ne 0 ||
  fail 'claude-route-gate returned success for a rejected route'
case "$mismatch_record" in
  *$'confirmation\trejected') ;;
  *) fail 'claude-route-gate did not reject a mismatched selected route' ;;
esac

unavailable_record=$(CLAUDE_CONFIG_DIR="$verify_tmp" bash "$claude_route_gate" \
  --repo "$fixture_repo" --agent-id agentmissing \
  --selected 'claude|anthropic|claude-sonnet-5|low')
case "$unavailable_record" in
  $'format\tdarrow-claude-route-gate-v1\nagent_id\tagentmissing\nobservation\tunavailable') ;;
  *) fail 'claude-route-gate did not fail closed on unavailable observation' ;;
esac

if bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentmissing \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail 'claude-verify-route accepted an agent id with no transcript evidence'
fi

mentioned_transcript="$session_dir/mentioned.jsonl"
printf '%s\n' \
  '{"parentUuid":null,"isSidechain":true,"message":{"model":"claude-sonnet-5","id":"msg_x","type":"message","role":"assistant","content":[{"type":"text","text":"agentmentioned"}]},"requestId":"req_x","type":"assistant","uuid":"u1","timestamp":"t","effort":"low","session_id":"otheragent","userType":"agent"}' \
  >"$mentioned_transcript"
if bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentmentioned \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail 'claude-verify-route accepted an agent id mentioned outside session_id'
fi

nested_session_transcript="$session_dir/nested-session.jsonl"
printf '%s\n' \
  '{"parentUuid":null,"isSidechain":true,"message":{"model":"claude-sonnet-5","id":"msg_x","type":"message","role":"assistant","content":[{"type":"tool_use","input":{"session_id":"agentnested","userType":"agent"}}]},"requestId":"req_x","type":"assistant","uuid":"u1","timestamp":"t","effort":"low","session_id":"otheragent","userType":"agent"}' \
  >"$nested_session_transcript"
if bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentnested \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail 'claude-verify-route accepted a nested session_id as transcript ownership'
fi

mixed_transcript="$session_dir/mixed.jsonl"
write_turn "$mixed_transcript" agentmixed claude-sonnet-5 low
write_turn "$mixed_transcript" agentmixed claude-opus-5 low
if bash "$claude_verify_route" --repo "$fixture_repo" --agent-id agentmixed \
  --projects-dir "$projects_root" >/dev/null 2>&1; then
  fail 'claude-verify-route accepted inconsistent model evidence across turns'
fi

printf 'claude launch tests passed\n'
