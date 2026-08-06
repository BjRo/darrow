# Darrow

Darrow is a marketplace of focused, independently adoptable plugins for coding
agents. It does not ship a daemon or general workflow runtime; its two factory
plugins are explicitly invoked, skill-driven compositions of native child
agents. Claude Code and Codex can use the same plugin packages directly.

## Plugins

### [`darrow-git`](plugins/darrow-git)

Safe Git workflows for creating branches, commits, and pull requests. Bundled
scripts enforce naming, staging, message, and duplicate-PR boundaries while the
skills retain judgment about scope and descriptions.

### [`darrow-tickets`](plugins/darrow-tickets)

Backend-neutral ticket workflows for creating, listing, and updating work
items. The plugin validates targets and transitions before changing a tracker.

### [`darrow-information-architecture`](plugins/darrow-information-architecture)

Tools for setting up and auditing lean, routed repository guidance across Codex
and Claude Code. See the [plugin README](plugins/darrow-information-architecture/README.md)
for its design and boundaries.

### [`darrow-decisions`](plugins/darrow-decisions)

Skills and deterministic helpers for capturing decisions at their canonical
scope and querying ADR/specification relationships without creating a competing
decision store.

### [`darrow-tdd`](plugins/darrow-tdd)

A compact, model-invoked test-driven-development discipline for implementing
behavior changes and bug fixes as durable red-to-green slices through public
seams.

### [`darrow-review`](plugins/darrow-review)

A read-only code-review capability that pins the exact committed and declared
working-tree scope, then evaluates repository standards and originating-spec
fulfillment through isolated reviewers before producing one validated verdict.

### [`darrow-factory`](plugins/darrow-factory)

A light native microfactory for bounded local engineering work. It chooses the
shortest safe planner/executor/verifier path, permits at most one repair, and
keeps orchestration state transient.

### [`darrow-delivery`](plugins/darrow-delivery)

A deliberately heavier comparison factory modeled on Mynab's delivery
approach. A user-invoked controller persists all phase artifacts in one ticket
and delegates refine/challenge, implementation, review/rework, QA/fix, and
codification to fresh phase-skill agents with bounded loops.

## Package model

- Plugins are independently adoptable and never reference sibling-plugin
  files. `darrow-delivery` detects a compatible host ticket capability at
  runtime and blocks cleanly when none is installed.
- Skills hold judgment; scripts enforce deterministic mechanics.
- Capability invariants live in [`docs/specs`](docs/specs).
- Judgment-focused evals are colocated with their skills and use the shared
  runner in [`evals/runner`](evals/runner).

The marketplace manifest is
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json). Each plugin
also contains native Claude Code and Codex manifests.

## Development

```sh
bun install
bun run hooks:install
bun run lint
bun run typecheck
bun test
```

`bun run lint` checks all Prettier-supported tracked project content. The
pre-commit hook applies the same formatting gate to staged files.
