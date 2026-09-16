#!/usr/bin/env bash
# Eval-only completion gate for canonical human and machine review artifacts.
set -euo pipefail
fail() { printf 'review proof: %s\n' "$*" >&2; exit 1; }
git_dir=$(git rev-parse --absolute-git-dir)
git_dir=$(cd "$git_dir" && pwd -P)
proof_file=$git_dir/fixture-state/high-risk-review-proof
mode=${1:-}
case "$mode" in
  complete) record=${2:-} ;;
  artifact|current) record=$(cat "$proof_file") ;;
  *) fail 'expected complete ARTIFACT, artifact, or current' ;;
esac
[ -f "$record" ] && [ -r "$record" ] || fail "unreadable artifact: $record"
record=$(cd "$(dirname "$record")" && printf '%s/%s\n' "$(pwd -P)" "${record##*/}")
case "$record" in
  "$git_dir"/darrow-review.*/result.tsv|"$git_dir"/darrow-review.*/verification.tsv) ;;
  "$git_dir"/darrow-review.*/review.md|"$git_dir"/darrow-review.*/verification.md) ;;
  *) fail "not a canonical fixture review artifact: $record" ;;
esac
# Only the installed dependency beneath this isolated fixture is eligible.
tools=$(find "$git_dir" -type f -path '*/bin/review-result')
result_tool=
while IFS= read -r candidate; do
  [ -f "$candidate" ] || fail 'installed review-result tool is missing'
  if [ -z "$result_tool" ]; then
    result_tool=$candidate
  else
    # The local marketplace source and the host-installed cache are copies of
    # the same dependency. Accept duplicates only when both tools are identical.
    if ! cmp -s "$result_tool" "$candidate" ||
      ! cmp -s "${result_tool%/*}/review-scope" "${candidate%/*}/review-scope"; then
      fail 'conflicting fixture review-tool copies'
    fi
  fi
done <<<"$tools"
scope_tool=${result_tool%/*}/review-scope
case "$record" in
  */review.md|*/verification.md)
    report=$record
    report_tool=${result_tool%/*}/review-report
    [ -f "$report_tool" ] && [ -r "$report_tool" ] || fail 'installed review renderer is missing'
    case "$report" in
      */review.md) record=${report%/*}/result.tsv; render=render ;;
      *) record=${report%/*}/verification.tsv; render='render-verification' ;;
    esac
    rendered=$(mktemp "$git_dir/review-proof.XXXXXX")
    trap 'rm -f "$rendered"' EXIT
    "${BASH:-bash}" "$report_tool" "$render" "$record" >"$rendered"
    cmp -s "$rendered" "$report" || fail 'human report differs from its canonical result'
    ;;
esac
field() { awk -F '\t' -v key="$1" '$1 == key { print $2 }' "$2"; }
format=$(field format "$record")
case "$format" in
  darrow-review-result-v1)
    [ "${record##*/}" = result.tsv ] || fail 'wrong comprehensive artifact name'
    "${BASH:-bash}" "$result_tool" validate "$record" >/dev/null
    [ "$(field verdict "$record")" = pass ] || fail 'review is not clear'
    [ "$(field next_action "$record")" = 'return control to enclosing goal' ] ||
      fail 'review did not return control'
    reviewed_target=$(field target "$record")
    ;;
  darrow-review-verification-v1)
    [ "${record##*/}" = verification.tsv ] || fail 'wrong verification artifact name'
    "${BASH:-bash}" "$result_tool" validate-verification "$record" >/dev/null
    [ "$(field outcome "$record")" = clear ] || fail 'verification is not clear'
    original_target=$(field original_target "$record")
    original=
    while IFS= read -r candidate; do
      if [ "$(field target "$candidate")" = "$original_target" ]; then
        [ -z "$original" ] || fail 'ambiguous original comprehensive result'
        original=$candidate
      fi
    done < <(find "$git_dir" -type f -path '*/darrow-review.*/result.tsv')
    [ -n "$original" ] || fail 'original comprehensive result is missing'
    # The provider owns the complete original schema, including repair guidance.
    "${BASH:-bash}" "$result_tool" validate-original "$original" "$record" >/dev/null ||
      fail 'verification changed the original finding set'
    reviewed_target=$(field current_target "$record")
    ;;
  *) fail "unsupported format: $format" ;;
esac
if [ "$mode" != artifact ]; then
  [ -f "$scope_tool" ] || fail 'installed review-scope tool is missing'
  scope=$("${BASH:-bash}" "$scope_tool" prepare --repo "$PWD" --base HEAD --target WORKTREE)
  current_target=$(awk -F '\t' '$1 == "target" { print $2 }' <<<"$scope")
  [ -n "$reviewed_target" ] && [ "$reviewed_target" = "$current_target" ] ||
    fail "stale review target: $reviewed_target; current: $current_target"
fi
if [ "$mode" = complete ]; then
  mkdir -p "$git_dir/fixture-state"
  printf '%s\n' "$record" >"$proof_file"
  printf '%s\n' complete >"$git_dir/goal-complete"
fi
printf 'valid clear review: %s\n' "$record"
