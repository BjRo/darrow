---
name: codify-ticket
description: Identify durable repository knowledge from one converged ticket delivery and record read-only recommendations in its codify artifact. Use only when explicitly invoked by deliver-ticket for the codify phase or when the user supplies a complete codify-phase packet after approved review and passed QA.
---

# Codify durable learning

Decide whether the verified delivery exposed knowledge that belongs in an
authoritative repository source. Recommend the smallest durable addition; do
not apply it.

## Working model

- **Durable learning:** a non-obvious invariant, accepted design constraint,
  recurring tooling trap, or verification seam that applies beyond this one
  ticket and that future work could reasonably get wrong.
- **Authoritative target:** the single existing repository source that should
  own the knowledge, such as a scoped instruction, capability specification,
  accepted decision, or procedural skill. Code and tests remain evidence when
  they already express the fact clearly; they do not automatically justify
  another prose copy.
- **Routine evidence:** the ticket's implementation details, successful
  commands, ordinary bug mechanics, and facts already clear in code or
  guidance. Routine evidence is not a learning.

## Workflow

### 1. Confirm a converged evidence set

Read the packet's current ticket-body snapshot, every retained phase artifact,
the final diff, applicable repository guidance, and accepted decisions. Confirm
that the latest review is approved and the latest QA passed. Treat an
unreadable required source or contradictory convergence record as `blocked`;
do not infer success from missing evidence.

Remain read-only for product files, tests, repository guidance, decisions, and
the tracker. Do not run a formatter, generator, documentation tool, commit, or
other command that could alter the verified tree or external state.

**Complete when:** the final behavior and its review/QA evidence are bound, all
potential authoritative sources have been inspected, and the verified tree is
unchanged.

### 2. Test candidate learnings

Derive candidates only from concrete delivery evidence. Keep a candidate only
when all of these are true:

1. it constrains or enables future work beyond this ticket;
2. it is non-obvious from the current authoritative sources;
3. omitting it creates a credible future correctness, safety, workflow, or
   verification failure;
4. it can be stated independently of the ticket's filenames and incidental
   implementation;
5. one authoritative owner can be named.

Reject restatements of the diff, ticket-specific facts, “tests should pass,”
routine fixes, preferences, speculative abstractions, and knowledge already
documented. A surprising fact need not have failed repeatedly, but its future
failure mode must be concrete.

**Complete when:** every retained candidate crosses the durable threshold and
every rejected candidate has a clear existing owner or is merely local/routine.

### 3. Route one source of truth

For each retained learning, choose the narrowest authoritative target whose
scope matches its future consumers. Recommend one canonical addition, not
copies across several files. Name adapters or routing pointers only when a
consumer otherwise cannot discover that owner.

Describe the proposed knowledge as a concise invariant or decision, not as a
postmortem narrative. Cite exact artifact, diff, command, or repository-source
evidence and explain why the existing owner is insufficient.

If authoritative sources conflict and choosing the owner would make a material
policy or architecture decision, return `needs_human` with that exact choice.
Do not manufacture consensus or recommend both versions.

**Complete when:** each recommendation has one owner, reusable wording,
concrete evidence, and a demonstrated gap in current guidance.

### 4. Write the artifact

Choose `complete` when at least one recommendation satisfies every threshold;
choose `no_change` when none does. Preserve `needs_human` or `blocked` from the
conditions above instead of converting them to either normal outcome.

**Artifact contract:** Before writing, read
`<skill-dir>/../../config/phase-artifact.md` completely. Write exactly one
artifact to the packet's absolute output path, copying its run ID, phase,
iteration, and agent fields exactly.

For `complete`, include:

- `### Durable learnings` — each reusable statement, evidence, credible future
  failure, and why current sources do not already cover it;
- `### Suggested authoritative targets` — exactly one canonical target and
  concise proposed addition per learning.

For `no_change`, include `### Result` with the exact sentence `No new patterns
to codify`. For `needs_human` or `blocked`, use `### Result` to name the exact
decision or missing evidence and the smallest next action.

**Complete when:** the artifact validates against the shared contract, its
status follows from the evidence, the verified tree and tracker remain
unchanged, and the response reports the absolute artifact path without
claiming that any recommendation was applied.
