# Design principles

Darrow separates focused agent capabilities from explicitly invoked workflows
that coordinate longer work. Plugins remain independently installable.

## Five responsibility categories

| Category      | Owns                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| Foundations   | Durable repository context and reusable agent guidance                    |
| Capabilities  | Focused operations and their checks                                       |
| Orchestration | A bounded goal, implementation placement, acceptance and completion       |
| Task recipes  | A familiar outcome and its permission envelope                            |
| Automation    | Admission timing, eligibility and shared capacity under a recurring grant |

Keep these five repository categories even when a category contains no plugins.
They describe responsibilities, not mandatory sequential stages.
Foundations and capabilities support several categories directly. Evaluation
and host telemetry assess work without granting execution authority.

## Capabilities and orchestration

A capability matches a focused request, such as reviewing code or creating a
branch. Users may also select it explicitly. It remains usable without an
orchestrator. Upstream workflows that require explicit invocation keep that boundary.

Orchestration changes how a session continues and completes, so it requires
explicit invocation or preserved delegation from an authorized workflow.
Complexity or duration alone does not start it. See
[ADR-0002](decisions/ADR-0002-separate-capabilities-from-orchestration.md).

Adaptive Goal keeps the native goal, user decisions and completion in the
original main thread. It implements directly or delegates bounded assignments.
The host supplies execution, recovery and continuation. Darrow adds no second
execution controller or lifecycle ledger. See
[ADR-0012](decisions/ADR-0012-keep-native-goal-ownership-in-the-main-thread.md).

## Independent plugins and public handoffs

Each plugin contains its runtime resources and documents its prerequisites.
It neither reads sibling plugin files nor assumes another Darrow plugin is
installed. Cooperating workflows select compatible host-advertised capabilities
by intent, checking prerequisites, effects, result evidence and refusal conditions.
There is no second capability-name registry. See
[ADR-0003](decisions/ADR-0003-treat-plugins-as-optionality-boundaries.md).

A capability returns its result or refusal to the enclosing owner. The owner
chooses authorized investigation, a user question or termination. A successful
suboperation adds no authority; a required refusal cannot be bypassed through raw tools.

Recipes preserve approved intent, agreed test seams, checks and inherited
permissions. Ticket-to-PR carries one ticket's branch, publication, reviewer
proof and required-green-CI envelope through implement into the same native owner.
A reused PR URL is insufficient: publication evidence must identify the intended
remote commit and required CI must pass for that final commit.

## Acceptance and independent review

The goal owner accounts for each acceptance criterion using current evidence
or an explicit gap. Independent Review owns its standards and request-conformance
judgments, fresh readers, routes and repair verification. Review clearance alone
does not establish acceptance. A combined repair attempt consumes the owner's
shared finite budget, regardless of the number of assessment providers. See
[ADR-0016](decisions/ADR-0016-keep-independent-review-separate-from-acceptance.md).

## Automation admits work

Automation owns admission timing, eligibility and shared capacity under explicit
recurring authority. No automation plugin currently ships. The recipe and
original native session retain engineering execution and completion. Installing
a plugin grants no recurring execution or publication authority.
[ADR-0017](decisions/ADR-0017-limit-automation-to-authorized-admission.md) records
the admission boundary.

## Skills and helpers

Skills own intent, judgment, authority and material choices. Bundled helpers
handle repeatable command construction, validation, parsing and normalization.
Their results expose the operation, target, effects, evidence and failure.

Substantial deterministic mechanics use contained Python packages managed by UV;
small host launchers and command glue may use portable Bash. Repository evaluation
tooling remains outside the plugin runtime. The
[plugin development guide](plugin-development.md) and
[Python quality standard](python-quality.md) own the current development rules.

## Curated workflows

Matt Pocock and pstack are pinned MIT bundles with complete notices and recorded
Darrow adaptations. Trust upstream maintenance for unchanged workflows, checking
packaged content and native entrypoints. Focus behavioral evals on material Darrow
adaptations. Updates are deliberate, not scheduled. See
[ADR-0015](decisions/ADR-0015-curate-upstream-workflows-and-retire-duplicate-providers.md).

Principles are optional guidance. They preserve the caller's scope, checks,
authority and completion owner. Their routing and customization rules live in
the pstack package.

## Current documentation and evidence

Usage belongs in plugin READMEs; execution instructions belong in skills and
their local references. Development guides own contributor rules. ADRs preserve
architectural choices with commit references. Completed investigations, migrations
and experiment snapshots remain in Git history. See
[ADR-0014](decisions/ADR-0014-keep-current-documentation-with-its-owner.md).

Behavioral outcomes, activation and matched comparisons answer different questions.
A dry run proves preparation, not execution. Report missing measurements as unknown
and use matched controls before claiming an improvement. See
[eval development](eval-development.md) for current commands and evidence rules.
