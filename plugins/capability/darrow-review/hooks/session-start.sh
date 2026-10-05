#!/usr/bin/env bash
set -eu
context_dir=$(CDPATH='' cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
skill_dir=$(CDPATH='' cd -- "$context_dir/../skills/code-review" && pwd -P)
skill_file="$skill_dir/SKILL.md"
[ -f "$skill_file" ]
[ -r "$skill_file" ]
printf 'DARROW_REVIEW_SKILL_PATH_V1: For matching review or repair-verification requests, read this complete skill file: %s\n' "$skill_file"
cat "$context_dir/context.txt"
