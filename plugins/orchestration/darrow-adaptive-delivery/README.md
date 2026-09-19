# Darrow Adaptive Delivery

This plugin provides two separate entrypoints: a read-only host-configuration
doctor, and explicit Adaptive Delivery orchestration that compiles one bounded
engineering request and launches exactly one route-selected, host-visible
subagent as its work owner.

```text
request + repository -> read-only preflight -> readiness -> contract -> one owner
```

The parent owns preflight, readiness discussion, capability binding, route
selection, and launch. The subagent owns implementation, verification, human
feedback, independent review, authorized publication, and completion.

`adaptive-delivery` starts only through explicit user invocation or delegation from
an explicitly invoked orchestration entrypoint. Ordinary engineering intent
never starts it.

`doctor-adaptive-delivery` is an ordinary intent-matched capability. Asking it
to check host configuration never starts orchestration or launches an owner.

[![Adaptive Delivery: preflight launches one execution owner, which invokes verification and handles bounded repairs.](https://raw.githubusercontent.com/BjRo/darrow/main/docs/assets/adaptive-delivery-capabilities.svg)](https://github.com/BjRo/darrow/blob/main/docs/assets/adaptive-delivery-capabilities.svg)

Preflight prepares the contract and selects compatible capabilities.
One execution owner implements the change, obtains selected verification,
and handles repairs within the shared budget. Questions and feedback
return to that same owner.

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
authorized commit, pull request, ticket operation, TDD procedure, or verification
matches an advertised skill, the exact skill is bound before launch and
must be invoked when that operation becomes due. Direct Git, forge, tracker,
shell, or generic-agent calls are not substitutes for a binding.
Selected assessment-provider bindings travel through verification to the same owner.

Ticket delivery discovers all local branches correlated with the provider's
exact opaque token through a compatible Git capability. One match is reused
even when a new attempt proposes a different suffix; several matches require
an explicit choice; no matches permits a conventional new name. Adaptive
delivery owns that decision and the Git capability owns inspection and
preparation. Task recipes continue to delegate their authority envelope.

The owner task begins with:

```text
- phase: adaptive-delivery-owner
```

The complete goal contract follows inline. Host acceptance of the explicitly
routed subagent launch proves the model and effort. The owner does not create a
second nested goal or replacement adaptive owner.

## `doctor-adaptive-delivery`

The doctor checks the effective Codex or Claude Code delegation controls
without modifying them. It reports the exact configuration source, host or
backend applicability, and separate conclusions for:

- the baseline owner-only path: one spawned-agent slot and one nested layer;
- the full required-assessment path: five spawned-agent slots and four nested
  layers across owner, verification, review, and two parallel readers.

For Codex it checks `agents.enabled` and
`agents.max_concurrent_threads_per_session`. It reports `agents.max_depth` as a
V1-only nesting control that V2 ignores. For Claude Code it checks the effective
process values of `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` and
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` only where the installed version supports
them. Absent, unreadable, malformed, disabled, inadequate, and unknown states
remain distinct, and the output never includes unrelated settings or secrets.

Example: _“Check whether this Codex configuration supports Adaptive Delivery's
full verification path.”_

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

Selected assurance binds compatible verification and required independent review
before launch. The owner supplies the candidate, originating criteria, constraints
and successful current checks to verification. Verification returns all selected
assessment results and criterion-level evidence before the owner repairs their
combined eligible blockers. The initial production path uses review only;
optional QA and evidence packaging remain separate capabilities.

One owner has at most two repair attempts total across verification by default,
each followed by refreshed checks and fresh closed-set verification. Extra
providers do not add budgets. Preserve finding and target history and direct
repair-caused regressions; a new comprehensive assessment cannot reset the limit.
Clear current evidence ends repair immediately. Further attempts require material
progress and remaining budget. Missing, stale, unchanged or inconclusive required
evidence prevents completion and remaining publication. Explicit finite overrides
and stricter invocation, time, token and authority limits remain in force.

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

## Python helpers

The contained `backend` package exposes two read-only preflight operations.
Prefix each command with
`uv run --quiet --frozen --no-dev --project "<absolute-plugin-root>/backend"`:

```text
adaptive-delivery-preflight prepare --repo <path> --host <codex|claude>
adaptive-delivery-preflight route --repo <path> --host <codex|claude> --profile <profile> [--route <tuple>]
```

`prepare` reports the repository root, revision, working-tree state,
instructions, workflow documents, and active route catalog. `route` resolves a
policy or exact user-supplied route. Repository overrides live in
`.darrow/config.json`; malformed, unsafe, unknown, duplicate, or host-inconsistent
route configuration fails closed.

The helper does not launch models, persist objectives, record lifecycle state,
render completion reports, supervise work, or provide nested host sessions.

## Claude route agents

`claude-agent-route` (through the same frozen UV command) maps an exact supported Claude model and effort to one
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

## When to use

Use this for an explicitly invoked bounded engineering outcome. Ordinary complex work does not select it. Use a focused capability when one operation suffices.

## Hosts and prerequisites

Codex with native subagent support or Claude Code with the bundled foreground
route agents; [UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
Git, available routes, and the capabilities matching authorized operations.
The helpers support Linux, macOS, and native Windows without Bash or runtime
Python dependencies. Regression tests run through the repository's Python
quality gate on all three platforms.

## Installation

Install `darrow-adaptive-delivery@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review the local authority and prerequisite boundaries first.

## Usage

This orchestration entrypoint is explicit-only; an implicit request does not
start it. For example:

> Use adaptive-delivery to fix the intermittent cache test and verify the repair.

Select `adaptive-delivery` from Codex's `$` menu, or invoke
`/darrow-adaptive-delivery:adaptive-delivery` in Claude Code and provide the bounded request.

For read-only diagnosis, select `doctor-adaptive-delivery` from Codex's `$`
menu or invoke `/darrow-adaptive-delivery:doctor-adaptive-delivery` in Claude
Code.

## Expected result

Read-only preflight and readiness, then one routed execution owner. Effects depend on the explicit contract; completion alone grants no publication or tracker authority.

## Troubleshooting

If readiness is not ready, resolve its findings before launch. Malformed route configuration or an unavailable exact capability binding must be reported. Keep feedback with the same accepted owner.
If an owner, verification coordinator, review coordinator, or parallel reader
cannot launch, run `doctor-adaptive-delivery` in the affected host session. Use
the exact source it reports; in isolated Codex evals, that is the eval
`CODEX_HOME/config.toml`, not the checkout's `.codex/config.toml`.
For host discovery problems, use the
[installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md).
Report the exact host/plugin versions and refusal without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the [Darrow](https://github.com/BjRo/darrow)
marketplace.
