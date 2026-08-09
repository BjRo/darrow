#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
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
test ! -e "$script_dir/../config/routes.tsv" ||
  fail "TSV route configuration still exists"
test ! -e "$script_dir/../config/risks.tsv" ||
  fail "duplicate risk configuration still exists"
test -r "$script_dir/../config/routes.json" ||
  fail "JSON route configuration is missing"

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
repo_abs=$(git -C "$repo" rev-parse --show-toplevel)
contains "$out" $'instruction\t'"$repo_abs/AGENTS.md"
contains "$out" $'route\troutine\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route\troutine-plus\tcodex\topenai\tgpt-5.6-terra\thigh'
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
case "$out" in
  *$'\nrisk\t'*) fail "prepared evidence still duplicates risk guidance" ;;
esac

out=$(bash "$goal_loop" prepare --repo "$repo" --host claude)
contains "$out" $'route\troutine\tclaude\tanthropic\tclaude-sonnet-5\tlow'
contains "$out" $'route\troutine-plus\tclaude\tanthropic\tclaude-sonnet-5\tmedium'
contains "$out" $'route\tscaled\tclaude\tanthropic\tclaude-sonnet-5\tmedium'
contains "$out" $'route\trepo-wide\tclaude\tanthropic\tclaude-opus-5\thigh'
contains "$out" $'route\tjudgment\tclaude\tanthropic\tclaude-opus-5\thigh'

out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile routine)
contains "$out" $'profile\troutine'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route_source\tpolicy'
contains "$out" $'policy_route_source\tbundled'

mkdir -p "$repo/.darrow"
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"scaled","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"high","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$(bash "$goal_loop" prepare --repo "$repo" --host codex)
contains "$out" $'route\troutine\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route_policy_source\troutine\tbundled'
contains "$out" $'route\tscaled\tcodex\topenai\tgpt-5.6-sol\thigh'
contains "$out" $'route_policy_source\tscaled\trepository'
out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile scaled)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\thigh'
contains "$out" $'route_source\tpolicy'
contains "$out" $'policy_route_source\trepository'
out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile routine \
  --route 'codex|openai|gpt-5.6-terra|low')
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tlow'
contains "$out" $'route_source\tuser'
case "$out" in
  *$'policy_route_source\t'*) fail "user route disclosed a policy provenance" ;;
esac

printf '{malformed' >"$repo/.darrow/config.json"
if bash "$goal_loop" route --repo "$repo" --host codex --profile routine \
  >/dev/null 2>&1; then
  fail "malformed repository route configuration fell back to bundled policy"
fi
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"unknown","profile":"routine","harness":"unknown","provider":"openai","model":"test","effort":"low","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
if bash "$goal_loop" prepare --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "unknown repository route configuration fell back to bundled policy"
fi
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"unknown","harness":"codex","provider":"openai","model":"test","effort":"low","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
if bash "$goal_loop" route --repo "$repo" --host codex --profile routine \
  >/dev/null 2>&1; then
  fail "unknown repository profile fell back to bundled policy"
fi
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"claude","provider":"openai","model":"test","effort":"low","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
if bash "$goal_loop" route --repo "$repo" --host codex --profile routine \
  >/dev/null 2>&1; then
  fail "host-inconsistent repository route configuration was accepted"
fi
cat >"$repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"one","effort":"low","fallbackModel":"none","fallbackEffort":"none"},{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"two","effort":"low","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
if bash "$goal_loop" prepare --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "duplicate repository route configuration fell back to bundled policy"
fi
rm -f "$repo/.darrow/config.json"
mkdir "$repo/.darrow/config.json"
if bash "$goal_loop" route --repo "$repo" --host codex --profile routine \
  >/dev/null 2>&1; then
  fail "unreadable repository route configuration fell back to bundled policy"
fi
rm -rf "$repo/.darrow/config.json"
ln -s "$script_dir/../config/routes.json" "$repo/.darrow/config.json"
if bash "$goal_loop" prepare --repo "$repo" --host codex >/dev/null 2>&1; then
  fail "unsafe repository route configuration fell back to bundled policy"
fi
rm -f "$repo/.darrow/config.json"

linked_repo="$tmp_root/linked-repo"
git -C "$repo" worktree add -q -b linked-route-test "$linked_repo"
linked_repo_abs=$(git -C "$linked_repo" rev-parse --show-toplevel)
mkdir -p "$linked_repo/.darrow" "$linked_repo/nested"
cat >"$linked_repo/.darrow/config.json" <<'EOF'
{"routes":[{"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"gpt-5.6-sol","effort":"medium","fallbackModel":"none","fallbackEffort":"none"}]}
EOF
out=$(bash "$goal_loop" prepare --repo "$linked_repo/nested" --host codex)
contains "$out" $'repo\t'"$linked_repo_abs"
contains "$out" $'route\troutine\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'route_policy_source\troutine\trepository'
out=$(bash "$goal_loop" route --repo "$linked_repo/nested" --host codex --profile routine)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'policy_route_source\trepository'
git -C "$repo" worktree remove --force "$linked_repo"

parser="$script_dir/routes-json.awk"
reordered_routes="$tmp_root/reordered-routes.json"
cat >"$reordered_routes" <<'EOF'
{
  "routes": [
    {
      "effort": "medium",
      "model": "gpt-5.6-terra",
      "provider": "openai",
      "harness": "codex",
      "profile": "routine",
      "host": "codex",
      "fallbackEffort": "none",
      "fallbackModel": "none"
    }
  ]
}
EOF
out=$(awk -f "$parser" "$reordered_routes")
contains "$out" $'codex\troutine\tcodex\topenai\tgpt-5.6-terra\tmedium\tnone\tnone'

invalid_routes="$tmp_root/invalid-routes.json"
printf '{"routes":[{"host":"codex"}]}' >"$invalid_routes"
if awk -f "$parser" "$invalid_routes" >/dev/null 2>&1; then
  fail "incomplete JSON route configuration was accepted"
fi

duplicate_routes="$tmp_root/duplicate-routes.json"
cat >"$duplicate_routes" <<'EOF'
{
  "routes": [
    {"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"one","effort":"high","fallbackModel":"none","fallbackEffort":"none"},
    {"host":"codex","profile":"routine","harness":"codex","provider":"openai","model":"two","effort":"high","fallbackModel":"none","fallbackEffort":"none"}
  ]
}
EOF
if awk -f "$parser" "$duplicate_routes" >/dev/null 2>&1; then
  fail "duplicate JSON routes were accepted"
fi

broken_plugin="$tmp_root/broken-plugin"
mkdir -p "$broken_plugin/bin" "$broken_plugin/config"
cp "$goal_loop" "$parser" "$broken_plugin/bin/"
cp "$invalid_routes" "$broken_plugin/config/routes.json"
if bash "$broken_plugin/bin/goal-loop" route --repo "$repo" --host codex --profile routine \
  >/dev/null 2>&1; then
  fail "goal-loop accepted an invalid JSON route configuration"
fi

if bash "$goal_loop" prepare --repo "$repo" --host codex \
  --policy candidate >/dev/null 2>&1; then
  fail "removed route policy switch was accepted"
fi

out=$(bash "$goal_loop" route --repo "$repo" --host codex --profile scaled)
contains "$out" $'format\tdarrow-native-goal-route-v2'
contains "$out" $'profile\tscaled'
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-terra\tmedium'
contains "$out" $'route_source\tpolicy'
contains "$out" $'policy_route_source\tbundled'

out=$(bash "$goal_loop" confirm-route \
  --selected 'codex|openai|gpt-5.6-sol|medium' \
  --effective 'codex|openai|gpt-5.6-sol|medium' \
  --applied-by current-thread)
contains "$out" $'selected_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'effective_route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'route_applied_by\tcurrent-thread'
contains "$out" $'route_verified\ttrue'

out=$(bash "$goal_loop" confirm-route \
  --selected 'codex|openai|gpt-5.6-sol|high' \
  --effective 'codex|openai|gpt-5.6-sol|high' \
  --applied-by native-subagent)
contains "$out" $'route_applied_by\tnative-subagent'
contains "$out" $'route_verified\ttrue'

if bash "$goal_loop" confirm-route \
  --selected 'codex|openai|gpt-5.6-sol|high' \
  --effective 'codex|openai|gpt-5.6-sol|medium' \
  --applied-by current-thread >/dev/null 2>&1; then
  fail "mismatched selected and effective routes were accepted"
fi

out=$(bash "$goal_loop" route --repo "$repo" --host claude --profile judgment \
  --route 'claude|anthropic|claude-test|high')
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-test\thigh'
contains "$out" $'route_source\tuser'

if bash "$goal_loop" route --repo "$repo" --host codex --profile tiny >/dev/null 2>&1; then
  fail "invalid profile was accepted"
fi
if bash "$goal_loop" route --repo "$repo" --host codex --profile routine \
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
test -n "${FAKE_CLAUDE_ARGS:-}" && printf '%s\n' "$*" >"$FAKE_CLAUDE_ARGS"
printf 'claude-call\t%s\n' "$*"
exit "${FAKE_CLAUDE_EXIT:-0}"
EOF
chmod +x "$fake_bin/codex" "$fake_bin/claude"

goal_file="$tmp_root/goal.txt"
printf 'Implement the bounded change and run the focused test.\n' >"$goal_file"
codex_args="$tmp_root/codex-args.txt"
if launch_error=$(FAKE_CODEX_ARGS="$codex_args" PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --provider openai --model codex-test --effort medium 2>&1); then
  fail "nested Codex launch did not require explicit opt-in"
fi
contains "$launch_error" 'launch requires explicit --allow-nested'
test ! -e "$codex_args" || fail "refused nested launch still invoked Codex"

out=$(FAKE_CODEX_ARGS="$codex_args" PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --provider openai --model codex-test --effort medium \
  --allow-nested)
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
  --goal-file "$goal_file" --provider openai --model codex-test --effort medium \
  --allow-nested)
args=$(cat "$codex_args")
contains "$args" '--dangerously-bypass-approvals-and-sandbox'

claude_args="$tmp_root/claude-args.txt"
if launch_error=$(FAKE_CLAUDE_ARGS="$claude_args" PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider anthropic --model claude-test --effort high 2>&1); then
  fail "nested Claude launch did not require explicit opt-in"
fi
contains "$launch_error" 'launch requires explicit --allow-nested'
test ! -e "$claude_args" || fail "refused nested launch still invoked Claude"

out=$(FAKE_CLAUDE_ARGS="$claude_args" PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider anthropic --model claude-test --effort high \
  --allow-nested)
contains "$out" 'claude-call'
contains "$out" '/goal Implement the bounded change'
contains "$out" '--model claude-test --effort high'
contains "$out" $'selected_route\tclaude\tanthropic\tclaude-test\thigh'
contains "$out" $'effective_route\tclaude\tanthropic\tclaude-test\thigh'
contains "$out" $'route_applied_by\tnested-session'
contains "$out" $'route_verified\ttrue'

if failed_launch=$(FAKE_CLAUDE_EXIT=7 PATH="$fake_bin:$PATH" \
  bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider anthropic --model claude-test --effort high \
  --allow-nested 2>&1); then
  fail "nested Claude failure was reported as successful"
fi
case "$failed_launch" in
  *$'route_verified\ttrue'*) fail "failed nested Claude launch emitted verified route" ;;
esac

large_goal="$tmp_root/large.txt"
dd if=/dev/zero bs=4001 count=1 2>/dev/null | tr '\000' x >"$large_goal"
if PATH="$fake_bin:$PATH" bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$large_goal" --provider openai --model codex-test --effort medium \
  --allow-nested >/dev/null 2>&1; then
  fail "oversized goal was accepted"
fi

printf 'ok - native goal preflight mechanics\n'
