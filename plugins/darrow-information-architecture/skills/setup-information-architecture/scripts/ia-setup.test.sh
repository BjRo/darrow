#!/usr/bin/env bash
set -uo pipefail

SCRIPT="$(cd "$(dirname "$0")" && pwd)/ia-setup.sh"
FAILURES=0
TEMPS=""

cleanup() {
  cd /
  local d
  for d in $TEMPS; do rm -rf "$d"; done
}
trap cleanup EXIT

check_contains() {
  local name=$1 needle=$2 output=$3
  if [[ "$output" == *"$needle"* ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (missing: $needle)"
    FAILURES=$((FAILURES + 1))
  fi
}

fresh_repo() {
  REPO=$(mktemp -d)
  REPO=$(cd "$REPO" && pwd -P)
  TEMPS="$TEMPS $REPO"
  git -C "$REPO" init -qb main
  mkdir -p "$REPO/src" "$REPO/.github/workflows" "$REPO/.agents/skills/review"
  printf '# Agent instructions\n' > "$REPO/AGENTS.md"
  printf '{"private":true}\n' > "$REPO/package.json"
  printf 'name: test\n' > "$REPO/.github/workflows/test.yml"
  printf '%s\n' '---' 'name: review' 'description: Review code.' '---' > "$REPO/.agents/skills/review/SKILL.md"
}

echo "setup IA inventory"
fresh_repo
out=$(bash "$SCRIPT" inspect "$REPO/src")
check_contains "resolves main worktree from a subdirectory" "root: $REPO" "$out"
check_contains "finds root guidance" "AGENTS.md | bytes=" "$out"
check_contains "finds manifests" "package.json" "$out"
check_contains "finds CI" ".github/workflows/test.yml" "$out"
check_contains "finds skills" ".agents/skills/review/SKILL.md" "$out"

before=$(find "$REPO" -not -path '*/.git/*' -print | LC_ALL=C sort)
bash "$SCRIPT" inspect "$REPO" >/dev/null
after=$(find "$REPO" -not -path '*/.git/*' -print | LC_ALL=C sort)
if [[ "$before" == "$after" ]]; then
  echo "  ok: inventory is read-only"
else
  echo "  FAIL: inventory changed the repository"
  FAILURES=$((FAILURES + 1))
fi

if [[ $FAILURES -ne 0 ]]; then
  echo "$FAILURES test(s) failed" >&2
  exit 1
fi
echo "all setup IA tests passed"
