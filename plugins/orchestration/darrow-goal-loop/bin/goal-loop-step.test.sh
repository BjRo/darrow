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
  printf '%s\n' 'Outcome: exercise review transitions' >"$fixture_goal"
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

start_out=$(TMPDIR="$tmp_root" bash "$goal_loop" step start \
  --repo "$repo" --host claude)
test "$(record_value "$start_out" format)" = darrow-goal-step-v1 ||
  fail 'step start format'
test "$(record_value "$start_out" step)" = start || fail 'step start name'
ledger=$(record_value "$start_out" ledger)
staging_dir=$(record_value "$start_out" staging_dir)
run_id=$(record_value "$start_out" run_id)
test -n "$run_id" || fail 'step start run id'
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
activate_out=$(bash "$goal_loop" step activate --ledger "$ledger" \
  --applied-by native-subagent --boundary native_subagent --agent-id pending \
  --effective-route "$selected_route" --route-verified false \
  --enforcement helper+claude-hooks)
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
enforcement: helper+claude-hooks
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
printf '%s\n' 'Outcome: preserve unavailable route evidence' >"$unavailable_goal"
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
printf '%s\n' 'Outcome: clean up before activation' >"$cleanup_goal"
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
printf '%s\n' 'Outcome: exercise readiness transitions' >"$readiness_goal"
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
printf '%s\n' 'Outcome: stop on non-ready readiness' >"$nonready_goal"
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
nonready_report=$(bash "$goal_loop" step report --ledger "$nonready_ledger" \
  --status blocked --human-interruptions 0)
case "$nonready_report" in
  *'Native goal settled as blocked.'*) ;;
  *) fail 'non-ready verdict did not permit blocked reporting' ;;
esac

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

printf '%s\n' 'ok - portable goal-loop step ledger'
