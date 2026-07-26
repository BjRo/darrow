# Interruption-free ownership operator study

## Status and purpose

This protocol was frozen on 2026-07-23 and amended on 2026-07-26 before
collecting any observations under `interruption-free-ownership-v1`. The
amendment makes the goal prominent at every operator action and promotes the
patch plus a quick-view command at final inspection; it changes presentation,
not treatments, tasks, outcomes, or thresholds. This is an excluded follow-up
study, not an amendment to the three-treatment confirmatory gate and not
permission to open the confirmatory holdout.

The narrowed product hypothesis is:

> For a two-stage implementation and verification playbook on orchestrated
> software changes, Darrow can remove the required mid-run operator return while
> preserving deterministic quality and acceptable reliability.

The study tests workflow ownership, not whether an extra review invocation is
economically free. Active attention, wall time, and model usage remain visible
secondary outcomes. Explicit planning is intentionally absent and must be
tested as a separate factor.

## Design

The executable design is frozen in `operator-study.yaml`.

- Tasks: all three orchestrated pilot tasks; no confirmatory task is opened.
- Harnesses: Codex and Claude Code.
- Treatments: `manual-playbook` and `cli-playbook`.
- Repeats: one matched pair per task and harness, for 12 observations.
- Assignment: treatment order is counterbalanced by the frozen study seed.
- Model work: both treatments run the same implementation command skill and the
  same fresh-context verification-and-repair command skill through the same
  locked harness route.
- Operator contract: the manual treatment requires a second launch and one
  mid-run handoff; the CLI treatment receives one launch and owns both stages.

Each task/harness pair is run interactively. The timer starts only after the
operator returns to the terminal and confirms readiness, and stops when the
launch, handoff, or final inspection action is complete. Model waiting and time
away from the terminal are excluded. The final inspection is an eventual
completion check, not a mid-run return required to advance the playbook.

The operator must not inspect files merely because the evaluator displays their
paths. They should perform only the checks they would normally perform. They
must not modify the participant workspace or rescue a model during a cell.
Unexpected recovery work is recorded as an intervention rather than hidden.

## Outcomes

The primary outcome is quality-qualified unattended CLI completion: the cell
completes both playbook stages without a required mid-run return or operator
intervention and passes deterministic hidden verification.

The report also records:

- required launches, mid-run returns, and handoffs;
- completed playbook stages and unattended completion;
- deterministic quality and operational failures;
- operator interventions and active-attention intervals;
- paired wall-time, token, and provider-cost ratios.

The fixed 12-cell study supports the narrowed hypothesis only when every
criterion below passes:

1. all 12 timed observations are present as six complete matched pairs;
2. CLI requires zero mid-run returns while manual requires one per cell;
3. at least five of six CLI cells complete both stages unattended;
4. at least four of six CLI cells are quality-qualified unattended completions;
5. mean CLI deterministic quality is no lower than mean manual quality;
6. CLI has at most one intervention and at most one operational failure;
7. CLI/manual wall time is at most 1.75x; and
8. the largest available paired token or provider-cost ratio is at most 1.50x.

An incomplete block yields `incomplete`. A complete block that misses any
criterion yields `does-not-support`; interpretation cannot override it. A
passing block yields `supports-narrowed-hypothesis`. Because this is a small
pilot-derived study, a passing result justifies designing a larger independent
validation; it does not satisfy the confirmatory product gate by itself.

## Exclusions and stopping

The evaluator uses the existing product-value exclusion rules. Model failures,
timeouts, permission denials, waits for human input, and Darrow failures are
outcomes, not exclusions. The study stops at USD 50 or 30 million recorded
tokens. A harness version change, unavailable credentials, or an evaluator
defect affecting more than one matched pair pauses execution until repaired.

Raw observations remain immutable. Corrections use the existing digest-bound
reverification overlay and never replace original quality fields.
