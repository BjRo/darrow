# Adaptive Goal renderer and diagnostic recovery

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

Status: implementation, deterministic validation and all 15 selected Codex
trials are complete. Task success is **15/15**, with remaining contract failures
and attribution gaps recorded below. After authentication was refreshed, the
Claude smoke passed **1/1 task trials** but missed the required verification
agent selection. Checkpoint `c9b2d6f4` preserves the approved main-thread
ownership implementation and its earlier adoption cohort; this follow-up is
uncommitted.

The [adoption baseline](adaptive-delivery-main-thread-adoption-2026-10-02.md)
remains **34/40 task passes**. Every failure and attribution gap remains open in
that report. New trials supplement the baseline; they do not replace its slots.

The subsequent [waiting and Claude routing follow-up](adaptive-delivery-user-wait-2026-10-03.md)
records the matched feedback comparison and a new Claude smoke. It preserves
this report's failures and separates routing success from reporting correctness.

## Change under test

Two high-risk trials blocked after verification looked for its renderer at the
plugin root, although its package was nested inside the skill. Main repeated the
wrong lookup and accepted a missing-installation diagnosis. Another real-review
trial recovered from the same mistake. A focused-repair trial used a misspelled
fixture command token and then blamed the fixture; its coordinators accepted
that unsupported diagnosis.

This candidate:

- moves verification's unchanged renderer and runtime launcher to
  `<plugin-root>/backend`, matching review and Adaptive Goal;
- binds one absolute backend path from the loaded skill before invoking a
  provider that retains reports, checks its launcher/package/lock, and reuses it;
- requires verification and main to compare failed commands and paths with the
  loaded public instructions before accepting an installation/provider diagnosis;
- sends demonstrated invocation errors back through the same capability for a
  bounded correction, retaining earlier results and implementation repair limits;
- updates both plugin manifests, Python inventory, CI selection and the copied
  installation check.

Versions: Adaptive Goal **0.24.1**, Verification **0.3.1**. Review, renderer
output semantics, model routes, user-wait rules, fixtures, eval checks, app-server
entrypoint and passive observation remain unchanged.

## Bounded comparison

The comparison uses Codex main coordination on Sol/medium, policy-selected implementation,
Sol/medium verification, Luna/medium review coordination and Sol/xhigh independent
readers. Each selected case ran serially, five trials per case, with failures
inspected before proceeding. Native goals stayed in the main thread; the
existing app-server entrypoint observed native continuation.

| Case                                | Baseline task | Candidate task | Contract: pass / fail / unknown | Correctness: pass / fail | Preservation | Mean seconds |
| ----------------------------------- | ------------- | -------------- | ------------------------------- | ------------------------ | ------------ | -----------: |
| `goal-preflight-high-risk-routine`  | 3/5           | 5/5            | 5 / 0 / 0                       | 4 / 1                    | 5/5          |        456.5 |
| `goal-verification-existing-review` | 5/5           | 5/5            | 5 / 0 / 0                       | 5 / 0                    | 5/5          |        700.9 |
| `goal-review-repair-verification`   | 4/5           | 5/5            | 0 / 3 / 2                       | 5 / 0                    | 5/5          |        417.7 |
| **Total**                           | **12/15**     | **15/15**      | **10 / 3 / 2**                  | **14 / 1**               | **15/15**    |    **525.0** |

Task success, capability compliance, evidence correctness and preservation,
diagnostic recovery, explicit role routes, whole-tree tokens and wall time are
recorded separately. Contract compliance is assessed after recovery; correctness
retains inaccurate intermediate conclusions. Unknown is not a pass. Encrypted handoffs remain
an attribution gap; downstream artifacts alone cannot prove complete delivery.
The frozen copy preserves the `darrow-adaptive-delivery` directory and validates
the exact explicit invocation token before launch.

For these same 15 baseline trials, task success was **12/15**, capability
compliance **8 pass / 3 fail / 4 unknown**, evidence correctness **10 pass /
5 fail**, and evidence preservation **13 pass / 2 fail**. All routes matched.
The complete baseline trees used **41,825,971 tokens** (including cached input)
and **8,813.47 seconds** of candidate wall time. These selected-case totals are
separate from the full 40-trial adoption cohort.

## Completed live evidence

All **25 verification assignments** check the installed launcher, package and
lock before launching their provider, then invoke the plugin-root renderer.
All **25 final verification responses** match successful renderer stdout. No
trial blocks on the former renderer lookup or an unsupported missing-package
diagnosis. Both repair cases preserve the original blocker, use one of the two
allowed implementation repair attempts, refresh checks, and obtain targeted
follow-up before main completes. They reject advisory extra-constant guidance
when it conflicts with the authoritative two-literal acceptance.

The remaining failures concern separate boundaries:

| Case and slots          | Observation                                                                                                                                                                                                                         | Assessment and next step                                                                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High-risk routine, 5    | Luna review coordination applies its own model route to the independent readers and initially returns blocked. Verification obtains a corrected assessment on unchanged code, retaining both reports and fresh Sol/xhigh judgments. | Recovered role confusion; intermediate correctness fails. Encrypted launch/correction text prevents assigning the cause to launch wording versus local interpretation. Preserve this as a known review-composition error. |
| Focused repair, 2       | Follow-up provider returns a summary missing the original target and full target history. No separate outgoing result message exists.                                                                                               | Confirmed provider handoff defect against the fixture's complete-native-result contract. Verification reads the full retained report, so downstream preservation passes.                                                  |
| Focused repair, 3       | Follow-up provider retains both target identities and history but omits the original report reference. No separate outgoing message exists.                                                                                         | Narrower confirmed incomplete handoff. The score requires complete evidence and references, not identical prose. Verification recovers the original reference from retained evidence.                                     |
| Focused repair, 4       | Initial provider summarizes the result without the changed-file and complete history fields; it sends no separate message. The follow-up sends an encrypted message and a short final.                                              | Initial handoff definitively fails; follow-up delivery is separately unknown. Verification reads the complete reports and preserves the evidence.                                                                         |
| Focused repair, 1 and 5 | A provider sends an encrypted message and a short public final.                                                                                                                                                                     | Complete provider delivery remains unknown. Observed downstream report consumption establishes preservation, not the encrypted message's content.                                                                         |

These fixture-provider omissions do not establish defects in production
`darrow-review` internals. They test Adaptive Goal and verification's
composition with an advertised provider contract. Keep their contract scores
separate from successful repairs and preserved downstream evidence. The
real-review case passes every assessed dimension in all five trials.

Other local recoveries remain in the transcripts: review-reader cache paths,
review-record validation, and three suffix-bearing `mktemp` failures corrected
before rendering. No false installation diagnosis follows these corrections.
Some recoveries occur entirely within unchanged review mechanics; they do not
prove that the new diagnostic wording caused recovery. The previous misspelled
fixture token does not recur, so this batch does not directly test recovery from
that specific mistake.

All **90 accepted child launches** explicitly pin model and effort and match
the observed routes. There are no rejected or unaccounted launches. All 1,060
frozen input hashes remain unchanged. No child creates the overall native goal;
the largest main-thread objective is **940 characters**, below the 4,000 limit.
All trials use the validated invocation token and preserved plugin basename.

Complete whole-tree usage is **38,716,586 tokens across 15 trials**, including
cached input. Candidate wall time totals **7,875.287 seconds (2h 11m 15s)**,
excluding operator analysis and gaps between launches. These totals are 7.4%
and 10.6% below the selected baseline respectively; small independent samples
do not establish a dependable efficiency improvement. Dollar cost is unknown.

The selected outcomes support retaining the renderer-path repair. They do not
establish perfect composition reliability, prove the broader diagnosis rule
fixes every failure, or clear historical failures. Discuss user-wait semantics
next, then decide how provider delivery should be made observable and what
complete delivery requires. Keep review internals unchanged during this repair.

## Claude smoke

The first Sonnet 5/medium high-risk delivery smoke stopped before execution with
`401 OAuth access token has been revoked`. Its failed task checks reflect the
authentication obstacle; no skill behavior was exercised. That attempt remains
retained under `claude-smoke/`.

After the user refreshed authentication, the same frozen candidate passed
**1/1 task trials**, including all 14 checks, on Claude Code 2.1.284. The retry
changed only the output destination to `claude-smoke-auth-retry/`; all 1,060
frozen input hashes remain unchanged. Adaptive Goal, verification and the
independent review skill were activated. The main-thread native goal moved from
active to complete with a 601-character objective. Behavior, focused checks,
independent review and no-publication checks passed.

The retained main-thread Agent calls nevertheless expose a **route-selection
contract defect**. Main selects the scoped Sonnet/low implementor, then two
`darrow-verification:review-coordinator-sonnet-5-medium` agents. It does not
select the separate scoped Opus/high verification assignment required by the
frozen Adaptive Goal skill. That contract distinguishes verification from
Sonnet/medium review coordination. Keep this defect separate from task success;
the passing task checks do not validate the full capability contract.

The reduced smoke evidence does not independently retain actual child model and
effort, full launch instructions, renderer command/stdout or complete capability
handoffs. The observed agent selection supports the defect above; it does not
establish the effective child models or explain which launch instruction was
lost. Exact renderer output, full evidence correctness and preservation remain
unassessed on this retry. Historical before-goal guard markers are retained but
are not valid checks of the main-thread architecture.

The retry took **383.711 seconds**. The harness reports **785,410 tokens** and
**$0.894**; these are not independently reconciled whole-tree totals. One smoke
does not establish n:5 reliability. Earlier Claude passes remain part of the
adoption baseline. Discuss the missing verification assignment before claiming
cross-host contract compliance; no further skill change or live run is mixed
into this retry.

## Deterministic checks

The copied read-only installation check failed at the new plugin-root location
before the package move, then passed after the move. It covers frozen runtime
installation, exact renderer stdout, input refusals and no writes to the plugin.
The Python change-detector tests pass under `bash` and `/bin/bash`. Documentation
validation and the skill inspector pass. The full Python gate initially stopped
because the moved local development virtual environment retained an old mypy
shebang; reinstalling its locked development dependencies repairs that local
environment. This is separate from the passing fresh-install test.

The single fresh-context audit found no material defect. It checked both skill
boundaries, renderer behavior, recovery authority, package layout and CI paths;
both owning skills pass the bundled inspector. The frozen setup passes dry
validation for all three cases, with one exact invocation token per case. These
are preparation checks, not live behavior passes. The full `bun run check:python`
gate passes across all 12 packages. Verification has 33 tests and 100% statement
and branch coverage. No native Windows execution or full Claude live sweep is
claimed.

## Evidence

Raw baseline and candidate results remain gitignored and retained locally:

- `evals/results/adaptive-main-thread-adoption-capacity-2026-10-02/`
- `evals/results/adaptive-main-thread-adoption-diagnostics-2026-10-02/`
- `evals/results/adaptive-renderer-recovery-2026-10-03/`

User-wait semantics remain a separate decision after this repair. This candidate
does not change the goal's pause rules or introduce a continuation runtime.

For that discussion, the existing app-server adapter sends a declared follow-up
only after the goal is no longer active (`AppServerSession.onCompletedTurn`).
In baseline steering slot 4, main waits through three turns, marks the goal
blocked under the native recurrence rule, then acts after real feedback. In
failed slot 3, it opens the mechanical window and completes before feedback.
The failed behavior violates the user's restriction. The passing behavior proves
that particular delayed boundary; it does not establish reliable interactive
waiting. Any change to feedback timing or waiting controls needs a separate
proposal and comparison, preserving these original results.

The adapter also rejects all server-initiated requests with “Unattended eval
cannot answer this server request” (`AppServerRpc.receive`). OpenAI documents a
native [`item/tool/requestUserInput` exchange](https://learn.chatgpt.com/docs/app-server#toolrequestuserinput),
including resolution and cleanup notifications. This suggests a separate,
bounded input-boundary investigation; it does not establish goal suspension or
prove the steering case would use that exchange. That case explicitly has no
product question pending. The current renderer comparison does not alter either
adapter behavior.
