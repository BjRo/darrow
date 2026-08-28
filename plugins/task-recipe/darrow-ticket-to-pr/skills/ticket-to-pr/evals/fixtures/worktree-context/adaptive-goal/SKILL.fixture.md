---
name: adaptive-goal
description: Accept one bounded ready fixture delivery, record its actual execution root, and return the deliberate fixture blocker without product mutation.
---

# Fixture adaptive goal

From the execution context supplied by the caller, run exactly once:

```sh
common=$(cd "$(git rev-parse --git-common-dir)" && pwd)
git rev-parse --show-toplevel >"$common/ticket-to-pr-worktree-adaptive-root"
```

Do not implement, commit, push, or open a pull request. Return exactly:

```markdown
## Adaptive delivery result

**Status:** blocked
**Reason:** fixture-context-stop
```
