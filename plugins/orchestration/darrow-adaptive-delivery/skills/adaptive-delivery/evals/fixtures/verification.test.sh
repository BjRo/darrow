#!/usr/bin/env bash
set -eu
fixture_dir=$(cd "$(dirname "$0")" && pwd -P)
temp_parent=${TMPDIR:-/tmp}
case $temp_parent in
  /) temp_template=/darrow-verification-fixture.XXXXXX ;;
  */) temp_template=${temp_parent}darrow-verification-fixture.XXXXXX ;;
  *) temp_template=$temp_parent/darrow-verification-fixture.XXXXXX ;;
esac
work_dir=$(mktemp -d "$temp_template")
work_dir=$(cd "$work_dir" && pwd -P)
trap 'rm -rf "$work_dir"' EXIT
repo=$work_dir/repo
mkdir -p "$repo/src"
git -C "$repo" init -q
git -C "$repo" config user.name Fixture
git -C "$repo" config user.email fixture@example.invalid
printf '%s\n' 'export const TIMEOUT_MS = 1000;' 'export const RETRY_COUNT = 3;' 'export const CACHE_SIZE = 5;' >"$repo/src/config.js"
git -C "$repo" add src/config.js
git -C "$repo" commit -qm 'chore: baseline'
printf '%s\n' '.agents/' '.claude/' >>"$repo/.git/info/exclude"
"$BASH" "$fixture_dir/install-verification.sh" "$repo" "$fixture_dir"
tool=$repo/.agents/bin/verification-fixture
state=$repo/.git/fixture-state
printf '%s\n' 'RETRY_COUNT = 0' >"$repo/.git/fixture-review-reject-pattern"
printf '%s\n' 'src/config.js' >"$repo/.git/fixture-review-event-path"
printf '%s\n' 'export const TIMEOUT_MS = 2500;' 'export const RETRY_COUNT = 0;' 'export const CACHE_SIZE = 0;' >"$repo/src/config.js"
if "$BASH" "$tool" "$repo" initial >"$work_dir/missing" 2>&1; then exit 1; fi
test ! -e "$state/verification-invocations"
cksum <"$repo/src/config.js" >"$state/check-target"
"$BASH" "$tool" "$repo" initial >"$work_dir/initial"
grep -Fx 'Conclusion: progress' "$work_dir/initial" >/dev/null
grep -F 'Q1, QA/cache, blocking' "$work_dir/initial" >/dev/null
grep -F 'Independent review outcome: blocking findings' "$work_dir/initial" >/dev/null
"$BASH" "$tool" "$repo" follow-up >"$work_dir/unchanged"
grep -Fx 'Conclusion: no-progress' "$work_dir/unchanged" >/dev/null
touch "$repo/.git/fixture-review-blocked"
"$BASH" "$tool" "$repo" follow-up >"$work_dir/unavailable-review"
grep -Fx 'Conclusion: blocked' "$work_dir/unavailable-review" >/dev/null
rm "$repo/.git/fixture-review-blocked"
touch "$repo/.git/fixture-review-inconclusive"
"$BASH" "$tool" "$repo" follow-up >"$work_dir/inconclusive-review"
grep -Fx 'Conclusion: blocked' "$work_dir/inconclusive-review" >/dev/null
rm "$repo/.git/fixture-review-inconclusive"
printf '%s\n' 'export const TIMEOUT_MS = 2500;' 'export const RETRY_COUNT = 3;' 'export const CACHE_SIZE = 5;' >"$repo/src/config.js"
if "$BASH" "$tool" "$repo" follow-up >"$work_dir/stale-check" 2>&1; then exit 1; fi
test "$(wc -l <"$state/verification-invocations" | tr -d ' ')" = 4
cksum <"$repo/src/config.js" >"$state/check-target"
"$BASH" "$tool" "$repo" follow-up >"$work_dir/clear"
grep -Fx 'Conclusion: clear' "$work_dir/clear" >/dev/null
test "$(tail -n 1 "$state/verification-invocations" | cut -f2)" = "$(cksum <"$repo/src/config.js")"
if "$BASH" "$tool" "$repo" initial >"$work_dir/restart" 2>&1; then exit 1; fi

# A mutation during the later assessment produces blocked current-content evidence.
expected_events=$(( $(wc -l <"$state/verification-events" | tr -d ' ') + 2 ))
"$BASH" "$tool" "$repo" follow-up >"$work_dir/stale-result" &
assessment_pid=$!
polls=0
while [ "$(wc -l <"$state/verification-events" | tr -d ' ')" -lt "$expected_events" ]; do
  kill -0 "$assessment_pid" 2>/dev/null || { wait "$assessment_pid"; exit 1; }
  polls=$((polls + 1))
  test "$polls" -lt 100 || { kill "$assessment_pid"; wait "$assessment_pid"; exit 1; }
  sleep 0.1
done
printf '%s\n' 'export const TIMEOUT_MS = 2500;' 'export const RETRY_COUNT = 3;' 'export const CACHE_SIZE = 0;' >"$repo/src/config.js"
wait "$assessment_pid"
grep -Fx 'Conclusion: blocked' "$work_dir/stale-result" >/dev/null
printf '%s\n' 'verification fixture: combined results, current checks, closed follow-up and stale evidence passed'
