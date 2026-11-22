---
name: adaptive-goal
description: Coordinate a bounded engineering request as a native main-thread goal. Start only on explicit adaptive-goal invocation, preserved orchestration delegation, or unambiguous same-thread continuation. Exclude ordinary engineering regardless of complexity or duration.
---

# Adaptive Goal

Own decisions, acceptance, coordination and completion here. Bound capabilities
own their public workflows. Before activation/delegation, read the host guide:
[Codex](references/codex-launch.md) or [Claude](references/claude-launch.md).
Require native goals; retain the coordinator model. On Codex, recommend
GPT-6.1 Sol/medium once, nonblocking, if the current model is known weaker.

## 1. Authority

- **Entry.** Require explicit user adaptive-goal invocation, bounded delegation from explicitly
  invoked orchestration, or unambiguous continuation of this preflight/goal.
- **Least privilege.** Delegation adds no scope/permissions. User-withheld work
  stays read-only until actual user release. Continuation/time/local changes
  cannot release it or justify completion. Required acknowledgement must accept
  the complete user reply unchanged as one argument; rejection needs new authority.
- **Questions.** Explicit user invocation also authorizes advice-only questions.
  Answer them from the
  [lifecycle](references/verification-lifecycle.md), without preflight/helpers/activation.
  Otherwise, absent authority, make no helper call/mutation; return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Read-only preflight

1. **Discover.** Read catalog-supplied skill paths; expand aliases. Use ordinary
   host tools; require actual invocation failure before declaring unavailability.
2. **Prepare.** Resolve repository and this plugin's backend:
   `${CLAUDE_PLUGIN_ROOT}/backend` on Claude; activated skill's
   `<plugin-root>/backend` on Codex. Require UV/Git; run below. Use returned
   repository/tree/instructions/routes, read relevant files, preserve existing work.
   Preflight excludes tests/builds/lint/review/implementation.
3. **Retrieve.** Obtain authoritative input before dependent preflight via
   advertised reads or configured tracker reads. Preserve provider/project/canonical
   identity; no Darrow response format required. Refusal/unavailability stops dependents.
4. **Specify.** Derive observable criteria without inventing behavior. Settle
   missing product/security/destructive-scope/publication/permission decisions.
5. **Isolate?** When fresh ticket context repays overhead, read
   [isolated workers](references/isolated-ticket-workers.md); preselect finite scope,
   effects and final assurance. Size/count alone is insufficient.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Windows: one PowerShell line per command. Missing helper/required capability,
incompatible assurance or invalid/unreadable policy: return `Status: launch_required`
with observed failure; launch nothing. Never search alternate installations/fallbacks.

## 3. Readiness

**Branches.** Immediately before ticket-branch preparation, refresh Git's exact
`ticket-id` discovery. One match: reuse. Several: ask among exact matches before
mutation. None: prepare caller's exact name or let creation name it.

- Unassessed authoritative ticket/specification/accepted plan: select.
- Complete bounded conversation: omit by default.
- Same scope assessed, findings resolved: omit.
- Material scope/criteria/constraint/input change: reassess.
- User requests omission: omit unless explicit policy requires.
- User/repository/caller requires: select.

Approval/completeness is no assessment or conversational reclassification.
Retain applicable conversational assessments; require no artifact.
Selected: invoke exact advertised readiness skill read-only; preserve full result.
Only `ready` clears launch. Return other results verbatim first, then smallest
unresolved questions. Reassess resolved findings; repeat only while findings
materially change. Record `ready` or omission row; derive criteria without mutation.

## 4. Evidence and route

Choose evidence before editing, at original public entrypoints/callers:

- **Behavior/bug.** Red for intended reason, then green at stable public seam; update affected callers/examples/docs.
- **Refactoring.** Passing baseline before/after.
- **Consumer/format transition.** Map all criteria/conversion to original callers and transition order; test compatibility; retain tested forwarding entrypoints when moved.
- **Exact non-behavioral edit.** Complete oracle, then passing result.

Record separate bases for consequence risk, implementation uncertainty/profile
and assurance. Assurance never raises profile. User/repository overrides govern
assurance/check cadence; isolated workers always require full-specification Review.

- **`routine`.** Local/reversible/limited. Scoped checks; omit Review by default.
- **`elevated`.** Compatibility/consumers/persistence/operations. Caller evidence/counterexample; Review when judgment needed, always for sequenced consumer/format transitions.
- **`high`.** Security/authorization/destruction/privacy/safety/broad impact. Adversarial boundary check and Review.

- `routine`: Clear local/mechanical.
- `routine-plus`: Local alternatives or explicit first-pass boundary correctness.
- `scaled`: Straightforward multi-component.
- `repo-wide`: Straightforward repository-wide.
- `judgment`: Unresolved multi-layer cause/architecture/planning/review.

Read the complete [lifecycle](references/verification-lifecycle.md), even without
Review. Read selected Review's public skill before launch; it owns fresh independent
standards/acceptance judgments/readers/routes. Bind other assessments only by
request/policy. Installation alone selects nothing.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight route \
  --repo <absolute-repository> --host <codex|claude> --profile <profile> \
  [--route 'harness|provider|model|effort'] [--main-route 'harness|provider|model|effort']
```

`--route`: exact supported user override only. `--main-route`: explicit host/user
current route only; otherwise observe session. Retain `route_relation`, including `unknown`.

## 5. Bindings

- **Bind/invoke.** Match authorized operations to advertised skill intent. Retain
  exact names/public references; Codex needs installed absolute `SKILL.md` paths.
  Read prerequisites/effects/evidence/stops before use; pass bindings/facts to fresh
  assignees. Compatible names qualify; assume no sibling installation.
  Raw tools/generic agents cannot replace bindings/bypass refusal. Unmatched work
  stays ordinary unless a selected requirement mandates a capability.
- **Publication.** Completion adds no commit/push/PR/merge/release/deploy authority.
  Require explicit effects, lifecycle clearance and publisher-verified commit identity.
  PR URLs prove no delivery; content reuse/push authority excludes metadata edits.
  Intermediate worker commits retain only their focused-check exception, bindings
  and message rules.
- **Records.** Preserve tracker identity/configuration. ADR lifecycle/catalog work
  follows repository/domain-modeling guidance as ordinary document work.

## 6. Activation and ledger

After preflight, activate/continue the matching native goal; observe activation
before implementation/assessment. Preserve unrelated goals. Objective: at most
4,000 Unicode characters covering outcome/criteria/assurance/authority/completion.
Token budget: explicit user request only.

Retain criteria/constraints/decisions/preserved work/effects, risk/readiness,
route/placement/bases, bindings, checks, assessment history/repair counts.
Reconcile before assignments, after continuation and before terminal responses.
Ask children for missing task facts; own bookkeeping here. Obtain required
red/baseline before mutation and focused/final-tree green for current content.

## 7. Placement

Preserve authority/bindings/evidence/user work; record basis/`route_relation`.
Use preselected [isolated workers](references/isolated-ticket-workers.md); otherwise:

1. **Parallel.** Substantial independent parts, disjoint owned files, settled
   interfaces, separate checks, host capacity and net time savings. Settle interfaces
   first; keep coupling sequential. Return out-of-scope edits here. No competing
   whole-task implementations/goal owners. Await all; integrate/check final tree.
2. **Sequential.** `same`: direct. `higher`/`unknown`: delegate. `lower`: delegate
   only when savings repay handoff/rereading/waiting/validation.
3. **Assign.** Use selected model/effort and host controls; retain implementor id.
   Supply repository/scope/files/effects/criteria/constraints/preserved work,
   exact bindings and concrete checks/evidence; require files/results/gaps.
   Assignment grants no Adaptive Goal/goal control/assessment coordination/extra
   publication. Route refusal stops assignment without substitution.
4. **Assess.** Settle implementation; invoke full selected public workflows here.
   Apply lifecycle; direct authors cannot self-assess.
5. **Repair.** Return combined findings/constraints/checks to producing implementor.
   Replace only if unavailable/unsuited; explain and transfer context/history.
   Splitting/replacement cannot multiply allowance. Wait before conflicting work.

## 8. Feedback and blockers

- **Steer.** Preserve restrictions; update criteria/readiness. Deliver complete
  relevant feedback before affected child actions; reuse applicable implementors.
  Reusing a component means calling it. Enforce section 1's waits/acknowledgement.
- **Wait.** Ask smallest material question; stop affected mutation. Resume same
  goal/ledger after answer. Status continues; cancellation stops/reports effects.
  Use native controls truthfully, without goal resets/custom retry loops.
- **Idempotency.** Observe before ambiguous retries; never duplicate completed
  effects. Include this in affected assignments.
- **Retry.** Unchanged deterministic failure needs changed evidence/conditions.
  Report blocker/evidence/next action; native recurrence needs no command replay.
  Missing-helper/provider claims need attempted path/error checked against contract;
  return real invocation errors to the same provider. Unverified causes remain gaps.

## 9. Definition of done

Require lifecycle `clear`, current checks/assessments, resolved blockers and all
requested authorized effects. Missing/stale evidence blocks completion and
final commits/publication even after Review passes.

Return self-contained ledger/evidence: completion/blockage, placement/basis/`route_relation`,
files/checks/readiness, substantive assessment findings/repairs/reports, criteria/gaps,
publication/risks. Completed next actions are history; missing facts remain gaps.
Every terminal response, including repeated blockers, states attempts used,
authorized maximum/source. Success never reduces the maximum.
