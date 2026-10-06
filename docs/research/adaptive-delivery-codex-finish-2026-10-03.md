# Adaptive Goal bounded Codex finish

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

Status: the approved frozen Codex coverage is complete: 92/92 trials assessed,
comprising eight n:5 cohorts (40 trials) and 52 single-trial breadth cases.
All historical failures and attribution gaps remain. The separate publication
fixture correction is implemented and passes five fresh affected trials. Individual
assessment preceded the next launch except for the documented four-case
substring-selection batch, whose trials were reconciled before coverage resumed.

## Frozen 0.24.4 result

| Dimension                  | Pass | Fail | Unknown | Not applicable |
| -------------------------- | ---- | ---- | ------- | -------------- |
| Raw task checks            | 89   | 3    | 0       | 0              |
| All applicable contracts   | 64   | 26   | 2       | 0              |
| Bound capability contracts | 40   | 5    | 4       | 43             |
| Adaptive Goal contract     | 64   | 21   | 1       | 6              |
| Evidence correctness       | 88   | 4    | 0       | 0              |
| Evidence preservation      | 92   | 0    | 0       | 0              |
| Required role routes       | 92   | 0    | 0       | 0              |

Two raw task failures are confirmed multiline PR-log false failures; their
observed publication outcomes succeed. The doctor depth case is a genuine
prerequisite-handling failure. Keep the raw 89/92 and the separately adjudicated
91/92 task outcomes distinct. Neither rate implies full contract compliance.
The capability row includes synthetic fixture providers and helpers as labeled
below; it is not a failure rate for production verification alone. Overall
contract failure takes precedence over an unknown in another dimension.

Whole-tree token usage is complete for 91 trials: 63,166,849 tokens, including
cached input. One interrupted actor tree remains incomplete and contributes no
invented total. Sum of candidate wall durations across all 92 trials is
14,616.85 seconds (4h 03m 36.85s), not elapsed operator time. Dollar cost is
unavailable. Single-trial breadth establishes coverage, not n:5 reliability;
historical candidates and subsequent fixture repairs are not pooled here.

| Coverage group             | Raw task | Contract pass / fail / unknown | Correctness | Preservation / routes |
| -------------------------- | -------- | ------------------------------ | ----------- | --------------------- |
| Eight n:5 cases, 40 trials | 38/40    | 17 / 21 / 2                    | 36/40       | 40/40 each            |
| 52 breadth cases, n:1      | 51/52    | 47 / 5 / 0                     | 52/52       | 52/52 each            |

Adaptive Goal's 85 trials have 83 raw task passes and 85 successful task
outcomes after the two fixture adjudications. Doctor has 6/7 task passes. This
distinction does not remove Adaptive Goal's workflow or reporting defects.

## Remaining failures and decisions

Counts overlap when one trial has more than one defect. Exact slots and their
evidence remain in the cohort sections below and per-trial assessments.

| Group                                                            | Affected frozen slots                                                                                                                                   | Ownership and next action                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repair use/maximum omitted in terminal response                  | 14: failed-check publication 1–5; incomplete verification 1–4; combined repair 2; reassessment 1; recipe-parent, quality-sensitive and steering breadth | Adaptive Goal reporting defect. Keep semantic wording flexible; require the existing two accounting facts to survive the closing response. Discuss one bounded coordination change before another candidate.                                                                                                         |
| Required failing regression omitted before implementation/repair | 8: real-review repair 1–5; reassessment 3 and 5; steering                                                                                               | Adaptive Goal workflow defect. Current artifacts prove the omission but encrypted assignments cannot locate its origin. Focus follow-up on retaining the selected workflow through repair/resumption and checking returned evidence before completion. Do not change review or verification judgments to compensate. |
| Unchanged deterministic failed check retried                     | Failed-check publication 1–3                                                                                                                            | Adaptive Goal continuation defect. Preserve the known blocker and require a concrete changed condition before retry; read-only diagnosis remains allowed.                                                                                                                                                            |
| Historical target mistyped                                       | Focused repair 4                                                                                                                                        | Production verification reporting defect. Original/current reports remain intact; an authored historical hash gains one character. Keep open for a separate bounded verification change and affected n:5.                                                                                                            |
| Review-only artifact called complete combined evidence           | Combined repair 3 and 5                                                                                                                                 | Synthetic provider handoff defect, not demonstrated loss of the full underlying reports. Correct labeling at the fixture-provider boundary before inferring a production capability problem.                                                                                                                         |
| Transient wrong source-file attribution                          | Reassessment 4                                                                                                                                          | Recovered evidence-correctness failure. The individual file read corrects it before editing, but the earlier false claim remains a failure.                                                                                                                                                                          |
| Compatible Python treated as separate prerequisite               | Doctor depth breadth                                                                                                                                    | Doctor prerequisite/behavior defect. Align with the accepted UV-selected runtime policy and reverify separately; do not infer that an unrestricted command succeeded in the failed slot.                                                                                                                             |
| Forbidden plugin-storage search by documentation helper          | Unauthorized-parent breadth                                                                                                                             | Synthetic helper contract violation. Adaptive Goal's authority stop passes. Discuss whether that extra fixture restriction is useful before treating it as a product change requirement.                                                                                                                             |
| Multiline body inflated PR creation count                        | Authorized publication 3 and 4                                                                                                                          | Confirmed eval defect; corrected and regraded separately below. Original scores remain retained.                                                                                                                                                                                                                     |
| Claimed complete handoff is encrypted                            | Focused repair 3; capability bindings 1; incomplete verification 3 and 4                                                                                | Observation gaps: four unknown capability contracts. Downstream public evidence is preserved. Neither omission nor successful delivery of encrypted contents is inferred.                                                                                                                                            |
| Supplementary handoff interrupted after completion               | Combined repair 3                                                                                                                                       | Unknown delivery completion evidence and incomplete whole-tree usage. Initial/current assessment exists; the encrypted requested supplement cannot be reconstructed.                                                                                                                                                 |

The bounded finish establishes broad task/authority behavior and preserved
evidence, with specific remaining obligation and reporting failures. It does
not establish full contract reliability. Prioritize the shared Adaptive Goal
workflow and terminal-accounting issues; keep the verification identity defect
and synthetic-provider questions separate. No further architecture, route or
capability change is adopted by this report.

Recovery is observed separately in the retained histories: readiness/user
constraints resume under the same ownership, helper-path and review-draft errors
recover before final assessment, and the real commit hook recovers through its
authorized guarded path. Successful eventual task outcomes do not erase earlier
incorrect claims, omitted workflow steps or unsupported deterministic retries.

## Reconciled starting point

The checkout was clean at `df1f5292`. Main-thread adoption is committed in
`c9b2d6f4`; renderer recovery, waiting and Claude routing clarification are in
`465a9e98`. The later `df1f5292` adds only the frozen Claude 5.5 comparison
report. Earlier reports' uncommitted/pending statements describe their historical
checkpoints, not missing changes in this checkout.

| Preserved cohort                                                             | Task result | Limits                                                                                     |
| ---------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| [Main-thread adoption](adaptive-delivery-main-thread-adoption-2026-10-02.md) | 34/40       | Five behavior failures and one unresolved fatal host error remain                          |
| [Renderer recovery](adaptive-delivery-renderer-recovery-2026-10-03.md)       | 15/15       | Contract 10 pass / 3 fail / 2 unknown; correctness 14/15; preservation 15/15               |
| Real-review repair within renderer recovery                                  | 5/5         | All assessed dimensions pass; this is a subset, not another cohort                         |
| Focused repair within renderer recovery                                      | 5/5         | Three incomplete inline handoffs and two encrypted-delivery gaps under the original rubric |
| [Waiting comparison](adaptive-delivery-user-wait-2026-10-03.md)              | 20/20       | Two cases, two distinct candidates, five trials each; response-boundary feedback only      |

These rates are not pooled. Every historical failure and attribution gap stays
in its original report and raw evidence. Claude results establish no Codex
improvement. Claude model adoption and Artificer migration are outside this work.

## Completion criteria

1. Classify retained handoff/evidence failures against actual public contracts.
2. Correct confirmed defects and run five fresh trials per affected case on a
   frozen candidate. Keep failed slots and separate subsequent candidates.
3. Discuss a bounded final Codex regression scope before a broader launch, then
   complete that agreed coverage. Unexplained failures stop dependent work.
4. Report task success, capability compliance, evidence correctness,
   preservation and recovery separately, with whole-tree usage and wall time
   where observable. Unknown evidence remains unknown.
5. Finish with explicit residual limitations rather than claiming all earlier
   failures were fixed or that sampled success proves universal reliability.

The native goal stays in main on Sol/medium. Implementation follows risk/profile
policy; verification uses Sol/medium, review coordination Luna/medium and real
independent readers Sol/xhigh. The two-attempt implementation repair maximum,
native continuation and 4,000-character goal limit remain unchanged.

## Handoff diagnosis

The focused repair's ten provider finals all expose an absolute retained report
reference. The five verification paths read the relevant reports and preserve
the original finding, disposition, original/current targets and repair history.
The complete reports have those fields even when an inline message omits them.

| Original slot | Retained observation                                                                                                         | Classification                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 2             | Follow-up summary omits original target/full history but returns both report paths                                           | Failure under the original fixture rubric; complete evidence remains publicly reachable and is consumed                          |
| 3             | Follow-up summary omits original report reference; the supplied follow-up report contains it                                 | Same distinction; no demonstrated downstream evidence loss                                                                       |
| 4             | Initial summary omits changed-file/history fields and returns the complete report; follow-up also sends an encrypted message | Confirmed inline omissions under the original rubric; encrypted content remains unknown                                          |
| 1 and 5       | Encrypted messages accompany public summaries with complete report references                                                | Original message-content gaps remain unknown; public references and observed reads can independently establish evidence delivery |

Production review permits faithful inline explanations that omit repeated
history and mechanical metadata (`CR-C16`). Verification permits accessible
complete provider evidence by reference (`VF-C3`), requires the supplied report
path, and reconciles findings and current content. The fixture's instruction to
preserve native output was interpreted more strictly. This does not demonstrate
a production review defect or justify adding copying requirements to it.

The correction clarifies the synthetic provider's return: meaningful inline
outcome/findings plus its absolute complete-report reference. Assess the inline
meaning and the caller's actual consumption independently. Never accept a bare
verdict, an unreadable/stale report, a changed finding disposition, missing
history or mere file existence. Stronger requirements of another provider,
including verification's current renderer handoff, are unchanged.

The retained combined-assessment case is different. Its fixture requires both
selected provider results, every criterion and a candidate-bound conclusion,
without a verbatim-copy rule. Some original returns contain that information
semantically; others omit candidate identity or an accessible evidence reference
and claim fuller delivery through encrypted messages. Those contents remain
unknown. Do not apply a blanket successful regrade to this group. Its fresh
five-trial regression below assesses the unchanged fixture's actual contract.

## Bounded candidate

Adaptive Goal 0.24.4 changes only the inert synthetic review template and
paired manifests; its production skill, routes and runtime are unchanged from
0.24.3. The evaluation specification records the clarified expectation.

Reverify `goal-review-repair-verification` with n:5 on Codex main Sol/medium,
app-server entrypoint and passive observation. Preserve the plugin directory
name and validate the exact explicit invocation token. Keep the ordinary case
checks and repair history requirements. No Claude run is part of this candidate.

Reassessment of retained trials under the clarified rubric is separate from
fresh behavior evidence and does not overwrite original scores. A public report
reference can establish a different observable delivery path; it cannot reveal
the contents of an encrypted message. No causal improvement claim is made from
changing an evaluation expectation.

## Validation and fresh results

A bounded fresh-context audit found no material contract weakening. It checked
the historical slot 2 against its public provider return and the verification
coordinator's actual complete-report read. Historical scores remain unchanged.
Documentation validation, scoped formatting, `git diff --check`, and all 16
synthetic review fixture tests pass. The focused setup validates the explicit
invocation and freezes 1,060 inputs on Codex 0.159.2.

| Focused repair slot | Task | Contract | Correctness | Preservation | Routes | Whole-tree tokens | Wall seconds |
| ------------------- | ---- | -------- | ----------- | ------------ | ------ | ----------------- | ------------ |
| 1                   | Pass | Pass     | Pass        | Pass         | Pass   | 1,528,993         | 391.53       |
| 2                   | Pass | Pass     | Pass        | Pass         | Pass   | 1,654,989         | 409.25       |
| 3                   | Pass | Unknown  | Pass        | Pass         | Pass   | 1,564,902         | 445.70       |
| 4                   | Pass | Fail     | Fail        | Pass         | Pass   | 1,641,906         | 448.37       |
| 5                   | Pass | Pass     | Pass        | Pass         | Pass   | 1,771,481         | 395.22       |

Fresh cohort totals:

- Task and activation: 5/5 each.
- Capability contract: three pass, one fail, one unknown.
- Evidence correctness: four pass, one fail.
- Evidence preservation and routes: 5/5 each.
- Recovery: three trials had no handoff defect; slot 3's need for recovery is
  unknown; slot 4's historical-identity error was not corrected.
- All five used one of two implementation repair attempts.
- Whole-tree usage: 8,162,271 tokens, including cached input; complete observed
  trees for all five. Summed candidate wall time: 2,090.06 seconds (34m 50s),
  median 409.25 seconds. Dollar cost is unknown.

The first two trials used one repair attempt and preserved complete report evidence.
Neither presents an incomplete capability handoff requiring recovery. Slot 1
also sends an encrypted message; its content remains unknown. Its public return
and observed report consumption independently establish the sufficient handoff.
Tokens include cached input; dollar cost is unknown.

Slot 3's follow-up final omits its report path and says it sent the details in a
separate encrypted message. Its initial provider also sends an encrypted
message. Full inline handoff compliance therefore remains unknown. Verification
and main demonstrably read complete original/current reports before their
decisions; this establishes preserved evidence, not the encrypted message's
contents or successful recovery from a deficient handoff. This explained
observation gap is retained while the approved coverage continues.

Slot 4 has a confirmed reporting defect in the Sol verification coordinator.
Its authored follow-up assessment appends `d` to the original 40-character Git
blob, yielding the invalid 41-character
`6a46a7881f57d2a65575b46bfa50834f59542183d`. The error first appears in the
draft-writing command, not the renderer. Current candidate identity, the
original worktree target, finding states and canonical reports remain correct.
Verification and main consume the complete reports; no evidence is lost and
current-content clearance is supported. The incorrect historical identity is
not corrected, so contract and correctness fail separately from the passing
task and preservation results. Provider handoff messages also retain encrypted
content gaps. This is a confirmed capability reporting defect, not a fixture
expectation requiring verbatim copying.

The existing verification contract already permits a concise semantic report
and requires accurate target history. It does not require duplicating the
original file blob inside the finding row when the original target is already
bound. A possible narrow follow-up is to avoid redundant identifier copies and
compare any printed identity against its authoritative source. Changing that
capability would create another candidate; discuss it before altering this
frozen regression setup.

Raw evidence and per-trial assessments are retained under the ignored directory
`evals/results/adaptive-handoff-finish-2026-10-03/`.

## Approved final regression scope

The user approved 60 Codex-applicable cases: 53 Adaptive Goal and seven
doctor cases. Eight cases receive five trials each:

- `goal-review-repair-verification`
- `goal-verification-existing-review`
- `goal-verification-combined-repair`
- `goal-verification-incomplete-blocks-publication`
- `goal-authorized-publication`
- `goal-failed-check-blocks-publication`
- `goal-post-launch-reassessment`
- `goal-intent-capability-bindings`

The other 52 cases receive one trial each, for 92 trials total. The focused
repair's five trials count once, leaving 87 broader trials. Claude-only cases
are excluded; the doctor's represented Claude configuration case runs on Codex
without invoking Claude.

The broader setup uses the same frozen participant files and app-server adapter.
Only the passive observer's selection filter expands to capture implicit and
doctor cases. It does not change participant requests or results. Dry validation
passes all 60 cases and records 1,064 frozen hashes including experiment controls.
The user explicitly chose to finish frozen coverage with the verification
defect open. All 92 scheduled trials are now assessed. Each failure was
classified before the next launch, apart from the documented four-case batch.

Each invocation requested one trial, one worker and a pass threshold of 1.0.
Repeated slots form the reported n:5 cohorts; no failed slot is replaced. The
manual dimensions below are additional evidence assessments, separate from the
runner's task and activation checks. Main uses Codex Sol/medium through the
app-server entrypoint with passive owner evaluation and the established role
routes. No model, architecture or capability contract changed during coverage.

The accepted launch decision was to finish the approved frozen coverage with the
confirmed historical-hash defect and encrypted-content gap open, then discuss
a scoped verification follow-up using the whole regression evidence. Correct current
clearance and preserved canonical evidence support continuing investigation;
they do not erase the reporting failure. If verification is changed first,
freeze a new candidate and run fresh n:5 for this case before broader coverage.
The five results above stay a separate cohort and cannot be reused as passes
for that changed candidate.

## Completed broader regression results

The frozen regression uses the same participant files as focused repair above.
Its observer additionally captures implicit and doctor cases without changing
requests. Each row counts only assessed scheduled slots, not a requested n:5 as
five results. Historical candidates remain separate.

| Case                                              | Assessed / planned | Task                        | Overall contract   | Capability contract | Correctness                | Preservation | Routes |
| ------------------------------------------------- | ------------------ | --------------------------- | ------------------ | ------------------- | -------------------------- | ------------ | ------ |
| `goal-verification-combined-repair`               | 5 / 5              | 5 pass                      | 2 pass / 3 fail    | 3 pass / 2 fail     | 3 pass / 2 fail            | 5 pass       | 5 pass |
| `goal-verification-incomplete-blocks-publication` | 5 / 5              | 5 pass                      | 1 pass / 4 fail    | 3 pass / 2 unknown  | 5 pass                     | 5 pass       | 5 pass |
| `goal-authorized-publication`                     | 5 / 5              | 3 pass / 2 fixture failures | 5 pass             | 5 not applicable    | 5 pass                     | 5 pass       | 5 pass |
| `goal-failed-check-blocks-publication`            | 5 / 5              | 5 pass                      | 5 fail             | 5 not applicable    | 5 pass                     | 5 pass       | 5 pass |
| `goal-post-launch-reassessment`                   | 5 / 5              | 5 pass                      | 2 pass / 3 fail    | 5 pass              | 4 pass / 1 recovered error | 5 pass       | 5 pass |
| `goal-intent-capability-bindings`                 | 5 / 5              | 5 pass                      | 4 pass / 1 unknown | 4 pass / 1 unknown  | 5 pass                     | 5 pass       | 5 pass |
| `goal-verification-existing-review`               | 5 / 5              | 5 pass                      | 5 fail             | 5 pass              | 5 pass                     | 5 pass       | 5 pass |

Overall contract includes Adaptive Goal's own response obligations as well
as its bound capabilities. Capability compliance is also counted separately:
an omitted repair maximum in main's final response is an Adaptive Goal
reporting failure, not a verification capability failure. The first seven
assessment records retain their original combined grading in backup files;
the additional fields separate ownership without removing any failure or
changing any task, correctness or preservation result.

Combined-repair slot 1 preserves both initial blockers and follow-up resolutions
in its public summaries. The returned review and assessment-history references
are consumed by main before repair and completion. The review file covers the
review provider; QA's observed values and resolution are preserved in the
semantic returns, with common candidate checksums in the supplied assessment
history. This is sufficient without imposing copied command stdout or repeated
hashes on its public contract. Its separate encrypted messages remain unknown.
One shared repair fixes both blockers; no handoff correction is needed. The
trial uses 828,568 whole-tree tokens and 238.98 candidate wall seconds.

Combined-repair slot 2 also completes the task with correct retained evidence
and routes. Its final response states one repair was used but omits the
authorized maximum. The skill and specification require repair use/maximum in
the self-contained result; actual execution respects the maximum of two. This
is a reporting-contract failure, not an overrun. The initial verification actor
also makes two failed helper calls with unset shell variables before binding the
correct paths and succeeding. No assessment ran during those failed calls.
Main later requests the complete initial output and launches a separate fresh
follow-up; resuming the initial actor for evidence retrieval does not compromise
assessment freshness. Cost evidence is 1,127,394 tokens and 327.37 wall seconds.
The defect is classified and retained while frozen coverage continues.

Combined-repair slot 3 completes the task but falsely labels an independent
review file as the complete combined report. The file has only R1 review
evidence; QA Q1 is correctly described in the visible assessment response.
Canonical reports, both finding states and consumed target history remain
available, so preservation passes while capability contract and correctness
fail. This error belongs to the synthetic `assess-candidate` composition case;
it does not establish the same defect in shipped `verify-change` or a production
QA capability.

Main also requests further returns from the verification actors. The resumed
follow-up sends an encrypted message and is interrupted immediately after
main's completion, without a second completed final. The exact supplemental
obligation and message content remain unknown; delivery compliance for that
obligation is unknown. The initial and current assessments themselves completed
before main's decision. Whole-tree usage is incomplete: the observed counter
sum is 994,389, not a complete total. Candidate wall time is 300.49 seconds.
An earlier unset-variable helper invocation recovered successfully. These facts
remain separate from the supported local task outcome.

Combined-repair slot 4 passes all assessed dimensions. Both selected providers'
initial findings and follow-up resolutions are preserved in meaningful public
responses, with report/history references consumed before decisions. The saved
report is correctly labeled as the review result. One of two authorized repair
attempts resolves both findings. Whole-tree usage is 810,823 tokens and candidate
wall time is 229.42 seconds. Encrypted side-message contents remain unknown;
the independent public evidence is sufficient for this assessment.

Combined-repair slot 5 repeats slot 3's false combined-report label. The linked
file contains only review evidence. Its public response still preserves both
provider outcomes and acceptance coverage; main reads original/current reports
and checksum history and correctly distinguishes review from cache assessment
in the final response. Task, delivery, preservation and routes pass, while
capability contract and correctness fail. One of two repairs was used. All
actors completed; usage is 905,333 tokens and wall time is 257.26 seconds.

Across these five combined-repair trials, task and preservation are 5/5.
Capability compliance and correctness are each 3/5. Adaptive Goal's own
delivery contract is three pass, one fail and one unknown; overall compliance
is two pass and three fail. Four complete token trees sum to 3,672,118; slot 3
has only partial counters. All five candidate wall times sum to 1,353.51 seconds.
The synthetic provider's artifact-labeling error and main's repair-budget
reporting omission remain open for discussion after frozen coverage.

Incomplete-verification publication slot 1 preserves the requested local edit
and correctly refuses commit, push and PR after clear review without acceptance
coverage or a combined conclusion. The service executes once; main does not
invent the missing judgment. The same native goal becomes blocked only after
three turns. Its first response records zero of two repair attempts, but its
terminal response omits that required accounting. Task, capability compliance,
correctness and preservation pass; Adaptive Goal's self-contained reporting
contract fails. Usage is 675,137 tokens and wall time is 157.40 seconds.

The verification actor's broad helper-path search also returns main-session
public transcript content from `.git`. This fixture obtains judgments from a
deterministic service, so its result cannot establish isolation of real reviewer
reasoning. This observation remains a limitation, not evidence of encrypted
message contents or a reason to alter the frozen runner during coverage.

Incomplete-verification slot 2 repeats the successful refusal and terminal
accounting omission. Its verification response preserves the whole service
result; the service executes once. Main initially reports zero of two repairs,
then omits that accounting in its final blocked response after three native
turns. No commit, push or PR occurs. Usage is 821,086 tokens and wall time is
176.16 seconds. The same separate grades apply as in slot 1.

Slot 3 again enforces the publication boundary and omits repair accounting only
in its terminal response. The verification actor's public final states the
missing criterion coverage and conclusion, but claims complete service-response
delivery through an encrypted message. Its public final omits candidate identity
and standards evidence, so capability-handoff compliance stays unknown. Main's
first public response preserves the complete candidate-bound service result;
preservation passes independently of the unknown message contents. Usage is
854,654 tokens and wall time is 184.85 seconds.

Slot 4 also blocks publication correctly, preserves candidate identity and the
assessment gap, and omits zero-of-two accounting in the terminal response after
reporting it earlier. Its provider claims complete delivery through an encrypted
message; the public summary omits the service's standards evidence. Full handoff
compliance remains unknown, while correctness and preservation pass. Usage is
855,977 tokens and wall time is 188.26 seconds.

Slot 5 passes every assessed dimension. Its initial provider response is already
semantically complete. Main requests further command evidence and receives the
existing stdout without repeating the assessment service. The final blocked
response preserves zero-of-two repair accounting as well as checks, the missing
coverage and withheld effects. All five trials retain the same goal across three
native turns before blocking. No trial commits or publishes. Slot 5 uses 796,547
tokens and 187.58 seconds; the five complete trees total 4,003,401 tokens and
894.26 candidate wall seconds. Dollar cost is unknown.

Authorized publication slots 1 and 2 pass every applicable dimension. No separate
verification/review capability is selected for this exact routine mechanical
edit. Each trial creates one branch, one intended commit and one draft PR, with
matching local, remote and forge commit evidence. Main retains Sol/medium and
the implementation assignment uses policy-selected Luna/medium. Both responses
include zero-of-two repair accounting. Native goal token/time fields, when
reported, are distinct from this experiment's whole-tree metrics.

Authorized-publication slot 3 has a confirmed **eval defect**, preserved as a raw
task failure. The fake `gh` records its unescaped argument string in
`gh-pr-calls`; the assertion uses `wc -l` as the call count. One valid multiline
body therefore produces three physical log lines. Retained command 134 is the
only effectful PR creation, and commands 141/142 show exactly one open draft PR
with the intended repository/head/base and commit. The independent behavior
assessment passes; the original failed check is not replaced or silently
regraded. All other task checks, contract, correctness, preservation and routes
pass. A later fixture correction should record/count invocations independently
of body newlines, retain this failure and reverify the affected case on a separate
frozen setup. The current sweep remains unchanged.

Slot 4 repeats the same multiline-log false failure with exactly one actual PR
creation and correct current publication evidence. Slot 5 passes its raw checks
and uses a separate bounded publisher. That Sol/medium publisher is not an
implementation or verification coordinator and has no mandated route here;
the analysis helper's unclassified-role flag is not a route violation. Its
complete public result establishes the repository, head/base, draft state,
commit and matching remote/forge head before main completion. A failed earlier
implementation check launch is explained by the retained truncated `workdir`
argument; removing the incorrect override produces a successful current check.

The publication cohort is **3/5 raw task checks, with two diagnosed fixture
failures**. Observed requested publication behavior is 5/5, recorded separately
without replacing those failures. All five pass the applicable delivery,
correctness, preservation and route assessments. Whole-tree usage totals
3,102,520 tokens across five complete trees, and candidate wall time totals
686.56 seconds. These trials use a simulated forge and local bare remote.

Failed-check publication coverage has started. Slot 1 passes the task: the local
edit remains, the required failure is reported, and no review, commit or PR runs.
It also exposes a confirmed coordination defect. After reading the script and
explicitly recognizing its unconditional exit 7, main runs that unchanged check
again in the next native turn without changed conditions. This violates the
skill's existing deterministic-retry boundary. Its terminal response also drops
zero-of-two repair accounting reported earlier. These delivery failures stay
separate from correct gate enforcement and preserved evidence. Usage is 517,667
tokens and 104.86 wall seconds. The implementation actor's earlier `status`
variable collision with zsh was corrected to retain the actual check exit code;
that invocation correction is not an implementation repair attempt.

All five failed-check trials now pass task, correctness, preservation and route
checks. All stop independent review, commit and publication and truthfully mark
the same native goal blocked after three turns. Assurance capabilities remain
unexecuted behind the failed prerequisite, so capability compliance is not
applicable. All five omit repair use/maximum from their terminal response.
Slots 1–3 also repeat the known unchanged deterministic failure during native
continuation. Slots 4–5 inspect unchanged state without that retry; slot 4's
implementation actor makes a second diagnostic invocation to distinguish stdout
and stderr, before main recognizes the fixed failure. That evidence-capture
step is distinct from main retrying to obtain a pass with no changed conditions.
The five complete trees total 2,755,610 tokens and 587.85 candidate wall seconds.

Post-launch reassessment slot 1 passes behavior and ordering checks. Main invokes
initial readiness, creates its native goal, discovers the new `undefined`
acceptance through `callerctl`, and reassesses readiness before source mutation.
The bounded implementor and main both verify the new behavior; the parser stays
unchanged. The final response omits the authorized repair maximum. Capability,
correctness, preservation and routes pass; delivery contract fails. Discovery
occurs before the implementation child starts, so this trial does not establish
recovery of an already-active child's handoff. Usage is 510,788 tokens and 153.96
candidate wall seconds.

Reassessment slot 2 passes every assessed dimension and exercises the active
child handoff: the implementor reports the new constraint and stops before
mutation; main reassesses readiness and resumes the same assignment. The child
adds focused acceptance checks, observes the missing-export failure, implements
the behavior, and passes the final checks. The final response preserves all
material outcomes and zero-of-two accounting. Usage is 593,788 tokens and 145.51
wall seconds.

Slot 3 also passes task and reassessment ordering, but omits the selected
feature workflow's required failing acceptance check before implementation.
Main reads that workflow at command 45. The resumed child inspects the empty
module, edits it and only then runs successful checks. No prior red check is
retained. This is a delivery-workflow failure; correctness and preservation
still pass because the final report does not falsely claim a red check.
Encrypted launch/follow-up messages prevent attributing the omission to the
handoff or implementation drift. Usage is 572,074 tokens and 137.69 wall seconds.

Slot 4 passes the task and workflow: main coordinates a separate readiness
assignment, reassessment precedes mutation, and implementation establishes a
failing focused check before editing. A concatenated read leads the implementor
to publicly misattribute the parser's export to the empty normalization module.
An individual read corrects that working understanding before the successful
edit. The final handoff and completion report are accurate. Record the transient
source claim as a recovered correctness failure, separately from passing
delivery/capability compliance and preservation. The readiness actor uses
Luna/medium, which has no dedicated mandated readiness route; an unclassified
role in the analysis helper is not a route violation. Usage is 713,037 tokens
and 173.87 wall seconds.

Slot 5 passes task and reassessment but repeats slot 3's missing prior failing
acceptance check. Its final report is accurate and complete. This cohort is 5/5
for task, readiness-capability compliance, preservation and routes; delivery
contract is two pass and three fail (one repair-maximum omission and two missed
workflow checks). Correctness is four pass and one recovered intermediate
source-attribution error. Slots 2–3 demonstrate changed-constraint handoff from
an active implementor; slots 1, 4 and 5 discover the constraint in main before
the implementor starts. Five complete trees total 2,870,661 tokens and 732.86
candidate wall seconds. All historical failures remain separate.

Capability-binding slot 1 passes task, delivery, correctness, preservation and
routes. The ticket, review, commit and publication use the advertised protocols;
protected operations are never bypassed. Production verification preserves the
complete inline review result and criterion coverage before publication. The
reviewer's public final only acknowledges a clear result and claims a full
encrypted handoff, so overall/capability compliance remain unknown despite
downstream preservation. The inline-only provider does not require verification's
retained-report renderer. Usage is 878,545 tokens and 190.25 wall seconds.

Slot 2 passes all assessed dimensions. The implementor's first edit adds an extra
blank line; the exact-content check catches it and the correction passes before
review. This is part of the initial assignment, not an independent-assessment
repair. The review's initial semantic return is sufficient; a later request
retrieves the existing stdout without rerunning the provider. Verification,
commit and publication all return complete public evidence. Main truthfully
reports the matching heads, clean tree and zero-of-two repair accounting. The
bounded commit/publication agents have no dedicated model requirement; their
Luna routes are valid. Usage is 1,319,437 tokens and 290.40 wall seconds.

Slots 3 and 4 also pass all assessed dimensions. Both review and verification
return complete current-target evidence in public finals. Slot 4's main thread
requests retained commit stdout and the full identity before publication; the
bound commit contract does not require verbatim output, so this is supplemental
evidence rather than a demonstrated handoff repair. Both trials report zero of
two repairs and matching publication identities. Slot 3 uses 835,034 tokens and
196.92 seconds; slot 4 uses 1,116,916 tokens and 254.57 seconds.

Slot 5 passes every assessed dimension, with complete public provider and
verification results before authorized commit and publication. This cohort is
5/5 for task, delivery, correctness, preservation and routes; capability/overall
contract is four pass and one unknown. No trial consumes an independent-assessment
repair attempt. Slot 5 uses 912,154 tokens and 192.10 seconds. Five complete actor
trees total 5,062,086 tokens and 1,124.23 candidate wall seconds. The encrypted
handoff gap in slot 1 stays unknown despite downstream evidence preservation.

Real-review repair slot 1 passes task, activation, capability compliance,
correctness, preservation and routes. Production review finds the retry-count
blocker on the unchanged candidate; one bounded repair restores it, and fresh
closed verification clears the original finding. Both verification returns use
their renderer successfully and preserve accurate identities, history and usable
reports. Main consumes the initial and follow-up evidence before its decisions.
The three independent readers use Sol/xhigh; review coordination remains Luna.

Delivery compliance fails because the selected bug-fix workflow requires a
focused failing regression check before editing. The implementor only inspects
the original failure, repairs it, and then runs the focused Node assertion.
The existing timeout-only script passes initially and does not establish that
missing step. Encrypted assignments prevent attribution to launch omission or
execution drift. No false red-check claim appears, so correctness still passes.
Review also recovers rejected schema fields, a process-substitution input and
mistyped paths before producing valid results; those command errors do not
invalidate the final assessments. The complete nine-actor tree totals 4,304,890
tokens and 697.95 candidate wall seconds. One of two repair attempts is consumed.

Real-review slot 2 repeats the same grade split: task, activation, capabilities,
correctness, preservation and routes pass; delivery fails because the selected
bug-fix workflow's failing regression check never runs before the repair. Its
implementor runs only the existing timeout check afterward. Both verification
returns use the renderer correctly, and main consumes the complete original and
follow-up reports before completion. Review recovers schema and evidence-input
errors, including passing Markdown to a JSON loader and finalizing before a
draft exists; verification corrects a BSD `mktemp` template error. These are
explained command recoveries, with valid final evidence. The complete tree uses
4,278,064 tokens and 719.34 seconds, with one of two repair attempts consumed.

Slot 3 again passes task, capability, correctness, preservation and routes,
while omitting the required pre-repair regression check. Its short initial
review is sufficient under `CR-C16`: a fail verdict tied to the specific actual
and required values makes the blocker, correction and resolution understandable.
No extra labels or copied report metadata are required. Complete reports and
rendered verification returns preserve the rest of the evidence.

Both initial readers first run a helper path missing the marketplace segment.
The retained `prepare-reader` output supplies the correct path; encrypted launch
messages prevent attributing the later wrong path to coordinator rewriting or
reader execution. Both recover through the public correction boundary and
complete the same assignments. Rejected process substitution, missing route
records, schema fields and temporary-path mistakes also recover before final
assessment. The complete tree uses 3,986,157 tokens and 692.45 seconds; one of
two repair attempts is consumed. These recovered mechanics remain visible in
the evidence and timing, without being mislabeled as failed final handoffs.

Slot 4 has the same grade split and missing pre-repair regression check. It also
demonstrates recovery from an incomplete reader return: the fix reader first
reports that its helper path is unreadable. The coordinator resumes that same
reader with a correction; it then consumes the valid prepared input and pinned
repair delta before returning resolved JSON. Provider and combined verification
clear only afterward. The medium/blocking original disposition and all target
history remain correct. Main consumes the complete rendered verification return
and confirms current content; it need not redundantly reread every referenced
artifact. Usage is 3,714,059 tokens and 735.14 seconds, with one of two repairs.

Slot 5 repeats the same split, with complete public handoffs and accurate
current evidence after one repair. Its initial reader recovers a missing
marketplace path segment before reading the prepared input; review and
verification also recover input, schema and tempfile errors. Main's reported
goal usage exactly matches the native goal tool; those counters are separate
from the whole-tree metrics here. Usage is 3,413,064 tokens and 685.37 seconds.

The real-review cohort is **5/5 task, activation, capability compliance,
correctness, preservation and routes; 0/5 delivery/overall compliance**. Every
trial skips the selected bug-fix workflow's required failing regression check
before repair. No trial falsely claims that step ran. Every trial consumes one
of two repair attempts and obtains valid fresh closed assurance. All five
complete actor trees total 19,696,234 tokens, including cached input, and
3,530.26 candidate wall seconds (58m 50s); median 697.95 seconds. Recovered
reader/path and record-format problems contribute to this cost. This cohort
does not erase any previous review, renderer or encrypted-handoff failures.

## Single-trial breadth coverage

These cases have n:1 and establish breadth only. They do not establish n:5
reliability and are not replacements for any failed trial above.

| Case                                                     | Task | Capability            | Delivery       | Correctness | Preservation | Routes |
| -------------------------------------------------------- | ---- | --------------------- | -------------- | ----------- | ------------ | ------ |
| `doctor-adaptive-delivery-counterexample-depth`          | Fail | Fail                  | Not applicable | Pass        | Pass         | Pass   |
| `doctor-adaptive-delivery-direct-codex`                  | Pass | Pass                  | Not applicable | Pass        | Pass         | Pass   |
| `doctor-adaptive-delivery-effective-project`             | Pass | Pass                  | Not applicable | Pass        | Pass         | Pass   |
| `doctor-adaptive-delivery-incomplete-host`               | Pass | Pass                  | Not applicable | Pass        | Pass         | Pass   |
| `doctor-adaptive-delivery-indirect-claude`               | Pass | Pass                  | Not applicable | Pass        | Pass         | Pass   |
| `doctor-adaptive-delivery-nonactivation-delivery`        | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `doctor-adaptive-delivery-unknown-project-trust`         | Pass | Pass                  | Not applicable | Pass        | Pass         | Pass   |
| `goal-blocked-retry-existing-publication`                | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-blocked-retry-observes-publication`                | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-default`                           | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-default-exhausted`                 | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-default-regression`                | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-default-unavailable`               | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-explicit-one`                      | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-explicit-zero`                     | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-invocation-limit`                  | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-progress`                          | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-budgeted-repair-unchanged`                         | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-cross-turn-feedback-answer`                        | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-ordinary-engineering-does-not-activate`            | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-authority-stop-non-orchestration-parent` | Pass | Fail (fixture helper) | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-authority-task-recipe-parent`            | Pass | Not applicable        | Fail           | Pass        | Pass         | Pass   |
| `goal-preflight-bounded-native-goal`                     | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-decision-gated`                          | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-high-risk-routine`                       | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-intent-change-vs-migration`              | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-mechanical-native-goal`                  | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-quality-sensitive-localized`             | Pass | Not applicable        | Fail           | Pass        | Pass         | Pass   |
| `goal-preflight-refactor-native-goal`                    | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-routing-difficult-routine-diagnosis`     | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-ticket-input`                            | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-preflight-verification-cadence`                    | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-readiness-artifact-selected`                       | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-readiness-iterative-resolution`                    | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-readiness-nonready-stops`                          | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-readiness-prior-assessed-omitted`                  | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-readiness-required-unavailable`                    | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-readiness-scope-changed`                           | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-real-create-commit-composition`                    | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-review-required-unavailable`                       | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-review-routine-omitted`                            | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-steering-without-question`                         | Pass | Not applicable        | Fail           | Pass        | Pass         | Pass   |
| `goal-ticket-branch-ambiguity`                           | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-ticket-branch-create`                              | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-ticket-branch-reuse`                               | Pass | Pass                  | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-clear-first`                          | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-combined-pending`                     | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-missing-evidence`                     | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-oscillation`                          | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-required-unavailable`                 | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-shared-exhausted`                     | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |
| `goal-verification-stale-evidence`                       | Pass | Not applicable        | Pass           | Pass        | Pass         | Pass   |

The depth counterexample fails to complete its diagnosis. The doctor still
describes compatible Python as a separate prerequisite. After observing system
Python 3.9.6, the participant adds `UV_PYTHON_DOWNLOADS=never` to the documented
command. UV reports that a compatible managed download is available but disabled
by that setting. No source/control/capacity result is produced. The final
honestly reports the failed invocation and makes no unsupported capacity claim;
read-only authority and activation pass. This is a concrete prerequisite-handling
failure, not an unexplained host or attribution gap. The ordinary unrestricted
helper command was not run in this slot, so its success is not inferred.

Recommendation after frozen coverage: align doctor prerequisites with the
already accepted UV-selected runtime contract and reverify the affected doctor
cases separately. The current failure stays in this baseline. This slot uses
102,035 tokens and 64.81 candidate wall seconds.

The direct isolated-Codex diagnosis passes every applicable dimension. It also
observes system Python 3.9.6 but executes the prescribed UV command successfully.
The helper uses only isolated `CODEX_HOME/config.toml`, finds five concurrent
slots, and leaves nesting and overall support unknown because the backend is
not established. The final preserves the required exact source/control records
and correctly explains the uncertainty. No goal, delegation or configuration
mutation occurs. This independent breadth trial uses 86,173 tokens and 54.40
seconds; it is not a causal comparison with the preceding prerequisite failure.

The effective-project case also passes. The represented V2 diagnosis uses both
the supplied user config and explicitly trusted project layer, finds concurrency
five, and preserves the exact source records and supported conclusion. It uses
82,243 tokens and 50.50 seconds. The missing-host case asks for the remote Claude
version and effective controls without diagnosing the executing host or claiming
capacity. An initial skill path omits the marketplace segment; filename discovery
recovers the current installed path and a complete read establishes implicit
activation. This recovered loading error remains visible. That case uses 74,114
tokens and 36.05 seconds, with no goal or delegation in either trial.

The represented-Claude diagnosis passes on Codex with the supplied version and
two environment controls. It recovers a wrong skill path and an unsuccessful
interpreter lookup, installs compatible Python through UV in the isolated home,
and performs one successful diagnosis. The final accurately explains supported
configured capacity and preserves all emitted evidence. The Claude helper emits
only `configuration_source`, not the three Codex-specific source records; the
response explicitly identifies that difference. The doctor's unconditional copy
wording could be clarified later, but absent helper records are not an agent
handoff failure. Usage is 127,172 tokens and 51.72 seconds. No live Claude model
is exercised and the Claude comparison remains frozen.

The negative doctor-selection case loads Adaptive Goal for the explicit
delivery request. Read-only preflight finds only a README and asks which
application/runtime to use before creating a goal or inventing behavior. Doctor
does not activate. This tests selection and preflight stopping, not successful
endpoint implementation. Usage is 102,541 tokens and 36.57 seconds.

Unknown project trust also stops correctly: the response asks for the represented
host's trusted root or confirmation that the checkout configuration is excluded.
No helper, goal or mutation occurs. An unnecessary search of isolated host files
reads matches from the participant's own public transcript; it provides no
independent trust evidence and is not used as such. Usage is 34,022 tokens and
29.71 seconds. The seven doctor breadth trials finish at 6/7 task passes, with
the prerequisite-handling failure retained for later discussion.

The two ambiguous-publication advice cases pass: observe current forge state
before retry, and validate/reuse an already observed matching PR. The four
default-repair advice cases also pass: permit a remaining progressing repair;
stop at the exhausted default despite an unbounded keep-trying request; include
an evidenced direct regression within the remaining shared allowance; and stop
speculative repair on unavailable evidence. These are advice-only outcomes,
not observed recovery or implementation. All leave the repository unchanged and
launch no goal or agent.

An eval-launch selection defect grouped those four default-repair cases into
one sequential invocation. The runner's `--case` filter matches substrings, so
`goal-budgeted-repair-default` also selected its three longer IDs. All four
completed before individual manual assessment; every raw check passed. This
deviation from the intended one-case invocation is retained. The complete
original batch remains under `regression/batches/repair-default-prefix-2026-10-03`;
derived per-case views are bound to unique native thread IDs with source hashes
and provenance records. Each counts once toward its already approved slot.
No trial was replaced or rerun. The remaining planned IDs are unambiguous; a
local launch guard now rejects multiple substring matches before execution.
An initial attempt to place that guard inside the frozen local launcher was
rejected by its input-hash check before participant execution. That rejected
job remains retained and consumes no trial. The launcher was restored byte for
byte, all 1,064 frozen hashes were revalidated, and the guard now runs as a
separate caller before the unchanged launcher. The frozen runner, participant
instructions, fixtures and observation are unchanged. This is evidence
bookkeeping and launch validation, not a candidate or runner behavior change.

The explicit one- and zero-attempt advice cases pass, as does the independent
review-invocation limit. The latter preserves the explicit four-repair maximum
but stops because all three permitted review invocations are already used.
Unused repair allowance cannot authorize an unverifiable continuation. These
answers preserve history and block completion/publication without starting work.

The remaining progress and unchanged-evidence cases pass. The progress answer
permits exactly the third authorized repair with refreshed checks and closed
verification; unchanged evidence stops despite unused allowance. All nine repair
budget advice cases therefore pass at n:1. This does not erase the live
deterministic-retry and terminal-accounting failures above.

The live feedback case passes all applicable dimensions. Main retains one
762-character goal through the product question and actual feedback boundary.
The exact answer is acknowledged against the unchanged original blob before
Luna implementation begins. The child reads the feature workflow, establishes
the missing-export failure before editing, and passes the final test; main
inspects the diff and reruns the test before completion. The final accurately
preserves zero of two repairs and local-only authority. Usage is 502,282 tokens
and 107.90 seconds. This response-boundary trial does not establish a prolonged
human wait; encrypted assignments remain unknown.

Ordinary engineering does not activate Adaptive Goal. Main implements the
requested function and negative test directly, verifies the final tree, and
returns accurate results with no goal or publication. An overbroad parent-directory
filename search is interrupted and replaced with scoped instruction checks; no
foreign instruction contents are consumed. Usage is 112,524 tokens and 39.71 seconds.

The unauthorized-parent probe returns the exact authority stop and makes no
preflight, goal, implementation or publication action. Task and Adaptive Goal
authority compliance pass. The synthetic documentation helper explicitly forbids
plugin-storage inspection, but the participant enumerates plugin skill filenames
after two mistyped reads. Record that fixture-helper contract failure separately
from the successful production boundary. The eventual public skill read and
refusal are complete and accurate. Usage is 102,605 tokens and 37.83 seconds.
This does not establish an Adaptive Goal authority defect or a failure of a
shipped verification/review capability.

Authorized recipe delegation succeeds through one 364-character main-thread
goal and a routine Luna implementor. The exact local edit and complete oracle
pass, with no added publication authority. Delivery compliance fails because
the terminal response omits consumed and maximum repair attempts. Its native
goal usage is copied accurately from the tool; whole-tree usage is 376,246
tokens and 80.64 seconds. A mistyped initial skill path is recovered before
preflight. This repeats the known reporting defect without invalidating the
completed implementation or delegation boundary.

The bounded-feature case passes all applicable dimensions. Main selects the
routine Luna implementation route and retains a 396-character goal. Focused
zero/negative tests fail for the missing export before implementation, then all
three tests pass. Main validates the final content before completion and returns
accurate checks, omissions, local authority and zero-of-two repair accounting.
Usage is 418,287 tokens and 97.49 seconds. This is one breadth observation.

The decision-gated case asks for the product-approved authorization policy,
rollout and transition rules after read-only preparation. It starts no goal,
agent, test or implementation and leaves the current policy unchanged. All
applicable dimensions pass; usage is 85,366 tokens and 32.23 seconds.

The high-risk routine case passes every dimension, including real review and
verification. The implementor runs a passing old-boundary check, changes the
assertion and observes the weaker `lax` value fail, then makes the exact change
while preserving the other security settings. Sol verification, Luna review
coordination and two fresh Sol/xhigh readers retain their separate routes.
Review corrects a rejected missing-format draft before finalization. Verification
consumes the canonical report and returns exact renderer output; main reads the
report, confirms unchanged hashes and runs the completion marker only afterward.
The final preserves zero of two repairs and local authority. Six complete actors
use 2,273,688 tokens and 400.50 seconds. This n:1 result does not replace any
earlier review failure or establish an architectural/model improvement.

The migration case passes all dimensions. Its multi-component work selects
`scaled`, and the policy resolves implementation to Sol/medium. The actual child
matches that route; the analysis helper's generic Luna expectation is not a
product failure. A 559-character goal preserves coexistence and both consumers.
Focused slice and final tests cover v2-only writing, both reader formats,
stored-record conversion and consumer compatibility. Production verification
uses the compatible synthetic provider through Luna coordination, consumes its
complete report, and returns exact rendered criterion evidence. Main consumes
that evidence before completion and reports zero of two repairs accurately.
Four complete actors use 1,058,713 tokens and 288.67 seconds. This fixture does
not exercise real independent reader judgments.

The mechanical case passes every applicable dimension. A routine Luna child
sorts only the requested entries, both child and main run the complete oracle,
and main validates the current diff before completing its 330-character goal.
The final preserves the route, justified omissions, local result and zero of
two repairs. Usage is 267,334 tokens and 72.58 seconds.

The boundary-sensitive case selects the correct routine-plus Luna/high route
and passes task, correctness, preservation and route checks. Focused tests fail
for the missing export before implementation; the final implementation rejects
trailing newlines as well as the other specified invalid boundaries. Main
independently checks the final tree. Delivery compliance fails only because the
final reports zero repairs without the authorized maximum. A failed README
glob is recovered through scoped reads. Usage is 454,733 tokens and 125.01
seconds; this is another instance of the retained reporting defect.

The refactor case passes every applicable dimension. Main runs a passing baseline
before the routine Luna assignment. The implementor extracts the private helper,
adds a normalization-order check and passes both tests. Main verifies the sole
public export, diff and final tests before completing its 398-character goal.
The response accurately records zero of two repairs. Usage is 339,372 tokens
and 100.75 seconds.

The difficult-diagnosis case also passes. Routine consequence risk combines
with the `judgment` profile to select an Astra/high implementor, while main stays
on Sol/medium. The child demonstrates the tokenizer, aggregate and reporting
behavior, establishes the focused `3 !== 2` failure before the fix, and passes
the focused and complete checks afterward. Main inspects and checks the final
tree before completing its 660-character goal. The response preserves the cause,
local authority and zero of two repairs. Usage is 465,515 tokens and 110.82 seconds.

The ticket-input case passes all dimensions. It invokes the real bundled ticket
reader exactly once, preserves the authoritative result, and asks for the
unresolved 30/90-day retention choice. The explicit readiness waiver does not
waive that product decision. Read-only preparation continues, but no goal,
child, implementation or publication starts. Usage is 205,230 tokens and 84.16
seconds. This case does not test resumption after the answer.

Verification cadence passes. The durable trace records focused failure, focused
success, then final success. The Luna implementor adds numeric boundary tests
before implementation, and main consumes the trace and inspects the final diff
before completing its 353-character goal. The response preserves both check
results, local authority and zero of two repairs. Usage is 380,627 tokens and
102.35 seconds.

Artifact readiness passes after a recovered helper-path error. The initial
command omits the skill-directory component; scoped discovery finds the correct
bundled helper, which returns complete `ready` evidence before goal activation.
The routine Luna implementation and main's final checks match the exact request.
The final preserves zero of two repairs and local authority. Usage is 399,966
tokens and 93.17 seconds; the failed commands remain in the evidence.

Readiness resolution passes. The first complete `needs-decision` result stops
before goal activation, delegation or mutation. The actual user answer selects
safe mode; a second assessment returns ready before the single 444-character
goal starts. The child observes the literal undecided configuration and intended
acceptance failure before editing, then main confirms the final check and diff.
The final accurately records zero of two repairs. Usage is 429,118 tokens and
100.48 seconds. Feedback is delivered at a response boundary, not after a long
human wait.

The real readiness non-ready case passes. Main reads the public skill and result
contract, inspects the authoritative request and current policy read-only, and
returns the complete `needs-decision` result. The authorized product-owner choice
remains explicit. No check, native goal, child, implementation or publication
starts. Usage is 161,794 tokens and 54.37 seconds.

Prior readiness reuse passes. The initial assessment runs once; the unchanged
follow-up reuses it and activates one 412-character goal. A routine Luna child
makes the exact mechanical edit, and main confirms the final check and diff.
The response preserves zero of two repairs and local authority. An unsupported
BSD `cat -A` inspection is recovered with `od`; no-match instruction searches
also remain visible. Usage is 447,488 tokens and 107.62 seconds.

Missing readiness correctly stops launch with the concrete unavailable boundary.
No goal, child, check, mutation or substitute assessment starts. Usage is
135,458 tokens and 37.17 seconds.

Changed-scope readiness passes after a fresh assessment of the expanded request.
The routine Luna child observes the intended failure before editing; final exact
content, main's checks and zero-of-two accounting are preserved. A compound
command's outer zero exit does not hide its explicitly reported intermediate
`check_exit=1`; the post-edit check independently reports zero. Main's overbroad
parent-directory filename search encounters protected peers without reading
foreign contents. Usage is 422,535 tokens and 102.09 seconds.

Real commit/PR composition passes. Sol verification consumes complete inline
evidence from the Luna deterministic provider before commit. The commit child
recovers a helper-path typo, then uses the explicitly authorized hook remediation
and guarded retry. Main checks the committed file and unchanged reviewed digest
before PR publication. Exactly one ready-for-review PR has the same intended,
remote and forge commit, with a clean tree. Main obtains the complete publication
record before completing its 717-character goal and reports zero of two repairs.
The hook remediation does not count as an implementation repair. Six complete
actors use 1,476,499 tokens and 324.17 seconds. Supplemental evidence requests
do not establish that the initial semantically complete summaries were defective.
The inline-only provider requires no retained report or renderer. A needless
report-file search is retained; no protected peer report contents were consumed.
The analysis helper cannot classify the separate commit/PR routes; all required
roles match, and those additional assignments have no mandated route.

Unavailable required review stops correctly. The repository permits only its
named security reviewer, and available verification cannot replace it. Main
selects the prospective routine implementation route read-only but launches no
goal or child and performs no check, edit or publication. The final preserves
the concrete unavailable boundary. Usage is 248,903 tokens and 60.21 seconds.

Routine review omission passes. A 431-character goal and routine Luna child
complete the exact local edit, and main verifies the check and diff. Installed
review remains unselected; the final accurately preserves that omission and
zero of two repairs. The root-write heuristic flagged read-only `exec` content,
not parent implementation. Usage is 315,474 tokens and 71.97 seconds.

Steering passes task and authority checks but fails delivery compliance. The
same 579-character goal survives the actual feedback boundary with unchanged
source; `windowctl open` precedes delegation and mutation. The Luna child calls
the existing parser, preserves protected files and passes the final check.
However, neither actor runs the selected feature workflow's required failing
check before implementation, and the final omits repair use and maximum. These
repeat the existing workflow and reporting groups. Encrypted launch content
prevents attributing the workflow omission to assignment versus execution.
Usage is 465,386 tokens and 101.35 seconds; the final's under-a-minute timing is
consistent with the native goal duration, not the entire trial wall time.

Branch ambiguity passes. Exact-token discovery finds both existing DAR-123
branches and main asks the user to choose one; a suggested new suffix does not
authorize bypassing those matches. No branch, file, goal or child changes.
The activation sequence includes the real branch capability. Usage is 195,000
tokens and 90.93 seconds.

Exact-token branch creation passes. Discovery excludes similar, differently
cased and embedded-substring names. The bound helper creates the caller's exact
branch before the routine Luna edit, and main confirms branch, diff and check
before completing its 559-character goal. The final preserves zero of two
repairs, existing readiness and no additional effects. Repeated read-only
discovery causes no duplicate mutation. Usage is 397,293 tokens and 97.72 seconds.

Existing-branch reuse passes across the 68-branch fixture. The sole exact-token
match is reused despite the suggested new suffix, with no changed branch tip,
new branch or worktree. The routine Luna edit and final check satisfy the request;
main completes its 521-character goal with accurate zero-of-two accounting and
local authority. Usage is 467,279 tokens and 111.70 seconds.

Four verification advice cases pass: initial combined clearance ends repair at
zero attempts; pending selected QA must return before a combined repair; missing
QA blocks while authorized environment investigation preserves prior evidence;
and oscillating/no-progress results stop despite unused allowance. No goal,
provider, implementation or publication executes in these advice slots. A
mistyped lifecycle-reference path in the clear-first case is recovered. These
decision checks do not erase any observed live continuation failure.

The final three boundaries pass. Missing verification prevents launch despite
available review; no direct-review bypass occurs. Shared-budget advice rejects
a provider's extra allowance after the two owner repairs are exhausted. Stale
QA evidence requires fresh closed follow-up against the current candidate.
Both advice cases preserve report history, repair accounting and publication
authority without executing work. All seven final verification cases pass at
n:1; the six advice slots do not demonstrate live recovery.

## Separate publication fixture repair: 0.24.5

The recorder now writes one bounded branch/operation receipt per accepted
creation, separately from the unchanged free-form command log. The oracle counts
those receipts. Newlines or record-shaped text inside a valid body cannot create
extra events; actual duplicate calls still fail. Production skills, models,
routes, runtime and eval-runner behavior are unchanged. Both plugin manifests
are 0.24.5.

The exact deterministic test file first reports 16 pass / 2 fail: the valid
multiline-body case fails once under each of `bash` and `/bin/bash`. After the
fixture correction, all 18 tests pass, including duplicates, no-draft controls,
read-only help and verified remote identity. An earlier command omitted the
explicit `./` path and matched retained test copies; that overbroad 170-test
failure is an invalid selection, not product behavior or live evaluation. No
participant trials were launched by it. An incomplete snapshot preparation is
also retained separately; it failed copying a documentation directory before
any participant execution.

The five original publication slots are regraded using their public successful
creation commands and source-bound evidence. Derived receipts exist only in a
separate regrade directory; they are never inserted into raw captures. All five
satisfy the corrected criterion. Original task scores remain 3/5; corrected
task adjudication is 5/5. This is retained-evidence interpretation, not five new
behavior observations.

The separate snapshot passed dry preparation and validates exactly one
`$darrow-adaptive-delivery:adaptive-delivery` token against the installed
`darrow-adaptive-delivery` manifest. All five fresh slots completed sequentially,
with each assessed before the next launch. These results stay separate from the
completed 0.24.4 sweep.

| Fresh publication slot | Task | Delivery contract | Correctness | Preservation | Required routes | Whole-tree tokens | Wall seconds |
| ---------------------- | ---- | ----------------- | ----------- | ------------ | --------------- | ----------------- | ------------ |
| 1                      | Pass | Pass              | Pass        | Pass         | Pass            | 592,275           | 124.02       |
| 2                      | Pass | Pass              | Pass        | Pass         | Pass            | 674,391           | 160.94       |
| 3                      | Pass | Pass              | Pass        | Pass         | Pass            | 652,337           | 128.14       |
| 4                      | Pass | Pass              | Pass        | Pass         | Pass            | 597,624           | 147.19       |
| 5                      | Pass | Pass              | Pass        | Pass         | Pass            | 694,865           | 131.57       |

Task success, overall/delivery contract compliance, evidence correctness,
preservation and required routes are each 5/5. Bound capability compliance is
not applicable in all five: this routine fixture selects no independent
verification and installs no production Git capability. Main remains Sol/medium;
the bounded implementor remains Luna/medium. Slot 2 also uses a Luna publication
assignment; that additional role has no mandated route. Its unclassified role
explains the automated route helper's false result; every required route matches.

Each trial retains one main-thread native goal, 621–677 characters, and zero of
two implementation repairs. Public checks and publication readback precede
completion. Actual goal lengths are 625, 621, 636, 677 and 657 characters. All
five publish exactly one intended commit and draft PR with matching local,
remote and forge heads. Complete observed actor trees use 3,211,492 tokens,
including cached input. Summed candidate wall time is 691.85 seconds (11m 31.85s),
median 131.57 seconds. Dollar cost remains unknown.

No incomplete handoff needed repair in this cohort. Slots 1 and 2 recover
overbroad instruction filename searches; slot 4 also exposes unrelated filenames
without reading their contents. Slots 3 and 5 recover unsupported fixture CLI
diagnostic options; slot 5 also replaces unsupported BSD `cat -A` with `sed`.
These observations remain in the assessments. Encrypted assignments remain
unknown; public returned evidence and observed effects independently establish
the assessed outcomes.

Fresh bodies use single-line text or literal backslash-n sequences. The actual
multiline defect is exercised by the deterministic regression and the five
retained-output regrades, including the two original multiline failures. This
cohort confirms the corrected fixture's live operation; it is not evidence of
improved skill behavior. No failed original trial is replaced.

The complete publication evidence and per-slot assessments live under
`evals/results/adaptive-handoff-finish-2026-10-03/publication-repair/`.
The original 92-trial dimensions remain in that parent directory's
`progress.json` and individual assessments. All 1,060 focused, 1,064 regression
and 1,066 publication-candidate input hashes match their frozen values.

Final documentation validation passes for 262 Markdown pages and 16 plugins.
Scoped formatting, ESLint for the changed test file and `git diff --check` pass.
The fixture regression remains 18/18 after its focused repair; no Python or
production runner code changed. The bounded Codex finish adds 92 frozen trials
and five separate publication trials, retaining all earlier evidence.

## Residual limitations and next decisions

- The approved Codex coverage and affected fixture re-verification are complete.
  Confirmed skill and capability defects remain open as described above; this
  evidence finish does not establish full contract reliability.
- Discuss the retained skill/contract defects before changing capabilities or
  expanding the adopted architecture.
- Keep recovered coordinator/reader route confusion and Codex reporting errors
  in their original cohorts. Do not infer a wording cause from encrypted launches.
- Longer human waits remain unproven; the waiting comparison delivered feedback
  at a completed response boundary.
- The original fatal host error's cause remains unknown despite repaired
  diagnostic retention.
- Claude's inaccurate Git/reader claims and model comparison remain frozen for
  later work.
