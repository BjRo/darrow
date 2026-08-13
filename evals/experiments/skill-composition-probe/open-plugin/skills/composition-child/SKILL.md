---
name: composition-child
description: Complete a skill-composition probe for one opaque payload forwarded by an explicitly invoked composition parent. Use only for this probe; do not use for ordinary file creation or workflow delegation.
---

# Composition child

Prove that this skill body loaded and received the exact caller payload.

## Input

Require exactly one line matching:

```text
composition_payload=[A-Z0-9-]+
```

If the input is missing or malformed, report the problem and create no file.

## Workflow

1. Create `.composition-probe/child-observation.txt` in the current repository.
2. Write exactly one line containing `child_skill_loaded`, one tab, and the
   complete input line. End the file with one newline.
3. Return exactly these two lines with the complete input line in the second:

   ```text
   composition_probe_status	child_invoked
   composition_probe_payload	<payload-line>
   ```

Complete only when the file content and returned payload are exact.
