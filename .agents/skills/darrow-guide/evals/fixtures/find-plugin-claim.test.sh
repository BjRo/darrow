#!/usr/bin/env bash
set -euo pipefail
script_dir=$(cd "$(dirname "$0")/../../scripts" && pwd -P)
lookup="$script_dir/find-plugin-claim.sh"
test_parent=$(cd "${TMPDIR:-/tmp}" && pwd -P)
test_dir=$(mktemp -d "$test_parent/darrow-guide-claim.XXXXXX")
test_dir=$(cd "$test_dir" && pwd -P)
trap 'rm -rf "$test_dir"' EXIT
repo="$test_dir/checkout with spaces"
mkdir -p "$repo/plugins/orchestration/first plugin" "$repo/plugins/capability/second"
printf 'Automatic work is supported here.\n' > "$repo/README.md"
printf 'Automatic work is supported here.\n' > "$repo/plugins/orchestration/README.md"
first="$repo/plugins/orchestration/first plugin/README.md"
second="$repo/plugins/capability/second/README.md"
printf 'Explicit entry only.\n\nOther useful context.\n\nComplex work starts automatically.\n' > "$first"
printf 'Unrelated capability.\nLiteral [term] and --option and \\path.\n' > "$second"
before=$(cksum "$first" "$second" "$repo/README.md" "$repo/plugins/orchestration/README.md")
cd /tmp
result=$("$BASH" "$lookup" "$repo" complex automatically)
[[ "$result" == *"source: $first"* ]]
[[ "$result" == *'5:Complex work starts automatically.'* ]]
[[ "$result" != *"source: $repo/README.md"* ]]
[[ "$result" != *"source: $repo/plugins/orchestration/README.md"* ]]
[[ "$result" != *"source: $second"* ]]
result=$("$BASH" "$lookup" "$repo" '[term]' '--option' '\path')
[[ "$result" == *"source: $second"* ]]
result=$("$BASH" "$lookup" "$repo" 'missing phrase')
[[ "$result" == *'status: no-matching-plugin-readme'* ]]
[[ "$result" == *'unresolved'* ]]
if "$BASH" "$lookup" "$repo" '' > "$test_dir/error" 2>&1; then exit 1; fi
if "$BASH" "$lookup" "$test_dir/absent" complex > "$test_dir/error" 2>&1; then exit 1; fi
mkdir -p "$test_dir/empty/plugins"
if "$BASH" "$lookup" "$test_dir/empty" complex > "$test_dir/error" 2>&1; then exit 1; fi
grep -F -e "no plugin READMEs under: $test_dir/empty/plugins" "$test_dir/error" >/dev/null
if "$BASH" "$lookup" "$repo" one two three four five > "$test_dir/error" 2>&1; then exit 1; fi
if [ "$(id -u)" -ne 0 ]; then
  chmod 000 "$second"
  if "$BASH" "$lookup" "$repo" complex > "$test_dir/error" 2>&1; then exit 1; fi
  chmod 600 "$second"
  grep -F -e "$second" "$test_dir/error" >/dev/null
else
  printf 'unverified: unreadable-file behavior while running as root\n'
fi
after=$(cksum "$first" "$second" "$repo/README.md" "$repo/plugins/orchestration/README.md")
test "$before" = "$after"
test "$(find "$repo" -type f | wc -l | tr -d ' ')" -eq 4
printf 'plugin-claim lookup: literal terms, exact source scope, unknown/refusal, and unchanged sources passed\n'
