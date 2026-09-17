#!/usr/bin/env bash
# Real Git remote; gh only supplies forge observations. No network effects.
set -euo pipefail
SCRIPT=$(cd "$(dirname "$0")" && pwd -P)/pr.sh
test_parent=${TMPDIR:-/tmp}
work=$(mktemp -d "${test_parent%/}/pr-publication.XXXXXX")
work=$(cd "$work" && pwd -P)
trap 'rm -rf "$work"' EXIT
original_path=$PATH
mkdir "$work/bin"
cat >"$work/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
dir=$(git rev-parse --absolute-git-dir)
printf '%s\n' "$*" >>"$dir/forge-calls"
case "$1 $2" in
  'repo view') printf '%s\n' fixture/repo ;;
  'pr list')
    test "${FORGE_MODE:-}" != unavailable || exit 1
    test "${FORGE_MODE:-}" != missing || exit 0
    tip=$(git ls-remote origin refs/heads/fix/103 | awk '{print $1}')
    branch=fix/103; base=main; draft=false; cross=false
    case "${FORGE_MODE:-}" in
      stale) tip=$(git rev-parse main) ;;
      stale-after-push) tip=$(cat "$dir/old-tip") ;;
      propagating)
        calls=$(awk '/^pr list / {n++} END {print n+0}' "$dir/forge-calls")
        if [[ "$calls" -lt 3 ]]; then tip=$(cat "$dir/old-tip"); fi
        ;;
      changed-identity)
        if [[ "$tip" != "$(cat "$dir/old-tip")" ]]; then
          printf '43\thttps://github.com/fixture/repo/pull/43\tOPEN\t%s\t%s\t%s\t%s\t%s\n' "$branch" "$tip" "$base" "$draft" "$cross"
          exit 0
        fi
        ;;
      wrong-base) base=develop ;;
      wrong-head) branch=fix/other ;;
      draft) draft=true ;;
      fork) cross=true ;;
      malformed) printf '%s\n' broken; exit 0 ;;
    esac
    printf '42\thttps://github.com/fixture/repo/pull/42\tOPEN\t%s\t%s\t%s\t%s\t%s\n' "$branch" "$tip" "$base" "$draft" "$cross"
    if [[ "${FORGE_MODE:-}" == duplicate ]]; then
      printf '43\thttps://github.com/fixture/repo/pull/43\tOPEN\t%s\t%s\t%s\t%s\t%s\n' "$branch" "$tip" "$base" "$draft" "$cross"
    fi
    ;;
  *) echo "forbidden forge mutation: $*" >&2; exit 80 ;;
esac
EOF
chmod +x "$work/bin/gh"
export PATH="$work/bin:$original_path"
n=0
fresh() {
  n=$((n + 1))
  mkdir "$work/repo-$n"
  cd "$work/repo-$n"
  git init -q -b main
  git config user.name Fixture
  git config user.email fixture@example.invalid
  git config commit.gpgsign false
  git init -q --bare "$work/remote-$n.git"
  git --git-dir="$work/remote-$n.git" symbolic-ref HEAD refs/heads/main
  git remote add origin "$work/remote-$n.git"
  printf 'base\n' >result.txt
  git add result.txt
  git commit -qm 'chore: base'
  git push -qu origin main
  git remote set-head origin main
  git switch -qc fix/103
  printf 'old\n' >result.txt
  git commit -qam 'fix: first part'
  git push -qu origin fix/103
  old=$(git rev-parse HEAD)
  printf '%s\n' "$old" >.git/old-tip
  printf 'complete\n' >result.txt
  git commit -qam 'fix: complete request'
  intended=$(git rev-parse HEAD)
  export FORGE_MODE=''
}
remote_tip() { git ls-remote origin refs/heads/fix/103 | awk '{print $1}'; }
refuses() {
  if bash "$SCRIPT" "$@" >"$work/output" 2>&1; then
    echo "FAIL: expected refusal: $*" >&2
    exit 1
  fi
  test "$(remote_tip)" = "$old"
}

fresh
if ! bash "$SCRIPT" publish-existing --expected-head "$intended" >"$work/output" 2>&1; then
  cat "$work/output"
  echo 'FAIL: authorized reuse must publish the additional local commit' >&2
  exit 1
fi
test "$(remote_tip)" = "$intended"
test "$(git show origin/fix/103:result.txt)" = complete
grep -Fx "intended-commit: $intended" "$work/output"
grep -Fx "remote-commit: $intended" "$work/output"
grep -Fx "pr-commit: $intended" "$work/output"
grep -Fx 'publication: verified' "$work/output"
test "$(git rev-list --count HEAD)" = 3
printf 'uncommitted\n' >scratch.txt
bash "$SCRIPT" verify --expected-head "$intended" >"$work/output"
grep -F 'scratch.txt' "$work/output"
test -f scratch.txt
bash "$SCRIPT" publish-existing --expected-head "$intended" >"$work/output"
grep -Fx 'push: none' "$work/output"

for mode in unavailable missing stale wrong-base wrong-head draft fork malformed duplicate; do
  fresh
  export FORGE_MODE=$mode
  refuses publish-existing --expected-head "$intended"
done

fresh
refuses verify --expected-head "$intended"
refuses publish-existing --expected-head "$old"
refuses publish-existing
refuses publish-existing --expected-head HEAD
refuses publish-existing --expected-head "$intended" --force
touch .git/MERGE_HEAD
refuses publish-existing --expected-head "$intended"

fresh
export FORGE_MODE=draft
bash "$SCRIPT" publish-existing --expected-head "$intended" --draft >"$work/output"
grep -Fx 'draft: true' "$work/output"

fresh
export FORGE_MODE=stale-after-push
if bash "$SCRIPT" publish-existing --expected-head "$intended" >"$work/output" 2>&1; then
  echo 'FAIL: stale forge evidence must not complete publication' >&2; exit 1
fi
test "$(remote_tip)" = "$intended"
grep -F 'push completed' "$work/output"
if grep -q '^publication: verified$' "$work/output"; then exit 1; fi
export FORGE_MODE=''
bash "$SCRIPT" verify --expected-head "$intended" >"$work/output"
grep -Fx 'push: none' "$work/output"

fresh
export FORGE_MODE=propagating
bash "$SCRIPT" publish-existing --expected-head "$intended" >"$work/output"
grep -Fx 'publication: verified' "$work/output"
test "$(remote_tip)" = "$intended"
test "$(awk '/^pr list / {n++} END {print n+0}' .git/forge-calls)" = 3

fresh
export FORGE_MODE=changed-identity
if bash "$SCRIPT" publish-existing --expected-head "$intended" >"$work/output" 2>&1; then
  echo 'FAIL: changed PR identity must not be retried into success' >&2; exit 1
fi
test "$(remote_tip)" = "$intended"
grep -F 'PR identity changed during publication' "$work/output"

fresh
git switch -qc remote-side "$old"
printf 'remote\n' >other.txt
git add other.txt
git commit -qm 'fix: remote change'
git push -q origin HEAD:refs/heads/fix/103
old=$(remote_tip)
git switch -q fix/103
refuses publish-existing --expected-head "$intended"

fresh
git config remote.origin.pushurl "$work/elsewhere.git"
refuses publish-existing --expected-head "$intended"

fresh
git config push.default matching
git config push.followTags true
git tag -a private-tag -m private
git switch -q main
printf 'local main\n' >local.txt
git add local.txt
git commit -qm 'chore: local only'
git switch -q fix/103
mkdir subdir
cd subdir
bash "$SCRIPT" publish-existing --expected-head "$intended" >"$work/output"
test "$(git --git-dir="$work/remote-$n.git" rev-list --count main)" = 1
test -z "$(git --git-dir="$work/remote-$n.git" tag --list)"
grep -Fx 'publication: verified' "$work/output"
fresh
git branch develop main
git push -q origin develop
git --git-dir="$work/remote-$n.git" symbolic-ref HEAD refs/heads/develop
refuses publish-existing --expected-head "$intended"
bash "$SCRIPT" publish-existing --expected-head "$intended" --base main >"$work/output"
grep -Fx 'publication: verified' "$work/output"
echo 'all publication checks passed'
