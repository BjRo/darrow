# Adaptive Delivery owner transport follow-up

The user requested a checkpoint commit and continuation of the proposed isolated
experiment. **31eb00d0** checkpoints the eval repairs and completed 60-trial pilot.
The previous pilot and unchanged native arm A remain the baseline. Production
orchestration, review, verification and the eval runner remain unchanged.

## User-directed stop for ownership reconsideration

On October 1, the user requested a proposal for main-thread native-goal ownership
before further app-server experimentation. The outer trial sequencer was stopped
with **16 of 20 trials complete**. Already-active real-review **B4** then finished
normally, and the stopped sequencer was terminated after its result was retained.
Final coverage is **17/20**; **C4, B5 and C5 remain unrun**, not failed or passed.
The frozen candidate, unfinished work, original plan, all previous failures and
native launch/feedback attribution gaps remain preserved. No alternative ownership
implementation is authorized by this investigation.

The local `design-reconsideration.json` records the process boundary and remaining
slots. The previous 60-trial pilot is unchanged. Both frozen input inventories
still match: **781 previous-pilot files and 646 transport-follow-up files**.

| Case                               | Arm            | Completed | Common task | Core transport | Median harness seconds |
| ---------------------------------- | -------------- | --------: | ----------: | -------------: | ---------------------: |
| Combined repair, fixture providers | B, no goal     |       5/5 |         5/5 |            5/5 |                    223 |
| Combined repair, fixture providers | C, native goal |       5/5 |         3/5 |            5/5 |                    222 |
| Existing review, real capabilities | B, no goal     |       4/5 |         3/4 |            3/4 |                   1003 |
| Existing review, real capabilities | C, native goal |       3/5 |         3/3 |            3/3 |                    821 |

Configured real-review activation is **7/7**; the synthetic case has no configured
activation grade. No delivery trial demonstrated automatic continuation. Six of
the seven real-review trials have an audited provider-boundary or renderer
omission despite six task passes. Core transport excludes the separately retained
pre-helper launch failures. Timing includes failed/recovered operations and
excludes grading; it does not establish a speed or cost advantage.

## Scope

Experimental B uses an app-server owner without a goal. C attaches a native goal
to the same kind of owner. Both preserve parent preflight and route selection.
The candidate is Codex **gpt-6-luna / medium**, with passive owner evaluation.
The experimental plugin copies are **0.23.16**; the shipped plugin is **0.23.14**.

The transport now reads raw workflow, assignment and goal files and serializes
the API request. It validates the 4,000 Unicode character limit before launch.
The instructions keep task facts and authority in the user assignment and put
workflow rules in developer instructions. Running feedback uses the controlling
connection. Competing clients fail before opening another app-server connection.
Completed public finals remain available even if goal state is absent or a
subsequent API read fails. The parent must preserve the complete shell result,
including its wait handle.

The app-server API requires an active turn identity for steering. Goal objectives
are limited to 4,000 characters; setting a new objective resets usage accounting.
The experiment preserves the original goal through feedback. See the official
[app-server protocol](https://learn.chatgpt.com/docs/app-server).

## Deterministic and source verification

**15 deterministic tests pass.** They cover literal input serialization, Unicode
limits, validation before process creation, competing clients, missing goals,
completed response retention after connection loss, active feedback, feedback
arriving during final reads, final versus commentary, newer continuation results,
host stop states and resume settings.

One independent bounded source review found two defects: feedback queued during
the final API reads could be missed, and a lost connection could prevent the
already observed final from being surfaced. Both received focused regression
tests and fixes. The reviewer ran the then-existing 12 tests. This was a source
review under an explicit no-Git/no-write boundary, not the review capability's
validated provider result. No repeated review round was used.

The repository-wide `bun run check:python` passed, including **222 Adaptive
Delivery tests** and **336 review tests, one skipped**. It does not automatically
discover the gitignored prototype tests; those were run separately.

## Live diagnostics

The first C diagnostic passed: one goal creation, two observed owner turns,
**zero explicit `turn/start` requests**, and one accepted steer during the first
turn. The owner finished the first bounded inspection, automatically continued
to the second, and returned both markers with the corrected user label **BLUE**.
The original user assignment said RED; developer instructions contained neither
label. An intentional competing client was rejected without interruption or
goal clearing. This establishes one actual continuation, not delivery reliability.

The first B diagnostic accepted the same in-flight correction and returned its
first-turn checkpoint. Its explicit resume exposed a prototype defect: the
initial API response had `dangerFullAccess`, while resume returned
`workspaceWrite`. The resumed shell failed with `sandbox_apply: Operation not
permitted` inside the outer eval sandbox. Both responses and the failure remain
retained. Resume now resubmits and checks the original execution settings and
developer instructions while preserving user history. A fresh B diagnostic
returned both markers and BLUE through the same owner after an explicit resume.
It used two explicit turns, no goal, and no automatic continuation.

The final C diagnostic repeated the automatic continuation and in-flight
correction successfully: two owner turns, one goal creation, no explicit turn
start, and no destructive control calls. Both C diagnostic outcomes remain
retained. The only subsequent code change surfaces an already retained error
in terminal output; it changes no execution or feedback behavior.

The candidate is frozen; further delivery trials are stopped as described above. The planned comparison is
B/C × combined repair/existing review × n:5, **20 fresh
trials**, with every failed launch retained. Original architecture-specific
checks remain visible separately from common task checks. Goal completion is
not proof that every capability handoff satisfied its contract.

All ten combined-repair launches duplicated concrete task facts into developer
instructions despite the new guide. This launch-priority defect remains open
and is counted separately from task and transport checks. The first pair copied
most of the compiled contract; later workflows were shorter but still contained
task scope or authority. Each first-pair owner needed two explicit status
follow-ups to return fuller assessment evidence. C completed its goal in the
initial turn; no automatic delivery continuation was observed.

The initial analysis check falsely rejected C's goal preservation because the
host trimmed the input file's trailing newline. The retained initial receipt
and all later goal reads prove the same objective and creation identity. The
analysis now compares later state to that initial receipt and accepts only
outer whitespace trimming from submitted text. Two calibration tests accept
this observed valid case and reject changed text or an absent initial receipt.
The original exact-match failure is retained separately. This changes neither
the candidate nor the production runner's original grades.

At eight completed delivery trials, common task checks pass **7/8** and the
app-server return checks pass **8/8**. This is not an error-free launch pipeline:
combined repair **C4** first failed shell parsing, then corrected and retried the
launch despite the frozen guide's prohibition. Exactly one owner was accepted.
Both the failed command and the retry remain recorded.

C4's task failure occurred later. The parent demanded separate absolute artifact
references for every provider and ordered a blocked response if they were absent.
The QA provider had returned its complete results inline. The owner accurately
reported that separate QA files were absent; the parent then falsely treated the
finished repair and clear combined assessment as blocked. The exact parent
feedback establishes this attribution. All three completed owner responses were
delivered, and the goal stayed complete. Fixing transport does not correct an
invented completion-evidence requirement.

Combined repair is now complete: **B 5/5 common task, C 3/5**, with app-server
return checks **5/5 in both arms**. The unchanged native baseline was 5/5; the
previous app-server B/C results were 2/5 and 5/5. All ten new candidates were
repaired and received clear selected assessments. No automatic continuation
occurred in these delivery trials.

The second C failure, C5, concerns completion evidence. The original semantic
grader flags missing independent-review provenance in the parent's final
response. The actual independent assessment ran. A separate transcript and
artifact inspection confirms that the owner falsely described review-only
files as combined results containing QA evidence; the parent repeated those
labels. The complete QA results had been returned inline. Keep the presentation
grade distinct from provider execution and the verified artifact-description
defect. The real review/verification case is now running.

A complete parent command audit finds **four failed launch commands across
three trials**: C1 and C4 had unmatched shell quotes; B3 had an unmatched quote
and then an adapter path missing `/config/`. All were corrected before exactly
one owner was accepted. These corrections departed from the experimental
no-prelaunch-retry instruction. Clean launch commands are therefore **B 4/5,
C 3/5**, alongside app-server return checks of 5/5 each. Raw instruction files
removed JSON serialization from the parent, but did not eliminate command
construction mistakes. Preserve the failed commands and distinguish correcting
a provably unexecuted command from replacing an accepted or ambiguous owner.

## Developer instruction inheritance

A passive provenance probe during real-review B1 found the complete submitted
owner developer workflow in developer messages of both verification children
and the initial standards/spec readers. The parent eval thread did not contain
that submitted workflow. The probe retains only matches against already-known
submitted instructions, message sizes and public thread identities; it excludes
private reasoning and unknown prompt contents.

Thus the workflow's sole-owner role instruction reaches assessment contexts too.
This establishes inheritance, not causation for a particular handoff failure.
Developer-level workflow instructions need explicit role scope before production
adoption. Moving user task facts into user input remains necessary but does not
by itself resolve inherited owner instructions. The frozen candidate and the
review/verification capabilities remain unchanged for the comparison.

## Partial real review coverage

The first real-review B trial passed task and activation checks after recovery,
but failed uninterrupted transport: the original controlling operation reached
its frozen 1,200-second bound while follow-up verification was still running.
Closing that operation aborted the active owner and coordinator turns. The Spec
reader had returned; the coordinator had not completed its final handoff.

Two feedback operations resumed the same owner. The first requested existing
status and returned blocked. The second requested completion of the unfinished
closed follow-up. A fresh assessment returned a rendered combined conclusion,
and the parent reported local completion. Total harness duration was **2,029
seconds**. The initial timeout remains a failed operation; recovery does not
turn this into an uninterrupted transport pass. Why this execution took longer
than the bound is not established.

All three verification coordinators performed review-provider mechanics in
their own contexts and delegated only axis readers. This violates the existing
provider-isolation requirement. The initial and resumed coordinators returned
rendered verification conclusions; the interrupted coordinator did not finish.
All four observed axis readers used **gpt-6-sol / xhigh**. The owner and
coordinators retained **gpt-6-luna / medium**. This trial is evidence of eventual
task success with transport and composition failures, not a fully compliant run.

The first C trial passed task, activation and transport checks in one owner
turn. It created one goal, which completed without automatic continuation or
explicit feedback. Initial verification correctly delegated a separate review
provider and returned the required rendered assessment. Follow-up verification
instead combined coordinator and provider work, then returned criterion
reconciliation and the complete provider report without running the verification
renderer. The conclusion reached the owner; the missing isolation and renderer
are execution deviations, not transport loss or total absence of reconciliation.

C1 also reported mismatched ad-hoc digests. The retained commands establish
different procedures: the owner used `git hash-object --stdin`; the follow-up
used `shasum -a 256`. That difference does not prove the candidate changed.
The canonical provider target binding and current-candidate checks passed.
Avoid adding a second, incompatible evidence identity alongside the provider's
existing one.

B2 failed the task after receiving a usable initial assessment. Its owner
incorrectly treated the selected **owner** route, Luna/medium, as a requirement
for independent review readers. Those readers had correctly used Sol/xhigh.
The owner rewrote verification's `progress` conclusion as `blocked` and made
no repair; the parent repeated that objection. Both returned responses passed
transport checks. This is a false completion blocker introduced after delivery
of the assessment, not missing reviewer execution or a failed reader route.
The submitted assignment's unqualified `route` field creates avoidable scope
ambiguity, although it also requires following the review capability's contract.
Any next owner template should name the execution-owner route explicitly and
preserve each capability's own reader policy.

C2 and B3 also passed task, activation and transport checks. C2 returned full
rendered verification in both stages but ran both review providers inside the
coordinators. B3 correctly separated the initial provider, then combined provider
and coordinator work during follow-up while still returning a full rendered
assessment. B3 needed one status correction after its owner first returned an
assessment-style handoff instead of explicit owner completion accounting. The
same owner supplied that accounting without additional tool work.

C3 passed task, activation and transport checks. Both initial and follow-up
verification used a separate review provider, preserved independent readers and
returned complete rendered verification assessments. Initial verification invoked
its renderer at public call 88; follow-up invoked it at 154. All three independent
readers used Sol/xhigh; owner and coordinators used Luna/medium. These are positive
examples at both audited capability boundaries. One goal completed in one owner
turn, with no automatic continuation or explicit owner feedback.

A passive probe also found the submitted owner developer workflow in C3's
assessment contexts. Successful boundaries under those same inherited instructions
show that inheritance alone does not explain the failures in other trials.

At the stop request, real-review task checks were **B 2/3 and C 3/3**;
uninterrupted core transport checks were **B 2/3 and C 3/3**. All six configured
activation checks passed. Five of the six completed real-review trials had at
least one supplemental provider-boundary or renderer omission. These partial
denominators must not be presented as completed n:5 results.

The already-active B4 completed with task, activation and transport checks passing.
Both its initial and follow-up verification performed review-provider mechanics
inside the coordinator and delegated only axis readers. Both returned complete
rendered criterion reconciliation and usable provider references. All three readers
used Sol/xhigh; owner and coordinators used Luna/medium. Final partial real-review
task and transport scores are therefore **B 3/4 and C 3/3**, with **7/7 activation**.
The three unfinished slots are preserved for reference and must not resume without
a new user decision.

## Local evidence

All prototype files, diagnostics, completed trial evidence and unfinished work remain local:
[transport experiment](../../evals/results/adaptive-owner-transport-2026-10-01/).
The [previous pilot report](adaptive-delivery-owner-pilot-2026-09-30.md) preserves
the native baseline, transport defects and both capability handoff boundaries.

## Interpretation boundaries

The unchanged native A baseline passed the common task checks in both selected
cases, **5/5 each**. Its real-review trials all had supplemental capability
contract misses: incomplete verification reconciliation or a review provider
executed inside the verification coordinator. A task pass does not establish
full composition compliance in any arm. Fresh axis readers alone do not satisfy
the verification contract's separate review-provider requirement.

The diagnostics prove that a native goal can continue its owner automatically
and accept a correction. The seventeen completed delivery trials provide no
automatic-continuation evidence. Their additional turns were explicit feedback.
Neither goal completion nor a returned final proves correct provider execution
or accurate descriptions of the available evidence.
