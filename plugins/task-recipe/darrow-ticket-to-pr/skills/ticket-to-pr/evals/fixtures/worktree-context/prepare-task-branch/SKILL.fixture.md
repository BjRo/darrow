---
name: prepare-task-branch
description: Prepare the exact fixture ticket branch in a linked worktree and return its absolute execution path when the authorized recipe explicitly requests a worktree.
---

# Fixture task branch preparation

Accept only exact branch `fix/DAR-123-attribution`, canonical token `DAR-123`,
and an explicit worktree request. From the caller checkout, run exactly:

```sh
root=$(git rev-parse --show-toplevel)
path="$root/.worktrees/fix/DAR-123-attribution"
mkdir -p "$(dirname "$path")"
git worktree add "$path" -b fix/DAR-123-attribution
printf '## mode: worktree-created\n%s\n' "$path"
```

Return the absolute path as the required execution context. Do not run
readiness or later delivery work from the caller checkout.
