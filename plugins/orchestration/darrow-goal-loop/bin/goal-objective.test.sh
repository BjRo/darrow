#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
goal_loop="$script_dir/goal-loop"
tmp_root=$(mktemp -d "${TMPDIR:-/tmp}/darrow-goal-objective-test.XXXXXX")
tab=$(printf '\t')

cleanup() {
  chmod -R u+rwX "$tmp_root" 2>/dev/null || true
  rm -rf "$tmp_root"
}
trap cleanup EXIT

fail() {
  printf 'not ok - %s\n' "$*" >&2
  exit 1
}

record_value() {
  record=$1
  wanted=$2
  found=
  while IFS="$tab" read -r key value extra; do
    if test "$key" = "$wanted"; then
      test -n "$value" && test -z "${extra:-}" ||
        fail "invalid $wanted record"
      found=$value
      break
    fi
  done <<<"$record"
  test -n "$found" || fail "missing $wanted record"
  printf '%s\n' "$found"
}

file_mode() {
  if mode=$(stat -c '%a' "$1" 2>/dev/null); then
    printf '%s\n' "$mode"
  else
    stat -f '%Lp' "$1"
  fi
}

repo="$tmp_root/repo"
mkdir -p "$repo"
git -C "$repo" init -q

staging="$tmp_root/staging"
mkdir -p "$staging"

inline_goal="$staging/inline-goal.md"
dd if=/dev/zero bs=4000 count=1 2>/dev/null | tr '\000' x >"$inline_goal"
inline_out=$(bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$inline_goal")
test "$(record_value "$inline_out" format)" = darrow-native-goal-objective-v1 ||
  fail "inline objective used the wrong format"
test "$(record_value "$inline_out" mode)" = inline ||
  fail "4,000-byte objective was not kept inline"
test "$(record_value "$inline_out" contract_bytes)" -eq 4000 ||
  fail "inline contract byte count changed"
inline_contract=$(record_value "$inline_out" contract_file)
inline_objective=$(record_value "$inline_out" objective_file)
test "$inline_contract" = "$inline_objective" ||
  fail "inline objective did not use the complete contract"
cmp -s "$inline_goal" "$inline_objective" ||
  fail "inline objective changed the contract"

large_goal="$staging/large-goal.md"
dd if=/dev/zero bs=4001 count=1 2>/dev/null | tr '\000' y >"$large_goal"
large_out=$(bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$large_goal")
test "$(record_value "$large_out" mode)" = file-backed ||
  fail "4,001-byte objective was not file-backed"
test "$(record_value "$large_out" contract_bytes)" -eq 4001 ||
  fail "file-backed contract byte count changed"
large_contract=$(record_value "$large_out" contract_file)
large_objective=$(record_value "$large_out" objective_file)
large_attachment=$(record_value "$large_out" attachment_dir)
large_digest=$(record_value "$large_out" contract_sha256)
large_objective_bytes=$(record_value "$large_out" objective_bytes)
test "$large_objective_bytes" -gt 0 && test "$large_objective_bytes" -le 4000 ||
  fail "file-backed native objective exceeded the 4,000-byte limit"
test "${#large_digest}" -eq 64 || fail "SHA-256 digest was not emitted"
case "$large_digest" in
  *[!0-9a-f]*) fail "SHA-256 digest was not lowercase hexadecimal" ;;
esac
test "${large_contract#/}" != "$large_contract" ||
  fail "file-backed contract path was not absolute"
test "${large_objective#/}" != "$large_objective" ||
  fail "file-backed objective path was not absolute"
case "$large_contract/" in
  "$repo"/*) fail "file-backed contract was written inside the repository" ;;
esac
cmp -s "$large_goal" "$large_contract" ||
  fail "file-backed contract was not copied byte-for-byte"
test "$(file_mode "$large_contract")" = 600 ||
  fail "file-backed contract permissions were not restrictive"
test "$(file_mode "$(dirname -- "$large_contract")")" = 700 ||
  fail "file-backed attachment directory permissions were not restrictive"
grep -F -- "$large_contract" "$large_objective" >/dev/null ||
  fail "native objective did not contain the contract path"
grep -F -- "$large_digest" "$large_objective" >/dev/null ||
  fail "native objective did not contain the expected digest"
grep -F -- 'Before doing any work' "$large_objective" >/dev/null ||
  fail "native objective did not require pre-work loading"
grep -F -- 'stop and report the evidence gap' "$large_objective" >/dev/null ||
  fail "native objective did not fail closed"
bash "$goal_loop" release-objective --attachment-dir "$large_attachment" \
  --expected-sha256 "$large_digest" >/dev/null
test ! -e "$large_attachment" ||
  fail "released goal attachment still exists"

unsafe_out=$(bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$large_goal")
unsafe_attachment=$(record_value "$unsafe_out" attachment_dir)
printf 'unexpected\n' >"$unsafe_attachment/unrelated.txt"
if bash "$goal_loop" release-objective \
  --attachment-dir "$unsafe_attachment" \
  --expected-sha256 "$(record_value "$unsafe_out" contract_sha256)" \
  >/dev/null 2>&1; then
  fail "goal attachment cleanup removed an unexpected file"
fi
test -e "$unsafe_attachment/unrelated.txt" ||
  fail "refused cleanup still removed an unexpected file"
rm -f "$unsafe_attachment/unrelated.txt"
bash "$goal_loop" release-objective --attachment-dir "$unsafe_attachment" \
  --expected-sha256 "$(record_value "$unsafe_out" contract_sha256)" >/dev/null

outside_attachment="$tmp_root/darrow-goal-contract.docs"
mkdir -p "$outside_attachment"
cp "$large_goal" "$outside_attachment/goal-contract.md"
printf 'unrelated objective\n' >"$outside_attachment/goal-objective.txt"
if outside_error=$(bash "$goal_loop" release-objective \
  --attachment-dir "$outside_attachment" \
  --expected-sha256 "$large_digest" 2>&1); then
  fail "goal cleanup accepted a lookalike outside the temporary root"
fi
case "$outside_error" in
  *'outside the temporary root'*) ;;
  *) fail "out-of-root cleanup refusal did not identify its safety boundary" ;;
esac
test -e "$outside_attachment/goal-contract.md" ||
  fail "out-of-root cleanup refusal still deleted the contract"

provenance_out=$(bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$large_goal")
provenance_attachment=$(record_value "$provenance_out" attachment_dir)
provenance_digest=$(record_value "$provenance_out" contract_sha256)
if bash "$goal_loop" release-objective \
  --attachment-dir "$provenance_attachment" \
  --expected-sha256 0000000000000000000000000000000000000000000000000000000000000000 \
  >/dev/null 2>&1; then
  fail "goal cleanup accepted mismatched provenance"
fi
test -e "$provenance_attachment/goal-contract.md" ||
  fail "provenance refusal still deleted the contract"
bash "$goal_loop" release-objective \
  --attachment-dir "$provenance_attachment" \
  --expected-sha256 "$provenance_digest" >/dev/null

hash_bin="$tmp_root/hash-bin"
mkdir -p "$hash_bin"
cat >"$hash_bin/shasum" <<'EOF'
#!/usr/bin/env bash
exit 7
EOF
chmod +x "$hash_bin/shasum"
hash_tmp="$tmp_root/hash-tmp"
mkdir -p "$hash_tmp"
if TMPDIR="$hash_tmp" PATH="$hash_bin:$PATH" \
  bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$large_goal" >/dev/null 2>&1; then
  fail "goal materialization ignored a hashing failure"
fi
for leaked_attachment in "$hash_tmp"/*; do
  test ! -e "$leaked_attachment" ||
    fail "hashing failure leaked a goal attachment"
done

empty_goal="$staging/empty-goal.md"
: >"$empty_goal"
if empty_error=$(bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$empty_goal" 2>&1); then
  fail "empty goal contract was accepted"
fi
case "$empty_error" in
  *'goal file is empty'*) ;;
  *) fail "empty goal failure was not explicit" ;;
esac

linked_goal="$staging/linked-goal.md"
ln -s "$large_goal" "$linked_goal"
if bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$linked_goal" >/dev/null 2>&1; then
  fail "symlink goal contract was accepted"
fi

repo_tmp="$repo/tmp"
mkdir -p "$repo_tmp"
if TMPDIR="$repo_tmp" bash "$goal_loop" materialize-objective \
  --repo "$repo" --goal-file "$large_goal" >/dev/null 2>&1; then
  fail "file-backed contract was materialized inside the repository"
fi

printf 'ok - native goal objective materialization\n'
