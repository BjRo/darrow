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

Resolve the repository and bundled helper to absolute paths, then run:

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
- high: select by default;
- any risk: select when the user or repository requires it.

When selected, bind the exact advertised skill matching independent review of
the final code change. If none exists, stop before owner launch. The owner runs
it after implementation and final checks. A clear result completes the gate. A
blocking result permits one authorized closed-set repair and one fix
verification; only clear verification permits completion. Read
[`references/review-lifecycle.md`](references/review-lifecycle.md) completely
when review is selected.

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
- workflow, risk, profile, selected route, and any explicit budget;
- the selected workflow sequence;
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

Use these exact top-level labels so the host boundary can validate that no
critical field was dropped:

```text
Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-goal or seek another owner.
Outcome: <bounded result>
Acceptance criteria: <observable outcomes>
Scope: <included files and operations>
Non-goals: <excluded work>
Preserved work: <user-owned state to retain>
Permissions: <local and external-effect authority>
Workflow: <workflow>
Risk: <routine, elevated, or high>
Profile: <selected profile>
Selected route: <host|provider|model|effort>
Workflow sequence: <ordered semantic work>
Verification: <focused and final verification policy>
Focused checks: <feedback checks>
Final-tree checks: <final checks>
Readiness: <ready evidence or omitted reason>
Independent review: <selected with exact skill, or omitted reason>
Capability bindings: <operation -> exact advertised skill; or none>
Human feedback: <same-owner pause and relay rule>
Blocker: <semantic blocker and observe-before-retry rule>
Completion evidence: <required owner result fields>
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
complete question beginning with `- phase: human-feedback-request`. The parent
relays the explicit answer to the same owner beginning with
`- phase: human-feedback-response`. The answer grants no broader authority, and
the owner performs any required acknowledgement before mutation. Never choose a
default or launch a replacement owner.

Compile this blocker rule: when work cannot proceed without an external state
change, return `Status: blocked` with the specific blocker, current evidence,
and smallest next action. Before repeating an ambiguous external effect,
observe current state and never duplicate an effect that already completed. Do
not retry an unchanged deterministic failure without changed evidence or
conditions. There is no Darrow retry or waiver state machine.

The owner result must state status, changed files, focused and final
verification, readiness and review outcomes when applicable, performed
publication effects, and remaining risks. Workflow, risk, profile, and route
are already established at launch and need not be echoed. No canonical
serialization is required.

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
accepted Codex launch is sufficient route evidence. Claude requires the one
bounded post-return route check in its host guide because Agent acceptance can
silently substitute a model. Do not launch in the current thread, create
another goal inside the owner, inspect child work, start a nested host process,
retry with another route, or replace an accepted owner.

After acceptance, the parent performs no repository or external work. It may
only wait, perform the Claude guide's exact route observation, relay an
explicit answer to the same owner, or stop that owner after explicit
abandonment or supersession.

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
