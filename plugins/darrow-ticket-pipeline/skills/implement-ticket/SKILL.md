---
name: implement-ticket
description: Implement the approved plan for one ticket-pipeline run in the local working tree, preserving user work and producing final-tree command evidence. Use only when explicitly invoked for the implement phase by deliver-ticket or with a complete phase packet.
---

# Implement ticket

Read `<skill-dir>/../../config/phase-artifact.md`, the ticket snapshot, and the
latest approved refine and challenge artifacts. Verify the packet authorizes
local working-tree writes and names all pre-existing changes before editing.

Implement only the approved scope. Read applicable repository instructions and
accepted decisions first. Use the requested engineering discipline when one is
in the ticket or plan; otherwise choose the shortest reliable sequence. Do not
overwrite, stage, clean, reset, or revert pre-existing user work. An overlap
that cannot be merged safely is `needs_human`.

Run every applicable focused and repository lint, typecheck, test, build, and
acceptance command on the final tree. A configured command that cannot run is
`blocked`, not passed. Distinguish a proven pre-existing failure from a
regression. Do not update the ticket, review the result, run QA/codify, branch,
commit, push, open a PR, merge, release, or deploy.

Use `complete` only when the implementation and all runnable applicable gates
pass; use `failed` for an in-scope implementation that cannot be made correct
within the phase budget. Write the artifact with `### Changed files`, `###
Acceptance implementation`, `### Gates`, and `### Remaining risks` using exact
absolute paths and commands.
