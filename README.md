# Darrow

Darrow is a local-first workflow runtime and marketplace of reusable plugins for
coding agents. The runtime composes durable, declarative workflows; plugins
package explicit commands and intent-triggered capabilities with deterministic
helpers and evals. Claude Code and Codex can adopt the plugins independently.

The runtime architecture and delivery roadmap are defined in the
[product specification](docs/product-spec.md).

## Plugins

### [`darrow-git`](plugins/darrow-git)

Provides safe, focused Git workflows without making the user remember command
syntax or repository conventions.

- **`create-branch`** creates a traceable branch, optionally in a linked
  worktree, without losing uncommitted changes.
- **`create-commit`** selects only the intended files and creates one validated
  Conventional Commit.
- **`create-pr`** pushes a feature branch and opens one pull request against a
  deliberate base, using the repository's PR template when present.

The bundled scripts enforce branch naming, staging boundaries, message format,
and duplicate-PR checks. The skills supply the judgment about names, scope, and
human-readable descriptions.

### [`darrow-tickets`](plugins/darrow-tickets)

Provides tracker workflows through a backend-neutral `ticket` CLI. Skills do
not call a tracker directly, which keeps their behavior consistent when the
backing system changes.

- **`create-ticket`** searches for duplicates, chooses the correct ticket
  type, and creates one evidence-based ticket with the required structure.
- **`list-tickets`** reports matching work items with explicit state, type,
  label, milestone, and text filters. It is always read-only.
- **`update-ticket`** resolves one verified ticket and applies exactly one
  requested comment, state, label, relation, or description change.

The CLI validates targets, labels, relations, and state transitions before it
changes the tracker.

### [`darrow-information-architecture`](plugins/darrow-information-architecture)

Builds and audits lean repository guidance for coding agents. It keeps root
instructions small, routes agents to narrower guidance when needed, and
preserves the loading behavior of both Codex and Claude Code.

- **`setup-information-architecture`** inventories existing guidance,
  classifies it, proposes a routed file structure, and applies confirmed
  changes.
- **`doctor-information-architecture`** finds broken routes, unnecessary
  resident context, duplication, scope drift, and procedures that belong in
  skills.

Its `ia-doctor` checker verifies structural reachability, adapters, cycles,
duplicates, and root context size. See the
[plugin README](plugins/darrow-information-architecture/README.md) for the
design model and boundaries.

## Package model

- **Plugins are independently adoptable.** No plugin assumes that a sibling
  plugin is installed.
- **Commands are explicit.** The orchestrator invokes command skills by stable
  `<plugin>:<skill>` identity.
- **Capabilities load by intent.** Optional behavior advertises portable
  contracts but remains selected by the surrounding harness and environment.
- **Skills hold judgment.** They decide what the user means and what action is
  appropriate.
- **Scripts enforce mechanics.** Checkable safety rules live in deterministic,
  portable helpers rather than prompt prose.
- **Specs and evals protect behavior.** Capability invariants live in
  [`docs/specs`](docs/specs), with deterministic tests and judgment-focused
  eval cases colocated with each skill.

The marketplace manifest is
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json); Codex uses
the same marketplace and each plugin also ships a Codex-specific manifest.
Darrow-aware skills keep workflow metadata in a colocated `darrow.json` rather
than extending either runtime's native plugin manifest.
