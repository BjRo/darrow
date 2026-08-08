#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
goal_loop="$script_dir/goal-loop"
tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-native-goal.XXXXXX")

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

test ! -e "$script_dir/../config/routes.gpt-5.6-candidate.tsv" ||
  fail "candidate route configuration still exists"

repo="$tmp_root/repo"
mkdir -p "$repo"
git -C "$repo" init -q
git -C "$repo" config user.name Test
git -C "$repo" config user.email test@example.invalid
printf 'base\n' >"$repo/value.txt"
git -C "$repo" add value.txt
git -C "$repo" commit -qm initial

out=$(bash "$goal_loop" preflight --repo "$repo")
contains "$out" $'format\tdarrow-native-goal-preflight-evidence-v1'
contains "$out" $'working_tree\tclean'
printf 'changed\n' >"$repo/value.txt"
out=$(bash "$goal_loop" preflight --repo "$repo")
contains "$out" $'working_tree\tdirty'
contains "$out" $'preexisting_change\t M value.txt'

printf 'Root guidance.\n' >"$repo/AGENTS.md"
out=$(bash "$goal_loop" prepare --repo "$repo" --host codex)
contains "$out" $'format\tdarrow-native-goal-prepared-v1'
repo_abs=$(CDPATH= cd -- "$repo" && pwd)
contains "$out" $'instruction\t'"$repo_abs/AGENTS.md"
contains "$out" $'route\troutine\tcodex\topenai\tgpt-5.6-luna\thigh'
contains "$out" $'route\troutine-plus\tcodex\topenai\tgpt-5.6-luna\txhigh'
contains "$out" $'route\tscaled\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route\trepo-wide\tcodex\topenai\tgpt-5.6-terra\thigh'
contains "$out" $'route\tjudgment\tcodex\topenai\tgpt-5.6-sol\thigh'
contains "$out" $'workflow\tfix-bug\t'
contains "$out" $'workflow\timplement-feature\t'
contains "$out" $'workflow\tchange-feature\t'
contains "$out" $'workflow\trefactor\t'
contains "$out" 'references/workflows/fix-bug.md'
contains "$out" 'references/workflows/implement-feature.md'
contains "$out" 'references/workflows/change-feature.md'
contains "$out" 'references/workflows/refactor.md'
contains "$out" $'risk\troutine\t'
contains "$out" $'risk\televated\t'
contains "$out" $'risk\thigh\t'

out=$(bash "$goal_loop" prepare --repo "$repo" --host claude)
contains "$out" $'route\troutine\tclaude\tanthropic\tclaude-haiku-4-5\tlow'
contains "$out" $'route\troutine-plus\tclaude\tanthropic\tclaude-sonnet-5\tmedium'
contains "$out" $'route\tscaled\tclaude\tanthropic\tclaude-sonnet-5\tmedium'
contains "$out" $'route\trepo-wide\tclaude\tanthropic\tclaude-opus-5\thigh'
contains "$out" $'route\tjudgment\tclaude\tanthropic\tclaude-opus-5\thigh'

out=$(bash "$goal_loop" route --host codex --profile routine)
contains "$out" $'profile\troutine'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-luna\thigh'

if bash "$goal_loop" prepare --repo "$repo" --host codex \
  --policy candidate >/dev/null 2>&1; then
  fail "removed route policy switch was accepted"
fi

out=$(bash "$goal_loop" route --host codex --profile scaled)
contains "$out" $'format\tdarrow-native-goal-route-v2'
contains "$out" $'profile\tscaled'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route_source\tpolicy'

out=$(bash "$goal_loop" confirm-route \
  --selected 'codex|openai|gpt-5.6-sol|medium' \
  --effective 'codex|openai|gpt-5.6-sol|medium' \
  --applied-by current-thread)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'effective_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'route_applied_by\tcurrent-thread'
contains "$out" $'route_verified\ttrue'

if bash "$goal_loop" confirm-route \
  --selected 'codex|openai|gpt-5.6-sol|high' \
  --effective 'codex|openai|gpt-5.6-sol|medium' \
  --applied-by current-thread >/dev/null 2>&1; then
  fail "mismatched selected and effective routes were accepted"
fi

out=$(bash "$goal_loop" route --host claude --profile judgment \
  --route 'claude|anthropic|claude-test|high')
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-test\thigh'
contains "$out" $'route_source\tuser'

if bash "$goal_loop" route --host codex --profile tiny >/dev/null 2>&1; then
  fail "invalid profile was accepted"
fi
if bash "$goal_loop" route --host codex --profile routine \
  --route 'claude|anthropic|wrong|low' >/dev/null 2>&1; then
  fail "foreign explicit route was accepted"
fi

fake_bin="$tmp_root/bin"
mkdir -p "$fake_bin"
cat >"$fake_bin/codex" <<'EOF'
#!/usr/bin/env bash
if test "${1:-}" = app-server && test "${2:-}" = --help; then exit 0; fi
test -n "${FAKE_CODEX_ARGS:-}" && printf '%s\n' "$*" >"$FAKE_CODEX_ARGS"
output_file=
while test "$#" -gt 0; do
  if test "$1" = -o; then
    output_file=$2
    shift 2
  else
    shift
  fi
done
test -n "$output_file" || exit 9
printf 'nested-final\n' >"$output_file"
printf '%s\n' '{"type":"item.completed","item":{"type":"agent_message","text":"discarded-noise"}}'
printf '%s\n' '{"type":"turn.completed","usage":{"input_tokens":100,"output_tokens":20}}'
EOF
cat >"$fake_bin/claude" <<'EOF'
#!/usr/bin/env bash
printf 'claude-call\t%s\n' "$*"
EOF
chmod +x "$fake_bin/codex" "$fake_bin/claude"

out=$(PATH="$fake_bin:$PATH" bash "$goal_loop" readiness --host codex)
contains "$out" $'capability\tsame_thread_goal\tcontroller_must_confirm'
contains "$out" $'capability\thost_api\tinstalled_unbound\tcodex app-server'
contains "$out" $'capability\tnested_session\tinstalled_unverified'
contains "$out" $'route\troutine\tcodex\topenai\tgpt-5.6-luna\thigh'

goal_file="$tmp_root/goal.txt"
printf 'Implement the bounded change and run the focused test.\n' >"$goal_file"
codex_args="$tmp_root/codex-args.txt"
out=$(FAKE_CODEX_ARGS="$codex_args" PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --provider openai --model codex-test --effort medium)
contains "$out" $'format\tdarrow-native-goal-route-application-v1'
contains "$out" $'selected_route\tcodex\topenai\tcodex-test\tmedium'
contains "$out" $'effective_route\tcodex\topenai\tcodex-test\tmedium'
contains "$out" $'route_applied_by\tnested-session'
contains "$out" $'route_verified\ttrue'
contains "$out" $'nested_result_begin\nnested-final'
contains "$out" 'nested_result_end'
contains "$out" '"type":"turn.completed"'
args=$(cat "$codex_args")
contains "$args" '--model codex-test'
contains "$args" '--json'
contains "$args" '--sandbox workspace-write'

out=$(DARROW_GOAL_LOOP_EXTERNAL_SANDBOX=1 FAKE_CODEX_ARGS="$codex_args" PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --provider openai --model codex-test --effort medium)
args=$(cat "$codex_args")
contains "$args" '--dangerously-bypass-approvals-and-sandbox'

out=$(PATH="$fake_bin:$PATH" bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider anthropic --model claude-test --effort high)
contains "$out" 'claude-call'
contains "$out" '/goal Implement the bounded change'
contains "$out" '--model claude-test --effort high'

large_goal="$tmp_root/large.txt"
dd if=/dev/zero bs=4001 count=1 2>/dev/null | tr '\000' x >"$large_goal"
if PATH="$fake_bin:$PATH" bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$large_goal" --provider openai --model codex-test --effort medium >/dev/null 2>&1; then
  fail "oversized goal was accepted"
fi

printf 'ok - native goal preflight mechanics\n'
