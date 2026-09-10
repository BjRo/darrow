# Darrow Goal Loop

This plugin compiles one bounded engineering request and launches exactly one
route-selected, host-visible subagent as its work owner.

```text
request + repository -> read-only preflight -> readiness -> contract -> one owner
```

The parent owns preflight, readiness discussion, capability binding, route
selection, and launch. The subagent owns implementation, verification, human
feedback, independent review, authorized publication, and completion.

`adaptive-delivery` starts only through explicit user invocation or delegation from
an explicitly invoked orchestration entrypoint. Ordinary engineering intent
never starts it.

## `adaptive-delivery`

The skill:

- discovers repository instructions and existing local work without mutation;
- turns the request into observable acceptance, scope, checks, and authority;
- invokes implementation readiness before launch when the exact scope has not
  already been assessed;
- reuses a ready same-scope assessment preserved in the conversation;
- selects one workflow, consequence risk, semantic profile, model, and effort;
- binds every authorized operation to an exact matching host-advertised skill;
- launches one separate Codex subagent or one foreground Claude Agent; and
- relays feedback and the final owner result without parent-side implementation
  or verification.

Readiness is conversational and pre-owner. A non-ready result leaves the tree
unchanged while the user resolves its findings. Once the same scope is ready,
adaptive-delivery compiles that settled evidence into the owner contract rather than
running readiness again for unchanged scope. If assumptions materially change,
the same owner reassesses affected gates and strengthens verification within
authority. Necessary read-only ticket or specification retrieval may precede
readiness and routing.

Capability bindings make intent-based skills part of the contract. If an
authorized commit, pull request, ticket operation, TDD procedure, or independent
review matches an advertised skill, the exact skill is bound before launch and
must be invoked when that operation becomes due. Direct Git, forge, tracker,
shell, or generic-agent calls are not substitutes for a binding.

The owner task begins with:

```text
- phase: adaptive-delivery-owner
```

The complete goal contract follows inline. Host acceptance of the explicitly
routed subagent launch proves the model and effort. The owner does not create a
second nested goal or replacement adaptive owner.

Example: _“Use adaptive-delivery to diagnose and fix the intermittent cache test.”_

## Workflows and risk

The goal uses one workflow:

- `fix-bug`
- `implement-feature`
- `change-feature`
- `refactor`
- `migration`
- `mechanical`

Risk is `routine`, `elevated`, or `high` based on consequences. Readiness and
independent review are selected separately. High-risk work selects independent
review by default; routine work does not.

Selected review runs through the exact bound review skill after implementation
and final checks. A clear result completes the gate. A blocking result allows
one authorized closed-set repair and one fix verification by default. An
explicit finite repair budget permits additional attempts only with material
progress on the original findings; only clear current-content verification
permits completion or remaining publication.

## Human feedback and blockage

A material question discovered during implementation pauses mutation and is
relayed to the same retained owner. The answer grants only explicitly supplied authority and
the owner performs any required acknowledgement before continuing.

Corrections, constraints, cancellation, and status requests also target the
same owner without requiring a pending question. Status alone does not stop
execution. Restrictions apply before the next affected action; unavailable
host delivery or stopping controls are reported honestly.

The seven contract fields are a completeness template, not a runtime validator.
Only interface syntax such as host tool keys and the owner marker is rigid.
Eval results distinguish active enforcement from passive native observation;
the eval guard is additional assistance, not shipped-skill behavior.

A genuine blocker is reported semantically with its condition, evidence, and
smallest next action. Darrow does not maintain a retry, waiver, evidence-digest,
or lifecycle-ledger state machine. The owner still observes current external
state before repeating an ambiguous effect and never duplicates an effect that
already completed.

## `bin/goal-loop`

The portable Bash helper exposes only two read-only operations:

```text
goal-loop prepare --repo <path> --host <codex|claude>
goal-loop route --repo <path> --host <codex|claude> --profile <profile> [--route <tuple>]
```

`prepare` reports the repository root, revision, working-tree state,
instructions, workflow documents, and active route catalog. `route` resolves a
policy or exact user-supplied route. Repository overrides live in
`.darrow/config.json`; malformed, unsafe, unknown, duplicate, or host-inconsistent
route configuration fails closed.

The helper does not launch models, persist objectives, record lifecycle state,
render completion reports, supervise work, or provide nested host sessions.

## Claude route agents

`bin/claude-agent-route` maps an exact supported Claude model and effort to one
plugin-shipped route agent and rejects conflicting environment overrides. The
current bundled routes are:

- Claude Sonnet 5, low effort;
- Claude Sonnet 5, medium effort; and
- Claude Opus 5, high effort.

The resolver verifies the scoped agent's model and effort frontmatter and
rejects higher-priority environment overrides. The foreground Agent call omits
a per-call model override, so native host precedence applies that route while
the returned agent id establishes the sole owner. Eval infrastructure may audit
the resulting child transcript without adding a live parent workflow step.

## Design boundaries

- Preflight is read-only.
- Readiness completes before owner launch when selected.
- Exactly one separate route-selected subagent owns the run.
- The parent does no repository or external work after launch acceptance.
- Intent-matched advertised skills are mandatory at their bound operations.
- Darrow adds no lifecycle ledger, planner/executor/verifier controller, daemon,
  queue, scheduler, nested host process, or canonical telemetry report.
- Goal completion grants no commit, push, pull-request, merge, release,
  deployment, ticket mutation, or other authority.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the [Darrow](https://github.com/BjRo/darrow)
marketplace.
