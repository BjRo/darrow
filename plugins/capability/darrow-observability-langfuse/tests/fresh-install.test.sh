#!/usr/bin/env bash
set -euo pipefail

plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/darrow-langfuse-install.XXXXXX")
trap 'rm -rf "$fixture"' EXIT

mkdir -p "$fixture/plugin"
cp -R "$plugin_root/." "$fixture/plugin/"
rm -rf "$fixture/plugin/backend/.venv"
rm -f "$fixture/plugin/backend/.coverage" "$fixture/plugin/backend/coverage.json"

uv sync --locked --no-dev --project "$fixture/plugin/backend"
runtime_tree=$(uv tree --locked --no-dev --project "$fixture/plugin/backend")
for development_tool in coverage hypothesis mypy pytest ruff; do
  if printf '%s\n' "$runtime_tree" | grep -E "(^|[[:space:]])${development_tool}([[:space:]]|$)" >/dev/null; then
    echo "error: development dependency installed at runtime: $development_tool" >&2
    exit 1
  fi
done

uv run --quiet --frozen --no-dev --project "$fixture/plugin/backend" \
  python -c 'import darrow_observability_langfuse'

printf '%s\n' '{}' | env \
  DARROW_LANGFUSE_ENABLED=false \
  PLUGIN_ROOT="$fixture/plugin" \
  bash "$fixture/plugin/hooks/stop.sh"
