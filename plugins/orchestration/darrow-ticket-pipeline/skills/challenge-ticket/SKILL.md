---
name: challenge-ticket
description: Challenge one ticket-pipeline implementation plan without changing repository or tracker state, testing ticket coverage, repository constraints, safety, and verifiability. Use only when explicitly invoked by deliver-ticket for the challenge phase or when the user supplies a complete challenge-phase packet.
---

# Challenge a ticket plan

Decide whether the current refine artifact is safe and complete enough to hand
to a writer. Diagnose plan defects; do not rewrite the plan or implement the
ticket.

## Working model

- **Covered criterion:** one observable ticket outcome maps to a concrete plan
  step, affected public seam, independent proof, and every applicable gate.
- **Blocking finding:** repository evidence shows that the plan could violate
  ticket intent, an applicable rule or decision, safety, or verifiability.
- **Preference:** an alternative approach without a demonstrated violation.
  Omit preferences and speculative improvements.
- **Plan omission:** required information is available but absent from the
  plan. Request revision rather than treating the omission as unavailable
  evidence.

## Workflow

### 1. Bind the evidence read-only

Read the packet's current ticket-body snapshot and matching refine artifact,
then applicable repository instructions and accepted decisions. Inspect only
enough affected code, tests, manifests, and gate definitions to test the plan's
claims. On iteration 2 or later, also read the immediately preceding challenge
artifact.

Do not edit the repository, tracker, ticket snapshot, or refine artifact. Do
not run a formatter, generator, dependency installer, product gate, or other
command that could change repository or external state merely to challenge a
plan. Record an unreadable required source instead of silently skipping it.

**Complete when:** every required input is either inspected or named as
unavailable, and no repository or tracker state has changed.

### 2. Trace the plan against the contract

For each ticket criterion, locate its implementation step, public behavior or
data boundary, independent test or observation, and applicable final gate.
Then test the plan as a whole for:

- conflict with repository instructions or an accepted decision;
- unsafe treatment of pre-existing work, data, migrations, permissions,
  secrets, or external state;
- missing dependencies, edge cases, failure behavior, or ordered steps that
  could make the requested outcome wrong;
- a product or safety ambiguity that permits materially different valid
  implementations;
- verification that repeats the implementation, observes an incidental side
  channel, omits a required gate, or otherwise cannot prove the criterion.

A detail may remain executor-local when repository evidence does not require
it to be settled before writing and the plan still has one safe, verifiable
path. Do not block on style, preferred architecture, imagined future work, or
scope expansion.

For each blocking finding, capture its impact severity, the exact ticket
criterion or repository rule, concrete path/line or command evidence, the
failure it permits, and the smallest plan change that closes the gap.

**Complete when:** every criterion and cross-cutting constraint is traced, and
each reported finding demonstrates a concrete failure risk rather than a
preference.

### 3. Reconcile earlier findings

On a later iteration, disposition every prior blocking finding before adding
new ones:

- `resolved` only with current refine or repository evidence that closes it;
- `carried_forward` when the defect remains, reusing the original criterion
  and evidence where still accurate;
- `superseded` only when newer authoritative ticket or repository evidence
  makes the original finding inapplicable.

Do not re-litigate a resolved point under a new label. On iteration 1, record
that no prior challenge finding exists.

**Complete when:** each prior finding has exactly one evidence-backed
disposition and every unresolved blocker remains visible.

### 4. Derive and write the verdict

Choose the status in this order:

1. `blocked` when required evidence is unreadable or the environment prevents
   a defensible verdict;
2. `needs_human` when the evidence exposes a material product, safety, or
   authority choice that the ticket and repository do not settle;
3. `needs_revision` when one or more concrete blockers can be corrected within
   the existing ticket scope;
4. `approved` only when no blocker remains and every criterion has a viable
   implementation and proof path.

**Artifact contract:** Before writing, read
`<skill-dir>/../../config/phase-artifact.md` completely. Write exactly one
artifact to the packet's absolute output path, copying its run ID, phase,
iteration, and agent fields exactly.

Its Markdown evidence must contain:

- `### Findings` — each blocker with severity, criterion/rule, exact evidence,
  concrete risk, and smallest plan change; write `None` when approved;
- `### Prior finding dispositions` — every earlier finding and its disposition,
  or `None — first challenge iteration`;
- `### Verdict evidence` — concise criterion-coverage, repository/safety, and
  verification evidence that mechanically supports the selected status.

**Complete when:** the artifact validates against the shared contract, its
status follows the precedence above, every blocker is actionable, and the
response reports the absolute artifact path without claiming implementation
or executed verification.
