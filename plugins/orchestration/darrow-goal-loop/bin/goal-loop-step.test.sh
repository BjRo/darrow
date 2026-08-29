#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
goal_loop="$script_dir/goal-loop"
tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-goal-step-test.XXXXXX")
tmp_root=$(CDPATH='' cd -- "$tmp_root" && pwd -P)
trap 'rm -rf "$tmp_root"' EXIT
repo="$tmp_root/repo"
mkdir -p "$repo"
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

expect_refusal() {
  label=$1
  shift
  if "$@" >"$tmp_root/refusal.out" 2>"$tmp_root/refusal.err"; then
    fail "$label"
  fi
  test ! -s "$tmp_root/refusal.out" || fail "$label wrote stdout"
  grep -F 'goal-loop:' "$tmp_root/refusal.err" >/dev/null ||
    fail "$label omitted helper refusal"
}

capability_routing_clause='Capability routing: For each exact contract operation with a host-advertised matching capability, invoke and follow that capability before the operation; direct commands are not a substitute, and inability or refusal stops that operation without expanding authority.'

write_goal_contract() {
  contract_file=$1
  contract_outcome=$2
  printf 'Outcome: %s\nWorkflow sequence: %s\n' \
    "$contract_outcome" "$capability_routing_clause" >"$contract_file"
}

activate_codex_review_ledger() {
  fixture_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
    --repo "$repo" --host codex)
  fixture_ledger=$(record_value "$fixture_start" ledger)
  fixture_staging=$(record_value "$fixture_start" staging_dir)
  bash "$goal_loop" step prepare --ledger "$fixture_ledger" >/dev/null
  fixture_route_out=$(bash "$goal_loop" step route --ledger "$fixture_ledger" \
    --workflow implement-feature --risk routine --profile routine \
    --verification-gate routine --readiness omitted --review selected "$@")
  fixture_route=$(record_value "$fixture_route_out" selected_route)
  fixture_goal="$fixture_staging/goal.md"
  write_goal_contract "$fixture_goal" 'exercise review transitions'
  fixture_digest=$(shasum -a 256 "$fixture_goal")
  fixture_digest=${fixture_digest%% *}
  bash "$goal_loop" step stage --ledger "$fixture_ledger" \
    --goal-file "$fixture_goal" >/dev/null
  bash "$goal_loop" step materialize --ledger "$fixture_ledger" \
    --goal-file "$fixture_goal" --expected-sha256 "$fixture_digest" >/dev/null
  bash "$goal_loop" step release-staging --ledger "$fixture_ledger" \
    --goal-file "$fixture_goal" --expected-sha256 "$fixture_digest" >/dev/null
  bash "$goal_loop" step activate --ledger "$fixture_ledger" \
    --applied-by host-api --boundary host_api --agent-id none \
    --effective-route "$fixture_route" --route-verified true >/dev/null
}

stage_codex_native_ledger() {
  codex_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
    --repo "$repo" --host codex)
  codex_ledger=$(record_value "$codex_start" ledger)
  codex_staging=$(record_value "$codex_start" staging_dir)
  bash "$goal_loop" step prepare --ledger "$codex_ledger" >/dev/null
  codex_route_out=$(bash "$goal_loop" step route --ledger "$codex_ledger" \
    --workflow fix-bug --risk routine --profile routine \
    --verification-gate routine --readiness omitted --review omitted)
  codex_route=$(record_value "$codex_route_out" selected_route)
  codex_goal="$codex_staging/goal.md"
  write_goal_contract "$codex_goal" 'exercise Codex native owner identity'
  codex_digest=$(shasum -a 256 "$codex_goal")
  codex_digest=${codex_digest%% *}
  bash "$goal_loop" step stage --ledger "$codex_ledger" \
    --goal-file "$codex_goal" >/dev/null
  bash "$goal_loop" step materialize --ledger "$codex_ledger" \
    --goal-file "$codex_goal" --expected-sha256 "$codex_digest" >/dev/null
  bash "$goal_loop" step release-staging --ledger "$codex_ledger" \
    --goal-file "$codex_goal" --expected-sha256 "$codex_digest" >/dev/null
}

signal_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
signal_ledger=$(record_value "$signal_start" ledger)
awk 'BEGIN { for (i = 1; i <= 2000; i++) print "padding" i "\tvalue" }' \
  >>"$signal_ledger/state"
signal_state_before=$(shasum -a 256 "$signal_ledger/state")
signal_events_before=$(shasum -a 256 "$signal_ledger/events")
bash "$goal_loop" step prepare --ledger "$signal_ledger" \
  >"$tmp_root/signal.out" 2>"$tmp_root/signal.err" &
signal_pid=$!
while test ! -f "$signal_ledger/.transition-state" ||
  test ! -f "$signal_ledger/.transition-events" ||
  test ! -f "$signal_ledger/.transition-targets"; do
  kill -0 "$signal_pid" 2>/dev/null || fail 'signal probe exited before snapshotting'
done
kill -STOP "$signal_pid"
kill -TERM "$signal_pid"
kill -CONT "$signal_pid"
signal_status=0
wait "$signal_pid" || signal_status=$?
test "$signal_status" -eq 143 || fail 'TERM did not terminate the locked step'
test ! -e "$signal_ledger/.lock" &&
  test ! -e "$signal_ledger/.transition-state" &&
  test ! -e "$signal_ledger/.transition-events" &&
  test ! -e "$signal_ledger/.transition-targets" ||
  fail 'interrupted ledger left lock or transition state'
test "$(shasum -a 256 "$signal_ledger/state")" = "$signal_state_before" ||
  fail 'interrupted ledger did not restore state'
test "$(shasum -a 256 "$signal_ledger/events")" = "$signal_events_before" ||
  fail 'interrupted ledger did not restore events'
bash "$goal_loop" step prepare --ledger "$signal_ledger" >/dev/null

stage_codex_native_ledger
expect_refusal 'Codex native owner rejects legacy agent id' bash "$goal_loop" \
  step activate --ledger "$codex_ledger" --applied-by native-subagent \
  --boundary native_subagent --agent-id adaptive_goal_runner \
  --effective-route "$codex_route" --route-verified true
for unsafe_ref in \
  '/root/' \
  '/root//adaptive_goal_runner' \
  '/root/../adaptive_goal_runner' \
  '/other/adaptive_goal_runner' \
  '/root/adaptive-goal-runner' \
  '/root/adaptive goal_runner' \
  $'/root/adaptive\tgoal_runner' \
  $'/root/adaptive\ngoal_runner' \
  '/root/adaptive_goal_runner;bad'; do
  expect_refusal "unsafe Codex agent reference $unsafe_ref" bash "$goal_loop" \
    step activate --ledger "$codex_ledger" --applied-by native-subagent \
    --boundary native_subagent --agent-ref "$unsafe_ref" \
    --effective-route "$codex_route" --route-verified true
done
codex_activate=$(bash "$goal_loop" step activate --ledger "$codex_ledger" \
  --applied-by native-subagent --boundary native_subagent \
  --agent-ref /root/parent/adaptive_goal_runner \
  --effective-route "$codex_route" --route-verified true)
test "$(record_value "$codex_activate" agent_ref)" = \
  /root/parent/adaptive_goal_runner || fail 'canonical Codex agent reference'
grep -F $'agent_ref\t/root/parent/adaptive_goal_runner' \
  "$codex_ledger/state" >/dev/null || fail 'Codex agent reference ledger binding'
grep -F $'phase\tgoal-pending' "$codex_ledger/state" >/dev/null ||
  fail 'Codex native runner did not enter goal-pending state'
expect_refusal 'Codex completion before native goal persistence' bash "$goal_loop" \
  step report --ledger "$codex_ledger" --status complete --human-interruptions 0
codex_goal_state=$(bash "$goal_loop" step goal-state --ledger "$codex_ledger" \
  --status active)
test "$(record_value "$codex_goal_state" goal_state)" = active ||
  fail 'Codex native goal active evidence'
grep -F $'phase\tactive' "$codex_ledger/state" >/dev/null ||
  fail 'Codex native goal persistence did not unlock active work'
expect_refusal 'duplicate Codex native goal persistence' bash "$goal_loop" \
  step goal-state --ledger "$codex_ledger" --status active
codex_report=$(bash "$goal_loop" step report --ledger "$codex_ledger" \
  --status complete --human-interruptions 0)
grep -F 'evaluation_child_invocations: 1' <<<"$codex_report" >/dev/null ||
  fail 'canonical Codex owner did not count one child'
grep -F 'Native goal persistence: confirmed.' <<<"$codex_report" >/dev/null ||
  fail 'canonical Codex owner did not report native goal persistence'

stage_codex_native_ledger
bash "$goal_loop" step activate --ledger "$codex_ledger" \
  --applied-by native-subagent --boundary native_subagent \
  --agent-ref /root/adaptive_goal_runner \
  --effective-route "$codex_route" --route-verified true >/dev/null
codex_goal_unavailable=$(bash "$goal_loop" step goal-state \
  --ledger "$codex_ledger" --status unavailable)
test "$(record_value "$codex_goal_unavailable" goal_state)" = unavailable ||
  fail 'Codex native goal unavailable evidence'
codex_goal_unavailable_report=$(bash "$goal_loop" step report \
  --ledger "$codex_ledger" --status launch-required --human-interruptions 0)
grep -F 'model: none > none' <<<"$codex_goal_unavailable_report" >/dev/null ||
  fail 'unavailable Codex native goal persistence retained an applied route'
grep -F 'route_applied_by: none' <<<"$codex_goal_unavailable_report" >/dev/null ||
  fail 'unavailable Codex native goal persistence retained an applied route'
grep -F 'route_verified: false' <<<"$codex_goal_unavailable_report" >/dev/null ||
  fail 'unavailable Codex native goal persistence retained an applied route'
grep -F 'launch_boundary: launch_required' <<<"$codex_goal_unavailable_report" >/dev/null ||
  fail 'unavailable Codex native goal persistence retained an applied route'
grep -F 'Native goal persistence: unavailable.' <<<"$codex_goal_unavailable_report" >/dev/null ||
  fail 'unavailable Codex native goal persistence was not reported'
grep -F 'evaluation_child_invocations: 1' <<<"$codex_goal_unavailable_report" >/dev/null ||
  fail 'unavailable Codex native goal persistence lost its child invocation'

stage_codex_native_ledger
codex_failed_stop=$(bash "$goal_loop" step launch-stop \
  --ledger "$codex_ledger" --reason launch-unavailable \
  --agent-ref /root/adaptive_goal_runner)
test "$(record_value "$codex_failed_stop" agent_ref)" = \
  /root/adaptive_goal_runner || fail 'failed accepted Codex owner reference'
grep -F $'child_invocations\t1' "$codex_ledger/state" >/dev/null ||
  fail 'failed accepted Codex owner lost its child invocation'
codex_failed_report=$(bash "$goal_loop" step report --ledger "$codex_ledger" \
  --status launch-required --human-interruptions 0)
grep -F 'evaluation_child_invocations: 1' <<<"$codex_failed_report" >/dev/null ||
  fail 'failed accepted Codex owner report lost its child invocation'

start_out=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host claude)
test "$(record_value "$start_out" format)" = darrow-goal-step-v1 ||
  fail 'step start format'
test "$(record_value "$start_out" step)" = start || fail 'step start name'
ledger=$(record_value "$start_out" ledger)
staging_dir=$(record_value "$start_out" staging_dir)
run_id=$(record_value "$start_out" run_id)
test -n "$run_id" || fail 'step start run id'
expect_refusal 'legacy hook binding action' bash "$goal_loop" step hook-bind \
  --ledger "$ledger" --session-id legacy \
  --enforcement helper+claude-hooks
test -d "$ledger" && test ! -L "$ledger" || fail 'private ledger directory'
case "$ledger" in
  "$tmp_root"/darrow-goal-run.*) ;;
  *) fail 'ledger is outside TMPDIR' ;;
esac

expect_refusal 'route before prepare' bash "$goal_loop" step route \
  --ledger "$ledger" --workflow implement-feature --risk routine \
  --profile routine --verification-gate routine --readiness omitted --review selected

prepare_out=$(bash "$goal_loop" step prepare --ledger "$ledger")
test "$(record_value "$prepare_out" step)" = prepare || fail 'prepare step'
grep -F $'route\troutine\tclaude\tanthropic' <<EOF >/dev/null ||
$prepare_out
EOF
  fail 'prepare route evidence'
expect_refusal 'duplicate prepare' bash "$goal_loop" step prepare --ledger "$ledger"

rules_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
rules_ledger=$(record_value "$rules_start" ledger)
bash "$goal_loop" step prepare --ledger "$rules_ledger" >/dev/null
expect_refusal 'high risk omitted review' bash "$goal_loop" step route \
  --ledger "$rules_ledger" --workflow implement-feature --risk high \
  --profile routine --verification-gate high --readiness omitted --review omitted
expect_refusal 'mismatched verification gate' bash "$goal_loop" step route \
  --ledger "$rules_ledger" --workflow implement-feature --risk elevated \
  --profile routine --verification-gate routine --readiness omitted --review selected
expect_refusal 'noncanonical decision route' bash "$goal_loop" step route \
  --ledger "$rules_ledger" --workflow decision-gated --risk routine \
  --profile none --verification-gate not-applicable --readiness omitted --review omitted

expect_refusal 'foreign explicit route' bash "$goal_loop" step route \
  --ledger "$ledger" --workflow implement-feature --risk routine \
  --profile routine --verification-gate routine --readiness omitted --review selected \
  --route 'claude|anthropic|claude-invented-9|low'

route_out=$(bash "$goal_loop" step route --ledger "$ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --readiness omitted --review selected)
test "$(record_value "$route_out" step)" = route || fail 'route step'
selected_route=$(record_value "$route_out" selected_route)
test "$selected_route" = 'claude|anthropic|claude-sonnet-5|low' ||
  fail 'selected route record'
expect_refusal 'duplicate route' bash "$goal_loop" step route \
  --ledger "$ledger" --workflow implement-feature --risk routine \
  --profile routine --verification-gate routine --readiness omitted --review selected

runner_out=$(bash "$goal_loop" step runner --ledger "$ledger" \
  --provider anthropic --model claude-sonnet-5 --effort low)
test "$(record_value "$runner_out" step)" = runner || fail 'runner step'
expect_refusal 'duplicate runner resolution' bash "$goal_loop" step runner \
  --ledger "$ledger" --provider anthropic --model claude-sonnet-5 --effort low

goal_file="$staging_dir/goal.md"
printf '%s\n' 'Outcome: implement ledger test' >"$goal_file"
expect_refusal 'stage without capability routing' bash "$goal_loop" step stage \
  --ledger "$ledger" --goal-file "$goal_file"
printf 'Outcome: implement ledger test\nPermissions: %s\n' \
  "$capability_routing_clause" >"$goal_file"
expect_refusal 'stage with capability routing outside workflow sequence' \
  bash "$goal_loop" step stage --ledger "$ledger" --goal-file "$goal_file"
printf 'Outcome: implement ledger test\nWorkflow sequence: %s %s\n' \
  "$capability_routing_clause" "$capability_routing_clause" >"$goal_file"
expect_refusal 'stage with duplicate capability routing' bash "$goal_loop" \
  step stage --ledger "$ledger" --goal-file "$goal_file"
write_goal_contract "$goal_file" 'implement ledger test'
goal_digest=$(shasum -a 256 "$goal_file")
goal_digest=${goal_digest%% *}
wrong_digest=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
expect_refusal 'stage with mismatched digest' bash "$goal_loop" step stage \
  --ledger "$ledger" --goal-file "$goal_file" \
  --expected-sha256 "$wrong_digest"
stage_out=$(bash "$goal_loop" step stage --ledger "$ledger" \
  --goal-file "$goal_file")
test "$(record_value "$stage_out" step)" = stage || fail 'staging step'
test "$(record_value "$stage_out" contract_sha256)" = "$goal_digest" ||
  fail 'staging digest'
expect_refusal 'duplicate staging' bash "$goal_loop" step stage \
  --ledger "$ledger" --goal-file "$goal_file" \
  --expected-sha256 "$goal_digest"

expect_refusal 'mismatched expected digest' bash "$goal_loop" step materialize \
  --ledger "$ledger" --goal-file "$goal_file" \
  --expected-sha256 "$wrong_digest"

materialized=$(bash "$goal_loop" step materialize --ledger "$ledger" \
  --goal-file "$goal_file" --expected-sha256 "$goal_digest")
test "$(record_value "$materialized" mode)" = file-backed ||
  fail 'Claude materialization is not file-backed'
test "$(record_value "$materialized" contract_sha256)" = "$goal_digest" ||
  fail 'materialized digest'
attachment_dir=$(record_value "$materialized" attachment_dir)
expect_refusal 'duplicate materialization' bash "$goal_loop" step materialize \
  --ledger "$ledger" --goal-file "$goal_file" \
  --expected-sha256 "$goal_digest"

release_out=$(bash "$goal_loop" step release-staging --ledger "$ledger" \
  --goal-file "$goal_file" --expected-sha256 "$goal_digest")
grep -F $'status\treleased' <<EOF >/dev/null || fail 'staging release'
$release_out
EOF
expect_refusal 'duplicate staging release' bash "$goal_loop" step release-staging \
  --ledger "$ledger" --goal-file "$goal_file" \
  --expected-sha256 "$goal_digest"

expect_refusal 'verification before comprehensive review' bash "$goal_loop" \
  step review --ledger "$ledger" --mode verify --target-sha256 "$goal_digest" \
  --outcome clear

expect_refusal 'Claude route cannot self-verify at activation' bash "$goal_loop" \
  step activate --ledger "$ledger" \
  --applied-by native-subagent --boundary native_subagent --agent-id agentone \
  --effective-route "$selected_route" --route-verified true
expect_refusal 'legacy hook enforcement option' bash "$goal_loop" \
  step activate --ledger "$ledger" \
  --applied-by native-subagent --boundary native_subagent --agent-id pending \
  --effective-route "$selected_route" --route-verified false \
  --enforcement helper+claude-hooks
activate_out=$(bash "$goal_loop" step activate --ledger "$ledger" \
  --applied-by native-subagent --boundary native_subagent --agent-id pending \
  --effective-route "$selected_route" --route-verified false)
test "$(record_value "$activate_out" agent_id)" = pending ||
  fail 'provisional activation agent id'
expect_refusal 'duplicate activation' bash "$goal_loop" step activate \
  --ledger "$ledger" --applied-by native-subagent \
  --boundary native_subagent --agent-id agenttwo \
  --effective-route "$selected_route" --route-verified true

review_fingerprint='WORKTREE@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa+bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
review_hash_output=$(printf '%s' "$review_fingerprint" | shasum -a 256)
review_target=${review_hash_output%% *}
review_out=$(bash "$goal_loop" step review --ledger "$ledger" \
  --mode comprehensive --target-fingerprint "$review_fingerprint" --outcome blocking \
  --finding 'Ledger report is missing')
test "$(record_value "$review_out" outcome)" = blocking ||
  fail 'comprehensive review outcome'
test "$(record_value "$review_out" target_sha256)" = "$review_target" ||
  fail 'review fingerprint digest'
bash "$goal_loop" step observe-route --ledger "$ledger" --agent-id agentone \
  --effective-route "$selected_route" --confirmation confirmed >/dev/null
test "$(record_value "$(cat "$ledger/state")" agent_id)" = agentone ||
  fail 'observed route did not bind the actual agent id'
expect_refusal 'second comprehensive review' bash "$goal_loop" step review \
  --ledger "$ledger" --mode comprehensive --target-sha256 "$goal_digest" \
  --outcome clear
expect_refusal 'repeated fingerprint verification' bash "$goal_loop" step review \
  --ledger "$ledger" --mode verify --target-sha256 "$review_target" \
  --outcome clear

fixed_target=cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
verify_out=$(bash "$goal_loop" step review --ledger "$ledger" --mode verify \
  --target-sha256 "$fixed_target" --outcome clear)
test "$(record_value "$verify_out" outcome)" = clear ||
  fail 'fix verification outcome'

objective_release=$(bash "$goal_loop" step release-objective --ledger "$ledger" \
  --attachment-dir "$attachment_dir" --expected-sha256 "$goal_digest")
grep -F $'status\treleased' <<EOF >/dev/null || fail 'objective release'
$objective_release
EOF

report=$(bash "$goal_loop" step report --ledger "$ledger" \
  --status complete --human-interruptions 0)
expected_report=$(cat <<'EOF'
format: darrow-native-goal-report-v1
workflow: implement-feature
risk: routine
profile: routine
harness: claude
model: anthropic > claude-sonnet-5
effort: low
route_applied_by: native-subagent
route_verified: true
launch_boundary: native_subagent
verification_gate: routine
evaluation_child_invocations: 1
evaluation_human_interruptions: 0
enforcement: helper
Initial independent review: blocking — Ledger report is missing
Fix verification: clear.
Native goal completed.
EOF
)
test "$report" = "$expected_report" || fail 'helper-rendered terminal report'
expect_refusal 'duplicate terminal report' bash "$goal_loop" step report \
  --ledger "$ledger" --status complete --human-interruptions 0

for terminal_outcome in clear unavailable inconclusive; do
  activate_codex_review_ledger
  bash "$goal_loop" step review --ledger "$fixture_ledger" \
    --mode comprehensive --target-sha256 "$review_target" \
    --outcome "$terminal_outcome" >/dev/null
  expect_refusal "verification after comprehensive $terminal_outcome" \
    bash "$goal_loop" step review --ledger "$fixture_ledger" --mode verify \
    --target-sha256 "$fixed_target" --outcome clear
done

for terminal_outcome in clear no_progress blocked unavailable inconclusive; do
  activate_codex_review_ledger
  bash "$goal_loop" step review --ledger "$fixture_ledger" \
    --mode comprehensive --target-sha256 "$review_target" \
    --outcome blocking --finding original >/dev/null
  if test "$terminal_outcome" = no_progress || test "$terminal_outcome" = blocked; then
    bash "$goal_loop" step review --ledger "$fixture_ledger" --mode verify \
      --target-sha256 "$fixed_target" --outcome "$terminal_outcome" \
      --finding terminal >/dev/null
  else
    bash "$goal_loop" step review --ledger "$fixture_ledger" --mode verify \
      --target-sha256 "$fixed_target" --outcome "$terminal_outcome" >/dev/null
  fi
  expect_refusal "verification after fix-verification $terminal_outcome" \
    bash "$goal_loop" step review --ledger "$fixture_ledger" --mode verify \
    --target-sha256 "$wrong_digest" --outcome clear
done

activate_codex_review_ledger --review-round-limit 1
bash "$goal_loop" step review --ledger "$fixture_ledger" \
  --mode comprehensive --target-sha256 "$review_target" \
  --outcome blocking --finding original >/dev/null
expect_refusal 'explicit review limit blocks another invocation' bash "$goal_loop" \
  step review --ledger "$fixture_ledger" --mode verify \
  --target-sha256 "$fixed_target" --outcome clear
bash "$goal_loop" step block --ledger "$fixture_ledger" \
  --kind review --operation independent-review --retry evidence-change \
  --waiver forbidden --evidence-sha256 "$review_target" >/dev/null
limit_report=$(bash "$goal_loop" step report --ledger "$fixture_ledger" \
  --status blocked --human-interruptions 0)
grep -F 'Review gate: blocked — explicit limit reached.' <<EOF >/dev/null || fail 'explicit review limit report'
$limit_report
EOF

unavailable_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host claude)
unavailable_ledger=$(record_value "$unavailable_start" ledger)
unavailable_staging=$(record_value "$unavailable_start" staging_dir)
bash "$goal_loop" step prepare --ledger "$unavailable_ledger" >/dev/null
unavailable_route_out=$(bash "$goal_loop" step route --ledger "$unavailable_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --readiness omitted --review omitted)
unavailable_route=$(record_value "$unavailable_route_out" selected_route)
bash "$goal_loop" step runner --ledger "$unavailable_ledger" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null
unavailable_goal="$unavailable_staging/unavailable-goal.md"
write_goal_contract "$unavailable_goal" 'preserve unavailable route evidence'
unavailable_digest=$(shasum -a 256 "$unavailable_goal")
unavailable_digest=${unavailable_digest%% *}
bash "$goal_loop" step stage --ledger "$unavailable_ledger" \
  --goal-file "$unavailable_goal" >/dev/null
unavailable_materialized=$(bash "$goal_loop" step materialize \
  --ledger "$unavailable_ledger" --goal-file "$unavailable_goal" \
  --expected-sha256 "$unavailable_digest")
unavailable_attachment=$(record_value "$unavailable_materialized" attachment_dir)
bash "$goal_loop" step release-staging --ledger "$unavailable_ledger" \
  --goal-file "$unavailable_goal" --expected-sha256 "$unavailable_digest" >/dev/null
bash "$goal_loop" step activate --ledger "$unavailable_ledger" \
  --applied-by native-subagent --boundary native_subagent \
  --agent-id pending --effective-route "$unavailable_route" \
  --route-verified false >/dev/null
bash "$goal_loop" step observe-route --ledger "$unavailable_ledger" \
  --agent-id agentunavailable \
  --effective-route 'claude|anthropic|unknown|unknown' \
  --confirmation unavailable >/dev/null
bash "$goal_loop" step release-objective --ledger "$unavailable_ledger" \
  --attachment-dir "$unavailable_attachment" \
  --expected-sha256 "$unavailable_digest" >/dev/null
expect_refusal 'unavailable route reported as blocked' bash "$goal_loop" \
  step report --ledger "$unavailable_ledger" --status blocked \
  --human-interruptions 0
unavailable_report=$(bash "$goal_loop" step report --ledger "$unavailable_ledger" \
  --status launch-required --human-interruptions 0)
grep -F 'route_verified: false' <<EOF >/dev/null || fail 'unavailable route verification'
$unavailable_report
EOF
grep -F 'launch_boundary: launch_required' <<EOF >/dev/null || fail 'unavailable launch boundary'
$unavailable_report
EOF

review_stop_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
review_stop_ledger=$(record_value "$review_stop_start" ledger)
bash "$goal_loop" step prepare --ledger "$review_stop_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$review_stop_ledger" \
  --workflow implement-feature --risk high --profile routine \
  --verification-gate high --readiness omitted --review selected >/dev/null
bash "$goal_loop" step launch-stop --ledger "$review_stop_ledger" \
  --reason review-unavailable >/dev/null
review_stop_report=$(bash "$goal_loop" step report --ledger "$review_stop_ledger" \
  --status launch-required --human-interruptions 0)
grep -F 'Independent review availability: unavailable.' <<EOF >/dev/null || fail 'pre-activation review availability report'
$review_stop_report
EOF
grep -F 'Native goal requires host launch.' <<EOF >/dev/null || fail 'pre-activation launch terminal sentence'
$review_stop_report
EOF

cleanup_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host claude)
cleanup_ledger=$(record_value "$cleanup_start" ledger)
cleanup_staging=$(record_value "$cleanup_start" staging_dir)
bash "$goal_loop" step prepare --ledger "$cleanup_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$cleanup_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --readiness omitted --review omitted >/dev/null
bash "$goal_loop" step runner --ledger "$cleanup_ledger" \
  --provider anthropic --model claude-sonnet-5 --effort low >/dev/null
cleanup_goal="$cleanup_staging/cleanup-goal.md"
write_goal_contract "$cleanup_goal" 'clean up before activation'
cleanup_digest=$(shasum -a 256 "$cleanup_goal")
cleanup_digest=${cleanup_digest%% *}
bash "$goal_loop" step stage --ledger "$cleanup_ledger" \
  --goal-file "$cleanup_goal" >/dev/null
cleanup_materialized=$(bash "$goal_loop" step materialize --ledger "$cleanup_ledger" \
  --goal-file "$cleanup_goal" --expected-sha256 "$cleanup_digest")
cleanup_attachment=$(record_value "$cleanup_materialized" attachment_dir)
bash "$goal_loop" step release-staging --ledger "$cleanup_ledger" \
  --goal-file "$cleanup_goal" --expected-sha256 "$cleanup_digest" >/dev/null
expect_refusal 'unverified Claude activation with resolved id' bash "$goal_loop" \
  step activate --ledger "$cleanup_ledger" --applied-by native-subagent \
  --boundary native_subagent --agent-id premature \
  --effective-route 'claude|anthropic|claude-sonnet-5|low' \
  --route-verified false
expect_refusal 'unverified Claude activation with mismatched route' bash "$goal_loop" \
  step activate --ledger "$cleanup_ledger" --applied-by native-subagent \
  --boundary native_subagent --agent-id pending \
  --effective-route 'claude|anthropic|claude-opus-5|high' \
  --route-verified false
bash "$goal_loop" step activate --ledger "$cleanup_ledger" \
  --applied-by native-subagent --boundary native_subagent \
  --agent-id pending --effective-route 'claude|anthropic|claude-sonnet-5|low' \
  --route-verified false >/dev/null
expect_refusal 'pending owner objective release' bash "$goal_loop" \
  step release-objective --ledger "$cleanup_ledger" \
  --attachment-dir "$cleanup_attachment" --expected-sha256 "$cleanup_digest"
bash "$goal_loop" step launch-stop --ledger "$cleanup_ledger" \
  --reason launch-unavailable >/dev/null
grep -F $'child_invocations\t0' "$cleanup_ledger/state" >/dev/null ||
  fail 'failed provisional launch retained a child invocation'
cleanup_release=$(bash "$goal_loop" step release-objective --ledger "$cleanup_ledger" \
  --attachment-dir "$cleanup_attachment" --expected-sha256 "$cleanup_digest")
grep -F $'status\treleased' <<EOF >/dev/null || fail 'pre-activation objective release'
$cleanup_release
EOF
expect_refusal 'duplicate pre-activation objective release' bash "$goal_loop" \
  step release-objective --ledger "$cleanup_ledger" \
  --attachment-dir "$cleanup_attachment" --expected-sha256 "$cleanup_digest"
cleanup_report=$(bash "$goal_loop" step report --ledger "$cleanup_ledger" \
  --status launch-required --human-interruptions 0)
grep -F 'evaluation_child_invocations: 0' <<EOF >/dev/null || fail 'failed provisional launch report retained a child'
$cleanup_report
EOF

readiness_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
readiness_ledger=$(record_value "$readiness_start" ledger)
readiness_staging=$(record_value "$readiness_start" staging_dir)
bash "$goal_loop" step prepare --ledger "$readiness_ledger" >/dev/null
readiness_route_out=$(bash "$goal_loop" step route --ledger "$readiness_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --readiness selected --review omitted)
test "$(record_value "$readiness_route_out" readiness_selection)" = selected ||
  fail 'selected readiness route record'
readiness_route=$(record_value "$readiness_route_out" selected_route)
readiness_goal="$readiness_staging/readiness-goal.md"
write_goal_contract "$readiness_goal" 'exercise readiness transitions'
readiness_digest=$(shasum -a 256 "$readiness_goal")
readiness_digest=${readiness_digest%% *}
bash "$goal_loop" step stage --ledger "$readiness_ledger" \
  --goal-file "$readiness_goal" >/dev/null
bash "$goal_loop" step materialize --ledger "$readiness_ledger" \
  --goal-file "$readiness_goal" --expected-sha256 "$readiness_digest" >/dev/null
bash "$goal_loop" step release-staging --ledger "$readiness_ledger" \
  --goal-file "$readiness_goal" --expected-sha256 "$readiness_digest" >/dev/null
bash "$goal_loop" step activate --ledger "$readiness_ledger" \
  --applied-by host-api --boundary host_api --agent-id none \
  --effective-route "$readiness_route" --route-verified true >/dev/null
grep -F $'phase\treadiness-pending' "$readiness_ledger/state" >/dev/null ||
  fail 'selected readiness did not enter pending state'
expect_refusal 'completion before readiness verdict' bash "$goal_loop" \
  step report --ledger "$readiness_ledger" --status complete \
  --human-interruptions 0
readiness_out=$(bash "$goal_loop" step readiness --ledger "$readiness_ledger" \
  --verdict ready)
test "$(record_value "$readiness_out" verdict)" = ready ||
  fail 'ready verdict record'
grep -F $'phase\tactive' "$readiness_ledger/state" >/dev/null ||
  fail 'ready verdict did not unlock active work'
expect_refusal 'duplicate readiness verdict' bash "$goal_loop" step readiness \
  --ledger "$readiness_ledger" --verdict ready
bash "$goal_loop" step report --ledger "$readiness_ledger" \
  --status complete --human-interruptions 0 >/dev/null

nonready_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
nonready_ledger=$(record_value "$nonready_start" ledger)
nonready_staging=$(record_value "$nonready_start" staging_dir)
bash "$goal_loop" step prepare --ledger "$nonready_ledger" >/dev/null
nonready_route_out=$(bash "$goal_loop" step route --ledger "$nonready_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --readiness selected --review omitted)
nonready_route=$(record_value "$nonready_route_out" selected_route)
nonready_goal="$nonready_staging/nonready-goal.md"
write_goal_contract "$nonready_goal" 'stop on non-ready readiness'
nonready_digest=$(shasum -a 256 "$nonready_goal")
nonready_digest=${nonready_digest%% *}
bash "$goal_loop" step stage --ledger "$nonready_ledger" \
  --goal-file "$nonready_goal" >/dev/null
bash "$goal_loop" step materialize --ledger "$nonready_ledger" \
  --goal-file "$nonready_goal" --expected-sha256 "$nonready_digest" >/dev/null
bash "$goal_loop" step release-staging --ledger "$nonready_ledger" \
  --goal-file "$nonready_goal" --expected-sha256 "$nonready_digest" >/dev/null
bash "$goal_loop" step activate --ledger "$nonready_ledger" \
  --applied-by host-api --boundary host_api --agent-id none \
  --effective-route "$nonready_route" --route-verified true >/dev/null
bash "$goal_loop" step readiness --ledger "$nonready_ledger" \
  --verdict needs-decision >/dev/null
grep -F $'phase\treadiness-stopped' "$nonready_ledger/state" >/dev/null ||
  fail 'non-ready verdict did not close the mutation gate'
grep -F $'readiness_verdict\tneeds-decision' "$nonready_ledger/state" >/dev/null ||
  fail 'non-ready verdict was not recorded'
expect_refusal 'non-ready completion' bash "$goal_loop" step report \
  --ledger "$nonready_ledger" --status complete --human-interruptions 0
bash "$goal_loop" step block --ledger "$nonready_ledger" \
  --kind decision --operation implementation-readiness \
  --retry one-attempt --waiver forbidden >/dev/null
nonready_report=$(bash "$goal_loop" step report --ledger "$nonready_ledger" \
  --status blocked --human-interruptions 0)
case "$nonready_report" in
  *'Native goal blocked; valid continuation responses are listed above.'*) ;;
  *) fail 'non-ready verdict did not permit blocked reporting' ;;
esac
grep -F 'Valid continuation responses: answer; continue.' <<EOF >/dev/null ||
  fail 'non-ready continuation choices'
$nonready_report
EOF
expect_refusal 'non-ready retry cannot bypass readiness' bash "$goal_loop" \
  step resume --ledger "$nonready_ledger" --mode retry
grep -F $'phase\tblocked' "$nonready_ledger/state" >/dev/null ||
  fail 'refused non-ready retry changed the blocked phase'
grep -F $'continuation_count\t0' "$nonready_ledger/state" >/dev/null ||
  fail 'refused non-ready retry incremented the continuation count'
grep -F $'retry_count\t0' "$nonready_ledger/state" >/dev/null ||
  fail 'refused non-ready retry incremented the retry count'
nonready_resume=$(bash "$goal_loop" step resume --ledger "$nonready_ledger" \
  --mode answer)
test "$(record_value "$nonready_resume" operation)" = implementation-readiness ||
  fail 'non-ready answer did not target readiness'
grep -F $'phase\treadiness-pending' "$nonready_ledger/state" >/dev/null ||
  fail 'non-ready answer did not restore readiness-pending phase'
grep -F $'readiness_verdict\tnone' "$nonready_ledger/state" >/dev/null ||
  fail 'non-ready answer did not require a fresh readiness verdict'

readiness_stop_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
readiness_stop_ledger=$(record_value "$readiness_stop_start" ledger)
bash "$goal_loop" step prepare --ledger "$readiness_stop_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$readiness_stop_ledger" \
  --workflow implement-feature --risk routine --profile routine \
  --verification-gate routine --readiness selected --review omitted >/dev/null
bash "$goal_loop" step launch-stop --ledger "$readiness_stop_ledger" \
  --reason readiness-unavailable >/dev/null
readiness_stop_report=$(bash "$goal_loop" step report \
  --ledger "$readiness_stop_ledger" --status launch-required \
  --human-interruptions 0)
case "$readiness_stop_report" in
  *'Implementation readiness availability: unavailable.'*) ;;
  *) fail 'pre-activation readiness availability report' ;;
esac

decision_gate_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host codex)
decision_ledger=$(record_value "$decision_gate_start" ledger)
bash "$goal_loop" step prepare --ledger "$decision_ledger" >/dev/null
bash "$goal_loop" step route --ledger "$decision_ledger" \
  --workflow decision-gated --risk high --profile none \
  --verification-gate not-applicable --readiness omitted --review omitted >/dev/null
decision_report=$(bash "$goal_loop" step report --ledger "$decision_ledger" \
  --status launch-required --human-interruptions 1)
grep -F 'workflow: decision-gated' <<EOF >/dev/null || fail 'decision report workflow'
$decision_report
EOF
grep -F 'enforcement: helper' <<EOF >/dev/null || fail 'decision report enforcement'
$decision_report
EOF

new_resumable_ledger() {
  resumable_start=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
    --repo "$repo" --host claude)
  resumable_ledger=$(record_value "$resumable_start" ledger)
  resumable_staging=$(record_value "$resumable_start" staging_dir)
  bash "$goal_loop" step prepare --ledger "$resumable_ledger" >/dev/null
  resumable_route_out=$(bash "$goal_loop" step route --ledger "$resumable_ledger" \
    --workflow fix-bug --risk routine --profile routine \
    --verification-gate routine --readiness omitted --review selected)
  resumable_route=$(record_value "$resumable_route_out" selected_route)
  bash "$goal_loop" step runner --ledger "$resumable_ledger" \
    --provider anthropic --model claude-sonnet-5 --effort low >/dev/null
  resumable_goal="$resumable_staging/resumable-goal.md"
  write_goal_contract "$resumable_goal" 'resume the same blocked owner'
  resumable_digest=$(shasum -a 256 "$resumable_goal")
  resumable_digest=${resumable_digest%% *}
  bash "$goal_loop" step stage --ledger "$resumable_ledger" \
    --goal-file "$resumable_goal" >/dev/null
  resumable_materialized=$(bash "$goal_loop" step materialize \
    --ledger "$resumable_ledger" --goal-file "$resumable_goal" \
    --expected-sha256 "$resumable_digest")
  resumable_attachment=$(record_value "$resumable_materialized" attachment_dir)
  resumable_objective=$(record_value "$resumable_materialized" objective_file)
  bash "$goal_loop" step release-staging --ledger "$resumable_ledger" \
    --goal-file "$resumable_goal" --expected-sha256 "$resumable_digest" >/dev/null
  bash "$goal_loop" step activate --ledger "$resumable_ledger" \
    --applied-by host-api --boundary host_api --agent-id none \
    --effective-route "$resumable_route" --route-verified true >/dev/null
}

evidence_a=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
evidence_b=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb

new_resumable_ledger
block_out=$(bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind permission --operation docker-smoke-test \
  --retry one-attempt --waiver forbidden)
test "$(record_value "$block_out" operation)" = docker-smoke-test ||
  fail 'resumable blocker operation record'
expect_refusal 'blocked objective released before lifecycle end' bash "$goal_loop" \
  step release-objective --ledger "$resumable_ledger" \
  --attachment-dir "$resumable_attachment" --expected-sha256 "$resumable_digest"
blocked_report=$(bash "$goal_loop" step report --ledger "$resumable_ledger" \
  --status blocked --human-interruptions 1)
grep -F 'Native goal blocked; valid continuation responses are listed above.' \
  <<EOF >/dev/null || fail 'resumable blocked report'
$blocked_report
EOF
grep -F 'Valid continuation responses: answer; continue; retry.' \
  <<EOF >/dev/null || fail 'one-attempt continuation choices'
$blocked_report
EOF
expect_refusal 'changed conditions on one-attempt blocker' bash "$goal_loop" \
  step resume --ledger "$resumable_ledger" --mode continue \
  --conditions-changed 'unrelated condition'
grep -F $'phase\tblocked' "$resumable_ledger/state" >/dev/null ||
  fail 'blocked report terminalized the resumable ledger'
grep -F $'reported\tfalse' "$resumable_ledger/state" >/dev/null ||
  fail 'blocked report marked the ledger terminally reported'
test -r "$resumable_objective" || fail 'blocked report released the objective'
duplicate_blocked_report=$(bash "$goal_loop" step report \
  --ledger "$resumable_ledger" --status blocked --human-interruptions 1)
test "$duplicate_blocked_report" = "$blocked_report" ||
  fail 'duplicate blocked snapshot changed canonical output'
resume_answer=$(bash "$goal_loop" step resume --ledger "$resumable_ledger" \
  --mode answer)
test "$(record_value "$resume_answer" mode)" = answer ||
  fail 'answer continuation record'
grep -F $'phase\tactive' "$resumable_ledger/state" >/dev/null ||
  fail 'answer did not resume active work'
test -r "$resumable_objective" || fail 'answer continuation released the objective'

bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind operation --operation create-pull-request \
  --retry observe-first --waiver forbidden >/dev/null
observe_report=$(bash "$goal_loop" step report --ledger "$resumable_ledger" \
  --status blocked --human-interruptions 1)
grep -F 'Valid continuation responses: continue with completed observation; retry after not-completed observation.' \
  <<EOF >/dev/null || fail 'observe-first continuation choices'
$observe_report
EOF
expect_refusal 'ambiguous publication retry without observation' bash "$goal_loop" \
  step resume --ledger "$resumable_ledger" --mode retry
expect_refusal 'completed publication retried' bash "$goal_loop" step resume \
  --ledger "$resumable_ledger" --mode retry --observation completed
resume_observed=$(bash "$goal_loop" step resume --ledger "$resumable_ledger" \
  --mode continue --observation completed)
test "$(record_value "$resume_observed" observation)" = completed ||
  fail 'completed publication observation record'

bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind operation --operation docker-smoke-test \
  --retry one-attempt --waiver forbidden >/dev/null
one_attempt_report=$(bash "$goal_loop" step report --ledger "$resumable_ledger" \
  --status blocked --human-interruptions 1)
grep -F 'Valid continuation responses: continue; retry.' \
  <<EOF >/dev/null || fail 'operation one-attempt continuation choices'
$one_attempt_report
EOF
resume_retry=$(bash "$goal_loop" step resume --ledger "$resumable_ledger" \
  --mode retry)
test "$(record_value "$resume_retry" operation)" = docker-smoke-test ||
  fail 'retry changed the failed operation'
expect_refusal 'second attempt without a new blocked turn' bash "$goal_loop" \
  step resume --ledger "$resumable_ledger" --mode retry

bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind review --operation independent-review \
  --retry evidence-change --waiver forbidden --evidence-sha256 "$evidence_a" >/dev/null
review_report=$(bash "$goal_loop" step report \
  --ledger "$resumable_ledger" --status blocked --human-interruptions 1)
grep -F 'Valid continuation responses: continue with changed conditions; retry with changed evidence.' \
  <<EOF >/dev/null || fail 'review evidence-change continuation choices'
$review_report
EOF
expect_refusal 'unchanged deterministic review retry' bash "$goal_loop" \
  step resume --ledger "$resumable_ledger" --mode retry \
  --evidence-sha256 "$evidence_a"
expect_refusal 'unchanged deterministic review continue' bash "$goal_loop" \
  step resume --ledger "$resumable_ledger" --mode continue
bash "$goal_loop" step resume --ledger "$resumable_ledger" --mode retry \
  --evidence-sha256 "$evidence_b" >/dev/null

bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind dependency --operation external-condition \
  --retry evidence-change --waiver forbidden \
  --evidence-sha256 "$evidence_b" >/dev/null
conditions_report=$(bash "$goal_loop" step report --ledger "$resumable_ledger" \
  --status blocked --human-interruptions 1)
grep -F 'Valid continuation responses: continue with changed conditions; retry with changed evidence.' \
  <<EOF >/dev/null || fail 'evidence-change continuation choices'
$conditions_report
EOF
if bash "$goal_loop" step resume --ledger "$resumable_ledger" \
  --mode continue >"$tmp_root/conditions-refusal.out" \
  2>"$tmp_root/conditions-refusal.err"; then
  fail 'unqualified evidence-change continue'
fi
test ! -s "$tmp_root/conditions-refusal.out" ||
  fail 'unqualified evidence-change continue wrote stdout'
test "$(cat "$tmp_root/conditions-refusal.err")" = \
  'goal-loop: deterministic failure requires changed evidence or conditions before retry' ||
  fail 'unqualified evidence-change refusal changed'
rerendered_conditions_report=$(bash "$goal_loop" step report \
  --ledger "$resumable_ledger" --status blocked --human-interruptions 1)
test "$rerendered_conditions_report" = "$conditions_report" ||
  fail 'blocked snapshot did not re-render idempotently'
resume_conditions=$(bash "$goal_loop" step resume --ledger "$resumable_ledger" \
  --mode continue --conditions-changed 'service access was provisioned')
test "$(record_value "$resume_conditions" conditions_changed)" = \
  'service access was provisioned' || fail 'changed conditions continuation record'
grep -F $'resume-conditions-changed\tservice access was provisioned' \
  "$resumable_ledger/events" >/dev/null ||
  fail 'changed conditions were not recorded in the ledger'
grep -F $'phase\tactive' "$resumable_ledger/state" >/dev/null ||
  fail 'changed conditions did not resume active work'

bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind review --operation independent-review \
  --retry evidence-change --waiver discretionary \
  --evidence-sha256 "$evidence_b" >/dev/null
waivable_review_report=$(bash "$goal_loop" step report \
  --ledger "$resumable_ledger" --status blocked --human-interruptions 1)
grep -F 'Valid continuation responses: continue with changed conditions; retry with changed evidence; waive.' \
  <<EOF >/dev/null || fail 'discretionary review continuation choices'
$waivable_review_report
EOF
resume_waive=$(bash "$goal_loop" step resume --ledger "$resumable_ledger" \
  --mode waive)
test "$(record_value "$resume_waive" mode)" = waive ||
  fail 'discretionary waiver continuation record'
grep -F $'review_waived\ttrue' "$resumable_ledger/state" >/dev/null ||
  fail 'review waiver was not recorded'

bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind gate --operation repository-policy \
  --retry forbidden --waiver forbidden >/dev/null
policy_report=$(bash "$goal_loop" step report --ledger "$resumable_ledger" \
  --status blocked --human-interruptions 1)
grep -F 'Valid continuation responses: none.' <<EOF >/dev/null ||
  fail 'non-waivable policy continuation choices'
$policy_report
EOF
grep -F 'Native goal blocked; no continuation response is currently valid.' \
  <<EOF >/dev/null || fail 'non-waivable policy blocked report'
$policy_report
EOF
expect_refusal 'non-waivable policy bypass' bash "$goal_loop" step resume \
  --ledger "$resumable_ledger" --mode waive
expect_refusal 'non-waivable policy answer bypass' bash "$goal_loop" step resume \
  --ledger "$resumable_ledger" --mode answer
bash "$goal_loop" step end --ledger "$resumable_ledger" --reason superseded >/dev/null
bash "$goal_loop" step release-objective --ledger "$resumable_ledger" \
  --attachment-dir "$resumable_attachment" \
  --expected-sha256 "$resumable_digest" >/dev/null

new_resumable_ledger
bash "$goal_loop" step block --ledger "$resumable_ledger" \
  --kind dependency --operation external-service \
  --retry evidence-change --waiver forbidden --evidence-sha256 "$evidence_a" >/dev/null
bash "$goal_loop" step report --ledger "$resumable_ledger" \
  --status blocked --human-interruptions 1 >/dev/null
bash "$goal_loop" step end --ledger "$resumable_ledger" --reason abandoned >/dev/null
expect_refusal 'ended lifecycle resumed' bash "$goal_loop" step resume \
  --ledger "$resumable_ledger" --mode answer
bash "$goal_loop" step release-objective --ledger "$resumable_ledger" \
  --attachment-dir "$resumable_attachment" \
  --expected-sha256 "$resumable_digest" >/dev/null
test ! -e "$resumable_attachment" || fail 'abandoned objective was not cleaned up'
grep -F $'phase\tlifecycle-ended' "$resumable_ledger/state" >/dev/null ||
  fail 'abandoned lifecycle lost its terminal state during cleanup'

new_resumable_ledger
bash "$goal_loop" step end --ledger "$resumable_ledger" \
  --reason thread-destroyed >/dev/null
bash "$goal_loop" step release-objective --ledger "$resumable_ledger" \
  --attachment-dir "$resumable_attachment" \
  --expected-sha256 "$resumable_digest" >/dev/null
test ! -e "$resumable_attachment" ||
  fail 'thread-destroyed objective was not cleaned up'

printf '%s\n' 'ok - portable goal-loop step ledger'
