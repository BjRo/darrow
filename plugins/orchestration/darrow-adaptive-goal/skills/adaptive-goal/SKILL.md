---
name: adaptive-goal
description: Coordinate a bounded engineering request as a native main-thread goal. Start only on explicit adaptive-goal invocation, preserved orchestration delegation, or unambiguous same-thread continuation. Exclude ordinary engineering regardless of complexity or duration.
---

# Adaptive Goal

Own decisions, acceptance, coordination and completion here. Bound capabilities
own their public workflows. Before activation/delegation, read the host guide:
[Codex](references/codex-launch.md) or [Claude](references/claude-launch.md).
Require native goals after section 6's startup gate; retain the coordinator model. On Codex, recommend
GPT-6.1 Sol/medium once, nonblocking, if the current model is known weaker.

## 1. Authority

- **Entry.** Require explicit user adaptive-goal invocation, bounded delegation from explicitly
  invoked orchestration, or unambiguous continuation of this preflight/goal.
- **Least privilege.** Delegation adds no scope/permissions. User-withheld work
  stays read-only until actual user release. Continuation/time/local changes
  cannot release it or justify completion. Required acknowledgement must accept
  the complete user reply unchanged as one argument; rejection needs new authority.
- **Questions.** Explicit user invocation also authorizes advice-only questions.
  Read the complete [lifecycle](references/verification-lifecycle.md). Apply its
  first matching repair-budget row before answering, without preflight/helpers/activation.
  Otherwise, absent authority, make no helper call/mutation; return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Read-only preflight

1. **Discover.** Read advertised skill paths; expand aliases. Use ordinary
   host tools; verify claimed invocation failures.
2. **Prepare.** Resolve repository and this plugin's backend:
   `${CLAUDE_PLUGIN_ROOT}/backend` on Claude;
   `<absolute-skill-directory>/../../backend` on Codex. Require UV/Git; run below. Use returned
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
6. **Branch.** For ticket-linked delivery branches, run bound Git's exact-ID
   discovery before activation. One match: bind its full name as preparation input; suggested
   creation names apply only with no matches. Several: ask among exact matches.
   None: use caller's exact name or let creation name it. Refresh discovery
   immediately before preparation; reconcile changed matches before mutation.
   Prepare the bound branch after section 6's native goal activation.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Windows: one PowerShell line per command. Missing helper,
incompatible assurance or invalid/unreadable policy: return `Status: launch_required`
with observed failure; launch nothing. Never search alternate installations/fallbacks.

## 3. Readiness

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

**Dispatch.** Preserve preselected isolated workers. Otherwise, before editing
source/tests, apply the returned `route_relation` for sequential work:

- `same`: implement directly.
- `higher`/`unknown`: call the host's delegation tool with the selected model/effort;
  require an accepted implementor id, then give implementation to that worker.
- `lower`: delegate only when savings repay handoff/rereading/waiting/validation.

Keep the coordinator's route. Section 7 owns parallel placement and assignments.

## 5. Bindings

- **Commits.** Create authorized commits with native Git under repository rules.
- **Bind/invoke.** Match other authorized operations to advertised skill intent. Retain
  exact names/public references; Codex needs installed absolute `SKILL.md` paths.
  Read prerequisites/effects/evidence/stops before use; pass bindings/facts to fresh
  assignees. Compatible names qualify; assume no sibling installation.
  Raw tools/generic agents cannot replace bindings/bypass refusal. Unmatched work
  stays ordinary unless a selected requirement mandates a capability.
- **Publication.** Completion adds no commit/push/PR/merge/release/deploy authority.
  Require explicit effects, lifecycle clearance and publisher-verified commit identity.
  PR URLs prove no delivery; content reuse/push authority excludes metadata edits.
  Intermediate worker commits retain only their focused-check exception and
  repository Git rules.
- **Records.** Preserve tracker identity/configuration. ADR lifecycle/catalog work
  follows repository/domain-modeling guidance as ordinary document work.

## 6. Activation and ledger

**Start.** Resolve preflight decisions, clear readiness and bind every required
capability before creating/proposing a native goal or delegating. Missing required
bindings return `Status: launch_required`; unresolved decisions/results return
without activation.

**Continue.** Retain an existing matching goal when later decisions stop affected work.

Observe activation before implementation/verification. Preserve unrelated goals.
**Objective.** At most 4,000 Unicode characters: outcome/criteria/assurance/authority/completion.
**Tokens.** Default unbudgeted; explicit user request only.

Retain criteria/constraints/decisions/preserved work/effects, risk/readiness,
route/placement/bases, bindings, checks, assessment history and repair ledger
`{used, maximum, source}` from the lifecycle.
Reconcile before assignments, after continuation and before terminal responses.
Ask children for missing task facts; own bookkeeping here. Obtain required
red/baseline before mutation and focused/final-tree green for current content.

## 7. Placement

**Assessment first.** For assessment-before-change requests, run current checks
and every selected initial assessment before assigning or performing implementation.
Apply the lifecycle to their combined result before authorizing repair.

Preserve authority/bindings/evidence/user work; record basis/`route_relation`.
Use preselected [isolated workers](references/isolated-ticket-workers.md); otherwise:

1. **Parallel.** Substantial independent parts, disjoint owned files, settled
   interfaces, separate checks, host capacity and net time savings. Settle interfaces
   first; keep coupling sequential. Return out-of-scope edits here. No competing
   whole-task implementations/goal owners. Await all; integrate/check final tree.
2. **Sequential.** Apply section 4's route decision.
3. **Assign.** For delegated placement, require host acceptance of an implementor
   on the selected model/effort before implementation; retain its id.
   Supply repository/scope/files/effects/criteria/constraints/preserved work,
   exact bindings and concrete checks/evidence; require files/results/gaps.
   Assignment grants no Adaptive Goal/goal control/assessment coordination/extra
   publication. Launch refusal stops affected implementation without substitution;
   return `Status: launch_required` with the actual failure.
4. **Assess.** Settle implementation; invoke full selected public workflows here.
   Apply lifecycle; direct authors cannot self-assess.
5. **Repair.** Check that each blocker is supported by evidence and that its
   repair stays within the agreed scope. Choose an in-scope fix that resolves the
   blocker, even if Review suggested a broader change. If concrete new evidence
   challenges a blocker, raise it with the same provider before assigning a repair.
   Use its [correction workflow](references/verification-lifecycle.md#repair-budget)
   when supported. Keep the blocker open until independent evidence resolves it.
   Return combined findings/constraints/checks to producing implementor.
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
Every terminal response copies the repair ledger's used/maximum/source.
Success never reduces the maximum.
