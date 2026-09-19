#!/bin/sh
set -eu

plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/darrow-skill-authoring-install.XXXXXX")
trap 'rm -rf "$fixture"' EXIT HUP INT TERM

mkdir -p "$fixture/plugin"
cp -R "$plugin_root/." "$fixture/plugin/"
backend="$fixture/plugin/skills/author-agent-skill/backend"
skill="$fixture/plugin/skills/author-agent-skill"
rm -rf "$backend/.venv"
rm -f "$backend/.coverage" "$backend/coverage.json"

uv sync --locked --no-dev --project "$backend"
runtime_tree=$(uv tree --locked --no-dev --project "$backend")
for development_tool in coverage hypothesis mypy pytest ruff; do
  if printf '%s\n' "$runtime_tree" | grep -E "(^|[[:space:]])${development_tool}([[:space:]]|$)" >/dev/null; then
    echo "error: development dependency installed at runtime: $development_tool" >&2
    exit 1
  fi
done

inspection=$(uv run --quiet --frozen --no-dev --project "$backend" \
  inspect-skill inspect "$skill" "$fixture/plugin")
printf '%s\n' "$inspection" | grep '^status[[:space:]]valid$' >/dev/null

set +e
matrix=$(uv run --quiet --frozen --no-dev --project "$backend" \
  verify-shell-tests -- \
  "$backend/tests/shell/inspect-skill.test.sh" \
  "$backend/tests/shell/verify-shell-tests.test.sh" \
  "$backend/tests/shell/interpreter-routing.test.sh")
matrix_status=$?
set -e
case "$matrix_status" in
  0|3) ;;
  *) printf '%s\n' "$matrix" >&2; exit "$matrix_status" ;;
esac
printf '%s\n' "$matrix" | grep '^format[[:space:]]darrow-shell-test-matrix-v1$' >/dev/null
if printf '%s\n' "$matrix" | grep '^test_result.*failed' >/dev/null; then
  printf '%s\n' "$matrix" >&2
  exit 1
fi
for test_name in inspect-skill.test.sh verify-shell-tests.test.sh interpreter-routing.test.sh; do
  printf '%s\n' "$matrix" | grep "test_result.*${test_name}[[:space:]]passed$" >/dev/null
done
