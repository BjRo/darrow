---
name: refine-ticket
description: Refine one ticket-backed delivery run into a decision-complete implementation plan and acceptance contract without editing product files. Use only when explicitly invoked for the refine phase by deliver-ticket or when a user explicitly asks to run this phase with a complete phase packet.
---

# Refine ticket

Read `<skill-dir>/../../config/phase-artifact.md`, then the packet's ticket-body
snapshot, repository instructions, relevant accepted decisions, code, and
tests. Do not edit the repository or tracker.

Produce a plan grounded in current evidence:

- observable acceptance criteria mapped to the ticket's done criteria;
- scope and explicit non-goals;
- concrete files, public seams, and ordered implementation steps;
- applicable lint, typecheck, test, build, and task-specific commands, with
  discovery evidence;
- pre-existing work boundaries, risks, assumptions, and decisions still
  requiring a human.

When this is a later iteration, read the prior challenge artifact and address
every blocking finding without expanding ticket scope. Use `needs_human` for a
material product/safety choice the repository cannot resolve, and `blocked`
for unreadable required evidence. Otherwise use `complete`.

Write the required artifact to the packet output path. In its Markdown include
`### Acceptance criteria`, `### Scope and non-goals`, `### Implementation
plan`, `### Verification`, and `### Risks and decisions`.
