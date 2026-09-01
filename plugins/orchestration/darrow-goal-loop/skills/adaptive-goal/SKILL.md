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
- an unambiguous answer in this same host thread targets the one retained
  preflight question or owner pause.

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
Every `launch_required` response in this workflow begins with the exact
plain-text line `Status: launch_required`; add no leading or trailing whitespace
or Markdown hard-break spaces to that line.

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
it after implementation and final checks. A clear result completes the gate. A
blocking result permits one authorized closed-set repair and one fix
verification; only clear verification permits completion. Read
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

An explicit user model and effort wins. Otherwise resolve the policy route:

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

Readiness is invoked by the parent before launch. Every other binding is invoked
by the owner when that operation becomes due. A direct shell, Git, forge,
tracker, or generic-subagent call is not a substitute for a bound skill. If the
skill refuses or becomes unavailable, stop that operation without expanding
authority.

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

Use these seven exact top-level fields so the host boundary can validate the
contract without requiring a long heading checklist. Keep each structured
field on one line and preserve every key shown. Set `workflow` to exactly one
selected identifier: `fix-bug`, `implement-feature`, `change-feature`,
`refactor`, `migration`, or `mechanical`. Put the compact workflow steps in
`sequence`, separated by commas rather than semicolons; never append sequence
text to `workflow`:

```text
Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.
Outcome: <bounded result>
Acceptance criteria: <observable outcomes>
Scope and authority: included=<files and operations>; authorized=<local and external effects>; forbidden=<non-goals and excluded effects>; preserve=<user-owned state>
Execution: workflow=<exact workflow identifier>; sequence=<compact workflow steps>; risk=<routine, elevated, or high>; profile=<selected profile>; route=<host|provider|model|effort>; capabilities=<operation -> exact advertised skill; or none>
Verification and gates: readiness=<evidence or omitted reason>; review=<exact advertised skill when selected; omitted reason only when review is not required>; focused=<feedback checks>; final=<final-tree checks>; feedback=<same-owner pause and relay rule>; blockers=<semantic blocker and observe-before-retry rule>
Completion evidence: begin with exactly Status: complete when achieved or Status: blocked when unable to proceed; then include=<changed files, focused and final verification, selected readiness and review outcomes, publication effects, and remaining risks or blockers>
```

Feedback checks exercise the changed seam after coherent slices. Final-tree
checks are the applicable repository gate plus:

| Risk | Required final evidence |
| --- | --- |
| routine | focused evidence and scoped repository gate |
| elevated | routine evidence plus affected-caller or compatibility checks and one counterexample |
| high | elevated evidence plus an adversarial boundary or state-transition check and independent review |

When a stable seam and independent oracle exist, behavior-changing workflows
add or update focused evidence before the production change and confirm the
expected failure. Repository-mandated cadence wins.

Compile this human-feedback rule: a material decision first discovered after
launch pauses repository and external mutation. The owner returns the smallest
complete question as its paused result; no lifecycle marker is required. The
parent relays the explicit answer verbatim to the same owner, with no lifecycle
marker or fixed display summary. The answer grants no broader authority, and
the owner performs any required acknowledgement before mutation. Never choose
a default or launch a replacement owner.

Compile this blocker rule: when work cannot proceed without an external state
change, return `Status: blocked` with the specific blocker, current evidence,
and smallest next action. Before repeating an ambiguous external effect,
observe current state and never duplicate an effect that already completed. Do
not retry an unchanged deterministic failure without changed evidence or
conditions. There is no Darrow retry or waiver state machine.

The owner result must begin with exactly `Status: complete` when the requested
outcome is achieved or `Status: blocked` when work cannot proceed. It must then
state changed files, focused and final verification, readiness and review
outcomes when applicable, performed publication effects, and remaining risks.
Workflow, risk, profile, and route are already established at launch and need
not be echoed. No other canonical serialization is required.

The complete launch task begins exactly:

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
only wait, relay an explicit answer to the same owner, or stop that owner after
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

End completed results with: `Goal completion grants no new or subsequent
authority.`
