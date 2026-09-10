#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
goal_loop="$script_dir/goal-loop"
tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-goal-loop-test.XXXXXX")

cleanup() {
  chmod -R u+rwX "$tmp_root" 2>/dev/null || true
  rm -rf "$tmp_root"
}
trap cleanup EXIT

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

out=$(bash "$goal_loop" prepare --repo "$repo" --host codex)
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

out=$(bash "$goal_loop" prepare --repo "$repo" --host claude)
contains "$out" $'route\troutine\tclaude\tanthropic\tclaude-sonnet-5\tlow'
contains "$out" $'route\tjudgment\tclaude\tanthropic\tclaude-opus-5\thigh'

out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile routine)
contains "$out" $'format\tdarrow-native-goal-route-v2'
contains "$out" $'profile\troutine'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route_source\tpolicy'
contains "$out" $'policy_route_source\tbundled'

mkdir -p "$repo/.darrow"
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"scaled","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"high","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile scaled)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\thigh'
contains "$out" $'policy_route_source\trepository'
out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile routine)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'policy_route_source\tbundled'

out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|gpt-future-off-catalog|ultra')
contains "$out" $'selected_route\tcodex\topenai\tgpt-future-off-catalog\tultra'
contains "$out" $'route_source\tuser'
case "$out" in
  *$'policy_route_source\t'*)
    fail "explicit user route retained policy provenance"
    ;;
esac

rejects bash "$goal_loop" route --repo "$repo" --host codex --profile scaled \
  --route 'claude|anthropic|claude-sonnet-5|low'
rejects bash "$goal_loop" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|anthropic|gpt-5.6-luna|high'
rejects bash "$goal_loop" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|none|none'
rejects bash "$goal_loop" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|gpt-5.6-luna|medium'
rejects bash "$goal_loop" route --repo "$repo" --host codex --profile scaled \
  --route 'codex|openai|gpt-5.6-luna|impossible'

cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"gpt-5.6-luna","effort":"medium","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
rejects bash "$goal_loop" prepare --repo "$repo" --host codex
rejects bash "$goal_loop" route --repo "$repo" --host codex --profile routine

printf '{malformed\n' >"$repo/.darrow/config.json"
rejects bash "$goal_loop" prepare --repo "$repo" --host codex
rm -f "$repo/.darrow/config.json"
ln -s "$script_dir/../config/routes.json" "$repo/.darrow/config.json"
rejects bash "$goal_loop" route --repo "$repo" --host codex --profile routine
rm -f "$repo/.darrow/config.json"

linked_repo="$tmp_root/linked-repo"
git -C "$repo" worktree add -q -b linked-goal-test "$linked_repo"
mkdir -p "$linked_repo/.darrow" "$linked_repo/nested"
cat >"$linked_repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"medium","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$(bash "$goal_loop" route --repo "$linked_repo/nested" --host codex \
  --profile routine)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'policy_route_source\trepository'
git -C "$repo" worktree remove --force "$linked_repo"

rejects bash "$goal_loop" step start --repo "$repo" --host codex
rejects bash "$goal_loop" materialize-objective --repo "$repo" --goal-file x
rejects bash "$goal_loop" launch --host codex

help=$(bash "$goal_loop" --help)
contains "$help" 'goal-loop prepare'
contains "$help" 'goal-loop route'
case "$help" in
  *'step '*|*'ledger'*|*'materialize'*|*'launch '*)
    fail "help exposed removed lifecycle commands"
    ;;
esac

printf 'ok - adaptive delivery preflight and route helper\n'
