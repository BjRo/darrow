#!/usr/bin/env bash
set -u

SCRIPT_DIR=$(cd "$(dirname "$0")" 2>/dev/null && pwd -P)
BACKEND=$(cd "$SCRIPT_DIR/../backend" 2>/dev/null && pwd -P)
TAB=$(printf '\t')
FAILURES=0
TEMPS=()

inspect_skill() {
  uv run --quiet --frozen --no-dev --project "$BACKEND" inspect-skill "$@"
}

cleanup() {
  local directory
  for directory in "${TEMPS[@]}"; do
    rm -rf "$directory"
  done
}
trap cleanup EXIT HUP INT TERM

new_plugin() {
  PLUGIN=$(mktemp -d) || exit 1
  PLUGIN=$(cd "$PLUGIN" 2>/dev/null && pwd -P) || exit 1
  TEMPS[${#TEMPS[@]}]=$PLUGIN
  SKILL="$PLUGIN/skills/author-release-skill"
  mkdir -p "$SKILL/references" "$SKILL/scripts"
  printf '%s\n' \
    '---' \
    'name: author-release-skill' \
    'description: Create release workflow skills when a repository needs a repeatable publishing procedure.' \
    '---' \
    '' \
    '# Author release skill' \
    '' \
    'Read [policy](references/policy.md) before changing release safeguards.' \
    >"$SKILL/SKILL.md"
  printf '# Policy\n' >"$SKILL/references/policy.md"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$SKILL/scripts/check-release"
}

pass() {
  printf '  ok: %s\n' "$1"
}

fail() {
  printf '  FAIL: %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

expect_contains() {
  local name=$1 needle=$2 value=$3
  case "$value" in
    *"$needle"*) pass "$name" ;;
    *) fail "$name (missing: $needle)" ;;
  esac
}

expect_failure() {
  local name=$1
  shift
  if "$@" >/dev/null 2>&1; then
    fail "$name"
  else
    pass "$name"
  fi
}

printf '%s\n' 'valid skill inspection'
new_plugin
before=$(find "$PLUGIN" -print | LC_ALL=C sort)
output=$(inspect_skill inspect "$SKILL" "$PLUGIN") || fail "valid skill is accepted"
after=$(find "$PLUGIN" -print | LC_ALL=C sort)
expect_contains "reports the stable format" "format${TAB}darrow-skill-inspection-v1" "$output"
expect_contains "reports the absolute skill directory" "skill_directory${TAB}$SKILL" "$output"
expect_contains "reports the absolute plugin root" "plugin_root${TAB}$PLUGIN" "$output"
expect_contains "reports an absolute local reference" "local_reference${TAB}$SKILL/references/policy.md" "$output"
expect_contains "reports an absolute bundled script" "bundled_script${TAB}$SKILL/scripts/check-release" "$output"
expect_contains "reports successful validation" "status${TAB}valid" "$output"
if [ "$before" = "$after" ]; then
  pass "inspection is read-only"
else
  fail "inspection is read-only"
fi

printf '%s\n' 'temporary path spelling'
TEMP_PARENT=$(mktemp -d) || exit 1
TEMP_PARENT=$(cd "$TEMP_PARENT" 2>/dev/null && pwd -P) || exit 1
TEMPS[${#TEMPS[@]}]=$TEMP_PARENT
MOCK_BIN=$TEMP_PARENT/bin
mkdir "$MOCK_BIN"
REAL_MKTEMP=$(command -v mktemp) || exit 1
export REAL_MKTEMP
printf '%s\n' \
  '#!/bin/sh' \
  'template=' \
  "for argument do template=\$argument; done" \
  "case \"\$template\" in" \
  '  *//*) exit 64 ;;' \
  'esac' \
  "exec \"\$REAL_MKTEMP\" \"\$@\"" \
  >"$MOCK_BIN/mktemp"
chmod +x "$MOCK_BIN/mktemp"
if PATH="$MOCK_BIN:$PATH" TMPDIR=$TEMP_PARENT inspect_skill inspect "$SKILL" "$PLUGIN" >/dev/null 2>&1; then
  pass "temporary path without trailing separator is accepted"
else
  fail "temporary path without trailing separator is accepted"
fi
if PATH="$MOCK_BIN:$PATH" TMPDIR=$TEMP_PARENT/ inspect_skill inspect "$SKILL" "$PLUGIN" >/dev/null 2>&1; then
  pass "temporary path with trailing separator is accepted"
else
  fail "temporary path with trailing separator is accepted"
fi

cp "$SKILL/SKILL.md" "$SKILL/SKILL.portable"
sed '/^description:/a\
disable-model-invocation: true' "$SKILL/SKILL.portable" >"$SKILL/SKILL.md"
if inspect_skill inspect "$SKILL" "$PLUGIN" >/dev/null 2>&1; then
  pass "disable-model-invocation true is accepted"
else
  fail "disable-model-invocation true is accepted"
fi
cp "$SKILL/SKILL.portable" "$SKILL/SKILL.md"

sed '/^description:/a\
disable-model-invocation: false' "$SKILL/SKILL.portable" >"$SKILL/SKILL.md"
if inspect_skill inspect "$SKILL" "$PLUGIN" >/dev/null 2>&1; then
  pass "disable-model-invocation false is accepted"
else
  fail "disable-model-invocation false is accepted"
fi
cp "$SKILL/SKILL.portable" "$SKILL/SKILL.md"

sed '/^description:/a\
disable-model-invocation: sometimes' "$SKILL/SKILL.portable" >"$SKILL/SKILL.md"
expect_failure "disable-model-invocation requires a boolean" inspect_skill inspect "$SKILL" "$PLUGIN"
cp "$SKILL/SKILL.portable" "$SKILL/SKILL.md"

sed '/^description:/a\
disable-model-invocation: true\
disable-model-invocation: false' "$SKILL/SKILL.portable" >"$SKILL/SKILL.md"
expect_failure "disable-model-invocation cannot be duplicated" inspect_skill inspect "$SKILL" "$PLUGIN"
cp "$SKILL/SKILL.portable" "$SKILL/SKILL.md"

sed '/^description:/a\
unknown-host-field: true' "$SKILL/SKILL.portable" >"$SKILL/SKILL.md"
expect_failure "unknown frontmatter remains fail-closed" inspect_skill inspect "$SKILL" "$PLUGIN"
cp "$SKILL/SKILL.portable" "$SKILL/SKILL.md"

printf '%s\n' 'fail-closed inputs'
missing="$PLUGIN/skills/missing/SKILL.md"
set +e
missing_output=$(inspect_skill inspect "$PLUGIN/skills/missing" "$PLUGIN" 2>&1)
missing_status=$?
set -e
if [ "$missing_status" -ne 0 ]; then
  pass "missing skill fails"
else
  fail "missing skill fails"
fi
expect_contains "missing error identifies an absolute path" "$missing" "$missing_output"
missing_plugin="$PLUGIN/missing-plugin"
set +e
plugin_output=$(cd "$PLUGIN" && inspect_skill inspect skills/author-release-skill missing-plugin 2>&1)
plugin_status=$?
set -e
if [ "$plugin_status" -ne 0 ]; then
  pass "missing plugin root fails"
else
  fail "missing plugin root fails"
fi
expect_contains "plugin-root error identifies an absolute path" "$missing_plugin" "$plugin_output"

printf '%s\n' 'metadata and containment counterexamples'
cp "$SKILL/SKILL.md" "$SKILL/SKILL.valid"
sed 's/name: author-release-skill/name: different-name/' "$SKILL/SKILL.valid" >"$SKILL/SKILL.md"
expect_failure "frontmatter name must match the directory" inspect_skill inspect "$SKILL" "$PLUGIN"
cp "$SKILL/SKILL.valid" "$SKILL/SKILL.md"

sed 's/name: author-release-skill/name: "author-release-skill/' "$SKILL/SKILL.valid" >"$SKILL/SKILL.md"
expect_failure "frontmatter rejects an unmatched quote" inspect_skill inspect "$SKILL" "$PLUGIN"
cp "$SKILL/SKILL.valid" "$SKILL/SKILL.md"

EXTERNAL=$(mktemp -d) || exit 1
EXTERNAL=$(cd "$EXTERNAL" 2>/dev/null && pwd -P) || exit 1
TEMPS[${#TEMPS[@]}]=$EXTERNAL
printf '%s\n' '---' 'name: symlink-skill' 'description: Validate a symbolic-link boundary.' '---' >"$EXTERNAL/SKILL.md"
mkdir -p "$PLUGIN/skills/symlink-skill"
ln -s "$EXTERNAL/SKILL.md" "$PLUGIN/skills/symlink-skill/SKILL.md"
expect_failure "skill file symlink is rejected" inspect_skill inspect "$PLUGIN/skills/symlink-skill" "$PLUGIN"

printf '# External policy\n' >"$EXTERNAL/policy.md"
rm "$SKILL/references/policy.md"
ln -s "$EXTERNAL/policy.md" "$SKILL/references/policy.md"
expect_failure "local reference symlink is rejected" inspect_skill inspect "$SKILL" "$PLUGIN"
rm "$SKILL/references/policy.md"
printf '# Policy\n' >"$SKILL/references/policy.md"

mkdir "$SKILL/scripts/private"
printf '#!/usr/bin/env bash\nexit 0\n' >"$SKILL/scripts/private/hidden-check"
chmod 000 "$SKILL/scripts/private"
expect_failure "unreadable nested script directory fails closed" inspect_skill inspect "$SKILL" "$PLUGIN"
chmod 700 "$SKILL/scripts/private"

printf '\nRead [external](../../../outside-the-plugin.md).\n' >>"$SKILL/SKILL.md"
expect_failure "a local reference cannot escape the plugin" inspect_skill inspect "$SKILL" "$PLUGIN"

printf '%s\n' 'space-bearing absolute paths'
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) space_template='/darrow skill.XXXXXX' ;;
  */) space_template="${temp_parent}darrow skill.XXXXXX" ;;
  *) space_template="${temp_parent}/darrow skill.XXXXXX" ;;
esac
SPACE_PLUGIN=$(mktemp -d "$space_template") || exit 1
SPACE_PLUGIN=$(cd "$SPACE_PLUGIN" 2>/dev/null && pwd -P) || exit 1
TEMPS[${#TEMPS[@]}]=$SPACE_PLUGIN
mkdir -p "$SPACE_PLUGIN/skills/space-skill"
printf '%s\n' '---' 'name: space-skill' 'description: Inspect a skill stored below a path containing spaces.' '---' >"$SPACE_PLUGIN/skills/space-skill/SKILL.md"
space_output=$(inspect_skill inspect "$SPACE_PLUGIN/skills/space-skill" "$SPACE_PLUGIN") || fail "space-bearing path is accepted"
expect_contains "space-bearing path remains absolute" "skill_directory${TAB}$SPACE_PLUGIN/skills/space-skill" "$space_output"

if [ "$FAILURES" -ne 0 ]; then
  printf '%s test(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf '%s\n' 'all inspect-skill tests passed'
