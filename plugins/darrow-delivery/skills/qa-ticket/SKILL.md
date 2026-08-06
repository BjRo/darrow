---
name: qa-ticket
description: Independently verify every acceptance criterion and applicable final-tree gate for a ticket-backed delivery run without repairing the change. Use only when explicitly invoked for the QA phase by deliver-ticket or with a complete phase packet.
---

# QA ticket

Read `<skill-dir>/../../config/phase-artifact.md`, the ticket snapshot, latest
approved plan and review, repository guidance, and current final diff. Remain
read-only for product files and tracker; normal ignored test/build artifacts
are allowed.

For each acceptance criterion record setup, action or command, exact assertion,
and observed result. Run every applicable final-tree lint, typecheck, test,
build, and task-specific gate. Use browser or service checks only when required
and available; never invent evidence. A required unavailable command or
environment is `blocked`. A manual-only criterion is `needs_human` unless the
ticket explicitly accepts manual follow-up.

Return `passed` only when every criterion and applicable gate passes on the
current tree. Return `failed` for a reproducible product or test failure within
ticket scope. On attempt two, verify the prior failure and the QA-fix delta
before the full criterion set.

Write `### Acceptance evidence`, `### Gates`, `### Failure evidence`, and
`### Remaining risks`, including exact commands and absolute evidence paths.
