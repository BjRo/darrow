---
name: codify-ticket
description: Identify durable repository learnings from a converged ticket delivery and record recommendations as a read-only ticket artifact. Use only when explicitly invoked for the codify phase by deliver-ticket or with a complete phase packet after approved review and passed QA.
---

# Codify ticket

Read `<skill-dir>/../../config/phase-artifact.md`, all ticket artifacts, the
final diff, repository guidance, and accepted decisions. Do not edit the
repository or tracker. This phase recommends; a later explicit capability may
apply the recommendation.

Recommend only durable, non-obvious knowledge that future work would otherwise
likely get wrong: a new invariant, architectural decision, recurring tooling
trap, or important verification seam. Name the authoritative target and why
existing code/guidance is insufficient. Do not restate code, routine fixes,
ticket-specific facts, or content already documented.

Return `complete` with `### Durable learnings` and `### Suggested authoritative
targets` when a recommendation is justified. Otherwise return `no_change` and
write `### Result` with `No new patterns to codify`. Never use codify to patch
an unreviewed product or documentation change into a verified run.
