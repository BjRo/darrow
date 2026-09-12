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

check_verify() {
  local name=$1 expected=$2 runtime=$3 status
  out=$(bash "$SCRIPT" verify --runtime "$runtime" "$REPO" 2>&1)
  status=$?
  if [[ $status -eq $expected ]]; then
    echo "  ok: $name"
  else
    echo "  FAIL: $name (exit $status, expected $expected)"
    printf '%s\n' "$out"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "deferred guidance outside native directories"
fresh_repo
mkdir -p "$REPO/docs/agent-guidance" "$REPO/ordinary" "$REPO/src"
printf 'Read `docs/agent-guidance/map.md` before API work.\n' > "$REPO/AGENTS.md"
printf 'Read `ordinary/map.md` before API work.\n' > "$REPO/docs/agent-guidance/map.md"
printf 'Read `docs/agent-guidance/missing.md` before API work.\n' > "$REPO/ordinary/map.md"
check_verify "rejects a broken route through deferred maps" 1 codex
check_contains "identifies the transitive missing target" "critical broken-reference | $REPO/ordinary/map.md -> $REPO/docs/agent-guidance/missing.md" "$out"
printf '# API policy\n' > "$REPO/docs/agent-guidance/missing.md"
check_verify "accepts the repaired deferred chain" 0 codex
printf 'Read `docs/agent-guidance/map.md`.\n' > "$REPO/docs/agent-guidance/missing.md"
check_verify "detects a cycle outside native directories" 1 codex
check_contains "reports the deferred cycle" "critical instruction-cycle" "$out"
printf 'Read `src/example.sh`.\nSee `ordinary/background.md` for background.\n' > "$REPO/docs/agent-guidance/missing.md"
printf '# Read `docs/missing-from-source.md`.\n' > "$REPO/src/example.sh"
printf 'Read `docs/missing-from-background.md`.\n' > "$REPO/ordinary/background.md"
check_verify "does not parse source code or incidental documentation as guidance" 0 codex
check_not_contains "source and background routes stay unparsed" "missing-from-" "$out"

echo "complete route traversal"
fresh_repo
mkdir -p "$REPO/docs/agent-guidance"
printf 'Read `docs/agent-guidance/1.md`.\n' > "$REPO/AGENTS.md"
i=1
while [[ $i -le 10 ]]; do
  printf 'Read `docs/agent-guidance/%s.md`.\n' "$((i + 1))" > "$REPO/docs/agent-guidance/$i.md"
  i=$((i + 1))
done
check_verify "rejects a broken dependency beyond eight hops" 1 codex
check_contains "checks the end of the chain" "critical broken-reference | $REPO/docs/agent-guidance/10.md -> $REPO/docs/agent-guidance/11.md" "$out"

echo "native imports"
fresh_repo
mkdir -p "$REPO/.agent-shared/rules" "$REPO/src"
printf 'Read `.agent-shared/rules/api.md`.\n' > "$REPO/AGENTS.md"
printf '@AGENTS.md\n' > "$REPO/CLAUDE.md"
printf '# API\n' > "$REPO/.agent-shared/rules/api.md"
check_verify "accepts the documented bare Claude adapter" 0 both
check_contains "records the bare import route" "$REPO/CLAUDE.md -> $REPO/AGENTS.md" "$out"
printf '@local.md\n' > "$REPO/src/CLAUDE.md"
printf '# Local policy\n' > "$REPO/src/local.md"
check_verify "resolves nested bare imports from their importing file" 0 both
check_contains "records a source-relative import" "$REPO/src/CLAUDE.md -> $REPO/src/local.md" "$out"
rm "$REPO/src/local.md"
printf '# Root lookalike\n' > "$REPO/local.md"
check_verify "does not substitute a root lookalike for a missing native import" 1 claude
check_contains "reports the actual missing import path" "$REPO/src/CLAUDE.md -> $REPO/src/local.md" "$out"

echo "skill bundle resources"
fresh_repo
mkdir -p "$REPO/.agents/skills/check/references" "$REPO/references"
printf 'For checks, read `.agents/skills/check/SKILL.md`.\n' > "$REPO/AGENTS.md"
printf '%s\n' '---' 'name: check' 'description: Check the repository.' '---' 'Read `references/guide.md`.' > "$REPO/.agents/skills/check/SKILL.md"
printf 'Read `references/detail.md`.\n' > "$REPO/.agents/skills/check/references/guide.md"
printf '# Details\n' > "$REPO/.agents/skills/check/references/detail.md"
check_verify "accepts valid skill-relative resources without root counterparts" 0 codex
check_not_contains "does not report bundle resources as ordinary paths" "critical nonroot-path" "$out"
printf 'Read `docs/missing-lookalike.md`.\n' > "$REPO/references/guide.md"
check_verify "uses skill-owned resources including deferred references" 0 codex
check_contains "records the bundle-relative route" "$REPO/.agents/skills/check/SKILL.md -> $REPO/.agents/skills/check/references/guide.md" "$out"
check_not_contains "does not prefer repository lookalikes" "missing-lookalike" "$out"
rm "$REPO/.agents/skills/check/references/guide.md"
check_verify "rejects a missing bundle resource despite a root lookalike" 1 codex
check_contains "reports the missing bundle path" "$REPO/.agents/skills/check/SKILL.md -> $REPO/.agents/skills/check/references/guide.md" "$out"

echo "selected-runtime verification scope"
fresh_repo
mkdir -p "$REPO/.claude/rules" "$REPO/src"
printf '# Claude\n' > "$REPO/CLAUDE.md"
printf 'Read `docs/codex-missing.md`.\n' > "$REPO/AGENTS.md"
printf 'Read `docs/nested-codex-missing.md`.\n' > "$REPO/src/AGENTS.md"
check_verify "Claude ignores unrelated Codex entrypoint defects" 0 claude
check_contains "still inventories the unselected root" "$REPO/AGENTS.md | scope=root" "$out"
check_verify "both runtimes expose the Codex defect" 1 both
printf '@AGENTS.md\n' > "$REPO/CLAUDE.md"
check_verify "Claude checks Codex guidance reached through an import" 1 claude
check_contains "reports the imported defect" "$REPO/AGENTS.md -> $REPO/docs/codex-missing.md" "$out"
printf '# Agents\n' > "$REPO/AGENTS.md"
rm "$REPO/src/AGENTS.md"
printf 'Read `docs/claude-missing.md`.\n' > "$REPO/CLAUDE.md"
printf 'Read `docs/native-missing.md`.\n' > "$REPO/.claude/rules/api.md"
printf 'Read `docs/nested-claude-missing.md`.\n' > "$REPO/src/CLAUDE.md"
check_verify "Codex ignores unrelated Claude entrypoints and native rules" 0 codex
check_verify "Claude verifies selected native guidance" 1 claude
check_contains "checks Claude native rules" "$REPO/.claude/rules/api.md -> $REPO/docs/native-missing.md" "$out"
check_contains "checks Claude nested guidance" "$REPO/src/CLAUDE.md -> $REPO/docs/nested-claude-missing.md" "$out"
printf '# Override\n' > "$REPO/AGENTS.override.md"
printf 'Read `docs/shadowed-missing.md`.\n' > "$REPO/AGENTS.md"
check_verify "Codex ignores its shadowed root" 0 codex
printf 'Read `AGENTS.md`.\n' > "$REPO/AGENTS.override.md"
check_verify "explicitly routed shadowed guidance is checked" 1 codex
printf '# Override\n' > "$REPO/AGENTS.override.md"
rm "$REPO/CLAUDE.md"
ln -s missing.md "$REPO/CLAUDE.md"
check_verify "unselected broken symlinks remain inventory only" 0 codex
check_verify "selected broken symlinks still block" 1 claude
check_contains "reports unreadable selected guidance" "critical unreadable-guidance | $REPO/CLAUDE.md (broken symlink)" "$out"

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

echo "declared mirror dependencies"
fresh_repo
mkdir -p "$REPO/.claude/rules" "$REPO/mirror" "$REPO/docs"
printf '# Agents\n' > "$REPO/AGENTS.md"
printf 'Before API work, read `docs/missing.md`.\n' > "$REPO/.claude/rules/api.md"
cp "$REPO/.claude/rules/api.md" "$REPO/mirror/api.md"
if out=$(bash "$SCRIPT" verify --runtime codex --mirror .claude/rules=mirror "$REPO"); then
  echo "  FAIL: verify accepted a broken dependency in a declared mirror"
  FAILURES=$((FAILURES + 1))
else
  echo "  ok: declared mirror dependencies block verification"
fi
check_contains "parses declared mirrors even outside the selected native runtime" "critical broken-reference | $REPO/.claude/rules/api.md -> $REPO/docs/missing.md" "$out"
printf '# Shared policy\n' > "$REPO/docs/missing.md"
if bash "$SCRIPT" verify --runtime codex --mirror .claude/rules=mirror "$REPO" >/dev/null; then
  echo "  ok: repaired declared mirror dependencies verify"
else
  echo "  FAIL: verify rejected repaired declared mirror dependencies"
  FAILURES=$((FAILURES + 1))
fi

echo "root symlink adapter"
fresh_repo
printf '# Agents\n' > "$REPO/AGENTS.md"
ln -s AGENTS.md "$REPO/CLAUDE.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "recognizes the root symlink" "$REPO/AGENTS.md -> $REPO/CLAUDE.md | status=symlink" "$out"
check_contains "counts Codex resident root content once" "codex_root_bytes=9" "$out"
check_contains "reports Claude adapter resident content separately" "claude_root_bytes=9" "$out"
check_not_contains "does not call the symlink duplicate" "advisory duplicate-content" "$out"

echo "reverse root symlink adapter"
fresh_repo
printf '# Claude\n' > "$REPO/CLAUDE.md"
ln -s CLAUDE.md "$REPO/AGENTS.md"
check_verify "accepts a Claude-canonical symlink adapter" 0 both
check_contains "reports Claude as source and Codex as adapter" "$REPO/CLAUDE.md -> $REPO/AGENTS.md | status=symlink" "$out"
check_contains "counts Codex reverse-adapter content" "codex_root_bytes=9" "$out"
check_contains "counts canonical Claude content" "claude_root_bytes=9" "$out"
check_not_contains "does not call the reverse adapter duplicate" "advisory duplicate-content" "$out"
rm "$REPO/AGENTS.md"
cp "$REPO/CLAUDE.md" "$REPO/AGENTS.md"
out=$(bash "$SCRIPT" inspect "$REPO")
check_contains "independent root copies still count as duplicates" "advisory duplicate-content" "$out"
check_not_contains "independent root copies are not symlink adapters" "status=symlink" "$out"

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
