#!/usr/bin/env bash
set -eu
context_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
cat "$context_dir/context.txt"
