# Capability: Information Architecture

Builds and maintains repository instruction systems that give coding agents the
smallest useful resident context while keeping every behavior-changing rule
reachable at the moment it matters.

Plugin: `darrow-ia`. Skills: `setup-information-architecture`,
`doctor-information-architecture`.

## Why

Large root instruction files spend context on every task. Bare repositories
have the opposite failure mode: agents repeatedly rediscover commands and
architecture, then miss non-obvious constraints. A useful information
architecture keeps a small root router, sends the agent to focused files by
path and intent, and moves repeatable procedures into skills without making
important guidance unreachable.

This capability is repository-scoped. Installation health, runtime versions,
global permissions, transcript usage, and plugin cleanup belong to an
environment doctor, not this plugin.

## Shared model

- **Resident guidance** is loaded at session start. It contains universal
  constraints, safety and delivery gates, cross-project contracts, and the
  routing needed to reach deferred guidance.
- **Scoped guidance** applies to a subtree or identifiable kind of work. It is
  reached through native runtime scoping or an explicit router entry that names
  both the trigger and the file to read.
- **Procedural guidance** explains how to perform a repeatable task. It belongs
  in an intent-triggered skill when it need not be resident during unrelated
  work.
- **Derived facts** are reliable, inexpensive observations from canonical
  repository sources such as manifests and configuration. They normally stay
  out of resident guidance unless they carry a prohibition, rationale, or
  unusual operational consequence.

File mentions alone are not a routing contract. A route says when the target
must be read, using a path match, task intent, or both.

## setup-information-architecture

### Intent triggers

"set up agent instructions", "create an AGENTS.md architecture", "organize
repository guidance", "add scoped agent rules", "build a context hierarchy",
or an explicit skill invocation.

### Contract

Inspect the repository and any existing instruction surfaces, propose a
repository-specific instruction graph, obtain confirmation, then create or
reorganize the approved files. Verify the resulting graph before reporting it.

### Invariants

- **IA-S1 — Inventory before design.** Inspect existing instruction entrypoints,
  runtime adapters, referenced guidance, skills, manifests, CI, hooks, and
  repository boundaries before proposing a structure. Existing guidance is
  never overwritten from a generic template.
- **IA-S2 — Reachable deferred guidance.** Every deferred instruction file has
  a route from an entrypoint or documented native scope. Each explicit route
  names the target and the path or intent that requires reading it.
- **IA-S3 — Thin, sufficient root.** Root guidance retains universal
  constraints, safety rules, unusual completion gates, cross-runtime contracts,
  and enough routing to reach everything else. Directory tours, ordinary stack
  inventories, and generic engineering advice are omitted.
- **IA-S4 — Scope by ownership.** Guidance lives at the narrowest scope where
  it remains correct. A shared cross-cutting rule is not copied into several
  subtree files merely to obtain local loading.
- **IA-S5 — Procedures load by intent.** Multi-step task procedures become
  skills when they do not need to influence ordinary edits. The root retains a
  route only when automatic skill discovery is insufficient for the supported
  runtimes.
- **IA-S6 — Deliberate runtime parity.** Multi-runtime repositories declare a
  source of truth and adapter relationship. Generated mirrors are not edited as
  independent guidance, and a runtime-specific optimization never silently
  breaks another runtime's reachability.
- **IA-S7 — Confirm before mutation.** The initial inventory and proposal are
  read-only. Creation, movement, deletion, or rewriting begins only after the
  user confirms the proposed file-level actions. No commit is an implicit side
  effect of setup.
- **IA-S8 — Verified result.** After applying changes, rerun the deterministic
  audit. A missing entrypoint, unrouted deferred guidance, broken local
  references, instruction cycles, adapter drift, and root budget violations
  block a successful report.

### Non-goals

Installing agent runtimes or plugins, changing permissions, mining transcript
history, enforcing code architecture, or replacing project documentation.

## doctor-information-architecture

### Intent triggers

"doctor the agent instructions", "audit AGENTS.md", "trim CLAUDE.md",
"check the context architecture", "find stale agent guidance", "reduce
resident context", or an explicit skill invocation.

### Contract

Run a read-only structural audit, inspect repository evidence for the findings
that need judgment, and present a concise keep/move/rewrite/remove proposal.
Apply only confirmed actions, then rerun the audit.

### Invariants

- **IA-D1 — Structure before prose.** Start with deterministic inventory:
  entrypoints, sizes and token estimates, local references, broken targets,
  cycles, duplicate content, native scopes, and adapter relationships. Do not
  read the whole repository before this report narrows the investigation.
- **IA-D2 — Cheap derivability only.** Remove a repository fact only when it is
  reliable and cheap to recover from a canonical source in a few reads. Keep
  behavior-changing constraints, prohibitions, safety rules, exact unusual
  commands, non-obvious reasons, cross-project contracts, and facts whose
  reconstruction would defeat the routing design.
- **IA-D3 — Preserve routing value.** A generated rule index or short purpose
  map is not redundant when it prevents opening many files to discover which
  one applies. Optimize total retrieval cost, not root-file line count alone.
- **IA-D4 — Harness-aware recommendations.** Account for each supported
  runtime's actual discovery and scoping behavior. A native Claude rule, a
  nested Codex `AGENTS.md`, and an explicit root route are not assumed to be
  interchangeable.
- **IA-D5 — Usage is never deletion authority.** Missing or infrequent
  transcript usage may prompt investigation but never justifies removal or
  promotion of valid scoped guidance into the resident root. Eval runs, short
  windows, routing failures, and unobserved safety paths make usage evidence
  systematically incomplete.
- **IA-D6 — Separate invariant from procedure.** Keep concise invariants in
  their applicable scope. Move a repeatable ordered workflow to a skill only
  when it can load by intent without losing reachability.
- **IA-D7 — Propose, confirm, apply.** The report groups exact file-level
  actions as keep, move, rewrite, or remove, with estimated resident-context
  impact and reasoning. No checked-in file changes before confirmation and no
  automatic commit.
- **IA-D8 — Fail closed on unreadable evidence.** An unreadable instruction,
  manifest, configuration, or adapter source is reported and blocks any
  recommendation that depends on it. Never treat missing evidence as proof that
  guidance is redundant.
- **IA-D9 — Verify after changes.** Rerun the structural audit and report the
  before/after resident bytes and approximate tokens. Remaining critical
  structural findings are explicit.

### Non-goals

General repository cleanup, rewriting documentation for style, removing
installed extensions, changing agent settings, or optimizing global user
memory.
