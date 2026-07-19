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
check_contains "finds a routed file" "$REPO/AGENTS.md -> $REPO/docs/agent-rules/api.md" "$out"
check_contains "reports approximate tokens" "approx_tokens=" "$out"
check_not_contains "does not invent a broken route" "broken-reference" "$out"

echo "broken references"
printf '# Agents\n\nBefore API work, read `docs/agent-rules/missing.md`.\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports missing local markdown" "critical broken-reference | $REPO/AGENTS.md -> $REPO/docs/agent-rules/missing.md" "$out"
if bash "$SCRIPT" verify "$REPO" >/dev/null 2>&1; then
  echo "  FAIL: verify accepted a broken route"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: verify rejects a broken route"
fi

printf '# Agents\n\n- `apps/api/**` -> `.agent-shared/rules/missing.md`\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports a broken rule-index target" "critical broken-reference | $REPO/AGENTS.md -> $REPO/.agent-shared/rules/missing.md" "$out"
mkdir -p "$REPO/.agent-shared/rules"
printf '# Agents\n\n- `apps/api/**` -> `.agent-shared/rules/api.md`\n' > "$REPO/AGENTS.md"
printf '# API\n' > "$REPO/.agent-shared/rules/api.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "treats an arrow rule-index row as an explicit route" "$REPO/AGENTS.md -> $REPO/.agent-shared/rules/api.md" "$out"
check_not_contains "does not leave an arrow-routed rule unrouted" "unrouted-guidance" "$out"

echo "session-root paths and fenced examples"
fresh_repo
mkdir -p "$REPO/docs/internal/export"
printf '# Agents\n\nBefore docs work, read `docs/AGENTS.md`.\n' > "$REPO/AGENTS.md"
printf '# Docs\n\nBefore export work, read `internal/export/assembler.go`.\n' > "$REPO/docs/AGENTS.md"
printf 'package export\n' > "$REPO/docs/internal/export/assembler.go"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "rejects a containing-file-relative ordinary path" "critical nonroot-path | $REPO/docs/AGENTS.md -> $REPO/internal/export/assembler.go" "$out"

printf '# Agents\n\n```md\nBefore API work, read `docs/missing.md`.\n```\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_not_contains "ignores routes inside backtick fences" "docs/missing.md" "$out"
printf '# Agents\n\n   ~~~~md\nBefore API work, read `docs/missing.md`.\n   ~~~~\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_not_contains "ignores routes inside indented tilde fences" "docs/missing.md" "$out"
printf '# Agents\n\n```md\n```not-a-close\nBefore API work, read `docs/missing.md`.\n```\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_not_contains "does not close a fence on a marker with trailing text" "docs/missing.md" "$out"
printf '\357\273\277```md\nBefore API work, read `docs/missing.md`.\n```\n' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_not_contains "ignores a route in a BOM-prefixed fenced example" "docs/missing.md" "$out"

echo "mentions and repository boundaries"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/docs/nested"
printf '# Agents\n\nSee `.agent-shared/rules/api.md` for background.\n' > "$REPO/AGENTS.md"
printf '# API\n' > "$REPO/.agent-shared/rules/api.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "a mention does not satisfy reachability" "critical unrouted-guidance | runtime=codex | $REPO/.agent-shared/rules/api.md" "$out"
printf '# Nested\n\nSee `local.md` for background.\n' > "$REPO/docs/nested/AGENTS.md"
printf '# Local\n' > "$REPO/docs/nested/local.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_not_contains "a mention-only relative path is not a route error" "nonroot-path | $REPO/docs/nested/AGENTS.md" "$out"

outside="$REPO/../$(basename "$REPO")-outside.md"
printf '# Outside\n' > "$outside"
printf '# Agents\n\nRead `../%s-outside.md`.\n' "$(basename "$REPO")" > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "rejects an ordinary route that escapes the repository" "critical broken-reference | $REPO/AGENTS.md" "$out"
printf '# Agents\n\nRead `%s/docs/nested/local.md`.\n' "$REPO" > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "rejects an absolute in-repository route form" "critical nonroot-path | $REPO/AGENTS.md -> $REPO/docs/nested/local.md" "$out"
rm -f "$outside"

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
check_contains "reports an unrouted shared rule" "critical unrouted-guidance | runtime=codex | $REPO/.agent-shared/rules/hidden.md" "$out"
if bash "$SCRIPT" verify "$REPO" >/dev/null 2>&1; then
  echo "  FAIL: verify accepted unrouted shared guidance"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: verify rejects unrouted shared guidance"
fi

echo "runtime-specific reachability"
fresh_repo
mkdir -p "$REPO/src"
printf '# Agents\n' > "$REPO/AGENTS.md"
printf '# Nested\n' > "$REPO/src/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "does not invent Codex reachability for nested guidance" "critical unrouted-guidance | runtime=codex | $REPO/src/AGENTS.md" "$out"

fresh_repo
mkdir -p "$REPO/.claude" "$REPO/src"
printf '# Claude\n' > "$REPO/.claude/CLAUDE.md"
printf '# Nested Claude\n' > "$REPO/src/CLAUDE.md"
out=$(bash "$SCRIPT" inspect --runtime claude "$REPO")
check_not_contains "accepts Claude native nested scope" "unrouted-guidance" "$out"
check_not_contains "accepts the .claude project entrypoint" "missing-entrypoint" "$out"

echo "adapter drift and native all-scope rules"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/.claude/rules"
printf '# Agents\n' > "$REPO/AGENTS.md"
printf '%s\n' '---' 'paths: ["**"]' '---' '# Shared' > "$REPO/.agent-shared/rules/all.md"
printf '%s\n' '---' 'paths: ["**"]' '---' '# Different' > "$REPO/.claude/rules/all.md"
out=$(bash "$SCRIPT" inspect --runtime codex --mirror .agent-shared/rules=.claude/rules "$REPO")
check_contains "reports mirror drift" "critical adapter-drift" "$out"
check_contains "reports a rule that is effectively resident" "advisory always-loaded-rule | $REPO/.claude/rules/all.md" "$out"

echo "aligned adapter mirrors"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/.claude/rules"
printf '# Agents\n\nRead `.agent-shared/rules/api.md`.\n' > "$REPO/AGENTS.md"
printf '# API\n' > "$REPO/.agent-shared/rules/api.md"
cp "$REPO/.agent-shared/rules/api.md" "$REPO/.claude/rules/api.md"
out=$(bash "$SCRIPT" inspect --runtime codex --mirror .agent-shared/rules=.claude/rules "$REPO")
check_contains "recognizes an aligned mirror" "$REPO/.agent-shared/rules -> $REPO/.claude/rules | status=aligned | declared=true" "$out"
check_not_contains "does not call an intentional mirror duplicate" "advisory duplicate-content" "$out"

echo "root symlink adapter"
fresh_repo
printf '# Agents\n' > "$REPO/AGENTS.md"
ln -s AGENTS.md "$REPO/CLAUDE.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "recognizes the root symlink" "$REPO/AGENTS.md -> $REPO/CLAUDE.md | status=symlink" "$out"
check_contains "counts Codex resident root content once" "codex_root_bytes=9" "$out"
check_contains "reports Claude adapter resident content separately" "claude_root_bytes=9" "$out"
check_not_contains "does not call the symlink duplicate" "advisory duplicate-content" "$out"

echo "root budget"
fresh_repo
awk 'BEGIN {for (i=0; i<34000; i++) printf "x"}' > "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports the default 32 KiB budget" "critical root-budget | $REPO/AGENTS.md bytes=34000 limit=32768" "$out"

echo "active and selected runtime budget"
fresh_repo
awk 'BEGIN {for (i=0; i<34000; i++) printf "x"}' > "$REPO/AGENTS.md"
printf '# Override\n' > "$REPO/AGENTS.override.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_not_contains "does not budget a shadowed Codex root" "critical root-budget" "$out"
mkdir -p "$REPO/.codex"
printf 'project_doc_max_bytes = 1024 # 32 KiB\n' > "$REPO/.codex/config.toml"
awk 'BEGIN {for (i=0; i<1500; i++) printf "x"}' > "$REPO/AGENTS.override.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "parses a budget with an inline TOML comment" "bytes=1500 limit=1024" "$out"
printf '# Claude\n' > "$REPO/CLAUDE.md"
chmod 000 "$REPO/.codex/config.toml"
out=$(bash "$SCRIPT" inspect --runtime claude "$REPO")
check_not_contains "Claude-only audit ignores unreadable Codex config" "unreadable-guidance" "$out"
check_not_contains "Claude-only audit ignores Codex budget" "root-budget" "$out"
chmod 600 "$REPO/.codex/config.toml"

echo "unreadable declared mirror"
fresh_repo
mkdir -p "$REPO/source" "$REPO/target"
printf '# Agents\n' > "$REPO/AGENTS.md"
printf '# Rule\n' > "$REPO/source/rule.md"
cp "$REPO/source/rule.md" "$REPO/target/rule.md"
chmod 400 "$REPO/source"
out=$(bash "$SCRIPT" inspect --runtime codex --mirror source=target "$REPO")
check_contains "reports an unsearchable declared mirror compactly" "critical adapter-drift" "$out"
chmod 700 "$REPO/source"

echo "duplicate content"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules"
printf '# Agents\n\nRead `.agent-shared/rules/a.md` and `.agent-shared/rules/b.md`.\n' > "$REPO/AGENTS.md"
printf '# Same\n' > "$REPO/.agent-shared/rules/a.md"
cp "$REPO/.agent-shared/rules/a.md" "$REPO/.agent-shared/rules/b.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "reports identical guidance" "advisory duplicate-content" "$out"

echo "unreadable required evidence"
fresh_repo
ln -s missing.md "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "reports a broken entrypoint symlink" "critical unreadable-guidance | $REPO/AGENTS.md (broken symlink)" "$out"
if bash "$SCRIPT" verify --runtime codex "$REPO" >/dev/null 2>&1; then
  echo "  FAIL: verify accepted a broken entrypoint symlink"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: verify rejects a broken entrypoint symlink"
fi

echo "large worktree output"
fresh_repo
printf '# Agents\n' > "$REPO/AGENTS.md"
REAL_GIT=$(command -v git)
mkdir -p "$REPO/bin"
printf '%s\n' '#!/usr/bin/env bash' 'if [[ "$*" == *"worktree list --porcelain"* ]]; then' "  printf 'worktree %s\\n' '$REPO'" '  i=0; while [[ $i -lt 9000 ]]; do printf "HEAD %040d\\n" "$i"; i=$((i + 1)); done' '  exit 0' 'fi' "exec '$REAL_GIT' \"\$@\"" > "$REPO/bin/git"
chmod +x "$REPO/bin/git"
out=$(PATH="$REPO/bin:$PATH" bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "consumes a large worktree listing without SIGPIPE" "root: $REPO" "$out"

echo "compact output caps"
fresh_repo
printf '# Agents\n' > "$REPO/AGENTS.md"
i=0
while [[ $i -lt 45 ]]; do mkdir -p "$REPO/dir-$i"; printf '# Nested\n' > "$REPO/dir-$i/AGENTS.md"; i=$((i + 1)); done
out=$(bash "$SCRIPT" inspect --runtime codex "$REPO")
check_contains "caps the entrypoint listing" "additional entrypoints omitted" "$out"
check_contains "caps unrouted findings" "additional findings omitted" "$out"

if [[ $FAILURES -ne 0 ]]; then
  echo "$FAILURES test(s) failed" >&2
  exit 1
fi
echo "all doctor IA tests passed"
