#!/usr/bin/env bash
# Deterministic git steps for the create-commit skill.
# stdout is read by a model: print only decision-relevant data, never raw
# intermediate git output. Checkable invariants (conventional format, no AI
# attribution, staged-set integrity) are enforced here, not in the prompt.
set -euo pipefail

# `head` would SIGPIPE git under pipefail on large diffs; awk consumes input.
truncate_lines() { awk 'NR<=300'; }

in_conflict() { [[ -n "$(git ls-files -u)" ]]; }

git_dir_path() {
  git_dir=$(git rev-parse --git-dir)
  case "$git_dir" in
    /*) printf '%s\n' "$git_dir" ;;
    *) printf '%s/%s\n' "$PWD" "$git_dir" ;;
  esac
}

hook_failure_state_path() {
  printf '%s/darrow-create-commit-hook-failure\n' "$(git_dir_path)"
}

save_hook_failure_state() {
  state_path=$(hook_failure_state_path)
  state_head=$2
  state_tree=$3
  umask 077
  {
    printf 'format\tdarrow-create-commit-hook-failure-v1\n'
    printf 'head\t%s\n' "$state_head"
    printf 'index_tree\t%s\n' "$state_tree"
    printf 'output\n%s\n' "$1"
  } >"$state_path"
}

validate_refresh_files() {
  for f in ${refresh_files[@]+"${refresh_files[@]}"}; do
    if [[ "$f" == "." || "$f" == ".." || "$f" == -* || "$f" == :* || "$f" == *[\*\?\[]* ]]; then
      echo "error: only explicit file paths allowed, got: $f" >&2
      return 7
    fi
    staged_path=$(git diff --cached --name-only -- "$f")
    if [[ "$staged_path" != "$f" ]]; then
      echo "error: retry path is not in the existing staged set: $f" >&2
      return 7
    fi
  done
}

cmd=${1:-}
shift || true

case "$cmd" in
  inspect)
    # Mode-aware: with a staged set the commit scope is already decided, so
    # only message context is printed. Without one, selection context.
    if in_conflict; then
      echo "## mode: conflict (merge/rebase in progress — do not commit; inform the user)"
      echo "## unmerged files"
      git diff --name-only --diff-filter=U
    elif ! git diff --cached --quiet; then
      echo "## mode: staged (commit exactly this set; pass no paths)"
      echo "## staged files"
      git diff --cached --name-status
      echo "## not included (unstaged/untracked)"
      git diff --name-only
      git ls-files --others --exclude-standard
      echo "## recent subjects"
      git log -5 --format='%s' 2>/dev/null || true
      echo "## staged diff (truncated at 300 lines)"
      git diff --cached --unified=2 | truncate_lines
    else
      echo "## mode: unstaged (select only files belonging to the change)"
      echo "## unstaged files"
      git diff --name-status
      echo "## untracked files"
      git ls-files --others --exclude-standard
      echo "## recent subjects"
      git log -5 --format='%s' 2>/dev/null || true
      echo "## unstaged diff (truncated at 300 lines)"
      git diff --unified=2 | truncate_lines
    fi
    ;;

  diff)
    # Compact diff of specific working-tree paths, for choosing what to stage.
    if [[ $# -eq 0 ]]; then
      echo "error: diff needs at least one path" >&2
      exit 64
    fi
    for p in "$@"; do
      if git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
        git diff --unified=2 -- "$p" | truncate_lines
      elif [[ -f "$p" ]]; then
        # Untracked: show as an all-new diff.
        git diff --no-index --unified=2 -- /dev/null "$p" | truncate_lines || true
      else
        echo "error: no such file: $p" >&2
        exit 64
      fi
    done
    ;;

  commit)
    # commit [-m <msg>]... [<path>]...
    # Paths (if given) are staged explicitly; -m repeats like git commit.
    files=()
    msgs=()
    while [[ $# -gt 0 ]]; do
      case "$1" in
        -m)
          if [[ $# -lt 2 ]]; then
            echo "error: -m needs a value" >&2
            exit 2
          fi
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

    if in_conflict; then
      echo "error: merge/rebase in progress — resolve conflicts first; do not commit" >&2
      exit 8
    fi

    # Staged-set integrity: an existing staged set IS the commit set.
    if ! git diff --cached --quiet && [[ ${#files[@]} -gt 0 ]]; then
      echo "error: a staged set exists; pass no paths (commit exactly the staged set)" >&2
      exit 7
    fi
    # No sweep shortcuts: only explicit literal paths.
    for f in ${files[@]+"${files[@]}"}; do
      if [[ "$f" == "." || "$f" == ".." || "$f" == -* || "$f" == :* || "$f" == *[\*\?\[]* ]]; then
        echo "error: only explicit file paths allowed, got: $f" >&2
        exit 7
      fi
    done

    subject=${msgs[0]%%$'\n'*}
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
    # Attribution needs tool context: "generated by openapi-generator" is
    # legitimate prose, "Generated using Claude Code" is not.
    # Herestring, not a pipe: grep -q exits at the first match, and on a
    # >64KB message the writer's SIGPIPE (141) would make pipefail discard
    # the match — silently disabling this check.
    if grep -qiE 'co-authored-by:.*\b(claude|gpt|chatgpt|codex|copilot|cursor|gemini|ai)\b|co[- ]?authored[- ]by +(claude|gpt|chatgpt|codex|copilot|cursor|gemini)\b|(generated|built|written|created|made|assisted)[- ](with|by|using) +\[?(claude|gpt|chatgpt|codex|copilot|cursor|gemini|an? ai\b|ai\b)|🤖' <<< "$full_message"; then
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
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
      failed_head=$(git rev-parse HEAD)
    else
      failed_head=unborn
    fi
    failed_tree=$(git write-tree)
    out=$(git commit -q "${msg_args[@]}" 2>&1) || {
      # Commit failed (hook, identity, etc.): surface verbatim, never bypass.
      if [[ "$failed_head" == unborn ]]; then
        git rev-parse --verify HEAD >/dev/null 2>&1 || git read-tree "$failed_tree"
      elif [[ "$(git rev-parse HEAD)" == "$failed_head" ]]; then
        git read-tree "$failed_tree"
      fi
      save_hook_failure_state "$out" "$failed_head" "$failed_tree"
      echo "$out" >&2
      exit 4
    }
    git log -1 --format='%h %s'
    ;;

  retry)
    # A hook-failure retry may refresh only named paths already in the index.
    # It then delegates to `commit`, retaining that command's normal checks and
    # hook execution rather than creating a bypass path.
    refresh_files=()
    msgs=()
    after_hook_failure=0
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --after-hook-failure)
          after_hook_failure=1
          shift
          ;;
        --refresh-staged)
          shift
          while [[ $# -gt 0 && "$1" != -m && "$1" != --after-hook-failure && "$1" != --refresh-staged ]]; do
            refresh_files+=("$1")
            shift
          done
          ;;
        -m)
          if [[ $# -lt 2 ]]; then
            echo "error: -m needs a value" >&2
            exit 2
          fi
          msgs+=("$2")
          shift 2
          ;;
        *)
          echo "error: retry accepts only --after-hook-failure, --refresh-staged, and -m" >&2
          exit 2
          ;;
      esac
    done
    if [[ $after_hook_failure -ne 1 || ${#refresh_files[@]} -eq 0 || ${#msgs[@]} -eq 0 ]]; then
      echo "error: retry needs --after-hook-failure, --refresh-staged <path>..., and -m" >&2
      exit 2
    fi
    if in_conflict; then
      echo "error: merge/rebase in progress — resolve conflicts first; do not commit" >&2
      exit 8
    fi
    if git diff --cached --quiet; then
      echo "error: retry needs an existing staged set" >&2
      exit 7
    fi
    validate_refresh_files || exit $?
    git add -- "${refresh_files[@]}"
    msg_args=()
    for m in "${msgs[@]}"; do msg_args+=(-m "$m"); done
    exec "$0" commit "${msg_args[@]}"
    ;;

  remediate)
    # The skill interprets trusted hook diagnostics. This script executes the
    # supplied literal command only against the exact failed index snapshot,
    # then refuses and restores the index if remediation staged anything.
    refresh_files=()
    msgs=()
    after_hook_failure=0
    remediation_command=
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --after-hook-failure)
          after_hook_failure=1
          shift
          ;;
        --command)
          if [[ $# -lt 2 ]]; then
            echo "error: --command needs a value" >&2
            exit 2
          fi
          remediation_command=$2
          shift 2
          ;;
        --refresh-staged)
          shift
          while [[ $# -gt 0 && "$1" != -m && "$1" != --after-hook-failure && "$1" != --command && "$1" != --refresh-staged ]]; do
            refresh_files+=("$1")
            shift
          done
          ;;
        -m)
          if [[ $# -lt 2 ]]; then
            echo "error: -m needs a value" >&2
            exit 2
          fi
          msgs+=("$2")
          shift 2
          ;;
        *)
          echo "error: remediate accepts only --after-hook-failure, --command, --refresh-staged, and -m" >&2
          exit 2
          ;;
      esac
    done
    if [[ $after_hook_failure -ne 1 || -z "$remediation_command" || ${#refresh_files[@]} -eq 0 || ${#msgs[@]} -eq 0 ]]; then
      echo "error: remediate needs --after-hook-failure, --command, --refresh-staged <path>..., and -m" >&2
      exit 2
    fi
    state_path=$(hook_failure_state_path)
    if [[ ! -f "$state_path" || ! -r "$state_path" ]]; then
      echo "error: no readable hook-failure state for remediation" >&2
      exit 7
    fi
    state_head=$(awk -F '\t' '$1 == "head" { print $2 }' "$state_path")
    state_tree=$(awk -F '\t' '$1 == "index_tree" { print $2 }' "$state_path")
    state_output=$(sed -n '/^output$/,$p' "$state_path")
    state_output=${state_output#output$'\n'}
    if [[ -z "$state_head" || -z "$state_tree" ]] || { [[ "$state_head" != unborn ]] && ! git rev-parse --verify "$state_head^{commit}" >/dev/null 2>&1; } || ! git rev-parse --verify "$state_tree^{tree}" >/dev/null 2>&1; then
      echo "error: hook-failure state is invalid" >&2
      exit 7
    fi
    if { [[ "$state_head" == unborn ]] && git rev-parse --verify HEAD >/dev/null 2>&1; } || { [[ "$state_head" != unborn ]] && [[ "$(git rev-parse HEAD)" != "$state_head" ]]; } || [[ "$(git write-tree)" != "$state_tree" ]]; then
      echo "error: failed commit state changed; do not remediate" >&2
      exit 7
    fi
    validate_refresh_files || exit $?
    if [[ "$state_output" != *"$remediation_command"* ]]; then
      echo "error: remediation command is not present in the failed hook diagnostic" >&2
      exit 7
    fi
    if remediation_out=$(sh -c "$remediation_command" 2>&1); then
      remediation_status=0
    else
      remediation_status=$?
    fi
    if { [[ "$state_head" == unborn ]] && git rev-parse --verify HEAD >/dev/null 2>&1; } || { [[ "$state_head" != unborn ]] && [[ "$(git rev-parse HEAD)" != "$state_head" ]]; }; then
      echo "error: remediation changed HEAD; do not retry" >&2
      exit 8
    fi
    if [[ "$(git write-tree)" != "$state_tree" ]]; then
      git read-tree "$state_tree"
      echo "error: remediation changed the index; restored failed commit staging and stopped" >&2
      exit 7
    fi
    if [[ $remediation_status -ne 0 ]]; then
      echo "$remediation_out" >&2
      exit 4
    fi
    msg_args=()
    for m in "${msgs[@]}"; do msg_args+=(-m "$m"); done
    exec "$0" retry --after-hook-failure --refresh-staged "${refresh_files[@]}" "${msg_args[@]}"
    ;;

  *)
    echo "usage: commit.sh inspect | diff <path>... | commit [-m <msg>]... [<path>]... | retry --after-hook-failure --refresh-staged <path>... -m <msg> | remediate --after-hook-failure --command <command> --refresh-staged <path>... -m <msg>" >&2
    exit 64
    ;;
esac
