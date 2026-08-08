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

out=$(bash "$goal_loop" route --host codex --profile standard)
contains "$out" $'profile\tstandard'
contains "$out" $'route\tcodex\topenai\tgpt-5.6-sol\tmedium'
contains "$out" $'route_source\tpolicy'

out=$(bash "$goal_loop" route --host claude --profile deep \
  --route 'claude|anthropic|claude-test|high')
contains "$out" $'route\tclaude\tanthropic\tclaude-test\thigh'
contains "$out" $'route_source\tuser'

if bash "$goal_loop" route --host codex --profile tiny >/dev/null 2>&1; then
  fail "invalid profile was accepted"
fi
if bash "$goal_loop" route --host codex --profile fast \
  --route 'claude|anthropic|wrong|low' >/dev/null 2>&1; then
  fail "foreign explicit route was accepted"
fi

fake_bin="$tmp_root/bin"
mkdir -p "$fake_bin"
cat >"$fake_bin/codex" <<'EOF'
#!/usr/bin/env bash
if test "${1:-}" = app-server && test "${2:-}" = --help; then exit 0; fi
printf 'codex-call\t%s\n' "$*"
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
contains "$out" $'route\tfast\tcodex\topenai\tgpt-5.6-terra\tlow'

goal_file="$tmp_root/goal.txt"
printf 'Implement the bounded change and run the focused test.\n' >"$goal_file"
out=$(PATH="$fake_bin:$PATH" bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --model codex-test --effort medium)
contains "$out" 'codex-call'
contains "$out" '--model codex-test'
contains "$out" '--sandbox workspace-write'

out=$(PATH="$fake_bin:$PATH" bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --model claude-test --effort high)
contains "$out" 'claude-call'
contains "$out" '/goal Implement the bounded change'
contains "$out" '--model claude-test --effort high'

large_goal="$tmp_root/large.txt"
dd if=/dev/zero bs=4001 count=1 2>/dev/null | tr '\000' x >"$large_goal"
if PATH="$fake_bin:$PATH" bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$large_goal" --model codex-test --effort medium >/dev/null 2>&1; then
  fail "oversized goal was accepted"
fi

printf 'ok - native goal preflight mechanics\n'
