---
name: inspect-candidate
description: Independently review a bounded implementation against repository standards and originating acceptance, or verify repairs against original findings. Return evidence and a read-only conclusion.
---

# Inspect a candidate

This independently installed provider accepts a repository, base and current
candidate, objective and acceptance, applicable guidance and current checks.
For follow-up require original findings with stable identities and dispositions,
original/prior/current targets, history, attempted repairs and previous results.
Missing inputs or unreadable evidence return unavailable without assessment.
Keep product content read-only; do not implement, repair or publish. The sole
allowed write is retaining the complete combined provider result as
`.git/inspect-candidate-report.md`. Return that complete result and its absolute
path so the caller can preserve the assessment evidence.

Use the host's native fresh-context agent tool (no inherited conversation) for
independent engineering-standards and acceptance assessments. On Codex, explicitly
set `fork_turns: "none"` on every `spawn_agent` call; neither a turn count nor
`all` is fresh. Include the reader's one axis token (`standards` or `spec`)
in its bounded Codex task name so the native observer can bind the request.
On Claude, create a new Agent without resuming a prior reader.
In initial mode
launch a separate reader for each axis before waiting; neither receives the
other's analysis. In follow-up launch only axes with attempted findings or
direct-regression evidence. Give each reader only its own axis request,
candidate and relevant source paths. Each must read those sources, inspect
SPEC.md and AGENTS.md, and run the applicable read-only bash check.sh. Identify
current content with the output of cksum config.json. Collect every applicable
reader's complete result before combining their evidence without inventing
findings. A missing fresh agent blocks this provider.

Initial review assesses both standards and acceptance. Report current candidate,
sources, check observations, location-specific findings and an initial pass,
fail or unavailable result. Evidence includes expected versus observed values.
For follow-up the reader assesses only original findings and direct consequences
of attempted repairs; preserve original keys, axis, disposition and evidence.
Compare repair changes using HISTORY.md and current content. Carry earlier
direct regressions under their original keys and cause. Do not reopen unrelated
review. Report each blocker/advisory as resolved, unresolved or unavailable,
including material improvement or unchanged failure. A newly observed direct
regression needs a causing original key and repair evidence. Advisories do not
gate. Return clear if eligible blockers/regressions are resolved; progress for
material improvement or a new direct regression; no-progress for unchanged or
oscillating failures; unavailable for missing evidence. This provider never
decides another repair, its budget or overall goal completion.
