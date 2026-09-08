---
name: adaptive-goal
description: Start only for explicit adaptive-goal orchestration, preserved delegation from an invoked orchestration, or an unambiguous same-thread continuation of that orchestration. Then compile one bounded engineering request after any required readiness discussion and launch exactly one route-selected subagent owner with intent-matched capability bindings. Never select for ordinary engineering intent, regardless of complexity or duration.
---

# Adaptive Goal

Prepare the goal, bind matching skills, launch one separate owner, and let that
owner do the work. Darrow maintains no lifecycle ledger.

## 1. Confirm authority and requested outcome

Proceed only when:

- the user explicitly invoked adaptive-goal;
- an explicitly invoked orchestration entrypoint delegated one bounded request
  while preserving its scope and permissions; or
- unambiguous same-thread feedback targets the retained preflight or owner,
  including an answer, correction, added constraint, cancellation, or status request.

Complexity and duration do not authorize orchestration. A fresh conversation,
ambiguous answer, or multiple plausible owners supplies no continuation
authority. Delegation adds no permission, publication, or destructive authority.

Explicit invocation may request advice rather than engineering work. When the
user asks only for an explanation, comparison, or next-lifecycle-action answer,
answer directly without preflight helpers or an owner.

Without authority, make no helper call or mutation and return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Prepare read-only

Resolve the repository, then bind the bundled helper without searching:

- Claude: use `${CLAUDE_PLUGIN_ROOT}/bin`; Claude substitutes the active
  plugin's absolute root in skill content.
- Codex: use the `bin` directory two levels above the absolute `SKILL.md` path
  that Codex activated for this skill.

Require the resulting `goal-loop` path to be an executable regular file. Do not
scan the repository, plugin caches, home directory, `PATH`, or machine for an
alternative. If the host does not expose the active plugin path or the exact
helper is unavailable, return `Status: launch_required` and make no mutation.
Describe the unavailable launch boundary clearly, for example with
`Status: launch_required`.

Then run:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Use the returned repository, working-tree state, instruction, workflow, and
route records. Read applicable repository instructions and only the additional files
needed to understand scope, checks, authority, or a material decision.

Until the owner is accepted, do not edit product or test files and do not run a
test, build, typecheck, lint, review, or implementation command. Compile those
commands for the owner. Preserve all existing work as user-owned.

Turn the request into observable acceptance criteria without choosing missing
product behavior. If a required product, security, destructive-scope,
publication, or permission decision is missing, ask the smallest concrete
question and do not launch.

When authoritative input is missing, invoke the necessary host-advertised
read-only capability before selecting readiness, acceptance, risk, workflow,
or route. For example, retrieve a referenced ticket through its matching read
skill. Check that the operation is read-only, preserve its complete evidence,
and stop dependent preflight if it refuses. Do not ask the owner to discover
the request after launch. Input gathering grants no mutation authority.

## 3. Resolve readiness before launch

Select readiness semantically:

| Situation | Selection |
| --- | --- |
| unassessed authoritative ticket, specification, or accepted plan | select |
| complete bounded conversational request | omit by default |
| same scope already assessed and every finding resolved | omit |
| material scope, acceptance, constraint, or authoritative-input change | select again |
| user asks to skip the default gate | omit unless explicit policy requires it |
| user, repository, or delegating orchestration requires it | select |

A readiness assessment preserved in this conversation counts for the exact
scope it assessed. Do not rerun it merely because implementation is about to
start or because no standalone artifact was written.

When selected, identify the exact host-advertised skill matching implementation
readiness and invoke it now, while preflight remains read-only. Preserve its
complete human-readable result.

- `ready`: continue preflight and compile the settled result into the contract.
- `needs-discovery`, `needs-decision`, or `blocked`: return the complete result,
  surface its smallest unresolved questions, and launch no owner.

For a non-ready result, put the complete capability result at the start of the
response unchanged. Do not add a preamble, summarize it, or paraphrase any
section. Append only the smallest unresolved questions after the complete
result when clarification is still needed.

After the user resolves the findings, invoke readiness again for the same scope.
Repeat only while concrete findings materially change; never infer an answer or
launch on a non-ready result. If required readiness has no matching advertised
skill, return `Status: launch_required` with the missing capability and make no
mutation.

## 4. Select workflow, risk, profile, and review

Select exactly one workflow and read its linked document completely:

- [`fix-bug`](references/workflows/fix-bug.md): repair behavior that violates an
  existing promise.
- [`implement-feature`](references/workflows/implement-feature.md): add behavior
  that does not exist.
- [`change-feature`](references/workflows/change-feature.md): intentionally
  change approved existing behavior.
- [`refactor`](references/workflows/refactor.md): preserve observable behavior.
- [`migration`](references/workflows/migration.md): sequence coexistence,
  consumer, or format transition.
- [`mechanical`](references/workflows/mechanical.md): perform an exact
  non-behavioral transformation with a complete oracle.
- `decision-gated`: a required choice or authority is missing; ask before launch.

Tie-break in this order: missing decision; migration over change only for a
sequence; change over bug when the approved contract changes; feature only when
equivalent behavior is absent; observable changes are not mechanical;
mechanical requires a complete oracle; refactor preserves behavior.

Select consequence risk:

- `routine`: localized, reversible, limited blast radius;
- `elevated`: compatibility, several consumers, persisted formats, or meaningful
  operational impact;
- `high`: security or authorization, destructive or irreversible state,
  privacy, safety, or broad blast radius.

Select the independent-review gate separately:

- routine: omit by default;
- elevated: select when compatibility, caller impact, or counterexamples need
  independent judgment;
- high: required;
- any risk: select when the user or repository requires it.

When selected, bind the exact advertised skill matching independent review of
the final code change. If none exists, stop before owner launch. The owner runs
it only after implementation and every applicable current final check
succeeds. Merely running a required check does not satisfy this dependency. A
clear result completes the review gate for that content, but cannot waive a
failed required check. A blocking result permits one authorized closed-set
repair and one fix verification by default. An explicit finite repair budget
may permit further attempts with material progress; only clear verification
permits completion. Read
[`references/review-lifecycle.md`](references/review-lifecycle.md) completely
when review is selected.

Never omit review for a high-risk change merely because its implementation is
clear or localized. A stronger user or repository rule may stop implementation
before launch, but it does not turn the required review into an omission.

Treat review availability as a parent preflight gate. Before any owner launch,
identify the exact advertised skill for every selected review and bind that
exact name. If none exists, return `Status: launch_required` with `Reason:
required independent-review capability unavailable`, make no mutation, and do
not call a generic subagent. Never launch an owner to discover the absence or
to substitute self-review, separated local review, or generic-agent review.

Classify reasoning demand independently:

- `routine`: clear localized or exact mechanical work;
- `routine-plus`: localized work with materially competing implementations or
  an explicit first-pass boundary-correctness priority;
- `scaled`: straightforward multi-component work;
- `repo-wide`: straightforward repository-wide work;
- `judgment`: unresolved cause across plausible layers or architecture,
  planning, or review judgment.

An explicit user model and effort wins only when the model is eligible for
adaptive-goal ownership. A Codex `gpt-5.6-luna` route is not owner-capable and
must be rejected; Luna remains available for explicit leaf work outside this
orchestration. Otherwise resolve the policy route:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop route \
  --repo <absolute-repository> --host <codex|claude> --profile <profile> \
  [--route 'harness|provider|model|effort']
```

Pass `--route` only for an exact user override. Invalid or unreadable route
policy stops launch; do not fall back silently.

## 5. Bind intent-matched skills

Enumerate the exact authorized operations in the goal. For each operation whose
intent matches a host-advertised skill, record the exact advertised skill name
as a required capability binding. Common examples include ticket reads and
updates, TDD, commits, pull requests, and independent review.

Readiness and necessary read-only input gathering are invoked by the parent
before launch. Preserve completed input evidence in the contract and bind any
needed refresh. All implementation, verification, review, and publication
bindings are invoked by the owner when due. A direct shell, Git, forge,
tracker, or generic-subagent call is not a substitute for a bound skill. If the
skill refuses or becomes unavailable, stop that operation without expanding
authority.

Before an operation becomes due, check the bound skill's public prerequisites,
effects, returned evidence and stop conditions against the goal. Advertised
intent alone does not prove behavioral compatibility. Accept differently named
compatible skills; resolve a known mismatch before mutation. Return a refusal
to the owner for an authorized next action, never bypass it through raw tools.

Invoking a bound skill or receiving a zero exit status proves neither that its
substantive contract was satisfied nor that a dependent operation is due.
Validate the returned evidence against the bound skill and goal contract before
continuing. A successful review or publication response cannot replace missing
or failed verification evidence.

For authorized PR creation or reuse, require the publisher to return evidence
for the intended verified commit: exactly one open PR, repository, head/base,
draft state, and matching remote and forge head commit IDs. An existing URL
alone cannot prove unpublished local commits were delivered. Explicit reuse
and non-force push authority permits content publication, not metadata updates.

Do not invent bindings or assume sibling plugins exist. An operation without a
matching advertised skill remains ordinary owner work unless the request,
repository, or selected gate requires that capability. Bind publication
operations only when each effect was explicitly authorized; completion never
adds commit, push, pull-request, merge, release, or deployment authority.

## 6. Compile one inline contract

Write a concise, self-contained contract containing:

- outcome and observable acceptance criteria;
- scope, non-goals, preserved work, permissions, and publication limits;
- the exact workflow identifier, its selected sequence, risk, profile, selected
  route, and any explicit budget;
- focused feedback checks and final-tree checks;
- readiness evidence or the reason it was omitted;
- independent-review selection and bound skill when selected;
- every required capability binding;
- the human-feedback and blocker rules below; and
- the completion evidence the owner must return.

Separate engineering intent from orchestration mechanics. Any request clause
that invokes adaptive-goal, asks the parent to select a route, or asks it to
launch a separate owner is consumed by this preflight and launch. Do not copy
that clause into the engineering outcome, acceptance criteria, or workflow
sequence; the launched subagent must understand that it is already the owner.

Use these seven fields as a completeness template. Equivalent clear prose,
role wording, punctuation, and line wrapping are valid; this is not a shipped
host validator. Set `workflow` to exactly one
selected identifier: `fix-bug`, `implement-feature`, `change-feature`,
`refactor`, `migration`, or `mechanical`. Put the compact workflow steps in
`sequence`; keep the identifier distinct from the steps:

```text
Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.
Outcome: <bounded result>
Acceptance criteria: <observable outcomes>
Scope and authority: included=<files and operations>; authorized=<local and external effects>; forbidden=<non-goals and excluded effects>; preserve=<user-owned state>
Execution: workflow=<exact workflow identifier>; sequence=<compact workflow steps>; risk=<routine, elevated, or high>; profile=<selected profile>; route=<host|provider|model|effort>; capabilities=<operation -> exact advertised skill; or none>
Verification and gates: readiness=<evidence or omitted reason>; adaptation=<same owner pauses affected implementation and invokes required readiness for material changed scope, then strengthens affected checks within authority>; review=<bound skill and finite repair budget, or permitted omission>; focused=<feedback checks>; final=<final-tree checks>; feedback=<same owner receives answers, corrections, constraints, cancellation and status; verify new restrictions before completion>; blockers=<semantic blocker and observe-before-retry rule>
Completion evidence: state whether complete, awaiting feedback, or blocked; include=<changed files, focused and final verification, selected readiness and review outcomes, publication effects, and remaining risks or blockers>
```

Feedback checks exercise the changed seam after coherent slices. Final-tree
checks are the applicable repository gate plus:

| Risk | Required final evidence |
| --- | --- |
| routine | focused evidence and scoped repository gate |
| elevated | routine evidence plus affected-caller or compatibility checks and one counterexample |
| high | elevated evidence plus an adversarial boundary or state-transition check and independent review |

Every required focused and final check must succeed against the applicable
current content before review and before any dependent commit or publication
effect. If one fails, repair within existing scope and authority and rerun the
invalidated checks. Otherwise stop before those dependent operations. Do not
consume a one-commit allowance with content whose required checks are failing.

When a stable seam and independent oracle exist, behavior-changing workflows
add or update focused evidence before the production change and confirm the
expected failure. Repository-mandated cadence wins.

Compile this human-feedback rule: a material decision first discovered after
launch pauses repository and external mutation. The owner returns the smallest
complete question as its paused result; no lifecycle marker is required. The
parent relays the explicit answer verbatim to the same owner, with no lifecycle
marker or fixed display summary. The answer grants only explicitly supplied authority, and
the owner performs any required acknowledgement before mutation. Never choose
a default or launch a replacement owner.

Compile this blocker rule: when work cannot proceed without an external state
change, return `Status: blocked` with the specific blocker, current evidence,
and smallest next action. Before repeating an ambiguous external effect,
observe current state and never duplicate an effect that already completed. Do
not retry an unchanged deterministic failure without changed evidence or
conditions. There is no Darrow retry or waiver state machine.

Compile this adaptation rule: after a material scope, acceptance, constraint,
or authoritative-input change, the same owner pauses affected implementation
and reassesses affected assumptions and gates. It invokes bound readiness or
selects the necessary advertised readiness capability under the selection
rules above, even if initially omitted. Obtain required ready evidence before
resuming. Strengthen verification within existing authority; ask for missing
product decisions or expanded effects. A non-ready result returns to the same
owner, which may investigate within authority. The parent never repeats preflight.

Compile this steering rule: forward unambiguous corrections, constraints,
cancellation, and status requests to the retained owner even without a pending
question. Apply restrictions before the next affected action.
Add each correction or constraint to the remaining acceptance checks and verify
it before completion. An implementation constraint requires the specified
implementation property; equivalent output alone does not satisfy it.
Cancellation stops further work and reports effects already performed; status alone does
not cancel. Report unavailable live delivery or stopping controls honestly.
Do not reinterpret a status request or restriction as new scope or publication
authority, and never launch a replacement owner to deliver feedback.

The owner result must clearly state whether the outcome is complete, awaiting
feedback, or blocked; `Status: complete` and `Status: blocked` are examples. It must
state changed files, focused and final verification, readiness and review
outcomes when applicable, performed publication effects, and remaining risks.
Workflow, risk, profile, and route are already established at launch and need
not be echoed. No other canonical serialization is required.

The complete launch task begins with the exact owner marker, followed by an
explicit sole-owner role instruction. For example:

```text
- phase: adaptive-goal-owner
Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.
```

Put the complete contract inline after that marker. Do not use an objective
file, hash, lifecycle ledger, or nested goal. If the complete contract cannot
fit the host task input without dropping a requirement, return
`Status: launch_required` and explain that boundary.

## 7. Launch exactly one separate owner

Read exactly one host guide completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

The separate route-selected subagent is the sole Darrow work owner. The
accepted Codex launch carries its concrete route. On Claude, the resolver
validates the scoped agent's model and effort frontmatter and rejects
higher-priority environment overrides; launch without a per-call model
override. Do not launch in the current thread, create another goal inside the
owner, inspect child work, start a nested host process, retry with another
route, or replace an accepted owner.

After acceptance, the parent performs no repository or external work. It may
only wait, relay user feedback or request status from the same owner, or stop that owner after
explicit abandonment or supersession.

If launch is unavailable or rejected, preserve the product tree and return:

```text
Status: launch_required
Reason: <specific unavailable boundary>
Selected route: <provider/model/effort>
```

## 8. Relay the owner result

Return the owner's result without reconstructing repository facts or running
checks in the parent. Preserve complete readiness and review results and every
authorized publication effect. A blocked or feedback-pending owner remains the
same owner for a later same-thread answer when the host supports continuation.

Do not shorten away selected gate outcomes or performed effects. If the owner
omits required completion evidence, request that missing status evidence from
the same owner before claiming completion; do not inspect the tree yourself or
invent the missing outcome. This request adds no work or publication authority.

Completion adds no authority. No fixed closing disclaimer is required.
