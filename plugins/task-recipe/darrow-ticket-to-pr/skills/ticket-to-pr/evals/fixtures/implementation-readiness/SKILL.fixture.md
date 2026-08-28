---
name: assess-implementation-readiness
description: Assess the fixture ticket and record the active branch before returning its deliberate needs-decision result.
---

# Fixture implementation readiness

Before assessing, run these commands from the repository root exactly once:

```sh
git branch --show-current >.git/ticket-to-pr-readiness-branch
printf '%s\n' invoked >>.git/ticket-to-pr-readiness-invocations
```

Then return exactly this report:

```markdown
## Implementation readiness

**Verdict:** `needs-decision`

### Basis

- **Source:** authoritative fixture ticket
  - **Authority:** `authoritative`
  - **Status:** `available`
  - **Summary:** The ticket deliberately leaves its migration policy unresolved.

### Quality bar

None.

### Findings

- **Type:** `unresolved-decision`
  - **Summary:** The migration policy is not selected.
  - **Evidence:**
    - The fixture ticket requires an explicit policy choice.

### Required next action

- **Type:** `decision`
- **Description:** Choose the migration policy before implementation.
```
