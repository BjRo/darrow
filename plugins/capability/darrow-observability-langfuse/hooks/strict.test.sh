#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/darrow-langfuse-strict.XXXXXX")
work_dir=$(cd "$work_dir" && pwd -P)
trap 'rm -rf "$work_dir"' EXIT HUP INT TERM
mkdir -p "$work_dir/home/.codex" "$work_dir/project/.codex"
payload=$(printf '{"session_id":"test","turn_id":"0","hook_event_name":"Stop","cwd":"%s","transcript_path":"%s"}' "$work_dir/project" "$work_dir/missing.jsonl")

for location in "$work_dir/home" "$work_dir/project"; do
  printf '%s\n' '{"enabled":true,"strict":true}' > "$location/.codex/darrow-langfuse.json"
  if printf '%s\n' "$payload" | env -i PATH="$PATH" HOME="$work_dir/home" UV_OFFLINE=1 \
    "$BASH" "$script_dir/stop.sh" 2>"$work_dir/error"; then
    printf 'FAIL: file strict failure became success\n' >&2
    exit 1
  fi
  grep -F 'Langfuse credentials are missing' "$work_dir/error" >/dev/null
  rm "$location/.codex/darrow-langfuse.json"
done

for strict in 1 true yes on ' TRUE ' ' Yes '; do
  if printf '%s\n' "$payload" | env -i PATH="$PATH" HOME="$work_dir/home" UV_OFFLINE=1 \
    DARROW_LANGFUSE_ENABLED=true DARROW_LANGFUSE_STRICT="$strict" \
    "$BASH" "$script_dir/stop.sh" 2>"$work_dir/error"; then
    printf 'FAIL: environment strict failure became success: %s\n' "$strict" >&2
    exit 1
  fi
  grep -F 'Langfuse credentials are missing' "$work_dir/error" >/dev/null
  if env -i PATH=/usr/bin:/bin HOME="$work_dir/home" DARROW_LANGFUSE_STRICT="$strict" \
    "$BASH" "$script_dir/stop.sh" </dev/null 2>"$work_dir/error"; then
    printf 'FAIL: strict missing-UV failure became success: %s\n' "$strict" >&2
    exit 1
  fi
done

# Environment false overrides file strict, and a pre-Python failure stays open.
printf '%s\n' '{"enabled":true,"strict":true}' > "$work_dir/project/.codex/darrow-langfuse.json"
printf '%s\n' "$payload" | env -i PATH="$PATH" HOME="$work_dir/home" UV_OFFLINE=1 \
  DARROW_LANGFUSE_STRICT=off "$BASH" "$script_dir/stop.sh"
printf '%s\n' "$payload" | env -i PATH="$PATH" HOME="$work_dir/home" UV_PROJECT_ENVIRONMENT=/dev/null \
  "$BASH" "$script_dir/stop.sh" 2>"$work_dir/error"
printf 'observability strict tests passed\n'
