#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)
repo_dir=$(CDPATH='' cd -- "$plugin_dir/../../.." && pwd)
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/darrow-langfuse-failure.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM
rollout="$work_dir/rollout.jsonl"
stderr_file="$work_dir/stderr"
cp "$plugin_dir/tests/fixtures/main-rollout.jsonl" "$rollout"
cp "$plugin_dir/tests/fixtures/rollout-2026-08-24-child-1.jsonl" "$work_dir/"
payload=$(printf '{"cwd":"%s","transcript_path":"%s","hook_event_name":"Stop"}' "$repo_dir" "$rollout")

set +e
printf '%s\n' "$payload" |
  CODEX_PLUGIN_ROOT="$plugin_dir" \
  DARROW_LANGFUSE_ENABLED=true \
  DARROW_LANGFUSE_CAPTURE_CONTENT=false \
  DARROW_LANGFUSE_STRICT=true \
  LANGFUSE_PUBLIC_KEY=pk-test-not-secret \
  LANGFUSE_SECRET_KEY=sk-must-never-appear \
  LANGFUSE_BASE_URL=http://127.0.0.1:1 \
  bash "$script_dir/stop.sh" 2>"$stderr_file"
status=$?
set -e

test "$status" -ne 0 || {
  printf 'FAIL: strict mode accepted an exporter failure\n' >&2
  exit 1
}
grep -F 'darrow-langfuse:' "$stderr_file" >/dev/null || {
  printf 'FAIL: strict exporter failure had no bounded diagnostic\n' >&2
  exit 1
}
if grep -F 'sk-must-never-appear' "$stderr_file" >/dev/null; then
  printf 'FAIL: exporter failure leaked the Langfuse secret key\n' >&2
  exit 1
fi

printf 'observability exporter failure test passed\n'
