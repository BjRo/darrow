<p align="center">
  <img src="docs/assets/darrow-logo.png" alt="Darrow logo" width="420">
</p>

# Darrow

Darrow is a marketplace of focused, independently adoptable plugins for coding
agents. It separates intent-matched capabilities from explicit orchestration,
and treats each plugin as an optionality boundary. Claude Code and Codex can use
the same plugin packages directly.

## Design

Capabilities teach an agent how to perform a focused kind of work. The model
selects and invokes them when their advertised intent matches the user's
request, though users can also name them explicitly. They remain useful without
an orchestration layer and can be composed wherever their contract is
available. Orchestration owns a different concern: framing and continuing
longer-running work until an observable completion condition is reached. It
starts only through explicit user invocation and must not be inferred merely
because a task is complex or multi-step.

The core orchestration helper is [`darrow-goal-loop`](plugins/darrow-goal-loop/README.md).
It performs a read-only preflight, compiles the request and repository evidence
into a bounded completion contract, selects a proportionate workflow, risk
gate, model, and effort, and hands the result to one host-native goal owner. It
improves the starting conditions for native adaptive execution without building
a second agent runtime around it.

[`darrow-ticket-pipeline`](plugins/darrow-ticket-pipeline/README.md) is retained
only as a reference implementation of Darrow's earlier static phase-controller
approach and as an executable benchmark baseline for the goal loop. It is not a
second recommended orchestration path or the foundation for a general workflow
runtime.

Across both layers, narrow bundled scripts hide repeatable tool-call and
protocol details from the invoking model. Skills retain contextual judgment,
while scripts own deterministic command construction, validation, parsing, and
compact result reporting. Plugin-shipped mechanics use portable Bash rather
than adding a full language runtime; the shared TypeScript/Bun eval runner is
repository development infrastructure, not a plugin runtime dependency.

Every skill carries colocated evals for its public behavior and intent
boundaries. Darrow also uses those evals for evidence-based development: a new
variant is compared with the relevant control—such as an unmodified host or its
native goal functionality—under matched fixtures, prompts, routes, and checks
before an advantage is attributed to the variant.

See [Design principles](docs/design.md) for the rationale and boundaries.

## Capability plugins

### [`darrow-git`](plugins/darrow-git/README.md)

Safe Git workflows for creating branches, commits, and pull requests. Bundled
scripts enforce naming, staging, message, and duplicate-PR boundaries while the
skills retain judgment about scope and descriptions.

### [`darrow-tickets`](plugins/darrow-tickets/README.md)

Backend-neutral ticket workflows for creating, listing, and updating work
items. The plugin validates targets and transitions before changing a tracker.

### [`darrow-readiness-gate`](plugins/darrow-readiness-gate/README.md)

A read-only implementation-readiness capability for tickets, specifications,
plans, and conversational requests. It returns a concrete quality bar and one
composable `ready`, `needs-discovery`, `needs-decision`, or `blocked` verdict
without requiring a tracker or adaptive-goal.

### [`darrow-information-architecture`](plugins/darrow-information-architecture/README.md)

Tools for setting up and auditing lean, routed repository guidance across Codex
and Claude Code.

### [`darrow-decisions`](plugins/darrow-decisions/README.md)

Skills and deterministic helpers for capturing decisions at their canonical
scope and querying ADR/specification relationships without creating a competing
decision store.

### [`darrow-tdd`](plugins/darrow-tdd/README.md)

A compact, model-invoked test-driven-development discipline for implementing
behavior changes and bug fixes as durable red-to-green slices through public
seams.

### [`darrow-review`](plugins/darrow-review/README.md)

A read-only code-review capability that pins the exact committed and declared
working-tree scope, then evaluates repository standards and originating-spec
fulfillment through isolated reviewers before producing one validated verdict.
The same intent-matched capability supports direct review and proportional
selection inside an explicitly invoked adaptive goal without coupling the goal
to its output serialization.

### [`darrow-skill-authoring`](plugins/darrow-skill-authoring/README.md)

A focused workflow for creating or improving independently installable agent
skills with deliberate discovery metadata, deterministic validation, judgment
evals, and fresh-context challenge across Claude Code and Codex.

## Package model

- Plugins are independently adoptable and never reference sibling-plugin files
  or assume a sibling plugin is installed. Optional collaboration happens
  through host-visible intent and capability contracts.
- Capability skills are model-invoked from matching user intent or named
  explicitly. Orchestration is user-invoked.
- `darrow-ticket-pipeline` detects a compatible host ticket capability at
  runtime and blocks cleanly when none is installed.
- Skills hold judgment; narrow portable-Bash scripts hide and enforce
  deterministic tool mechanics.
- Capability invariants live in [`docs/specs`](docs/specs).
- Per-skill evals verify behavior and compare variants through the shared runner
  in [`evals/runner`](evals/runner).

The marketplace manifest is
[`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json). Each plugin
also contains native Claude Code and Codex manifests.

## Standing on the shoulders of giants

Darrow stands on the shoulders of excellent open-source work. I took
inspiration from [obra's Superpowers](https://github.com/obra/superpowers) and
especially [Matt Pocock's skills](https://github.com/mattpocock/skills). I also
learned a great deal from studying [Ouroboros](https://github.com/Q00/ouroboros)
and [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex). They are wonderful
projects—go check them out. Matt Shumer's
[Gauntlet Loop](https://somethingbig.ai/gauntlet-loop) directly prompted the
native goal-loop research: give an agent the outcome and an inspectable quality
bar, let it choose the route, use fresh critics, and keep improving against the
bar.

## Research and opportunities

- [Adaptive ticket-to-PR opportunity](docs/research/adaptive-ticket-to-pr-opportunity.md)
  compares the former SDLC controller with a reusable native-goal recipe and
  cross-checks the design against the Gauntlet Loop. It is exploratory and
  non-normative.
- [Workflow opportunities from Matt Pocock's skills](docs/research/matt-pocock-workflow-opportunities.md)
  records possible discovery, diagnosis, work-planning, and workflow-design
  additions. It is exploratory and non-normative.
- [Workflow opportunities from oh-my-codex and Ouroboros](docs/research/oh-my-codex-ouroboros-opportunities.md)
  contrasts their integrated runtimes with Darrow and records complementary
  discovery, research, verification, maintenance, and ecosystem ideas. It is
  exploratory and non-normative.

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

## License

Darrow is source-available under the
[Business Source License 1.1](LICENSE), with the Mozilla Public License 2.0 as
the Change License. **Each released version becomes MPL-2.0 two years after it
is published.**

Free, without asking:

- Use it yourself, inside your company, and on client work — commercial or not.
- Run paid or unpaid training, workshops, and talks built on it.
- Read, fork, modify, and redistribute it under this same license.
- Contribute back.

Not free:

- Offering Darrow, or a derivative of it, to third parties as a product or
  service whose principal value is Darrow's functionality. That needs a
  commercial license — contact bjoern@bjro.de.

Contributions are accepted under Apache-2.0 plus a relicensing grant; see
[CONTRIBUTING.md](CONTRIBUTING.md).
