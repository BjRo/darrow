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
  run_hook "{\"session_id\":\"$bind_session_id\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Skill\",\"tool_input\":{\"skill\":\"adaptive-goal\"},\"tool_response\":\"loaded\"}" >/dev/null
  expect_denied 'pre-ledger adaptive-goal Bash discovery' \
    "{\"session_id\":\"$bind_session_id\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"find . -name goal-loop\"}}"
  start_command="/bin/bash $goal_loop step start --repo $repo --host $bind_host"
  run_hook "{\"session_id\":\"$bind_session_id\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$start_command\"}}" >/dev/null
  start_output=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
    --repo "$repo" --host "$bind_host")
  bound_ledger=$(record_value "$start_output" ledger)
  bind_context=$(run_hook "{\"session_id\":\"$bind_session_id\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$start_command\"},\"tool_response\":\"ok\"}")
  case "$bind_context" in
    *'goal-loop step prepare'*'Do not Write the contract yet'*) ;;
    *) fail 'ledger start omitted bounded next-transition guidance' ;;
  esac
  test "$(sed -n '1p' "$plugin_data/sessions/$bind_session_id")" = "$bound_ledger" ||
    fail "hook did not bind $bind_host session"
  test ! -e "$plugin_data/sessions/$bind_session_id.invoked" ||
    fail "hook did not clear the armed adaptive-goal invocation"
  printf '%s\n' "$bound_ledger"
}

test -x "$hook" || fail 'goal-loop hook is not executable'
test -r "$plugin_root/hooks/hooks.json" || fail 'plugin hook manifest is missing'
grep -F '"matcher": "Bash|Read|Glob|Grep|Write|Edit|Agent|apply_patch"' \
  "$plugin_root/hooks/hooks.json" >/dev/null ||
  fail 'PreToolUse hook does not cover post-owner repository inspection'
grep -F '"PostToolUseFailure": [' "$plugin_root/hooks/hooks.json" >/dev/null ||
  fail 'hook manifest does not reconcile failed Agent launches'

prompt_session=prompt-session
prompt_context=$(run_hook "{\"session_id\":\"$prompt_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"/adaptive-goal implement the request\"}")
case "$prompt_context" in
  *'"hookEventName":"UserPromptSubmit"'*'first protocol-bearing Bash call'*) ;;
  *) fail 'slash invocation omitted literal launch context' ;;
esac
expect_denied 'slash-invoked pre-ledger Bash discovery' \
  "{\"session_id\":\"$prompt_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"find . -name goal-loop\"}}"
rm -f "$plugin_data/sessions/$prompt_session.invoked"
negated_session=negated-session
run_hook "{\"session_id\":\"$negated_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"UserPromptSubmit\",\"prompt\":\"Do not run /adaptive-goal; document it only.\"}" >/dev/null
test ! -e "$plugin_data/sessions/$negated_session.invoked" ||
  fail 'negated adaptive-goal mention armed orchestration'
run_hook "{\"session_id\":\"$negated_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git status --short\"}}" >/dev/null

claude_session=claude-session
claude_ledger=$(bind_session "$claude_session" claude)
claude_staging=$(record_value "$(cat "$claude_ledger/state")" staging_dir)
bash "$goal_loop" step prepare --ledger "$claude_ledger" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step route --ledger $claude_ledger --workflow implement-feature --risk routine --profile routine --verification-gate routine --review omitted --route 'claude|anthropic|claude-sonnet-5|low'\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step route --ledger $claude_ledger --workflow implement-feature --risk routine --profile routine --verification-gate routine --review selected --review-round-limit 2 --route 'claude|anthropic|claude-sonnet-5|low'\"}}" >/dev/null
expect_denied 'route helper for another ledger' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step route --ledger $tmp_root/darrow-goal-run.foreign --workflow implement-feature --risk routine --profile routine --verification-gate routine --review omitted\"}}"
bash "$goal_loop" step route --ledger "$claude_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --review omitted >/dev/null
expect_denied 'launch-stop helper for another ledger' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step launch-stop --ledger $tmp_root/darrow-goal-run.foreign --reason launch-unavailable\"}}"
runner_command="/bin/bash $goal_loop step runner --ledger $claude_ledger --provider anthropic --model claude-sonnet-5 --effort low"
bash "$goal_loop" step runner --ledger "$claude_ledger" --provider anthropic \
  --model claude-sonnet-5 --effort low >/dev/null
runner_context=$(run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$runner_command\"},\"tool_response\":\"ok\"}")
case "$runner_context" in
  *'next tool is the one native Write'*'beginning with Outcome:'*) ;;
  *) fail 'runner resolution omitted contract-write guidance' ;;
esac
expect_denied 'out-of-phase helper inspection' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step inspect --ledger $claude_ledger\"}}"

expect_denied 'Claude pre-owner shell command' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git status\"}}"
expect_denied 'compound helper shell command' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash $goal_loop step prepare --ledger $claude_ledger; touch $repo/escaped\"}}"
expect_denied 'non-literal helper shell executable' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash $goal_loop step prepare --ledger $claude_ledger\"}}"
expect_denied 'direct ledger write' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_ledger/state\",\"content\":\"tamper\"}}"
expect_denied 'early Claude Agent' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"task\":\"- phase: adaptive-goal-runner\"}}"

claude_goal="$claude_staging/claude-goal.md"
expect_denied 'canonicalized staging traversal' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_staging/../escaped\",\"content\":\"escape\"}}"
expect_denied 'hand-authored Claude objective wrapper' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_goal\",\"content\":\"Outcome: wrapper\\nExpected SHA-256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}}"
write_json="{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_goal\",\"content\":\"Outcome: hook test\"}}"
run_hook "$write_json" >/dev/null
printf '%s\n' 'Outcome: hook test' >"$claude_goal"
post_write_json="{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$claude_goal\",\"content\":\"Outcome: hook test\"},\"tool_response\":\"ok\"}"
write_context=$(run_hook "$post_write_json")
case "$write_context" in
  *'staging Write is complete'*'goal-loop step stage'*) ;;
  *) fail 'staging Write omitted next-transition guidance' ;;
esac
expect_denied 'second Claude staging Write' "$write_json"
claude_digest=$(shasum -a 256 "$claude_goal")
claude_digest=${claude_digest%% *}
bash "$goal_loop" step stage --ledger "$claude_ledger" \
  --goal-file "$claude_goal" --expected-sha256 "$claude_digest" >/dev/null
claude_materialized=$(bash "$goal_loop" step materialize --ledger "$claude_ledger" \
  --goal-file "$claude_goal" --expected-sha256 "$claude_digest")
claude_attachment=$(record_value "$claude_materialized" attachment_dir)
bash "$goal_loop" step release-staging --ledger "$claude_ledger" \
  --goal-file "$claude_goal" --expected-sha256 "$claude_digest" >/dev/null
claude_objective=$(record_value "$claude_materialized" objective_file)
if CLAUDE_CONFIG_DIR="$tmp_root" bash "$script_dir/claude-route-gate" \
  --repo "$repo" --agent-id claudeagent \
  --selected 'claude|anthropic|claude-sonnet-5|low' \
  --ledger "$claude_ledger" >"$tmp_root/unactivated-route.out" 2>/dev/null; then
  fail 'Claude route gate backfilled missing pre-spawn activation'
fi
test ! -s "$tmp_root/unactivated-route.out" ||
  fail 'rejected unactivated route gate emitted evidence'
claude_activate_command="/bin/bash $goal_loop step activate --ledger $claude_ledger --applied-by native-subagent --boundary native_subagent --agent-id pending --effective-route 'claude|anthropic|claude-sonnet-5|low' --route-verified false --enforcement helper+claude-hooks"
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$claude_activate_command\"}}" >/dev/null
bash "$goal_loop" step activate --ledger "$claude_ledger" \
  --applied-by native-subagent --boundary native_subagent --agent-id pending \
  --effective-route 'claude|anthropic|claude-sonnet-5|low' \
  --route-verified false --enforcement helper+claude-hooks >/dev/null
activate_context=$(run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$claude_activate_command\"},\"tool_response\":\"ok\"}")
case "$activate_context" in
  *'Provisional activation is recorded'*'foreground Agent'*) ;;
  *) fail 'provisional activation omitted Agent guidance' ;;
esac
claude_agent_json="{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"prompt\":\"- phase: adaptive-goal-runner\\n- objective_file: $claude_objective\"}}"
printf '%s\n' "$claude_agent_json" >"$tmp_root/agent-race-one.json"
printf '%s\n' "$claude_agent_json" >"$tmp_root/agent-race-two.json"
TMPDIR="$tmp_root" CLAUDE_PLUGIN_ROOT="$plugin_root" \
  CLAUDE_PLUGIN_DATA="$plugin_data" PLUGIN_ROOT="$plugin_root" \
  PLUGIN_DATA="$plugin_data" bash "$hook" <"$tmp_root/agent-race-one.json" \
  >"$tmp_root/agent-race-one.out" 2>"$tmp_root/agent-race-one.err" &
agent_race_one_pid=$!
TMPDIR="$tmp_root" CLAUDE_PLUGIN_ROOT="$plugin_root" \
  CLAUDE_PLUGIN_DATA="$plugin_data" PLUGIN_ROOT="$plugin_root" \
  PLUGIN_DATA="$plugin_data" bash "$hook" <"$tmp_root/agent-race-two.json" \
  >"$tmp_root/agent-race-two.out" 2>"$tmp_root/agent-race-two.err" &
agent_race_two_pid=$!
agent_race_one_status=0
agent_race_two_status=0
wait "$agent_race_one_pid" || agent_race_one_status=$?
wait "$agent_race_two_pid" || agent_race_two_status=$?
case "$agent_race_one_status|$agent_race_two_status" in
  0\|2|2\|0) ;;
  *) fail 'concurrent Claude Agent calls did not acquire exactly one reservation' ;;
esac
test -f "$plugin_data/sessions/$claude_session.spawn-claim" ||
  fail 'Claude Agent launch did not retain a persistent owner reservation'
delegated_fields="\"agent_id\":\"owner123\",\"agent_type\":\"adaptive-goal-sonnet-5-low\""
run_hook "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$claude_objective\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Grep\",\"tool_input\":{\"pattern\":\"sameSite\",\"path\":\"$repo\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"bash test.sh\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$repo/owner.txt\",\"content\":\"owner\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"apply_patch\",\"tool_input\":{\"patch\":\"*** Begin Patch\\n*** End Patch\"}}" >/dev/null
expect_denied 'unrelated Claude descendant Read' \
  "{\"session_id\":\"$claude_session\",\"agent_id\":\"other123\",\"agent_type\":\"Explore\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$claude_objective\"}}"
expect_denied 'delegated owner protocol-state Read' \
  "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$claude_ledger/state\"}}"
expect_denied 'delegated owner write outside repository' \
  "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$tmp_root/outside.txt\",\"content\":\"outside\"}}"
grep -F $'agent_id\tpending' "$claude_ledger/state" >/dev/null ||
  fail 'Claude hook did not record provisional activation'
expect_denied 'second pending Claude Agent' "$claude_agent_json"
expect_denied 'Claude Agent task with appended text' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"prompt\":\"- phase: adaptive-goal-runner\\n- objective_file: $claude_objective\\nextra\"}}"
post_agent_context=$(run_hook "${claude_agent_json/PreToolUse/PostToolUse}")
case "$post_agent_context" in
  *'"hookEventName":"PostToolUse"'*'claude-route-gate'*'Do not call Read, Glob, Grep'*) ;;
  *) fail 'Claude Agent completion omitted route-gate context' ;;
esac
test -f "$plugin_data/sessions/$claude_session.spawn-claim" ||
  fail 'Agent completion discarded the persistent owner reservation'
expect_denied 'delegated owner tool after owner return' \
  "{\"session_id\":\"$claude_session\",$delegated_fields,\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$repo/base.txt\"}}"
expect_denied 'Claude parent Read after owner return' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Read\",\"tool_input\":{\"file_path\":\"$repo/auth-config.js\"}}"
expect_denied 'Claude parent Bash after owner return' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"touch $repo/escaped\"}}"
expect_denied 'Claude parent Write after owner return' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$repo/escaped\",\"content\":\"escaped\"}}"
expect_denied 'Claude parent patch after owner return' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"apply_patch\",\"tool_input\":{\"patch\":\"*** Begin Patch\\n*** End Patch\"}}"
expect_denied 'second Claude Agent' "$claude_agent_json"
expect_denied 'review helper for another ledger' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step review --ledger $tmp_root/darrow-goal-run.foreign --mode comprehensive --target-sha256 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --outcome clear\"}}"
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step review --ledger $claude_ledger --mode comprehensive --target-fingerprint 'WORKTREE@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa+bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' --outcome clear\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $script_dir/claude-route-gate --repo $repo --agent-id claudeagent --selected 'claude|anthropic|claude-sonnet-5|low' --ledger $claude_ledger\"}}" >/dev/null
expect_denied 'review helper shell variable' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step review --ledger $claude_ledger --mode comprehensive --target-sha256 \$review_target --outcome clear\"}}"
expect_denied 'Claude turn end before helper report' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"unfinished\"}"
bash "$goal_loop" step observe-route --ledger "$claude_ledger" \
  --agent-id claudeagent --effective-route 'claude|anthropic|unknown|unknown' \
  --confirmation unavailable --enforcement helper+claude-hooks >/dev/null
bash "$goal_loop" step release-objective --ledger "$claude_ledger" \
  --attachment-dir "$claude_attachment" --expected-sha256 "$claude_digest" >/dev/null
expect_denied 'Claude unavailable route reported as blocked' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"/bin/bash $goal_loop step report --ledger $claude_ledger --status blocked --human-interruptions 0\"}}"
claude_report_command="/bin/bash $goal_loop step report --ledger $claude_ledger --status launch-required --human-interruptions 0"
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$claude_report_command\"}}" >/dev/null
claude_report=$(bash "$goal_loop" step report --ledger "$claude_ledger" \
  --status launch-required --human-interruptions 0)
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"$claude_report\"}" >/dev/null
test ! -e "$plugin_data/sessions/$claude_session" &&
  test ! -e "$plugin_data/sessions/$claude_session.spawn-seen" &&
  test ! -e "$plugin_data/sessions/$claude_session.spawn-claim" ||
  fail 'terminal Stop retained Claude session state'
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"git status --short\"}}" >/dev/null
second_claude_ledger=$(bind_session "$claude_session" claude)
test "$second_claude_ledger" != "$claude_ledger" ||
  fail 'second explicit goal reused the prior ledger'
same_staging=$(record_value "$(cat "$second_claude_ledger/state")" staging_dir)
bash "$goal_loop" step prepare --ledger "$second_claude_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$second_claude_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --review omitted >/dev/null
bash "$goal_loop" step runner --ledger "$second_claude_ledger" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null
same_goal="$same_staging/same-thread-goal.md"
printf '%s\n' 'Outcome: exercise same-thread ownership' >"$same_goal"
same_digest=$(shasum -a 256 "$same_goal")
same_digest=${same_digest%% *}
bash "$goal_loop" step stage --ledger "$second_claude_ledger" \
  --goal-file "$same_goal" >/dev/null
same_materialized=$(bash "$goal_loop" step materialize \
  --ledger "$second_claude_ledger" --goal-file "$same_goal" \
  --expected-sha256 "$same_digest")
same_attachment=$(record_value "$same_materialized" attachment_dir)
bash "$goal_loop" step release-staging --ledger "$second_claude_ledger" \
  --goal-file "$same_goal" --expected-sha256 "$same_digest" >/dev/null
same_activate_command="/bin/bash $goal_loop step activate --ledger $second_claude_ledger --applied-by current-thread --boundary same_thread --agent-id none --effective-route 'claude|anthropic|claude-sonnet-5|low' --route-verified true"
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$same_activate_command\"}}" >/dev/null
bash "$goal_loop" step activate --ledger "$second_claude_ledger" \
  --applied-by current-thread --boundary same_thread --agent-id none \
  --effective-route 'claude|anthropic|claude-sonnet-5|low' \
  --route-verified true >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"printf same-thread-owner\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$repo/same-thread.txt\",\"content\":\"owner work\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"apply_patch\",\"tool_input\":{\"patch\":\"*** Begin Patch\\n*** End Patch\"}}" >/dev/null
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"- phase: human-feedback-request\\nChoose the exact owner option.\"}" >/dev/null
bash "$goal_loop" step release-objective --ledger "$second_claude_ledger" \
  --attachment-dir "$same_attachment" --expected-sha256 "$same_digest" >/dev/null
expect_denied 'same-thread mutation after objective release' \
  "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"touch $repo/terminal-escape\"}}"
same_report=$(bash "$goal_loop" step report --ledger "$second_claude_ledger" \
  --status complete --human-interruptions 1)
run_hook "{\"session_id\":\"$claude_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"Stop\",\"stop_hook_active\":false,\"last_assistant_message\":\"$same_report\"}" >/dev/null

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

failure_session=failure-session
failure_ledger=$(bind_session "$failure_session" claude)
failure_staging=$(record_value "$(cat "$failure_ledger/state")" staging_dir)
bash "$goal_loop" step prepare --ledger "$failure_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$failure_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --review omitted >/dev/null
bash "$goal_loop" step runner --ledger "$failure_ledger" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null
failure_goal="$failure_staging/failure-goal.md"
printf '%s\n' 'Outcome: reconcile a failed owner launch' >"$failure_goal"
failure_digest=$(shasum -a 256 "$failure_goal")
failure_digest=${failure_digest%% *}
bash "$goal_loop" step stage --ledger "$failure_ledger" \
  --goal-file "$failure_goal" >/dev/null
failure_materialized=$(bash "$goal_loop" step materialize --ledger "$failure_ledger" \
  --goal-file "$failure_goal" --expected-sha256 "$failure_digest")
bash "$goal_loop" step release-staging --ledger "$failure_ledger" \
  --goal-file "$failure_goal" --expected-sha256 "$failure_digest" >/dev/null
failure_objective=$(record_value "$failure_materialized" objective_file)
bash "$goal_loop" step activate --ledger "$failure_ledger" \
  --applied-by native-subagent --boundary native_subagent --agent-id pending \
  --effective-route 'claude|anthropic|claude-sonnet-5|low' \
  --route-verified false --enforcement helper+claude-hooks >/dev/null
failure_agent_json="{\"session_id\":\"$failure_session\",\"cwd\":\"$repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Agent\",\"tool_input\":{\"subagent_type\":\"darrow-goal-loop:adaptive-goal-sonnet-5-low\",\"run_in_background\":false,\"prompt\":\"- phase: adaptive-goal-runner\\n- objective_file: $failure_objective\"}}"
run_hook "$failure_agent_json" >/dev/null
failure_context=$(run_hook "${failure_agent_json/PreToolUse/PostToolUseFailure}")
case "$failure_context" in
  *'reconciled as launch-unavailable'*'Do not retry'*) ;;
  *) fail 'failed Agent omitted zero-child reconciliation guidance' ;;
esac
grep -F $'phase\tlaunch-unavailable' "$failure_ledger/state" >/dev/null ||
  fail 'failed Agent did not terminalize the provisional ledger'
grep -F $'agent_id\tnone' "$failure_ledger/state" >/dev/null ||
  fail 'failed Agent retained its pending id'
grep -F $'child_invocations\t0' "$failure_ledger/state" >/dev/null ||
  fail 'failed Agent retained a child invocation'
test ! -e "$plugin_data/sessions/$failure_session.spawn-pending" ||
  fail 'failed Agent retained its launch reservation'

spaced_plugin="$tmp_root/plugin root"
spaced_repo="$tmp_root/repo with space"
spaced_data="$tmp_root/plugin data"
spaced_temp="$tmp_root/temp root"
cp -R "$plugin_root" "$spaced_plugin"
mkdir -p "$spaced_repo" "$spaced_data" "$spaced_temp"
git -C "$spaced_repo" init -q
git -C "$spaced_repo" config user.email test@example.com
git -C "$spaced_repo" config user.name Test
printf 'base\n' >"$spaced_repo/base.txt"
git -C "$spaced_repo" add base.txt
git -C "$spaced_repo" commit -qm base
spaced_hook="$spaced_plugin/bin/goal-loop-hook"
spaced_goal_loop="$spaced_plugin/bin/goal-loop"
run_spaced_hook() {
  spaced_json=$1
  printf '%s\n' "$spaced_json" >"$tmp_root/spaced-hook-input.json"
  TMPDIR="$spaced_temp" CLAUDE_PLUGIN_ROOT="$spaced_plugin" \
    CLAUDE_PLUGIN_DATA="$spaced_data" PLUGIN_ROOT="$spaced_plugin" \
    PLUGIN_DATA="$spaced_data" bash "$spaced_hook" \
    <"$tmp_root/spaced-hook-input.json"
}
spaced_session=spaced-session
run_spaced_hook "{\"session_id\":\"$spaced_session\",\"cwd\":\"$spaced_repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Skill\",\"tool_input\":{\"skill\":\"adaptive-goal\"},\"tool_response\":\"loaded\"}" >/dev/null
spaced_start_command="/bin/bash '$spaced_goal_loop' step start --repo '$spaced_repo' --host claude"
run_spaced_hook "{\"session_id\":\"$spaced_session\",\"cwd\":\"$spaced_repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$spaced_start_command\"}}" >/dev/null
spaced_start=$(TMPDIR="$spaced_temp" bash "$spaced_goal_loop" step start \
  --repo "$spaced_repo" --host claude)
spaced_ledger=$(record_value "$spaced_start" ledger)
run_spaced_hook "{\"session_id\":\"$spaced_session\",\"cwd\":\"$spaced_repo\",\"hook_event_name\":\"PostToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$spaced_start_command\"},\"tool_response\":\"ok\"}" >/dev/null
spaced_prepare_command="/bin/bash '$spaced_goal_loop' step prepare --ledger '$spaced_ledger'"
run_spaced_hook "{\"session_id\":\"$spaced_session\",\"cwd\":\"$spaced_repo\",\"hook_event_name\":\"PreToolUse\",\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"$spaced_prepare_command\"}}" >/dev/null

printf '%s\n' 'ok - shared goal-loop lifecycle hook'
