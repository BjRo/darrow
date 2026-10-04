# Darrow Adaptive Delivery

Adaptive Delivery keeps one bounded native goal in the main thread. That thread
owns preflight, acceptance, user decisions and completion. It delegates
implementation and selected verification as separate assignments.

```text
request + repository -> read-only preflight/readiness -> main-thread native goal
                                                         -> implementation
                                                         -> selected verification
```

The plugin also provides `doctor-adaptive-delivery`, a read-only host-capacity
check. Doctor intent never starts orchestration. Adaptive Delivery itself starts
only through explicit invocation or preserved delegation from an invoked recipe.

Version 0.24.0 changes the ownership boundary. Artificer 0.2.0 adds the matching
main-thread continuation transport; earlier separate-owner releases are
incompatible. Artificer's host and authentication requirements apply separately.
Existing separate-owner deliveries require reconciliation in their original
installation rather than automatic migration.

[![Adaptive Delivery: the main thread retains the native goal and coordinates bounded implementation and verification.](https://raw.githubusercontent.com/BjRo/darrow/main/docs/assets/adaptive-delivery-capabilities.svg)](https://github.com/BjRo/darrow/blob/main/docs/assets/adaptive-delivery-capabilities.svg)

## `adaptive-delivery`

The skill:

- discovers repository instructions and preserves existing local work;
- makes scope, acceptance, checks and authority explicit;
- resolves selected readiness before implementation, reusing ready same-scope evidence;
- selects implementation difficulty separately from consequence risk;
- binds authorized operations to compatible advertised capabilities;
- keeps the native goal within 4,000 characters and coordination instructions in the skill;
- delegates bounded implementation and verification with explicit role routes;
- coordinates repairs, user feedback, reassessment and evidence-supported completion.

Readiness findings stop implementation until resolved. Material changes to scope,
acceptance, constraints or authoritative input invalidate affected evidence and
may require readiness again. The main thread retains these decisions throughout.

Each matching advertised skill is mandatory for its bound operation. Direct Git,
forge, tracker or generic-agent calls cannot replace it. Selected verification
owns its provider coordination; review owns its independent readers. Their
internals stay inside those capabilities.

Ticket delivery discovers local branches using the provider's exact opaque
token through a compatible Git capability. One match is reused, several require
an explicit choice, and no matches permits one conventional new name. The recipe
supplies authority; Adaptive Delivery chooses and the Git capability prepares.

## Workflows, risk and model routes

Choose one workflow: `fix-bug`, `implement-feature`, `change-feature`,
`refactor`, `migration` or `mechanical`. Missing decisions stop affected work.
The main thread translates its workflow into concrete assignments and arranges
required evidence, including a failing check before an edit when applicable.
The implementor returns changes, check results and blockers; workflow sequencing
and delivery bookkeeping remain with the main thread.

Consequence risk controls assurance. Routine work omits independent review by
default; elevated risk selects it when independent judgment is needed; high risk
requires it. User or repository requirements can strengthen those gates.

Implementation difficulty controls the bounded implementor:

| Profile      | Codex model | Effort |
| ------------ | ----------- | ------ |
| routine      | gpt-6-luna  | medium |
| routine-plus | gpt-6-luna  | high   |
| scaled       | gpt-6-sol   | medium |
| repo-wide    | gpt-6-sol   | high   |
| judgment     | gpt-6-astra | high   |

A fully specified localized security change can remain routine implementation
while requiring high-risk assurance. `routine-plus` needs an actual implementation
tradeoff or an explicit first-pass correctness priority.

**Use Codex Sol/medium for main-thread coordination.** Weaker compatible models
are permitted with a brief reliability hint. Trials showed substantial remaining
coordination and evidence failures on Luna; Sol improved some outcomes but was
not uniformly reliable. Stronger configurations are allowed, not all proven.

Verification coordination is explicitly Sol/medium or stronger. Review
coordination stays Luna/medium, while review's independent readers stay Sol/xhigh.
Parent-model inheritance and the implementation route must not change these roles.

Claude uses the same architecture. Its implementation policy selects scoped
Sonnet 5/low, Sonnet 5/medium or Opus 5/high agents. Verification coordination uses
Opus 5/high; review coordination uses Sonnet 5/medium and preserves review's own
reader routes. Claude has lighter validation than Codex; these routes are not
claimed to be measured equivalents.

## Verification and repairs

Selected verification receives the exact candidate, originating acceptance,
constraints, successful current checks and selected review binding. The main
thread waits for every selected result, checks criterion coverage, and preserves
the complete evidence before authorizing a combined repair.

The default maximum is **two implementation repair attempts total**, shared
across providers and findings. Each attempt refreshes checks and obtains fresh
closed-set verification. Preserve finding identities, prior reports, candidate
history and direct repair-caused regressions. Reuse the same implementor for
repairs when it remains available and fits the route and scope. Send concrete
repair instructions without handing over workflow state or attempt accounting.
Replacement children and comprehensive
reassessment never reset the allowance. Clear evidence ends repair immediately;
further attempts require progress and remaining budget. Explicit finite overrides
and stricter authority, invocation, time or token limits still apply.

A concrete assessment error or new evidence can justify a correction at unchanged
code. Use the provider's public correction contract and retain the earlier report
and full history. Fresh evidence must support the new conclusion. Correction
neither spends nor resets implementation repair attempts.

Missing, stale, contradictory or inconclusive required evidence blocks completion
and dependent publication. A passing review alone cannot cover unassessed criteria.

## Safety boundaries

Preflight is read-only. Native goal activation and required readiness precede
implementation. Children receive bounded authority; missing decisions and failed
gates stop affected work. Completion grants no publication or tracker authority.
No nested host, replacement goal owner or custom workflow runtime is introduced.

## Human feedback and blockage

The main thread asks material questions and stops affected mutation. It preserves
the same goal, decisions, evidence and consumed repair attempts while waiting.
The answer supplies only its actual authority; required acknowledgements must
succeed before work resumes. A status question does not cancel work.

Use the host's actual goal controls. On Codex, literal pause requires an explicit
user pause request; a pending question can stop affected work without inventing
a pause transition. On Claude, use native goal question and continuation behavior.
Do not clear and recreate the goal to obtain an answer or reset history.

A blocker names the condition, evidence and smallest next action. Observe current
external state before retrying an ambiguous effect, and never duplicate a completed
effect. Report unavailable delivery or stopping controls honestly.
Every terminal response, including a blocked response after native continuation,
reports repair use and the authorized maximum. Retained evidence of an unchanged
deterministic blocker does not require another execution of the failing command.

## `doctor-adaptive-delivery`

The doctor reads effective host delegation controls and distinguishes:

- bounded implementation: one child slot and one nesting layer;
- required verification and review: four active child slots and three nesting
  layers, with implementation settled before assessment.

Native limits that count retained inactive threads may require releasing completed
assignments. Configuration diagnosis does not prove current free capacity or
native goal availability.

Codex checks delegation, concurrent-thread capacity and V1 nesting separately,
including trusted project configuration layers. Isolated evals use their isolated
`CODEX_HOME`. Claude checks version-applicable concurrency and nesting environment
controls. Unknown defaults, unreadable input and inadequate capacity remain distinct.
The doctor changes nothing and prints no unrelated settings or secrets.

## Python helpers

Require UV, Git and the readable packaged project and lock. UV selects compatible
Python; system Python is not a separate prerequisite. The helpers support Python
3.10–3.13 on Linux, macOS and Windows without Bash.

Prefix commands with
`uv run --quiet --no-project "<absolute-plugin-root>/backend/scripts/run_locked.py"`:

```text
adaptive-delivery-preflight prepare --repo <path> --host <codex|claude>
adaptive-delivery-preflight route --repo <path> --host <codex|claude> --profile <profile> [--route <tuple>]
claude-agent-route --provider anthropic --model <model> --effort <effort>
host-config-doctor codex --config <path> [--project-root <path>] --backend <v1|v2|unknown> --context <effective|isolated-eval>
host-config-doctor claude [--version <installed-version>]
```

Repository implementation-route overrides live in `.darrow/config.json`.
Malformed or unreadable policy refuses resolution. Claude's resolver checks
scoped-agent frontmatter and conflicting environment overrides; invoke its exact
Agent type without a per-call model override.

Helpers do not launch models, persist objectives, supervise work or implement
goal continuation.

## When to use

Use for an explicitly invoked bounded engineering outcome. Ordinary complex work
does not select it. Use a focused capability when one operation suffices.

## Hosts and prerequisites

Require native goal continuation and delegation, available selected model routes,
UV, Git and capabilities matching authorized operations.

Codex activates the goal in the main thread using native goal controls. Claude
uses native `/goal`; an available `ProposeGoal` may queue activation for the end
of the turn. A queued proposal is not an active goal. Headless Claude may require
the client or user to enter through `/goal <condition>`. If native activation
is unavailable, the skill reports the required boundary rather than launching
another owner or a nested host process.

The Codex app-server used in evals hosts this original main thread. It is not a
production execution-owner transport or custom workflow runtime.

## Installation

Install `darrow-adaptive-delivery@darrow` using the
[host installation instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).

## Usage

> Use adaptive-delivery to fix the intermittent cache test and verify the repair.

Select `adaptive-delivery` from Codex's `$` menu, or invoke
`/darrow-adaptive-delivery:adaptive-delivery` in Claude and provide the request.

For diagnosis, select `doctor-adaptive-delivery` or invoke
`/darrow-adaptive-delivery:doctor-adaptive-delivery`.

## Expected result

A self-contained session response with the outcome, changed files, current
checks, selected verification, repair use and maximum, performed effects and
remaining risks or blockers. A child return or a report link alone cannot prove
completion. Completion grants no commit, push, PR, merge, deployment or ticket
authority.

## Troubleshooting

Resolve non-ready findings before implementation. Report unavailable native goal,
route or capability boundaries concretely. Run the doctor for delegation-capacity
problems and use its reported configuration source. Keep feedback with the same
main-thread goal.

For discovery problems, use the
[installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md).
Report host and plugin versions and the refusal without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the [Darrow](https://github.com/BjRo/darrow)
marketplace.
