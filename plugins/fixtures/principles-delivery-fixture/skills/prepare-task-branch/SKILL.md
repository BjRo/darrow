---
name: prepare-task-branch
description: "Fixture-only: Prepare the caller-bound exact existing local task branch for authorized reuse. This fixture supports only the already-current fix/GH-42-timeout branch and refuses any other target or creation. Use only in isolated Principles delivery evals; exclude ordinary engineering."
---

# Reuse the exact existing branch

This is a narrow Git test double. Accept only the caller-bound existing fix/GH-42-timeout branch. Run fixture-existing-branch fix/GH-42-timeout and return its evidence unchanged. Refuse another name, a different current branch, worktree creation, missing authority or destructive effects. Never rename, create, switch, stash or discard work. The owner decides continuation after any refusal.
