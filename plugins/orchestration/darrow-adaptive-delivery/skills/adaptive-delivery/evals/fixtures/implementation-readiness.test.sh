#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
installer=(uv run --quiet --frozen --no-dev --project "$script_dir/../../../../backend" adaptive-delivery-fixture install readiness)
test_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-readiness-fixture-test.XXXXXX")
trap 'rm -rf "$test_root"' EXIT HUP INT TERM

make_repo() {
  make_repo_path=$1
  mkdir -p "$make_repo_path"
  git -C "$make_repo_path" init -q
  printf '%s\n' "$2" >"$make_repo_path/.readiness-verdict"
}

codex_repo="$test_root/codex"
make_repo "$codex_repo" blocked
"${installer[@]}" "$codex_repo" "$script_dir" codex
test -f "$codex_repo/.agents/backend/pyproject.toml"
codex_result=$(uv run --quiet --frozen --no-dev --project "$codex_repo/.agents/backend" adaptive-delivery-fixture readiness "$codex_repo")
grep -F "**Verdict:** \`blocked\`" <<<"$codex_result" >/dev/null
grep -F "**Type:** \`dependency\`" <<<"$codex_result" >/dev/null
grep -F "**Type:** \`unblock\`" <<<"$codex_result" >/dev/null
test "$(wc -l <"$codex_repo/.git/fixture-state/implementation-readiness-invocations" | tr -d ' ')" -eq 1

iterative_repo="$test_root/iterative"
make_repo "$iterative_repo" needs-decision-then-ready
"${installer[@]}" "$iterative_repo" "$script_dir" codex
first_result=$(uv run --quiet --frozen --no-dev --project "$iterative_repo/.agents/backend" adaptive-delivery-fixture readiness "$iterative_repo")
second_result=$(uv run --quiet --frozen --no-dev --project "$iterative_repo/.agents/backend" adaptive-delivery-fixture readiness "$iterative_repo")
grep -F "**Verdict:** \`needs-decision\`" <<<"$first_result" >/dev/null
grep -F "**Verdict:** \`ready\`" <<<"$second_result" >/dev/null
test "$(wc -l <"$iterative_repo/.git/fixture-state/implementation-readiness-invocations" | tr -d ' ')" -eq 2

claude_repo="$test_root/claude"
make_repo "$claude_repo" needs-discovery
"${installer[@]}" "$claude_repo" "$script_dir" claude
test -f "$claude_repo/.claude/skills/assess-implementation-readiness/SKILL.md"
test ! -e "$claude_repo/.claude/bin/implementation-readiness-fixture"
test ! -e "$claude_repo/.git/fixture-state/implementation-readiness-invocations"
grep -F 'Use the native Read tool, never Bash' \
  "$claude_repo/.claude/skills/assess-implementation-readiness/SKILL.md" >/dev/null
grep -F "**Verdict:** \`needs-discovery\`" \
  "$claude_repo/.git/fixture-state/implementation-readiness-result" >/dev/null
grep -F "**Type:** \`missing-information\`" \
  "$claude_repo/.git/fixture-state/implementation-readiness-result" >/dev/null
grep -F "**Type:** \`discovery\`" \
  "$claude_repo/.git/fixture-state/implementation-readiness-result" >/dev/null

printf '%s\n' 'implementation-readiness fixture tests passed'
