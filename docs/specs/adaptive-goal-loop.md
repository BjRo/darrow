# Capability: Native Goal Preflight

Darrow turns one bounded engineering request into a compact goal contract and
hands it to exactly one route-selected, host-visible subagent. The parent owns
read-only preflight and launch; the subagent owns implementation, adaptation,
verification, feedback, and completion.

Plugin: `darrow-goal-loop`  
Skill: `adaptive-goal` (Adaptive Goal Loop)

## Why

The useful orchestration work happens before implementation: discovering
repository constraints, making completion observable, selecting a suitable
workflow and risk gate, and choosing a proportionate model and effort. The host
already knows how to execute tools, recover from errors, delegate bounded work,
and continue a conversation.

The product therefore uses this shape:

```text
request + repository -> read-only preflight -> compact contract -> one subagent owner
```

Darrow does not maintain a second execution state machine. In particular, it
does not require the parent or owner to mirror launch, readiness, review,
blockage, continuation, cleanup, or completion into a Darrow ledger. Host
acceptance establishes the owner and its host-native route. Codex receives the
concrete route on the spawn call. Claude resolves a scoped agent whose
frontmatter pins model and effort, rejects higher-priority environment
overrides, and omits a per-call model override. Semantic owner results
establish readiness, review, feedback, blockage, and completion. Transcript
auditing belongs to evaluation and diagnostics, not the live parent workflow.

## Selected design

`adaptive-goal` is an explicitly invoked goal compiler and launcher.

1. The parent performs read-only preflight in the current repository.
2. When readiness is selected, the parent invokes the advertised readiness
   capability and resolves its findings with the user before implementation.
3. It binds every required operation to any matching host-advertised capability
   and compiles one compact, self-contained goal contract.
4. It resolves one concrete route from the selected semantic profile.
5. It starts exactly one host-visible subagent on that route.
6. That subagent becomes the sole Darrow work owner and follows the contract to
   completion, a user-feedback pause, or a genuine blocker.
7. The parent only waits, relays feedback to the same owner, and returns the
   owner's result. It does not run post-launch shell checks, implement, verify,
   or reconstruct the engineering result.

The accepted subagent task is the native goal boundary. A Codex subagent does
not create another nested goal, and a Claude Agent does not claim session-level
`/goal` persistence. The owner may use ordinary host-native delegation for a
bounded subtask, but it remains responsible for the complete contract and must
not start another adaptive-goal owner.

## Invocation authority

The skill starts only when:

- the user explicitly invokes adaptive-goal orchestration;
- an explicitly invoked orchestration entrypoint delegates one bounded request
  while preserving the originating scope and permissions; or
- unambiguous feedback in the same host thread targets the retained preflight
  or owner, including corrections, constraints, cancellation, and status requests.

Complexity, duration, and ordinary engineering intent do not authorize
orchestration. A fresh conversation, an ambiguous answer, or multiple plausible
owners supplies no continuation authority.

Explicit invocation does not imply implementation intent. When the user asks
only for explanation, comparison, or lifecycle guidance, answer that question
without compiling or launching an engineering goal.

Without invocation authority, the skill performs no helper call or mutation
and returns:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## Read-only preflight

Before the owner is accepted, the parent may inspect the request, repository
state, applicable instructions, accepted decisions, manifests, CI
configuration, and focused test surfaces. It may run the bundled `goal-loop
prepare` and `goal-loop route` commands and invoke selected read-only input
gathering and implementation-readiness capabilities. Retrieve necessary
authoritative input before classification; preserve the returned evidence.

It must not:

- edit product or test files;
- execute tests, builds, typechecks, lints, reviews, or verification commands;
- invoke implementation or review agents;
- acquire a missing product decision by guessing; or
- perform an external publication or other requested effect.

Imperative implementation and verification language in the request belongs in
the owner contract. It does not authorize the parent to perform that work.
Pre-existing working-tree changes are user-owned and must be named in the
contract when they overlap the task.

If a material product choice, permission, destructive scope, security policy,
or publication authority is missing before launch, ask the smallest concrete
question and do not start the owner.

## Goal contract

The contract is self-contained and concise. It contains, in plain language:

- the outcome and observable acceptance criteria;
- scope, non-goals, preserved local work, and permissions;
- the selected workflow and risk;
- the implementation sequence from the selected workflow;
- focused feedback checks and final-tree checks;
- the readiness result or the reason readiness was omitted;
- the independent-review selection and its continuation rule;
- the exact capability bindings for matching implementation operations;
- the human-feedback rule;
- publication limits and the completion evidence to return; and
- the selected model route and any explicit stopping budget.

The seven-field template covers role, outcome, acceptance, scope and authority,
execution, verification and gates, and completion evidence. Equivalent clear
prose, line wrapping, punctuation, and role wording are valid. Keep the exact
workflow identifier distinct from its implementation steps and preserve scope,
permissions, gates, capability bindings, and concrete route. The shipped skill
does not provide a host contract validator. An eval guard may enforce a stricter
structured template as a separately identified diagnostic condition; its
rejections do not define product behavior.

The contract must be understandable without another Darrow file except the
selected workflow document, which the parent reads and incorporates before
launch. Target a task body small enough to pass inline to the host tool. If the
complete contract cannot fit the active host's task input without dropping a
material requirement, stop as `launch_required`; do not truncate or create a
protocol for out-of-band objective persistence.

## Capability bindings

Before launch, enumerate the exact operations in the authorized contract. For
each operation whose intent matches a host-advertised skill, bind that operation
to the exact advertised skill name. Include those bindings in the owner
contract. Typical bindings include ticket reads and updates, TDD, commits, pull
requests, and independent code review.

Readiness and necessary read-only input gathering may run during preflight.
Preserve completed input evidence and bind any necessary refresh. Implementation,
verification, review, and publication bindings run in the owner when due.
The owner must follow the bound
skill before performing that operation; a direct shell, Git, forge, tracker,
or generic subagent call is not a substitute. A refusal or unavailable bound
skill stops that operation without expanding authority.

Intent matching is candidate discovery, not complete behavioral compatibility.
Check required prerequisites, effects, evidence and stop conditions against the
bound skill's public contract before the operation. Preserve compatible
replacement skills by intent rather than plugin identity. A mismatch returns
to the owner for an authorized compatible path or a blocker; it never licenses
bypassing the bound operation's refusal through raw tools.

For authorized create-or-reuse publication, require evidence that exactly one
open PR has the intended repository, head/base and draft state and that its
forge head and remote branch equal the intended verified commit. An existing
URL without current-content evidence cannot complete the goal. The capability
owns publication mechanics; the owner ties its result to final assurance.

Bindings are derived only from the active host's advertised skills. Do not
invent a skill, assume a sibling plugin is installed, or bind an unrelated
capability merely because it is available. An operation with no matching
advertised skill remains ordinary owner work unless the user, repository, or
selected gate explicitly requires such a capability; a required missing
capability stops before launch.

Publication operations are included only when explicitly authorized. For
example, an authorized commit and pull request become separate bindings when
separate matching skills are advertised. Completion never makes either
operation implicitly due.

## Workflow and risk

Select exactly one workflow:

- `fix-bug`: existing promised behavior is incorrect.
- `implement-feature`: new observable behavior does not exist.
- `change-feature`: approved existing behavior intentionally changes.
- `refactor`: observable behavior must remain unchanged.
- `migration`: consumers or formats require a sequenced transition.
- `mechanical`: an exact deterministic non-behavioral transformation has a
  complete oracle.
- `decision-gated`: implementation requires a missing decision or authority;
  do not launch.

Apply these tie-breakers in order:

1. `decision-gated` wins for a known missing choice or authority.
2. `migration` requires a sequenced coexistence or rollout; otherwise an
   intentional contract change is `change-feature`.
3. `fix-bug` repairs an existing promise; `change-feature` changes it.
4. `implement-feature` applies only when equivalent behavior does not exist.
5. Observable contract changes are not `mechanical`.
6. `mechanical` requires a complete oracle; judgment-preserving restructuring
   is `refactor`.
7. `refactor` preserves observable behavior.

Select risk from consequences, taking the highest applicable level:

- `routine`: localized, reversible, and limited blast radius;
- `elevated`: compatibility concerns, multiple consumers, persisted formats,
  or meaningful operational impact;
- `high`: security or authorization boundaries, destructive or irreversible
  state, privacy or safety, or broad blast radius.

Reasoning difficulty does not change consequence risk.

## Profile and route

Classify reasoning demand independently:

- `routine`: clear localized work or an exact mechanical transformation;
- `routine-plus`: localized work with materially competing implementations or
  an explicit first-pass boundary-correctness priority;
- `scaled`: straightforward work spanning several components;
- `repo-wide`: straightforward repository-wide work;
- `judgment`: an unresolved cause across plausible layers or work requiring
  architecture, planning, or review judgment.

Use the bundled route policy unless the user explicitly supplied a concrete
host-supported model and effort. Such a user override need not appear in the
policy catalog; the host launch remains its final availability check.
Repository route overrides apply only through the documented
`.darrow/config.json` surface. Invalid or unreadable owned configuration stops
launch rather than falling back silently.

Route binding is host-specific:

- Codex: one accepted subagent spawn with the selected concrete model and
  reasoning effort.
- Claude: the bundled resolver validates one scoped agent whose frontmatter
  pins the selected model and effort and rejects higher-priority environment
  overrides. The foreground Agent call omits a per-call model override, so
  native host precedence applies that definition.

If route resolution or launch is rejected or unavailable, stop as
`launch_required`; do not retry with a different owner or silently downgrade.
An eval harness may independently audit the child's transcript to detect a host
regression, but that observation does not add a post-launch product step.

## Readiness

Select implementation readiness separately:

| Situation                                                         | Selection                         |
| ----------------------------------------------------------------- | --------------------------------- |
| Unassessed authoritative ticket, specification, or accepted plan  | selected                          |
| Fully bounded conversational request                              | omitted by default                |
| Same scope already assessed and resolved                          | omitted                           |
| Material scope or constraint change where reassessment adds value | selected                          |
| Explicit user request to skip the default gate                    | omitted unless policy requires it |
| User, repository, or delegating-orchestration requirement         | selected                          |

When selected, the parent binds and invokes the matching advertised capability
during read-only preflight. It preserves the capability's complete
human-readable result. Only a semantic `ready` result permits owner launch.
`needs-discovery`, `needs-decision`, or `blocked` returns the complete result,
surfaces the smallest unresolved questions, and leaves the product tree
unchanged. The returned capability result starts the response unchanged, with
no preamble or summary; the parent may append the smallest unresolved questions
after that complete result.

After the user resolves those findings, the same adaptive-goal preflight invokes
the readiness capability again for the same scope. Repeat only while the result
materially changes and concrete findings remain; never infer answers or launch
on a non-ready result. Once ready, compile the settled readiness evidence and
decisions into the owner contract so implementation does not reopen them.

No Darrow helper call records the verdict. The capability result and the fact
that no owner launched before `ready` are the evidence.

“Already assessed” is semantic and scope-specific. A readiness result preserved
in the current context counts when it covers the exact implementation scope and
every finding has been resolved, even if no standalone readiness artifact was
written. Do not invoke readiness again merely because the goal is now being
launched. Reassess only after a material change to scope, acceptance,
constraints, or authoritative input, or when an explicit user or repository
rule requires another assessment.

If a material readiness finding appears after launch, the retained engineering
owner pauses affected implementation and invokes bound or newly necessary
advertised readiness under the same selection rules, even if initially omitted.
A non-ready result returns to that same owner. It may investigate
within authority or relay a material question through the parent; after findings
are resolved it obtains required ready evidence before continuing. The parent
does not take over preflight, launch another owner, or perform the investigation.

## Independent review

Select independent review separately:

| Situation     | Selection                                                                                |
| ------------- | ---------------------------------------------------------------------------------------- |
| Routine risk  | omitted by default                                                                       |
| Elevated risk | selected when compatibility, caller impact, or counterexamples need independent judgment |
| High risk     | required; an unavailable matching capability stops before owner launch                   |
| Any risk      | selected when the user or repository requires it                                         |

The parent binds the exact matching advertised skill before launching an owner
whose contract requires review. An ad hoc prompt, generic subagent, or
same-context judgment is not a substitute.

Review availability is a parent preflight gate, not owner work. Before any
owner launch, the parent must identify the exact advertised skill for every
selected review. If it cannot, it returns `Status: launch_required` and makes
no product mutation. It never launches an owner to discover the absence or to
perform a self-review, separated local review, or generic-agent substitute.

A clear or localized implementation does not make a high-risk change eligible
to omit review. A stronger user or repository rule may stop implementation
before launch, but it does not turn the required review into an omission.

The owner invokes the matching capability only after implementation and every
applicable current final-tree check succeeds. Merely running a required check
does not satisfy this dependency. If a required check fails, the owner repairs
within existing authority and reruns invalidated checks, or stops before
review, commit, and publication. It supplies the exact current change,
originating authority, repository standards, and successful check evidence. A
clear result satisfies the review gate for that content, but cannot waive a
failed required check. A blocking result prevents completion and publication.

When existing authority covers repair, default to one closed-set repair and
one fix verification after invalidated checks. An explicit finite nonnegative
integer user or repository repair budget may change that limit. Apply the
strictest applicable invocation, time, token, and authority limit. Additional
attempts require the preceding verification to show resolved original blockers
or changed evidence narrowing their cause. Only clear current-content evidence
satisfies the gate. Unchanged, unavailable, inconclusive, out-of-scope, or
exhausted evidence stops completion and remaining publication. Keep the original
finding set plus direct repair-caused regressions closed.

No Darrow helper call records review targets or outcomes. The independent
capability's returned result, the final content, and the owner's summary are the
evidence.

## Owner lifecycle

### Launch

The parent launches exactly one adaptive-goal owner. Its task begins with:

```text
- phase: adaptive-goal-owner
```

The complete contract follows inline. A marker without the complete contract
is invalid. Its first contract field tells the subagent that it is already the
accepted sole owner. Parent-facing clauses that requested route selection or
owner launch are not copied into its engineering outcome. The owner does not
repeat preflight, invoke `adaptive-goal`, create another adaptive owner, or
create a second nested goal for the same contract.

After launch acceptance, the parent performs no repository or external work.
It may only wait, relay user feedback or request status from the same owner, or stop that
owner after explicit abandonment or supersession.

### Human feedback

When a material decision first emerges after launch, the owner pauses mutation
and returns the smallest complete question as its paused result. The question
needs no lifecycle marker or canonical serialization.

The parent surfaces the question and retains the same owner. A later explicit
answer is relayed verbatim to that owner. No lifecycle marker or fixed display
summary is required.

The answer grants only explicitly supplied authority. The same owner performs any required
acknowledgement before resuming mutation. Pending feedback is neither
completion nor a terminal blocker, and no replacement owner is launched.

Corrections, added constraints, cancellation, and status requests also reach
the retained owner without requiring a pending question. Restrictions apply
before the next affected action. Status alone does not cancel execution.
Cancellation stops further work and reports already performed effects. Report
host transport or stopping limitations without claiming an unobserved stop.

### Blockage

When work cannot proceed without a state change outside the owner's authority,
the owner returns a concise semantic record:

```text
Status: blocked
Blocker: <specific condition>
Evidence: <current evidence or none>
Next action: <smallest action that could unblock the goal>
```

There is no Darrow retry, waiver, digest, or blocker-transition protocol. A
later user response may resume the same retained owner when it clearly resolves
the blocker. Before repeating an external effect whose result was ambiguous,
the owner observes current external state and does not duplicate an effect that
already completed. An unchanged deterministic failure is not retried without
changed evidence or conditions. These are owner safety duties, not ledger
states.

If the host cannot retain or resume the owner, report that limitation
truthfully. A fresh adaptive-goal invocation may use current repository and
external state but is a new owner and receives no implicit continuation
authority.

### Completion

The owner returns concise human-readable evidence:

- whether the requested outcome is complete, awaiting feedback, or blocked;
- changed files or an explicit statement that none changed;
- focused and final verification evidence;
- readiness and review outcomes when selected;
- performed publication effects, if any; and
- remaining risks or blockers.

Workflow, risk, semantic profile, and selected route are already established at
the launch boundary and need not be echoed in completion prose. They may be
included for readability, but completion does not depend on their formatting or
restatement.

The parent relays those facts without reconstructing them or running additional
checks. No exact serialization, canonical report prefix, route telemetry row,
child counter, or interruption counter is required. Goal completion grants no
new authority.

## Host launch boundaries

### Codex

Use one first-class host-visible subagent with `fork_turns: none`, the selected
concrete model and reasoning effort, and the complete ownership-marked contract.
The canonical reference returned by the accepted launch identifies the owner
for waiting, feedback, and cleanup; a caller-selected task name is optional.
Do not call `create_goal` inside that subagent for the same contract. Do not
spawn a replacement after acceptance.

### Claude

Resolve one route-specific plugin agent whose frontmatter pins the selected
model and effort, then invoke it once in the foreground with the complete
ownership-marked contract. Use the returned agent id for feedback continuation.
The resolver rejects conflicting environment overrides and the Agent call
omits a per-call model override, leaving the scoped agent frontmatter as the
native route binding. Do not invoke Agent again for the same goal. A later
continuation targets the returned owner id.

### Unavailable launch

If the selected owner boundary or a selected readiness/review capability is
unavailable, preserve the product tree and return:

```text
Status: launch_required
Reason: <specific unavailable boundary or capability>
Selected route: <provider/model/effort>
```

The unavailable boundary must be clear; this status block is an example.

Nested host processes are not an adaptive-goal fallback.

## Invariants

1. **AGL-P1 — Explicit activation.** Ordinary engineering intent never starts
   adaptive-goal orchestration.
2. **AGL-P2 — Read-only preflight.** Product mutation and verification begin
   only in the accepted owner.
3. **AGL-P3 — Preserved authority.** Delegation and activation add no
   permissions or publication authority.
4. **AGL-P4 — One bounded contract.** The owner receives the complete request,
   acceptance, scope, gates, checks, and authority inline.
5. **AGL-C1 — One workflow and risk.** Classification follows the documented
   tie-breakers and consequence model. The launch contract keeps the exact
   workflow identifier separate from its implementation sequence.
6. **AGL-R1 — Concrete selected route.** Policy or an explicit user override
   resolves to one host/provider/model/effort tuple before launch.
7. **AGL-R2 — Native route binding.** Codex launches with an explicit spawn
   tuple. Claude resolves a scoped agent with the selected model and effort,
   rejects higher-priority environment overrides, and launches without a
   per-call model override. Transcript auditing is evaluator-owned and never a
   parent workflow step.
8. **AGL-L1 — One Darrow owner.** Exactly one route-selected subagent owns the
   complete run. It creates no replacement adaptive owner or nested goal for
   the same contract.
9. **AGL-L2 — Semantic gates.** Readiness completes before launch; every
   applicable current check succeeds before review and every dependent commit
   or publication effect; review runs inside the owner and cannot waive a
   failed check. The gates are proven by capability results and observable
   repository behavior, not bookkeeping transitions.
10. **AGL-L3 — Same-owner feedback.** Questions, answers, steering, cancellation,
    and status requests remain attached to the accepted owner when supported.
11. **AGL-L4 — Semantic blockage.** A blocker names its condition, evidence,
    and next action without a Darrow retry state machine.
12. **AGL-L5 — Owner-sourced completion.** The parent relays the owner's
    changed-file, verification, review, publication, and residual-risk facts.
13. **AGL-S1 — No inferred decisions.** Missing product, safety, destructive,
    privacy, or authority choices stop before the affected mutation.
14. **AGL-S2 — No duplicate external effect.** An ambiguous external result is
    observed before another attempt.
15. **AGL-S3 — No derived publication.** Completion or review clearance adds no
    commit, push, pull-request, merge, release, or deployment authority.
16. **AGL-C2 — Intent-bound capabilities.** Every authorized operation with a
    matching advertised skill is bound before launch and must use that skill;
    direct tools are not a substitute.
17. **AGL-X1 — No lifecycle ledger.** Adaptive-goal ships no required run
    ledger, lifecycle hook, blocker protocol, canonical helper report, or
    model-operated transition sequence.
18. **AGL-E1 — Evidence-appropriate evaluation.** Adaptive-goal evals prove
    repository and external effects with passive fixture event logs under
    `.git/fixture-state/`, exact public tokens with rigid output checks, and
    paraphrasable prose contracts with fail-closed semantic output checks.
    Owner-boundary guards ignore only the named readiness preflight traces in
    that ledger; all product-tree and other fixture-state changes remain
    protected before owner launch.

## Packaging and portability

The bundled helper may prepare deterministic repository evidence and resolve a
configured route. It does not launch models, persist objectives, record owner
lifecycle, render completion, or supervise work. Plugin-shipped scripts remain
portable across Bash 5 and macOS Bash 3.2 and use only baseline Unix utilities
plus the host CLIs they explicitly wrap.

Every required runtime file remains inside the plugin. Bundled helpers are
resolved without filesystem search: Claude uses its host-substituted plugin
root, and Codex uses the absolute path of the SKILL.md it activated. An
unavailable or non-executable helper stops honestly instead of falling back to
a similarly named binary. Optional capabilities are selected through
host-visible intent and are never accessed through sibling plugin paths.

## Evaluation requirements

### Adaptation and evaluation fidelity (#102)

The following invariants govern adaptation and evidence provenance:

- **AGL-A1 — Owner reassessment.** Material changes invalidate only affected
  assumptions, readiness, and verification evidence. The retained owner pauses
  affected implementation, invokes necessary advertised read-only readiness,
  and strengthens checks within existing scope and authority. Required ready
  evidence must precede resumed implementation. Missing product decisions or
  expanded effects require the user's answer; the parent never takes over.
- **AGL-A2 — Execution steering.** Unambiguous same-thread corrections, added
  constraints, cancellation, and status requests reach the retained owner even
  without a pending question. A status request does not cancel execution.
  Restrictions apply before the next affected action; cancellation stops work
  and reports already performed effects. Unsupported live delivery is reported
  honestly, without a replacement owner or a claim that cancellation succeeded.
- **AGL-A3 — Read-only input gathering.** Before classification and launch, the
  parent may invoke necessary advertised read-only capabilities to retrieve
  authoritative input, including a referenced ticket. Preserve their evidence
  and bind future operations by intent. Retrieval grants no mutation authority.
- **AGL-A4 — Budgeted closed-set repair.** Default to one repair plus one fix
  verification. An explicit finite user or repository budget may allow more;
  each additional attempt requires changed evidence showing material progress
  against the original blockers or direct repair regressions. Unchanged,
  inconclusive, unavailable, out-of-scope, or exhausted evidence stops affected
  work and publication. Only clear verification of current content clears the
  gate. The same owner applies the limit; no parent repair controller is added.
- **AGL-A5 — Semantic presentation.** The seven contract fields are a
  completeness template. Equivalent clear prose, line wrapping, punctuation,
  status presentation, and role wording are valid. Preserve exact tool keys,
  route identifiers, and the owner task marker consumed by the owner interface.
  No runtime contract validator or mandatory closing disclaimer is claimed.
- **AGL-E2 — Enforcement provenance.** Retain whether candidate execution used
  active eval enforcement or passive observation. Passive trials install no
  adaptive-goal guard, rewrite no launch input, and block no candidate operation
  for product-policy compliance. Ordinary fixture isolation remains in both
  conditions. Unknown or incomplete observation proves no missing fact.
  Compare direct execution and preflight on the same fixtures and model/effort
  routes separately from comparisons changing routes; report sample sizes,
  outcomes, timing, token-accounting completeness, and limitations.

Behavior evals verify outcomes and public boundaries rather than private
reasoning or bookkeeping. At minimum, cover:

- direct explicit invocation;
- delegation from an explicitly invoked orchestration entrypoint;
- ordinary engineering intent that must not activate;
- advice-only explicit invocation that must not launch;
- missing preflight decision that stops before launch;
- each workflow tie-breaker and risk boundary;
- one accepted Codex owner and one accepted Claude owner;
- no `goal-loop step` calls and no nested `create_goal` for the same contract;
- readiness selected, omitted, iterative non-ready, and unavailable behavior;
- review selected, omitted, clear, blocking, and unavailable behavior;
- exact intent-based capability invocation for ticket, Git, review, and other
  advertised operations;
- same-owner human-feedback relay;
- semantic blockage and observe-before-retry behavior;
- preservation of local work and publication authority; and
- focused versus final verification cadence.

Across the full adaptive-goal suite, sentence-shaped propositions must not be
encoded as synonym lists, bounded-gap regexes, or lookarounds. Passive fixture
observations live only under `.git/fixture-state/`; they are test evidence, not
a product lifecycle ledger. Semantic gates remain active when the advisory
quality judge is disabled and are exercised against faithful paraphrases,
negation, contradiction, malformed results, and grader unavailability.

Use the native harness for each host claim. Develop behavior changes from
matched evidence and report trial count, outcomes, tokens, wall time, and
limitations. A model deviation in hidden telemetry is not a product failure
unless it violates an observable owner, authority, safety, gate, or outcome
invariant.

## Non-goals

- A planner/executor/verifier controller or Darrow repair loop.
- A daemon, queue, scheduler, workflow database, lifecycle ledger, or canonical
  telemetry protocol.
- Reimplementing native goal persistence inside the selected subagent.
- Unbounded child-transcript inspection or reconstruction of owner work; the
  narrow Claude model/effort observation is required host evidence.
- Nested Codex or Claude processes.
- Parallel candidate implementations or replacement adaptive owners.
- Review or readiness judgment inside adaptive-goal.
- Publication authority derived from goal completion.
