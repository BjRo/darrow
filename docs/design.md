# Design principles

Darrow deliberately separates **what an agent knows how to do** from **how
longer-running work is kept moving**. It packages both as independently
adoptable plugins, but gives them different activation and ownership models.

## Responsibility layers and their contracts

These responsibilities can be entered independently; they are not mandatory
sequential stages. Foundations and capabilities support several layers directly.

| Responsibility       | Decision owner                                                            | Delivered evidence                                                                      |
| -------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Foundations          | Repository context, accepted policy and reusable skills                   | Ordinary repository artifacts that remain useful without the producing plugin installed |
| Capabilities         | Focused operations and how they establish assurance                       | Result, inspected basis, effects and operation-specific refusal                         |
| Orchestration        | Bounded goal, workflow, required assurance and one execution owner        | Contract and owner-sourced continuation/completion evidence                             |
| Task recipes         | Familiar complete outcomes and consistent explicit permission envelopes   | One delegated outcome with preserved authority                                          |
| Automation — planned | Admission timing, eligibility and capacity for explicitly authorized work | Future entry and handoff contracts; no current unattended recipe entry                  |

Evaluation and observability assess behavior across all of these responsibilities.
They do not grant authority or act as another execution stage. The
[layer-composition contract](specs/layer-composition.md) records decision
ownership, recommendation dispositions, operation handoffs and the contracts
automation needs before it can ship.

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
bounded request to adaptive-delivery without another user invocation, preserving
the original request and permissions. It is not a controller, phase graph,
ledger, queue, or durable workflow runtime.

## Scripts hide tool mechanics from the model

Skills should expose the intent, decisions, and evidence that require model
judgment—not the plumbing of every underlying command or tool protocol. When a
workflow depends on repeatable, error-prone mechanics, a bundled script provides
a narrow interface. The invoking model supplies intent-level inputs; the script
owns command construction, tool discovery, escaping, validation, parsing,
and normalization, then returns compact, stable, machine-readable evidence.

This boundary reduces tool-call chatter and model context while making the
mechanics deterministic and directly testable. It is the same general pattern
used by command wrappers and context-compression tools: the invoker works with a
small purpose-built operation instead of reconstructing a low-level call
sequence on every run.

The script may hide protocol details, but it must not hide authority or
consequences. Its interface and result still identify the operation, target,
material side effects, inspected evidence, failure, and any required next
decision.

## Plugin mechanics use portable Bash

Executable mechanics shipped inside a plugin use portable Bash, baseline Unix
utilities, and the host CLIs that the capability explicitly wraps. A plugin
does not introduce Python, JavaScript or TypeScript, Ruby, a JVM, a compiled
binary, or another full language runtime for its internal helpers.

This keeps each plugin inspectable, independently installable, and usable in
the default macOS and Linux environments of both Claude Code and Codex. Darrow
targets Bash 5 and the macOS `/bin/bash` 3.2 boundary, so scripts also avoid
GNU-only assumptions and newer Bash-only syntax.

The restriction applies to plugin-shipped runtime mechanics. Repository-level
development infrastructure may use a different implementation when an accepted
decision establishes it. In particular, the shared evaluation runner uses
TypeScript on Bun; plugins consume its declarative eval contract but do not ship
it as a runtime dependency.

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

## Adaptive Delivery is the core orchestration helper

The core path for bounded engineering work is the `adaptive-delivery` skill in
[`darrow-adaptive-delivery`](../plugins/orchestration/darrow-adaptive-delivery/README.md).

Long-running native agent work often begins with a request that leaves
completion criteria, repository constraints, verification depth, or reasoning
effort implicit. A custom planner/executor/verifier controller can make those
choices explicit, but it also duplicates the host's own goal execution,
recovery, and completion machinery. Darrow's earlier orchestration benchmark
found no incremental value from that duplication and measured substantial
wall-time and child-invocation overhead.

Adaptive Delivery keeps the useful part and removes the duplicate runtime:

```text
request + repository -> read-only preflight/readiness -> goal contract -> one routed subagent owner
```

Preflight discovers applicable repository instructions and checks, turns the
request into observable acceptance criteria and scope, reuses or obtains a
same-scope readiness result when required, binds matching advertised skills,
selects a task workflow and risk gate, and chooses proportionate model and
effort. It then activates exactly one route-selected host-visible subagent. That
owner invokes the bound skills and owns implementation, adaptation, recovery,
verification, feedback, and completion from that point onward.

The helper therefore improves the initial conditions for an adaptive run; it is
not a second adaptive loop, multi-agent controller, lifecycle ledger, daemon,
queue, publication mechanism, or general workflow runtime. The normative
contract is in [Capability: Adaptive Delivery](specs/adaptive-delivery.md).

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

## Consequences

- Add focused, reusable behavior as an intent-matched capability.
- Introduce orchestration only when work needs an explicit continuation and
  completion contract and the user invokes it explicitly.
- Use Adaptive Delivery as the default orchestration helper for bounded
  engineering work.
- Treat the ticket pipeline as historical reference and comparative evidence,
  not as a template for new orchestration features.
- Keep every plugin independently adoptable and avoid rebuilding a general
  runtime around the marketplace.
- Hide repeatable tool mechanics behind narrow, testable scripts without hiding
  their authority or effects.
- Ship plugin mechanics as portable Bash and keep heavier languages in
  repository-level development infrastructure.
- Give every skill functional evals and compare behavior-changing variants with
  matched controls before claiming an improvement.
