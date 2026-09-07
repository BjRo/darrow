#!/usr/bin/env bash
# Deterministic Git mechanics for prepare-task-branch.
set -euo pipefail

truncate_lines() { awk 'NR<=50'; }
in_progress() {
  local repo=${1:-.} path
  for path in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
    if [[ -e "$(git -C "$repo" rev-parse --git-path "$path")" ]]; then
      return 0
    fi
  done
  [[ -n "$(git -C "$repo" ls-files -u -- ':/')" ]]
}
current_ref() {
  git symbolic-ref -q --short HEAD ||
    echo "(detached @ $(git rev-parse --short HEAD))"
}
main_worktree() {
  local listing line
  listing=$(git worktree list --porcelain)
  while IFS= read -r line; do
    case "$line" in
      "worktree "*)
        printf '%s\n' "${line#worktree }"
        return 0
        ;;
    esac
  done <<< "$listing"
}
worktree_for_branch() {
  local wanted=$1 listing line path="" branch=""
  listing=$(git worktree list --porcelain)
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) path=${line#worktree } ;;
      "branch "*) branch=${line#branch refs/heads/} ;;
      "")
        if [[ "$branch" == "$wanted" ]]; then
          printf '%s\n' "$path"
          return 0
        fi
        path=""
        branch=""
        ;;
    esac
  done <<< "$listing"
  if [[ "$branch" == "$wanted" ]]; then
    printf '%s\n' "$path"
  fi
}
common_git_dir() {
  local repo=$1 dir
  dir=$(git -C "$repo" rev-parse --git-common-dir 2>/dev/null) || return 1
  [[ "$dir" == /* ]] || dir="$repo/$dir"
  (cd "$dir" 2>/dev/null && pwd -P)
}
remove_created_parents() {
  local path=$1 existing_ancestor=$2
  while [[ -n "$path" && "$path" != "$existing_ancestor" ]]; do
    rmdir "$path" 2>/dev/null || return 0
    path=$(dirname "$path")
  done
}
default_branch() {
  local branch
  branch=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$branch" ]]; then
    echo "${branch#origin/}"
    return
  fi
  for branch in main master; do
    if git show-ref -q --verify "refs/heads/$branch"; then
      echo "$branch"
      return
    fi
  done
  echo "(none)"
}
validate_name() {
  local name=$1 ticket_token=$2 slug token_count suffix
  if ! [[ "$ticket_token" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]*$ ]]; then
    echo "error: ticket token contains unsupported branch characters: $ticket_token" >&2
    exit 5
  fi
  if ! [[ "$name" =~ ^(feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert)/.+$ ]] ||
    ! git check-ref-format --branch "$name" >/dev/null 2>&1; then
    echo "error: branch name must be <type>/<opaque-token>-<kebab-suffix>: $name" >&2
    exit 5
  fi
  slug=${name#*/}
  if [[ "$slug" != "$ticket_token"-* ]]; then
    echo "error: branch must lead with the supplied ticket token exactly: $name" >&2
    exit 5
  fi
  token_count=$(printf '%s\n' "$slug" | grep -oF -- "$ticket_token" | wc -l | tr -d '[:space:]')
  if [[ "$token_count" != 1 ]]; then
    echo "error: supplied ticket token must occur exactly once: $name" >&2
    exit 5
  fi
  suffix=${slug#"$ticket_token"-}
  if ! [[ "$suffix" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    echo "error: branch suffix must be lowercase kebab-case: $name" >&2
    exit 5
  fi
  if [[ ${#name} -gt 60 ]]; then
    echo "error: branch name exceeds 60 chars (${#name})" >&2
    exit 5
  fi
}

if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]]; then
  echo "error: not inside a git work tree" >&2
  exit 3
fi

command=${1:-}
shift || true

case "$command" in
  inspect)
    if in_progress; then
      echo "## mode: conflict (merge/rebase/cherry-pick in progress — do not switch; inform the user)"
      echo "## unmerged files"
      git diff --name-only --diff-filter=U | truncate_lines
      exit 0
    fi
    echo "## mode: ready"
    echo "## current branch: $(current_ref)"
    echo "## default branch: $(default_branch)"
    echo "## working tree (compatible uncommitted changes travel unchanged)"
    status=$(git status --porcelain)
    if [[ -z "$status" ]]; then
      echo "clean"
    else
      printf '%s\n' "$status" | truncate_lines
    fi
    echo "## local branches"
    git for-each-ref --sort=refname --format='%(refname:lstrip=2)' refs/heads | truncate_lines
    ;;
  prepare)
    name=""
    base=""
    ticket_token=""
    worktree=0
    at_path=""
    at_set=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --from)
          if [[ $# -lt 2 ]]; then
            echo "error: --from needs a value" >&2
            exit 2
          fi
          base=$2
          shift 2
          ;;
        --ticket-token)
          if [[ $# -lt 2 || -z "$2" ]]; then
            echo "error: --ticket-token needs a non-empty opaque value" >&2
            exit 2
          fi
          ticket_token=$2
          shift 2
          ;;
        --worktree)
          worktree=1
          shift
          ;;
        --at)
          if [[ $# -lt 2 || -z "$2" ]]; then
            echo "error: --at needs a non-empty path" >&2
            exit 2
          fi
          at_path=$2
          at_set=1
          shift 2
          ;;
        -*)
          echo "error: unknown flag: $1" >&2
          exit 2
          ;;
        *)
          if [[ -n "$name" ]]; then
            echo "error: exactly one branch name allowed" >&2
            exit 2
          fi
          name=$1
          shift
          ;;
      esac
    done
    if [[ -z "$name" ]]; then
      echo "error: no branch name given" >&2
      exit 2
    fi
    if [[ -z "$ticket_token" ]]; then
      echo "error: prepare requires the active provider's opaque ticket token" >&2
      exit 2
    fi
    if [[ $at_set -eq 1 && $worktree -eq 0 ]]; then
      echo "error: --at requires --worktree" >&2
      exit 2
    fi
    if in_progress; then
      echo "error: merge/rebase/cherry-pick in progress — resolve it first; do not switch" >&2
      exit 8
    fi
    if ! git rev-parse -q --verify HEAD >/dev/null 2>&1; then
      echo "error: repository has no commits yet — make the first commit before branching" >&2
      exit 3
    fi
    validate_name "$name" "$ticket_token"

    exact=$(git for-each-ref refs/heads --format='%(refname:lstrip=2)' | grep -xF -- "$name" || true)
    collision=$(git for-each-ref refs/heads --format='%(refname:lstrip=2)' | grep -ixF -- "$name" || true)
    if [[ -z "$exact" && -n "$collision" ]]; then
      echo "error: branch name differs only by case from existing branch: $collision" >&2
      exit 9
    fi
    if [[ $worktree -eq 1 ]]; then
      default_parent=""
      existing_ancestor=""
      exclude=""
      exclude_needs_append=0
      existing_path=$(worktree_for_branch "$name")
      if [[ -n "$existing_path" ]]; then
        if [[ ! -d "$existing_path" ]] ||
          [[ "$(git -C "$existing_path" rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]] ||
          [[ "$(git -C "$existing_path" symbolic-ref -q HEAD 2>/dev/null || true)" != "refs/heads/$name" ]] ||
          [[ "$(common_git_dir "$existing_path" || true)" != "$(common_git_dir . || true)" ]]; then
          echo "error: registered task worktree is missing, inaccessible, or inconsistent: $existing_path" >&2
          exit 9
        fi
        if in_progress "$existing_path"; then
          echo "error: merge/rebase/cherry-pick in progress in prepared worktree $existing_path — resolve it first" >&2
          exit 8
        fi
        current_top=$(git rev-parse --show-toplevel)
        if [[ "$existing_path" == "$current_top" ]]; then
          echo "error: branch is already active in the current checkout and cannot also be attached to a linked worktree: $name" >&2
          exit 9
        fi
        if [[ $at_set -eq 1 ]]; then
          requested=$at_path
          [[ "$requested" == /* ]] || requested="$PWD/$requested"
          if [[ "$requested" != "$existing_path" ]]; then
            echo "error: branch is already checked out in another worktree: $existing_path" >&2
            exit 9
          fi
        fi
        echo "## mode: worktree-current"
        echo "$name (at $(git rev-parse "refs/heads/$name")) in $existing_path"
        exit 0
      fi
      if [[ $at_set -eq 1 ]]; then
        path=$at_path
        [[ "$path" == /* ]] || path="$PWD/$path"
      else
        path="$(main_worktree)/.worktrees/$name"
      fi
      probe=$path
      while [[ ${#probe} -gt 1 && "$probe" == */ ]]; do probe=${probe%/}; done
      if [[ -e "$probe" || -L "$probe" ]]; then
        echo "error: path already exists: $path — will not reuse it" >&2
        exit 9
      fi
      gitdir=$(cd "$(git rev-parse --git-dir)" && pwd)
      case "$path" in
        "$gitdir"|"$gitdir"/*)
          echo "error: worktree path is inside the .git directory: $path" >&2
          exit 2
          ;;
      esac
      if [[ -n "$base" ]] && ! git rev-parse --verify -q "$base^{commit}" >/dev/null; then
        echo "error: base not found: $base" >&2
        exit 2
      fi
      from=$(current_ref)
      [[ -z "$base" ]] || from=$base
      pre_status=$(git status --porcelain)
      if [[ $at_set -eq 0 ]]; then
        default_parent=$(dirname "$path")
        existing_ancestor=$default_parent
        while [[ ! -e "$existing_ancestor" ]]; do
          parent=$(dirname "$existing_ancestor")
          [[ "$parent" != "$existing_ancestor" ]] || break
          existing_ancestor=$parent
        done
        output=$(mkdir -p "$default_parent" 2>&1) || {
          echo "error: cannot create worktree parent dir: $output" >&2
          exit 9
        }
        exclude=$(git rev-parse --git-path info/exclude)
        if [[ -e "$exclude" && ! -r "$exclude" ]]; then
          echo "error: repository exclude file is unreadable: $exclude" >&2
          remove_created_parents "$default_parent" "$existing_ancestor"
          exit 9
        fi
        output=$(mkdir -p "$(dirname "$exclude")" 2>&1) || {
          echo "error: cannot prepare repository exclude directory: $output" >&2
          remove_created_parents "$default_parent" "$existing_ancestor"
          exit 9
        }
        exclude_status=0
        grep -qxF '/.worktrees/' "$exclude" 2>/dev/null || exclude_status=$?
        if [[ $exclude_status -gt 1 ]]; then
          echo "error: cannot inspect repository exclude file: $exclude" >&2
          remove_created_parents "$default_parent" "$existing_ancestor"
          exit 9
        fi
        if [[ $exclude_status -eq 1 ]]; then
          if [[ ! -w "$exclude" ]]; then
            echo "error: repository exclude file is not writable: $exclude" >&2
            remove_created_parents "$default_parent" "$existing_ancestor"
            exit 9
          fi
          exclude_needs_append=1
        fi
      fi
      if [[ -n "$exact" ]]; then
        output=$(git worktree add "$path" "$name" 2>&1) || {
          remove_created_parents "$default_parent" "$existing_ancestor"
          echo "$output" >&2
          exit 4
        }
        result_mode="worktree-reused"
        result_evidence="$name (at $(git rev-parse "refs/heads/$name")) in $path"
      else
        output=$(git worktree add "$path" -b "$name" ${base:+"$base"} 2>&1) || {
          remove_created_parents "$default_parent" "$existing_ancestor"
          echo "$output" >&2
          exit 4
        }
        result_mode="worktree-created"
        result_evidence="$name (from $from) in $path"
      fi
      if [[ $exclude_needs_append -eq 1 ]]; then
        if ! printf '%s\n' '/.worktrees/' >> "$exclude"; then
          echo "error: worktree prepared but cannot update repository exclude file: $exclude" >&2
          exit 9
        fi
      fi
      echo "## mode: $result_mode"
      echo "$result_evidence"
      if [[ -n "$pre_status" ]]; then
        echo "## note: uncommitted changes stay in the current worktree — they were not carried into $path"
      fi
      if [[ $at_set -eq 1 ]]; then
        ignore_status=0
        git check-ignore -q -- "$path" 2>/dev/null || ignore_status=$?
        if [[ $ignore_status -eq 1 ]]; then
          echo "## note: $path is inside the repository and not ignored — git status will list it; consider adding it to .git/info/exclude"
        fi
      fi
      exit 0
    fi
    current=$(git symbolic-ref -q HEAD || true)
    current=${current#refs/heads/}
    if [[ "$current" == "$name" ]]; then
      echo "## mode: current"
      echo "$name (at $(git rev-parse "refs/heads/$name"))"
      exit 0
    fi
    if [[ -n "$exact" ]]; then
      output=$(git switch --no-guess "$name" 2>&1) || {
        echo "$output" >&2
        exit 4
      }
      echo "## mode: reused"
      echo "$name (at $(git rev-parse "refs/heads/$name"))"
      exit 0
    fi
    if [[ -n "$base" ]] && ! git rev-parse --verify -q "$base^{commit}" >/dev/null; then
      echo "error: base not found: $base" >&2
      exit 2
    fi
    from=$(current_ref)
    [[ -z "$base" ]] || from=$base
    output=$(git switch -c "$name" ${base:+"$base"} 2>&1) || {
      echo "$output" >&2
      exit 4
    }
    echo "## mode: created"
    echo "$name (from $from)"
    ;;
  *)
    echo "usage: branch.sh inspect | prepare <name> --ticket-token <opaque-token> [--from <base>] [--worktree [--at <path>]]" >&2
    exit 64
    ;;
esac
