# Artificer main-thread migration

Status: implementation and approved bounded checks complete. No production
installation, recurring grant, claim, schedule or GitHub object was changed.

## Approved scope

Replace the old `codex exec` parent/owner transport with a contained Python
app-server client for Codex 0.159.2. The original main thread retains Adaptive
Delivery's native goal. New grants default to Sol/medium. The skill owns
implementation routing, verification and review assignments and repair limits.
Artificer retains admission, process lifetime, authorized replies, archives and
verified PR correlation. There is no engineering phase loop or synthetic
continuation prompt.

Validate native completion, preflight questions and questions during a goal,
including same-thread restoration after process exit, at n:5 each. Run the
management evals separately from native transport tests. Prior results remain
historical evidence, including the separate-owner restoration record in
[the original delivery report](artificer-157-delivery.md).

## Baseline and current installation

The unchanged package passed 130 deterministic tests. The checkout was clean
at `5df0ab39`. The configured installation has one old separate-owner delivery
in needs-attention with an associated PR. Its process has ended and no encrypted
archive exists. The saved failure identifies a native temporary launcher
symlink rejected by archiving. Its records and effects remain untouched; no
conversion or relaunch is authorized by this migration.

## Native validation obstacle

A model-free Codex 0.159.2 account observation succeeded through normal ChatGPT
login. Included usage was available, but `credits.hasCredits` was true. The
unchanged production account gate therefore refused launch. The user confirmed
that the subscription has sufficient weekly allowance and also has credits;
the bounded isolated tests may use that account. This is an account constraint,
not a transport failure, and does not authorize relaxing the production
subscription boundary.

## Observed red/green slices

Commands below ran from the repository root. The full package command before
the final transport error regression passed 132 tests; this is interim offline
evidence, not a release gate or live compatibility claim.

1. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_cli_scheduler.py -q -k recover_main_thread_without_owner`:
   recovery still required `--parent` and `--owner`.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_cli_scheduler.py -q -k recover_main_thread_without_owner`:
   1 passed; `recover --thread` retains and archives the original main identity.
2. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q`:
   the external protocol fixture rejected the old `exec` transport.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q`:
   1 passed; identity is saved before the first turn, and a later native turn
   supplies completion without another client-submitted turn.
3. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k native_question`:
   continuation still required the removed child owner.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k native_question`:
   1 passed; native questions and complete multiline answers use the original thread.
4. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_archive.py -q -k native_temporary_launchers`:
   a native temporary launcher symlink prevented archive creation.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_archive.py -q -k native_temporary_launchers`:
   1 passed; persistent history restores while regenerable native temporary files
   are excluded. An initial missing test import was corrected before the red.
5. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k text_question_while_goal_active`:
   waiting only for a terminal goal timed out on a valid question.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k text_question_while_goal_active`:
   1 passed; a question can yield while its goal remains active.
6. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k fatal_error_during_result_capture`:
   a queued fatal error was ignored while accepting completion.
   Green — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k fatal_error_during_result_capture`:
   1 passed; the underlying access error prevents accepting completion. An
   accidental fixture indentation error was corrected before the valid red.

7. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_native.py -q -k cached_plugins_with_same_version`:
   copying cache directories with the same version collided at `skills/0.1.0`.
   Green — same command: 1 passed; validated manifest names identify each copy.
8. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k preflight_resume_empty_goal_snapshot`:
   an empty-goal resume snapshot was incorrectly treated as lost goal state.
   Green — same command: 1 passed; absence before goal creation is allowed, while
   a previously observed objective is retained and later loss/replacement refused.
9. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_archive.py -q -k restored_plugin_helper`:
   restoring a bundled helper removed its execute permission.
   Green — same command: 1 passed; the restored helper executes, with elevated
   and group/other write permissions removed.
10. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k fatal_event_buffered`:
    a fatal event in the same pipe write after readback was ignored.
    Green — same command: 1 passed; buffered and ready observations are checked
    before accepting the captured outcome. The first test arrangement already
    passed because a later RPC read exposed the event; the corrected arrangement
    reproduced the settlement race.
11. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k 'revocation_serializes or revoked_grant'`:
    revocation could finish before an already-prepared turn was submitted; a
    revoked grant could also resume the thread before the authority check.
    Green — same command: 2 passed; the authority check, resume, identity save and
    initial turn submission share the repository lock. Observation releases it.
12. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k unresponsive_host`:
    a host ignoring termination left cleanup raising a timeout.
    Green — same command: 1 passed; cleanup kills and reaps it after the grace period.
13. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k feedback_can_join_resumed`:
    resumed feedback attempted to impose a per-turn schema on an active native turn.
    Green — same command: 1 passed; resumed feedback omits that generation override.
    The returned outcome is still strictly validated; no retry or replacement
    turn is introduced.
14. Red — `uv run --frozen --project plugins/automation/darrow-artificer/backend --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_app_server.py -q -k healthy_native_continuation_can_exceed_one_hour`:
    advancing the simulated clock by 3,601 seconds caused healthy execution to time out.
    Green — same command: 1 passed in under one second; native continuation and
    completion survive that elapsed duration. A separate protocol regression
    still refuses an unanswered request within its bounded deadline.

## Independent audit and offline gates

One fresh-context audit inspected ownership, authority, continuation, archive
restoration and completion. It identified the revocation race, buffered-result
race, lost helper permissions and missing persistent goal evidence. These were
addressed with the regressions above. No second audit round was commissioned.

`bun run check:python --package plugins/automation/darrow-artificer/backend`
passed: 165 tests, strict typing and Ruff; line coverage 99.14%, branch coverage
96.69%. `tests/fresh_install.py` passed from a fresh immutable plugin copy with
locked runtime dependencies. Seven management fixtures prepared in a dry run;
the revocation postcondition is predictably false before any participant acts.
Dry results are not behavioral passes.

## Preserved diagnostic trials

Evidence root: `evals/results/artificer-main-thread-2026-10-04/diagnostic/`.
Its plugin snapshot and file hashes remain unchanged.

- Completion: passed in 37.90 seconds, Sol/medium main thread and a bounded
  Luna/medium child. This initial probe completed in one root turn and does not
  prove automatic continuation after an intermediate final response.
- Preflight: failed on resume. The first question and archive restoration
  succeeded, but `thread/goal/cleared` represented a valid empty-goal snapshot.
  Artificer misclassified it as lost state. This confirmed adapter defect is
  retained; the later regression and candidate results do not replace it.

## Preserved candidate 1

Evidence root: `evals/results/artificer-main-thread-2026-10-04/candidate-1/`.
`inputs.json` retains the snapshot hashes. The owning directory remains
`darrow-artificer`; rendered management invocation was checked against the
manifest: `$darrow-artificer:manage-artificer`.

- Preflight: 1/1 passed, 46.92 seconds; same thread/history after archive restoration.
- Completion: 1/1 passed, 42.80 seconds; two root turns, Sol/medium root and
  Luna/medium bounded child.
- Goal feedback: 0/1. The active goal restored, but `turn/start` returned
  `ActiveTurnOutputSchemaMismatch`. Its per-turn schema conflicted with native
  continuation. This is an adapter defect, not lost ownership or model drift.
  The sequence stopped at this failure; no other candidate-1 trials were launched.

The user also identified the adapter's one-hour elapsed limit as unapproved
carryover from the eval setup. It was removed from production. Individual RPCs
remain bounded at 30 seconds, with a 10-second graceful shutdown before forced
reaping. The live probe's `--timeout-seconds` owns its experiment duration only.
No watchdog, synthetic continuation, automatic retry or delivery budget was added.

The schema behavior is consistent with the
[Codex app-server contract](https://learn.chatgpt.com/docs/app-server):
output schemas apply to a single turn; active-turn steering accepts no schema
override. The retained error is direct evidence of the conflict on Codex 0.159.2.

## Corrected candidate 2

Evidence root: `evals/results/artificer-main-thread-2026-10-04/candidate-2/`.
This candidate contains the resumed-schema fix and removes the production
elapsed-time limit. Earlier trials and snapshots remain separate; none count
toward its n:5 coverage. Before freezing it, the Python gate passed 168 tests,
strict typing and lint, 99.23% line coverage and 97.01% branch coverage.

Native probes use Codex 0.159.2, Sol/medium main threads and a test-only account
exception for existing credits. They use a transport fixture, not the real
engineering recipe, and never create real GitHub effects. Completion requires
at least two native root turns. Feedback probes delete the marker input and
restore encrypted state at the same path before delivering a complete multiline
answer. Recorded dimensions include task outcome, retained thread/objective,
history and answer preservation, restored archives, native actor routes, whole-tree
token usage and wall time. Dollar cost is unknown.

### Candidate 2 native results

All 15 trials passed their transport task, observed identity/goal contract and
history/answer checks. There were no failures in this candidate. Five samples
per scenario establish bounded evidence, not a general reliability guarantee.

| Scenario                                      | Task | Thread/goal/history | Archive recovery | Mean wall time | Whole-tree tokens |
| --------------------------------------------- | ---- | ------------------- | ---------------- | -------------- | ----------------- |
| Native completion after an intermediate final | 5/5  | 5/5                 | Not exercised    | 39.61 s        | 826,622           |
| Preflight question before first goal          | 5/5  | 5/5                 | 5/5              | 43.91 s        | 530,423           |
| Question during an existing goal              | 5/5  | 5/5                 | 5/5              | 48.31 s        | 596,838           |

Each completion trial observed two root turns, one Sol/medium main thread, and
one Luna/medium child with a completed `READY` return. Passive native records
confirmed that child's route and return in all five cases. This does not claim
visibility into encrypted launch instructions.

Across the 15 trials, wall time totaled 659.16 seconds. Whole-tree usage totaled
1,953,883 tokens: 1,938,894 input, including 1,669,120 cached input, and 14,989
output. Native cumulative usage was collected once per actor after execution;
restoration did not count earlier cumulative usage twice. No dollar estimate
is inferred from subscription/credit eligibility.

Recovery here means restoring the original native home and continuing its
thread/history/goal with the authorized answer. These probes do not exercise
implementation repair, real verification/review capabilities or publication.
Their established routes and two-attempt repair policy remain in the unchanged
Adaptive Delivery/capability skills.

The ten restored histories retained their original bytes as prefixes of the
resumed history files. All five mid-goal trials also retained one observed goal
creation timestamp across both invocations, in addition to the same objective
and thread. Raw evidence remains under the candidate directory.

### Management skill results

Seven sequential single-trial Codex evals passed task and explicit activation
checks at threshold 100%. Candidate and semantic grader both used
`gpt-6-luna`/`medium`. These are management smoke results, distinct from the
Sol/medium native transport trials and their n:5 coverage.

| Case                          | Task | Activation |
| ----------------------------- | ---- | ---------- |
| Missing operation/state input | 1/1  | 1/1        |
| Missing recurring authority   | 1/1  | 1/1        |
| Status only                   | 1/1  | 1/1        |
| Ambiguous cancellation target | 1/1  | 1/1        |
| Lost-state recovery boundary  | 1/1  | 1/1        |
| Revoke without cancelling     | 1/1  | 1/1        |
| Subscription/credit boundary  | 1/1  | 1/1        |

The executable source, tests, skill and references match candidate 2's retained
hashes. Only Codex manifest whitespace changed afterward; its parsed content is
identical. Artificer is version 0.2.0. Adaptive Delivery 0.24.7 and Ticket-to-PR
0.5.4 contain only compatibility-note/version updates; their skills and routes
remain unchanged. Fresh immutable installation and documentation validation pass.

## Residual limits and deployment boundary

- No real ticket-to-PR recipe, verification/review work, GitHub publication or
  recurring production installation ran during these probes. Existing
  deterministic tests cover grant/reply/PR correlation and scheduler mechanics;
  historical launchd evidence remains separate from this new transport evidence.
- Live feedback used structured question outcomes. The native interactive
  question-request handler has deterministic protocol coverage, rather than a
  separate live request-tool trial. Unsupported server requests remain failures.
- The production account guard still refuses an account with available credits,
  even when subscription allowance remains. The user-authorized test exception
  exists only in the opt-in live probe.
- The old separate-owner delivery and its failed archive remain unchanged.
  This version neither converts its records nor releases its claim. New host
  compatibility evidence is limited to Codex 0.159.2 on macOS.
- Encrypted child instructions remain unknown. Observed routes and returned
  effects do not establish the complete launch contract. No Claude adoption or
  general five-sample reliability claim follows from these results.

Validation did not alter a production schedule, grant, claim or GitHub effect.
No push was performed.
