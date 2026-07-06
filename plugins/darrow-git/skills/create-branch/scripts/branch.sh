#!/usr/bin/env bash
# Deterministic git steps for the create-branch skill.
# stdout is read by a model: print only decision-relevant data, never raw
# intermediate git output. Checkable invariants (naming convention, no
# clobbering, in-progress guard) are enforced here, not in the prompt.
set -euo pipefail

truncate_lines() { awk 'NR<=50'; }
# Unmerged index entries alone miss resolved-but-uncontinued merges,
# rebase stopped at edit/break, and am conflicts — and ls-files is
# cwd-scoped, so check the operation state files too.
in_progress() {
  local p
  for p in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD rebase-merge rebase-apply; do
    if [[ -e "$(git rev-parse --git-path "$p")" ]]; then
      return 0
    fi
  done
  [[ -n "$(git ls-files -u -- ':/')" ]]
}
current_ref() { git symbolic-ref -q --short HEAD || echo "(detached @ $(git rev-parse --short HEAD))"; }
default_branch() {
  local b
  b=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$b" ]]; then
    echo "${b#origin/}"
    return
  fi
  for b in main master; do
    if git show-ref -q --verify "refs/heads/$b"; then
      echo "$b"
      return
    fi
  done
  echo "(none)"
}

if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" != "true" ]]; then
  echo "error: not inside a git work tree" >&2
  exit 3
fi

cmd=${1:-}
shift || true

case "$cmd" in
  inspect)
    if in_progress; then
      echo "## mode: conflict (merge/rebase/cherry-pick in progress — do not branch; inform the user)"
      echo "## unmerged files"
      git diff --name-only --diff-filter=U | truncate_lines
    else
      echo "## mode: ready"
      echo "## current branch: $(current_ref)"
      echo "## default branch: $(default_branch)"
      echo "## working tree (uncommitted changes travel to the new branch)"
      status=$(git status --porcelain)
      if [[ -z "$status" ]]; then
        echo "clean"
      else
        printf '%s\n' "$status" | truncate_lines
      fi
      echo "## recent branches (match their naming style)"
      git for-each-ref --count=10 --sort=-committerdate --format='%(refname:short)' refs/heads
      # Every worktree other than the current one — run from a linked
      # worktree, the main checkout is "elsewhere" too, and this one is not.
      cur_top=$(git rev-parse --show-toplevel)
      others=$(git worktree list --porcelain | awk -v cur="$cur_top" '
        /^worktree /{p=substr($0,10)}
        /^branch /{b=$2; sub("refs/heads/","",b)}
        /^detached$/{b="(detached)"}
        /^bare$/{b="(bare)"}
        /^$/{if (p!="" && p!=cur) print p" ["b"]"; p=""; b=""}
        END{if (p!="" && p!=cur) print p" ["b"]"}')
      if [[ -n "$others" ]]; then
        echo "## other worktrees (their branches are checked out elsewhere)"
        printf '%s\n' "$others" | truncate_lines
      fi
    fi
    ;;
  create)
    # create <name> [--from <base>] [--worktree [--at <path>]]
    name=""
    base=""
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
        --worktree)
          worktree=1
          shift
          ;;
        --at)
          if [[ $# -lt 2 ]]; then
            echo "error: --at needs a value" >&2
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
    if [[ $at_set -eq 1 && $worktree -eq 0 ]]; then
      echo "error: --at requires --worktree" >&2
      exit 2
    fi
    # An empty --at must not fall through to the default path — a
    # user-named location is used verbatim or rejected, never substituted.
    if [[ $at_set -eq 1 && -z "$at_path" ]]; then
      echo "error: --at needs a non-empty path" >&2
      exit 2
    fi
    if in_progress; then
      echo "error: merge/rebase/cherry-pick in progress — resolve it first; do not branch" >&2
      exit 8
    fi
    if ! git rev-parse -q --verify HEAD >/dev/null 2>&1; then
      echo "error: repository has no commits yet — make the first commit before branching" >&2
      exit 3
    fi
    if ! [[ "$name" =~ ^(feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert)/[A-Za-z0-9]+(-[A-Za-z0-9]+)*$ ]]; then
      echo "error: branch name must be <type>/<kebab-slug>: $name" >&2
      exit 5
    fi
    # Segments lowercase; all-caps only as a ticket id, i.e. a CAPS segment
    # immediately followed by its number (DAR-123).
    slug=${name#*/}
    IFS='-' read -ra segs <<< "$slug"
    for i in "${!segs[@]}"; do
      s=${segs[$i]}
      if [[ "$s" =~ ^[a-z0-9]+$ ]]; then
        continue
      fi
      next=${segs[$((i + 1))]:-}
      if [[ "$s" =~ ^[A-Z]+$ ]] && [[ "$next" =~ ^[0-9]+$ ]]; then
        continue
      fi
      echo "error: slug segments must be lowercase (ticket ids like DAR-123 may be caps): $name" >&2
      exit 5
    done
    if [[ ${#name} -gt 60 ]]; then
      echo "error: branch name exceeds 60 chars (${#name})" >&2
      exit 5
    fi
    # Case-insensitive exists-check: on case-insensitive filesystems a
    # case-variant loose ref shadows a packed ref, silently redirecting the
    # existing branch to the new tip.
    collision=$(git for-each-ref refs/heads --format='%(refname:short)' | grep -ixF -- "$name" || true)
    if [[ -n "$collision" ]]; then
      echo "error: branch already exists: $collision — will not reuse or reset it" >&2
      exit 9
    fi
    if [[ -n "$base" ]] && ! git rev-parse --verify -q "$base^{commit}" >/dev/null; then
      echo "error: base not found: $base" >&2
      exit 2
    fi
    from=$(current_ref)
    [[ -z "$base" ]] || from=$base
    if [[ $worktree -eq 1 ]]; then
      if [[ $at_set -eq 1 ]]; then
        path=$at_path
        # A worktree inside .git corrupts expectations of every git tool.
        # Best-effort prefix check, not a full canonicalization.
        abs=$path
        [[ "$abs" == /* ]] || abs="$PWD/$abs"
        gitdir=$(cd "$(git rev-parse --git-dir)" && pwd)
        case "$abs" in
          "$gitdir"|"$gitdir"/*)
            echo "error: worktree path is inside the .git directory: $path" >&2
            exit 2
            ;;
        esac
      else
        # Anchor at the main worktree root: --show-toplevel inside a linked
        # worktree would nest worktrees, and removing the outer one takes
        # the inner working tree with it.
        main_root=$(git worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')
        path="$main_root/.worktrees/$name"
      fi
      # [[ -e "file/" ]] is false for a regular file — strip trailing
      # slashes so the clobber check sees it.
      probe=$path
      while [[ ${#probe} -gt 1 && "$probe" == */ ]]; do probe=${probe%/}; done
      if [[ -e "$probe" || -L "$probe" ]]; then
        echo "error: path already exists: $path — will not reuse it" >&2
        exit 9
      fi
      if [[ $at_set -eq 0 ]]; then
        err=$(mkdir -p "$(dirname "$path")" 2>&1) || {
          echo "error: cannot create worktree parent dir: $err" >&2
          exit 9
        }
        # Keep the default location out of git status. info/exclude is
        # shared across worktrees and never a tracked file; the anchored
        # pattern applies at each worktree's root.
        exclude=$(git rev-parse --git-path info/exclude)
        if mkdir -p "$(dirname "$exclude")" 2>/dev/null; then
          grep -qxF '/.worktrees/' "$exclude" 2>/dev/null || echo '/.worktrees/' >> "$exclude" || true
        fi
      fi
      # Status before the add: a non-ignored worktree dir must not show up
      # as "uncommitted changes" of its own creation.
      pre_status=$(git status --porcelain)
      out=$(git worktree add "$path" -b "$name" ${base:+"$base"} 2>&1) || {
        # git can create the branch before failing on the path; a stray
        # branch would turn every retry into a bogus "already exists".
        if git show-ref -q --verify "refs/heads/$name"; then
          git branch -qD "$name" 2>/dev/null || true
        fi
        echo "$out" >&2
        exit 4
      }
      echo "$name (from $from) at $path"
      if [[ -n "$pre_status" ]]; then
        echo "## note: uncommitted changes stay in the current worktree — they were not carried into $path"
      fi
      if [[ $at_set -eq 1 ]]; then
        # rc 0: ignored; rc 1: inside the work tree and visible to status;
        # rc >1: outside the work tree — nothing to flag.
        rc=0
        git check-ignore -q -- "$path" 2>/dev/null || rc=$?
        if [[ $rc -eq 1 ]]; then
          echo "## note: $path is inside the repository and not ignored — git status will list it; consider adding it to .git/info/exclude"
        fi
      fi
    else
      # switch -c carries uncommitted changes along; refusal surfaces verbatim.
      out=$(git switch -c "$name" ${base:+"$base"} 2>&1) || {
        echo "$out" >&2
        exit 4
      }
      echo "$name (from $from)"
    fi
    ;;
  *)
    echo "usage: branch.sh inspect | create <name> [--from <base>] [--worktree [--at <path>]]" >&2
    exit 64
    ;;
esac
