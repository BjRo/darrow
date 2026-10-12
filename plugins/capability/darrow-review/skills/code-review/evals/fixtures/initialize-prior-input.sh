#!/usr/bin/env bash
set -eu
repo=$(git rev-parse --show-toplevel)
backend="$repo/.agents/backend"
if ! test -r "$backend/scripts/run_locked.py"; then
  backend="$repo/.sevro-marketplace/plugin/backend"
fi
test -r "$backend/scripts/run_locked.py" || {
  printf '%s\n' 'The fixture requires its mounted Review backend.' >&2
  exit 2
}
exec uv run --quiet --no-project "$backend/scripts/run_locked.py" python -m darrow_review.eval_fixture first --repo "$repo"
