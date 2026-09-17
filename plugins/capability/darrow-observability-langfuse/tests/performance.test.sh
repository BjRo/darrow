#!/bin/sh
set -eu

plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
backend="$plugin_root/backend"
fixture=$(mktemp -d "${TMPDIR:-/tmp}/darrow-python-benchmark.XXXXXX")
trap 'rm -rf "$fixture"' EXIT HUP INT TERM

(
  cd "$backend"
  uv sync --locked --all-groups
  uv run --all-groups python tests/benchmark_capture.py \
    --source "$backend/src" --mode control --turns 200 >"$fixture/control.json"
  uv run --all-groups python tests/benchmark_capture.py \
    --source "$backend/src" --mode candidate --turns 200 >"$fixture/candidate.json"
  uv run --all-groups python scripts/compare_benchmark.py \
    "$fixture/control.json" "$fixture/candidate.json"
)
