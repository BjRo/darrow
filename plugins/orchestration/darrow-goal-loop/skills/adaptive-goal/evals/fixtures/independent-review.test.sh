#!/usr/bin/env bash
set -eu

fixture_dir=$(cd "$(dirname "$0")" 2>/dev/null && pwd -P) || exit 1
installer=$fixture_dir/install-independent-review.sh
test -f "$fixture_dir/independent-review/skill-fixture.md"
test ! -e "$fixture_dir/independent-review/SKILL.md"
test -f "$fixture_dir/../../SKILL.md"
test "$(find "$fixture_dir/../../.." -type f -name SKILL.md | wc -l | tr -d ' ')" -eq 1
temporary_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-review-fixture-test.XXXXXX") ||
  exit 1
trap 'rm -rf "$temporary_root"' EXIT HUP INT TERM

repo=$temporary_root/repo
mkdir -p "$repo"
repo=$(cd "$repo" 2>/dev/null && pwd -P) || exit 1
git -C "$repo" init -q
git -C "$repo" config user.name "Darrow Eval"
git -C "$repo" config user.email "eval@example.invalid"
printf '%s\n' '# Instructions' >"$repo/AGENTS.md"
printf '%s\n' 'before' >"$repo/candidate.txt"
git -C "$repo" add AGENTS.md candidate.txt
git -C "$repo" commit -q -m "chore: init"

if bash "$installer" "$repo" "$fixture_dir" invalid >/dev/null 2>&1; then
  printf '%s\n' 'invalid host was accepted' >&2
  exit 1
fi

bash "$installer" "$repo" "$fixture_dir" codex
test -x "$repo/.agents/bin/independent-review-fixture"
test -f "$repo/.agents/skills/independent-code-review/SKILL.md"
test ! -e "$repo/.claude"

printf '%s\n' 'after' >"$repo/candidate.txt"
printf '%s\n' 'candidate.txt' >"$repo/.git/fixture-review-event-path"
printf '%s\n' '0' >"$repo/.git/fixture-review-delay-seconds"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" comprehensive)
printf '%s\n' "$result" |
  grep -Fx 'Independent review outcome: no blocking findings' >/dev/null
test "$(wc -l <"$repo/.git/independent-review-invocations" | tr -d ' ')" -eq 1
test "$(awk -F '\t' 'NF == 3 && $2 == "clear" { print "yes" }' "$repo/.git/independent-review-invocations")" = yes
test "$(cut -f3 "$repo/.git/independent-review-invocations")" = comprehensive
test "$(awk -F '\t' '$1 == "review" && $2 == "clear" && $3 != "" { print "yes" }' "$repo/.git/review-events")" = yes
test "$(awk -F '\t' '$1 == "review_start" { start=$2 } $1 == "review_end" && $2 == start { print "yes"; exit }' "$repo/.git/review-events")" = yes
first_target=$(printf '%s\n' "$result" | sed -n 's/^Reviewed target: //p')
test "$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" fingerprint)" = "$first_target"

review_starts=$(grep -c '^review_start' "$repo/.git/review-events")
printf '%s\n' '2' >"$repo/.git/fixture-review-delay-seconds"
concurrent_result=$temporary_root/concurrent-result
bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify >"$concurrent_result" &
review_pid=$!
attempts=0
while [ "$(grep -c '^review_start' "$repo/.git/review-events")" -le "$review_starts" ]; do
  attempts=$((attempts + 1))
  if [ "$attempts" -gt 3 ]; then
    printf '%s\n' 'review fixture did not enter its wait boundary' >&2
    exit 1
  fi
  sleep 1
done
printf '%s\n' '# Changed instructions while review was pending' >"$repo/AGENTS.md"
wait "$review_pid"
grep -Fx 'Repair verification outcome: inconclusive' "$concurrent_result" >/dev/null
test "$(awk -F '\t' '$1 == "review_start" { start=$2 } $1 == "review_end" && $2 != start { print "yes" }' "$repo/.git/review-events")" = yes
printf '%s\n' '0' >"$repo/.git/fixture-review-delay-seconds"
printf '%s\n' '# Instructions' >"$repo/AGENTS.md"

printf '%s\n' 'untracked one' >"$repo/new-file.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
printf '%s\n' "$result" |
  grep -Fx "Changed file: $repo/new-file.txt" >/dev/null
second_target=$(printf '%s\n' "$result" | sed -n 's/^Reviewed target: //p')
test "$first_target" != "$second_target"
printf '%s\n' 'untracked two' >"$repo/new-file.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
third_target=$(printf '%s\n' "$result" | sed -n 's/^Reviewed target: //p')
test "$second_target" != "$third_target"

touch "$repo/.git/fixture-review-fail"
printf '%s\n' 'fail target' >"$repo/candidate.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
printf '%s\n' "$result" |
  grep -Fx 'Repair verification outcome: continue' >/dev/null
printf '%s\n' "$result" | grep -F 'Blocking finding: ' >/dev/null
rm "$repo/.git/fixture-review-fail"

touch "$repo/.git/fixture-review-inconclusive"
printf '%s\n' 'inconclusive target' >"$repo/candidate.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
printf '%s\n' "$result" |
  grep -Fx 'Repair verification outcome: inconclusive' >/dev/null
printf '%s\n' "$result" | grep -F 'Evidence gap: ' >/dev/null
rm "$repo/.git/fixture-review-inconclusive"

touch "$repo/.git/fixture-review-blocked"
printf '%s\n' 'blocked target' >"$repo/candidate.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
printf '%s\n' "$result" |
  grep -Fx 'Repair verification outcome: unavailable' >/dev/null
printf '%s\n' "$result" | grep -F 'Evidence gap: ' >/dev/null
rm "$repo/.git/fixture-review-blocked"

rm -f "$repo/.git/independent-review-invocations"
printf '%s\t%s\t%s\n' \
  blocking 'sequence blocker' 'sequence advisory' \
  clear '' '' >"$repo/.git/fixture-review-sequence"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" comprehensive)
printf '%s\n' "$result" |
  grep -Fx 'Independent review outcome: blocking findings' >/dev/null
printf '%s\n' "$result" |
  grep -Fx 'Blocking finding: sequence blocker' >/dev/null
printf '%s\n' "$result" |
  grep -Fx 'Advisory finding: sequence advisory' >/dev/null
printf '%s\n' 'repaired' >"$repo/candidate.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
printf '%s\n' "$result" |
  grep -Fx 'Repair verification outcome: clear' >/dev/null
test "$(wc -l <"$repo/.git/independent-review-invocations" | tr -d ' ')" -eq 2
if bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify >/dev/null 2>&1; then
  printf '%s\n' 'exhausted review sequence was accepted' >&2
  exit 1
fi

rm -f "$repo/.git/independent-review-invocations"
printf '%s\t%s\t%s\n' \
  blocking 'unavailable sequence blocker' '' \
  unavailable '' '' >"$repo/.git/fixture-review-sequence"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" comprehensive)
printf '%s\n' "$result" |
  grep -Fx 'Independent review outcome: blocking findings' >/dev/null
printf '%s\n' 'unavailable repair' >"$repo/candidate.txt"
result=$(bash "$repo/.agents/bin/independent-review-fixture" "$repo" verify)
printf '%s\n' "$result" |
  grep -Fx 'Repair verification outcome: unavailable' >/dev/null
printf '%s\n' "$result" | grep -F 'Evidence gap: ' >/dev/null
test "$(cut -f3 "$repo/.git/independent-review-invocations" | tr '\n' ' ')" = 'comprehensive verify '

rm -f "$repo/.git/independent-review-invocations"
printf '%s\t%s\t%s\n' invalid 'bad outcome' '' >"$repo/.git/fixture-review-sequence"
if bash "$repo/.agents/bin/independent-review-fixture" "$repo" comprehensive >/dev/null 2>&1; then
  printf '%s\n' 'invalid review sequence outcome was accepted' >&2
  exit 1
fi

claude_repo=$temporary_root/claude-repo
mkdir -p "$claude_repo"
bash "$installer" "$claude_repo" "$fixture_dir" claude
test -x "$claude_repo/.claude/bin/independent-review-fixture"
test -f "$claude_repo/.claude/skills/independent-code-review/SKILL.md"
test ! -e "$claude_repo/.agents"

printf '%s\n' 'all independent-review fixture tests passed'
