#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd -P)
renderer="$script_dir/render-frontier"
plugin_renderer="$script_dir/../../../bin/darrow-render-plan-frontier"
temp_parent=${TMPDIR:-/tmp}
case "$temp_parent" in
  /) temp_template=/darrow-frontier-test.XXXXXX ;;
  */) temp_template=${temp_parent}darrow-frontier-test.XXXXXX ;;
  *) temp_template=${temp_parent}/darrow-frontier-test.XXXXXX ;;
esac
tmp_dir=$(mktemp -d "$temp_template")
tmp_dir=$(cd "$tmp_dir" && pwd -P)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

actual="$tmp_dir/actual"
expected="$tmp_dir/expected"
errors="$tmp_dir/errors"

assert_rendered() {
  "$BASH" "$entrypoint" \
    --evidence "$1" --question "$2" --option "$3" --option "$4" \
    --choice "$5" --rationale "$6" --deferred "$7" >"$actual" 2>"$errors" || {
    printf 'rejected valid root: %s\n' "$2" >&2
    cat "$errors" >&2
    exit 1
  }
  printf 'Evidence: %s.\n\nQ1 — %s\n\nRecommendation: Choose %s because %s.\n\nDeferred: %s. After your answer, I will recompute the next frontier.\n' \
    "${1%.}" "$2" "$5" "${6%.}" "${7%.}" >"$expected"
  diff -u "$expected" "$actual"
  test ! -s "$errors"
}

assert_refused() {
  local status=0
  "$BASH" "$entrypoint" "$@" >"$actual" 2>"$errors" || status=$?
  if test "$status" -ne 2 || test -s "$actual" || test ! -s "$errors"; then
    printf 'expected exit 2, no stdout, and a diagnostic from %s; got exit %s\n' "$entrypoint" "$status" >&2
    cat "$actual" "$errors" >&2
    exit 1
  fi
}

assert_invalid_field() {
  assert_refused \
    --evidence 'Current evidence.' --question 'Scope: local or shared?' \
    --option local --option shared --choice local \
    --rationale 'it limits coordination' --deferred 'interface and migration' "$@"
}

# Nested calls must use the interpreter under test, including refusals.
mkdir "$tmp_dir/bin"
printf '#!/bin/sh\nprintf "unexpected PATH bash\\n" >&2\nexit 99\n' >"$tmp_dir/bin/bash"
chmod +x "$tmp_dir/bin/bash"
export PATH="$tmp_dir/bin:$PATH"
cd "$tmp_dir"

for entrypoint in "$renderer" "$plugin_renderer"; do
  assert_rendered \
    'The repository stores records in one region today.' \
    'Data region: Should storage be single-region or multi-region?' \
    single-region multi-region single-region \
    'it satisfies the stated residency boundary with less operational coupling' \
    'storage vendor and migration path'

  # These subjects can be the current root instead of deferred children.
  assert_rendered \
    'Clients currently use the old service.' \
    'Migration approach: gradual or immediate?' gradual immediate gradual \
    'gradual migration limits the number of clients exposed to each change' \
    'rollout schedule and verification'
  assert_rendered \
    'The specification leaves the default policy open.' \
    'Default policy: conservative or permissive?' conservative permissive conservative \
    'a conservative default limits unintended access' \
    'configuration interface and validation'
  assert_rendered \
    'Configuration scope is already settled as per request.' \
    'Interface: parameter or setter?' parameter setter parameter \
    'a parameter makes ownership explicit in the call signature' \
    'validation and rollout'
  assert_rendered \
    'The user confirmed that existing callers must remain supported.' \
    'Compatibility: adapter or wrapper?' adapter wrapper adapter \
    'an adapter preserves backward compatibility for existing callers and current callers' \
    'packaging and verification'
  assert_rendered \
    'Both configuration sources are required by the accepted specification.' \
    'Precedence: explicit-first or environment-first?' explicit-first environment-first explicit-first \
    'explicit precedence lets an options object override an environment variable while retaining the env var as a fallback' \
    'diagnostics and validation'
  assert_rendered \
    'The user confirmed this is a greenfield service with no architecture to preserve and nothing to preserve from the retired prototype.' \
    'Initial boundary: integrated or independent?' integrated independent independent \
    'independent ownership reduces coordination' \
    'storage and deployment'
  assert_rendered \
    'The user requires compatibility with the current implementation.' \
    'Repair scope: targeted or broad?' targeted broad targeted \
    'a targeted repair is the smallest change and least disruptive to the existing implementation' \
    'verification and rollout'
  assert_rendered \
    'The requirement inventory is incomplete.' \
    'Evidence gathering: interview or workshop?' interview workshop interview \
    'there is no repository evidence of the requirement and interviews can expose absent constraints' \
    'participants and schedule'

  # Mentioning another option or child category does not select its answer.
  assert_rendered \
    'The deployment topology is undecided.' \
    'Topology: local or shared?' local shared local \
    'local ownership reduces the coordination required by shared ownership' \
    'interface and rollout'
  assert_rendered \
    'Regional residency is required.' \
    'Coverage: regional or worldwide?' regional worldwide regional \
    'regional coverage meets residency needs while leaving storage vendor selection open' \
    'storage vendor and migration path'
  assert_rendered \
    'The interface choice is open.' \
    'Interface: API or command?' API command command \
    'it supports rapid integration' \
    'authentication and rollout'

  # Structural failures produce no partially rendered response.
  assert_refused
  assert_refused --evidence
  assert_invalid_field --unknown value
  assert_invalid_field --choice global
  assert_invalid_field --question 'Scope: local? Another question?'
  assert_invalid_field --question 'Scope: local or shared'
  assert_invalid_field --question 'Scope: local only?'
  assert_invalid_field --question 'Scope: local (one process) or shared?'
  assert_invalid_field --rationale 'Which interface?'
  assert_invalid_field --deferred 'Which migration?'
  assert_invalid_field --deferred 'interface (parameter vs setter) and migration'
  assert_invalid_field --deferred 'parameter vs setter'
  assert_invalid_field --deferred 'parameter versus setter'
  for field in evidence question choice rationale deferred option; do
    assert_invalid_field "--$field" ''
    assert_invalid_field "--$field" $'first line\nsecond line'
  done
  assert_refused \
    --evidence 'Current evidence.' --question 'Scope: local or shared?' \
    --option local --choice local --rationale 'it limits coordination' \
    --deferred 'interface and migration'
done

printf 'render-frontier tests passed\n'
