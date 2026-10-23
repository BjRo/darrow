#!/usr/bin/env bash
set -eu

case_dir=$1
mkdir -p "$HOME/.darrow/reviews"
chmod 700 "$HOME/.darrow/reviews"
backend="$case_dir/../../../backend"
destination=.git/eval-checks/review
mkdir -p "$destination/tests/evals"
cp "$backend/pyproject.toml" "$backend/uv.lock" "$destination/"
cp -R "$backend/src" "$destination/"
cp "$backend"/tests/evals/*.py "$destination/tests/evals/"
