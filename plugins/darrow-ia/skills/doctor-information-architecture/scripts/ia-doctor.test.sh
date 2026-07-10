#!/usr/bin/env bash
# shellcheck disable=SC2016 # Backticks below are literal Markdown code spans.
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/ia-doctor.sh"
FAILURES=0
TEMPS=""

cleanup() {
  cd /
  local d
  for d in $TEMPS; do rm -rf "$d"; done
}
trap cleanup EXIT

fresh_repo() {
  REPO=$(mktemp -d)
  REPO=$(cd "$REPO" && pwd -P)
  TEMPS="$TEMPS $REPO"
  git -C "$REPO" init -qb main
}

check_contains() {
  local name=$1 needle=$2 output=$3
  if [[ "$output" == *"$needle"* ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (missing: $needle)"
    FAILURES=$((FAILURES + 1))
  fi
}

check_not_contains() {
  local name=$1 needle=$2 output=$3
  if [[ "$output" != *"$needle"* ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (unexpected: $needle)"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "doctor IA structure"
fresh_repo
mkdir -p "$REPO/docs/agent-rules"
printf '# Agents\n\nBefore API work, read `docs/agent-rules/api.md`.\n' > "$REPO/AGENTS.md"
printf '# API rules\n\nKeep errors typed.\n' > "$REPO/docs/agent-rules/api.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "finds a routed file" "AGENTS.md -> docs/agent-rules/api.md" "$out"
check_contains "reports approximate tokens" "approx_tokens=" "$out"
check_not_contains "does not invent a broken route" "broken-reference" "$out"

echo "broken references"
printf '# Agents\n\nBefore API work, read `docs/agent-rules/missing.md`.\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports missing local markdown" "critical broken-reference | AGENTS.md -> docs/agent-rules/missing.md" "$out"
if bash "$SCRIPT" verify "$REPO" >/dev/null 2>&1; then
  echo "  FAIL: verify accepted a broken route"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: verify rejects a broken route"
fi

printf '# Agents\n\n- `apps/api/**` -> `.agent-shared/rules/missing.md`\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports a broken rule-index target" "critical broken-reference | AGENTS.md -> .agent-shared/rules/missing.md" "$out"

echo "missing entrypoint"
fresh_repo
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports a missing root entrypoint" "critical missing-entrypoint" "$out"
if bash "$SCRIPT" verify "$REPO" >/dev/null 2>&1; then
  echo "  FAIL: verify accepted a repository without an entrypoint"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: verify rejects a repository without an entrypoint"
fi

echo "cycles and unrouted adapter rules"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/.agent-shared/shared"
printf '# Agents\n\nRead `.agent-shared/shared/a.md`.\n' > "$REPO/AGENTS.md"
printf '# A\n\nRead `.agent-shared/shared/b.md`.\n' > "$REPO/.agent-shared/shared/a.md"
printf '# B\n\nRead `.agent-shared/shared/a.md`.\n' > "$REPO/.agent-shared/shared/b.md"
printf '# Hidden\n' > "$REPO/.agent-shared/rules/hidden.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports an instruction cycle" "critical instruction-cycle" "$out"
check_contains "reports an unrouted shared rule" "critical unrouted-guidance | .agent-shared/rules/hidden.md" "$out"
if bash "$SCRIPT" verify "$REPO" >/dev/null 2>&1; then
  echo "  FAIL: verify accepted unrouted shared guidance"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: verify rejects unrouted shared guidance"
fi

echo "adapter drift and native all-scope rules"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/.claude/rules"
printf '# Agents\n' > "$REPO/AGENTS.md"
printf '%s\n' '---' 'paths: ["**"]' '---' '# Shared' > "$REPO/.agent-shared/rules/all.md"
printf '%s\n' '---' 'paths: ["**"]' '---' '# Different' > "$REPO/.claude/rules/all.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports mirror drift" "critical adapter-drift" "$out"
check_contains "reports a rule that is effectively resident" "advisory always-loaded-rule | .claude/rules/all.md" "$out"

echo "aligned adapter mirrors"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/.claude/rules"
printf '# Agents\n\nRead `.agent-shared/rules/api.md`.\n' > "$REPO/AGENTS.md"
printf '# API\n' > "$REPO/.agent-shared/rules/api.md"
cp "$REPO/.agent-shared/rules/api.md" "$REPO/.claude/rules/api.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "recognizes an aligned mirror" ".agent-shared/rules -> .claude/rules | status=aligned" "$out"
check_not_contains "does not call an intentional mirror duplicate" "advisory duplicate-content" "$out"

echo "root symlink adapter"
fresh_repo
printf '# Agents\n' > "$REPO/AGENTS.md"
ln -s AGENTS.md "$REPO/CLAUDE.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "recognizes the root symlink" "AGENTS.md -> CLAUDE.md | status=symlink" "$out"
check_contains "counts resident root content once" "root_bytes_total=9" "$out"
check_not_contains "does not call the symlink duplicate" "advisory duplicate-content" "$out"

echo "root budget"
fresh_repo
awk 'BEGIN {for (i=0; i<34000; i++) printf "x"}' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports the default 32 KiB budget" "critical root-budget | AGENTS.md bytes=34000 limit=32768" "$out"

echo "duplicate content"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules"
printf '# Agents\n\nRead `.agent-shared/rules/a.md` and `.agent-shared/rules/b.md`.\n' > "$REPO/AGENTS.md"
printf '# Same\n' > "$REPO/.agent-shared/rules/a.md"
cp "$REPO/.agent-shared/rules/a.md" "$REPO/.agent-shared/rules/b.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports identical guidance" "advisory duplicate-content" "$out"

if [[ $FAILURES -ne 0 ]]; then
  echo "$FAILURES test(s) failed" >&2
  exit 1
fi
echo "all doctor IA tests passed"
