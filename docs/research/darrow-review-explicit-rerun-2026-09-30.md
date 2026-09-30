# Darrow Review: corrected explicit-invocation reruns

## Current result

All seven requested cases have completed: **31/35 task passes (88.6%)** and
**35/35 explicit activation passes**. Four cases reached 5/5. The user authorized
finishing coverage while keeping the unconfirmed capacity failure and other
failures open. No failed trial was replaced with a passing rerun or regrade.

| Case                                     | Task | Activation | Assessment                                                                  |
| ---------------------------------------- | ---: | ---------: | --------------------------------------------------------------------------- |
| `code-review-presentation-default`       |  5/5 |        5/5 | Passed                                                                      |
| `code-review-repair-guidance`            |  4/5 |        5/5 | One reader-handoff coordination failure                                     |
| `code-review-guidance-alternative`       |  5/5 |        5/5 | Passed                                                                      |
| `code-review-guidance-uncertain`         |  3/5 |        5/5 | One reported capacity block; one suspected overly strict presentation check |
| `code-review-guidance-unresolved`        |  4/5 |        5/5 | One suspected semantic-grader false negative                                |
| `code-review-reviewer-route-override`    |  5/5 |        5/5 | Configured route applied to both readers in every trial                     |
| `code-review-reviewer-route-unavailable` |  5/5 |        5/5 | Blocked honestly; zero reviewer launches or substitutions                   |

All completed cases used the unchanged **darrow-review 0.10.6**, Codex CLI
**0.156.1**, coordinator **gpt-6-luna/medium**, five trials and five concurrent
jobs per case, with a 100% threshold. Cases ran sequentially. The model,
assertions, fixtures, and plugin implementation were not changed for these runs.

## Corrected setup

The earlier snapshot directory `plugin` caused the shared renderer to emit
`$plugin:code-review` for an installed plugin named `darrow-review`. Those
35 historical trials remain preserved and excluded from intended explicit
invocation evidence.

Each new snapshot is named `darrow-review`. Before each run, the actual shared
prompt renderer verifies that all seven selected prompts contain exactly one
`$darrow-review:code-review`, matching the snapshot's installed manifest name.
The observer verifies snapshot and case hashes after each completed batch.
No shared runner implementation changed.

The completed batches contain **40 accepted gpt-6-sol/xhigh reviewer launches**
and **10 accepted gpt-5.6-sol/xhigh override launches**, all with fresh context
and the expected review axis. The unavailable-route case retained zero launches
in all five trials. Accepted launch evidence
does not establish that the reviewer completed successfully. Explicit
activation also does not establish correct workflow execution.

## Combined selected coverage

Replacing only the seven incorrectly invoked batches with these corrected runs,
while retaining the 24 unaffected earlier cases, gives:

| Metric                                            |          Result |
| ------------------------------------------------- | --------------: |
| Cases / trials                                    |        31 / 155 |
| Task passes                                       | 151/155 (97.4%) |
| Positive activation                               |         145/145 |
| Negative avoidance                                |           10/10 |
| Cases with 5/5 task and activation/avoidance      |           28/31 |
| Accepted fresh gpt-6-sol/xhigh readers            |             191 |
| Accepted fresh gpt-5.6-sol/xhigh override readers |              10 |
| Unaccepted, unclassified, or wrong-route launches |               0 |

These are selected coverage batches across two campaigns, not one uninterrupted
sweep or an all-history success rate. All 31 share runtime/skill digest
`52d842d75aa5522b855fde29f9c7233990960c665507bea1d3ff4fb27f8e2c0a`.
Three full reads in the retained cases used completed-call output recovery.
The two older worktree failures remain open and are not repaired by these results.

## Failures and recommendations

### Repair-guidance, trial 3: incomplete Spec review

Both independent readers were accepted on the correct route. The coordinator
retained the Standards finding about console output but blocked Spec. Its final
response said it had sent the Spec reader an incomplete launch command and
discarded that reader's judgment. The seeded nonnumeric-input defect was absent
from the canonical findings and inline response. The read-only check passed.

**Assessment:** product coordination failure, recurring in the previously
observed reader-handoff cluster. Only the Standards reader returned a structured
axis response in the retained observation. The Spec launch body was encrypted;
the coordinator's claimed exact message omission is not independently verified.

**Recommendation:** retain this failure and investigate the prepared-message
handoff and same-reader recovery before making another skill change. Do not
classify it as an activation miss or mark it fixed using the four passing peers.

### Uncertain-guidance, trial 2: reported reviewer capacity block

The final response and canonical result reported that the selected Spec reviewer
was at capacity. Standards passed; Spec remained blocked, and no signing finding
was retained. The native metadata proves that the Spec spawn was accepted on
gpt-6-sol/xhigh with fresh context. Its session had zero observed command
executions and no structured axis response. A capacity error itself was not
retained.

**Assessment:** unresolved, with a reported host availability failure. The
evidence does not establish an activation or route-selection defect, or prove
the capacity explanation independently.

**Recommendation:** keep the raw task failure open. A focused diagnostic should
capture bounded native error/completion evidence before changing product policy.
The user explicitly authorized finishing the remaining coverage while keeping
this failure open under the exception to `docs/eval-development.md`. The two
earlier unexplained worktree failures also remain open.

### Uncertain-guidance, trial 5: resolution-test wording

All deterministic artifact checks passed. The response identified the blocking
unsigned-transmission defect, explained that the SDK and tenant-key contract were
missing, recommended signing for the selected tenant before transmission, and
said to prevent transmission until signing was available. It neither invented
an API nor restored the removed dependency. The semantic grader rejected it
solely for omitting an observable signed-transmission or tenant-isolation test.

**Assessment:** suspected invalid presentation expectation. CR-C9 allows
observable resolution behavior **or** a regression test. CR-C16 accepts stated
correct behavior without generally demanding a separate test sentence. The
response describes the required behavior, and the canonical resolution fields
retain per-tenant signed bytes and no transmission when signing is unavailable.

**Recommendation:** calibrate the assertion against the current presentation
contract before strengthening the skill. Preserve this raw failure; no assertion
change or regrade has been performed.

### Unresolved-guidance, trial 4: stated cause rejected by the grader

The verification artifact correctly retained the original finding as unresolved,
and all deterministic checks passed. Only the semantic output check failed.
The response states: “The repair checks `value.length === 0`, so whitespace-only
input still returns an empty string instead of `Anonymous`.” The grader rejected
it for not explaining that the original input length was checked rather than
the trimmed result.

**Assessment:** suspected semantic-grader false negative. The response names
the faulty expression, connects it to the remaining behavior, and states the
required result. It does not separately use the phrases “original input” and
“trimmed result.” The saved verification evidence contains that full distinction.
This differs from the uncertain-guidance assertion's explicit demand for a test:
here the proposition's causal requirement is valid, but its grading appears too
strict for the retained response.

**Recommendation:** calibrate the grading against this response and a plausible
counterexample that actually omits the cause. Keep the raw failure until that
work is done; do not strengthen the skill based only on this score.

## Evidence and limits

- [Completed batch summary](../../evals/results/review-explicit-invocation-2026-09-30/summary.json)
- [Completed raw results](../../evals/results/review-explicit-invocation-2026-09-30/results.json)
- [Failure classifications](../../evals/results/review-explicit-invocation-2026-09-30/failure-classifications.json)
- [Invocation proof](../../evals/results/review-explicit-invocation-2026-09-30/presentation-default/invocation-proof.json)
- [Combined 31-case summary and provenance](../../evals/results/review-explicit-invocation-2026-09-30/selected-31-summary.json)
- [Combined 31-case raw results](../../evals/results/review-explicit-invocation-2026-09-30/selected-31-results.json)
- [Earlier stabilization and historical evidence](darrow-review-luna-medium-stabilization-2026-09-29.md)

Raw artifacts remain local and gitignored. The earlier 24 selected cases without
the explicit placeholder remain unaffected by the snapshot-name defect. The two
historical worktree failures remain open. These new measurements do not establish
long-run reliability or eliminate earlier failures.
