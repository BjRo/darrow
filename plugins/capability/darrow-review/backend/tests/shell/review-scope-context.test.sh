#!/usr/bin/env bash
# Exercise the documented bootstrap and emitted commands as callers execute them.
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
PLUGIN=$(cd "$SCRIPT_DIR/../../.." && pwd -P)
SCOPE=(uv run --quiet --frozen --no-dev --project "$PLUGIN/backend" review-scope)
SKILL=$PLUGIN/skills/code-review/SKILL.md
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template=/darrow-review-context.XXXXXX ;;
  */) temp_template=${temp_parent}darrow-review-context.XXXXXX ;;
  *) temp_template=$temp_parent/darrow-review-context.XXXXXX ;;
esac
work_dir=$(mktemp -d "$temp_template")
work_dir=$(cd "$work_dir" && pwd -P)
trap 'rm -rf "$work_dir"' EXIT

make_repo() {
  git init -qb main "$1"
  git -C "$1" config user.name test
  git -C "$1" config user.email test@example.invalid
  printf 'base\n' >"$1/value.txt"
  git -C "$1" add value.txt
  git -C "$1" commit -qm 'chore: fixture'
}

field() {
  awk -F '\t' -v key="$1" '$1 == key { print $2 }' "$2"
}

target=$work_dir/target
hostile=$work_dir/hostile
make_repo "$target"
make_repo "$hostile"
printf 'requested\n' >"$target/value.txt"
mkdir "$target/subdir"

# Run the actual first recipe, replacing only its caller-supplied input.
awk '
  /^```sh$/ && !seen { active = 1; seen = 1; next }
  active && /^```$/ { exit }
  active && !/^repo_input=/ { print }
' "$SKILL" >"$work_dir/bootstrap.sh"
# Expand repo only when the extracted bootstrap executes.
# shellcheck disable=SC2016
printf 'printf "%%s\\n" "$repo"\n' >>"$work_dir/bootstrap.sh"
bound=$(cd / &&
  GIT_DIR="$hostile/.git" GIT_WORK_TREE="$hostile" \
  GIT_COMMON_DIR="$hostile/.git" GIT_INDEX_FILE="$hostile/.git/index" \
  GIT_OBJECT_DIRECTORY="$hostile/.git/objects" \
  GIT_ALTERNATE_OBJECT_DIRECTORIES="$hostile/.git/objects" \
  repo_input="$target/subdir" "$BASH" "$work_dir/bootstrap.sh")
[ "$bound" = "$target" ] || {
  printf 'FAIL: bootstrap selected %s instead of %s\n' "$bound" "$target"
  exit 1
}
printf 'ok: documented bootstrap ignores ambient repository selectors\n'

# Include spaces and characters that break superficial double-quoting.
# shellcheck disable=SC2016,SC1003
special='review scope '"'"' $HOME $(touch INJECTED) `touch INJECTED` ; & [x] \'
quoted_repo=$work_dir/$special
tool_dir=$work_dir/tool-$special
make_repo "$quoted_repo"
mkdir "$tool_dir" "$work_dir/caller" "$work_dir/shell-bin"
mkdir "$tool_dir/backend"
cp -R "$PLUGIN/backend/src" "$PLUGIN/backend/pyproject.toml" "$PLUGIN/backend/uv.lock" "$tool_dir/backend/"
# Generated commands name bash; pin that name to the matrix interpreter.
ln -s "$BASH" "$work_dir/shell-bin/bash"
export PATH="$work_dir/shell-bin:$PATH"
printf 'prior\n' >"$quoted_repo/value.txt"
(cd "$work_dir" && CDPATH=. uv run --quiet --frozen --no-dev --project "tool-$special/backend" review-scope prepare \
  --repo "$quoted_repo" --base HEAD --target WORKTREE) >"$work_dir/prior.tsv"
prior=$(field manifest "$work_dir/prior.tsv")
show=$(field show_command "$prior")
(cd "$work_dir/caller" && "$BASH" -c "$show") >"$work_dir/shown.patch"
cmp "$(field diff "$prior")" "$work_dir/shown.patch"
printf 'ok: show command preserves tool and manifest arguments from another directory\n'

printf 'current\n' >"$quoted_repo/value.txt"
uv run --quiet --frozen --no-dev --project "$tool_dir/backend" review-scope prepare --repo "$quoted_repo" \
  --base HEAD --target WORKTREE --prior-manifest "$prior" >"$work_dir/current.tsv"
current=$(field manifest "$work_dir/current.tsv")
repair=$(field repair_show_command "$current")
(cd "$work_dir/caller" && "$BASH" -c "$repair") >"$work_dir/repair.patch"
"${SCOPE[@]}" compare --prior-manifest "$prior" \
  --current-manifest "$current" >"$work_dir/expected.patch"
cmp "$work_dir/expected.patch" "$work_dir/repair.patch"
[ ! -e "$work_dir/caller/INJECTED" ]
printf 'ok: repair command preserves both manifests without shell expansion\n'
