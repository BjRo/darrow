#!/bin/sh
set -eu

plugin_root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/darrow-discovery-install.XXXXXX")
trap 'rm -rf "$fixture"' EXIT HUP INT TERM

copy="$fixture/plugin copy"
mkdir -p "$copy"
cp -R "$plugin_root/." "$copy/"
skill_dir="$copy/skills/plan-implementation"
backend="$skill_dir/backend"
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

actual="$fixture/actual"
errors="$fixture/errors"
expected="$fixture/expected"
cd "$fixture"
uv run --quiet --frozen --no-dev --project "$backend" \
  darrow-render-plan-frontier \
  --evidence 'The repository stores records in one region today.' \
  --question 'Data region: single-region or multi-region?' \
  --option single-region --option multi-region --choice single-region \
  --rationale 'it limits operational coupling' \
  --deferred 'storage vendor and migration path' >"$actual" 2>"$errors"

cat >"$expected" <<'EOF'
Evidence: The repository stores records in one region today.

Q1 — Data region: single-region or multi-region?

Recommendation: Choose single-region because it limits operational coupling.

Deferred: storage vendor and migration path. After your answer, I will recompute the next frontier.
EOF
diff -u "$expected" "$actual"
test ! -s "$errors"

PYTHONIOENCODING=cp1252 uv run --quiet --frozen --no-dev --project "$backend" \
  darrow-render-plan-frontier \
  --evidence Fact --question 'Mode: ä or b?' \
  --option Ä --option b --choice ä \
  --rationale reason --deferred category >"$actual" 2>"$errors"
cat >"$expected" <<'EOF'
Evidence: Fact.

Q1 — Mode: ä or b?

Recommendation: Choose ä because reason.

Deferred: category. After your answer, I will recompute the next frontier.
EOF
cmp "$expected" "$actual"
test ! -s "$errors"

status=0
uv run --quiet --frozen --no-dev --project "$backend" \
  darrow-render-plan-frontier >"$actual" 2>"$errors" || status=$?
test "$status" -eq 2
test ! -s "$actual"
test "$(cat "$errors")" = 'every frontier field must be non-empty'

usage='usage: darrow-render-plan-frontier --evidence TEXT --question TEXT --option LABEL --option LABEL [--option LABEL ...] --choice LABEL --rationale TEXT --deferred TEXT'
for malformed in odd unknown; do
  status=0
  case "$malformed" in
    odd)
      uv run --quiet --frozen --no-dev --project "$backend" \
        darrow-render-plan-frontier --evidence \
        >"$actual" 2>"$errors" || status=$?
      ;;
    unknown)
      uv run --quiet --frozen --no-dev --project "$backend" \
        darrow-render-plan-frontier --unknown value \
        >"$actual" 2>"$errors" || status=$?
      ;;
  esac
  test "$status" -eq 2
  test ! -s "$actual"
  test "$(cat "$errors")" = "$usage"
done
