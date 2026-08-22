#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_root=$(CDPATH='' cd -- "$script_dir/.." && pwd)
goal_loop="$script_dir/goal-loop"
hook="$script_dir/goal-loop-hook"
tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-goal-hook-test.XXXXXX")
tmp_root=$(CDPATH='' cd -- "$tmp_root" && pwd -P)
trap 'rm -rf "$tmp_root"' EXIT
plugin_data="$tmp_root/plugin-data"
repo="$tmp_root/repo"
mkdir -p "$plugin_data" "$repo"
git -C "$repo" init -q
git -C "$repo" config user.email test@example.com
git -C "$repo" config user.name Test
printf 'base\n' >"$repo/base.txt"
git -C "$repo" add base.txt
git -C "$repo" commit -qm base

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

record_value() {
  records=$1
  wanted=$2
  tab=$(printf '\t')
  while IFS="$tab" read -r key value extra; do
    if test "$key" = "$wanted"; then
      test -n "$value" && test -z "${extra:-}" || return 1
      printf '%s\n' "$value"
      return 0
    fi
  done <<EOF
$records
EOF
  return 1
}

run_hook() {
  hook_json=$1
  printf '%s\n' "$hook_json" >"$tmp_root/hook-input.json"
  TMPDIR="$tmp_root" CLAUDE_PLUGIN_ROOT="$plugin_root" \
    CLAUDE_PLUGIN_DATA="$plugin_data" PLUGIN_ROOT="$plugin_root" \
    PLUGIN_DATA="$plugin_data" bash "$hook" <"$tmp_root/hook-input.json"
}

expect_denied() {
  denied_label=$1
  denied_json=$2
  denied_status=0
  run_hook "$denied_json" >"$tmp_root/denied.out" 2>"$tmp_root/denied.err" ||
    denied_status=$?
  test "$denied_status" -eq 2 || fail "$denied_label was not denied"
  test -s "$tmp_root/denied.err" || fail "$denied_label omitted a reason"
}

bind_session() {
  bind_session_id=$1
  bind_host=$2
  start_command="bash $goal_loop step start --repo $repo --host $bind_host"
  run_hook "{\"session_id\":\"$bind_session_id\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$start_command\"}}" >/dev/null
  start_output=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
    --repo "$repo" --host "$bind_host")
  bound_ledger=$(record_value "$start_output" ledger)
  run_hook "{\"session_id\":\"$bind_session_id\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$start_command\"},\"tool_response\":\"ok\"}" >/dev/null
  test "$(sed -n '1p' "$plugin_data/sessions/$bind_session_id")" = "$bound_ledger" ||
    fail "hook did not bind $bind_host session"
  printf '%s\n' "$bound_ledger"
}

test -x "$hook" || fail 'goal-loop hook is not executable'
test -r "$plugin_root/hooks/hooks.json" || fail 'plugin hook manifest is missing'

claude_session=claude-session
claude_ledger=$(bind_session "$claude_session" claude)
claude_staging=$(record_value "$(cat "$claude_ledger/state")" staging_dir)
bash "$goal_loop" step prepare --ledger "$claude_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$claude_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --review omitted >/dev/null
bash "$goal_loop" step runner --ledger "$claude_ledger" --provider anthropic \
  --model claude-sonnet-5 --effort low >/dev/null

expect_denied 'Claude pre-owner shell command' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git status\"}}"
expect_denied 'compound helper shell command' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash $goal_loop step prepare --ledger $claude_ledger; touch $repo/escaped\"}}"
expect_denied 'direct ledger write' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_ledger/state\",\"content\":\"tamper\"}}"
expect_denied 'early Claude Agent' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"task\":\"- phase: adaptive-goal-runner\"}}"

claude_goal="$claude_staging/claude-goal.md"
expect_denied 'canonicalized staging traversal' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_staging/../escaped\",\"content\":\"escape\"}}"
write_json="{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_goal\",\"content\":\"Outcome: hook test\"}}"
run_hook "$write_json" >/dev/null
printf '%s\n' 'Outcome: hook test' >"$claude_goal"
post_write_json="{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_goal\",\"content\":\"Outcome: hook test\"},\"tool_response\":\"ok\"}"
run_hook "$post_write_json" >/dev/null
expect_denied 'second Claude staging Write' "$write_json"
claude_digest=$(shasum -a 256 "$claude_goal")
claude_digest=${claude_digest%% *}
bash "$goal_loop" step stage --ledger "$claude_ledger" \
  --goal-file "$claude_goal" --expected-sha256 "$claude_digest" >/dev/null
claude_materialized=$(bash "$goal_loop" step materialize --ledger "$claude_ledger" \
  --goal-file "$claude_goal" --expected-sha256 "$claude_digest")
bash "$goal_loop" step release-staging --ledger "$claude_ledger" \
  --goal-file "$claude_goal" --expected-sha256 "$claude_digest" >/dev/null
claude_objective=$(record_value "$claude_materialized" objective_file)
claude_agent_json="{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"prompt\":\"- phase: adaptive-goal-runner\\n- objective_file: $claude_objective\"}}"
run_hook "$claude_agent_json" >/dev/null
expect_denied 'Claude Agent task with appended text' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"prompt\":\"- phase: adaptive-goal-runner\\n- objective_file: $claude_objective\\nextra\"}}"
run_hook "${claude_agent_json/PreToolUse/PostToolUse}" >/dev/null
expect_denied 'second Claude Agent' "$claude_agent_json"
expect_denied 'Claude turn end before helper report' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"unfinished\"}"

codex_session=codex-session
codex_ledger=$(bind_session "$codex_session" codex)
codex_staging=$(record_value "$(cat "$codex_ledger/state")" staging_dir)
bash "$goal_loop" step prepare --ledger "$codex_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$codex_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --review omitted >/dev/null
codex_goal="$codex_staging/codex-goal.md"
printf '%s\n' 'Outcome: Codex hook test' >"$codex_goal"
codex_digest=$(shasum -a 256 "$codex_goal")
codex_digest=${codex_digest%% *}
bash "$goal_loop" step stage --ledger "$codex_ledger" \
  --goal-file "$codex_goal" --expected-sha256 "$codex_digest" >/dev/null
bash "$goal_loop" step materialize --ledger "$codex_ledger" \
  --goal-file "$codex_goal" --expected-sha256 "$codex_digest" >/dev/null
bash "$goal_loop" step release-staging --ledger "$codex_ledger" \
  --goal-file "$codex_goal" --expected-sha256 "$codex_digest" >/dev/null

wrong_codex_agent="{\"session_id\":\"$codex_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"model\":\"gpt-5.6-sol\",\"reasoning_effort\":\"high\",\"message\":\"- phase: adaptive-goal-runner\"}}"
expect_denied 'mismatched Codex spawn route' "$wrong_codex_agent"
codex_agent_input="{\"model\":\"gpt-5.6-luna\",\"reasoning_effort\":\"medium\",\"message\":\"- phase: adaptive-goal-runner\"}"
codex_agent_pre="{\"session_id\":\"$codex_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":$codex_agent_input}"
run_hook "$codex_agent_pre" >/dev/null
codex_agent_post="{\"session_id\":\"$codex_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Agent\",\"tool_input\":$codex_agent_input,\"tool_response\":{\"agent_id\":\"codexagent\"}}"
run_hook "$codex_agent_post" >/dev/null
grep -F $'route_verified\ttrue' "$codex_ledger/state" >/dev/null ||
  fail 'Codex hook did not record verified route'
grep -F $'enforcement\thelper+codex-hooks' "$codex_ledger/state" >/dev/null ||
  fail 'Codex hook did not disclose enforcement tier'
report=$(bash "$goal_loop" step report --ledger "$codex_ledger" \
  --status complete --human-interruptions 0)
grep -F 'enforcement: helper+codex-hooks' <<EOF >/dev/null ||
  fail 'Codex hook tier is missing from report'
$report
EOF
expect_denied 'altered canonical report' \
  "{\"session_id\":\"$codex_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"format: darrow-native-goal-report-v1\\naltered\"}"
run_hook "{\"session_id\":\"$codex_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"$report\"}" >/dev/null

printf '%s\n' 'ok - shared goal-loop lifecycle hook'
