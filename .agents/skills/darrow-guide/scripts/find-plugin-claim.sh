#!/usr/bin/env bash
set -euo pipefail
fail() { printf 'error: %s\n' "$*" >&2; exit 2; }
[ "$#" -ge 2 ] && [ "$#" -le 5 ] || fail "usage: bash find-plugin-claim.sh <checkout-root> <literal-term> [term ...]; one to four terms"
claim_root=$(cd "$1" && pwd -P) || fail "unreadable checkout: $1"
shift
[ -d "$claim_root/plugins" ] || fail "missing plugin directory: $claim_root/plugins"
grep_args=(-n -i -F -C 2)
for term in "$@"; do
  case "$term" in
    ''|*$'\n'*|*$'\r'*) fail "terms must be nonempty single-line literals" ;;
  esac
  [ "${#term}" -le 120 ] || fail "term exceeds 120 characters"
  grep_args+=(-e "$term")
done
shopt -s nullglob
readmes=("$claim_root"/plugins/*/*/README.md)
[ "${#readmes[@]}" -gt 0 ] || fail "no plugin READMEs under: $claim_root/plugins"
for file in "${readmes[@]}"; do
  [ -f "$file" ] && [ -r "$file" ] || fail "unreadable plugin README: $file"
done
found=0
for file in "${readmes[@]}"; do
  matches=1
  for term in "$@"; do
    if grep -i -F -e "$term" "$file" >/dev/null; then
      :
    else
      code=$?
      [ "$code" -eq 1 ] || fail "could not search plugin README: $file"
      matches=0
      break
    fi
  done
  [ "$matches" -eq 1 ] || continue
  found=1
  printf 'source: %s\n' "$file"
  grep "${grep_args[@]}" "$file" || fail "could not read matches: $file"
  printf '\n'
done
if [ "$found" -eq 0 ]; then
  printf 'status: no-matching-plugin-readme\nThe claim remains unresolved; revise the terms or request its exact source.\n'
else
  printf 'status: candidate-sources\nInspect each relevant source in full and its governing specification or accepted ADR. Matches alone establish neither truth nor consistency.\n'
fi
