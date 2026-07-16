# Darrow

Darrow is a local-first workflow runtime and marketplace of reusable plugins for
coding agents. The runtime composes durable, declarative workflows; plugins
package explicit commands and intent-triggered capabilities with deterministic
helpers and evals. Claude Code and Codex can adopt the plugins independently.

The runtime architecture and delivery roadmap are defined in the
[product specification](docs/product-spec.md).

## M1 CLI quick start

The independently versioned CLI lives in [`cli/`](cli). Installation scope is
always explicit. From this source checkout, choose one:

```sh
# Global CLI and pinned, platform-specific Temporal executable
bun install --global ./cli
darrow-install --scope global

# Or repository-local CLI and Temporal executable
bun add --dev ./cli
bunx darrow-install --scope local
```

The installer pins Temporal CLI 1.8.0 and verifies its platform archive by
SHA-256. `darrow init`, `run`, and `inspect` never download or upgrade it.

Install and enable `darrow-git` and `darrow-delivery` from this marketplace in
Codex. `DARROW_PLUGIN_ROOTS` may identify an already harness-enabled custom
plugin environment; it does not install or enable plugins. Darrow catalogs
explicit project roots for commands, but only a provider verifiably enabled in
the Codex environment can satisfy a hard capability. It preflights the portable
`git.branch.create@^1.0.0` contract but leaves provider selection to Codex's
intent routing.

In a Git repository with at least one commit:

```sh
darrow init
darrow run implement-change --change "describe the requested behavior"
# If the checkout is dirty, choose head/current/abort when prompted:
darrow continue <run-id>
# A non-interactive caller supplies the same typed choice explicitly:
darrow continue <run-id> --request <request-id> --version <version> --choice head
# From another process, request durable cancellation:
darrow cancel <run-id>
darrow inspect <run-id>
```

`--base HEAD` can bypass the dirty-checkout question and deliberately starts the
managed worktree from the committed HEAD while leaving uncommitted files in the
invoking checkout. A run waiting on model availability accepts `retry`,
`abort`, or an explicit `amend --model <id>`; amendments are journaled and do
not rewrite the locked initial profile. `darrow resume <run-id>` reconnects to
an already running Temporal execution after a CLI interruption. Temporal and
its task worker start lazily under `.darrow/runtime`, persist independently of
the foreground CLI, and never download or upgrade themselves. The bundled
profile requests Codex with provider `openai`, model `gpt-5.6-sol`, and high
reasoning effort while inheriting native Codex permissions. It defines no model
fallback. On non-macOS hosts, authenticated evidence capture requires
`DARROW_CODEX_PERMISSION_PROFILE` to name a configured native Codex permission
profile; Darrow refuses to run test commands outside a verifiable sandbox.

Workflow schema `0.1.0` also supports finite `loops` over linear step regions.
The region's final command exposes a required scalar outcome; an unsatisfied
outcome can offer a bounded retry with supplemental instructions, a declared
waiver with `--rationale-file`, or abort. Every attempt remains immutable, and
an accepted waiver produces `succeeded_with_waivers`.

`darrow cancel <run-id>` durably stops new scheduling. Active commands wait for
their activity boundary unless their command metadata explicitly declares safe
interruption; inspection reports completed, incomplete, and uncertain steps.

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

### [`darrow-delivery`](plugins/darrow-delivery)

Provides the M1 `darrow-delivery:implement` command. It creates one local
branch through intent routing, requires meaningful red evidence, proves the
same focused test green, runs the relevant regression suite, and checkpoints
ordered immutable evidence. It never commits, pushes, opens a pull request,
updates a ticket, or installs dependencies.

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

## Development

Install dependencies and the repository-managed Git hooks explicitly:

```sh
bun install
bun run hooks:install
```

`bun run lint` checks all Prettier-supported project content. `bun run format`
updates it. The pre-commit hook runs the same check against staged content and
refuses commits that are not formatted.
