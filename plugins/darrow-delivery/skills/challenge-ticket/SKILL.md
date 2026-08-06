---
name: challenge-ticket
description: Stress-test the current ticket implementation plan against ticket intent, repository rules, affected code, safety, and verifiability without editing files. Use only when explicitly invoked for the challenge phase by deliver-ticket or with a complete phase packet.
---

# Challenge ticket

Read `<skill-dir>/../../config/phase-artifact.md`, the current ticket snapshot,
the matching refine artifact, repository guidance, and enough affected code
and tests to verify the plan's claims. Remain read-only for repository and
tracker.

Check for concrete blockers:

- an acceptance criterion not covered by a step or test;
- a step that conflicts with repository rules or an accepted decision;
- unsafe treatment of user-owned work, migrations, data, permissions, or
  external state;
- a missing behavioral seam, edge case, dependency, or applicable gate that
  could make the implementation wrong or unprovable;
- unresolved ambiguity that changes product behavior.

Preferences and speculative improvements do not block. For every finding give
severity, evidence path/command, violated criterion, and the smallest plan
change. On later iterations, first resolve or carry forward each earlier
blocking finding; do not re-litigate resolved points.

Return `approved` when no concrete blocker remains, `needs_revision` when the
plan can be corrected within ticket scope, `needs_human` for a material choice,
or `blocked` when required evidence cannot be read. Write the artifact with
`### Findings`, `### Prior finding dispositions`, and `### Verdict evidence`.
