#!/usr/bin/env bash
# Compatibility launcher; all mechanics live in the contained Python package.
set -euo pipefail
plugin_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)
exec uv run --quiet --frozen --no-dev --project "$plugin_root/backend" darrow-prepare-task-branch "$@"
