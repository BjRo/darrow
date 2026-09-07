#!/usr/bin/env bash
set -euo pipefail
fixtures=$(cd "$1" && pwd -P)
variant=$2
mkdir -p .git/fixture-bin
cp "$fixtures/composition-gh" .git/fixture-bin/gh
chmod +x .git/fixture-bin/gh
git init -q --bare .git/remote.git
git --git-dir=.git/remote.git symbolic-ref HEAD refs/heads/main
git remote add origin "$PWD/.git/remote.git"
git push -qu origin main
git remote set-head origin main
git switch -qc fix/GH-42-timeout
printf 'Initial delivery notes.\n' >NOTES.md
git add NOTES.md
git commit -qm 'docs: describe timeout behavior'
git push -qu origin fix/GH-42-timeout
git rev-parse HEAD >.git/original-pr-head
printf 'Additional local delivery notes.\n' >>NOTES.md
git commit -qam 'docs: clarify timeout intent'
git rev-parse HEAD >.git/original-local-head
if [[ "$variant" == builtin ]]; then
  cp "$fixtures/composition-bash" .git/fixture-bin/bash
  chmod +x .git/fixture-bin/bash
fi
if [[ "$variant" == replacement ]]; then
  for host in .agents .claude; do
    mkdir -p "$host/skills/ship-proposal"
    cp "$fixtures/ship-proposal.fixture.md" "$host/skills/ship-proposal/SKILL.md"
  done
  cp "$fixtures/ship-proposal" .git/fixture-bin/ship-proposal
  chmod +x .git/fixture-bin/ship-proposal
fi
