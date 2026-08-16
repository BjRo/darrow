#!/usr/bin/env bash
# Deterministic contract tests for the ticket-to-PR mechanics helper.
# Run with both `bash ticket-to-pr.test.sh` and `/bin/bash ticket-to-pr.test.sh`.
set -u

SCRIPT=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)/ticket-to-pr
FAILURES=0
TEST_NUMBER=0
TEST_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/darrow-ticket-to-pr-test.XXXXXX") || exit 70
TEST_ROOT=$(CDPATH='' cd -- "$TEST_ROOT" && pwd -P) || exit 70
TAB=$(printf '\t')

cleanup() {
  rm -rf "$TEST_ROOT"
}
trap cleanup EXIT HUP INT TERM

check() {
  description=$1
  expected=$2
  actual=$3
  if test "$actual" = "$expected"; then
    printf '  ok: %s\n' "$description"
  else
    printf '  FAIL: %s (expected %s, got %s)\n' "$description" "$expected" "$actual"
    FAILURES=$((FAILURES + 1))
  fi
}

contains() {
  description=$1
  haystack=$2
  needle=$3
  case "$haystack" in
    *"$needle"*) printf '  ok: %s\n' "$description" ;;
    *)
      printf '  FAIL: %s (missing %s)\n' "$description" "$needle"
      FAILURES=$((FAILURES + 1))
      ;;
  esac
}

not_contains() {
  description=$1
  haystack=$2
  needle=$3
  case "$haystack" in
    *"$needle"*)
      printf '  FAIL: %s (unexpected %s)\n' "$description" "$needle"
      FAILURES=$((FAILURES + 1))
      ;;
    *) printf '  ok: %s\n' "$description" ;;
  esac
}

next_path() {
  TEST_NUMBER=$((TEST_NUMBER + 1))
  NEW_PATH=$TEST_ROOT/case-$TEST_NUMBER
}

fresh_repo() {
  next_path
  REPO=$NEW_PATH
  mkdir -p "$REPO"
  git -C "$REPO" init -qb main
  git -C "$REPO" config user.email test@example.invalid
  git -C "$REPO" config user.name Test
  printf 'base\n' >"$REPO/base.txt"
  git -C "$REPO" add base.txt
  git -C "$REPO" commit -qm 'chore: initialize fixture'
  BASE_OID=$(git -C "$REPO" rev-parse HEAD)
}

add_remote() {
  next_path
  REMOTE=$NEW_PATH.git
  git init -q --bare "$REMOTE"
  git -C "$REPO" remote add origin "$REMOTE"
  git -C "$REPO" push -qu origin main
}

feature_commit() {
  git -C "$REPO" checkout -qb feat/TKT-31-mechanics
  printf 'feature\n' >"$REPO/feature.txt"
  git -C "$REPO" add feature.txt
  git -C "$REPO" commit -qm 'feat: implement TKT-31 mechanics'
  HEAD_OID=$(git -C "$REPO" rev-parse HEAD)
}

ready_repo() {
  fresh_repo
  add_remote
  feature_commit
  git -C "$REPO" push -qu origin feat/TKT-31-mechanics
}

write_launch_record() {
  record_path=$1
  cat >"$record_path" <<EOF
format${TAB}darrow-native-goal-preflight-v4
workflow${TAB}change-feature
risk${TAB}routine
profile${TAB}routine
selected_route${TAB}codex${TAB}openai${TAB}gpt-5.6-terra${TAB}medium
effective_route${TAB}codex${TAB}openai${TAB}gpt-5.6-terra${TAB}medium
route_applied_by${TAB}native-subagent
route_verified${TAB}true
launch_boundary${TAB}native_subagent
verification_gate${TAB}routine
evaluation_child_invocations${TAB}1
evaluation_human_interruptions${TAB}0
EOF
}

write_decision_record() {
  record_path=$1
  cat >"$record_path" <<EOF
format${TAB}darrow-native-goal-preflight-v4
workflow${TAB}decision-gated
risk${TAB}high
profile${TAB}none
selected_route${TAB}none${TAB}none${TAB}none${TAB}none
effective_route${TAB}none${TAB}none${TAB}none${TAB}none
route_applied_by${TAB}none
route_verified${TAB}false
launch_boundary${TAB}launch_required
verification_gate${TAB}not-applicable
evaluation_child_invocations${TAB}0
evaluation_human_interruptions${TAB}1
EOF
}

write_unverified_claude_record() {
  record_path=$1
  cat >"$record_path" <<EOF
format${TAB}darrow-native-goal-preflight-v4
workflow${TAB}change-feature
risk${TAB}high
profile${TAB}judgment
selected_route${TAB}claude${TAB}anthropic${TAB}claude-opus-5${TAB}high
effective_route${TAB}claude${TAB}anthropic${TAB}unknown${TAB}unknown
route_applied_by${TAB}native-subagent
route_verified${TAB}false
launch_boundary${TAB}launch_required
verification_gate${TAB}high
evaluation_child_invocations${TAB}1
evaluation_human_interruptions${TAB}0
EOF
}

validate_launch() {
  record_path=$1
  shift
  bash "$SCRIPT" validate-launch \
    --record "$record_path" \
    --adaptive-goal-children 1 \
    --observed-children 1 \
    --observed-route 'codex|openai|gpt-5.6-terra|medium' \
    --observed-applied-by native-subagent \
    --observed-boundary native_subagent "$@"
}

if test ! -f "$SCRIPT"; then
  printf 'FAIL: bundled helper is missing: %s\n' "$SCRIPT"
  exit 1
fi

printf '# inspect-repository success and refusal paths\n'
fresh_repo
add_remote
feature_commit
printf 'staged\n' >"$REPO/staged.txt"
git -C "$REPO" add staged.txt
printf 'changed\n' >>"$REPO/base.txt"
printf 'untracked\n' >"$REPO/untracked.txt"
before_head=$(git -C "$REPO" rev-parse HEAD)
before_status=$(git -C "$REPO" status --porcelain=v1 --untracked-files=all)
before_index=$(cksum "$REPO/.git/index")
before_refs=$(git -C "$REPO" show-ref)
out=$(bash "$SCRIPT" inspect-repository --repo "$REPO" --base main --ticket-key TKT-31)
rc=$?
check 'inspection succeeds' 0 "$rc"
contains 'inspection format' "$out" "format${TAB}darrow-ticket-to-pr-inspection-v1"
contains 'absolute repository path' "$out" "repository_root${TAB}$REPO"
contains 'absolute primary worktree' "$out" "primary_worktree${TAB}$REPO"
contains 'base oid' "$out" "base_oid${TAB}$BASE_OID"
contains 'current branch' "$out" "branch${TAB}feat/TKT-31-mechanics"
contains 'current head' "$out" "head${TAB}$HEAD_OID"
contains 'staged path is absolute' "$out" "staged_path${TAB}$REPO/staged.txt"
contains 'unstaged path is absolute' "$out" "unstaged_path${TAB}$REPO/base.txt"
contains 'untracked path is absolute' "$out" "untracked_path${TAB}$REPO/untracked.txt"
contains 'local branch candidate' "$out" "candidate_local_branch${TAB}refs/heads/feat/TKT-31-mechanics${TAB}$HEAD_OID"
contains 'commit candidate' "$out" "candidate_commit${TAB}$HEAD_OID"
contains 'status fingerprint' "$out" "status_fingerprint${TAB}"
contains 'index fingerprint' "$out" "index_fingerprint${TAB}"
contains 'worktree fingerprint' "$out" "worktree_fingerprint${TAB}"
contains 'refs fingerprint' "$out" "refs_fingerprint${TAB}"
check 'inspection preserves HEAD' "$before_head" "$(git -C "$REPO" rev-parse HEAD)"
check 'inspection preserves index bytes' "$before_index" "$(cksum "$REPO/.git/index")"
check 'inspection preserves refs' "$before_refs" "$(git -C "$REPO" show-ref)"
check 'inspection preserves status' "$before_status" "$(git -C "$REPO" status --porcelain=v1 --untracked-files=all)"

next_path
outside=$NEW_PATH
mkdir -p "$outside"
bash "$SCRIPT" inspect-repository --repo "$outside" --base main >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'inspection refuses a non-repository' 2 "$?"
contains 'non-repository refusal is specific' "$(cat "$TEST_ROOT/err")" 'not a Git working tree'
bash "$SCRIPT" inspect-repository --repo "$REPO" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'inspection requires deliberate base' 2 "$?"
bash "$SCRIPT" inspect-repository --repo "$REPO" --base does-not-exist >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'inspection refuses a missing base' 2 "$?"

next_path
conflict_repo=$NEW_PATH
mkdir -p "$conflict_repo"
git -C "$conflict_repo" init -qb main
git -C "$conflict_repo" config user.email test@example.invalid
git -C "$conflict_repo" config user.name Test
printf 'one\n' >"$conflict_repo/shared.txt"
git -C "$conflict_repo" add shared.txt
git -C "$conflict_repo" commit -qm 'chore: init'
git -C "$conflict_repo" checkout -qb side
printf 'side\n' >"$conflict_repo/shared.txt"
git -C "$conflict_repo" commit -qam 'fix: side'
git -C "$conflict_repo" checkout -q main
printf 'main\n' >"$conflict_repo/shared.txt"
git -C "$conflict_repo" commit -qam 'fix: main'
git -C "$conflict_repo" merge side >/dev/null 2>&1
out=$(bash "$SCRIPT" inspect-repository --repo "$conflict_repo" --base main)
check 'conflicted repository can be inspected' 0 "$?"
contains 'conflict count is reported' "$out" "conflict_count${TAB}1"
contains 'conflict path is absolute' "$out" "conflict_path${TAB}$conflict_repo/shared.txt"
contains 'main-worktree merge operation is reported' "$out" "operation${TAB}merge"

printf '# validate-launch success and refusal paths\n'
launch_record="$TEST_ROOT/launch-record.tsv"
write_launch_record "$launch_record"
launch_before=$(cksum "$launch_record")
out=$(validate_launch "$launch_record")
check 'valid v4 record succeeds' 0 "$?"
contains 'launch validation format' "$out" "format${TAB}darrow-ticket-to-pr-launch-validation-v1"
contains 'launch record path is absolute' "$out" "record${TAB}$launch_record"
contains 'one adaptive-goal child' "$out" "adaptive_goal_children${TAB}1"
contains 'record route is retained' "$out" "effective_route${TAB}codex${TAB}openai${TAB}gpt-5.6-terra${TAB}medium"
contains 'launch validation succeeds explicitly' "$out" "valid${TAB}true"
check 'launch validation does not rewrite record' "$launch_before" "$(cksum "$launch_record")"

bash "$SCRIPT" validate-launch --record "$launch_record" --adaptive-goal-children 2 --observed-children 1 --observed-route 'codex|openai|gpt-5.6-terra|medium' --observed-applied-by native-subagent --observed-boundary native_subagent >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'two adaptive-goal children are refused' 2 "$?"
bash "$SCRIPT" validate-launch --record "$launch_record" --adaptive-goal-children 1 --observed-children 0 --observed-route 'codex|openai|gpt-5.6-terra|medium' --observed-applied-by native-subagent --observed-boundary native_subagent >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'observed child mismatch is refused' 2 "$?"
bash "$SCRIPT" validate-launch --record "$launch_record" --adaptive-goal-children 1 --observed-children 1 --observed-route 'codex|openai|gpt-5.6-sol|high' --observed-applied-by native-subagent --observed-boundary native_subagent >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'observed route mismatch is refused' 2 "$?"

bad_record="$TEST_ROOT/bad-launch-record.tsv"
sed 's/darrow-native-goal-preflight-v4/darrow-native-goal-preflight-v3/' "$launch_record" >"$bad_record"
validate_launch "$bad_record" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'non-v4 record is refused' 2 "$?"
same_thread_record="$TEST_ROOT/same-thread-record.tsv"
sed -e 's/native-subagent/current-thread/' -e 's/native_subagent/same_thread/' "$launch_record" >"$same_thread_record"
validate_launch "$same_thread_record" --observed-applied-by current-thread --observed-boundary same_thread >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'same-thread record with one native child is refused' 2 "$?"

decision_record="$TEST_ROOT/decision-record.tsv"
write_decision_record "$decision_record"
out=$(validate_launch "$decision_record" --observed-children 0 --observed-route 'none|none|none|none' --observed-applied-by none --observed-boundary launch_required)
check 'canonical decision-gated record validates' 0 "$?"
contains 'decision-gated profile none is retained' "$out" "profile${TAB}none"
contains 'decision-gated interruption is retained' "$out" "record_human_interruptions${TAB}1"
invalid_decision_record="$TEST_ROOT/invalid-decision-record.tsv"
sed -e 's/route_applied_by\tnone/route_applied_by\tcurrent-thread/' -e 's/route_verified\tfalse/route_verified\ttrue/' -e 's/launch_boundary\tlaunch_required/launch_boundary\tsame_thread/' "$decision_record" >"$invalid_decision_record"
validate_launch "$invalid_decision_record" --observed-children 0 --observed-route 'none|none|none|none' --observed-applied-by current-thread --observed-boundary same_thread >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'decision-gated record with a launched boundary is refused' 2 "$?"

unverified_record="$TEST_ROOT/unverified-claude-record.tsv"
write_unverified_claude_record "$unverified_record"
out=$(validate_launch "$unverified_record" --observed-route 'claude|anthropic|unknown|unknown' --observed-applied-by native-subagent --observed-boundary launch_required)
check 'canonical unverified Claude child record validates' 0 "$?"
contains 'unverified route remains false' "$out" "route_verified${TAB}false"
contains 'unverified native child remains observed' "$out" "record_child_invocations${TAB}1"
copied_unverified_record="$TEST_ROOT/copied-unverified-claude-record.tsv"
sed 's/effective_route\tclaude\tanthropic\tunknown\tunknown/effective_route\tclaude\tanthropic\tclaude-opus-5\thigh/' "$unverified_record" >"$copied_unverified_record"
validate_launch "$copied_unverified_record" --observed-route 'claude|anthropic|claude-opus-5|high' --observed-applied-by native-subagent --observed-boundary launch_required >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'unverified native child cannot copy selected route as effective' 2 "$?"

printf '# verify-delivery success and refusal paths\n'
ready_repo
out=$(bash "$SCRIPT" verify-delivery --repo "$REPO" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-mechanics --head "$HEAD_OID" --remote origin --remote-branch feat/TKT-31-mechanics)
check 'clean pushed delivery verifies' 0 "$?"
contains 'delivery format' "$out" "format${TAB}darrow-ticket-to-pr-delivery-verification-v1"
contains 'delivery repository is absolute' "$out" "repository_root${TAB}$REPO"
contains 'base is verified' "$out" "base_oid${TAB}$BASE_OID"
contains 'head is verified' "$out" "head${TAB}$HEAD_OID"
contains 'remote branch is verified' "$out" "remote_ref${TAB}refs/remotes/origin/feat/TKT-31-mechanics"
contains 'cleanliness is verified' "$out" "clean${TAB}true"
contains 'no preservation claim is explicit' "$out" "preservation_records${TAB}0"
contains 'delivery verification succeeds explicitly' "$out" "valid${TAB}true"

printf 'dirty\n' >"$REPO/dirty.txt"
bash "$SCRIPT" verify-delivery --repo "$REPO" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-mechanics --head "$HEAD_OID" --remote origin --remote-branch feat/TKT-31-mechanics >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'dirty delivery is refused' 2 "$?"
rm "$REPO/dirty.txt"
bash "$SCRIPT" verify-delivery --repo "$REPO" --base main --base-oid "$HEAD_OID" --branch feat/TKT-31-mechanics --head "$HEAD_OID" --remote origin --remote-branch feat/TKT-31-mechanics >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'moved base evidence is refused' 2 "$?"
bash "$SCRIPT" verify-delivery --repo "$REPO" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-mechanics --head "$BASE_OID" --remote origin --remote-branch feat/TKT-31-mechanics >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'wrong expected head is refused' 2 "$?"
printf 'local-only\n' >"$REPO/local-only.txt"
git -C "$REPO" add local-only.txt
git -C "$REPO" commit -qm 'test: leave remote behind'
local_head=$(git -C "$REPO" rev-parse HEAD)
bash "$SCRIPT" verify-delivery --repo "$REPO" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-mechanics --head "$local_head" --remote origin --remote-branch feat/TKT-31-mechanics >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'remote branch behind expected HEAD is refused' 2 "$?"

fresh_repo
add_remote
printf 'user change\n' >>"$REPO/base.txt"
printf 'user file\n' >"$REPO/user.txt"
preserved_repo=$REPO
preservation_record="$TEST_ROOT/preservation.tsv"
bash "$SCRIPT" inspect-repository --repo "$preserved_repo" --base main --ticket-key TKT-31 >"$preservation_record"
next_path
delivery_worktree=$NEW_PATH
git -C "$preserved_repo" worktree add -qb feat/TKT-31-preserved "$delivery_worktree" main
printf 'delivery\n' >"$delivery_worktree/delivery.txt"
git -C "$delivery_worktree" add delivery.txt
git -C "$delivery_worktree" commit -qm 'feat: deliver TKT-31'
delivery_head=$(git -C "$delivery_worktree" rev-parse HEAD)
git -C "$delivery_worktree" push -qu origin feat/TKT-31-preserved
worktree_git_dir=$(git -C "$delivery_worktree" rev-parse --git-dir)
: >"$worktree_git_dir/BISECT_LOG"
out=$(bash "$SCRIPT" inspect-repository --repo "$delivery_worktree" --base main --ticket-key TKT-31)
contains 'linked-worktree operation uses its own Git directory' "$out" "operation${TAB}bisect"
bash "$SCRIPT" verify-delivery --repo "$delivery_worktree" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-preserved --head "$delivery_head" --remote origin --remote-branch feat/TKT-31-preserved --preservation-record "$preservation_record" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'linked-worktree in-progress operation blocks delivery' 2 "$?"
rm "$worktree_git_dir/BISECT_LOG"
out=$(bash "$SCRIPT" verify-delivery --repo "$delivery_worktree" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-preserved --head "$delivery_head" --remote origin --remote-branch feat/TKT-31-preserved --preservation-record "$preservation_record")
check 'delivery verifies preserved original checkout' 0 "$?"
contains 'preservation record is counted' "$out" "preservation_records${TAB}1"
contains 'preservation is verified' "$out" "preservation_verified${TAB}true${TAB}$preserved_repo"
printf 'changed again\n' >>"$preserved_repo/base.txt"
bash "$SCRIPT" verify-delivery --repo "$delivery_worktree" --base main --base-oid "$BASE_OID" --branch feat/TKT-31-preserved --head "$delivery_head" --remote origin --remote-branch feat/TKT-31-preserved --preservation-record "$preservation_record" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'changed preserved checkout is refused' 2 "$?"

printf '# render-result success and refusal paths\n'
write_launch_record "$launch_record"
launch_before=$(cksum "$launch_record")
out=$(bash "$SCRIPT" render-result --ticket TKT-31 --outcome pr_created --verification 'current checks passed' --review 'omitted; not required for routine risk' --branch feat/TKT-31-mechanics --commit 0123456789012345678901234567890123456789 --remote-branch origin/feat/TKT-31-mechanics --pull-request https://example.invalid/pull/31 --preservation 'original checkout unchanged' --launch-record "$launch_record")
check 'successful result renders' 0 "$?"
contains 'canonical ticket line' "$out" 'Ticket: TKT-31'
contains 'canonical success evidence line' "$out" 'Outcome: pr_created. Review: omitted; not required for routine risk. Verification: current checks passed. Pull request: https://example.invalid/pull/31.'
contains 'durable branch renders' "$out" 'Branch: feat/TKT-31-mechanics.'
contains 'durable commit renders' "$out" 'Commit: 0123456789012345678901234567890123456789.'
contains 'durable remote branch renders' "$out" 'Remote branch: origin/feat/TKT-31-mechanics.'
contains 'preservation evidence renders' "$out" 'Preservation: original checkout unchanged.'
contains 'v4 launch record is preserved' "$out" "format${TAB}darrow-native-goal-preflight-v4"
case "$out" in
  "format${TAB}darrow-native-goal-preflight-v4"*"Ticket: TKT-31"*) check 'launch record precedes parent terminal lines' yes yes ;;
  *) check 'launch record precedes parent terminal lines' yes no ;;
esac
check 'rendering does not rewrite launch record' "$launch_before" "$(cksum "$launch_record")"

write_decision_record "$decision_record"
out=$(bash "$SCRIPT" render-result --ticket TKT-201 --outcome stopped --reason 'widget format is undecided' --next-action 'choose Markdown or HTML' --launch-record "$decision_record")
check 'decision-gated stopped result renders' 0 "$?"
contains 'decision record precedes exact parent terminal lines' "$out" "evaluation_human_interruptions${TAB}1
Ticket: TKT-201
Outcome: stopped."

no_newline_record="$TEST_ROOT/no-newline-launch-record.tsv"
launch_text=$(cat "$launch_record")
printf '%s' "$launch_text" >"$no_newline_record"
out=$(bash "$SCRIPT" render-result --ticket TKT-31 --outcome pr_created --verification passed --review clear --branch feat/TKT-31-mechanics --commit 0123456789012345678901234567890123456789 --remote-branch origin/feat/TKT-31-mechanics --pull-request https://example.invalid/pull/31 --launch-record "$no_newline_record")
check 'valid record without final newline renders' 0 "$?"
contains 'missing record newline does not merge the ticket line' "$out" "evaluation_human_interruptions${TAB}0
Ticket: TKT-31"

bad_launch_before=$(cksum "$bad_record")
out=$(bash "$SCRIPT" render-result --ticket TKT-31 --outcome blocked --reason 'launch record validation failed' --next-action 'repair the adaptive-goal integration' --unvalidated-launch-record "$bad_record")
check 'malformed launch record can render a blocked result' 0 "$?"
contains 'malformed launch record is explicitly unvalidated' "$out" "launch_record_validation${TAB}refused"
contains 'malformed launch record is preserved verbatim' "$out" "format${TAB}darrow-native-goal-preflight-v3"
contains 'unvalidated launch record has an end marker' "$out" 'launch_record_verbatim_end'
contains 'blocked terminal lines follow malformed launch evidence' "$out" 'Ticket: TKT-31
Outcome: blocked.'
check 'unvalidated rendering does not rewrite launch record' "$bad_launch_before" "$(cksum "$bad_record")"

out=$(bash "$SCRIPT" render-result --ticket TKT-31 --outcome blocked --review 'blocking authorization defect' --reason 'required review is unavailable' --next-action 'install a compatible reviewer' --branch feat/TKT-31-mechanics --commit 0123456789012345678901234567890123456789 --remote-branch origin/feat/TKT-31-mechanics)
check 'blocked result renders' 0 "$?"
contains 'canonical blocked review phrase' "$out" 'Outcome: blocked. Review: blocking authorization defect.'
contains 'blocked reason and next action render' "$out" 'Reason: required review is unavailable. Next action: install a compatible reviewer.'
not_contains 'prelaunch result has no invented record' "$out" 'darrow-native-goal-preflight-v4'

bash "$SCRIPT" render-result --ticket TKT-31 --outcome 'done' --reason nope --next-action none >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'unknown outcome is refused' 2 "$?"
bash "$SCRIPT" render-result --ticket TKT-31 --outcome pr_created --verification passed --review clear >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'success without pull request is refused' 2 "$?"
bash "$SCRIPT" render-result --ticket TKT-31 --outcome pr_existing --verification passed --review clear --pull-request https://example.invalid/pull/31 >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'success without durable Git state is refused' 2 "$?"
bash "$SCRIPT" render-result --ticket TKT-31 --outcome blocked --reason nope >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'non-success without next action is refused' 2 "$?"
newline_reason=$(printf 'line one\nline two')
bash "$SCRIPT" render-result --ticket TKT-31 --outcome blocked --reason "$newline_reason" --next-action stop >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'record-injection newline is refused' 2 "$?"
oid_41=01234567890123456789012345678901234567890
bash "$SCRIPT" render-result --ticket TKT-31 --outcome blocked --reason blocked --next-action retry --commit "$oid_41" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'noncanonical object-id length is refused' 2 "$?"
bash "$SCRIPT" render-result --ticket TKT-31 --outcome stopped --reason undecided --next-action decide --unvalidated-launch-record "$bad_record" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'unvalidated record is refused for stopped outcome' 2 "$?"
bash "$SCRIPT" render-result --ticket TKT-31 --outcome blocked --reason invalid --next-action retry --launch-record "$launch_record" --unvalidated-launch-record "$bad_record" >"$TEST_ROOT/out" 2>"$TEST_ROOT/err"
check 'validated and unvalidated launch options are mutually exclusive' 2 "$?"

printf '# prohibited effects remain absent\n'
if grep -E '(^|[^[:alnum:]_-])(gh|glab)[[:space:]]' "$SCRIPT" >/dev/null 2>&1; then
  check 'no hard-coded forge backend' absent present
else
  check 'no hard-coded forge backend' absent absent
fi
if grep -E 'git( -C "\$[^"]+")? (checkout|switch|commit|push|merge|rebase|reset|stash|clean)([[:space:]]|$)' "$SCRIPT" >/dev/null 2>&1; then
  check 'no Git mutation command' absent present
else
  check 'no Git mutation command' absent absent
fi

if test "$FAILURES" -gt 0; then
  printf 'FAIL: %s ticket-to-PR mechanics checks failed\n' "$FAILURES" >&2
  exit 1
fi
printf 'PASS: ticket-to-PR mechanics checks passed\n'
