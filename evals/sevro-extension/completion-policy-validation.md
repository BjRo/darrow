# Legacy completion-policy reconciliation

The current [adaptive-delivery completion contract](../../docs/specs/adaptive-goal.md#completion)
requires concise outcome and verification evidence. It does not require an exact
serialization, canonical report prefix, route telemetry row, child counter, or
interruption counter. The public extension preserves bounded ownership,
readiness, and internal-record checks without parsing the retired completion
report. This reconciles the remaining `goal-report.test.ts` expectations before
its removal at the published-package cutover.

## Disposition of the legacy tests

| Legacy example                                              | Current disposition and evidence                                                                                                                                                                                                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One leading, contiguous, ordered report                     | Retire the fixed report grammar. The completion contract accepts human-readable evidence without the legacy header or field ordering.                                                                                                                                       |
| Duplicate reports and malformed report-local fields         | Retire validation of the removed report format. Current grades require unique, complete observations from the expected host; ambiguous evidence remains unavailable.                                                                                                        |
| Optional report after a complete feedback question          | Retire the optional report placement. Public feedback checks preserve the accepted owner and the actual follow-up boundary; see the feedback tests in `sevro-extension.test.ts`.                                                                                            |
| Terminal report after a complete non-ready readiness result | Retire companion-report parsing. `goal-readiness-fixture.test.ts` retains ready, repeated-ready, missing, and non-ready oracle examples. Public Codex and Claude non-ready checks retain readiness invocation and absence of an owner. They do not parse the legacy report. |
| Values outside closed report fields                         | Retire private profile/workflow/risk and formatter validation. `owner-evidence-policy.test.ts` retains independently observed native model/effort checks and malformed acceptance evidence. These do not prove private route selection.                                     |
| Cross-field route and risk contradictions                   | Retire private report reconciliation. Current owner-route expectations remain separate from parent routes and are checked against correlated native acceptance; see [owner evidence validation](owner-evidence-validation.md).                                              |
| Complete fixed tuple for a decision-gated report            | Retire the serialized tuple. Actual readiness and no-owner checks remain; an invented report tuple cannot supply missing native evidence.                                                                                                                                   |
| Overlapping fields in a companion structured result         | Retire field ownership inside the removed report parser. Readiness and review remain separately owned public outcomes and fixture oracles. No native comparison depends on combining their prose into that report.                                                          |
| Internal launch records behind Markdown presentation        | Preserve both quoted and list-prefixed TSV examples through public extension grading in `internal-record-policy.test.ts`.                                                                                                                                                   |
| Twelve current internal TSV markers                         | Preserve all twelve explicit legacy examples through public extension grading in `internal-record-policy.test.ts`.                                                                                                                                                          |

These are deliberate contract migrations, not equivalence claims for the old
formatter. Historical snapshots and recorded private labels retain their
original interpretation. The legacy implementation and tests remain available
until cutover; the current default caller still uses that backend when no Sevro
route is selected.

## Public fixture coverage

`evals/domain/internal-record-policy.test.ts` resolves an adaptive-delivery case
through `sevro.extension.v1`, then submits controlled final-message observations
through the public `evaluate` method. It imports no runner implementation or
private policy export. Its expected marker values come from the legacy examples.

The test preserves twelve TSV marker examples and two Markdown wrappers. An
ordinary final answer passes this bounded exclusion check. Missing, partial,
wrong-source, malformed, and duplicate final-message observations leave it
unavailable, with no claimed evidence reference.

Only the internal-record check is asserted. These controlled observations do not
prove native owner acceptance, live readiness, or the correctness of task work.
The other ownership checks still need their own native evidence. This is a test
migration with no product or harness changes and no claimed red/green slice.

## Observed validation

```sh
bun test evals/domain/internal-record-policy.test.ts
```

Passed one test with 21 assertions. An initial draft used exact object equality
for a check declaration that also contains optional configuration; the corrected
assertion binds the public check ID and grader. That draft failure is not evidence
of missing product behavior.

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/internal-record-policy.test.ts evals/runner/parity/sevro-extension.test.ts --test-name-pattern 'public ownership grading preserves internal-record exclusions|Darrow ownership checks use complete native evidence without private task content|Darrow grades one readiness read and no owner on a non-ready result|Claude readiness stop uses complete native calls and intact events'
```

Passed four tests and 56 assertions across two files in 4.16 seconds. These
requests exercise the extension protocol; they are not installed-runner or live
host trials. The Sevro release archive is unchanged.
ESLint, typecheck, formatting, and the documentation check passed. The latter
checked 249 Markdown pages and 16 plugins.

Publication, package pinning, benchmark mode and phase-policy migration, caller
cutover, generic runner removal, and installed CI remain separate work.
