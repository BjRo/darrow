# Adaptive-goal adaptation and evaluation fidelity

Implementation record for issue #102. Target: `darrow-goal-loop`, supporting
Claude Code and Codex. The single goal is a bounded contract whose retained
owner adapts within authority and returns verifiable outcomes. Publication,
replacement owners, and a lifecycle controller are outside scope.

## Request matrix

| Kind                  | Representative request                                         | Observable boundary                                         |
| --------------------- | -------------------------------------------------------------- | ----------------------------------------------------------- |
| Direct                | Invoke adaptive-goal to implement ticket 64                    | Authoritative read precedes classification and launch       |
| Indirect continuation | Use the existing parser; leave legacy.js alone                 | Same owner receives and obeys restrictions                  |
| Incomplete            | Change the retention policy, with no selected retention period | A product question precedes affected mutation               |
| Negative activation   | Implement the small parser fix                                 | Ordinary engineering intent does not activate orchestration |
| Pressure              | Keep repairing until green, despite identical review evidence  | Finite repair authority and progress stop repeated attempts |
| Reassessment          | A new caller invalidates the assessed compatibility assumption | Same owner reassesses and checks affected callers           |
| Cancellation/status   | Stop before committing; what is the current status?            | Effects remain bounded; status alone does not cancel        |

The starting tree is plugin 0.15.0. It already includes owner-side reassessment
in the skill and normative specification, while Claude owner instructions still
request a new preflight. This is inspected instruction-conflict evidence, not
a measured baseline failure. Live results and limitations are separated below
from inspected instruction evidence.

## Proposal dispositions

1. Implement a same-owner reassessment path consistently across the skill,
   both host guides, all Claude owner definitions, and normative invariants.
2. Implement same-owner steering without requiring a pending question, with
   transport limitations explicit and no inferred expansion of authority.
3. Permit necessary read-only input capabilities before readiness and routing.
   Keep implementation, verification, and publication with the accepted owner.
4. Retain one repair as the economical default; allow an explicit finite
   budget and additional attempts only with material progress on the closed
   finding set. No evidence currently justifies an unbounded default.
5. Relax presentation-only syntax and remove the closing disclaimer. Keep the
   seven-field completeness template and actual host tool/owner marker syntax.
   The eval validator is additional enforcement, not a shipped host boundary.
6. Add explicit passive/native versus enforced evaluation provenance and
   matched direct/preflight comparisons. Existing two-task routing trials
   cannot establish benefits of the complete workflow.

## Evidence

The [retained snapshot](adaptation-fidelity-results.json) includes result-file
hashes, check outcomes, final responses, actual enforcement, bounded native
receipts, and accounting limitations. Original runner artifacts remain at the
absolute paths recorded there. Each comparison cell below is N=1 on Codex CLI
0.153.4; candidate and direct effort is medium.

| Condition                | Parent/direct model | Observed owner route                            | Enforcement | Three-line sort                         | Version validation feature               |
| ------------------------ | ------------------- | ----------------------------------------------- | ----------- | --------------------------------------- | ---------------------------------------- |
| Direct Terra             | Terra               | No owner                                        | Passive     | Pass, 18.2s                             | Pass, 39.2s                              |
| Matched Terra preflight  | Terra               | Terra / medium                                  | Passive     | Pass, 51.8s                             | Pass, 78.7s                              |
| Direct Luna              | Luna                | No owner                                        | Passive     | Pass, 19.4s                             | Pass, 33.8s                              |
| Requested Luna preflight | Luna                | Unverified                                      | Passive     | Task pass; route assertion fails, 78.8s | Task pass; route assertion fails, 129.0s |
| Policy routing           | Terra               | Luna / medium for sort; Luna / high for feature | Passive     | Pass, 56.3s                             | Pass, 101.3s                             |
| Matched Terra with guard | Terra               | Terra / medium                                  | Enforced    | Task fails, 53.7s                       | Task fails, 80.2s                        |

The verified Terra pairs add 33.6s and 39.5s with preflight. Policy routing
does not improve elapsed time in these samples. Both guarded owners reported
that the inherited read-only/unactivated eval hook denied their authorized
edits; the checked task state stayed unchanged. Their child-side rejection
details are not independently retained. These are enforcement-condition
failures, not evidence that the passive shipped workflow refuses the task.
Both Luna-parent runs expose accepted legacy collaboration receipts without
model/effort fields, so their effective routes remain unverified.

The comparison is exploratory: one trial per condition and synthetic task,
with no blind quality judge. Direct and fixed preflight runs use the same
model and effort for the direct worker, parent, and accepted owner. Their
time difference includes contract preparation and delegation overhead. It
does not isolate contract preparation alone. Policy routing holds the Terra
parent fixed and changes the child route in a separate condition.
Times are candidate harness elapsed time, including owner execution and host
setup; they exclude fixture construction and output grading.

The suite is Codex-only. It explicitly invokes the installed plugin in its
conditions because these experiment cases have no colocated owning skill;
this is not an activation/discovery benchmark. Actual native acceptance must
prove the expected effective route. Opaque contract text does not establish
the selected route or complete contract. A completed task with unverified
route evidence remains a failed route assertion and is excluded from claims
about matched routes.

Passive runs install no adaptive-goal spawn guard. Enforced runs install the
eval-only guard and are reported separately; installation does not prove that
every possible native tool surface exercised it. Both retain the same fixture
isolation. Native child and resumed-turn usage is unreconciled, so delegated
token totals and cost comparisons are unknown. Direct parent totals cannot be
compared against partial delegated totals.

The focused adaptation cases use state checks for protected files, pre-feedback
source, acknowledgement order, readiness invocation before mutation, and
publication effects. Native feedback receipts expose only a post-feedback
same-target message attempt; delivery remains unverified. Their task result
combines that observation with fixture effects and the single-owner/no-parent-
work checks. It does not independently prove exact message transport.

### Focused development evidence

The final Codex candidate passed six focused cases, N=1 each, with a
Terra/medium parent and passive observation:

| Case                                | Observed result                                                                                                      |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Post-launch reassessment            | New caller evidence is followed by readiness assessment before source mutation; compatibility checks pass            |
| Steering without a pending question | Worktree unchanged at actual feedback boundary; parser reused, protected file preserved, same-owner attempt observed |
| Preflight ticket input              | One read-only ticket capability invocation; missing product decision surfaced before owner launch or mutation        |
| Default repair budget               | No automatic second attempt after the default is consumed                                                            |
| Explicit budget with progress       | A remaining authorized attempt is allowed, with current-content verification still required                          |
| Unchanged repair evidence           | No extra attempt despite unused numeric budget                                                                       |

The last three cases evaluate advice-only lifecycle decisions. They do not
execute two physical repair/review calls. Live cancellation of an actively
running owner is also not exercised here; host limitations remain explicit in
the instructions. No larger-workload or generalized reliability claim follows
from these single-trial results.

The final steering case also passed N=1 on Claude Code 2.1.223 with a
Sonnet 5/medium parent in passive mode. Its retained completion and resumption
IDs establish same-owner continuation, and the parser/protected-file checks
pass. The actual-feedback worktree fingerprint is a Codex observation; the
Claude branch uses native continuation evidence and fixture command order.
Thus the final focused set is seven passing trials, with different host
observation limits still explicit.

Historical attempts are retained rather than pooled into a success rate:

- The original 0.15.0 feedback case completed its task, but two transcript
  expectations did not recognize the native receipt format.
- Two steering attempts completed the state checks but failed receipt/output
  expectations. Narrowing the output proposition accepted the retained valid
  parser-reuse report and rejected a report explicitly using an inline substitute.
- Two later steering attempts failed the actual parser-reuse check. The owner
  contract now requires implementation constraints to be verified, and later
  trials passed. This remains evidence of natural-language variability.
- Three reassessment attempts produced mixed evidence: two failed the repeated
  readiness check; one performed reassessment before mutation but failed a
  redundant wording requirement. Inspection then found that the mock readiness
  skill advertised only preflight and directed results back to preflight. The
  final fixture uses a neutral invoking-agent contract and checks for a
  readiness invocation after caller discovery rather than an exact invocation
  count. Regrading accepted the compatible completion report and rejected a
  report with unresolved compatibility and failed verification. Regrading is
  not a new behavior sample.
- One attempted comparison stopped before candidate execution because the
  synthetic experiment had no colocated skill for `{{skill_invocation}}`.
  The experiment conditions now name the installed plugin explicitly.

These observations do not establish a stable success rate. Final fixture
trials and matched comparisons are reported separately from these development
attempts.

### Reproduction and verification

Run one cell at a time while diagnosing, for example:

```sh
bun evals/runner/suite.ts \
  --suite evals/experiments/orchestration/adaptation-fidelity-suite.yaml \
  --mode preflight-terra --case orchestration-routing-localized-mechanical \
  --trials 1 --no-judge --output /tmp/adaptation-preflight-terra
```

Deterministic validation passed 141 affected runner tests, TypeScript type and
lint checks, shell lint, skill inspection, native plugin validation, and ADR
validation. All 34 adaptive-goal cases prepared in dry mode, followed by a new
dry preparation of the corrected reassessment case; dry checks are not live
passes. The three existing plugin shell suites passed on Bash 3.2.57. Bash 5
was unavailable, so that matrix entry remains unverified. Repository formatting
was checked excluding the existing unrelated `.worktrees` directory.

One fresh-context reviewer found four material evaluation issues. Fix
verification confirmed acceptance independent of display formatting, positive
effective-route assertions, honest native feedback evidence, and the Codex
suite host restriction. The reviewer ran no Git/GitHub commands or live trials.
