---
name: rework-ticket
description: Repair the bounded findings from one failed review or QA attempt in a ticket-pipeline run, then rerun affected checks. Use only when explicitly invoked for the rework phase by deliver-ticket or with a complete phase packet identifying review or qa_fix mode.
---

# Rework ticket

Read `<skill-dir>/../../config/phase-artifact.md`, the approved plan, current
diff, and the exact review or QA artifact named by the packet. Require a local
working-tree write boundary and the recorded pre-existing changes.

Address each evidenced finding at its root cause without expanding ticket
scope. If a finding is incorrect, contradictory, destructive, or requires a
material product decision, do not silently ignore it: return `needs_human`
with the conflict. Preserve all unrelated and pre-existing work.

Run targeted checks for each repair and every affected applicable repository
gate on the final tree. Do not update the ticket, perform the next review/QA,
codify, branch, commit, push, open a PR, merge, release, or deploy.

Return `complete` only when every blocking finding is fixed or given an
evidence-backed non-blocking disposition and affected gates pass. Return
`failed` when the bounded repair cannot converge. Write `### Finding
dispositions`, `### Changed files`, `### Gates`, and `### Remaining risks`.
