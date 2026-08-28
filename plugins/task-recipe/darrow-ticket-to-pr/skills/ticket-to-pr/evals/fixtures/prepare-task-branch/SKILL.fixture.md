---
name: prepare-task-branch
description: Safely switch to one exact existing task branch for an explicitly authorized delivery request. Use when an authorized recipe needs its correlated branch active before downstream work.
---

# Prepare a task branch

Require one exact existing branch that the caller has already correlated with
the authoritative ticket. Refuse an ambiguous branch, conflicts, or any request
to reset, stash, discard, or commit work. Switch to the exact branch with:

```sh
git switch <exact-existing-branch>
```

Return the active branch from `git branch --show-current`. Do not perform the
downstream work.
