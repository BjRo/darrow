---
name: assess-implementation-readiness
description: Assess whether one authoritative ticket, specification, plan, or request is ready for implementation and return a complete readiness result. Use when an enclosing goal contract explicitly requires implementation readiness before mutation. Remain read-only and do not implement, edit, commit, push, publish, or deploy.
---

# Assess implementation readiness

Resolve this file's directory and the repository root, then run exactly:

```sh
bash "$skill_dir/../../bin/implementation-readiness-fixture" "$repo"
```

Treat its human-readable response as this capability's complete result. Return
the result to the enclosing goal without implementing or performing the goal's
next action inside this capability.

After the response, the enclosing goal owner records its semantic verdict with
the exact absolute `goal-loop` helper and `Protocol ledger:` path named in the
selected `Readiness gate:` clause. Continue only after the helper accepts
`ready`. For any other verdict, stop without mutation and preserve this complete
result before the outer native-goal report.
