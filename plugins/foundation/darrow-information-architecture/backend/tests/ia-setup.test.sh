#!/usr/bin/env bash
set -uo pipefail

BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
command_ia() { uv run --quiet --frozen --no-dev --project "$BACKEND" ia-setup "$@"; }
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
out=$(command_ia inspect "$REPO/src")
check_contains "resolves main worktree from a subdirectory" "root: $REPO" "$out"
check_contains "finds root guidance" "AGENTS.md | bytes=" "$out"
check_contains "finds manifests" "package.json" "$out"
check_contains "finds CI" ".github/workflows/test.yml" "$out"
check_contains "finds skills" ".agents/skills/review/SKILL.md" "$out"

before=$(find "$REPO" -not -path '*/.git/*' -print | LC_ALL=C sort)
command_ia inspect "$REPO" >/dev/null
after=$(find "$REPO" -not -path '*/.git/*' -print | LC_ALL=C sort)
if [[ "$before" == "$after" ]]; then
  echo "  ok: inventory is read-only"
else
  echo "  FAIL: inventory changed the repository"
  FAILURES=$((FAILURES + 1))
fi

echo "setup fails closed on required evidence"
fresh_repo
rm "$REPO/AGENTS.md"
ln -s missing.md "$REPO/AGENTS.md"
if command_ia inspect "$REPO" > /dev/null 2>&1; then
  echo "  FAIL: inventory accepted a broken entrypoint symlink"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: inventory rejects a broken entrypoint symlink"
fi

echo "setup handles large worktree output"
fresh_repo
REAL_GIT=$(command -v git)
mkdir -p "$REPO/bin"
# shellcheck disable=SC2016 # $i/$* must stay literal: this emits a git stub script
printf '%s\n' '#!/usr/bin/env bash' 'if [[ "$*" == *"worktree list --porcelain"* ]]; then' "  printf 'worktree %s\\n' '$REPO'" '  i=0; while [[ $i -lt 9000 ]]; do printf "HEAD %040d\\n" "$i"; i=$((i + 1)); done' '  exit 0' 'fi' "exec '$REAL_GIT' \"\$@\"" > "$REPO/bin/git"
chmod +x "$REPO/bin/git"
out=$(PATH="$REPO/bin:$PATH" command_ia inspect "$REPO")
check_contains "consumes a large worktree listing without SIGPIPE" "root: $REPO" "$out"

echo "setup caps large inventories"
fresh_repo
i=0
while [[ $i -lt 45 ]]; do mkdir -p "$REPO/dir-$i"; printf '# Nested\n' > "$REPO/dir-$i/AGENTS.md"; i=$((i + 1)); done
out=$(command_ia inspect "$REPO")
check_contains "caps the entrypoint listing" "  - ..." "$out"

if [[ $FAILURES -ne 0 ]]; then
  echo "$FAILURES test(s) failed" >&2
  exit 1
fi
echo "all setup IA tests passed"
