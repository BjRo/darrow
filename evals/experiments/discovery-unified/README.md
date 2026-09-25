# Unified discovery skill probe

This isolated Codex probe tests one public entry skill with three lazily loaded
conversation modes. It does not alter the installed `darrow-discovery` plugin.

| Request                                     | Expected mode           | Expected selection       |
| ------------------------------------------- | ----------------------- | ------------------------ |
| “Grill me” on a personal decision           | Standalone grilling     | Unified skill            |
| “Spec out” a product feature                | Feature discovery       | Unified skill            |
| “Let's plan how to implement this”          | Implementation planning | Unified skill            |
| “What note-taking method should I use?”     | Ordinary advice         | No unified skill         |
| Explicit skill invocation without a subject | Standalone grilling     | Expected, not yet tested |

Each mode must read its own reference file before answering. The live comparison
uses the same representative prompts and fixtures as the current three-skill
experiment, with semantic checks adjusted for the single skill. The runner does
not accept activation assertions on skill-less experiment cases, so entry-skill
selection is assessed from its retained Codex trace separately. Mode-file
reads are not retained and remain unverified.
The probe establishes only Codex behavior on these boundaries; it does not
validate full workflow parity or Claude Code behavior.

See the [2026-09-24 result](snapshots/2026-09-24.md) for trial counts and
replacement limits.
