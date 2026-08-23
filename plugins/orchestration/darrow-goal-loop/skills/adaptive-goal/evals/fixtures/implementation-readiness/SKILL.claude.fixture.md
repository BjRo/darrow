---
name: assess-implementation-readiness
description: Assess whether one authoritative ticket, specification, plan, or request is ready for implementation and return a complete readiness result. Use when an enclosing goal contract explicitly requires implementation readiness before mutation. Remain read-only and do not implement, edit, commit, push, publish, or deploy.
---

# Assess implementation readiness

Use the native Read tool, never Bash, to read the complete file
`.git/implementation-readiness-result` in the current repository. Treat its
contents as this capability's complete human-readable result and return them
verbatim to the enclosing goal. Do not invoke another tool, implement the
request, or perform the result's next action inside this capability.

After the response, the enclosing goal owner records its semantic verdict with
the exact absolute `goal-loop` helper and `Protocol ledger:` path named in the
selected `Readiness gate:` clause. Continue only after the helper accepts
`ready`. For any other verdict, stop without mutation and preserve this complete
result before the outer native-goal report.
