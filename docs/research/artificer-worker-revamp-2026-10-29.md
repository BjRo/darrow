# Artificer worker revamp: validation evidence

This records the October 29, 2026 implementation evidence for the confirmed
native-session worker boundary in [the Artificer specification](../specs/artificer.md).
The public seam is the documented Artificer CLI. External GitHub and native-host
protocol fixtures provide observable effects; product orchestration is not mocked.

## Test-first delivery slices

Each slice below was run red before its implementation and green with the same
literal command before proceeding. These are development observations, not
historical reliability estimates. Additional concurrency, management, malformed
protocol, reconciliation, storage, and native-goal checks are regression coverage.

### 1. test_init_uses_existing_host_configuration

Red: Initialization still required explicit plugin/account-copy options.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_init_uses_existing_host_configuration -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_init_uses_existing_host_configuration -q
```

### 2. test_workers_share_repository_capacity

Red: A second worker installation for the repository was refused.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_workers_share_repository_capacity -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_workers_share_repository_capacity -q
```

### 3. test_tick_runs_one_ticket_per_worker_with_shared_claims

Red: One worker admitted a second active delivery.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_tick_runs_one_ticket_per_worker_with_shared_claims -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_tick_runs_one_ticket_per_worker_with_shared_claims -q
```

### 4. test_claude_delivery_uses_native_profile

Red: Claude delivery attempted the removed archive-key path.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_claude_delivery_uses_native_profile -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_claude_delivery_uses_native_profile -q
```

### 5. test_codex_delivery_uses_native_profile

Red: Codex delivery attempted the removed archive-key path.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_codex_delivery_uses_native_profile -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_codex_delivery_uses_native_profile -q
```

### 6. test_delivery_requires_core_but_not_optional_plugins

Red: A missing review capability still reached a native result.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_requires_core_but_not_optional_plugins -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_requires_core_but_not_optional_plugins -q
```

### 7. test_new_delivery_starts_from_latest_main

Red: The worktree used the old local SHA instead of freshly fetched main/master.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_new_delivery_starts_from_latest_main -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_new_delivery_starts_from_latest_main -q
```

### 8. test_stopped_delivery_reports_blocker_on_source_issue

Red: The stopped delivery produced no blocker comment.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_stopped_delivery_reports_blocker_on_source_issue -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_stopped_delivery_reports_blocker_on_source_issue -q
```

### 9. test_stopped_delivery_without_pr_releases_capacity

Red: Ended delivery without a PR retained its reservation.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_stopped_delivery_without_pr_releases_capacity -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_stopped_delivery_without_pr_releases_capacity -q
```

### 10. test_ambiguous_launch_keeps_reservation

Red: An uncertain launch incorrectly released ownership.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_ambiguous_launch_keeps_reservation -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_ambiguous_launch_keeps_reservation -q
```

### 11. test_delivery_rejects_unrelated_pr_result

Red: An unrelated branch's PR was accepted.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_rejects_unrelated_pr_result -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_rejects_unrelated_pr_result -q
```

### 12. test_native_recovery_is_bounded_and_preserves_identity

Red: Only one native attempt occurred instead of the original plus two retries.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_native_recovery_is_bounded_and_preserves_identity -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_native_recovery_is_bounded_and_preserves_identity -q
```

### 13. test_successful_native_progress_resets_interruption_budget

Red: Useful progress did not reset the interruption budget.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_successful_native_progress_resets_interruption_budget -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_successful_native_progress_resets_interruption_budget -q
```

### 14. test_explicit_recovery_resumes_original_native_session

Red: Recovery required a removed archive.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_explicit_recovery_resumes_original_native_session -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_explicit_recovery_resumes_original_native_session -q
```

### 15. test_status_refuses_invalid_shared_capacity

Red: Invalid string, boolean, and negative shared capacity were accepted.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_status_refuses_invalid_shared_capacity -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_status_refuses_invalid_shared_capacity -q
```

### 16. test_native_process_interruption_recovers_original_session

Red: A recoverable process interruption recorded no retry.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_native_process_interruption_recovers_original_session -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_native_process_interruption_recovers_original_session -q
```

### 17. test_recovery_observes_existing_active_turn_without_resubmission

Red: Recovery submitted a second turn while the original was active.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_recovery_observes_existing_active_turn_without_resubmission -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_recovery_observes_existing_active_turn_without_resubmission -q
```

### 18. test_headless_claude_uses_native_goal_entry

Red: The corrected fixture exposed missing explicit recipe entry before native goal activation.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_headless_claude_uses_native_goal_entry -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_headless_claude_uses_native_goal_entry -q
```

### 19. test_codex_inherits_profile_with_default_effort

Red: A native profile with null reasoning effort was rejected.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_codex_inherits_profile_with_default_effort -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_codex_inherits_profile_with_default_effort -q
```

### 20. test_schedule_preserves_existing_profile_locations

Red: The scheduled worker lost the existing CODEX_HOME configuration location.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_management_cli.py::test_schedule_preserves_existing_profile_locations -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_management_cli.py::test_schedule_preserves_existing_profile_locations -q
```

### 21. test_question_is_reported_as_blocker_without_reply_loop

Red: The reported blocker omitted the owner's full question.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_question_is_reported_as_blocker_without_reply_loop -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_question_is_reported_as_blocker_without_reply_loop -q
```

### 22. test_delivery_rejects_wrong_pr_base

Red: A PR targeting the wrong base was accepted.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_rejects_wrong_pr_base -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_rejects_wrong_pr_base -q
```

### 23. test_status_identifies_worker_and_absolute_state

Red: Status omitted the worker identifier.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_status_identifies_worker_and_absolute_state -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_status_identifies_worker_and_absolute_state -q
```

### 24. test_worker_is_independent_of_parent_claude_session

Red: The parent CLAUDECODE marker prevented a fresh native session.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_worker_is_independent_of_parent_claude_session -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_worker_is_independent_of_parent_claude_session -q
```

### 25. test_ambiguous_native_recovery_launch_holds_capacity

Red: A stale old process pointer released an uncertain recovery launch.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_ambiguous_native_recovery_launch_holds_capacity -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_ambiguous_native_recovery_launch_holds_capacity -q
```

### 26. test_delivery_preserves_existing_permission_profile

Red: The adapter forced native permission overrides.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_preserves_existing_permission_profile -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_delivery_preserves_existing_permission_profile -q
```

### 27. test_operational_trace_does_not_copy_native_conversation

Red: A private native-conversation canary appeared in the operational trace.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_operational_trace_does_not_copy_native_conversation -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_operational_trace_does_not_copy_native_conversation -q
```

### 28. test_codex_accepts_strict_native_result_schema

Red: Codex rejected a strict result schema whose required list omitted goal.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_codex_accepts_strict_native_result_schema -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_worker_cli.py::test_codex_accepts_strict_native_result_schema -q
```

## Deterministic checks

`bun run check:python --package plugins/automation/darrow-artificer/backend`
passed Ruff formatting/lint, strict Mypy, and all 129 tests. Measured product
coverage was 98.53% statements and 95.04% branches. Subprocess coverage is
aggregated before the unchanged 95% gates. External service fixtures are excluded
from measurement; actual Artificer child workers are measured.

`bun run check:docs` passed for 249 Markdown pages and 16 plugins before this
research page was added. The frozen copied-runtime smoke check
`uv run --quiet --frozen --no-dev --project plugins/automation/darrow-artificer/backend python plugins/automation/darrow-artificer/backend/tests/fresh_install.py`
also passed.

## Native transport probes

Bounded, read-only probes used Codex 0.165.0 and Claude Code 2.1.309 with the
existing local profiles. These prove transport and history behavior, not
unattended production engineering reliability or compatibility with every profile.

The Claude probe exposed that nesting a user-only recipe under `/goal` does not
invoke that recipe. The earlier fixture expectation was invalid and was corrected.
The successful probe explicitly entered the recipe, obtained its prepared native
goal objective after read-only preflight, and resumed the original session to
activate that objective. The session remained
`7a298034-fe7e-4fa2-9717-c059e7200646`. Temporary inert capability fixtures supplied
the probe contract. This probe preceded removal of forced permission overrides;
the durable profile-preservation regression covers that final change.

The Codex probe exposed a strict-schema error: every schema property must be
listed in `required`, including nullable `goal`. After its regression-driven fix,
the probe created and completed a native goal, then resumed thread
`01a18852-5bbb-7ba2-9560-a64dc4fc25d4` in a second process and recalled a history
canary. It observed the inherited `gpt-6.1-sol` / `high` route. The probe used only
native goal controls and produced no engineering, Git, or GitHub effects.

## Recipe evaluation

The same recipe evaluation command was run before and after the dual-host
unattended-entry change:

```sh
bun evals/runner/run.ts --case ticket-to-pr-unattended-grant --harness claude --trials 1 --jobs 1 --owner-evaluation passive
```

The red run rejected Claude because the old unattended reference was Codex-only.
The task-green run passed all seven task checks. Native activation collection
remained unavailable, so the overall runner exited 1; this is not a fully passing
activation evaluation. Explicit expansion and a direct fixture read did not
produce the collector's expected Skill-call observation.

The headless fixture now explicitly supplies the complete public Adaptive Goal
fixture path, since that capability was absent from its native Skill menu.
Trying project-settings forwarding was rejected by Sevro's isolated-native-goal
requirement; isolation was retained.

Retained attempt/run identities:

| Observation                                      | Attempt                                | Run                                    |
| ------------------------------------------------ | -------------------------------------- | -------------------------------------- |
| Fixed-fixture red                                | `b900506d-3939-427c-bf42-f3a1773d73fe` | `7d8f51e6-01d0-4108-a736-36e44b97fa2f` |
| Seven task checks passed; activation unavailable | `ab072214-f070-4c91-944e-e33a6f850c2d` | `6fd23454-2943-4c5f-82e4-90d360d5eb99` |

Local runner artifacts live under `evals/results/attempts/` and are ignored.
These single trials do not establish comparative reliability or success rates.

## Independent-review repair slices

The initial independent review returned four Spec blockers and two nonblocking
Standards advisories. One combined owner repair addressed the four blockers;
the exception-cause and eval-fixture-sharing advisories remain unattempted.
The following additional CLI slices record their observed red/green sequence.

### Repair 1. test_labeled_pr_without_local_claim_controls_wip

Red: A labeled open Artificer PR without local state admitted another ticket at WIP one.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_labeled_pr_without_local_claim_controls_wip -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_labeled_pr_without_local_claim_controls_wip -q
```

### Repair 2. test_new_pr_receives_ownership_marker

Red: The new PR lacked the Artificer ownership label.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_new_pr_receives_ownership_marker -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_new_pr_receives_ownership_marker -q
```

### Repair 3. test_reservation_and_labeled_pr_consume_one_slot

Red: The reservation and its labeled PR consumed two slots and prevented the next ticket at WIP two.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_reservation_and_labeled_pr_consume_one_slot -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_reservation_and_labeled_pr_consume_one_slot -q
```

### Repair 4. test_recovery_refuses_another_active_ticket_in_same_worker

Red: Recovery started while another ticket was active instead of refusing.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_recovery_refuses_another_active_ticket_in_same_worker -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_recovery_refuses_another_active_ticket_in_same_worker -q
```

### Repair 5. test_explicit_recovery_cannot_renew_exhausted_incident

Red: Explicit recovery accepted an exhausted incident and reset its counter.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_explicit_recovery_cannot_renew_exhausted_incident -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_explicit_recovery_cannot_renew_exhausted_incident -q
```

### Repair 6. test_stopped_report_includes_pr_published_before_native_failure

Red: The source report omitted the matching PR after an incomplete native result.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_stopped_report_includes_pr_published_before_native_failure -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_stopped_report_includes_pr_published_before_native_failure -q
```

### Repair 7. test_unknown_publication_defers_report_until_reconciliation

Red: Deferred publication reporting left local status without a next action.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_unknown_publication_defers_report_until_reconciliation -q
```

Green: passed.

```sh
uv run --project plugins/automation/darrow-artificer/backend --frozen --group dev pytest plugins/automation/darrow-artificer/backend/tests/test_review_repairs_cli.py::test_unknown_publication_defers_report_until_reconciliation -q
```
