# Adaptive Ticket-to-PR Opportunity

Status: exploratory research, not an accepted decision or implementation plan  
Reviewed: 2026-08-11  
Sources: comparison with the AutoScout24 SDLC `ticket-to-pr` skill and
orchestrator; Matt Shumer's
[How to Run a Gauntlet Loop](https://somethingbig.ai/gauntlet-loop)

## Purpose

This note preserves the result of a design discussion about replacing the
controller-heavy SDLC `ticket-to-pr` workflow with Darrow's capability and
native-goal architecture. It records current working conclusions, boundaries,
and follow-up questions. It does not authorize a new plugin, change the
adaptive-goal publication contract, or accept the provisional capability names
used below.

The working hypothesis is that Darrow can capture roughly 90% of the valuable
ticket-to-PR outcome without reproducing the original workflow runtime:

1. **Capabilities** provide focused, independently adoptable behavior such as
   ticket access, discovery, readiness assessment, review, evidence capture,
   Git operations, and decision capture.
2. **Adaptive orchestration** compiles and activates one host-native goal that
   owns the complete outcome, recovery, verification, and completion.
3. **UX recipes** provide explicitly invoked reusable goal templates and
   specialized read-only preflight, such as `ticket-to-pr`.

The percentage is an architectural estimate, not an empirical result. It means
coverage of the useful outcome and assurance behavior, not parity with the old
controller's status commands, phase state, dashboards, logs, or arbitrary
stage restart.

## Working conclusion

A provisional `darrow-ticket-to-pr` capability should primarily be a reusable
goal template plus specialized read-only preflight on top of `adaptive-goal`.
It should not introduce a phase graph, controller, private retry loop, or
durable workflow state.

The native goal's terminal outcome should be the pull request itself:

```text
$ticket-to-pr <ticket>

read-only preflight
  |-- resolve the ticket through an environment capability
  |-- use the current or explicitly supplied repository
  |-- validate required capabilities and authority
  `-- compile one bounded ticket-to-PR goal

        |
        v

one adaptive native goal
  |-- assess implementation readiness before mutation
  |-- stop for discovery, decision, or blockage when not ready
  |-- create or reuse the task branch when ready
  |-- implement the ready outcome
  |-- verify through the selected workflow and risk gate
  |-- invoke canonical fresh-context review when required
  |-- capture useful review evidence when required
  |-- repair and revalidate
  |-- commit
  |-- push
  `-- open exactly one pull request

        |
        v

PR URL plus the native goal result
```

This keeps the host-native goal owner responsible for continuation. There is no
post-goal Darrow controller that must wake up to publish the result.

## Cross-check against the Gauntlet Loop

Matt Shumer's Gauntlet Loop directly prompted the investigation that led to
Darrow's native goal-loop direction. Its core method is to give one lead agent
a goal and a concrete quality bar, let that agent choose the decomposition,
have fresh critics inspect the actual artifacts rather than builder summaries,
and continue improving without an arbitrary fixed round count.

The ticket-to-PR design aligns with that method while adapting it to bounded
software delivery:

| Gauntlet insight                            | Darrow alignment                                                                                   | Consequence for ticket-to-PR                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Use an actual agentic harness               | Claude and Codex own the native goal, tools, continuation, and delegation                          | Do not build a second execution runtime                                                    |
| Give the goal, not the implementation       | The goal contract describes a conforming PR rather than a phase graph or prescribed architecture   | Let the native goal owner choose the route                                                 |
| Give it a real, inspectable bar             | Acceptance criteria, reference behavior, checks, targets, and evidence define completion           | Readiness must establish a concrete quality bar before implementation                      |
| Let the agent split the work                | Native delegation remains available beneath one goal owner                                         | Do not prescribe planner, builder, critic, or repair fan-out                               |
| Never let the builder grade itself          | Canonical review uses fresh context and the actual pinned diff                                     | Invoke independent review when risk or policy makes judgment valuable                      |
| Inspect the real artifact                   | Tests, running behavior, screenshots, benchmarks, and diffs outrank author summaries               | Evidence capabilities should preserve actual outputs and provenance                        |
| Keep going without an arbitrary final round | The native goal continues until the bar is met, blocked, interrupted, or its explicit budget stops | Do not restore fixed controller retry counts                                               |
| Watch without interrupting                  | Host telemetry and selected evidence show progress                                                 | Use OpenTelemetry, Langfuse, and evidence artifacts instead of a Darrow dashboard          |
| Smooth the whole after parallel work        | Final-tree gates and broader review inspect integration and coherence                              | Apply when delegation or change breadth creates composition risk, not as a mandatory phase |

The article sharpens one concept that was implicit in the earlier discussion:
observable acceptance criteria are necessary, but an inspectable **quality
bar** is the stronger goal input. For backend work the bar may be a test suite,
latency target, failure-recovery scenario, security boundary, or reference
implementation. For visual work it may be a supplied reference, side-by-side
render, or measurable interaction behavior.

When no credible bar exists, Darrow should not let the implementation goal
invent an unbounded definition of "good." An upstream discovery or readiness
capability should establish an inspectable bar or stop for the smallest missing
decision. This is a stricter delivery adaptation of the article's suggestion
that finding a useful bar can itself be part of a Gauntlet task.

Two proportionality differences are deliberate hypotheses rather than settled
empirical conclusions:

- Gauntlet sends every important piece through a fresh critic. Darrow proposes
  routine self-verification and selectively invokes canonical fresh-context
  review for elevated or high risk, repository policy, or explicit review
  intent.
- Gauntlet recommends very high effort for serious, expansive runs. Darrow
  separates consequence risk from reasoning demand and selects model and effort
  proportionately.

These adaptations should be evaluated rather than assumed superior. The
article supports the native ownership, concrete-bar, fresh-context, and
non-fixed-loop principles; it does not itself demonstrate the best review or
effort policy for ordinary ticket delivery.

## Coverage and ownership

| Concern                                     | Working owner                                               | Assessment                                                |
| ------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| Read the authoritative ticket               | Environment-provided capability selected by intent          | Required input; no hard-coded tracker                     |
| Locate or clone a repository                | Nobody                                                      | Excluded; use the current or explicitly supplied checkout |
| Repository and local-work safety            | Adaptive preflight and Git capability                       | Required                                                  |
| Branch and worktree                         | Git capability                                              | Branch required; worktree only when explicitly requested  |
| Implementation readiness                    | Canonical readiness-assessment capability                   | Required gate                                             |
| Discovery and planning                      | Optional intent-matched capabilities                        | Conditional and outside adaptive-goal                     |
| Implementation and verification             | Adaptive-goal                                               | Core responsibility                                       |
| Proportional adversarial scrutiny           | Adaptive workflow and risk                                  | Core responsibility                                       |
| Independent code review                     | Canonical fresh-context review capability                   | Selected by risk, policy, or explicit intent              |
| Commit, push, and pull request              | Git capabilities used by the authorized native goal         | Part of the goal outcome                                  |
| Resume and recovery                         | Host-native goal plus observable repository and forge state | No Darrow state machine                                   |
| Model and effort routing                    | Adaptive-goal                                               | No stage-specific overrides                               |
| Execution telemetry                         | Environment-level OpenTelemetry/Langfuse integration        | Cross-cutting infrastructure                              |
| Review evidence                             | Conditional evidence-capture capability                     | Optional by acceptance, risk, or policy                   |
| Repository-local meta artifacts             | `.darrow` convention                                        | Useful with explicit schemas and retention policy         |
| Cross-ticket learning                       | Periodic synthesis capability                               | Separate from delivery execution                          |
| Phase state, attempt logs, custom dashboard | Nobody                                                      | Excluded                                                  |

## Ticket and repository intake

`ticket-to-pr` should express the intent to retrieve one authoritative ticket.
It must not know whether Jira, GitHub Issues, Linear, another tracker, or a
host connector fulfills that intent. In the current Darrow environment,
`darrow-tickets` can supply the capability; another installation may provide a
different compatible implementation.

The useful ticket input is intentionally small:

- stable identifier;
- desired outcome or title;
- description and acceptance criteria; and
- canonical link when one exists.

Labels, relations, milestones, and general tracker management are not required
for delivery. A ticket reference that cannot be resolved stops before mutation.
Ticket contents already supplied in the conversation or an authoritative
specification may also provide the input when no tracker lookup is necessary.

Repository selection is similarly narrow:

- use the current repository by default;
- accept another checkout only when the user explicitly supplies its existing
  path or worktree;
- never search the filesystem for likely repositories;
- never clone automatically;
- stop when the target is absent or ambiguous; and
- preserve unrelated local work.

The task branch may be created inside the native goal. An explicitly requested
new worktree likely remains a pre-launch action because the goal must start in
its actual working directory. A resumed invocation may reuse an existing task
branch when its relationship to the ticket is unambiguous. Early existing-PR
detection is a useful optimization, but duplicate prevention at publication is
the required invariant.

## Implementation readiness and planning

Planning and product discovery should remain outside adaptive-goal. A native
implementation goal should not discover what product behavior was intended
while simultaneously building it.

The independently installable
[`darrow-readiness-gate`](../../plugins/darrow-readiness-gate/README.md)
provides the shared seam for tickets, discovery results, plans, specifications,
and explicit goal contracts. Its definition is:

> Ready means an implementation agent can proceed without inventing product
> intent, making an unauthorized architectural choice, or guessing how success
> will be observed.

A useful result contract is:

```text
verdict: ready | needs-discovery | needs-decision | blocked

basis:
  authoritative inputs assessed

quality_bar:
  concrete reference, measurement, behavior, or evidence used to judge success

findings:
  missing, stale, or contradictory information

required_next_action:
  smallest action needed to become ready
```

The assessment should consider:

- desired outcome and observable acceptance criteria;
- sufficiently bounded scope;
- unresolved product or architectural choices;
- contradictions among the ticket, plan, repository rules, and existing
  behavior;
- relevant external dependencies and permissions; and
- a concrete, inspectable quality bar and feasible way to verify the result.

It should not require a formal plan, predetermined files, exhaustive tactical
steps, or the same detail for a mechanical change and a migration.

Discovery and planning capabilities may use the findings to close gaps. They
own their artifacts and user interaction. Material choices remain unresolved
until an authorized user or repository authority selects them.

The ticket-to-PR goal contract can require the environment to invoke a
compatible readiness capability before any mutation. A non-ready verdict stops
that implementation goal; it does not turn adaptive-goal into a discovery or
planning workflow. A ready verdict returns control to the native goal owner
without granting additional authority. Adaptive-goal therefore needs no
built-in awareness of the readiness plugin or its implementation.

## One goal owns the pull-request outcome

The goal handed to adaptive-goal should include publication in its explicit
outcome and permissions:

```text
Outcome:
  One pull request exists that fulfills the ready ticket.

Quality bar:
  The named observable behavior, reference, measurement, and final evidence
  against which the implementation is judged.

Authorized effects:
  - create or reuse one task branch;
  - create intended commits;
  - push that branch; and
  - open exactly one pull request.

Not authorized:
  - merge the pull request;
  - update or close the ticket;
  - release or deploy; or
  - mutate unrelated external state.
```

An N=1 live feasibility experiment on 2026-08-11 validated the publication
slice: one explicitly authorized native goal created an experiment branch,
formatted and validated its artifact, committed, pushed, and opened Darrow
[draft PR #17](https://github.com/BjRo/darrow/pull/17). The PR was then closed
without merging and its local and remote branches were deleted. This proves
that the host can compose the existing Git capabilities to reach a real PR; it
does not validate the full ticket, readiness, implementation, review, or
recovery path.

The experiment prompted a clarification now reflected in adaptive-goal's
normative publication language:

> Adaptive-goal never derives publication authority. A goal may perform
> explicitly pre-authorized publication through installed capabilities. Goal
> completion grants no additional or subsequent external authority.

`adaptive-goal` remains neither a Git implementation nor a publication
mechanism. The native goal asks the environment for branch, commit, push, and
PR capabilities by intent. Explicit invocation of `ticket-to-pr`, rather than
successful implementation alone, supplies the narrow publication authority.

The authoritative wording is maintained in
[`adaptive-goal-loop.md`](../specs/adaptive-goal-loop.md).

## Workflows, risk, and canonical review

Adaptive workflows own implementation discipline and feedback cadence:

- a bug fix reproduces the defect and establishes regression evidence;
- an observable feature or change establishes acceptance evidence at a stable
  seam;
- a refactor characterizes preserved behavior;
- mechanical and documentation work use applicable deterministic checks
  without inventing a red test.

Risk owns proportional scrutiny:

| Risk       | Required scrutiny                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `routine`  | Focused acceptance or characterization evidence plus the scoped repository gate                     |
| `elevated` | Routine gates plus caller or compatibility checks and a plausible counterexample                    |
| `high`     | Elevated gates plus an adversarial boundary or state-transition check and broader final-tree review |

Independent review should have one canonical capability definition reused by
manual review and adaptive execution. The capability remains read-only and
report-only; the adaptive goal owner consumes findings, repairs the change, and
reruns invalidated verification.

The provisional selection policy is:

| Situation     | Canonical review usage                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Routine risk  | Do not invoke automatically                                                                     |
| Elevated risk | Invoke when compatibility, caller impact, or counterexample analysis needs independent judgment |
| High risk     | Invoke by default for broader final-tree review                                                 |
| Any risk      | Invoke when repository policy or the user requires it                                           |

When independent review is selected, fresh context is part of the contract:

- pin the exact diff;
- provide authoritative specification and repository standards;
- provide relevant deterministic check evidence;
- omit the implementation transcript, author rationale, and unrelated context;
- keep the reviewer read-only; and
- rerun review after repairs that invalidate its scope.

A same-context inspection remains useful self-review and verification, but it
does not satisfy the independent review contract. Fresh context reduces
implementation anchoring; using a different model is a separate,
evidence-driven routing choice. Research on intrinsic self-correction and LLM
self-preference supports treating author self-evaluation cautiously:

- [When Can LLMs Actually Correct Their Own Mistakes?](https://aclanthology.org/2024.tacl-1.78/)
- [LLM Evaluators Recognize and Favor Their Own Generations](https://papers.neurips.cc/paper_files/paper/2024/file/7f1f0218e45f5414c79c0679633e47bc-Paper-Conference.pdf)

The current [`code-review.md`](../specs/code-review.md) already implements the
fresh, isolated review shape. A later design change would need to define its
portable capability contract and how adaptive-goal requests it without
referencing or assuming a sibling plugin.

## Resume and recovery without a state machine

Claude and Codex already own session continuation. A replacement or resumed
goal can also reconstruct progress from durable facts:

- current branch and worktree;
- uncommitted changes;
- commits relative to the base;
- remote branch;
- existing pull request; and
- compatible evidence tied to the current revision.

Recovery is state reconstruction, not workflow-stage restoration. A fresh goal
must distinguish observable facts from assumptions. For example, an existing
commit or PR is durable evidence; an unrecorded claim that review or checks
probably passed is not. Checks and reviews are rerun when later edits or an
unknown interruption invalidate their evidence.

The design does not need:

- a JSON phase store;
- phase counters or bounded controller retries;
- restart-from-stage;
- stop files;
- a background process manager; or
- a custom status command.

Host asymmetry is acceptable. Codex currently provides stronger native goal
persistence, while an interrupted Claude foreground run may require a fresh
goal that reconstructs repository and forge state. Darrow should not introduce
a lowest-common-denominator runtime to hide that difference.

## Telemetry, evidence, and repository artifacts

The discussion separates three information planes.

### Execution telemetry

OpenTelemetry and Langfuse support are required, but belong below or alongside
adaptive-goal as environment infrastructure. The host can observe turns,
continuations, effective routes, tokens, cost, tool calls, native child agents,
wall time, interruptions, and failures more accurately than a skill can
reconstruct them.

Adaptive-goal and invoked capabilities should contribute correlation metadata
such as goal kind, ticket, repository, workflow, risk, profile, selected and
effective route, invoked capabilities, terminal outcome, commit, and PR. An
environment adapter exports host events and Darrow semantic records to
OpenTelemetry and optionally Langfuse. Dashboards and execution timelines then
belong to the observability backend rather than a Darrow web application.

### Review evidence

A provisional evidence-capture capability may persist review aids and proof
when acceptance criteria, risk, or repository policy justify them:

- screenshots and before/after comparisons;
- diagrams;
- browser recordings;
- API examples;
- benchmark and test reports;
- migration previews;
- accessibility reports; and
- selected redacted logs.

An evidence manifest should record artifact type, ticket and goal, source
command or capture method, source revision, timestamp, content hash, redaction
status, supported claim, and whether the artifact is directly observed or
derived. A generated diagram may explain a change but must not be presented as
direct proof. Binary size, secret and PII handling, retention, and external
artifact pointers require explicit policy.

### `.darrow` convention

`.darrow` is a plausible home for repository-local meta artifacts and already
has precedent as the adaptive route-configuration location. Configuration and
generated evidence should remain distinct. A provisional shape is:

```text
.darrow/
  config.json
  evidence/
    <ticket-or-goal-id>/
      manifest.json
      screenshots/
      diagrams/
      reports/
  learning/
    2026-W33.md
```

Important constraints include:

- `.darrow/config.json` is authoritative configuration, not generated output;
- evidence uses a stable manifest rather than filename inference;
- artifacts correlate with a ticket, goal, commit, or PR;
- large binaries may need an external store or Git LFS with repository
  pointers;
- only generated artifact paths receive Linguist attribution such as
  `linguist-generated=true`;
- the complete `.darrow` tree must not be marked generated when it contains
  authoritative configuration or curated learning; and
- `.darrow` must not become hidden workflow state.

## Cross-ticket learning

Selected evidence and telemetry should support learning across ticket
boundaries. A periodic synthesis capability is preferable to a mandatory
codification phase on every delivery.

```text
telemetry
+ selected .darrow evidence
+ tickets and PR outcomes
+ recurring review findings
        |
        v
weekly learning synthesis
        |
        v
observations, hypotheses, and improvement proposals
```

Useful questions include:

- Which readiness gaps recur?
- Which checks repeatedly fail late?
- Which review findings escape routine verification?
- Where do goals become blocked or require human intervention?
- Which workflow or risk classifications appear miscalibrated?
- Which repository facts are repeatedly rediscovered?
- Which evidence types materially help reviewers?

The synthesis must distinguish observations, hypotheses, recommendations, and
decisions. Frequency is not authority. Accepted improvements flow through the
appropriate specification, ticket, decision, or repository-guidance capability
only after explicit authorization.

## Features deliberately not reproduced

The proposed design excludes:

- a LangGraph or custom phase controller;
- mandatory plan and plan-review stages;
- separate implementation, review, rework, and QA phase agents;
- evidence-only plan or review commits;
- workflow stage counters and retry budgets;
- restart-from-arbitrary-stage;
- background process management;
- a Darrow execution log or attempt ledger;
- a custom web dashboard; and
- per-stage instruction and model override flags.

User constraints belong in the complete goal contract. Repository instructions
apply through normal scoped routing. Discovery, review, evidence, and Git
capabilities own their focused behavior. Adaptive workflow, risk, semantic
profile, model, and effort replace stage-specific routing.

## Open design questions

1. How reliably does the versioned implementation-readiness result compose in
   larger native goals across Claude and Codex?
2. Which capability identifiers are needed for ticket reading, review,
   evidence capture, branch, commit, and PR operations?
3. Should high-risk adaptive goals require a compatible independent review
   capability, and what is the honest stop behavior when none is available?
4. Which worktree actions must happen before goal launch on each host?
5. Is early existing-PR detection valuable enough to add a read-only Git/forge
   capability, or is duplicate protection at publication sufficient?
6. Where should host telemetry adapters live, and what common correlation
   schema should OpenTelemetry and Langfuse receive?
7. What artifact schema, retention, redaction, binary-size, and external-store
   policies govern `.darrow/evidence`?
8. Which inputs and output authority should a periodic cross-ticket learning
   capability have?
9. How reliably do Claude and Codex match capability intent from inside a
   native goal, especially for fresh-context review and publication?
10. How should readiness represent quality bars that combine deterministic
    thresholds, reference artifacts, and contextual judgment?

## Suggested evaluation

Compare the proposed recipe with the original SDLC workflow and a raw
adaptive-goal control against identical ticket and repository fixtures. Use at
least three trials for decisions intended to change defaults.

Cases should include:

- an implementation-ready routine ticket;
- a ticket with a concrete reference or measurable quality bar;
- a superficially actionable ticket whose quality bar is still vague;
- a ticket requiring discovery or a human decision;
- a dirty checkout and explicitly requested worktree;
- an existing task branch or pull request;
- a seeded defect that proportional verification or review should catch;
- a high-risk boundary requiring adversarial evidence and fresh review;
- an interrupted run resumed by the host;
- a fresh goal reconstructing partial durable state;
- a failed commit, push, or PR operation;
- useful visual evidence and an unsafe artifact containing sensitive data; and
- unavailable capability or route boundaries on Claude and Codex.

Measure:

- ticket and PR outcome correctness;
- escaped defects and false-positive review findings;
- human interventions;
- duplicate or unintended external mutations;
- resume and reconstruction success;
- wall time, tokens, cost, and native agent usage;
- selected versus effective routes;
- evidence usefulness and storage cost; and
- telemetry completeness and correlation accuracy.

The current exploratory orchestration evidence remains relevant context:

- [`2026-08-07-n1.md`](../../evals/experiments/orchestration/snapshots/2026-08-07-n1.md)
- [`2026-08-09-adaptive-goal-sol-baseline-n1.md`](../../evals/experiments/orchestration/snapshots/2026-08-09-adaptive-goal-sol-baseline-n1.md)
- [`2026-08-08-workflow-risk-heldout-n1.md`](../../evals/experiments/orchestration/snapshots/2026-08-08-workflow-risk-heldout-n1.md)

Those snapshots support further investigation of native-goal orchestration but
do not establish ticket-to-PR parity or the 90% claim.

## Suggested next steps

1. Run multi-trial, cross-harness comparisons for implementation-readiness
   composition and the reusable ticket-to-PR goal template.
2. Define the portable review-capability contract and adaptive selection
   policy without introducing a sibling-plugin dependency.
3. Design telemetry correlation and `.darrow` evidence conventions separately
   from the ticket-to-PR recipe.
4. Evaluate the full ticket-to-PR outcome against the static pipeline baseline,
   including resume, failure, risk, and publication cases.
