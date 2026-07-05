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
    fi
    ;;
  create)
    # create <name> [--from <base>]
    name=""
    base=""
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
    # switch -c carries uncommitted changes along; refusal surfaces verbatim.
    out=$(git switch -c "$name" ${base:+"$base"} 2>&1) || {
      echo "$out" >&2
      exit 4
    }
    echo "$name (from $from)"
    ;;
  *)
    echo "usage: branch.sh inspect | create <name> [--from <base>]" >&2
    exit 64
    ;;
esac
