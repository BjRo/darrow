# Task quality and bookkeeping report validation

This milestone adds a Darrow-owned report over public Sevro CLI results and
retained evidence. The generic task verdict and its required bookkeeping checks
remain intact. Report rates distinguish task quality from record completeness;
they preserve execution, grading, activation, and the existing task failure gate.
Invalid report inputs also fail the suite.
Synthetic host adapters replace model calls. This evidence does not establish
live model stability or historical rate equivalence.

## Observed test-first slice

Red — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-suite.test.ts -t "suite gates requested evaluation records independently of existing task checks|suite preserves dry and adaptive-delivery record exceptions"'`:
both cases failed because the suite retained no `qualityReport`. Existing
assertions already confirmed a failed public task for a correct answer missing
a bookkeeping record, and a dry run's unassessed public task.

Green — the same command passed two cases with 54 assertions. The correct
answer had quality rate one even when bookkeeping failed and its public task
remained failed. The group retained record rate one-half. Dry measurements
stayed null, while the adaptive-delivery exception and an omitted record policy
remained not requested.

The first implementation passed the live distinction but mistook the empty dry
check list for an omitted policy. Sevro does not emit check outcomes for an
unexecuted trial. The suite now retains Darrow's resolved record declaration,
and the report consults it before assessing those outcomes. This was a report
implementation defect, not an assertion repair. A separate lint check required
splitting input validation into smaller functions; no commit hook was bypassed.

## Additional guards and limits

Public-command guards retain task-check failures, unavailable owner-route
evidence, candidate execution failure, malformed semantic grading output, and
cancelled trials without successful quality rates. Groups keep conditions and
candidate routes separate and do not average over unavailable trials. Report
JSON and Markdown retain the original public task and execution/grading states.
These guards make no additional test-first red claim. Installed-package parity
runs the same fixtures with `SEVRO_CHECKOUT` cleared.

The execution-failure fixture initially paired a successful passive trial with
a failed trial whose actual condition was unknown. Their separate report groups
were correct. The control now reports the same unknown actual condition, so the
fixture can verify that one unavailable trial leaves their shared group rate
unknown. This corrected a fixture expectation, not the grouping policy.

## Review repairs

Independent review found two invalid-input gaps: duplicate quality check IDs
only made their assessment unavailable, and the report validated selected evidence
fields without applying the complete public evidence schema.

Red — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-suite.test.ts -t "suite rejects invalid quality report inputs"'`:
both public-command fixtures failed. Duplicate checks still produced public task
rate one, while omitted required trial usage still produced quality rate one.
The fixtures deliberately alter public CLI artifacts before reporting and retain
their exact bytes as the input baseline.

Green — the same two fixtures passed with 20 assertions after the repair.
The report now validates the complete public run-evidence schema with its CLI
schema reference, and rejects duplicate check IDs before assessing any trial.
Invalid rows retain diagnostics and null rates; the suite fails. Assertions
confirm both input result and evidence bytes remain unchanged. The schema
snapshot is a public contract, with no Sevro implementation imports.

## Policy limits

The default quality metric applies to the default task policy. A selected
custom policy remains in retained trial evidence and has no inferred quality
rate; its public task verdict is still authoritative. Raw advisory and activation
evidence remains separate. Historical legacy arrays still need their own
interpreter before the legacy report can be removed.
