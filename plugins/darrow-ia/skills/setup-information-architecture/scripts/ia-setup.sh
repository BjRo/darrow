#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "usage: ia-setup.sh inspect [repository]" >&2
  exit 64
}

resolve_root() {
  local target=${1:-.} line
  if [[ ! -d "$target" || ! -r "$target" ]]; then
    echo "error: repository path is not a readable directory: $target" >&2
    exit 2
  fi
  line=$(git -C "$target" worktree list --porcelain 2>/dev/null | awk 'NR==1 && $1=="worktree" {sub(/^worktree /, ""); print; exit}')
  if [[ -n "$line" ]]; then
    printf '%s' "$line"
  else
    (cd "$target" && pwd -P)
  fi
}

print_group() {
  local label=$1 count=0 path rel
  shift
  echo "$label:"
  find "$ROOT" "$@" -print 2>/dev/null |
    LC_ALL=C sort |
    while IFS= read -r path; do
      count=$((count + 1))
      rel=${path#"$ROOT"/}
      if [[ $count -le 40 ]]; then printf '  - %s\n' "$rel"; fi
      if [[ $count -eq 41 ]]; then echo "  - ..."; fi
    done
}

[[ ${1:-} == "inspect" ]] || usage
ROOT=$(resolve_root "${2:-.}")

echo "root: $ROOT"
echo "entrypoints:"
find "$ROOT" \( -type f -o -type l \) \( -name 'AGENTS.md' -o -name 'AGENTS.override.md' -o -name 'CLAUDE.md' -o -name 'CLAUDE.local.md' \) \
  -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/.worktrees/*' -print 2>/dev/null |
  LC_ALL=C sort |
  while IFS= read -r file; do
    bytes=$(wc -c < "$file" | tr -d ' ')
    rel=${file#"$ROOT"/}
    [[ "$file" == "$ROOT" ]] && rel=.
    printf '  - %s | bytes=%s | approx_tokens=%s\n' "$rel" "$bytes" "$(( (bytes + 3) / 4 ))"
  done

print_group "runtime_adapters" -type d "(" -name .claude -o -name .agents -o -name .codex -o -name .pi ")" -not -path '*/.git/*' -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/.worktrees/*'
print_group "manifests" -maxdepth 3 -type f "(" -name package.json -o -name pyproject.toml -o -name Cargo.toml -o -name go.mod -o -name pom.xml -o -name build.gradle -o -name Makefile ")" -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/.worktrees/*'
print_group "automation" -maxdepth 4 -type f "(" -path '*/.github/workflows/*' -o -name lefthook.yml -o -name lefthook.yaml -o -name .pre-commit-config.yaml -o -name hooks.json ")" -not -path '*/node_modules/*' -not -path '*/.claude/worktrees/*' -not -path '*/.worktrees/*'
print_group "skills" -type f -name SKILL.md -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.claude/worktrees/*' -not -path '*/.worktrees/*'
print_group "guidance_candidates" -type f -name '*.md' "(" -path '*/rules/*' -o -path '*/agent*/*' -o -path '*/docs/*' ")" -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.claude/worktrees/*' -not -path '*/.worktrees/*'
