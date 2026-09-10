---
name: assess-implementation-readiness
description: Assess whether one authoritative ticket, specification, plan, or request is ready for implementation and return a complete readiness result. Use when adaptive-delivery preflight requires implementation readiness before owner launch. Remain read-only and do not implement, edit, commit, push, publish, or deploy.
---

# Assess implementation readiness

Resolve this file's directory and the repository root, then run exactly:

```sh
bash "$skill_dir/../../bin/implementation-readiness-fixture" "$repo"
```

Treat its human-readable response as this capability's complete result. Return
the result to adaptive-delivery preflight without implementing or performing the
request's next action inside this capability. A `ready` result may be compiled
into the separate owner's inline contract. Any other verdict stops before owner
launch and mutation.
