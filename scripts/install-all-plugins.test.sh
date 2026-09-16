#!/usr/bin/env bash
# Deterministic coverage for the marketplace-driven all-plugin installer.
# Run: bash scripts/install-all-plugins.test.sh
set -uo pipefail

RUNNER=${1:-bash}
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
INSTALLER="$SCRIPT_DIR/install-all-plugins"
FAILURES=0

check() {
  local description=$1 expected=$2 actual=$3
  if [[ "$actual" == "$expected" ]]; then
    printf '  ok: %s\n' "$description"
  else
    printf '  FAIL: %s (expected %s, got %s)\n' "$description" "$expected" "$actual"
    FAILURES=$((FAILURES + 1))
  fi
}

contains() {
  local description=$1 needle=$2 file=$3
  if grep -Fq -- "$needle" "$file"; then
    printf '  ok: %s\n' "$description"
  else
    printf '  FAIL: %s (missing %s)\n' "$description" "$needle"
    FAILURES=$((FAILURES + 1))
  fi
}

not_contains() {
  local description=$1 needle=$2 file=$3
  if grep -Fq -- "$needle" "$file"; then
    printf '  FAIL: %s (found %s)\n' "$description" "$needle"
    FAILURES=$((FAILURES + 1))
  else
    printf '  ok: %s\n' "$description"
  fi
}

make_fixture() {
  FIXTURE=$(mktemp -d "${TMPDIR:-/tmp}/darrow-install-all-test.XXXXXX")
  mkdir -p "$FIXTURE/bin"
  MANIFEST="$FIXTURE/marketplace.json"
  CALLS="$FIXTURE/calls"
  cat >"$MANIFEST" <<'EOF'
{
  "plugins": [
    { "name": "alpha", "source": "./plugins/capability/alpha" },
    { "name": "bravo", "source": "./plugins/capability/bravo" }
  ]
}
EOF
  cat >"$FIXTURE/bin/codex" <<'EOF'
#!/bin/sh
printf 'codex %s\n' "$*" >>"$DARROW_TEST_CALLS"
[ "${DARROW_TEST_FAIL:-}" != "${3:-}" ]
EOF
  cat >"$FIXTURE/bin/claude" <<'EOF'
#!/bin/sh
printf 'claude %s\n' "$*" >>"$DARROW_TEST_CALLS"
[ "${DARROW_TEST_FAIL:-}" != "${3:-}" ]
EOF
  chmod +x "$FIXTURE/bin/codex" "$FIXTURE/bin/claude"
}

run_installer() {
  local output=$1
  shift
  PATH="$FIXTURE/bin:$PATH" DARROW_MARKETPLACE_MANIFEST="$MANIFEST" \
    DARROW_TEST_CALLS="$CALLS" DARROW_TEST_FAIL="${DARROW_TEST_FAIL:-}" \
    "$RUNNER" "$INSTALLER" "$@" >"$output" 2>&1
}

run_default_installer() {
  local output=$1
  shift
  PATH="$FIXTURE/bin:$PATH" DARROW_TEST_CALLS="$CALLS" \
    DARROW_TEST_FAIL="${DARROW_TEST_FAIL:-}" "$RUNNER" "$INSTALLER" "$@" >"$output" 2>&1
}

marketplace_calls() {
  awk '
    /^[[:space:]]*"plugins"[[:space:]]*:[[:space:]]*\[/ { in_plugins = 1; next }
    in_plugins && /^[[:space:]]*][[:space:]]*[,}]?[[:space:]]*$/ { exit }
    in_plugins && /"name"[[:space:]]*:/ {
      name = $0
      sub(/^.*"name"[[:space:]]*:[[:space:]]*"/, "", name)
      sub(/".*$/, "", name)
      print "codex plugin add " name "@darrow"
    }
  ' "$SCRIPT_DIR/../.claude-plugin/marketplace.json"
}

echo "# current marketplace alignment"
make_fixture
OUT="$FIXTURE/current-marketplace.out"
run_default_installer "$OUT" --host codex
check "default manifest drives every Codex call" "$(marketplace_calls)" "$(cat "$CALLS")"

echo "# marketplace installation success"
make_fixture
OUT="$FIXTURE/codex.out"
run_installer "$OUT" --host codex
check "Codex exit status" 0 $?
check "Codex calls use marketplace order" $'codex plugin add alpha@darrow\ncodex plugin add bravo@darrow' "$(cat "$CALLS")"
contains "Codex confirms all plugins" "Installed all 2 Darrow marketplace plugins for Codex." "$OUT"

make_fixture
OUT="$FIXTURE/claude.out"
run_installer "$OUT" --host claude --scope project
check "Claude exit status" 0 $?
check "Claude preserves scope for every plugin" $'claude plugin install alpha@darrow --scope project\nclaude plugin install bravo@darrow --scope project' "$(cat "$CALLS")"
contains "Claude confirms all plugins" "Installed all 2 Darrow marketplace plugins for Claude Code." "$OUT"

make_fixture
OUT="$FIXTURE/claude-default-scope.out"
run_installer "$OUT" --host claude
check "Claude defaults every plugin to user scope" $'claude plugin install alpha@darrow --scope user\nclaude plugin install bravo@darrow --scope user' "$(cat "$CALLS")"

echo "# manifest membership is dynamic"
make_fixture
cat >"$MANIFEST" <<'EOF'
{
  "plugins": [
    { "name": "only-current-entry", "source": "./plugins/capability/only-current-entry" }
  ]
}
EOF
OUT="$FIXTURE/dynamic.out"
run_installer "$OUT" --host codex
check "fixture inventory drives calls" "codex plugin add only-current-entry@darrow" "$(cat "$CALLS")"

echo "# failures are named and unsuccessful"
make_fixture
OUT="$FIXTURE/codex-failure.out"
DARROW_TEST_FAIL="bravo@darrow" run_installer "$OUT" --host codex
status=$?
check "Codex failure is nonzero" true "$([[ $status -ne 0 ]] && echo true || echo false)"
contains "Codex failure names plugin" "bravo@darrow" "$OUT"
not_contains "Codex failure omits success" "Installed all" "$OUT"

make_fixture
OUT="$FIXTURE/claude-failure.out"
DARROW_TEST_FAIL="bravo@darrow" run_installer "$OUT" --host claude
status=$?
check "Claude failure is nonzero" true "$([[ $status -ne 0 ]] && echo true || echo false)"
contains "Claude failure names plugin" "bravo@darrow" "$OUT"
not_contains "Claude failure omits success" "Installed all" "$OUT"

if [[ $FAILURES -eq 0 ]]; then
  printf 'all marketplace installation tests passed (%s)\n' "$RUNNER"
  exit 0
fi
printf '%s marketplace installation test(s) failed (%s)\n' "$FAILURES" "$RUNNER" >&2
exit 1
