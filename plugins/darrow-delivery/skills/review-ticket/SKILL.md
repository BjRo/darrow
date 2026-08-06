---
name: review-ticket
description: Independently review the current local change for ticket fulfillment and repository correctness after implementation or rework, without repairing it. Use only when explicitly invoked for the review phase by deliver-ticket or with a complete phase packet.
---

# Review ticket

Read `<skill-dir>/../../config/phase-artifact.md`, the ticket snapshot, latest
approved plan, implementation/rework artifact, repository instructions, and
the full final diff from the packet's base revision. Do not edit product files,
tests, configuration, guidance, tracker state, commits, or external systems.

Review on two axes:

1. Ticket fulfillment: every acceptance criterion, scope boundary, edge case,
   and approved plan decision is implemented.
2. Repository correctness: behavior, safety, compatibility, tests, and
   applicable repository rules are satisfied.

Run or validate relevant deterministic commands rather than trusting the
implementation claim. A finding must include severity, absolute path and line
or command, violated criterion, concrete evidence, and a bounded fix. Do not
fail preferences without a repository or ticket requirement. On review pass
two, verify prior findings and the rework delta; do not manufacture unrelated
new scope.

Return `changes_requested` for any evidenced blocking finding, `approved` when
none remains, `needs_human` for a product/authority decision, or `blocked` when
required verification cannot run. Write `### Finding dispositions`, `### New
findings`, `### Gates`, and `### Verdict evidence`.
