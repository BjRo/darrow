#!/usr/bin/env bash
set -u

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
plugin_dir=$(CDPATH='' cd -- "$script_dir/.." && pwd)

if ! command -v uv >/dev/null 2>&1; then
  case "${DARROW_LANGFUSE_DEBUG:-false}:${DARROW_LANGFUSE_STRICT:-false}" in
    true:*|*:true) printf '%s\n' 'darrow-langfuse: uv is required but was not found' >&2 ;;
  esac
  case "${DARROW_LANGFUSE_STRICT:-false}" in
    true) exit 1 ;;
    *) exit 0 ;;
  esac
fi

UV_NO_PROGRESS=1 uv run --quiet --frozen --project "$plugin_dir/backend" \
  python -m darrow_observability_langfuse.cli
status=$?

if test "$status" -ne 0; then
  case "${DARROW_LANGFUSE_DEBUG:-false}:${DARROW_LANGFUSE_STRICT:-false}" in
    true:*|*:true) printf '%s\n' 'darrow-langfuse: backend launch or execution failed' >&2 ;;
  esac
  case "${DARROW_LANGFUSE_STRICT:-false}" in
    true) exit "$status" ;;
    *) exit 0 ;;
  esac
fi

exit 0
