#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${DARROW_EVIDENCE_BROKER_DIR:-}" ]]; then
  exec bun "$(cd "$(dirname "$0")" && pwd)/evidence-client.ts" "$@"
fi

die() { echo "error: $*" >&2; exit 2; }

absolute_dir() {
  local path=$1 parent base
  parent=$(dirname "$path")
  base=$(basename "$path")
  mkdir -p "$parent" || die "cannot create evidence parent: $parent"
  parent=$(cd "$parent" && pwd -P) || die "cannot resolve evidence parent: $parent"
  printf '%s/%s\n' "$parent" "$base"
}

escape_command() {
  local arg rendered="" quoted
  for arg in "$@"; do
    printf -v quoted '%q' "$arg"
    if [[ -n "$rendered" ]]; then rendered="$rendered "; fi
    rendered="$rendered$quoted"
  done
  printf '%s\n' "$rendered"
}

workspace_digest() {
  local tmp file
  tmp=$(mktemp "${TMPDIR:-/tmp}/darrow-evidence.XXXXXX") || die "cannot create digest input"
  {
    git status --porcelain=v1 --untracked-files=all -- . ':(exclude).darrow-attempts'
    git diff --binary -- . ':(exclude).darrow-attempts'
    git diff --cached --binary -- . ':(exclude).darrow-attempts'
    git ls-files --others --exclude-standard --exclude='.darrow-attempts/' | LC_ALL=C sort | while IFS= read -r file; do
      printf 'untracked %s\n' "$file"
      if [[ -f "$file" ]]; then shasum -a 256 -- "$file"; fi
    done
  } >"$tmp"
  printf 'sha256:%s\n' "$(shasum -a 256 "$tmp" | awk '{print $1}')"
  rm -f "$tmp"
}

file_digest() { printf 'sha256:%s\n' "$(shasum -a 256 "$1" | awk '{print $1}')"; }

value() {
  local key=$1 file=$2
  sed -n "s/^${key}=//p" "$file"
}

run_phase() {
  local root phase expected="" meta stdout stderr started finished status command digest stdout_digest stderr_digest
  root=$(absolute_dir "$1")
  phase=$2
  shift 2
  [[ "$phase" == "red" || "$phase" == "green" || "$phase" == "regression" ]] || die "unknown phase: $phase"
  if [[ "${1:-}" == "--expected" ]]; then
    [[ "$phase" == "red" ]] || die "--expected is valid only for red"
    [[ $# -ge 2 ]] || die "--expected needs a value"
    expected=$2
    [[ "$expected" != *$'\n'* && "$expected" != *$'\t'* && -n "$expected" ]] || die "expected text must be one non-empty line"
    shift 2
  fi
  if [[ "$phase" == "red" && -z "$expected" ]]; then die "red requires non-empty expected behavioral failure text"; fi
  [[ "${1:-}" == "--" ]] || die "phase command must follow --"
  shift
  [[ $# -gt 0 ]] || die "no test command given"
  [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null || true)" == "true" ]] || die "not inside a git work tree"
  mkdir -p "$root"
  meta="$root/$phase.meta"
  [[ ! -e "$meta" ]] || die "evidence phase already exists and is immutable: $phase"
  stdout="$root/$phase.stdout"
  stderr="$root/$phase.stderr"
  command=$(escape_command "$@")
  started=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  set +e
  "$@" >"$stdout" 2>"$stderr"
  status=$?
  set -e
  finished=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  if [[ "$phase" == "red" ]]; then
    if [[ $status -eq 0 ]]; then rm -f "$stdout" "$stderr"; die "red command passed; the requested behavior was not proved absent"; fi
    if [[ $status -eq 126 || $status -eq 127 ]]; then rm -f "$stdout" "$stderr"; die "red command could not execute; missing or non-executable tools are not behavioral evidence"; fi
    if ! grep -F -- "$expected" "$stdout" "$stderr" >/dev/null 2>&1; then rm -f "$stdout" "$stderr"; die "red output did not contain expected behavioral failure: $expected"; fi
  fi
  digest=$(workspace_digest)
  stdout_digest=$(file_digest "$stdout")
  stderr_digest=$(file_digest "$stderr")
  {
    printf 'phase=%s\n' "$phase"
    printf 'command=%s\n' "$command"
    printf 'exit_status=%s\n' "$status"
    printf 'started_at=%s\n' "$started"
    printf 'finished_at=%s\n' "$finished"
    printf 'stdout=%s\n' "$stdout"
    printf 'stderr=%s\n' "$stderr"
    printf 'stdout_digest=%s\n' "$stdout_digest"
    printf 'stderr_digest=%s\n' "$stderr_digest"
    printf 'workspace_digest=%s\n' "$digest"
    printf 'expected=%s\n' "$expected"
  } >"$meta"
  chmod 0444 "$stdout" "$stderr" "$meta"
  if [[ "$phase" != "red" ]]; then
    [[ $status -eq 0 ]] || die "$phase command failed with exit status $status"
  fi
  echo "$phase: exit=$status digest=$digest"
}

validate() {
  local root phase meta red_command red_finished green_started green_finished regression_started
  root=$(absolute_dir "$1")
  for phase in red green regression; do
    meta="$root/$phase.meta"
    [[ -r "$meta" ]] || die "missing readable evidence: $phase.meta"
    [[ "$(value phase "$meta")" == "$phase" ]] || die "phase mismatch in $phase.meta"
    [[ "$(value workspace_digest "$meta")" =~ ^sha256:[a-f0-9]{64}$ ]] || die "invalid workspace digest in $phase.meta"
    [[ "$(value stdout "$meta")" == "$root/$phase.stdout" && "$(value stderr "$meta")" == "$root/$phase.stderr" ]] || die "output reference escapes its evidence phase in $phase.meta"
    [[ -f "$root/$phase.stdout" && -f "$root/$phase.stderr" ]] || die "missing output reference in $phase.meta"
    [[ "$(value stdout_digest "$meta")" == "$(file_digest "$root/$phase.stdout")" ]] || die "stdout changed after capture in $phase.meta"
    [[ "$(value stderr_digest "$meta")" == "$(file_digest "$root/$phase.stderr")" ]] || die "stderr changed after capture in $phase.meta"
  done
  [[ "$(value exit_status "$root/red.meta")" =~ ^[0-9]+$ && "$(value exit_status "$root/red.meta")" != "0" ]] || die "red must have a nonzero exit status"
  [[ "$(value exit_status "$root/green.meta")" == "0" ]] || die "green must have exit status 0"
  [[ "$(value exit_status "$root/regression.meta")" == "0" ]] || die "regression must have exit status 0"
  [[ -n "$(value expected "$root/red.meta")" ]] || die "red is missing expected behavioral failure text"
  grep -F -- "$(value expected "$root/red.meta")" "$root/red.stdout" "$root/red.stderr" >/dev/null 2>&1 || die "red output no longer contains its expected behavioral failure"
  red_command=$(value command "$root/red.meta")
  [[ "$red_command" == "$(value command "$root/green.meta")" ]] || die "green must run the identical focused command as red"
  red_finished=$(value finished_at "$root/red.meta")
  green_started=$(value started_at "$root/green.meta")
  green_finished=$(value finished_at "$root/green.meta")
  regression_started=$(value started_at "$root/regression.meta")
  [[ "$red_finished" < "$green_started" || "$red_finished" == "$green_started" ]] || die "green evidence precedes red"
  [[ "$green_finished" < "$regression_started" || "$green_finished" == "$regression_started" ]] || die "regression evidence precedes green"
  echo "valid: red -> green -> regression"
}

cmd=${1:-}
shift || true
case "$cmd" in
  run) [[ $# -ge 2 ]] || die "usage: evidence.sh run <dir> <phase> [--expected text] -- <command> [args...]"; run_phase "$@" ;;
  validate) [[ $# -eq 1 ]] || die "usage: evidence.sh validate <dir>"; validate "$1" ;;
  *) die "usage: evidence.sh {run|validate} ..." ;;
esac
