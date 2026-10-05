# Adaptive Goal: coordinator instructions and implementor reuse

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

Status: historical proposal. The user stopped the developer-context approach
and requested its app-server changes be reverted; they were reverted. The current
round tests the skill-only candidate with the unchanged runner. See the
[bounded finish report](adaptive-delivery-skill-finish-2026-10-04.md) for new results
and the outcome-focused assessment policy. The host-integration proposal below
is retained as history and is not an active implementation plan.

The main thread owns workflow coordination, evidence reconciliation, repair
accounting and completion. The implementor receives concrete work and returns
facts. The user confirmed this boundary after rejecting a proposal to pass
delivery bookkeeping into implementation assignments.

The 0.24.6 working candidate makes that boundary explicit and reuses an applicable
implementor for repairs. At this proposal's checkpoint it had no new live results.
Delivering coordinator rules
as developer context is a separate host-integration proposal below, not an
implemented or measured improvement.

## Preserved baseline

The [Codex finish report](adaptive-delivery-codex-finish-2026-10-03.md) retains the
92-trial 0.24.4 sweep and separate five-trial 0.24.5 publication-fixture repair.
No historical trial, failed result, unknown encrypted assignment or attribution
gap is replaced. The current changes do not alter those frozen snapshots.

The relevant overlapping failure groups are missing workflow-required checks
before edits, omitted terminal repair accounting and repeated unchanged
deterministic failures. These are distinct from verification's mistyped original
hash, synthetic provider mislabeling, doctor runtime refusal and unknown encrypted
handoffs. Coordinator instruction delivery alone cannot be claimed to fix those
other groups.

## What the retained evidence establishes

The current app-server adapter's `thread/start` supplies model, effort, permissions
and configuration, but no `developerInstructions`. It submits the task through
`turn/start` as text. See
[codex-app-server.ts](../../evals/runner/adapters/codex-app-server.ts).

In frozen `goal-failed-check-blocks-publication`, slot 1, the passive observer
records a complete Adaptive Goal skill injection at ordinal 10 of the first
main-thread turn. The observer only emits that observation for a user-role
message whose text contains the complete mounted skill body. The root thread is
`01a102bc-deee-7af3-8222-eb92cbba6da3`; all three retained turn contexts are
Sol/medium. The workflow reference was subsequently read through tools.

The source evidence is under the gitignored directory
`evals/results/adaptive-handoff-finish-2026-10-03/`:

- `observe.ts` contains the role filter and complete-body comparison.
- `regression/trials/goal-failed-check-blocks-publication/1/public-evidence/darrow-eval-Ud0ITM/native-public.json`
  retains the injection, public actions and native continuation.
- Each affected case's `assessment.json` preserves its separate dimensions and
  the public evidence used for the findings.

The observer did not retain developer messages, full model requests or compaction
events. The original rollout was removed with fixture cleanup. Consequently,
these records establish the user-role injection but cannot reconstruct every
later effective instruction context or prove that workflow instructions vanished
during continuation. Missing pre-edit checks also occurred during a first turn.
Instruction priority and retention remain hypotheses about the cause.

## Changes made in the working candidate

The normative spec was updated before the skill and host guides. Both Adaptive
Delivery manifests are 0.24.6. The changes are:

- The main thread translates the selected workflow into concrete assignments.
  It obtains required failing-check evidence before mutation or explicitly
  assigns that ordering. Post-edit success cannot prove the earlier failure.
- The main thread reconciles issued work, returned facts, outstanding obligations
  and repair use before another assignment, after continuation and before a
  terminal response. Missing facts go back for clarification; the implementor
  does not reconstruct delivery state or calculate its repair count.
- Subsequent implementation and repair reuse the accepted implementor. A new
  agent requires a concrete availability, route or scope reason and receives the
  necessary prior context. Agent replacement grants no extra repair allowance.
- Implementors return changes, actual check results, relevant evidence and
  blockers. No mandatory assignment or return schema is introduced.
- Every terminal response carries repair use and the authorized maximum,
  including later blocked continuations. Native blocked-state recurrence does
  not require rerunning an unchanged failing command.

Main ownership, model routes, the two-attempt limit, capability boundaries and
native continuation remain as adopted. Verification and review are unchanged.
Claude's guide follows the same reuse boundary, without claiming new Claude
validation. No runner, hook or Python runtime code changed.

## Proposed developer-context integration

Codex documents `SessionStart` output as developer context, with startup, resume,
clear and compact sources. After root compaction it supplies that context before
the next model request. Plugin hooks require host trust; large additional context
can spill to a file, so payload size and direct delivery must be checked. See the
[official hooks documentation](https://learn.chatgpt.com/docs/hooks).

Recommend a small Codex plugin hook that supplies canonical static coordinator
instructions. The existing Review and TDD plugins provide a local packaging
precedent; this proposal does not change either plugin.

1. Keep one canonical instruction source in the Adaptive Goal skill's
   resources, also read by the hook. Include workflow selection and the six
   workflows, authority and preflight requirements, delegation boundaries,
   capability prerequisites, repair accounting, feedback, blockers and completion.
   Exclude capability internals and duplicated command documentation.
2. State that these rules apply only after explicit Adaptive Goal invocation
   or an authorized continuation. They do not start a goal or make bounded
   implementation, verification or review children delivery owners.
3. Supply the rules on native session start, resume and compaction. Use portable
   Bash and PowerShell entrypoints with a bounded payload. No transcript parsing,
   state file, task ledger, stop hook or continuation driver is required.
4. Keep task-specific acceptance, current counts, user decisions and returned
   evidence in their original conversation and result context. Developer rules
   explain how to reconcile those facts; the hook does not invent or freeze them.
5. Retain bounded passive evidence of hook execution and delivered context:
   source, role, version and exact content match where publicly observable.
   Missing delivery evidence remains unknown. Do not retain private reasoning or
   decode encrypted messages.

This is a material integration choice because installed sessions would receive
the conditional rules even when Adaptive Goal is not invoked. The current
coordination sections, lifecycle and six workflows alone total about 21,500
characters before consolidation. Exact payload size and token overhead need to
be measured; a short activation hint would not supply the requested workflow
instructions. Startup, continuation, compaction and non-activation behavior need
host-level validation before delivery trials.

Adding developer instructions only to the eval adapter would test a setup that
ordinary plugin users do not receive. Prefer the shippable hook boundary, subject
to user agreement. Do not restore a separate execution-owner app-server transport.
Do not claim that higher instruction priority will eliminate execution drift.

## Proposed bounded re-verification

After the integration decision and validation, freeze one new candidate. Run
five trials for each of these existing cases, with the same app-server entrypoint,
fixtures, checks and model routes as the preserved baseline:

| Case                                   | Purpose                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `goal-verification-existing-review`    | Assessment before change, failing regression, same-implementor repair and fresh verification |
| `goal-post-launch-reassessment`        | Changed acceptance, readiness, retained implementor and pre-edit evidence                    |
| `goal-steering-without-question`       | Native continuation with user constraints and main-owned bookkeeping                         |
| `goal-failed-check-blocks-publication` | Unchanged blocker, no repeated failing command, terminal accounting and publication refusal  |
| `goal-review-routine-omitted`          | Routine control with bounded implementation and no unnecessary review                        |

These 25 trials are proposed, not launched. Report task success, delivery and
capability compliance, evidence correctness, preservation, recovery, routes and
whole-tree usage/time separately. Preserve every failure; do not pool versions.
Compare only where the existing baseline has observations and retain its n:1
versus n:5 differences. This combined candidate can demonstrate its behavior,
but cannot isolate a hook effect from the accompanying skill changes without
an additional matched control.

## Validation status

The updated skill passes the bundled skill inspector. Documentation validation
passes for 263 Markdown pages and 16 plugins; scoped formatting and
`git diff --check` pass. No live trial has been run for 0.24.6. User agreement on
the developer-context integration remains pending.
