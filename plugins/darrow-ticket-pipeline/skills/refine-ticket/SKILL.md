---
name: refine-ticket
description: Refine one ticket-pipeline run into a decision-complete implementation plan and observable acceptance contract without changing repository or tracker state. Use only when explicitly invoked by deliver-ticket for the refine phase or when the user supplies a complete refine-phase packet.
---

# Refine a ticket into a plan

Produce the smallest plan a writer can execute without inventing product
behavior, safety policy, or authority.

## Working model

- **Decision-complete:** ticket intent, observable behavior, scope, safety,
  public seams, and proof are settled. Local coding details may remain open when
  they cannot change those things.
- **Acceptance criterion:** one observable outcome with a public boundary and
  an independent expected result derived from the ticket, accepted spec, or
  worked example.
- **Gate:** a literal applicable command plus the repository source that makes
  it applicable. An absent gate is recorded with discovery evidence, not called
  passed.
- **Non-goal:** a plausible adjacent behavior that this ticket deliberately
  leaves unchanged.

## Workflow

### 1. Ground the contract in current evidence

Read the packet's current ticket-body snapshot, applicable repository
instructions, accepted decisions, pre-existing-work baseline, and enough code,
tests, manifests, and CI configuration to understand the affected behavior and
verification surface. On iteration 2 or later, also read the immediately prior
challenge artifact and current ticket changes.

Remain read-only for repository and tracker state. Do not edit product/test
files, update the ticket, install dependencies, run generators, or execute
commands that may change the tree merely to make a plan. Refuse unreadable
required guidance or configuration rather than silently omitting it.

**Complete when:** ticket intent, current behavior, governing sources,
pre-existing work, and verification infrastructure are inspected or the exact
missing evidence is known.

### 2. Derive observable acceptance and boundaries

Map every ticket done criterion to one or more precise acceptance criteria.
For each, name:

- the input or setup;
- the public API, command, UI, event, or data-format seam;
- the exact observable result from an independent oracle;
- the durable test or observation that will prove it.

Preserve ticket intent. Do not add stricter semantics, invent error behavior,
or turn an example into a broader requirement without repository evidence.
Name affected scope and explicit non-goals, including user-owned paths the
writer must preserve.

If materially different product behaviors are plausible and neither the ticket
nor authoritative repository evidence selects one, return `needs_human` with
the smallest concrete choice. Do not disguise it as an implementation detail.

**Complete when:** all ticket criteria are covered, no acceptance statement
changes product intent, and scope/non-goals make adjacent behavior unambiguous.

### 3. Build an executable plan

Order the smallest coherent implementation steps. Each step names its purpose,
likely absolute or repository-relative paths, affected public seam, and the
criterion it advances. Include durable test changes and any required requested
engineering discipline. Do not prescribe speculative abstractions or
incidental code structure unsupported by current evidence.

Discover focused, lint, typecheck, test, build, and task-specific gates from
repository sources. Give each literal command, applicability, discovery source,
and what it proves. Include final-tree reruns after the last write.

Record concrete risks, dependencies, migration or external-state boundaries,
and assumptions. A `complete` plan contains no unresolved material assumption;
convert it to evidence, a human decision, or a blocker.

**Complete when:** a writer can execute the steps and prove every criterion
without deciding product policy, expanding scope, guessing a gate, or touching
pre-existing work.

### 4. Reconcile challenge feedback and write

On a later iteration, disposition every prior blocking challenge finding as:

- `resolved` with the exact revised plan/evidence;
- `carried_forward` only when it still requires a human or unavailable source;
- `superseded` only when newer authoritative ticket/repository evidence makes
  it inapplicable.

Do not broaden ticket scope to silence a finding or rename an unresolved gap.

Choose `blocked` when required evidence cannot be read or the environment
prevents a decision-complete plan. Choose `needs_human` for an unresolved
material product, safety, migration, privacy, permission, or authority choice.
Otherwise choose `complete` only when every completion condition above holds.

**Artifact contract:** Before writing, read
`<skill-dir>/../../config/phase-artifact.md` completely. Write exactly one
artifact to the packet's absolute output path, copying its run ID, phase,
iteration, and agent fields exactly.

Include:

- `### Acceptance criteria` — mapped seam, oracle, and proof for every ticket
  criterion;
- `### Scope and non-goals` — affected boundaries and preserved work;
- `### Implementation plan` — ordered criterion-linked steps;
- `### Verification` — literal commands, applicability, source, and purpose;
- `### Risks and decisions` — concrete risks and no hidden assumptions;
- `### Prior challenge dispositions` on later iterations.

**Complete when:** the artifact validates against the shared contract, its
status matches the open decisions/evidence, and the response reports its
absolute path without claiming implementation or verification execution.
