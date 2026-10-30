# Design principles

Darrow deliberately separates **what an agent knows how to do** from **how
longer-running work is kept moving**. It packages both as independently
adoptable plugins, but gives them different activation and ownership models.

## Responsibility layers and their contracts

These responsibilities can be entered independently; they are not mandatory
sequential stages. Foundations and capabilities support several layers directly.

| Responsibility | Decision owner                                                            | Delivered evidence                                                                      |
| -------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Foundations    | Repository context, accepted policy and reusable skills                   | Ordinary repository artifacts that remain useful without the producing plugin installed |
| Capabilities   | Focused operations and how they establish assurance                       | Result, inspected basis, effects and operation-specific refusal                         |
| Orchestration  | Bounded goal, workflow, required assurance and one execution owner        | Contract and owner-sourced continuation/completion evidence                             |
| Task recipes   | Familiar complete outcomes and consistent explicit permission envelopes   | One delegated outcome with preserved authority                                          |
| Automation     | Admission timing, eligibility and capacity for explicitly authorized work | Grant-bound local entry and handoff; original native execution and continuation         |

Evaluation and observability assess behavior across all of these responsibilities.
They do not grant authority or act as another execution stage. The
[layer-composition contract](specs/layer-composition.md) records decision
ownership, recommendation dispositions, operation handoffs and the contracts
every authorized automation entry must preserve. Local Artificer implements the
bounded [local admission contract](specs/artificer.md).

## Capabilities and orchestration

A capability is a focused procedure such as reviewing code, practicing TDD,
creating a commit, or updating a ticket. Its skill description advertises the
intent it serves, allowing the model to select and invoke it when that intent
appears in a user request. A user may also invoke a capability by naming it
explicitly. A capability:

- owns one coherent kind of work and its invariants;
- can be invoked directly or composed by a larger workflow;
- remains useful without any Darrow orchestration helper; and
- does not silently take ownership of an unrelated multi-step session.

Orchestration owns the continuation contract around work: how the outcome is
framed, what must remain true, where state lives, how execution resumes or
adapts, and what counts as complete. Because that changes the shape and extent
of a session, orchestration starts only through explicit user invocation. The
model must not infer orchestration merely because a task is complex,
long-running, or multi-step. Once invoked, orchestration may use installed
capabilities by their public intent. It may also delegate a bounded
phase to another orchestration helper without requiring a second user
invocation, provided the originating request and authority are preserved. That
delegation is continuation of already-authorized orchestration, not inferred
activation, and it must not turn every capability into a mandatory phase.

This split keeps focused procedures reusable while allowing orchestration to
evolve independently. Installing a review or Git capability does not opt a user
into a control plane, and improving orchestration does not require folding
those capabilities into one monolithic workflow.

## Foundations are capability infrastructure

Foundation plugins maintain durable context and reusable agent surfaces that
support other work: repository information architecture, authoritative
decisions, and skill authoring. `foundation` is a marketplace and repository
layout category, not a third activation model. Its skills remain
intent-matched capabilities, stay independently installable, and never start
orchestration implicitly.

## Plugins are optionality boundaries

A plugin is Darrow's unit of adoption, compatibility, and ownership. Each
plugin is self-contained and independently installable. It must not reference a
sibling plugin's files or assume that another Darrow plugin is present.

Plugins may cooperate through host-visible skill intent. For example, a
consumer can ask for ticket operations without knowing which installed skill
supplies them. Darrow does not add a second versioned capability-name registry
on top of the host's skill discovery. If an optional skill is unavailable, the
consumer follows its own documented stop or fallback behavior instead of
reaching into another plugin.

Integrations may name a provider in the plugin identity or use contained
provider adapters. Consumers honor the user's provider choice or established
project context and resolve ambiguity before access. Adding a provider does
not require another public skill or a sibling runtime dependency.

Advertised intent identifies a potential provider; the caller must also check
its prerequisites, effects, returned evidence and stop conditions. A capability
returns its operation's refusal to the enclosing owner, which decides authorized
investigation, human feedback or termination. It cannot waive a failed gate or
bypass a refused operation. This permits compatible replacements without a
central registry and keeps continuation with the same owner.

This boundary preserves genuine choice: users can adopt one focused capability,
several complementary capabilities, or an orchestration helper without
accepting the rest of the marketplace.

## Task recipes are explicit delivery envelopes

A task recipe packages one repeatable, explicitly invoked delivery outcome. It
uses the orchestration activation model, but owns only the outcome-specific
authority, intake, and publication envelope. A recipe can delegate its one
bounded request to adaptive-goal without another user invocation, preserving
the original request and permissions. It is not a controller, phase graph,
ledger, queue, or durable workflow runtime.

## Scripts hide tool mechanics from the model

Skills own intent, judgment, authority, and material choices. Narrow bundled
helpers own repeatable, error-prone command construction, tool discovery,
escaping, validation, parsing, and normalization. They return compact, stable,
machine-readable evidence. This makes mechanics
deterministic and testable without asking the model to reconstruct a protocol
on every run.

A helper must still identify its operation, target, material side effects,
inspected evidence, failure, and any required next decision. Hiding mechanics
must not hide authority or consequences.

## Plugin mechanics use contained Python or portable Bash

Contained Python packages managed by UV support substantial deterministic
mechanics when they improve clarity, testability, or native Windows support.
Portable Bash remains appropriate for small host-specific launchers and command
glue. Adoption is incremental; each plugin owns its prerequisites and remains
independently installable.

The [plugin development guide](plugin-development.md) owns runtime restrictions
and shell compatibility. The [Python standard](specs/python-quality.md) owns
packaging, locked execution, migration, and quality gates. Repository-level
development tooling remains outside the plugin-runtime boundary.

## Evals make development evidence-based

Every skill owns colocated eval cases that verify its public functionality,
intent-triggering boundary, refusal and stop behavior, and relevant repository
outcomes. Deterministic scripts also receive direct tests, including both
supported Bash boundaries. The shared runner executes judgment cases in the
real supported agent harnesses rather than treating transcript shape as proof
of success.

The same eval surface supports evidence-based development. A new prompt,
workflow, route, or orchestration variant is compared with the relevant control
on the same fixtures, task prompts, acceptance checks, harness, model, and
effort. Depending on the claim, the control may be the released skill, vanilla
Codex or Claude without the capability, raw native goal functionality, or the
historical ticket-pipeline baseline.

Comparisons report trial count and the metrics relevant to the claim, such as
task pass rate, quality or escaped defects, false positives, tool and child
invocations, human interruptions, tokens, cost, and wall time. A design is not
called better because it is plausible or because one run succeeded; empirical
claims carry their evidence, uncertainty, and limitations.

## Adaptive Goal is the core orchestration helper

[Adaptive Goal](../plugins/orchestration/darrow-adaptive-goal/README.md) makes
acceptance, repository constraints, evidence, and implementation placement
explicit before native execution. The main thread owns the goal, user decisions,
and completion, as recorded in [ADR-0012](decisions/ADR-0012-keep-native-goal-ownership-in-the-main-thread.md).
The host supplies execution, recovery, and continuation.

Darrow's earlier orchestration benchmark found no incremental value from a
duplicate controller and measured substantial wall-time and child-invocation
overhead. Adaptive Goal keeps preflight without adding another execution runtime:

```text
request + repository -> read-only preflight/readiness -> native goal in the main thread
                                                        -> direct or bounded implementation
                                                        -> selected capabilities
```

Implementation may be direct or delegated. Selected verification remains a
separate assignment, and capabilities retain their own protocols, delegation,
and reviewer routes. The helper adds no fixed phase pipeline, lifecycle ledger,
daemon, queue, or publication authority.

Before changing Adaptive Goal, read `docs/specs/adaptive-goal.md`.
The [normative contract](specs/adaptive-goal.md) owns preflight, goal limits,
route selection, placement, verification, repair, and completion.

## The ticket pipeline is a reference and benchmark baseline

[`darrow-ticket-pipeline`](../plugins/orchestration/darrow-ticket-pipeline/README.md)
preserves Darrow's earlier orchestration approach as an executable reference
implementation. It uses a predefined phase graph, fresh phase agents, bounded
repair loops, and durable state and artifacts in one tracker ticket.

That design is intentionally retained so Darrow can compare a static,
controller-owned workflow with the smaller native-goal approach on the same
fixtures. Useful comparison dimensions include completion rate, escaped
defects, false positives, child invocations, human interruptions, tokens, cost,
and wall time.

The ticket pipeline is not a second recommended orchestration path and does not
set Darrow's future product direction. Changes to it should preserve its value
as a faithful reference and reproducible benchmark, not expand it into a daemon,
queue, or general workflow runtime. Its frozen behavior and comparison contract
are specified in [Capability: Ticket Pipeline](specs/ticket-pipeline.md).
