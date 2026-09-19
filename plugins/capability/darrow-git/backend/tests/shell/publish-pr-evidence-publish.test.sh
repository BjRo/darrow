#!/usr/bin/env bash
set -euo pipefail
backend=$(cd "$(dirname "$0")/../.." && pwd -P)
ENTRYPOINT=(uv run --quiet --frozen --no-dev --project "$backend" darrow-publish-pr-evidence)
test_parent=${TMPDIR:-/tmp}; case "$test_parent" in /) template=/publish-pr-evidence-test.XXXXXX ;; */) template=${test_parent}publish-pr-evidence-test.XXXXXX ;; *) template=$test_parent/publish-pr-evidence-test.XXXXXX ;; esac
work=$(mktemp -d "$template"); work=$(cd "$work" && pwd -P)
trap '[[ "${KEEP_TEST_FILES:-}" == 1 ]] || rm -rf "$work"' EXIT
base_path=$PATH
mkdir "$work/bin" "$work/evidence"

export DARROW_EVIDENCE_FIXTURE_BACKEND="$backend"
cat > "$work/bin/gh" <<'EOF'
#!/bin/sh
exec uv run --quiet --frozen --no-dev --project "$DARROW_EVIDENCE_FIXTURE_BACKEND" \
  python "$DARROW_EVIDENCE_FIXTURE_BACKEND/tests/evidence_gh.py" "$@"
EOF
chmod +x "$work/bin/gh"
export PATH="$work/bin:$base_path"

fresh() {
  repo="$work/repo-${1}"
  mkdir "$repo"; cd "$repo"
  git init -qb main; git config user.name Fixture; git config user.email fixture@example.invalid; git config commit.gpgsign false
  printf 'base\n' > tracked; git add tracked; git commit -qm 'chore: base'
  git switch -qc feat/evidence; printf 'feature\n' >> tracked; git commit -qam 'feat: evidence'
  expected=$(git rev-parse HEAD)
  body="$work/evidence/body-$1.txt"; printf 'Verification passed for candidate %s.\n' "$expected" > "$body"
  unset NO_ATTACH STRICT_ATTACH DISTRACTING_LIMIT HOST_MODE FORGE_HEAD_MODE COMMENT_MODE
}
refuses() { if "${ENTRYPOINT[@]}" "$@" >"$work/out" 2>&1; then echo "expected refusal: $*" >&2; exit 1; fi; grep -Eq '^outcome: (refused|partial|ambiguous)$' "$work/out"; }

fresh 1
if ! "${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" >"$work/out"; then cat "$work/out"; exit 1; fi
grep -Fx 'outcome: published' "$work/out"
grep -Fx 'attachment-count: 0' "$work/out"
grep -Fx 'head-preserved: true' "$work/out"; grep -Fx 'index-preserved: true' "$work/out"
grep -Fq '.body] | @tsv' .git/api-calls
if grep -Fq 'gsub' .git/api-calls; then echo 'comment observation must use one TSV escape layer' >&2; exit 1; fi
test -f "$(sed -n 's/^prepared-body: //p' "$work/out")"
test "$(tail -c 1 "$(sed -n 's/^prepared-body: //p' "$work/out")" | od -An -tx1 | tr -d '[:space:]')" = 3e
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1
"${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" >"$work/out"
grep -Fx 'outcome: existing' "$work/out"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1
cat .git/comments >>.git/comments.copy; cat .git/comments >>.git/comments.copy; mv .git/comments.copy .git/comments
refuses publish --expected-head "$expected" --body-file "$body"
grep -Fx 'outcome: ambiguous' "$work/out"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1

fresh 2
png="$work/evidence/view.png"; jpg="$work/evidence/detail.svg"; video="$work/evidence/run.mp4"
printf '\211PNG\r\n\032\n\000\000\000\015IHDR\000\000\000\001\000\000\000\001\010\006\000\000\000\037\025\304\211\000\000\000\015IDAT\010\327c\370\317\300\360\037\000\005\000\001\377\211\231\075\035\000\000\000\000IEND\256B\140\202' > "$png"
printf '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>\n' > "$jpg"
printf '\000\000\000\030ftypmp42\000\000\000\000mp42isom\000\000\000\010mdat' > "$video"
"${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" --image "$png" --alt 'Overview screenshot' --video "$video" --explanation 'Recording of the verified flow' --image "$jpg" --alt 'Detailed result' >"$work/out"
grep -Fx 'outcome: published' "$work/out"; grep -Fx 'attachment-count: 3' "$work/out"
grep -F 'Image 1 alt text: Overview screenshot' "$(sed -n 's/^prepared-body: //p' "$work/out")"
grep -F "content identity $(git hash-object "$png")" "$(sed -n 's/^prepared-body: //p' "$work/out")"
grep -F 'Video 2 explanation: Recording of the verified flow' "$(sed -n 's/^prepared-body: //p' "$work/out")"
test 'darrow-evidence-attachment-1.png#Overview screenshot' = "$(sed -n '1p' .git/attach-order)"
test 'darrow-evidence-attachment-2.mp4' = "$(sed -n '2p' .git/attach-order)"
test 'darrow-evidence-attachment-3.svg#Detailed result' = "$(sed -n '3p' .git/attach-order)"
test -f "$png" && test -f "$jpg" && test -f "$video"

fresh 3
png_a="$work/evidence/a.svg"; png_b="$work/evidence/b.svg"; printf '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>\n' > "$png_a"; cp "$png_a" "$png_b"
refuses publish --expected-head "$expected" --body-file "$body" --image "$png_a" --alt one --image "$png_b" --alt two
empty="$work/evidence/empty.svg"; : > "$empty"; refuses publish --expected-head "$expected" --body-file "$body" --image "$empty" --alt empty
missing="$work/evidence/missing.svg"; refuses publish --expected-head "$expected" --body-file "$body" --image "$missing" --alt missing
unsupported="$work/evidence/data.txt"; printf x > "$unsupported"; refuses publish --expected-head "$expected" --body-file "$body" --image "$unsupported" --alt data
renamed="$work/evidence/not-image.png"; printf 'plain text\n' > "$renamed"; refuses publish --expected-head "$expected" --body-file "$body" --image "$renamed" --alt invalid
truncated="$work/evidence/truncated.png"; printf '\211PNG\r\n\032\n' > "$truncated"; refuses publish --expected-head "$expected" --body-file "$body" --image "$truncated" --alt truncated
no_ihdr="$work/evidence/no-ihdr.png"; printf '\211PNG\r\n\032\n\000\000\000\025tEXt000000000000000000000\000\000\000\000IEND\256B\140\202' > "$no_ihdr"; refuses publish --expected-head "$expected" --body-file "$body" --image "$no_ihdr" --alt malformed
zero_width="$work/evidence/zero-width.png"; printf '\211PNG\r\n\032\n\000\000\000\015IHDR\000\000\000\000\000\000\000\001\010\006\000\000\000\037\025\304\211\000\000\000\015IDAT\010\327c\370\317\300\360\037\000\005\000\001\377\211\231\075\035\000\000\000\000IEND\256B\140\202' > "$zero_width"; refuses publish --expected-head "$expected" --body-file "$body" --image "$zero_width" --alt invalid-width
zero_height="$work/evidence/zero-height.png"; printf '\211PNG\r\n\032\n\000\000\000\015IHDR\000\000\000\001\000\000\000\000\010\006\000\000\000\037\025\304\211\000\000\000\015IDAT\010\327c\370\317\300\360\037\000\005\000\001\377\211\231\075\035\000\000\000\000IEND\256B\140\202' > "$zero_height"; refuses publish --expected-head "$expected" --body-file "$body" --image "$zero_height" --alt invalid-height
refuses publish --expected-head "$expected" --body-file "$body" --image "$png_a" --alt '   '
refuses publish --expected-head "$expected" --body-file "$body" --image "$png_a" --alt $'one\nattachment-2=forged'
oversize="$work/evidence/large.svg"; printf '<svg xmlns="http://www.w3.org/2000/svg">' > "$oversize"; dd if=/dev/zero bs=1048577 count=10 >>"$oversize" 2>/dev/null
refuses publish --expected-head "$expected" --body-file "$body" --image "$oversize" --alt large

fresh 4
NO_ATTACH=1; export NO_ATTACH
refuses publish --expected-head "$expected" --body-file "$body"
unset NO_ATTACH
STRICT_ATTACH=1; export STRICT_ATTACH
refuses publish --expected-head "$expected" --body-file "$body"
unset STRICT_ATTACH
DISTRACTING_LIMIT=1; export DISTRACTING_LIMIT
refuses publish --expected-head "$expected" --body-file "$body"
unset DISTRACTING_LIMIT
HOST_MODE=enterprise; export HOST_MODE
refuses publish --expected-head "$expected" --body-file "$body"
unset HOST_MODE
FORGE_HEAD_MODE=wrong; export FORGE_HEAD_MODE
refuses publish --expected-head "$expected" --body-file "$body"
unset FORGE_HEAD_MODE

fresh 5
p1="$work/evidence/path-one.svg"; p2="$work/evidence/path-two.svg"; printf '<svg xmlns="http://www.w3.org/2000/svg"><text>identity</text></svg>\n' > "$p1"; cp "$p1" "$p2"
"${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" --image "$p1" --alt 'Same presentation' >"$work/one"
rm -f .git/comments .git/comment-calls .git/attach-order
"${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" --image "$p2" --alt 'Same presentation' >"$work/two"
test "$(sed -n 's/^identity: //p' "$work/one")" = "$(sed -n 's/^identity: //p' "$work/two")"

fresh 6
COMMENT_MODE=partial; export COMMENT_MODE
refuses publish --expected-head "$expected" --body-file "$body"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1

fresh 11
COMMENT_MODE=extra; export COMMENT_MODE
refuses publish --expected-head "$expected" --body-file "$body"
grep -Fx 'outcome: partial' "$work/out"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1

fresh 12
COMMENT_MODE=duplicate-url; export COMMENT_MODE
dup_one="$work/evidence/unique-one.svg"; dup_two="$work/evidence/unique-two.svg"
printf '<svg xmlns="http://www.w3.org/2000/svg"><text>one</text></svg>\n' > "$dup_one"
printf '<svg xmlns="http://www.w3.org/2000/svg"><text>two</text></svg>\n' > "$dup_two"
refuses publish --expected-head "$expected" --body-file "$body" --image "$dup_one" --alt one --image "$dup_two" --alt two
grep -Fx 'outcome: partial' "$work/out"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1

fresh 13
printf 'Evidence and https://github.com/user-attachments/assets/stale\n' > "$body"
refuses publish --expected-head "$expected" --body-file "$body"
test ! -f .git/comment-calls

fresh 14
printf 'Windows path C:\\tmp\r\nSecond line.\n' > "$body"
"${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" >"$work/out"
grep -Fx 'outcome: published' "$work/out"
"${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" >"$work/out"
grep -Fx 'outcome: existing' "$work/out"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1

fresh 8
COMMENT_MODE=head-change; export COMMENT_MODE
refuses publish --expected-head "$expected" --body-file "$body"
grep -Fx 'outcome: partial' "$work/out"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1
unset COMMENT_MODE
unset COMMENT_MODE
refuses publish --expected-head "$expected" --body-file "$body"
test "$(wc -l < .git/comment-calls | tr -d ' ')" -eq 1

fresh 7
many=(); i=1
while [[ "$i" -le 51 ]]; do f="$work/evidence/count-$i.svg"; printf '<svg xmlns="http://www.w3.org/2000/svg"><text>%s</text></svg>\n' "$i" > "$f"; many+=(--image "$f" --alt "image $i"); i=$((i+1)); done
refuses publish --expected-head "$expected" --body-file "$body" "${many[@]}"

mkdir "$work/tmp-parent"
fresh 9
TMPDIR="$work/tmp-parent" "${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" >"$work/out"
grep -Fx 'outcome: published' "$work/out"
fresh 10
TMPDIR="$work/tmp-parent/" "${ENTRYPOINT[@]}" publish --expected-head "$expected" --body-file "$body" >"$work/out"
grep -Fx 'outcome: published' "$work/out"

echo 'all publish-pr-evidence checks passed'
