## Implementation readiness

**Verdict:** `blocked`

### Basis

- **Source:** authoritative fixture specification
  - **Authority:** `authoritative`
  - **Status:** `available`
  - **Summary:** A required external prerequisite is unavailable.

### Quality bar

None.

### Findings

- **Type:** `dependency`
  - **Summary:** Implementation cannot begin while the prerequisite is unavailable.
  - **Evidence:**
    - The fixture marks the request as externally blocked.

### Required next action

- **Type:** `unblock`
- **Description:** Restore the required prerequisite before implementation starts.
