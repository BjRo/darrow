#!/usr/bin/env bash
# Deterministic coverage for the light-factory mechanics.
set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
FACTORY=$SCRIPT_DIR/factory
SHELL_UNDER_TEST=${BASH:-bash}
TAB=$(printf '\t')
FAILURES=0
TEMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/darrow-factory-test.XXXXXX")
TEMP_ROOT=$(cd "$TEMP_ROOT" && pwd -P)
[ -x /usr/bin/sandbox-exec ] || export DARROW_FACTORY_EXTERNAL_SANDBOX=1

cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT HUP INT TERM

ok() { printf '  ok: %s\n' "$1"; }
bad() { printf '  FAIL: %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

check_equal() {
  name=$1 expected=$2 actual=$3
  if [ "$expected" = "$actual" ]; then ok "$name"; else bad "$name (expected $expected, got $actual)"; fi
}

check_contains() {
  name=$1 needle=$2 haystack=$3
  case "$haystack" in *"$needle"*) ok "$name" ;; *) bad "$name (missing $needle)" ;; esac
}

check_not_contains() {
  name=$1 needle=$2 haystack=$3
  case "$haystack" in *"$needle"*) bad "$name (unexpected $needle)" ;; *) ok "$name" ;; esac
}

run_factory() {
  "$SHELL_UNDER_TEST" "$FACTORY" "$@"
}

repo=$TEMP_ROOT/repo
git -C "$TEMP_ROOT" init -qb main repo
git -C "$repo" config user.name test
git -C "$repo" config user.email test@example.invalid
printf 'one\n' >"$repo/value.txt"
git -C "$repo" add value.txt
git -C "$repo" commit -qm 'chore: init'
printf 'user change\n' >"$repo/user-owned.txt"
before=$(git -C "$repo" status --porcelain --untracked-files=all)

echo 'preflight and snapshot preserve local work'
preflight=$TEMP_ROOT/preflight.tsv
out=$(run_factory preflight --repo "$repo" --run-id stable-run --telemetry off --output "$preflight")
check_contains 'returns the stable run id' "run_id${TAB}stable-run" "$out"
check_contains 'records the absolute repository' "repository${TAB}$repo" "$(cat "$preflight")"
check_contains 'records pre-existing work' 'user-owned.txt' "$(cat "$preflight")"
check_contains 'fingerprints pre-existing work' "pre_existing_path${TAB}$repo/user-owned.txt${TAB}" "$(cat "$preflight")"
after=$(git -C "$repo" status --porcelain --untracked-files=all)
check_equal 'preflight leaves working tree unchanged' "$before" "$after"
printf 'two\n' >"$repo/value.txt"
printf 'new\n' >"$repo/new.txt"
snapshot=$TEMP_ROOT/snapshot.tsv
out=$(run_factory snapshot --preflight "$preflight" --output "$snapshot")
check_contains 'snapshot captures tracked path' "changed_file${TAB}$repo/value.txt" "$(cat "$snapshot")"
check_contains 'snapshot captures untracked path' "changed_file${TAB}$repo/new.txt" "$(cat "$snapshot")"
check_contains 'snapshot keeps pre-existing evidence' 'user-owned.txt' "$(cat "$snapshot")"
check_contains 'snapshot proves pre-existing bytes survived' "pre_existing_preserved${TAB}yes" "$(cat "$snapshot")"
diff_path=$(awk -F '\t' '$1=="diff" {print $2}' "$snapshot")
check_contains 'snapshot diff includes tracked content' '+two' "$(cat "$diff_path")"
check_contains 'snapshot diff includes untracked content' '+new' "$(cat "$diff_path")"
snapshot_fingerprint=$(awk -F '\t' '$1=="fingerprint" {print $2}' "$snapshot")
run_factory snapshot --preflight "$preflight" --expect-fingerprint "$snapshot_fingerprint" --output "$TEMP_ROOT/post-reader.tsv" >/dev/null
ok 'post-reader snapshot accepts an unchanged tree'
printf 'overwritten\n' >"$repo/user-owned.txt"
overwritten_snapshot=$TEMP_ROOT/overwritten-snapshot.tsv
set +e
run_factory snapshot --preflight "$preflight" --expect-fingerprint "$snapshot_fingerprint" --output "$overwritten_snapshot" >/dev/null 2>&1
status=$?
set -e
check_equal 'post-reader snapshot rejects a verifier mutation' 4 "$status"
check_contains 'snapshot detects overwritten pre-existing bytes' "pre_existing_preserved${TAB}no" "$(cat "$overwritten_snapshot")"
printf 'user change\n' >"$repo/user-owned.txt"

index_repo=$TEMP_ROOT/index-repo
git -C "$TEMP_ROOT" init -qb main index-repo
git -C "$index_repo" config user.name test
git -C "$index_repo" config user.email test@example.invalid
printf 'base\n' >"$index_repo/index-owned.txt"
git -C "$index_repo" add index-owned.txt
git -C "$index_repo" commit -qm 'chore: init'
printf 'owner bytes\n' >"$index_repo/index-owned.txt"
index_preflight=$TEMP_ROOT/index-preflight.tsv
run_factory preflight --repo "$index_repo" --run-id index-run --telemetry off --output "$index_preflight" >/dev/null
git -C "$index_repo" add index-owned.txt
index_snapshot=$TEMP_ROOT/index-snapshot.tsv
run_factory snapshot --preflight "$index_preflight" --output "$index_snapshot" >/dev/null
check_contains 'snapshot detects staging changes to pre-existing work' "pre_existing_preserved${TAB}no" "$(cat "$index_snapshot")"

echo 'routing and packet boundaries'
out=$(run_factory route --host codex --role executor --native yes)
check_contains 'normal executor route is standard Codex' "route${TAB}codex${TAB}openai${TAB}gpt-5.6-sol${TAB}medium" "$out"
set +e
out=$(run_factory route --host codex --role executor --route 'missing-harness|test|model|low' --native yes 2>&1)
status=$?
set -e
check_equal 'unavailable user route stops' 3 "$status"
check_contains 'unavailable user route is explicit' 'user-pinned route unavailable' "$out"
set +e
out=$(run_factory route --host codex --role executor --route 'codex|openai|gpt-5.6-sol|medium' --native no 2>&1)
status=$?
set -e
check_equal 'unavailable pinned native route stops' 3 "$status"
check_contains 'native route refusal is explicit' 'no native child support' "$out"

packet=$TEMP_ROOT/executor.tsv
out=$(run_factory packet-create --preflight "$preflight" --role executor \
  --objective 'Change value behavior' --criterion 'value.txt contains two' \
  --scope 'value.txt' --non-goal 'publication' --instruction none --decision none \
  --plan none --gate tests 'grep -Fx two value.txt' applicable 'AGENTS.md test guidance' \
  --route 'codex|openai|gpt-5.6-sol|medium|none' --output "$packet")
check_contains 'creates a validated packet' "packet${TAB}$packet" "$out"
check_contains 'executor is sole local writer' "write_boundary${TAB}local_worktree" "$(cat "$packet")"
check_contains 'packet contains structured result shape' "result_shape${TAB}" "$(cat "$packet")"
set +e
out=$(run_factory bridge --harness codex --packet "$packet" --output "$TEMP_ROOT/bridge.tsv" --model substituted-model --effort medium 2>&1)
status=$?
set -e
check_equal 'bridge rejects silent model substitution' 4 "$status"
check_contains 'bridge mismatch cites packet route' 'does not match packet route' "$out"
planner=$TEMP_ROOT/planner.tsv
run_factory packet-create --preflight "$preflight" --role planner \
  --objective 'Plan value behavior' --criterion 'produce a bounded plan' \
  --scope 'value.txt' --non-goal 'editing' --instruction none --decision none \
  --plan none --gate discovery none not_applicable 'planner does not run product gates' \
  --route 'codex|openai|gpt-5.6-sol|high|none' --output "$planner" >/dev/null
check_contains 'planner packet is read only' "write_boundary${TAB}read_only" "$(cat "$planner")"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="write_boundary"{$2="local_worktree"}{print}' "$planner" >"$planner.bad"
set +e
out=$(run_factory validate-packet "$planner.bad" 2>&1)
status=$?
set -e
check_equal 'validator rejects a writing planner' 4 "$status"
check_contains 'planner rejection names boundary' 'planner and verifier must be read_only' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="budget" && $2=="invocation_limit"{$3="6"}{print}' "$packet" >"$packet.bad-budget"
set +e
out=$(run_factory validate-packet "$packet.bad-budget" 2>&1)
status=$?
set -e
check_equal 'validator rejects an oversized invocation budget' 4 "$status"
check_contains 'budget rejection names the bound' 'between 1 and 5' "$out"

echo 'gate execution and publication refusal'
out=$(run_factory gate --repo "$repo" --name focused --command 'test -f value.txt' --evidence "$TEMP_ROOT/gate.log")
check_contains 'passing gate is recorded' "status${TAB}pass" "$out"
set +e
out=$(run_factory gate --repo "$repo" --name failing --command 'test -f absent.txt' --evidence "$TEMP_ROOT/fail.log")
status=$?
set -e
check_equal 'failed gate preserves command status' 1 "$status"
check_contains 'failed gate is honest' "status${TAB}fail" "$out"
set +e
out=$(run_factory gate --repo "$repo" --name mutating --command 'printf changed >gate-mutation.txt' --evidence "$TEMP_ROOT/mutating.log")
status=$?
set -e
check_equal 'gate that mutates product state is refused' 70 "$status"
check_contains 'mutating gate is marked failed' "status${TAB}fail" "$out"
rm -f "$repo/gate-mutation.txt"
set +e
out=$(run_factory gate --repo "$repo" --name mutating-dirty --command 'printf altered >value.txt' --evidence "$TEMP_ROOT/mutating-dirty.log")
status=$?
set -e
check_equal 'gate detects mutation of an already-dirty path' 70 "$status"
printf 'two\n' >"$repo/value.txt"
set +e
out=$(run_factory gate --repo "$repo" --name publish --command 'git push origin main' 2>&1)
status=$?
set -e
check_equal 'publication command is refused' 5 "$status"
check_contains 'publication refusal names boundary' 'crosses the local verification boundary' "$out"
set +e
run_factory gate --repo "$repo" --name publish-bypass --command 'git -C . push origin main' >/dev/null 2>&1
status=$?
set -e
check_equal 'publication flags cannot bypass refusal' 5 "$status"

echo 'role and aggregate result honesty'
gate_capture=$(run_factory gate --repo "$repo" --name tests --command 'test -f value.txt' --evidence "$TEMP_ROOT/role-gate.log")
gate_evidence_token=$(printf '%s\n' "$gate_capture" | awk -F '\t' '$1=="result_evidence" {print $2}')
executor_gate_capture=$(run_factory gate --repo "$repo" --name tests --command 'grep -Fx two value.txt' --evidence "$TEMP_ROOT/executor-gate.log")
executor_gate_evidence_token=$(printf '%s\n' "$executor_gate_capture" | awk -F '\t' '$1=="result_evidence" {print $2}')
role_result=$TEMP_ROOT/role.tsv
{
  printf 'format\tdarrow-factory-role-result-v1\n'
  printf 'run_id\tstable-run\n'
  printf 'role\tverifier\n'
  printf 'outcome\tcomplete\n'
  printf 'summary\tfinal diff and gates satisfy the criterion\n'
  printf 'gate\ttests\ttest -f value.txt\tapplicable\tpass\t%s\n' "$gate_evidence_token"
  printf 'route\tcodex\topenai\tgpt-5.6-sol\thigh\tnone\n'
  printf 'risk\tnone observed\n'
  printf 'next_action\tnone\n'
} >"$role_result"
out=$(run_factory validate-role-result verifier "$role_result")
check_contains 'accepts a structured verifier result' 'valid: darrow-factory-role-result-v1' "$out"
tr '\n' '\t' <"$role_result" >"$role_result.flat"
out=$(run_factory normalize-role-result verifier "$role_result.flat" "$role_result.normalized")
check_contains 'canonicalizes flattened record boundaries mechanically' "normalized${TAB}$role_result.normalized" "$out"
if cmp -s "$role_result" "$role_result.normalized"; then ok 'normalization preserves role evidence bytes by field'; else bad 'normalization changed role evidence fields'; fi
verifier_packet=$TEMP_ROOT/verifier.tsv
run_factory packet-create --preflight "$preflight" --role verifier \
  --objective 'Verify value behavior' --criterion 'value.txt contains two' \
  --scope 'value.txt' --non-goal 'editing' --instruction none --decision none \
  --plan none --gate tests 'test -f value.txt' applicable 'task criterion' \
  --route 'codex|openai|gpt-5.6-sol|high|none' --diff "$diff_path" \
  --output "$verifier_packet" >/dev/null
out=$(run_factory validate-role-result verifier "$role_result" "$verifier_packet")
check_contains 'matches role result to its packet run id' 'valid: darrow-factory-role-result-v1' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="role"{$2="planner"} $1=="changed_file"{next}{print} $1=="summary"{print "changed_file\t/tmp/forbidden"}' "$role_result" >"$role_result.readonly"
set +e
run_factory validate-role-result planner "$role_result.readonly" >/dev/null 2>&1
status=$?
set -e
check_equal 'read-only role cannot report product edits' 4 "$status"
set +e
out=$(run_factory validate-role-result executor "$role_result" 2>&1)
status=$?
set -e
check_equal 'rejects role identity mismatch' 4 "$status"

result=$TEMP_ROOT/result.tsv
{
  printf 'format\tdarrow-factory-result-v1\n'
  printf 'run_id\tstable-run\n'
  printf 'status\tverified\n'
  printf 'objective\tChange value behavior\n'
  printf 'base_revision\t%s\n' "$(git -C "$repo" rev-parse HEAD)"
  printf 'pre_existing_change\t?? user-owned.txt\n'
  printf 'changed_file\t%s/new.txt\n' "$repo"
  printf 'changed_file\t%s/user-owned.txt\n' "$repo"
  printf 'changed_file\t%s/value.txt\n' "$repo"
  printf 'route\texecutor\tcodex\topenai\tgpt-5.6-sol\tmedium\tnone\n'
  printf 'route\tverifier\tcodex\topenai\tgpt-5.6-sol\thigh\tnone\n'
  printf 'gate\ttests\ttest -f value.txt\tapplicable\tpass\t%s\n' "$gate_evidence_token"
  printf 'verification\trequired\tpass\tindependent verifier passed\n'
  printf 'repair_count\t0\n'
  printf 'permission\twrite\tlocal_worktree\n'
  printf 'permission\tpublication\tnone\n'
  printf 'budget\ttime_seconds\t1800\t30\n'
  printf 'budget\ttoken_limit\t200000\tunknown\n'
  printf 'budget\trepair_limit\t1\t0\n'
  printf 'budget\tinvocation_limit\t5\t2\n'
  printf 'telemetry\tbest_effort\tabcd\tabcd\tdegraded\tcollector unavailable\n'
  printf 'risk\tpre-existing user-owned.txt remains\n'
  printf 'next_action\tnone\n'
} >"$result"
executor_result=$TEMP_ROOT/executor-result.tsv
{
  printf 'format\tdarrow-factory-role-result-v1\n'
  printf 'run_id\tstable-run\n'
  printf 'role\texecutor\n'
  printf 'outcome\tcomplete\n'
  printf 'summary\tvalue behavior implemented\n'
  printf 'changed_file\t%s/value.txt\n' "$repo"
  printf 'gate\ttests\tgrep -Fx two value.txt\tapplicable\tpass\t%s\n' "$executor_gate_evidence_token"
  printf 'route\tcodex\topenai\tgpt-5.6-sol\tmedium\tnone\n'
  printf 'risk\tnone observed\n'
  printf 'next_action\tnone\n'
} >"$executor_result"
set +e
out=$(run_factory validate-result "$result" "$preflight" 2>&1)
status=$?
set -e
check_equal 'verified result requires provenance artifacts' 4 "$status"
out=$(run_factory validate-result "$result" "$preflight" "$snapshot" "$packet" "$executor_result" "$verifier_packet" "$role_result")
check_contains 'binds verified result to snapshot and role evidence' 'valid: darrow-factory-result-v1' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="route" && $2=="executor"{$5="substituted-model"}{print}' "$result" >"$result.route-lie"
set +e
out=$(run_factory validate-result "$result.route-lie" "$preflight" "$snapshot" "$packet" "$executor_result" "$verifier_packet" "$role_result" 2>&1)
status=$?
set -e
check_equal 'rejects a fictional aggregate route' 4 "$status"
check_contains 'route lie cites role evidence' 'routes do not match role-result evidence' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="changed_file" && $2 ~ /new.txt$/{next}{print}' "$result" >"$result.path-lie"
set +e
out=$(run_factory validate-result "$result.path-lie" "$preflight" "$snapshot" "$packet" "$executor_result" "$verifier_packet" "$role_result" 2>&1)
status=$?
set -e
check_equal 'rejects a changed-path omission' 4 "$status"
check_contains 'path omission cites snapshot evidence' 'do not match snapshot' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="head_preserved"{$2="no"}{print}' "$snapshot" >"$snapshot.moved-head"
set +e
out=$(run_factory validate-result "$result" "$preflight" "$snapshot.moved-head" "$packet" "$executor_result" "$verifier_packet" "$role_result" 2>&1)
status=$?
set -e
check_equal 'rejects a moved HEAD publication boundary' 4 "$status"
check_contains 'moved HEAD rejection cites preflight revision' 'HEAD to remain at the preflight revision' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="pre_existing_change"{$2="none"}{print}' "$result" >"$result.preexisting"
set +e
out=$(run_factory validate-result "$result.preexisting" "$preflight" "$snapshot" "$packet" "$executor_result" "$verifier_packet" "$role_result" 2>&1)
status=$?
set -e
check_equal 'rejects hidden pre-existing work' 4 "$status"
check_contains 'pre-existing mismatch cites the binding' 'do not match preflight' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="gate"{$5="fail"}{print}' "$result" >"$result.bad"
set +e
out=$(run_factory validate-result "$result.bad" "$preflight" "$snapshot" "$packet" "$executor_result" "$verifier_packet" "$role_result" 2>&1)
status=$?
set -e
check_equal 'rejects false verified status' 4 "$status"
check_contains 'false verified rejection cites evidence conflict' 'verified contradicts' "$out"
awk -F '\t' 'BEGIN{OFS="\t"} $1=="repair_count"{$2="2"}{print}' "$result" >"$result.repair"
set +e
run_factory validate-result "$result.repair" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects a second repair cycle' 4 "$status"

echo 'telemetry privacy and doctor diagnostics'
unset OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_TRACES_ENDPOINT OTEL_EXPORTER_OTLP_HEADERS
set +e
out=$(run_factory telemetry-check --mode strict 2>&1)
status=$?
set -e
check_equal 'strict telemetry blocks before work when unconfigured' 3 "$status"
check_contains 'strict telemetry reports missing configuration' 'OTEL_EXPORTER_OTLP_ENDPOINT' "$out"
set +e
out=$(run_factory preflight --repo "$repo" --run-id strict-unready --telemetry strict --output "$TEMP_ROOT/strict-unready.tsv" 2>&1)
status=$?
set -e
check_equal 'strict preflight refuses to create a run before readiness' 3 "$status"
failing_curl_bin=$TEMP_ROOT/failing-curl-bin
mkdir -p "$failing_curl_bin"
{
  printf '#!/usr/bin/env bash\n'
  printf 'exit 22\n'
} >"$failing_curl_bin/curl"
chmod +x "$failing_curl_bin/curl"
set +e
out=$(OTEL_EXPORTER_OTLP_ENDPOINT=http://collector.invalid PATH="$failing_curl_bin:/usr/bin:/bin" run_factory telemetry-check --mode strict --network 2>&1)
status=$?
set -e
check_equal 'strict telemetry rejects an HTTP export failure' 3 "$status"
check_contains 'failed OTLP probe is degraded' "status${TAB}degraded" "$out"
payload=$TEMP_ROOT/span.json
out=$(run_factory telemetry-emit --run-id stable-run --span executor --role executor \
  --outcome complete --harness codex --provider openai --model gpt-5.6-sol \
  --effort medium --duration-ms 12 --input-tokens 10 --output-tokens 5 \
  --duplicate-key native-call-1 --mode best_effort --output "$payload")
check_contains 'best-effort export degradation is visible' "telemetry${TAB}degraded" "$out"
payload_text=$(cat "$payload")
check_contains 'OTLP payload correlates the run' 'factory.run_id' "$payload_text"
check_contains 'OTLP payload carries duplicate accounting key' 'native-call-1' "$payload_text"
for required_attribute in factory.role factory.harness gen_ai.provider.name gen_ai.request.model factory.effort factory.outcome factory.duration_ms gen_ai.usage.input_tokens gen_ai.usage.output_tokens; do
  check_contains "OTLP payload keeps $required_attribute" "$required_attribute" "$payload_text"
done
check_not_contains 'OTLP payload excludes source content' 'user change' "$payload_text"
check_not_contains 'unknown cost is not serialized as zero' 'cost.actual_usd' "$payload_text"
controller_payload=$TEMP_ROOT/controller-span.json
run_factory telemetry-emit --run-id stable-run --span controller --role controller \
  --outcome complete --repair-count 1 --verification-outcome pass \
  --supervision-interruptions 0 --final-state verified --mode best_effort \
  --output "$controller_payload" >/dev/null
controller_text=$(cat "$controller_payload")
for required_attribute in factory.repair_count factory.verification_outcome factory.supervision_interruptions factory.final_state; do
  check_contains "controller OTLP keeps $required_attribute" "$required_attribute" "$controller_text"
done

fixture_bin=$TEMP_ROOT/bin
mkdir -p "$fixture_bin"
for executable in codex claude; do
  {
    printf '#!/usr/bin/env bash\n'
    printf 'printf invoked >>"%s"\n' "$TEMP_ROOT/model-invocations"
  } >"$fixture_bin/$executable"
  chmod +x "$fixture_bin/$executable"
done
out=$(PATH="$fixture_bin:/usr/bin:/bin" run_factory doctor --host codex --telemetry-mode best_effort)
check_contains 'doctor reports native support as controller-owned' "native_child_support${TAB}controller_must_confirm" "$out"
if [ -e "$TEMP_ROOT/model-invocations" ]; then bad 'doctor invoked a paid-model harness'; else ok 'doctor performs no paid-model probe'; fi
check_not_contains 'doctor does not print credential values' 'secret-value' "$out"
out=$(OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 OTEL_EXPORTER_OTLP_HEADERS='Authorization=secret-value' PATH="$fixture_bin:/usr/bin:/bin" run_factory doctor --host codex --telemetry-mode best_effort)
check_contains 'doctor detects configured telemetry without a live probe' "telemetry${TAB}ready" "$out"
check_not_contains 'configured telemetry remains secret-safe' 'secret-value' "$out"

if [ "$FAILURES" -gt 0 ]; then
  printf '\n%d test(s) failed\n' "$FAILURES"
  exit 1
fi
printf '\nall factory mechanics tests passed\n'
