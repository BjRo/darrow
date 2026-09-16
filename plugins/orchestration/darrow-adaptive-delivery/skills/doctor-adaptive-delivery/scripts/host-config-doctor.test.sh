#!/usr/bin/env bash
set -eu

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
doctor=$script_dir/host-config-doctor
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template=/darrow-host-doctor.XXXXXX ;;
  */) temp_template=${temp_parent}darrow-host-doctor.XXXXXX ;;
  *) temp_template=${temp_parent}/darrow-host-doctor.XXXXXX ;;
esac
work_dir=$(mktemp -d "$temp_template") || exit 1
work_dir=$(cd "$work_dir" && pwd -P) || exit 1
trap 'chmod -R u+rw "$work_dir" 2>/dev/null || :; rm -rf "$work_dir"' EXIT HUP INT TERM

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_has() { case "$1" in *"$2"*) ;; *) fail "expected [$2] in output: $1" ;; esac; }
run_ok() { output=$("$BASH" "$doctor" "$@") || fail "expected success: $*"; }
run_fail() { if output=$("$BASH" "$doctor" "$@" 2>&1); then fail "expected failure: $*"; fi; }

mkdir -p "$work_dir/codex-home"
cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
enabled = true
max_concurrent_threads_per_session = 5
max_depth = 1
EOF
run_ok codex --config "$work_dir/codex-home/config.toml" --backend v2 --context effective
assert_has "$output" "configuration_source: $work_dir/codex-home/config.toml"
assert_has "$output" "configuration_context: effective"
assert_has "$output" "concurrency: adequate (5; full path requires 5)"
assert_has "$output" "nesting: not-applicable (agents.max_depth=1 is V1-only and ignored by V2)"
assert_has "$output" "baseline_owner_only: supported"
assert_has "$output" "full_required_assessment: supported"

cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
enabled = false
max_concurrent_threads_per_session = 99
EOF
run_ok codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "delegation: disabled"
assert_has "$output" "baseline_owner_only: unsupported"

cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
enabled = true
max_concurrent_threads_per_session = 4
EOF
run_ok codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "concurrency: inadequate (4; baseline requires 1, full path requires 5)"
assert_has "$output" "baseline_owner_only: supported"
assert_has "$output" "full_required_assessment: unsupported"

cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
max_concurrent_threads_per_session = nope
EOF
run_fail codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "status: malformed"

cp "$script_dir/../../../.codex-plugin/plugin.json" "$work_dir/codex-home/config.toml"
run_fail codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "status: malformed"

cp "$script_dir/../evals/direct-codex.yaml" "$work_dir/codex-home/config.toml"
run_fail codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "status: malformed"

cat >"$work_dir/codex-home/config.toml" <<'EOF'
model = "gpt-test"
experimental_values = [
  ["one ] bracket"],
  ["two"]]
instructions = """
Keep this valid multiline TOML.
"""
[agents]
enabled = false
max_concurrent_threads_per_session = 5
EOF
run_ok codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "status: valid"
assert_has "$output" "delegation: disabled"

rm "$work_dir/codex-home/config.toml"
run_ok codex --config "$work_dir/codex-home/config.toml" --backend v2 --context isolated-eval
assert_has "$output" "status: absent"
assert_has "$output" "configuration_context: isolated-eval"
assert_has "$output" "checkout_config_used: no"

mkdir -p "$work_dir/checkout/.codex"
cat >"$work_dir/checkout/.codex/config.toml" <<'EOF'
[agents]
max_concurrent_threads_per_session = 99
EOF
cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
max_concurrent_threads_per_session = 4
EOF
old_pwd=$PWD
cd "$work_dir/checkout"
CODEX_HOME="$work_dir/codex-home" run_ok codex --backend v2 --context isolated-eval
cd "$old_pwd"
assert_has "$output" "configuration_source: $work_dir/codex-home/config.toml"
assert_has "$output" "concurrency: inadequate (4; baseline requires 1, full path requires 5)"
case "$output" in *"concurrency: adequate (99"*) fail "checkout config was mistaken for isolated CODEX_HOME" ;; esac

cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
enabled = true
EOF
chmod 000 "$work_dir/codex-home/config.toml"
run_fail codex --config "$work_dir/codex-home/config.toml" --backend v2
assert_has "$output" "status: unreadable"
chmod 600 "$work_dir/codex-home/config.toml"

mkdir "$work_dir/real-home"
cat >"$work_dir/real-home/config.toml" <<'EOF'
[agents]
max_concurrent_threads_per_session = 5
EOF
ln -s "$work_dir/real-home/config.toml" "$work_dir/config-link.toml"
run_ok codex --config "$work_dir/config-link.toml" --backend v2
assert_has "$output" "configuration_source: $work_dir/config-link.toml"

cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
enabled = true
max_concurrent_threads_per_session = 5
EOF
run_ok codex --config "$work_dir/codex-home/config.toml" --backend v1
assert_has "$output" "nesting: unknown (agents.max_depth is unset)"
assert_has "$output" "baseline_owner_only: unknown"
assert_has "$output" "full_required_assessment: unknown"

cat >"$work_dir/codex-home/config.toml" <<'EOF'
[agents]
enabled = true
max_concurrent_threads_per_session = 5
max_depth = 4
EOF
run_ok codex --config "$work_dir/codex-home/config.toml" --backend unknown
assert_has "$output" "nesting: unknown (backend was not established; max_depth applies only to V1)"
assert_has "$output" "baseline_owner_only: unknown"
assert_has "$output" "full_required_assessment: unknown"

CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=5 CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=4 \
  run_ok claude --version 2.1.219
assert_has "$output" 'concurrency_control_applicability: supported (Claude Code 2.1.217 or later)'
assert_has "$output" 'nesting_control_applicability: supported (Claude Code 2.1.217 or later)'
assert_has "$output" "configuration_source: process-environment"
assert_has "$output" "concurrency: adequate (5; full path requires 5)"
assert_has "$output" "nesting: adequate (4; full path requires 4)"
assert_has "$output" "full_required_assessment: supported"

CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=4 CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=3 \
  run_ok claude --version 2.1.219
assert_has "$output" "concurrency: inadequate (4; baseline requires 1, full path requires 5)"
assert_has "$output" "nesting: inadequate (3; baseline requires 1, full path requires 4)"
assert_has "$output" "full_required_assessment: unsupported"

env -u CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS -u CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH \
  "$BASH" "$doctor" claude --version 2.1.219 >"$work_dir/claude-defaults.out"
output=$(cat "$work_dir/claude-defaults.out")
assert_has "$output" "concurrency: adequate (20; full path requires 5)"
assert_has "$output" "nesting: inadequate (3; baseline requires 1, full path requires 4)"
assert_has "$output" "full_required_assessment: unsupported"

CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=5 CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=4 \
  run_ok claude --version 2.1.216
assert_has "$output" 'concurrency_control_applicability: unsupported (requires Claude Code 2.1.217 or later)'
assert_has "$output" 'nesting_control_applicability: fixed host behavior (environment control requires Claude Code 2.1.217 or later)'
assert_has "$output" "concurrency: not-applicable (control requires Claude Code 2.1.217 or later)"
assert_has "$output" "nesting: adequate (host default 5; control not supported by this version)"

run_ok claude --version unknown
assert_has "$output" "status: version-unknown"
assert_has "$output" "baseline_owner_only: unknown"
assert_has "$output" "full_required_assessment: unknown"

CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=secret-token CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=4 \
  run_fail claude --version 2.1.219
assert_has "$output" "status: malformed"
case "$output" in *secret-token*) fail "diagnostic leaked invalid value" ;; esac

printf 'PASS: host-config-doctor\n'
