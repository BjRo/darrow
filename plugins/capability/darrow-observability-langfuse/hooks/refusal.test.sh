#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/darrow-langfuse-refusal.XXXXXX")
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM

set +e
PATH=/usr/bin:/bin \
  DARROW_LANGFUSE_DEBUG=true \
  /bin/bash "$script_dir/stop.sh" </dev/null 2>"$work_dir/missing-uv-default"
default_status=$?
PATH=/usr/bin:/bin \
  DARROW_LANGFUSE_STRICT=true \
  /bin/bash "$script_dir/stop.sh" </dev/null 2>"$work_dir/missing-uv-strict"
strict_status=$?
UV_PROJECT_ENVIRONMENT=/dev/null \
  DARROW_LANGFUSE_ENABLED=false \
  /bin/bash "$script_dir/stop.sh" </dev/null 2>"$work_dir/broken-uv-default"
broken_uv_default_status=$?
printf '%s' 'not-json' |
  DARROW_LANGFUSE_STRICT=true \
  bash "$script_dir/stop.sh" 2>"$work_dir/malformed"
malformed_status=$?
set -e

test "$default_status" -eq 0 || {
  printf 'FAIL: missing UV did not fail open by default\n' >&2
  exit 1
}
test "$strict_status" -ne 0 || {
  printf 'FAIL: strict missing-UV refusal returned success\n' >&2
  exit 1
}
test "$broken_uv_default_status" -eq 0 || {
  printf 'FAIL: pre-Python UV failure did not fail open by default\n' >&2
  exit 1
}
test "$malformed_status" -ne 0 || {
  printf 'FAIL: strict malformed hook input returned success\n' >&2
  exit 1
}
grep -F 'uv is required but was not found' "$work_dir/missing-uv-default" >/dev/null
grep -F 'uv is required but was not found' "$work_dir/missing-uv-strict" >/dev/null
grep -F 'hook input is not valid JSON' "$work_dir/malformed" >/dev/null

printf 'observability refusal tests passed\n'
