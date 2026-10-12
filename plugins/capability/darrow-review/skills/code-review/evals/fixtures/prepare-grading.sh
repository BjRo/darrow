#!/usr/bin/env bash
set -eu

case_dir=$1
backend="$case_dir/../../../backend"
destination=.git/eval-checks/review
mkdir -p "$destination/tests/evals"
cp "$backend/pyproject.toml" "$backend/uv.lock" "$destination/"
cp -R "$backend/src" "$destination/"
cp "$backend"/tests/evals/*.py "$destination/tests/evals/"
