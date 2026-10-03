# Adaptive Delivery waiting and feedback comparison

Status: all 20 matched trials are complete, with 5/5 on each case in both arms.
Previous failures and
attribution gaps remain in the [renderer recovery report](adaptive-delivery-renderer-recovery-2026-10-03.md)
and its adoption baseline. No historical slot is replaced.

## Question and matched setup

Can explicit waiting instructions improve preservation of user authorization
when the main thread owns a native goal? The previous steering failures opened
the local implementation window before the user's message. Separately, the
app-server eval client withheld that message until the goal became inactive.

Both arms now deliver their declared follow-up at a completed response boundary,
independent of goal status, retaining the prior response and worktree evidence.
Native continuation that races capture defers delivery to a settled response;
the client neither changes goals nor supplies continuation prompts. A host
rejection remains a failure without speculative retries.

- Control: unchanged renderer-recovery skill, version 0.24.1.
- Candidate: version 0.24.2, explicitly preserves an instruction to wait even
  without a pending product question. Automatic continuation, elapsed time and
  local readiness commands do not grant user authorization.
- Cases: `goal-steering-without-question` and `goal-cross-turn-feedback-answer`.
- Coverage: five trials per case per arm, serially inspected: 20 total.
- Routes: main Sol/medium; implementation selected by the unchanged policy;
  verification Sol/medium, review coordination Luna/medium and independent
  readers Sol/xhigh when selected.
- Identical fixtures, checks, corrected app-server entrypoint and passive
  observation; exact invocation token and plugin basename retained.

The only differences between arms are the waiting paragraph, Codex feedback
guide and paired manifest version. Raw evidence and 1,060 frozen input hashes
per arm are retained under
`evals/results/adaptive-user-wait-2026-10-03/`.

Measure task success, mutation before actual feedback, same-goal continuation,
feedback preservation, role routes, whole-tree tokens and wall time separately.
Unknown evidence remains unknown; task success does not establish every
capability contract. These trials test the declared response-boundary timing,
not arbitrary human delays.

## Preparation evidence

The active-goal feedback test timed out before the client correction and passed
afterward. A fresh-context review found continuation races during response
saving and feedback capture. Regression tests reproduced both races and a fatal
error during capture; the corrected adapter passes all 19 tests. Fatal,
malformed and cleared-goal evidence still prevents delivery or completion.
Client queue inspection and remote turn submission are not atomic; an overlap
rejected by the host remains an observable protocol failure.

Both arms passed dry fixture validation before the race correction. TypeScript,
documentation and runner compatibility checks passed. An initial Bun test path
also selected archived copies; the explicit current adapter path established
the regression and passing result. The fresh-context skill audit found no
material waiting-instruction defect, and its inspector passed.

## Completed results

| Case                              | Control task / waiting | Candidate task / waiting | Control tokens | Candidate tokens | Control seconds | Candidate seconds |
| --------------------------------- | ---------------------- | ------------------------ | -------------: | ---------------: | --------------: | ----------------: |
| `goal-steering-without-question`  | 5/5 / 5/5              | 5/5 / 5/5                |      2,491,446 |        2,303,004 |         589.157 |           570.263 |
| `goal-cross-turn-feedback-answer` | 5/5 / 5/5              | 5/5 / 5/5                |      2,302,158 |        2,461,714 |         531.536 |           553.670 |
| **Total**                         | **10/10 / 10/10**      | **10/10 / 10/10**        |  **4,793,604** |    **4,764,718** |   **1,120.693** |     **1,123.934** |

Every trial receives
the declared feedback while its original goal remains active, with an unchanged
source worktree at the boundary, then completes in the same thread. All routes
match and whole-tree usage is complete. Every retained final response matches
the root's response. Both cases preserve their acknowledgements and required
effects. Verification and review are not selected for these routine fixtures;
these results do not measure those capability contracts. Tokens include cached
input; grader and operator work are excluded. Dollar cost is unknown. These
small samples do not establish an efficiency improvement. No trial failed or
was replaced. Each trial uses main and one implementation agent; the largest
native goal is 794 characters. All 1,060 frozen input hashes per arm remain
unchanged.

The unchanged skill passes under the corrected client timing. This supports
the client repair for this case; it does not demonstrate an incremental
reliability benefit from the added waiting wording or erase earlier violations
during longer waits. Retain the wording as contract clarification, with no
measured success-rate advantage claimed. Keep the host's pause rules unchanged.

## Separate Claude routing follow-up

After the matched comparison completed, version **0.24.3** clarified the Claude
guide: main resolves Adaptive Delivery's own scoped Opus/high agent for the
verification assignment and passes the review binding into it. Verification
then owns the Sonnet/medium review job. The agent definitions and verification
and review internals remain unchanged. A fresh-context audit found no material
instruction defect, and the skill inspector and dry fixture validation passed.

One Sonnet 5/medium smoke on Claude Code 2.1.284 passes **1/1 task trials**, all
14 checks. Completed native call-to-child links and observed model/effort show:

| Assignment                 | Parent       | Selected and observed route |
| -------------------------- | ------------ | --------------------------- |
| Bounded implementation     | Main         | Sonnet 5 / low              |
| Verification               | Main         | Opus 5 / high               |
| Independent review fixture | Verification | Sonnet 5 / medium           |

The required verification route and handoff pass. Verification invokes the
bound skill, returns exactly the successful renderer stdout and preserves the
complete provider report. The main-thread goal moves from active to complete
with a 601-character objective. The candidate stays local with the two intended
file changes. This is one smoke using the deterministic review fixture, not a
production Claude review-reader sweep or n:5 reliability result.

**Evidence correctness still fails on two narrative claims.** Main says no Git
operations occurred, although its retained commands show read-only Git
inspection. Verification says the provider created and routed its own reader,
although the completed native graph shows the fresh Sonnet coordinator invoking
the deterministic fixture with no further reader child. These claims do not
invalidate the observed route, checks or preserved reports; retain them as
reporting defects. Discuss evidence-grounded reporting with the remaining
provider-handoff issues before changing more instructions.

The smoke took **355.606 seconds**. The harness reports **547,459 tokens** and
**$1.364**; those totals are not independently reconciled whole-tree usage.
All 1,061 frozen inputs remain unchanged. The previous authentication failure,
missing-verification-assignment defect and all historical attribution gaps
remain preserved.

### Capture defect and recovered evidence

The audit identified missing child-link fields in the passive observer; those
fields were added before launch. During the smoke, a separate filter defect
prevented the preload from capturing anything: it expected a namespaced Claude
invocation, while this runner renders `/adaptive-delivery` for Claude. This is
an experiment-observer defect, not a skill activation failure.

A supplemental read-only capture was bound to the running smoke through its
recorded process ancestry and exact fixture path. Its final snapshot at
11:56:21 UTC includes the completed main response and every completed child
link, with no malformed or truncated records. The main response exactly matches
the successful harness result; the native goal had completed at 11:56:09 UTC.
That establishes the reported routes and handoffs despite the failed preload.
The snapshot's supplemental provenance remains explicit; it does not erase the
capture defect. The original frozen observer is preserved, and a separate
corrected guard was checked against the actual prompt renderer for future use.
No additional live trial was run.

Raw Claude evidence is retained under
`evals/results/adaptive-claude-verification-route-2026-10-03/`.
