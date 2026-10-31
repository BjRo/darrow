# Artificer lifecycle repairs: validation evidence

These October 30, 2026 repairs address the three external review points on
PR #280 at `009e47d92804bdaa2e20adc3871b15f8674ba139`. Each point had a separate
implementation agent. The owner updated the Artificer invariants first, integrated
the changes, and owns final checks, independent assessment and publication.

The evidence below distinguishes genuine behavioral red/green slices, positive
regression checks and fixture diagnosis. Recovery prompt wording was clarified
to distinguish a first goal after externally resolved preflight from a forbidden
replacement goal; mocked continuation does not establish live prompt obedience.
Prior implementation and live-transport evidence remains in
[the original research record](artificer-worker-revamp-2026-10-29.md).

## Broader local-check limitation

The repository-wide `bun run check:python` passed the first eight packages, then
stopped in the unchanged review backend. Its
`test_unavailability_reason_round_trips_without_inventing_spec` exceeded the
Hypothesis 200 ms deadline at 228.56 ms: 1 failed, 473 passed, 1 skipped.
A serial retry with
`bun run check:python --package plugins/capability/darrow-review/backend`
also reported a timing FlakyFailure: 518.07 ms initially and 167.47 ms on replay,
with the same 1 failed, 473 passed, 1 skipped. Serial execution did not establish
resolution. The review package and its deadline were left unchanged; these are
preserved baseline observations, not Artificer behavioral-red evidence or a
claim that all local repository checks passed. Current scoped checks and final
published-head CI are reported separately in the PR.

## Capacity and recovery repair evidence

Worktree: `/Users/bjro/Sources/darrow/.worktrees/feat/revamp-artificer-worker`.
Seam: documented `darrow-artificer` CLI `init`, `tick`, `recover`, `cancel`, and
`configure`; existing real filesystem/Git/process fixtures substitute external
native-host and GitHub services only. Normative ART-C8/C9 changes preceded edits.
Oracles: explicit recovery retains original session/worktree; released unfinished
work reacquires shared capacity and ownership; insufficient authority/capacity,
conflicting effects and unknown terminal eligibility refuse before continuation.

### Sequential red/green slices

1. Released unfinished delivery resumes after external blocker resolution.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_delivery_can_resume_original_session_after_blocker_resolution`: 1 failed; CLI rejected the released delivery with `Cannot recover a running or released delivery` after a real scheduled tick.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_delivery_can_resume_original_session_after_blocker_resolution`: 1 passed; original native identity/worktree retained, one recovery attempt consumed, source ownership reacquired and PR9 correlated. During green development the existing fake host needed its `ARTIFICER_ACTIVE_RESUME` mode to preserve the original native goal at resume: the initial attempted green instead reported `Original native goal disappeared`. That fixture correction is not product-red evidence.

2. Released work reacquires shared WIP capacity, including paused admission.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_must_reacquire_shared_capacity`: 2 failed; recovery launched when WIP was0 and when another worker consumed the sole slot (`DID NOT RAISE SystemExit`).

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_must_reacquire_shared_capacity`: 2 passed; both refuse without changing released state or spending a retry.

3. Recovery rechecks current writer authority and issue scope.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_rechecks_current_authority`: 2 failed; revoked writer permission and narrowed issue scope both still launched (`DID NOT RAISE SystemExit`).

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_rechecks_current_authority`: 2 passed; refusal precedes attempts and ownership effects.

4. Recovery refuses conflicting source-issue ownership or new nomination.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_refuses_conflicting_issue_ownership`: 3 failed; a new claimed label, another worker's delivery of the same issue, and a new ready nomination all still launched (`DID NOT RAISE SystemExit`).

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_refuses_conflicting_issue_ownership`: 3 passed; conflicting ownership is retained, old delivery stays released and retry count unchanged.

5. Recovery checks original worktree before reserving capacity.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_requires_original_worktree_before_reserving_capacity`: 1 failed; recover acknowledged a launch even with original worktree removed (`DID NOT RAISE SystemExit`).

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_requires_original_worktree_before_reserving_capacity`: 1 passed; synchronous original-worktree refusal, no capacity reservation, claim label or retry spent.

6. Recovery observes current publication before resuming.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_reconciles_publication_before_resuming`: 2 failed; unavailable publication evidence and a closed matching PR both allowed launch (`DID NOT RAISE SystemExit`).

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_released_recovery_reconciles_publication_before_resuming`: 2 passed; closed/unknown effects refuse without ownership or retry mutations.

7. An uncertain previous launch cannot be duplicated.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_uncertain_previous_launch_cannot_be_recovered_again`: 1 failed; retained `reserved`, `execution_ended=false`, missing process identity still allowed another resume (`DID NOT RAISE SystemExit`).

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_uncertain_previous_launch_cannot_be_recovered_again`: 1 passed; missing execution identity requires reconciliation, no retry consumed.

8. Explicit cancellation terminates released but still resumable work.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_cancel_can_end_released_but_resumable_work_without_reclaiming_capacity`: 1 failed; cancel rejected the still-resumable delivery with `Delivery is already released`.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_cancel_can_end_released_but_resumable_work_without_reclaiming_capacity`: 1 passed; state remains released, resume_allowed=false, original native identity/worktree preserved, no forge effects, subsequent recovery refused.

### Additional positive safety evidence (no invented red)

- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_terminal_or_unknown_deliveries_cannot_resume_after_release`: 3 passed for cancelled, completed and unknown historical eligibility. Existing records without the optional nullable `resume_allowed` field remain unknown and refuse rather than assuming unfinished work.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_resolved_preflight_blocker_can_activate_first_goal_in_original_session`: 1 passed. External Claude fixture stops for missing intent before any goal; after external resolution and explicit exact-session recovery, the same original session supplies the first prepared goal, and adapter enters `/goal` once without recipe re-entry. This path already supported first goal activation; it is honest positive coverage, not claimed TDD-red. It does not prove live prompt obedience or live engineering reliability.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py`: 16 passed before the final cancel-released slice was added.

### Implementation and coordination

- Owned product edits: `operations.py`, `admission.py`, `reconciliation.py`.
- Owned test additions: `test_released_recovery_cli.py`; adjusted expected stopped status in `test_reconciliation_cli.py` because finding an open PR does not prove engineering completion.
- Shared dependency implemented by Claude lifecycle agent: `Claim.resume_allowed: bool | None = None`; worker.finish records True for confirmed stopped outcomes and False for accepted completed delivery; cancellation persists False. Exact grant correlation remains enforced by `Installation.claim`.
- Reconciliation preserves needs-attention/cancelled status for an open PR while retaining its WIP slot; original F2 agent supplied its separate genuine red/green CLI evidence for that consequence.
- Read-only publication observation is split from ownership marking so preflight cannot produce PR-label effects before a recovery reservation. Repository lock spans all rechecks, durable reservation, source-issue reacquisition and native launch.
- Canonical broad Python/coverage and final-tree acceptance/review are root obligations after all three agents' edits settle. No commits, pushes, reviews or goal ownership occurred in this implementation assignment.

### Final observed focused gates

- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py plugins/automation/darrow-artificer/backend/tests/test_management_cli.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_cli.py`: **33 passed in59.06s**, including all17new lifecycle cases and existing management/reconciliation callers.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff check plugins/automation/darrow-artificer/backend/src/darrow_artificer/operations.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/reconciliation.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/admission.py plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_cli.py`: **All checks passed**.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend mypy --config-file plugins/automation/darrow-artificer/backend/pyproject.toml plugins/automation/darrow-artificer/backend/src plugins/automation/darrow-artificer/backend/tests`: **Success: no issues found in40source files**.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff format plugins/automation/darrow-artificer/backend/src/darrow_artificer/operations.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/reconciliation.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/admission.py plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py`: formatted owned production/test changes before final successful focused gates.

### Owner integration: failed-signal cancellation race

The root found this direct consequence before any independent assessment began;
it remains part of the same initial combined repair. Root explicitly authorized
this agent to make the small `worker.finish` correction after observing red.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_failed_signal_does_not_erase_cancellation_when_native_worker_finishes`: **1 failed**, `assert finished.resume_allowed is False` observed **True**. A real native subprocess was held using the existing external host fixture; the only additional replacement was the external OS `os.killpg` boundary raising PermissionError. CLI cancellation persisted False and needs-attention after the failed signal, then the original worker completed and overwrote eligibility.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py::test_failed_signal_does_not_erase_cancellation_when_native_worker_finishes`: **1 passed**. `worker.finish` now preserves a persisted False while incorporating the native outcome, so finished work cannot resurrect cancellation intent; explicit recovery is refused and no retry is spent. Real worker, process identity/group observation, cancel_process and finish behavior were not mocked.

- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff check plugins/automation/darrow-artificer/backend/src/darrow_artificer/worker.py plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py`: **All checks passed**.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff format --check plugins/automation/darrow-artificer/backend/src/darrow_artificer/worker.py plugins/automation/darrow-artificer/backend/tests/test_released_recovery_cli.py`: **2 files already formatted**.

The preceding33-test and40-file Mypy results predate this one additional regression
and small worker correction. Root owns rerunning final-tree canonical quality
after this settled handoff; no broad gate was run concurrently here.

## Artificer feedback F2 — Claude lifecycle repair

Repository: `/Users/bjro/Sources/darrow/.worktrees/feat/revamp-artificer-worker`

Accepted oracle: feedback finding 2 and amended `docs/specs/artificer.md` ART-C4.
Public seam: documented Artificer `init`, `tick`, `status`, and `recover` CLI;
real Git repositories, delivery processes and persisted state. Only external
Claude/GitHub processes are controlled fixtures. Neither a model's structured
`pr-open` result nor dispatch of `/goal` proves the native goal completed.

### Sequential TDD evidence

1. Claude cannot bypass prepared native goal activation.

   Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_claude_lifecycle_cli.py::test_claude_cannot_complete_without_native_goal_handoff`: 1 failed; observed `pr-open`, expected `needs-attention` (line26). Product lifecycle acceptance was unchanged before this run.

   Added the missing-goal completion guard. The identical command then reached
   a second failure: scheduled reconciliation changed the correct initial
   `needs-attention` back into `pr-open` (line35). Capacity agent's owned
   reconciliation repair preserves stopped status for an open PR.

   Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_claude_lifecycle_cli.py::test_claude_cannot_complete_without_native_goal_handoff`: 1 passed in 2.02s. Assertions retain original native identity, actual labeled PR, source-issue blocker report and capacity on a subsequent scheduled tick.

2. Prepared `/goal` handoff cannot substitute for independent completion evidence.

   Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_claude_lifecycle_cli.py::test_claude_goal_handoff_does_not_prove_goal_completion`: 1 failed; observed `pr-open`, expected `needs-attention` (line52). The post-handoff acceptance path remained unchanged before this run.

   Required completion evidence on both initial/resumed result acceptance and
   after client-side `/goal` activation. Current supported Claude stream has no
   bound native-goal completion signal, so it fails closed with the specific
   evidence gap. Publication reconciliation, rather than the model's PR number,
   discovers and validates the actual PR.

   Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_claude_lifecycle_cli.py::test_claude_goal_handoff_does_not_prove_goal_completion`: 1 passed in 2.25s. Assertions cover exact original session handoff, retained objective, actual owned PR and blocker report, and stopped state after another tick.

### Shared-file integration

- F1 implementor supplied a meaningful failing public CLI recovery regression
  before adding `Claim.resume_allowed: bool | None = None` and setting it from
  confirmed worker outcomes. Unknown older records remain unknown; actual
  accepted `pr-open` is terminal, confirmed stopped work remains eligible.
- F3 implementor supplied genuine red on both hosts for incidental successful
  tool reads renewing the incident budget. Removed Claude's tool-result reset;
  reset now occurs only after original initialization, a valid structured result,
  `subtype: success` and `is_error: false`. The F3 implementor owns the identical
  command's green evidence and retry boundary tests.
- Existing PR-success/head/base/missing/closed validation tests now select Codex,
  whose native goal completion can be independently observed. Assertions remain
  unchanged. New Claude tests explicitly retain its distinct stopped outcome.
- Existing missing-worktree recovery test now expects synchronous preflight
  refusal, with original native/process/attempts unchanged and no new worktree.

### Observed checks

- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_claude_lifecycle_cli.py plugins/automation/darrow-artificer/backend/tests/test_protocol_rejections.py`: 17 passed in34.12s (before synchronous missing-worktree expectation maintenance).
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_protocol_rejections.py::test_recovery_never_recreates_missing_worktree`: 1 passed in1.74s after that maintenance.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_management_cli.py::test_open_artificer_pr_holds_wip_until_closed plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_rejects_unrelated_pr_result plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_rejects_wrong_pr_base`: 3 passed in7.03s after selecting the lifecycle-verifiable host; all three failed with the intended new Claude refusal before fixture maintenance.
- Scoped Ruff lint: all checks passed across claude.py, models.py, worker.py,
  test_claude_lifecycle_cli.py, service_stub.py, test_management_cli.py,
  test_protocol_rejections.py and test_worker_cli.py.
- Scoped Ruff formatting: initial fixture ternary required formatting, corrected;
  repeated check reported8files already formatted.
- `uv run --frozen --group dev mypy` from the backend directory: success, no issues
  in40source files at that observation.

- Repeated the full lifecycle+protocol command after synchronous-worktree test
  maintenance:17passed in32.08s.
- Added controlled-host `prepared-on-resume` fixture mode for capacity agent's
  positive first-goal-after-resolved-blocker acceptance check. It requests a
  prepared goal until an actual `/goal` invocation is observed; it does not
  inspect prompt prohibition wording or fabricate red evidence. Ruff lint and
  formatting on service_stub.py passed after this fixture addition.

Root owns final current-tree canonical `bun run check:python`, independent repair
verification, documentation, versioning and publication; none claimed here.

### Primary host evidence and limits

- Installed `claude --version`: `2.1.309 (Claude Code)`.
- Installed `claude --help` exposes native session/resume and structured streaming
  but no native-goal status control endpoint.
- [Official Claude goal documentation](https://code.claude.com/docs/en/goal)
  describes distinct met, impossible and unrecoverable-error exits, plus a
  no-progress stop that can leave a goal active. Achieved goals are not restored
  on resume. Therefore process/turn completion alone cannot establish achieved
  goal completion.
- [Official SDK result reference](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage)
  distinguishes result success and loop termination reasons. Its exposed result
  type has no native goal identity/completion field. This supports an evidence
  gap in this adapter, not a universal claim about all future Claude protocols.
- [Official agent-loop documentation](https://code.claude.com/docs/en/agent-sdk/agent-loop)
  describes the initialized session, tool/results and final result lifecycle.

No paid live engineering run, production delivery reliability claim, transcript
archive, private host-state scraper, invented lifecycle event or permission
bypass was introduced. Claude may produce a PR, but Artificer currently reports
that delivery as needing attention until native goal completion is established
through a supported independent mechanism.

## Artificer feedback F3 — native turn recovery boundary

Repository: `/Users/bjro/Sources/darrow/.worktrees/feat/revamp-artificer-worker`.
Public seam: documented Artificer CLI `init`, `tick`, and saved status/claim
observed after real worker subprocess termination. Git/filesystem/process state
is real; only external host and GitHub services are substituted. Oracle: accepted
ART-C9 requires at most two retries until a successful native turn completes,
not until any incidental tool succeeds. No substantive engineering-operation
retry guarantee is claimed.

### Slice 1 — successful incidental tool cannot renew an incident

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py::test_successful_tool_read_does_not_renew_interruption_budget`: both Codex and Claude failed, each retaining three recovery attempts where two were expected. Product code unchanged at this red. The external host emitted a successful tool result on its first resume before the same temporary failure recurred.

Removed Codex item/completed reset; coordinated Claude change with the F2 agent
after sending it this observed red. Claude now resets only at a validated,
initialized, non-error successful native terminal result.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py::test_successful_tool_read_does_not_renew_interruption_budget`: 2 passed in 10.61s. Exactly three launches (original + two resumes), identical native identity, two consumed attempts, needs-attention/exhausted state.

### Slice 2 — completed native turn closes prior incident

Initial fixture diagnosis: a first attempted fixture failed because its mocked
native goal disappeared on resume. That was not counted as behavioral red. Fixed
only the external fixture to retain the original goal and removed the tentative
product callback before obtaining this genuine red.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py::test_completed_native_turn_starts_a_new_interruption_budget`: Codex stopped with "Native recovery unavailable or two attempts exhausted" and two total retries instead of the expected three. The original incident interrupted once, then a valid successful native turn completed while its goal remained active, then a separate interruption recurred twice.

Added the reset only after the successful native turn and valid observed outcome,
preserving native goal identity and existing continuation behavior.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py::test_completed_native_turn_starts_a_new_interruption_budget`: 1 passed in 6.18s. Four launches, one native identity, three total retries across the two incidents, and zero attempts left in the counter after final successful native completion. Later expanded this test with a Claude successful prepared-goal turn followed by a new interruption: the cross-host file passed 4 cases in 22.64s. Claude has five invocations because prepared goal activation itself uses another native turn.

### Slice 3 — malformed completed result cannot renew an incident

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py::test_malformed_completed_turn_cannot_renew_interruption_budget`: 1 failed; three retries instead of two after an active-goal turn supplied an invalid structured result. This was observed against the slice-2 implementation before its correction.

Moved the callback past the valid-outcome check. A malformed active-turn response
may continue native observation, but cannot replenish its interruption budget.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py::test_malformed_completed_turn_cannot_renew_interruption_budget`: 1 passed in 4.88s.

### Final focused validation

- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_successful_native_turn_resets_interruption_budget plugins/automation/darrow-artificer/backend/tests/test_protocol_rejections.py::test_progress_before_an_interruption_does_not_add_retries`: 8 passed in 37.72s.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_recovery_observes_existing_active_turn_without_resubmission`: 1 passed in 2.93s. Pending native turn is observed without duplicate submission.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff format plugins/automation/darrow-artificer/backend/src/darrow_artificer/native.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/session.py plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py plugins/automation/darrow-artificer/backend/tests/retry_boundary_host.py`: 1 file formatted, 3 unchanged.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff check plugins/automation/darrow-artificer/backend/src/darrow_artificer/native.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/session.py plugins/automation/darrow-artificer/backend/tests/test_retry_boundary_cli.py plugins/automation/darrow-artificer/backend/tests/retry_boundary_host.py`: all checks passed.
- From the backend directory: `uv run --frozen --group dev mypy --strict src/darrow_artificer/native.py src/darrow_artificer/session.py tests/test_retry_boundary_cli.py tests/retry_boundary_host.py`: success, 4 source files.

Full current-tree Python coverage and repository gates belong to the root
integrator after all three assignments settle. No live native-host reliability
claim, no commit/publication, no native goal control, and no independent review
was performed by this implementation assignment.

Owned product changes: `session.py`, `native.py`. Codex callback wiring in
`codex.py` already applies correctly and did not need editing. New test files:
`tests/test_retry_boundary_cli.py`, `tests/retry_boundary_host.py`. Migrated the
old successful-tool reset expectation in `test_worker_cli.py` to assert reset
after a successful native turn; other agents own that file's PR tests.

## Later integrated fixture maintenance

Root's complete163-test gate at the integrated candidate failed exactly three
older fixture scenarios (160passed,3failed in238.95s). Actual retained diagnostic:
`/tmp/artificer-lifecycle-fixture-failures.log`. No edits were made while that gate
was running; root authorized this bounded maintenance after inspecting results.

Only `test_review_repairs_cli.py` changed in this later assignment:

- `test_new_pr_receives_ownership_marker` and
  `test_reservation_and_labeled_pr_consume_one_slot` select Codex because their
  scenarios require independently completed PR delivery. Original substantive
  ownership and capacity assertions remain unchanged.
- `test_recovery_refuses_another_active_ticket_in_same_worker` starts with
  unfinished Claude work, releases its capacity, then starts the second held
  delivery. A completed delivery is now terminal, so it cannot supply the
  recoverable first ticket required by this scenario. Original other-active
  refusal and both process identity assertions remain unchanged.

This is fixture maintenance after intentional lifecycle semantics changed, not
new product implementation or a claimed TDD behavior slice.

Observed command:

`uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_new_pr_receives_ownership_marker plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_reservation_and_labeled_pr_consume_one_slot plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_recovery_refuses_another_active_ticket_in_same_worker`

Result:3passed in8.91s.

`uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff check plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py`: all checks passed.

`uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff format --check plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py`:1file already formatted.

`uv run --frozen --group dev mypy` from the backend directory: success, no issues
in40source files. No product files, other tests, goal state, publication or
review artifacts changed in this maintenance assignment.

## Preserve established delivery blockers during reconciliation

Worktree: `/Users/bjro/Sources/darrow/.worktrees/feat/revamp-artificer-worker`.

Original independent assessment (complete finding and report read before edits):
`/Users/bjro/.darrow/reviews/f61c5129a2fbe6adc114b58cfb94646e4df119c678d4c2f2e453740569c599be/darrow-review.57einod1/result.json`
and sibling `review.md`/`scope.json`.
Target: `WORKTREE@009e47d92804bdaa2e20adc3871b15f8674ba139+759b342511ddde09a5ee6d20433d9dbb2b9d8419`.
Original finding: medium, blocking, Spec, `reconciliation.py:78`; failed scheduled
publication reconciliation replaced Claude's native-goal completion evidence gap,
and restored GitHub access preserved only the generic operational error.

Root updated ART-C4 before this bounded repair. This implementation assignment
does not assess its own fix or allocate any repair budget.

### Contract and public seam

Exercise the documented worker CLI with real Git/filesystem/process execution.
The unchanged existing external Claude and GitHub fixture supplies prepared-goal
handoff, PR publication, and unavailable/restored GitHub publication observation.
No worker, reconciliation, reporting, process or model code is mocked. Assert
public status, eventual source-issue comment, actual PR ownership/correlation,
and repository WIP admission. This is deterministic protocol evidence, not proof
of production native delivery reliability or independent Claude goal completion.

### Observed sequential slice

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py::test_native_completion_gap_survives_publication_outage_and_reconciliation`: **1 failed in2.18s**. The native session completed its prepared `/goal` handoff and published PR9, but no publication lookup was available initially. The first scheduled failed tick changed public `detail` from `independently observed native goal completion` to `Reconciliation needs attention: ... returned non-zero exit status 1`; the specific originating blocker assertion failed as required before product edits.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py::test_native_completion_gap_survives_publication_outage_and_reconciliation`: **1 passed in5.81s**. The test drives two failed scheduled ticks, restores GitHub publication lookup, then confirms needs-attention and the original completion gap persist. PR9 is correlated and labeled `artificer:claimed`; one eventual blocker comment includes the original gap and PR URL, and another tick does not duplicate it. A second worker can admit one ready issue at WIP2, proving the retained reservation and its owned PR count once together.

### Product changes

- `Claim.reconciliation_error: str = ""` is an optional additive operational
  field, exposed through existing status serialization and compatible with older
  saved records. It holds the current transient reconciliation error separately.
- Failed reconciliation preserves a nonempty established `detail` while moving
  into needs-attention; when no delivery detail exists, the operational diagnostic
  supplies it. Repeated failures overwrite the operational field rather than
  repeatedly appending text to the original blocker.
- Successful authoritative publication observation clears the transient
  reconciliation error. It preserves the existing needs-attention lifecycle gap,
  source reporting state and all capacity/ownership safeguards.
- No source prompt, native-goal completion gate, cancellation eligibility,
  recovery budget or ownership authority was weakened. No review, commits,
  pushes or goal ownership occurred in this implementation assignment.

Root owns final-tree canonical quality, documentation/version integration,
candidate pinning and fresh targeted independent verification.

### Terminal lifecycle preservation within the same bounded repair

Root identified that an established positive completion or confirmed cancellation
is not a delivery blocker. The operational error field must preserve those
terminal dispositions during an API outage rather than permanently converting
them into needs-attention. A second sequential CLI slice covers that direct
consequence without adding a controller or state framework.

Red — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py::test_transient_publication_failure_preserves_terminal_delivery_disposition`: **2 failed in4.20s**. A completed Codex delivery changed from `pr-open` to `needs-attention`, and an explicitly cancelled delivery changed from `cancelled` to `needs-attention`, when the external GitHub REST publication boundary temporarily raised OSError.

Green — `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py::test_transient_publication_failure_preserves_terminal_delivery_disposition`: **2 passed in4.55s**. Reconciliation keeps `pr-open` and `cancelled` dispositions and their original details, stores the current outage separately, and preserves `resume_allowed=False`. After restoration, a completed open PR remains `pr-open`; cancellation with no PR releases capacity. The operational error clears on successful publication observation. Other uncertain/nonterminal states still enter needs-attention with a meaningful diagnostic when no prior delivery blocker exists.

The final product delta is deliberately small: the optional operational field,
clear-on-authoritative-publication behavior, and an exception path that preserves
both terminal disposition and any prior blocker. Existing multiple-PR caller
coverage now checks that its original blocker remains in `detail` while the
operational conflict is visible in `reconciliation_error`.

### Focused caller and static gates

- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_cli.py plugins/automation/darrow-artificer/backend/tests/test_claude_lifecycle_cli.py plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py`: **19 passed in41.98s** after both product slices. An earlier intermediate run was16passed/1failed because the old multiple-PR diagnostic assertion expected destructive replacement of `detail`; it was updated to the accepted separate diagnostic contract, retaining both assertions.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend pytest -q plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py`: **3 passed in8.64s** after test-only cleanup moving the external REST fake to module scope to satisfy the repository complexity ceiling.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff check plugins/automation/darrow-artificer/backend/src/darrow_artificer/models.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/reconciliation.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_cli.py`: **All checks passed**. Earlier test-complexity failure was addressed by the test-only external fake cleanup; no waiver or lint suppression was added.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend mypy --config-file plugins/automation/darrow-artificer/backend/pyproject.toml plugins/automation/darrow-artificer/backend/src plugins/automation/darrow-artificer/backend/tests`: **Success: no issues found in41source files**.
- `uv run --frozen --group dev --project plugins/automation/darrow-artificer/backend ruff format --check plugins/automation/darrow-artificer/backend/src/darrow_artificer/models.py plugins/automation/darrow-artificer/backend/src/darrow_artificer/reconciliation.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_blocker_cli.py plugins/automation/darrow-artificer/backend/tests/test_reconciliation_cli.py`: **4files already formatted**.

Settled owned files: `src/darrow_artificer/reconciliation.py`,
`src/darrow_artificer/models.py`, new `tests/test_reconciliation_blocker_cli.py`,
and one intended diagnostic expectation in `tests/test_reconciliation_cli.py`.
No edits outside that authorized product/test scope. Root still owns all final
canonical coverage/checks and the separate fresh targeted follow-up assessment.
