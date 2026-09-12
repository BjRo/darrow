#!/usr/bin/env bash
set -u

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)

environment_true() {
  normalized=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')
  case "$normalized" in 1|true|yes|on) return 0 ;; *) return 1 ;; esac
}

startup_failure() {
  if environment_true "${DARROW_LANGFUSE_DEBUG:-}" || environment_true "${DARROW_LANGFUSE_STRICT:-}"; then
    printf 'darrow-langfuse: %s\n' "$1" >&2
  fi
  if environment_true "${DARROW_LANGFUSE_STRICT:-}"; then exit 1; fi
  exit 0
}

if ! command -v uv >/dev/null 2>&1; then
  startup_failure 'uv is required but was not found'
fi

status_dir=$(mktemp -d "${TMPDIR:-/tmp}/darrow-langfuse-status.XXXXXX") || startup_failure 'cannot create backend status directory'
trap 'rm -rf "$status_dir"' EXIT
UV_NO_PROGRESS=1 uv run --quiet --frozen --project "$plugin_dir/backend" \
  python -m darrow_observability_langfuse.cli --launcher-status "$status_dir/result" "$@"

if test -f "$status_dir/result" && IFS= read -r resolved_status < "$status_dir/result"; then
  case "$resolved_status" in 0|1) exit "$resolved_status" ;; esac
fi
startup_failure 'backend launch or execution failed'
