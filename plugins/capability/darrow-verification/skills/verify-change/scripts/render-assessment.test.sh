#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "$0")" && pwd -P)
renderer=$script_dir/render-assessment
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) template=/verification-render-test.XXXXXX ;;
  */) template=${temp_parent}verification-render-test.XXXXXX ;;
  *) template=$temp_parent/verification-render-test.XXXXXX ;;
esac
test_dir=$(mktemp -d "$template")
test_dir=$(cd "$test_dir" && pwd -P)
trap 'rm -rf "$test_dir"' EXIT

mkdir "$test_dir/elsewhere" "$test_dir/bin"
printf '#!/bin/sh\nexit 97\n' >"$test_dir/bin/bash"
chmod +x "$test_dir/bin/bash"
export PATH="$test_dir/bin:$PATH"
cd "$test_dir/elsewhere"

printf 'Conclusion: progress.\nF1 remains blocking; A1 is advisory.\n' >"$test_dir/assessment.md"
printf 'Complete provider report, unchanged.\n' >"$test_dir/report.md"
cp "$test_dir/report.md" "$test_dir/report-before.md"
"$BASH" "$renderer" --assessment "$test_dir/assessment.md" --provider-report "$test_dir/report.md" >"$test_dir/output.md"
body_bytes=$(wc -c <"$test_dir/assessment.md")
dd if="$test_dir/output.md" of="$test_dir/prefix.md" bs=1 count="$body_bytes" 2>/dev/null
cmp "$test_dir/assessment.md" "$test_dir/prefix.md"
grep -F "Complete provider result: [report](<$test_dir/report.md>)" "$test_dir/output.md"
cmp "$test_dir/report-before.md" "$test_dir/report.md"
ln -s "$test_dir" "$test_dir/alias"
"$BASH" "$renderer" --assessment "$test_dir/assessment.md" --provider-report "$test_dir/alias/report.md" >"$test_dir/alias-output.md"
grep -F "Complete provider result: [report](<$test_dir/report.md>)" "$test_dir/alias-output.md"

odd_name='report [one](two) #%?<>\.md'
cp "$test_dir/report.md" "$test_dir/$odd_name"
"$BASH" "$renderer" --assessment "$test_dir/assessment.md" --provider-report "$test_dir/$odd_name" >"$test_dir/odd-output.md"
grep -F '/report%20[one](two)%20%23%25%3F%3C%3E%5C.md>)' "$test_dir/odd-output.md"

refuses() {
  if "$BASH" "$renderer" "$@" >"$test_dir/refusal-out" 2>"$test_dir/refusal-err"; then
    printf 'expected refusal\n' >&2
    exit 1
  fi
  test ! -s "$test_dir/refusal-out"
  test -s "$test_dir/refusal-err"
}
refuses --assessment relative.md --provider-report "$test_dir/report.md"
refuses --assessment "$test_dir/assessment.md" --provider-report relative.md
refuses --assessment "$test_dir/missing.md" --provider-report "$test_dir/report.md"
refuses --assessment "$test_dir/assessment.md" --provider-report "$test_dir/missing.md"
refuses --assessment "$test_dir/assessment.md" --provider-report "$test_dir/elsewhere"
: >"$test_dir/empty.md"
refuses --assessment "$test_dir/empty.md" --provider-report "$test_dir/report.md"
refuses --assessment "$test_dir/assessment.md" --provider-report "$test_dir/empty.md"
cp "$test_dir/report.md" "$test_dir/"$'bad\npath'
refuses --assessment "$test_dir/assessment.md" --provider-report "$test_dir/"$'bad\npath'
grep -F 'control character' "$test_dir/refusal-err"
refuses --assessment "$test_dir/assessment.md"
refuses --assessment "$test_dir/assessment.md" --provider-report "$test_dir/report.md" extra
printf 'render-assessment contract passed\n'
