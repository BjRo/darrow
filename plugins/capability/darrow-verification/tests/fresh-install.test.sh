#!/bin/sh
set -eu

plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template=/darrow-verification-install.XXXXXX ;;
  */) temp_template=${temp_parent}darrow-verification-install.XXXXXX ;;
  *) temp_template=$temp_parent/darrow-verification-install.XXXXXX ;;
esac
fixture=$(mktemp -d "$temp_template")
fixture=$(CDPATH='' cd -- "$fixture" && pwd -P)
trap 'rm -rf "$fixture"' EXIT HUP INT TERM

copy="$fixture/plugin copy"
mkdir -p "$copy"
cp -R "$plugin_root/." "$copy/"
backend="$copy/skills/verify-change/backend"
rm -rf \
  "$backend/.venv" \
  "$backend/.hypothesis" \
  "$backend/.mypy_cache" \
  "$backend/.pytest_cache" \
  "$backend/.ruff_cache"
rm -f "$backend"/.coverage* "$backend/coverage.json"
find "$backend" -type d -name __pycache__ -prune -exec rm -rf {} \;

uv sync --locked --no-dev --project "$backend"
runtime_tree=$(uv tree --locked --no-dev --project "$backend")
for development_tool in coverage hypothesis mypy pytest ruff; do
  if printf '%s\n' "$runtime_tree" | grep -E "(^|[[:space:]])${development_tool}([[:space:]]|$)" >/dev/null; then
    echo "error: development dependency installed at runtime: $development_tool" >&2
    exit 1
  fi
done
rm -rf "$backend/.venv"

mkdir "$fixture/outside"
assessment="$fixture/assessment.md"
report="$fixture/provider report #%<>.md"
actual="$fixture/actual"
errors="$fixture/errors"
expected="$fixture/expected"
printf 'Conclusion: progress.\n\nF1 remains blocking; A1 is advisory.\n' >"$assessment"
printf 'Complete provider report, unchanged.\n' >"$report"
cp "$report" "$fixture/report-before.md"

cd "$fixture/outside"
uv run --quiet --isolated --frozen --no-dev --project "$backend" \
  darrow-render-assessment \
  --assessment "$assessment" --provider-report "$report" \
  >"$actual" 2>"$errors"

canonical_report=$(CDPATH='' cd -- "${report%/*}" && pwd -P)/${report##*/}
destination=$(printf '%s\n' "$canonical_report" | LC_ALL=C sed \
  -e 's/%/%25/g' -e 's/ /%20/g' -e 's/#/%23/g' -e 's/?/%3F/g' \
  -e 's/</%3C/g' -e 's/>/%3E/g' -e 's/\\/%5C/g')
{
  cat "$assessment"
  printf '\n\nComplete provider result: [report](<%s>)\n' "$destination"
} >"$expected"
cmp "$expected" "$actual"
cmp "$fixture/report-before.md" "$report"
test ! -s "$errors"

status=0
uv run --quiet --isolated --frozen --no-dev --project "$backend" \
  darrow-render-assessment >"$actual" 2>"$errors" || status=$?
test "$status" -eq 2
test ! -s "$actual"
test "$(cat "$errors")" = \
  'render-assessment: usage: render-assessment --assessment ABSOLUTE_FILE --provider-report ABSOLUTE_FILE'

status=0
uv run --quiet --isolated --frozen --no-dev --project "$backend" \
  darrow-render-assessment \
  --assessment "$assessment" --provider-report relative.md \
  >"$actual" 2>"$errors" || status=$?
test "$status" -eq 2
test ! -s "$actual"
test "$(cat "$errors")" = \
  'render-assessment: provider-report requires an absolute path'

empty="$fixture/empty.md"
: >"$empty"
status=0
uv run --quiet --isolated --frozen --no-dev --project "$backend" \
  darrow-render-assessment \
  --assessment "$empty" --provider-report "$report" \
  >"$actual" 2>"$errors" || status=$?
test "$status" -eq 2
test ! -s "$actual"
test "$(cat "$errors")" = \
  "render-assessment: assessment is not a readable nonempty regular file: $empty"
test ! -e "$backend/.venv"

printf '%s\n' 'verification fresh install passed'
