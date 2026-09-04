# Capability: Information Architecture

Builds and maintains repository instruction systems that give coding agents the
smallest useful resident context while keeping every behavior-changing rule
reachable at the moment it matters.

Plugin: `darrow-information-architecture`. Skills: `setup-information-architecture`,
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
  constraints, universal or bootstrap safety and delivery gates, universal
  cross-project contracts, and the routing needed to reach deferred guidance.
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
- **Settled knowledge** is a decision or constraint the team has already made
  that code alone cannot prove: a canonical choice between live patterns, a
  migration direction, an abandoned experiment, policy, or external contract.
  Record it at the narrowest reliably reachable scope and preserve its meaning.
- **Open decisions** have no repository or team arbiter yet. Present the
  evidence, options, trade-offs, and a recommendation, then ask the user. Never
  turn pattern frequency, recency, or an agent recommendation into canonical
  guidance without an explicit decision.

File mentions alone are not a routing contract. A route says when the target
must be read, using a path match, task intent, or both.

Every ordinary routed repository path in an instruction surface is resolved
from the session root. A path that works only relative to the containing file
is invalid even when a human reader can infer it. Loader-native imports and
skill-bundled resources keep their native resolution semantics; the structural
audit does not reinterpret them as ordinary routes.

## setup-information-architecture

### Intent triggers

"set up agent instructions", "create an AGENTS.md architecture", "organize
repository guidance", "add scoped agent rules", "build a context hierarchy",
or an explicit skill invocation.

### Contract

Inspect the repository and any existing instruction surfaces, distinguish
settled knowledge from open decisions, propose a repository-specific
instruction graph, obtain confirmation, then create or reorganize the approved
files. Verify the resulting graph before reporting it.

### Invariants

- **IA-S1 — Inventory before design.** Inspect existing instruction entrypoints,
  runtime adapters, referenced guidance, native rules, skills, relevant project
  runtime configuration, manifests, CI, hooks, and repository boundaries before
  proposing a structure. Unreadable required evidence blocks a proposal that
  depends on it. Existing guidance is never overwritten from a generic
  template.
- **IA-S2 — Reachable deferred guidance.** Every deferred instruction file has
  a route from an entrypoint or documented native scope. Each explicit route
  names the target and the path or intent that requires reading it.
- **IA-S3 — Thin, sufficient root.** Root guidance retains universal
  constraints, universal or bootstrap safety rules, unusual universal
  completion gates, universal cross-runtime contracts, and enough routing to
  reach everything else. Runtime parity does not broaden a narrow rule's
  scope. Directory tours, ordinary stack
  inventories, and generic engineering advice are omitted. A derived inventory
  is not rewritten as an imperative unless separate evidence already gives it
  behavioral force.
- **IA-S4 — Scope by ownership.** Guidance lives at the narrowest scope where
  it remains correct. A shared cross-cutting rule is not copied into several
  subtree files merely to obtain local loading, and a trigger-specific rule is
  not broadened into a universal rule merely to simplify placement.
- **IA-S5 — Procedures load by intent.** Multi-step task procedures become
  skills when they do not need to influence ordinary edits. The root retains a
  route only when automatic skill discovery is insufficient for the supported
  runtimes. The resulting `SKILL.md` must be repository-owned, not ignored,
  eligible for version control, validly front-mattered with non-empty `name`
  and `description`, and reachable; an ignored mount, external target,
  malformed skill, or ordinary documentation page is not a successful move.
- **IA-S6 — Deliberate runtime parity.** Multi-runtime repositories declare a
  source of truth and adapter relationship. Generated mirrors are not edited as
  independent guidance, and a runtime-specific optimization never silently
  breaks another runtime's reachability.
- **IA-S7 — Confirm before mutation.** The initial inventory and proposal are
  read-only. Creation, movement, deletion, or rewriting begins only after the
  user confirms the proposed file-level actions. An explicit request to apply
  the proposed structural actions may confirm decision-free file changes in
  advance; a request to inspect or show the graph first requires a pause.
  Neither form of approval settles an open policy decision. No commit is an
  implicit side effect of setup.
- **IA-S8 — Verified result.** After applying changes, rerun the deterministic
  audit. A missing entrypoint, unrouted deferred guidance, broken local
  references, position-dependent ordinary paths, instruction cycles, declared
  adapter drift, unreadable required evidence, and active-root budget
  violations block a successful report. Check reachability separately for each
  selected runtime instead of inventing parity from file coexistence.
- **IA-S9 — Codify decisions, not guesses.** A canonical rule that arbitrates
  between valid live patterns requires evidence of a prior team decision or an
  explicit user choice. When no arbiter exists, surface the decision and do not
  encode the agent's heuristic or recommendation as repository policy. Pause
  for the choice; merely documenting that the decision remains open is not a
  substitute for asking.
- **IA-S10 — Path semantics match the loader.** Ordinary repository paths in
  routed agent guidance resolve from the repository session root. Setup
  rewrites lifted or nested-relative ordinary routes without rewriting
  or deleting loader-native imports, even when an imported file appears empty,
  and without relocating skill bundles or rewriting their skill-relative
  resource paths unless separate scope or reachability evidence requires it.
- **IA-S11 — Intent-matched setup.** Explicit invocation and requests to
  create or reorganize the repository guidance graph select setup. Requests
  only to audit or doctor an existing graph leave setup unselected so the
  narrower doctor capability can own them.

### Non-goals

Installing agent runtimes or plugins, changing permissions, mining transcript
history, enforcing code architecture, replacing project documentation, or
implementing complete TOML, YAML, Markdown, or runtime-loader conformance.

## doctor-information-architecture

### Intent triggers

"doctor the agent instructions", "audit AGENTS.md", "trim CLAUDE.md",
"check the context architecture", "find stale agent guidance", "reduce
resident context", or an explicit skill invocation.

### Contract

Run a read-only structural audit, inspect repository evidence for the findings
that need judgment, and present a concise keep/move/rewrite/remove proposal plus
any genuinely open decisions. Apply only confirmed actions and explicitly made
decisions, then rerun the audit.

### Invariants

- **IA-D1 — Structure before prose.** Start with deterministic inventory:
  entrypoints, sizes and token estimates, local references, broken targets,
  cycles, duplicate content, relevant native scoped guidance, root runtime
  configuration, and declared adapter relationships. Ignore fenced examples
  when extracting routes. This is a compact IA-oriented structural audit, not a
  replacement parser for every runtime format. Do not read the whole repository
  before this report narrows the investigation.
- **IA-D2 — Cheap derivability only.** Remove a repository fact only when it is
  reliable and cheap to recover from a canonical source in a few reads. Keep
  behavior-changing constraints, prohibitions, safety rules, exact unusual
  commands, non-obvious reasons, cross-project contracts, and facts whose
  reconstruction would defeat the routing design. Do not manufacture
  behavioral force by rewriting a derived inventory as an imperative.
- **IA-D3 — Preserve routing value.** A generated rule index or short purpose
  map is not redundant when it prevents opening many files to discover which
  one applies. Optimize total retrieval cost, not root-file line count alone.
- **IA-D4 — Harness-aware recommendations.** Account for each supported
  runtime's discovery and scoping behavior relevant to reachability. A native
  Claude rule, a nested Codex `AGENTS.md`, and an explicit root route are not
  assumed to be interchangeable. Model the selected root entrypoint and native
  scoped guidance needed for the selected runtime. Read the configured Codex
  root budget when it is available. Treat adapter directories as mirrors only
  when repository evidence or an explicit `--mirror` argument declares that
  relationship.
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
  impact and reasoning. An explicit request to apply safe fixes may confirm
  decision-free actions in advance; a request to see the proposal before
  changes requires a pause. Neither form of approval settles an open policy
  decision. No checked-in file changes before applicable confirmation and no
  automatic commit.
- **IA-D8 — Fail closed on unreadable evidence.** An unreadable instruction,
  relevant project configuration, skill, or declared adapter source is reported
  and blocks dependent recommendations. Guidance and skills selected for the
  repository architecture must be repository-owned and version-control-eligible.
  Never treat missing evidence as proof that guidance is redundant.
- **IA-D9 — Verify after changes.** Rerun the structural audit and report the
  before/after resident bytes and approximate tokens for each selected
  runtime's inventoried root guidance. Remaining critical structural findings
  and metric limitations are explicit; do not present the compact audit as an
  exact simulation of runtime context assembly.
- **IA-D10 — Preserve decision status.** Do not infer a canonical rule from the
  number, age, or apparent popularity of competing implementations. Keep an
  evidenced settled decision; surface an unresolved choice without rewriting
  it into policy.
- **IA-D11 — Reject position-dependent ordinary paths.** Report an ordinary
  routed repository path that resolves only relative to its containing
  instruction file. Routed maps and nested entrypoints use session-root paths.
  Loader-native imports and skill-bundled resources are outside this ordinary
  route rule and retain their native semantics.

### Non-goals

General repository cleanup, rewriting documentation for style, removing
installed extensions, changing agent settings, optimizing global user memory,
or serving as a complete runtime configuration/schema validator.
