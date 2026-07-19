#!/usr/bin/env bash
set -euo pipefail

GUARD_CLEANUP_STATE=""

cleanup() {
  if [[ -n "${GUARD_CLEANUP_STATE:-}" ]]; then
    rm -f "$GUARD_CLEANUP_STATE"
  fi
}

trap cleanup EXIT

die() {
  printf 'verify-and-repair guard: %s\n' "$1" >&2
  exit 1
}

require_git() {
  git rev-parse --git-dir >/dev/null 2>&1 ||
    die "current directory is not inside a readable Git worktree"
}

worktree_roots() {
  local listing line primary current_git_dir candidate candidate_git_dir
  listing=$(git worktree list --porcelain) ||
    die "cannot inspect Git worktrees"
  primary=""
  current_git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) ||
    die "cannot resolve the current Git worktree"
  while IFS= read -r line; do
    case "$line" in
      "worktree "*)
        candidate=${line#worktree }
        if [[ -z "$primary" ]]; then primary=$candidate; fi
        candidate_git_dir=$(git -C "$candidate" rev-parse --absolute-git-dir 2>/dev/null) ||
          die "cannot inspect registered worktree: $candidate"
        if [[ "$candidate_git_dir" == "$current_git_dir" ]]; then
          printf '%s\n%s\n' "$primary" "$candidate"
          return
        fi
        ;;
    esac
  done <<<"$listing"
  die "current Git worktree is not registered"
}

index_tree() {
  git write-tree 2>/dev/null ||
    die "cannot capture the Git index; resolve its unreadable or unmerged state first"
}

changed_paths() {
  local workspace path count
  workspace=$1
  count=0
  printf 'changed_paths:\n'
  while IFS= read -r -d '' path; do
    printf '  %q\n' "$workspace/$path"
    count=$((count + 1))
  done < <(git diff --name-only -z HEAD --)
  while IFS= read -r -d '' path; do
    printf '  %q\n' "$workspace/$path"
    count=$((count + 1))
  done < <(git ls-files --others --exclude-standard -z)
  printf 'changed_path_count=%s\n' "$count"
}

read_state_value() {
  local state key value
  state=$1
  key=$2
  value=$(sed -n "s/^${key}=//p" "$state") ||
    die "cannot read guard state: $state"
  [[ -n "$value" ]] || die "guard state is missing ${key}: $state"
  printf '%s\n' "$value"
}

capture() {
  local roots repo_root workspace git_dir state head branch index
  require_git
  roots=$(worktree_roots)
  repo_root=$(sed -n '1p' <<<"$roots")
  workspace=$(sed -n '2p' <<<"$roots")
  git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) ||
    die "cannot resolve the current Git directory"
  state=$(mktemp "$git_dir/darrow-review-guard.XXXXXX") ||
    die "cannot create guard state in $git_dir"
  head=$(git rev-parse --verify HEAD 2>/dev/null) ||
    die "cannot resolve HEAD"
  branch=$(git symbolic-ref --short -q HEAD || :)
  if [[ -z "$branch" ]]; then branch="(detached)"; fi
  index=$(index_tree)
  {
    printf 'schema=1\n'
    printf 'repo_root=%s\n' "$repo_root"
    printf 'workspace=%s\n' "$workspace"
    printf 'head=%s\n' "$head"
    printf 'branch=%s\n' "$branch"
    printf 'index_tree=%s\n' "$index"
  } >"$state" || die "cannot write guard state: $state"
  printf 'guard=%s\nhead=%s\nbranch=%s\n' "$state" "$head" "$branch"
  changed_paths "$workspace"
}

validate() {
  local state state_dir state_name git_dir schema expected_workspace
  local expected_head expected_branch expected_index roots workspace head
  local branch index failed
  state=${1:-}
  [[ -n "$state" ]] || die "validate requires the guard path printed by capture"
  [[ "$state" == /* ]] || die "guard path must be absolute: $state"
  [[ -r "$state" ]] || die "guard state is unreadable: $state"
  require_git
  git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) ||
    die "cannot resolve the current Git directory"
  state_dir=$(CDPATH= cd -- "$(dirname -- "$state")" 2>/dev/null && pwd -P) ||
    die "cannot resolve guard state directory: $state"
  state_name=$(basename -- "$state")
  [[ "$state_dir" == "$git_dir" && "$state_name" == darrow-review-guard.?????? ]] ||
    die "guard state is outside the current Git worktree or has an invalid name: $state"
  state="$state_dir/$state_name"
  schema=$(read_state_value "$state" schema)
  [[ "$schema" == "1" ]] || die "guard state has unsupported schema: $state"
  expected_workspace=$(read_state_value "$state" workspace)
  expected_head=$(read_state_value "$state" head)
  expected_branch=$(read_state_value "$state" branch)
  expected_index=$(read_state_value "$state" index_tree)
  GUARD_CLEANUP_STATE=$state
  roots=$(worktree_roots)
  workspace=$(sed -n '2p' <<<"$roots")
  head=$(git rev-parse --verify HEAD 2>/dev/null) || die "cannot resolve HEAD"
  branch=$(git symbolic-ref --short -q HEAD || :)
  if [[ -z "$branch" ]]; then branch="(detached)"; fi
  index=$(index_tree)
  failed=0
  if [[ "$workspace" != "$expected_workspace" ]]; then
    printf 'verify-and-repair guard: workspace changed from %s to %s\n' \
      "$expected_workspace" "$workspace" >&2
    failed=1
  fi
  if [[ "$head" != "$expected_head" ]]; then
    printf 'verify-and-repair guard: HEAD changed from %s to %s\n' \
      "$expected_head" "$head" >&2
    failed=1
  fi
  if [[ "$branch" != "$expected_branch" ]]; then
    printf 'verify-and-repair guard: active branch changed from %s to %s\n' \
      "$expected_branch" "$branch" >&2
    failed=1
  fi
  if [[ "$index" != "$expected_index" ]]; then
    printf 'verify-and-repair guard: Git index state changed\n' >&2
    failed=1
  fi
  if [[ "$failed" -ne 0 ]]; then return 1; fi
  printf 'git_boundary=preserved\nhead=%s\nbranch=%s\n' "$head" "$branch"
  changed_paths "$workspace"
}

case "${1:-}" in
  capture)
    [[ "$#" -eq 1 ]] || die "capture accepts no arguments"
    capture
    ;;
  validate)
    [[ "$#" -eq 2 ]] || die "validate requires exactly one guard path"
    validate "$2"
    ;;
  *)
    die "usage: workspace-guard.sh capture | validate <absolute-guard-path>"
    ;;
esac
