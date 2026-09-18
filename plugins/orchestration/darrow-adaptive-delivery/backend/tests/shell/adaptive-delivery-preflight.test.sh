#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/../../.." && pwd)
preflight=(uv run --quiet --frozen --no-dev --project "$plugin_dir/backend" adaptive-delivery-preflight)
temp_parent=${TMPDIR:-/tmp}
tmp_root=$(mktemp -d "${temp_parent%/}/darrow-adaptive-delivery-test.XXXXXX")
tmp_root=$(CDPATH='' cd -- "$tmp_root" && pwd -P)

cleanup() {
  chmod -R u+rwX "$tmp_root" 2>/dev/null || true
  rm -rf "$tmp_root"
}
trap cleanup EXIT

# A PATH-selected Bash must not replace the matrix interpreter, even in a
# negative test whose expected failure could otherwise hide the mistake.
mkdir -p "$tmp_root/conflicting-bin"
export CONFLICTING_BASH_MARKER="$tmp_root/wrong-interpreter"
cat >"$tmp_root/conflicting-bin/bash" <<'EOF'
#!/bin/sh
: >"$CONFLICTING_BASH_MARKER"
exit 97
EOF
chmod +x "$tmp_root/conflicting-bin/bash"
export PATH="$tmp_root/conflicting-bin:$PATH"

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

contains() {
  case "$1" in
    *"$2"*) ;;
    *) fail "expected output to contain: $2" ;;
  esac
}

rejects() {
  if "$@" >/dev/null 2>&1; then
    fail "command unexpectedly succeeded: $*"
  fi
}

refuses() {
  expected_error=$1
  shift
  refusal_status=0
  "$@" >"$tmp_root/refusal.out" 2>"$tmp_root/refusal.err" || refusal_status=$?
  test "$refusal_status" -eq 2 || fail "expected refusal exit 2, got $refusal_status: $*"
  test ! -s "$tmp_root/refusal.out" || fail "refusal emitted prepared or selected evidence"
  contains "$(<"$tmp_root/refusal.err")" "$expected_error"
}

write_policy() {
  printf '{"routes":[{"host":"%s","profile":"routine","harness":"%s","provider":"%s","model":"%s","effort":"%s","fallbackModel":"none","fallbackEffort":"none"}]}\n' \
    "$1" "$2" "$3" "$4" "$5" >"$repo/.darrow/config.json"
}

repo="$tmp_root/repo"
mkdir -p "$repo"
git -C "$repo" init -q
git -C "$repo" config user.name Test
git -C "$repo" config user.email test@example.invalid
printf 'base\n' >"$repo/value.txt"
printf 'Root guidance.\n' >"$repo/AGENTS.md"
git -C "$repo" add value.txt AGENTS.md
git -C "$repo" commit -qm initial
printf 'changed\n' >"$repo/value.txt"

out=$("${preflight[@]}" prepare --repo "$repo" --host codex)
repo_abs=$(git -C "$repo" rev-parse --show-toplevel)
contains "$out" $'format\tdarrow-native-goal-prepared-v2'
contains "$out" $'repo\t'"$repo_abs"
contains "$out" $'working_tree\tdirty'
case "$out" in
  *$'preexisting_change\t'*) fail "prepare leaked relative porcelain paths" ;;
esac
contains "$out" $'instruction\t'"$repo_abs/AGENTS.md"
contains "$out" $'route\troutine\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route\troutine-plus\tcodex\topenai\tgpt-5.6-terra\thigh'
contains "$out" $'route\tscaled\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'route\trepo-wide\tcodex\topenai\tgpt-5.6-sol\thigh'
contains "$out" $'route\tjudgment\tcodex\topenai\tgpt-6-astra\thigh'
contains "$out" $'workflow\tfix-bug\t'
contains "$out" $'workflow\timplement-feature\t'
contains "$out" $'workflow\tmigration\t'
contains "$out" $'workflow\tmechanical\t'
case "$out" in
  *'ledger'*|*'materialize'*|*'goal-objective'*)
    fail "prepared evidence exposed removed lifecycle mechanics"
    ;;
esac

out=$("${preflight[@]}" prepare --repo "$repo" --host claude)
contains "$out" $'route\troutine\tclaude\tanthropic\tclaude-sonnet-5\tlow'
contains "$out" $'route\tjudgment\tclaude\tanthropic\tclaude-opus-5\thigh'

out=$("${preflight[@]}" route --repo "$repo" --host codex --profile routine)
contains "$out" $'format\tdarrow-native-goal-route-v2'
contains "$out" $'profile\troutine'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route_source\tpolicy'
contains "$out" $'policy_route_source\tbundled'

mkdir -p "$repo/.darrow"
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"scaled","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"high","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$("${preflight[@]}" route --repo "$repo" --host codex --profile scaled)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\thigh'
contains "$out" $'policy_route_source\trepository'
out=$("${preflight[@]}" route --repo "$repo" --host codex --profile routine)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'policy_route_source\tbundled'

out=$("${preflight[@]}" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|gpt-future-off-catalog|ultra')
contains "$out" $'selected_route\tcodex\topenai\tgpt-future-off-catalog\tultra'
contains "$out" $'route_source\tuser'
case "$out" in
  *$'policy_route_source\t'*)
    fail "explicit user route retained policy provenance"
    ;;
esac

rejects "${preflight[@]}" route --repo "$repo" --host codex --profile scaled \
  --route 'claude|anthropic|claude-sonnet-5|low'
rejects "${preflight[@]}" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|anthropic|gpt-5.6-luna|high'
rejects "${preflight[@]}" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|none|none'
rejects "${preflight[@]}" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|gpt-5.6-luna|medium'
rejects "${preflight[@]}" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|gpt-5.6-luna|impossible'

cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"gpt-5.6-luna","effort":"medium","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
rejects "${preflight[@]}" prepare --repo "$repo" --host codex
rejects "${preflight[@]}" route --repo "$repo" --host codex --profile routine

# Policy and explicit inputs must reject the same invalid semantic tuples.
while IFS='|' read -r route_host route_harness route_provider route_model route_effort; do
  write_policy "$route_host" "$route_harness" "$route_provider" "$route_model" "$route_effort"
  refuses 'adaptive-delivery-preflight:' "${preflight[@]}" route \
    --repo "$repo" --host "$route_host" --profile routine \
    --route "$route_harness|$route_provider|$route_model|$route_effort"
  refuses 'adaptive-delivery-preflight:' "${preflight[@]}" route \
    --repo "$repo" --host "$route_host" --profile routine
  refuses 'adaptive-delivery-preflight:' "${preflight[@]}" prepare \
    --repo "$repo" --host "$route_host"
done <<'EOF'
codex|codex|anthropic|gpt-5.6-terra|medium
claude|claude|openai|claude-sonnet-5|low
codex|claude|anthropic|claude-sonnet-5|low
claude|codex|openai|gpt-5.6-terra|medium
codex|codex|openai|none|medium
claude|claude|anthropic|none|low
codex|codex|openai|gpt-5.6-terra|impossible
claude|claude|anthropic|claude-sonnet-5|none
codex|codex|openai|unsafe model|medium
codex|codex|openai|.unsafe|medium
codex|codex|openai||medium
EOF

# Preserve every supported effort and valid off-catalog models for both hosts.
for route_host in codex claude; do
  case "$route_host" in
    codex) route_provider=openai ;;
    claude) route_provider=anthropic ;;
  esac
  for route_effort in low medium high xhigh max ultra; do
    write_policy "$route_host" "$route_host" "$route_provider" future-model.1 "$route_effort"
    expected_tuple="$route_host"$'\t'"$route_provider"$'\t'"future-model.1"$'\t'"$route_effort"
    out=$("${preflight[@]}" prepare --repo "$repo" --host "$route_host")
    contains "$out" $'route\troutine\t'"$expected_tuple"
    out=$("${preflight[@]}" route --repo "$repo" --host "$route_host" --profile routine)
    contains "$out" $'selected_route\t'"$expected_tuple"
    contains "$out" $'policy_route_source\trepository'
    out=$("${preflight[@]}" route --repo "$repo" --host "$route_host" --profile routine \
      --route "$route_host|$route_provider|future-model.1|$route_effort")
    contains "$out" $'selected_route\t'"$expected_tuple"
    contains "$out" $'route_source\tuser'
  done
done

printf '{malformed\n' >"$repo/.darrow/config.json"
rejects "${preflight[@]}" prepare --repo "$repo" --host codex
rm -f "$repo/.darrow/config.json"
ln -s "$plugin_dir/config/routes.json" "$repo/.darrow/config.json"
rejects "${preflight[@]}" route --repo "$repo" --host codex --profile routine
rm -f "$repo/.darrow/config.json"

linked_repo="$tmp_root/linked-repo"
git -C "$repo" worktree add -q -b linked-goal-test "$linked_repo"
mkdir -p "$linked_repo/.darrow" "$linked_repo/nested"
cat >"$linked_repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"medium","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$("${preflight[@]}" route --repo "$linked_repo/nested" --host codex \
  --profile routine)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'policy_route_source\trepository'

# A second committed repository must never supply A's identity or evidence.
other_repo="$tmp_root/other repo"
mkdir -p "$other_repo" "$repo/nested"
git -C "$other_repo" init -q
git -C "$other_repo" config user.name Test
git -C "$other_repo" config user.email test@example.invalid
printf 'other\n' >"$other_repo/other.txt"
git -C "$other_repo" add other.txt
git -C "$other_repo" commit -qm other
printf '[invalid\n' >"$tmp_root/foreign-git-config"

assert_requested_repo() {
  out=$(env "$@" "${preflight[@]}" prepare --repo "$requested_repo/nested" --host codex)
  contains "$out" $'repo\t'"$requested_repo"
  contains "$out" $'base_revision\t'"$requested_revision"
  contains "$out" $'working_tree\tdirty'
  contains "$out" $'instruction\t'"$requested_repo/AGENTS.md"
  contains "$out" $'route\troutine\tcodex\topenai\t'"$requested_model"$'\tmedium'
  out=$(env "$@" "${preflight[@]}" route --repo "$requested_repo/nested" --host codex --profile routine)
  contains "$out" $'selected_route\tcodex\topenai\t'"$requested_model"$'\tmedium'
}

for requested_repo in "$repo_abs" "$linked_repo"; do
  requested_revision=$(git -C "$requested_repo" rev-parse HEAD)
  case "$requested_repo" in
    "$repo_abs") requested_model=gpt-5.6-terra ;;
    *) requested_model=gpt-5.6-sol ;;
  esac
  assert_requested_repo "GIT_DIR=$other_repo/.git" "GIT_WORK_TREE=$other_repo"
  assert_requested_repo "GIT_DIR=$other_repo/.git"
  assert_requested_repo "GIT_WORK_TREE=$other_repo"
  assert_requested_repo "GIT_COMMON_DIR=$other_repo/.git"
  assert_requested_repo "GIT_INDEX_FILE=$other_repo/.git/index"
  assert_requested_repo "GIT_OBJECT_DIRECTORY=$other_repo/.git/objects" \
    "GIT_ALTERNATE_OBJECT_DIRECTORIES=$tmp_root/missing-objects"
  assert_requested_repo "GIT_CEILING_DIRECTORIES=$requested_repo"
  assert_requested_repo GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.worktree "GIT_CONFIG_VALUE_0=$other_repo"
  assert_requested_repo "GIT_CONFIG_PARAMETERS='core.bare=true'"
  assert_requested_repo "GIT_CONFIG_GLOBAL=$tmp_root/foreign-git-config"
  assert_requested_repo "GIT_CONFIG_SYSTEM=$tmp_root/foreign-git-config"
done

bare_repo="$tmp_root/bare.git"
git init --bare -q "$bare_repo"
for invalid_repo in "$bare_repo" "$repo/.git" "$tmp_root"; do
  refuses 'not a git working tree:' env "GIT_DIR=$other_repo/.git" "GIT_WORK_TREE=$other_repo" \
    "${preflight[@]}" prepare --repo "$invalid_repo" --host codex
  refuses 'not a git working tree:' "${preflight[@]}" route \
    --repo "$invalid_repo" --host codex --profile routine
done

# A successful Git exit with false output is still outside a working tree;
# a failed status must not be turned into clean prepared evidence.
mkdir -p "$tmp_root/git-bin"
export PREFLIGHT_TEST_GIT
PREFLIGHT_TEST_GIT=$(command -v git)
cat >"$tmp_root/git-bin/git" <<'EOF'
#!/bin/sh
case "$*" in
  *'rev-parse --is-inside-work-tree')
    if [ "$PREFLIGHT_TEST_FAILURE" = outside ]; then
      printf 'false\n'
      exit 0
    fi
    ;;
  *'status --porcelain=v1'*)
    if [ "$PREFLIGHT_TEST_FAILURE" = status ]; then
      exit 1
    fi
    ;;
esac
exec "$PREFLIGHT_TEST_GIT" "$@"
EOF
chmod +x "$tmp_root/git-bin/git"
refuses 'not a git working tree:' env "PATH=$tmp_root/git-bin:$PATH" PREFLIGHT_TEST_FAILURE=outside \
  "${preflight[@]}" prepare --repo "$repo" --host codex
refuses 'cannot read working tree state:' env "PATH=$tmp_root/git-bin:$PATH" PREFLIGHT_TEST_FAILURE=status \
  "${preflight[@]}" prepare --repo "$repo" --host codex

git -C "$repo" worktree remove --force "$linked_repo"

rejects "${preflight[@]}" step start --repo "$repo" --host codex
rejects "${preflight[@]}" materialize-objective --repo "$repo" --goal-file x
rejects "${preflight[@]}" launch --host codex

help=$("${preflight[@]}" --help)
contains "$help" 'adaptive-delivery-preflight prepare'
contains "$help" 'adaptive-delivery-preflight route'
case "$help" in
  *'step '*|*'ledger'*|*'materialize'*|*'launch '*)
    fail "help exposed removed lifecycle commands"
    ;;
esac

test ! -e "$CONFLICTING_BASH_MARKER" || fail "test invoked PATH-selected Bash"
printf 'ok - adaptive delivery preflight and route helper\n'
