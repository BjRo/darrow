#!/usr/bin/env bash
set -euo pipefail

SHELL_UNDER_TEST=${SHELL_UNDER_TEST:-bash}
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DELIVERY=$SCRIPT_DIR/delivery
TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/darrow-delivery-test.XXXXXX")
if [ "${KEEP_TMP:-0}" = 1 ]; then
  trap 'printf "kept test files at %s\n" "$TMP_ROOT"' EXIT
else
  trap 'rm -rf "$TMP_ROOT"' EXIT
fi

FAILURES=0
TAB=$(printf '\t')

ok() { printf 'ok - %s\n' "$1"; }
bad() { printf 'not ok - %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

check_contains() {
  name=$1 needle=$2 file=$3
  if grep -F -- "$needle" "$file" >/dev/null; then ok "$name"; else bad "$name (missing $needle)"; fi
}

check_equal() {
  name=$1 expected=$2 actual=$3
  if [ "$expected" = "$actual" ]; then ok "$name"; else bad "$name (expected $expected, got $actual)"; fi
}

run_delivery() {
  if [ "${1:-}" = record ]; then
    shift
    record_body=
    record_artifact_file=
    record_output=
    record_args="$*"
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --body-file) record_body=$2; shift 2 ;;
        --artifact-file) record_artifact_file=$2; shift 2 ;;
        --output) record_output=$2; shift 2 ;;
        *) bad "test helper received unknown record argument in $record_args"; return 99 ;;
      esac
    done
    launch_phase=$(sed -n '3s/^phase\t//p' "$record_artifact_file")
    launch_iteration=$(sed -n '4s/^iteration\t//p' "$record_artifact_file")
    launch_agent=$(sed -n '5s/^agent\t//p' "$record_artifact_file")
    launch_output=$TMP_ROOT/launch-$$-$launch_phase-$launch_iteration.md
    rm -f "$launch_output"
    "$SHELL_UNDER_TEST" "$DELIVERY" launch --body-file "$record_body" \
      --phase "$launch_phase" --iteration "$launch_iteration" --agent "$launch_agent" \
      --harness codex --model test-model --effort medium --output "$launch_output" >/dev/null || return
    "$SHELL_UNDER_TEST" "$DELIVERY" record --body-file "$launch_output" \
      --artifact-file "$record_artifact_file" --output "$record_output"
    return
  fi
  "$SHELL_UNDER_TEST" "$DELIVERY" "$@"
}

write_artifact() {
  path=$1 phase=$2 iteration=$3 agent=$4 status=$5 summary=$6 evidence=$7
  {
    printf 'format\tdarrow-delivery-phase-v1\n'
    printf 'run_id\trun-20260806-120000\n'
    printf 'phase\t%s\n' "$phase"
    printf 'iteration\t%s\n' "$iteration"
    printf 'agent\t%s\n' "$agent"
    printf 'status\t%s\n' "$status"
    printf 'summary\t%s\n' "$summary"
    printf '%s\n' '---'
    printf '%s\n' "$evidence"
  } >"$path"
}

body=$TMP_ROOT/body.md
cat >"$body" <<'EOF'
## Outcome

Return the exact requested value.

## Done criteria

- [ ] Focused behavior passes.

Keep this user-owned tail exactly.
EOF
before=$(cat "$body")
baseline=$TMP_ROOT/baseline.txt
printf '%s\n' ' M user-owned.txt' >"$baseline"
initialized=$TMP_ROOT/initialized.md

echo 'initialize a ticket-backed run'
out=$(run_delivery init --body-file "$body" --run-id run-20260806-120000 \
  --repo "$TMP_ROOT/repo" --base-revision abc123 --baseline-file "$baseline" --output "$initialized")
check_contains 'reports the initialized output' "body${TAB}$initialized" <(printf '%s\n' "$out")
check_equal 'does not mutate the input body' "$before" "$(cat "$body")"
check_contains 'preserves the original outcome' 'Return the exact requested value.' "$initialized"
check_contains 'preserves the original tail' 'Keep this user-owned tail exactly.' "$initialized"
check_contains 'records the run format' "format${TAB}darrow-delivery-ticket-v1" "$initialized"
check_contains 'records the run id' "run_id${TAB}run-20260806-120000" "$initialized"
check_contains 'records the repository as absolute input' "repository${TAB}$TMP_ROOT/repo" "$initialized"
check_contains 'records the base revision' "base_revision${TAB}abc123" "$initialized"
check_contains 'records the pre-existing user-work baseline' ' M user-owned.txt' "$initialized"
check_contains 'starts the run active' "state${TAB}active" "$initialized"
check_contains 'initializes phase state' '| refine | pending | 0 |' "$initialized"
check_contains 'initializes the execution ledger' '## Factory Execution Ledger' "$initialized"

set +e
run_delivery init --body-file "$body" --run-id 'bad id' --repo "$TMP_ROOT/repo" \
  --base-revision abc123 --baseline-file "$baseline" --output "$TMP_ROOT/bad.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects an unsafe run id' 2 "$status"

raw_launch=$TMP_ROOT/raw-launch.md
out=$("$SHELL_UNDER_TEST" "$DELIVERY" launch --body-file "$initialized" \
  --phase refine --iteration 1 --agent refiner-raw --harness codex \
  --model test-model --effort medium --output "$raw_launch")
check_contains 'persists an in-flight phase before child work' '| refine | in_progress | 1 |' "$raw_launch"
check_contains 'persists the child route before launch' '| refine | 1 | refiner-raw | codex | test-model | medium | launched |' "$raw_launch"
summary=$(run_delivery summary --body-file "$raw_launch")
check_contains 'does not repeat an in-flight phase on resume' "next_phase${TAB}finish" <(printf '%s\n' "$summary")
echo 'record a validated phase artifact'
refine_artifact=$TMP_ROOT/refine.tsv
cat >"$refine_artifact" <<'EOF'
format	darrow-delivery-phase-v1
run_id	run-20260806-120000
phase	refine
iteration	1
agent	refiner-1
status	complete
summary	Plan and acceptance criteria are decision-complete
---
### Acceptance criteria

- The requested value is returned exactly.

### Verification

- `bash test.sh`
EOF
set +e
"$SHELL_UNDER_TEST" "$DELIVERY" record --body-file "$initialized" \
  --artifact-file "$refine_artifact" --output "$TMP_ROOT/unlaunched.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects an artifact without a durable launch record' 4 "$status"
recorded=$TMP_ROOT/recorded.md
out=$(run_delivery record --body-file "$initialized" --artifact-file "$refine_artifact" --output "$recorded")
check_contains 'reports the recorded phase' "phase${TAB}refine${TAB}complete" <(printf '%s\n' "$out")
check_contains 'updates the phase state' '| refine | complete | 1 |' "$recorded"
check_contains 'adds one execution ledger row' '| refine | 1 | refiner-1 | codex | test-model | medium | complete | Plan and acceptance criteria are decision-complete |' "$recorded"
check_contains 'adds a namespaced artifact section' '## Factory Artifact — refine — Iteration 1' "$recorded"
check_contains 'persists the phase evidence' '- `bash test.sh`' "$recorded"
check_contains 'still preserves user-owned ticket content' 'Keep this user-owned tail exactly.' "$recorded"

wrong_run=$TMP_ROOT/wrong-run.tsv
sed 's/run-20260806-120000/other-run/' "$refine_artifact" >"$wrong_run"
set +e
run_delivery record --body-file "$initialized" --artifact-file "$wrong_run" \
  --output "$TMP_ROOT/wrong-run.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects an artifact from another run' 4 "$status"

bad_status=$TMP_ROOT/bad-status.tsv
sed 's/status\tcomplete/status\tapproved/' "$refine_artifact" >"$bad_status"
set +e
run_delivery record --body-file "$initialized" --artifact-file "$bad_status" \
  --output "$TMP_ROOT/bad-status.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects a status that is invalid for the phase' 4 "$status"

echo 'enforce phase dependencies and finish only converged runs'
premature_challenge=$TMP_ROOT/premature-challenge.tsv
write_artifact "$premature_challenge" challenge 1 challenger-1 approved \
  'Plan is approved' '### Evidence'
set +e
run_delivery record --body-file "$initialized" --artifact-file "$premature_challenge" \
  --output "$TMP_ROOT/premature-challenge.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects challenge before refinement' 4 "$status"

challenge_one=$TMP_ROOT/challenge-one.tsv
write_artifact "$challenge_one" challenge 1 challenger-1 needs_revision \
  'One acceptance gap remains' '### Finding

The plan omits the zero-value case.'
challenged_one=$TMP_ROOT/challenged-one.md
run_delivery record --body-file "$recorded" --artifact-file "$challenge_one" --output "$challenged_one" >/dev/null
check_contains 'records a challenge revision request' '| challenge | needs_revision | 1 |' "$challenged_one"

premature_implement=$TMP_ROOT/premature-implement.tsv
write_artifact "$premature_implement" implement 1 implementer-1 complete \
  'Implementation complete' '### Changed files

- value.js'
set +e
run_delivery record --body-file "$challenged_one" --artifact-file "$premature_implement" \
  --output "$TMP_ROOT/premature-implement.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects implementation while challenge needs revision' 4 "$status"

refine_two=$TMP_ROOT/refine-two.tsv
write_artifact "$refine_two" refine 2 refiner-2 complete \
  'Plan now covers the zero-value case' '### Acceptance criteria

- Zero returns zero.'
refined_two=$TMP_ROOT/refined-two.md
run_delivery record --body-file "$challenged_one" --artifact-file "$refine_two" --output "$refined_two" >/dev/null

challenge_two=$TMP_ROOT/challenge-two.tsv
write_artifact "$challenge_two" challenge 2 challenger-2 approved \
  'Revised plan is approved' '### Verdict

No blocking gap remains.'
challenged_two=$TMP_ROOT/challenged-two.md
run_delivery record --body-file "$refined_two" --artifact-file "$challenge_two" --output "$challenged_two" >/dev/null
summary=$(run_delivery summary --body-file "$challenged_two")
check_contains 'resume identifies implementation as next' "next_phase${TAB}implement" <(printf '%s\n' "$summary")

implement=$TMP_ROOT/implement.tsv
write_artifact "$implement" implement 1 implementer-1 complete \
  'Implementation and focused gates pass' '### Changed files

- value.js

### Gates

- `bash test.sh`: pass'
implemented=$TMP_ROOT/implemented.md
run_delivery record --body-file "$challenged_two" --artifact-file "$implement" --output "$implemented" >/dev/null

review=$TMP_ROOT/review.tsv
write_artifact "$review" review 1 reviewer-1 approved \
  'Specification and repository review pass' '### Findings

None.'
reviewed=$TMP_ROOT/reviewed.md
run_delivery record --body-file "$implemented" --artifact-file "$review" --output "$reviewed" >/dev/null

qa=$TMP_ROOT/qa.tsv
write_artifact "$qa" qa 1 qa-1 passed \
  'Every acceptance criterion passes' '### Acceptance evidence

- Exact value: pass
- `bash test.sh`: pass'
qa_body=$TMP_ROOT/qa.md
run_delivery record --body-file "$reviewed" --artifact-file "$qa" --output "$qa_body" >/dev/null

set +e
run_delivery finish --body-file "$qa_body" --status verified --output "$TMP_ROOT/too-early.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects verified before codify evidence' 4 "$status"

codify=$TMP_ROOT/codify.tsv
write_artifact "$codify" codify 1 codifier-1 no_change \
  'No durable learning to record' '### Result

No new patterns to codify.'
codified=$TMP_ROOT/codified.md
run_delivery record --body-file "$qa_body" --artifact-file "$codify" --output "$codified" >/dev/null
finished=$TMP_ROOT/finished.md
out=$(run_delivery finish --body-file "$codified" --status verified --output "$finished")
check_contains 'reports verified completion' "status${TAB}verified" <(printf '%s\n' "$out")
check_contains 'persists verified run state' "state${TAB}verified" "$finished"
check_contains 'retains the first challenge artifact' 'One acceptance gap remains' "$finished"
check_contains 'retains the revised plan artifact' 'Plan now covers the zero-value case' "$finished"
check_contains 'preserves original ticket content after completion' 'Keep this user-owned tail exactly.' "$finished"

echo 'bound review and QA repair loops'
loop_init=$TMP_ROOT/loop-init.md
run_delivery init --body-file "$body" --run-id run-review-loop --repo "$TMP_ROOT/repo" \
  --base-revision def456 --baseline-file "$baseline" --output "$loop_init" >/dev/null

# Artifacts for this run use a separate run id.
write_loop_artifact() {
  path=$1 phase=$2 iteration=$3 agent=$4 status=$5 summary=$6
  {
    printf 'format\tdarrow-delivery-phase-v1\n'
    printf 'run_id\trun-review-loop\n'
    printf 'phase\t%s\n' "$phase"
    printf 'iteration\t%s\n' "$iteration"
    printf 'agent\t%s\n' "$agent"
    printf 'status\t%s\n' "$status"
    printf 'summary\t%s\n' "$summary"
    printf '%s\n' '---'
    printf '### Evidence\n\n%s\n' "$summary"
  } >"$path"
}

write_loop_artifact "$TMP_ROOT/l-refine.tsv" refine 1 refiner complete 'Plan complete'
run_delivery record --body-file "$loop_init" --artifact-file "$TMP_ROOT/l-refine.tsv" --output "$TMP_ROOT/l-refined.md" >/dev/null
write_loop_artifact "$TMP_ROOT/l-challenge.tsv" challenge 1 challenger approved 'Plan approved'
run_delivery record --body-file "$TMP_ROOT/l-refined.md" --artifact-file "$TMP_ROOT/l-challenge.tsv" --output "$TMP_ROOT/l-challenged.md" >/dev/null
write_loop_artifact "$TMP_ROOT/l-implement.tsv" implement 1 implementer complete 'Implementation complete'
run_delivery record --body-file "$TMP_ROOT/l-challenged.md" --artifact-file "$TMP_ROOT/l-implement.tsv" --output "$TMP_ROOT/l-implemented.md" >/dev/null
write_loop_artifact "$TMP_ROOT/l-review1.tsv" review 1 reviewer-1 changes_requested 'A blocking defect remains'
run_delivery record --body-file "$TMP_ROOT/l-implemented.md" --artifact-file "$TMP_ROOT/l-review1.tsv" --output "$TMP_ROOT/l-reviewed1.md" >/dev/null
set +e
"$SHELL_UNDER_TEST" "$DELIVERY" launch --body-file "$TMP_ROOT/l-reviewed1.md" \
  --phase rework --iteration 2 --agent skipped-repair --harness codex \
  --model test-model --effort medium --output "$TMP_ROOT/skipped-rework.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects a skipped rework iteration' 4 "$status"
write_loop_artifact "$TMP_ROOT/l-rework1.tsv" rework 1 repairer-1 complete 'Review defect repaired'
run_delivery record --body-file "$TMP_ROOT/l-reviewed1.md" --artifact-file "$TMP_ROOT/l-rework1.tsv" --output "$TMP_ROOT/l-reworked1.md" >/dev/null
write_loop_artifact "$TMP_ROOT/l-review2.tsv" review 2 reviewer-2 changes_requested 'Blocking defect persists'
run_delivery record --body-file "$TMP_ROOT/l-reworked1.md" --artifact-file "$TMP_ROOT/l-review2.tsv" --output "$TMP_ROOT/l-reviewed2.md" >/dev/null
summary=$(run_delivery summary --body-file "$TMP_ROOT/l-reviewed2.md")
check_contains 'second failed review requires escalation' "next_phase${TAB}finish" <(printf '%s\n' "$summary")
write_loop_artifact "$TMP_ROOT/l-rework2.tsv" rework 2 repairer-2 complete 'Unsafe extra repair'
set +e
run_delivery record --body-file "$TMP_ROOT/l-reviewed2.md" --artifact-file "$TMP_ROOT/l-rework2.tsv" \
  --output "$TMP_ROOT/l-reworked2.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects repair after the second failed review' 4 "$status"

reason=$TMP_ROOT/reason.md
cat >"$reason" <<'EOF'
Phase: review

The second independent review still finds the exact-value defect. Decide whether to change the ticket contract.
EOF
escalated=$TMP_ROOT/escalated.md
run_delivery finish --body-file "$TMP_ROOT/l-reviewed2.md" --status needs_human \
  --reason-file "$reason" --output "$escalated" >/dev/null
check_contains 'persists a human escalation section' '## Factory Escalation' "$escalated"
check_contains 'persists the requested decision' 'Decide whether to change the ticket contract.' "$escalated"

qa_init=$TMP_ROOT/qa-loop-init.md
run_delivery init --body-file "$body" --run-id run-qa-loop --repo "$TMP_ROOT/repo" \
  --base-revision ghi789 --baseline-file "$baseline" --output "$qa_init" >/dev/null
write_qa_artifact() {
  path=$1 phase=$2 iteration=$3 agent=$4 status=$5 summary=$6
  {
    printf 'format\tdarrow-delivery-phase-v1\nrun_id\trun-qa-loop\n'
    printf 'phase\t%s\niteration\t%s\nagent\t%s\nstatus\t%s\nsummary\t%s\n---\n' \
      "$phase" "$iteration" "$agent" "$status" "$summary"
    printf '### Evidence\n\n%s\n' "$summary"
  } >"$path"
}
prior=$qa_init
for entry in \
  'refine 1 refiner complete Plan-complete' \
  'challenge 1 challenger approved Plan-approved' \
  'implement 1 implementer complete Implementation-complete' \
  'review 1 reviewer approved Review-approved' \
  'qa 1 qa-1 failed First-QA-failed' \
  'rework 1 repairer complete QA-defect-repaired' \
  'qa 2 qa-2 failed Second-QA-failed'; do
  set -- $entry
  artifact=$TMP_ROOT/qa-loop-$1-$2.tsv
  next=$TMP_ROOT/qa-loop-$1-$2.md
  write_qa_artifact "$artifact" "$1" "$2" "$3" "$4" "$5"
  run_delivery record --body-file "$prior" --artifact-file "$artifact" --output "$next" >/dev/null
  prior=$next
done
summary=$(run_delivery summary --body-file "$prior")
check_contains 'second failed QA requires termination' "next_phase${TAB}finish" <(printf '%s\n' "$summary")
write_qa_artifact "$TMP_ROOT/qa-extra-rework.tsv" rework 2 repairer-2 complete 'Unsafe-extra-QA-repair'
set +e
run_delivery record --body-file "$prior" --artifact-file "$TMP_ROOT/qa-extra-rework.tsv" \
  --output "$TMP_ROOT/qa-extra-rework.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects repair after the second failed QA' 4 "$status"

echo 'escalate exhausted challenge loops and reject contradictory evidence'
challenge_init=$TMP_ROOT/challenge-loop-init.md
run_delivery init --body-file "$body" --run-id run-challenge-loop --repo "$TMP_ROOT/repo" \
  --base-revision jkl012 --baseline-file "$baseline" --output "$challenge_init" >/dev/null
challenge_prior=$challenge_init
for challenge_iteration in 1 2 3; do
  challenge_refine=$TMP_ROOT/challenge-refine-$challenge_iteration.tsv
  {
    printf 'format\tdarrow-delivery-phase-v1\nrun_id\trun-challenge-loop\n'
    printf 'phase\trefine\niteration\t%s\nagent\trefiner-%s\nstatus\tcomplete\nsummary\tPlan iteration %s complete\n---\n### Plan\n\nIteration %s.\n' \
      "$challenge_iteration" "$challenge_iteration" "$challenge_iteration" "$challenge_iteration"
  } >"$challenge_refine"
  challenge_refined=$TMP_ROOT/challenge-refined-$challenge_iteration.md
  run_delivery record --body-file "$challenge_prior" --artifact-file "$challenge_refine" --output "$challenge_refined" >/dev/null
  challenge_artifact=$TMP_ROOT/challenge-attempt-$challenge_iteration.tsv
  {
    printf 'format\tdarrow-delivery-phase-v1\nrun_id\trun-challenge-loop\n'
    printf 'phase\tchallenge\niteration\t%s\nagent\tchallenger-%s\nstatus\tneeds_revision\nsummary\tMaterial gap %s remains\n---\n### Finding\n\nGap %s.\n' \
      "$challenge_iteration" "$challenge_iteration" "$challenge_iteration" "$challenge_iteration"
  } >"$challenge_artifact"
  challenge_prior=$TMP_ROOT/challenge-result-$challenge_iteration.md
  run_delivery record --body-file "$challenge_refined" --artifact-file "$challenge_artifact" --output "$challenge_prior" >/dev/null
done
summary=$(run_delivery summary --body-file "$challenge_prior")
check_contains 'third unresolved challenge requires escalation' "next_phase${TAB}finish" <(printf '%s\n' "$summary")

tampered=$TMP_ROOT/tampered.md
sed '/^## Factory Artifact — codify — Iteration 1/,$d' "$codified" >"$tampered"
set +e
run_delivery summary --body-file "$tampered" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects a ledger without its retained artifact' 4 "$status"

injected_artifact=$TMP_ROOT/injected.tsv
sed '$a\
## Factory Phase State' "$refine_artifact" >"$injected_artifact"
set +e
run_delivery record --body-file "$initialized" --artifact-file "$injected_artifact" \
  --output "$TMP_ROOT/injected.md" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects Factory heading injection from artifact Markdown' 4 "$status"

renamed_header=$TMP_ROOT/renamed-header.md
sed '/^## Factory Artifact — refine — Iteration 1/,$ s/^format\t/kind\t/' "$recorded" >"$renamed_header"
set +e
run_delivery summary --body-file "$renamed_header" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects renamed persisted artifact headers' 4 "$status"

empty_evidence=$TMP_ROOT/empty-evidence.md
sed '/^### Acceptance criteria/,$d' "$recorded" >"$empty_evidence"
set +e
run_delivery summary --body-file "$empty_evidence" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects persisted artifacts without Markdown evidence' 4 "$status"

unknown_state=$TMP_ROOT/unknown-state.md
sed 's/^state\tactive$/state\ttypo/' "$initialized" >"$unknown_state"
set +e
run_delivery summary --body-file "$unknown_state" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects an unknown run state' 4 "$status"

false_verified=$TMP_ROOT/false-verified.md
sed 's/^state\tactive$/state\tverified/' "$initialized" >"$false_verified"
set +e
run_delivery summary --body-file "$false_verified" >/dev/null 2>&1
status=$?
set -e
check_equal 'rejects verified state without converged evidence' 4 "$status"

if [ "$FAILURES" -ne 0 ]; then
  printf '%s failure(s)\n' "$FAILURES" >&2
  exit 1
fi
printf 'all delivery mechanics tests passed\n'
