#!/usr/bin/env bash
set -eu

repo=$(git rev-parse --show-toplevel)
wrapper_dir=$(CDPATH='' cd -- "$repo/.git/fixture-bin" && pwd -P)
real_go=
while IFS= read -r candidate; do
  candidate_dir=$(CDPATH='' cd -- "$(dirname -- "$candidate")" && pwd -P)
  if [ "$candidate_dir" != "$wrapper_dir" ]; then
    real_go=$candidate
    break
  fi
done < <(type -a -p go)
[ -n "$real_go" ] || exit 127

export GOMODCACHE="$repo/.fixture-state/go/modules"
export GOCACHE="$repo/.fixture-state/go/build"
export GOPATH="$repo/.fixture-state/go/workspace"
mkdir -p "$GOMODCACHE" "$GOCACHE" "$GOPATH"
exec "$real_go" "$@"
