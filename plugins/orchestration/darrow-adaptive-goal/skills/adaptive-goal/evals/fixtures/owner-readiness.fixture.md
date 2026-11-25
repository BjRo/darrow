---
name: assess-implementation-readiness
description: Assess readiness of an authoritative request, including reassessment of affected assumptions during implementation. Remain read-only and return the assessment to the invoking agent.
---

# Assess implementation readiness

Resolve the repository root as `repo`. From this file's absolute location,
derive the normalized absolute path to the host directory (`.agents`)
that contains its `skills/` directory. Substitute that path literally for
`<absolute-host-dir>` in the helper command.

```sh
uv run --quiet --no-project "<absolute-host-dir>/backend/scripts/run_locked.py" adaptive-goal-fixture readiness "$repo"
```

Return its complete assessment to the invoking agent. Do not implement the
request or transfer execution to another agent inside this capability.
