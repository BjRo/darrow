#!/usr/bin/env bash
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
renderer="$script_dir/render-frontier"
plugin_renderer="$script_dir/../../../bin/darrow-render-plan-frontier"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/darrow-frontier-test.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

actual="$tmp_dir/actual"
expected="$tmp_dir/expected"

"$renderer" \
  --evidence 'The repository stores records in one region today.' \
  --question 'Data region: Should storage be single-region or multi-region?' \
  --option 'single-region' \
  --option 'multi-region' \
  --choice 'single-region' \
  --rationale 'it satisfies the stated residency boundary with less operational coupling' \
  --deferred 'storage vendor and migration path' >"$actual"

printf '%s\n' \
  'Evidence: The repository stores records in one region today.' \
  '' \
  'Q1 — Data region: Should storage be single-region or multi-region?' \
  '' \
  'Recommendation: Choose single-region because it satisfies the stated residency boundary with less operational coupling.' \
  '' \
  'Deferred: storage vendor and migration path. After your answer, I will recompute the next frontier.' >"$expected"

diff -u "$expected" "$actual"

"$plugin_renderer" \
  --evidence 'The repository stores records in one region today.' \
  --question 'Data region: Should storage be single-region or multi-region?' \
  --option 'single-region' \
  --option 'multi-region' \
  --choice 'single-region' \
  --rationale 'it satisfies the stated residency boundary with less operational coupling' \
  --deferred 'storage vendor and migration path' >"$actual"
diff -u "$expected" "$actual"

if "$renderer" \
  --evidence 'Current evidence.' \
  --question 'Scope: Should it be local or shared?' \
  --option 'local' \
  --option 'shared' \
  --choice 'global' \
  --rationale 'it is familiar' \
  --deferred 'API shape and migration' >/dev/null 2>&1; then
  printf 'accepted a choice absent from the root question\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'Current evidence.' \
  --question 'Scope: Should it be local or shared? Which default applies?' \
  --option 'local' \
  --option 'shared' \
  --choice 'local' \
  --rationale 'it avoids shared state' \
  --deferred 'default policy and migration' >/dev/null 2>&1; then
  printf 'accepted more than one root question\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'Current evidence.' \
  --question 'Scope: Should it be local or shared?' \
  --option 'local' \
  --option 'shared' \
  --choice 'local' \
  --rationale 'it preserves compatibility' \
  --deferred 'compatibility and migration' >/dev/null 2>&1; then
  printf 'accepted a deferred-node selection in the rationale\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'Current evidence.' \
  --question 'Scope: Should it be local or shared?' \
  --option 'local' \
  --option 'shared' \
  --choice 'local' \
  --rationale 'local is simple while shared could be added later' \
  --deferred 'interface and migration' >/dev/null 2>&1; then
  printf 'accepted an unselected root option in the rationale\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'Current evidence.' \
  --question 'Scope: Should it be local or shared?' \
  --option 'local' \
  --option 'shared' \
  --choice 'shared' \
  --rationale 'it preserves the current call signature for existing callers' \
  --deferred 'API shape, default semantics, validation, compatibility, and migration' >/dev/null 2>&1; then
  printf 'accepted a deferred compatibility or API selection in the rationale\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'Current evidence.' \
  --question 'Scope: Should it be local or shared?' \
  --option 'local' \
  --option 'shared' \
  --choice 'local' \
  --rationale 'it minimizes coordination overhead' \
  --deferred 'API shape (parameter vs setter), validation, compatibility, and migration' >/dev/null 2>&1; then
  printf 'accepted child-option examples in the deferred list\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'The repository has one in-memory array, so this is a greenfield decision.' \
  --question 'Storage boundary: Should it use a shared archive or tenant-isolated stores?' \
  --option 'shared archive' \
  --option 'tenant-isolated stores' \
  --choice 'tenant-isolated stores' \
  --rationale 'it provides a clearer isolation boundary' \
  --deferred 'encryption-key ownership, partition format, and migration strategy' >/dev/null 2>&1; then
  printf 'accepted a sparse repository as greenfield authority\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'The repository stores every tenant event in one array.' \
  --question 'Storage boundary: shared archive (tenant ID attribute) or tenant-isolated stores (one store per tenant)?' \
  --option 'shared archive' \
  --option 'tenant-isolated stores' \
  --choice 'tenant-isolated stores' \
  --rationale 'it provides a clearer isolation boundary' \
  --deferred 'encryption-key ownership, partition format, and migration strategy' >/dev/null 2>&1; then
  printf 'accepted child mechanics inside root option labels\n' >&2
  exit 1
fi

if "$renderer" \
  --evidence 'The repository currently applies one shared constant.' \
  --question 'Configuration scope: process-wide or per request?' \
  --option 'process-wide' \
  --option 'per request' \
  --choice 'process-wide' \
  --rationale 'the current shared constant makes this the smallest change' \
  --deferred 'public interface, default behavior, validation, compatibility, and migration' >/dev/null 2>&1; then
  printf 'accepted migration convenience as a root rationale\n' >&2
  exit 1
fi

printf 'render-frontier tests passed\n'
