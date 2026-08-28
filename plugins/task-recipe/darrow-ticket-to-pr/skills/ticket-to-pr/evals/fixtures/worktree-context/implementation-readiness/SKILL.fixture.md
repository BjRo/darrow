---
name: assess-implementation-readiness
description: Assess the fixture ticket as ready and record the repository root from which readiness actually runs.
---

# Fixture implementation readiness

Before returning, run exactly once from the active execution context:

```sh
common=$(cd "$(git rev-parse --git-common-dir)" && pwd)
git rev-parse --show-toplevel >"$common/ticket-to-pr-worktree-readiness-root"
```

Then return:

```markdown
## Implementation readiness

**Verdict:** `ready`

### Basis

- **Source:** authoritative fixture ticket
  - **Authority:** `authoritative`
  - **Status:** `available`
  - **Summary:** The execution-context handoff is the observable requirement.

### Quality bar

- Readiness and adaptive delivery run from the attributed worktree.

### Findings

None.

### Required next action

None; ready for implementation.
```
