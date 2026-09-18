#!/usr/bin/env bash
set -euo pipefail
plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)
exec uv run --quiet --frozen --no-dev --project "$plugin_root/backend" \
  python "$plugin_root/backend/tests/fresh_install.py"
