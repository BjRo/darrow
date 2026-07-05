#!/usr/bin/env bash
# Deterministic git steps for the create-commit skill.
# stdout is read by a model: print only decision-relevant data, never raw
# intermediate git output. Checkable invariants (conventional format, no AI
# attribution, staged-set integrity) are enforced here, not in the prompt.
set -euo pipefail

cmd=${1:-}
shift || true

case "$cmd" in
  inspect)
    # Mode-aware: with a staged set the commit scope is already decided, so
    # only message context is printed. Without one, selection context.
    if ! git diff --cached --quiet; then
      echo "## mode: staged (commit exactly this set; pass no paths)"
      echo "## staged files"
      git diff --cached --name-status
      echo "## recent subjects"
      git log -5 --format='%s' 2>/dev/null || true
      echo "## staged diff (truncated)"
      git diff --cached --unified=2 | head -300
    else
      echo "## mode: unstaged (select only files belonging to the change)"
      echo "## unstaged files"
      git diff --name-status
      echo "## untracked files"
      git ls-files --others --exclude-standard
      echo "## recent subjects"
      git log -5 --format='%s' 2>/dev/null || true
      echo "## unstaged diff (truncated)"
      git diff --unified=2 | head -300
    fi
    ;;

  diff)
    # Compact diff of specific working-tree paths, for choosing what to stage.
    git diff --unified=2 -- "$@" | head -300
    ;;

  commit)
    # commit [-m <msg>]... [<path>]...
    # Paths (if given) are staged explicitly; -m repeats like git commit.
    files=()
    msgs=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -m)
          msgs+=("$2")
          shift 2
          ;;
        *)
          files+=("$1")
          shift
          ;;
      esac
    done
    if [[ ${#msgs[@]} -eq 0 ]]; then
      echo "error: no -m message given" >&2
      exit 2
    fi

    subject=${msgs[0]}
    if ! [[ "$subject" =~ ^(feat|fix|refactor|perf|docs|test|chore|build|ci|style|revert)(\([^\)]+\))?\!?:\ [^[:space:]] ]]; then
      echo "error: subject not Conventional Commits format: $subject" >&2
      exit 5
    fi
    if [[ ${#subject} -gt 72 ]]; then
      echo "error: subject exceeds 72 chars (${#subject})" >&2
      exit 5
    fi
    if [[ "$subject" == *. ]]; then
      echo "error: subject has trailing period" >&2
      exit 5
    fi
    full_message=$(printf '%s\n\n' "${msgs[@]}")
    if printf '%s' "$full_message" | grep -qiE 'co-authored-by:.*(claude|gpt|codex|ai)|generated with|🤖'; then
      echo "error: AI attribution is not allowed in commit messages" >&2
      exit 6
    fi

    if [[ ${#files[@]} -gt 0 ]]; then
      git add -- "${files[@]}"
    fi
    if git diff --cached --quiet; then
      echo "error: nothing staged" >&2
      exit 3
    fi

    msg_args=()
    for m in "${msgs[@]}"; do msg_args+=(-m "$m"); done
    out=$(git commit -q "${msg_args[@]}" 2>&1) || {
      # Surface hook failures verbatim; never bypass them.
      echo "$out" >&2
      exit 4
    }
    git log -1 --format='%h %s'
    ;;

  *)
    echo "usage: commit.sh inspect | diff <path>... | commit [-m <msg>]... [<path>]..." >&2
    exit 64
    ;;
esac
