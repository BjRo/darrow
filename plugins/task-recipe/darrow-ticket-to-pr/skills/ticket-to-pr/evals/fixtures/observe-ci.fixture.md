---
name: observe-ci
description: Observe required remote CI checks for an exact published PR commit. Use when delivery must finish with green CI.
---

# Observe required CI

Run `bash .git/fixture-bin/fixture-ci <intended-full-commit-id>` from the
repository root and return its complete output.
This is a read-only remote-check observation, not permission to alter CI,
deployment, branch protections or fixture state. A failed or unavailable
observation is not green CI. The delivery owner decides continuation.
