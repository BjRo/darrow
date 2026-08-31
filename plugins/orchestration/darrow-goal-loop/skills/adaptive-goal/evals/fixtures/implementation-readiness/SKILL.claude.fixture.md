---
name: assess-implementation-readiness
description: Assess whether one authoritative ticket, specification, plan, or request is ready for implementation and return a complete readiness result. Use when adaptive-goal preflight requires implementation readiness before owner launch. Remain read-only and do not implement, edit, commit, push, publish, or deploy.
---

# Assess implementation readiness

Use the native Read tool, never Bash, to read the complete file
`.git/implementation-readiness-result` in the current repository. Treat its
contents as this capability's complete human-readable result and return them
verbatim to adaptive-goal preflight. Do not invoke another tool, implement the
request, or perform the result's next action inside this capability. A `ready`
result may be compiled into the separate owner's inline contract. Any other
verdict stops before owner launch and mutation.
