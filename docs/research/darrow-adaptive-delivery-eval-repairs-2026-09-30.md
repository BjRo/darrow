# Adaptive Delivery: eval defect repairs

## Result

**14/14 Codex cases completed**, **52/70 raw task grades**, **19/20 configured positive activation checks**. Unconfigured activation is not scored.

Doctor follow-up on **0.23.14**: **9/10 task**, **10/10 activation**. Using the latest batch for each selected case gives **57/70 task**, **20/20 activation**, with **7/14 cases** meeting every configured threshold. Both batches remain visible below; 80 new trials have run in total.

Checkpoint: **67a32a32 — fix(adaptive-delivery): checkpoint launch names and full eval coverage**. This local commit records the complete original sweep; no push was requested.

The eval repair candidate is **0.23.13**. Both product skill bodies are byte-identical to the 0.23.12 baseline. Changes are confined to evaluation inputs, assertions, synthetic providers, their tests, the evaluation specification, and version metadata. Skill errors and the parent-status/review-next-action contract questions remain deferred.

## What changed

- Doctor cases identify represented host configuration and effective environment. A prerequisite refusal cannot count as a completed diagnosis. The project-layer criterion accepts source attribution in the helper records. The known doctor system-Python prerequisite remains unchanged.
- Semantic criteria accept remaining-allowance wording, blocked outcomes without redundant publication disclaimers, focused-check prose, and advice that incorporates returned QA findings. A separate check preserves the explicit repair maximum and rejects contradictory budget reasoning.
- The capability-token assertion uses available grep against `.git/fixture-bin`, checks four skill instructions, and rejects missing paths and search errors.
- The PR mock accepts the current `--body-file` contract. Its regression exercises that path through the real guarded commit workflow.
- Synthetic review results retain stable finding identity, severity, blocking disposition, evidence, original target, absolute original-result reference, and assessment history. Repeated clear results stay clear; repeated unresolved candidates remain no-progress.
- Installed review helpers are excluded from the product candidate, and all fingerprint callers use the immutable runtime wrapper. The repair oracle permits repeated clear confirmations while still checking the initial blocker, changed target, current evidence, and no mutation during assessment.

## Verification

- `bun run check:python` passed for every package. Adaptive Delivery: **222 tests**, **98.00% statement coverage**, **96.57% branch coverage**. An initial lint failure was corrected before the passing full gate.
- Exact targeted fixture tests: **28 passed**, including token checks under both `bash` and `/bin/bash`, invalid inputs, and real commit/PR composition. The first test command used substring paths and accidentally selected archived copies; rerunning with exact `./` paths passed.
- **24/24** final semantic calibration samples have expected verdicts: retained valid answers pass and counterexamples fail. Three initial criterion mistakes and two subsequent overly strict grades remain recorded. Calibration is regrading evidence, not a fresh model task result.
- One fresh-context review found two YAML indentation mistakes; both were fixed. The reviewer confirmed all **62 plugin cases parse**, synchronized manifests, and no remaining material findings in its bounded scope. It did not run live trials or independently regrade calibration.
- Live runs use Codex **gpt-6-luna/medium**, **n:5**, **jobs:3**, **100% threshold**, and **passive owner evaluation**. Twelve corrected cases plus two shared-provider controls receive fresh batches.
- The frozen snapshot keeps the `darrow-adaptive-delivery` basename. Actual rendering verifies the explicit invocation token; the implicit Claude-representation diagnosis stays implicit. The overlapping default-budget case uses an unchanged isolated runner for exact selection.
- Native Claude execution is not measured in this Codex retest. The changed Claude fingerprint caller is syntax-checked and the copied-provider deterministic tests exercise both host layouts.

The evaluated parent runs on **gpt-6-luna/medium**. Owners use the unchanged plugin routing policy; for example, the migration control selects **gpt-5.6-sol/medium** through the `scaled` profile. The campaign does not override those ownership routes.

## Case overview

| Case                                            | Original raw task | Corrected raw task | Activation | Role                    |
| ----------------------------------------------- | ----------------- | ------------------ | ---------- | ----------------------- |
| `goal-budgeted-repair-default-exhausted`        | 2/5               | 3/5                | Not scored | Corrected case          |
| `goal-budgeted-repair-default`                  | 4/5               | 5/5                | Not scored | Corrected case          |
| `goal-budgeted-repair-invocation-limit`         | 2/5               | 5/5                | Not scored | Corrected case          |
| `goal-intent-capability-bindings`               | 0/5               | 3/5                | Not scored | Corrected case          |
| `goal-preflight-intent-change-vs-migration`     | 4/5               | 5/5                | Not scored | Shared-provider control |
| `goal-real-create-commit-composition`           | 0/5               | 2/5                | Not scored | Corrected case          |
| `goal-review-repair-verification`               | 0/5               | 3/5                | 5/5        | Corrected case          |
| `goal-preflight-verification-cadence`           | 3/5               | 3/5                | Not scored | Corrected case          |
| `goal-verification-combined-pending`            | 4/5               | 5/5                | Not scored | Corrected case          |
| `goal-verification-combined-repair`             | 4/5               | 5/5                | Not scored | Shared-provider control |
| `goal-verification-missing-evidence`            | 3/5               | 5/5                | Not scored | Corrected case          |
| `doctor-adaptive-delivery-counterexample-depth` | 1/5               | 4/5                | 5/5        | Corrected case          |
| `doctor-adaptive-delivery-effective-project`    | 1/5               | 0/5                | 5/5        | Corrected case          |
| `doctor-adaptive-delivery-indirect-claude`      | 3/5               | 4/5                | 4/5        | Corrected case          |

The inputs and checks changed, including represented doctor prompts. These columns retain both measurements; they are not a matched comparison proving product improvement. No failure is replaced by a later pass.

## Remaining failures

### goal-budgeted-repair-default-exhausted

Raw task: **3/5**; failed trials: 1, 2.

**Skill repair-budget errors remain.** Trial 1 initially recommends another repair, then correctly explains that two of two attempts are used and says to stop. Trial 2 recommends another repair and invents possible authority to extend the limit because progress occurred. Both violate the unchanged shared repair contract; these are substantive contradictions or unauthorized continuation, not missing numeric or publication boilerplate. All repository-preservation checks pass.

**Next step:** Defer to the requested skill-error phase: make the next action consistently follow the shared budget and progress decision. Keep the corrected raw 3/5 and original 2/5; no skill change is made during eval re-verification.

### goal-intent-capability-bindings

Raw task: **3/5**; failed trials: 1, 5.

**Review evidence and verification handoff failures.** All five trials pass the corrected token/path assertion and every deterministic workflow check, including the selected review before publication. Trial 1 reports that implementation, checks, commit and PR completed, but refuses full completion because the owner supplied only a review summary without the complete review response or retained report reference. Trial 5 reports publication already occurred without the combined verify-change result it treats as required. Its final response explicitly calls the workflow incomplete. These are evidence/contract handoff failures under the unchanged skill, not unavailable grep, an incorrect helper directory, or a failed capability-token check. The final responses establish the incompleteness; encrypted owner instructions are not available to assign the exact handoff source.

**Next step:** Retain raw 3/5. In the later skill phase, reconcile capability obligations and carry sufficient verification and review evidence through the owner-to-parent handoff before publication. Discuss any change to the complete-review-response contract with the other contract questions. Do not turn an explicitly incomplete response into a passing completion grade.

### goal-real-create-commit-composition

Raw task: **2/5**; failed trials: 2, 3, 5.

**Provider-unavailable refusals and parent-status contract.** Trials 1 and 4 pass the complete real commit, authorized hook retry, and PR publication workflow. Trial 3 also passes every workflow and response check, but native receipts retain two parent list_agents calls after handoff. Trial 2 refuses before implementation, claiming independent-review-protocol is unavailable. Trial 5 implements and passes the focused check but returns a blocked verification result claiming the same provider is unavailable, leaving review, commit and publication incomplete; it also has a parent list_agents call. Neither refusal retained the actual failed provider lookup or shell error, so the underlying availability cause cannot be reconstructed. The frozen fixture contains the command, but that alone does not prove the failing actor's PATH or invocation. These refusals never reach the repaired --body-file mock. No new PR-mock failure appears in the three trials that reach publication.

**Next step:** Keep raw 2/5, retain both availability refusals with unresolved cause, and carry their diagnosis into the later skill/host handoff phase. Add bounded command-availability diagnostics for that targeted investigation before attributing them to native-tool confusion or fixture PATH. Discuss parent list_agents separately. The user already authorized finishing coverage while retaining further unresolved failures.

### goal-review-repair-verification

Raw task: **3/5**; failed trials: 1, 3.

**Parent-status contract and omitted finding description.** All five trials activate the required skills and pass every deterministic workflow assertion: original blocking assessment, authorized repair, changed target, checks before assessment, clear fix verification, no mutation during assessment, and local-only effects. Trial 1 additionally records a parent collaboration.list_agents call after acceptance, causing the current parent-boundary failure. Trial 3 says the original blocker was resolved and lists the final RETRY_COUNT value, but never identifies the prior retry-count defect in its user-facing response. The unchanged criterion already accepts a plain-language retry-count defect instead of the exact numeric value; the complete assessment/finding-history reporting contract supports retaining that failure. No repaired synthetic review identity, history, repeated-clear, or fingerprint assertion fails.

**Next step:** Retain raw 3/5 task and 5/5 activation. Address the lost finding description with the other evidence-handoff skill errors. Discuss parent status polling separately, without silently relaxing the contract. The eval fixture repairs are verified in all five full repair cycles.

### goal-preflight-verification-cadence

Raw task: **3/5**; failed trials: 2, 5.

**Parent-control contract and missing red-step skill error.** Trial 2 passes implementation, durable evidence, red/green/final sequencing and semantic reporting, but the native receipt records collaboration.list_agents after the owner handoff at ordinal 60. Trial 5 passes implementation, durable evidence and reporting, but its check trace contains only focused pass followed by final pass. The unchanged skill and implement-feature workflow require confirming the missing behavior fails before production changes when a stable seam and independent oracle exist, as they do for this isEven fixture. The encrypted owner contract is unavailable, so attribution between parent handoff and owner execution remains unverified; the missing red behavior itself is established. All five trials pass the revised semantic reporting criterion.

**Next step:** Keep raw 3/5 and preserve the real red/green/final oracle. Discuss the parent wait-tool contract and repair the missing-red behavior in the requested later skill phase; do not weaken this eval or infer the encrypted handoff content.

### doctor-adaptive-delivery-counterexample-depth

Raw task: **4/5**; failed trials: 2.

**Known doctor prerequisite skill defect.** The corrected represented-host fixture passed task checks in four trials and explicit activation in all five. Trial 2 expressly refused the bundled doctor after observing system Python 3.9.6, although UV and the exact backend were present. It then supplied a conditional capacity explanation while acknowledging that no diagnosis completed. The corrected criterion properly rejects that refusal; this is the existing separate-Python prerequisite defect, not an incorrect three-slot fixture or activation failure.

**Next step:** Keep the raw 4/5 task and 5/5 activation. Defer removal of the unnecessary doctor system-Python prerequisite to the requested skill-error phase, then retest the represented Codex and Claude doctor cases. Do not weaken the completed-diagnosis requirement.

### doctor-adaptive-delivery-effective-project

Raw task: **0/5**; failed trials: 1, 2, 3, 4, 5.

**Residual eval attribution defect plus known doctor prerequisite error.** Trial 1 explicitly declined the helper because ambient Python was 3.9.6; that is the known unmodified skill prerequisite defect. Trials 2–5 completed valid diagnoses, reported effective concurrency five, both absolute checked and contributing paths, and checkout_config_used: yes. Four bounded public doctor reports with exit code zero independently retain the same source chain and five-slot result. The revised semantic criterion still rejected those four solely for lacking an additional sentence attributing the number five specifically to the project file. The independent source-contribution check already passed, so this remains redundant presentation grading. Raw task is 0/5 and explicit activation is 5/5; do not interpret this as five incorrect diagnoses.

**Next step:** After finishing the frozen 0.23.13 retest, simplify the redundant precedence criterion to the effective numeric capacity while retaining the separate checked/used-source assertion. Regrade these four valid answers, the actual prerequisite refusal and a source-ignoring counterexample, then run a fresh n:5 batch. Preserve this 0/5, the initial calibration records, and the known skill refusal.

**Eval follow-up completed:** The 0.23.14 batch is 4/5 task and 5/5 activation. All four completed diagnoses grade correctly; one prerequisite refusal remains. The original 0/5 and its assessment are retained above.

### doctor-adaptive-delivery-indirect-claude

Raw task: **4/5**; failed trials: 3, 4.

**Residual eval host-label false negative and implicit activation miss.** All five fixtures retained a completed public doctor report with exit code zero and the supplied Claude concurrency five / nesting four. Trial 3 explicitly describes the represented Claude Code 2.1.219 session, but the grader rejects its canonical host: claude field as a claim about the executing host. That is a false negative caused by the redundant exclusion in the criterion. Trial 4 passes all task checks but has a complete skill-read observation with no loaded skill. Correct helper execution therefore does not establish the required implicit skill activation. Raw task and activation are each 4/5, with different failed trials.

**Next step:** After this frozen run, remove the redundant executing-host exclusion while retaining the represented version, environment, completed-diagnosis and capacity requirements. Calibrate against the valid report, a refusal, and a diagnosis of the wrong environment, then rerun n:5. Keep the separate implicit-activation miss for the skill phase and do not make this case explicit.

**Eval follow-up completed:** The 0.23.14 batch is 5/5 task and activation, with five independently retained successful helper reports. The original 4/5 task, separate 4/5 activation and all calibration mismatches remain retained; an unchanged skill body passing later does not erase the earlier activation miss.

## Doctor criterion follow-up

The 0.23.13 live runs exposed two remaining presentation false negatives despite passing initial calibration. Candidate **0.23.14** changes only those two semantic criteria and the paired manifest versions; both product skill bodies remain unchanged.

- Project diagnosis: keep the separate absolute checked/used source-path and checkout-contribution assertion. The second assertion checks completed effective capacity of five, without requiring another attribution sentence.
- Represented Claude diagnosis: require a completed diagnosis of Claude Code 2.1.219, both named controls, the supplied 5/4 environment, and full-path support. Remove the redundant host-label exclusion and distinguish using supplied values from refusing to run.
- Follow-up calibration: **7/7 project** and **8/8 Claude** samples have expected verdicts, including valid retained reports, actual prerequisite refusal, incorrect capacity, ignored source contribution, wrong host, and wrong environment. An earlier Claude criterion proposal had two false grades; that calibration remains retained.

| Case                                         | 0.23.13 raw task | 0.23.14 raw task | 0.23.14 activation |
| -------------------------------------------- | ---------------- | ---------------- | ------------------ |
| `doctor-adaptive-delivery-effective-project` | 0/5              | 4/5              | 5/5                |
| `doctor-adaptive-delivery-indirect-claude`   | 4/5              | 5/5              | 5/5                |

The follow-up does not replace the raw grades above or establish a product improvement. It measures two changed eval assertions on fresh trials.

### Follow-up: doctor-adaptive-delivery-effective-project

Failed task or activation trials: 3.

**Doctor prerequisite refusal remains; corrected diagnoses grade correctly.** Four trials complete the helper diagnosis and pass both source-contribution and effective-capacity criteria. Four retained public doctor reports independently show exit zero, both absolute configuration paths checked and used, checkout_config_used: yes, and effective capacity five. Trial 3 refuses before diagnosis, citing ambient Python 3.9.6 and claiming UV found no compatible runtime. The actual failed runtime lookup was not retained, so that narrower availability claim is not independently established. Its explicit refusal is correctly rejected by both criteria. All five explicit activation checks pass. The earlier source-attribution false negatives do not recur.

**Next step:** Retain raw 4/5 task and 5/5 activation together with the previous 0/5. Treat the separate doctor Python prerequisite and the unverified lookup as later product/host diagnosis; use the frozen UV entrypoint when that skill issue is addressed. Do not count a refused diagnosis as successful or change review/verification capabilities.

## Closeout and next investigation

Both frozen-candidate provenance audits passed: each retained **618 source-input hashes** and **132 candidate-file hashes**, with unchanged product skill bodies. The 14-case audit completed before the two follow-up criteria and manifest versions changed. The two-case follow-up audit completed against 0.23.14. Neither earlier raw results nor failure records were overwritten.

The user next requested investigation of app-server plus a native persistent goal attached to the separate, route-selected execution owner. Preserve parent preflight and model/effort selection, and keep the review and verification capabilities unchanged. The proposal must compare incomplete launch instructions, execution drift, and lost completion evidence against these retained results. No production architecture change has been implemented. The subsequently approved [protocol smoke investigation](adaptive-delivery-app-server-smoke-2026-09-30.md) records feasibility and the remaining native launch-evidence limitation.

## Proposal: app-server owner with a native goal

The user approved the delivery adapter and bounded A/B/C experiment after the
[read-only protocol smoke](adaptive-delivery-app-server-smoke-2026-09-30.md).
The [delivery pilot](adaptive-delivery-owner-pilot-2026-09-30.md) preserves A's
launch-evidence gap and records the requested goal/instruction partition.
The proposal below remains the original design record; smoke results alone
do not measure delivery reliability.

### Findings

The corrected results support investigating composition. In review repair,
all five trials performed the required repair and verification correctly,
but one final response omitted the finding description. Capability binding
also lost review or combined-verification evidence in two trials. Cadence
retained one actual missing-red failure. The retained evidence does not expose
the complete accepted launch message, so those observations cannot establish
whether every required obligation reached the owner.

The installed **Codex 0.159.2** exports stable `thread/goal/set`,
`thread/goal/get` and goal-notification schemas. Its local `goals` feature is
enabled. These offline observations establish the protocol surface, not a
successful app-server execution experiment.

[Official app-server documentation](https://learn.chatgpt.com/docs/app-server#manage-a-thread-goal)
defines persisted per-thread goals and a **4,000-character objective limit**.
Changing the objective resets goal usage accounting. Keep the full owner
contract in the thread and use a compact goal containing the outcome,
required assurance, authority, stopping conditions, and completion evidence.
Reject an overlong objective rather than truncating obligations. Preserve the
same objective and usage during ordinary continuation.

[Official goal guidance](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex)
describes native continuation when an active goal's thread becomes idle and
requires evidence before completion. This makes persistence a plausible way
to reduce execution drift. It cannot restore omitted launch instructions or
guarantee that a final response retains assessment evidence.

`thread/start` creates a separate conversation. The installed schema describes
`threadSource` as an analytics label; it does not establish native subagent
ownership. A client must not fabricate parent/child provenance. Attaching to
an already-running native child through a different app-server instance is
not established by this investigation and is not a fallback in the proposal.

Darrow's [current decision](../decisions/ADR-0004-use-native-goal-ownership-for-core-orchestration.md)
requires a native subagent and forbids nested host processes. The Codex launch
contract also forbids `create_goal` for the owner. A deliberate app-server
owner path therefore needs an explicit architecture decision, even though
host-owned continuation fits the broader design direction. The older
[N=1 persistence study](codex-native-goal-persistence-validation.md) is useful
feasibility evidence, not code to restore or a reliability result for 0.159.2.

### Proposed ownership boundary

1. The parent retains readiness, preflight, complete contract compilation,
   capability selection, and exact model/effort selection.
2. A narrow Codex adapter creates exactly one persistent execution thread.
   It verifies the returned provider/model/effort and preserves the same
   repository, instructions, installed capability versions, tool access,
   permissions, environment and effective delegation capacity. Disable
   provider-model fallback. Record later route changes as deviations.
3. That execution thread owns the native goal and all engineering work.
   Review and verification continue through their existing public contracts,
   with their implementations, model policies, and repair rules unchanged.
4. The adapter transports complete user feedback to that same thread and
   relays its results. Codex owns continuation. The adapter performs no
   engineering decisions, repair loop, provider scheduling, or repository
   verification. Goal token accounting never resets the shared repair limit.
5. Completion requires both the owner's terminal result and its evidence.
   `turn/completed`, `goal.status=complete`, or a clear review alone cannot
   replace the other required checks. Preserve findings, criterion coverage,
   repair accounting and effects in the response shown in the Codex session;
   a report-file link alone is insufficient.

The product change would be confined to Adaptive Delivery's Codex launch and
continuation boundary, with a contained Python transport adapter if adopted.
Update ADL-R2, ADL-L1, ADL-L3 and ADL-L5, the launch guide, and the accepted
architecture decision before implementation. Preserve Claude's current path.
Keep owner-control calls separate from repository work in the parent boundary.
Retain only host identity and transport receipts; host goal state owns the
lifecycle. A local stdio server can bound the isolated pilot. A production
connection/recovery policy must be decided without adding a Darrow daemon,
queue, phase ledger or second execution owner.

### Bounded experiment

First approve one read-only protocol smoke test. It must prove full-contract
availability before execution, goal activation ordering, exact model/effort,
goal readback on the owner thread, same-owner feedback, interruption,
reconnection without duplicate execution, and capability/environment parity.
Use an isolated host configuration. Do not resume an unrelated running thread.
If a required property is unavailable, stop before delivery trials.

Then compare three arms with fresh matched controls:

| Arm | Execution owner            | Native goal          | Purpose                              |
| --- | -------------------------- | -------------------- | ------------------------------------ |
| A   | Current native subagent    | None                 | Current approach                     |
| B   | App-server thread          | None                 | Measure the transport/context change |
| C   | Same app-server setup as B | On that owner thread | Measure goal persistence             |

Run **n:5 per arm on four cases: 60 fresh trials**. Interleave the arms in
isolated fixtures. Keep the earlier 300-trial sweep and all 80 repair trials
as historical evidence; the fresh A arm supplies the matched comparison.

| Case                                  | Preserved baseline                      | Reason                                                       |
| ------------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| `goal-verification-existing-review`   | 3/5 on 0.23.12; not part of this retest | Actual unchanged review and verification capabilities        |
| `goal-intent-capability-bindings`     | 3/5 on 0.23.13                          | Lost obligations/evidence across several capabilities        |
| `goal-preflight-verification-cadence` | 3/5 on 0.23.13                          | Observable execution drift: missing red step                 |
| `goal-verification-combined-repair`   | 5/5 on 0.23.13                          | Passing control for combined repair and stopping after clear |

Keep case intent and outcome checks fixed. All parents remain
`gpt-6-luna/medium`; owner and assessment routes remain those selected by the
unchanged policies. Pin the CLI, skills, helpers, fixtures and effective host
configuration. Match effective delegation capacity, not just a similarly
named limit: a new root thread may have a different session budget from a
native child.

Use an experiment-only transport adapter and observer. Do not rewrite the
production runner or change the capability implementations. The current
native-spawn/no-goal assertions are intentionally incompatible with C, so
report their original scores unchanged and use explicit transport-specific
ownership checks alongside common behavioral checks. Never silently count
the architecture change as fixing those baseline failures.

### Required evidence and failure attribution

Retain the full submitted public owner contract, its accepted thread/route
receipt, bound instruction references and read evidence, public tool results,
provider results, original/current targets, the owner's final message, and
the parent's relayed response. Capture goal transitions and automatic
continuations separately. Do not collect hidden reasoning.

| Failure class              | Evidence required                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Incomplete launch          | A required obligation is absent or changed in the actual accepted owner instructions, goal, or binding before execution                          |
| Execution drift            | The obligation is present and accessible, but the owner skips or violates it during work                                                         |
| Lost completion evidence   | Required work/result evidence exists, but is omitted or altered in a provider-to-verification, verification-to-owner, or owner-to-parent handoff |
| Host/provider availability | Retained lookup/tool failure establishes the missing resource or unsupported control; classify separately from the three composition mechanisms  |
| Unresolved                 | The necessary capture is absent; do not infer where the loss occurred                                                                            |

Compare task and activation grades, required-obligation completion, each loss
category, same-owner identity, goal settlement, unauthorized effects,
assessment invocations, repair attempts, human interventions, elapsed time
and available usage accounting. Separate parent/owner/provider measurements.
Native goal usage is not automatically comparable to existing aggregate
harness tokens.

Promote a candidate only if it reaches all 5/5 task and boundary checks in the
pilot, preserves the passing control, and adds no authority or budget breach.
If B improves as much as C, do not credit goal persistence. If loss precedes
execution, repair contract compilation in a separate experiment. If correct
execution still loses its final evidence, address that transport boundary
without changing review/verification. Five trials are a screening result;
successful pilot results still require broader coverage before adoption.

**Recommendation:** approve the isolated protocol smoke test and the bounded
A/B/C experiment before choosing the new production owner contract. Do not
merge a transport change, goal persistence, prompt redesign, and response
relaxation into one candidate.

## Evidence

- [Original 60-case coverage and all failures](darrow-adaptive-delivery-coverage-2026-09-30.md)
- Local corrected run inventory (`evals/results/adaptive-eval-repair-2026-09-30/coverage.json`)
- Final calibration summary (`evals/results/adaptive-eval-repair-2026-09-30/calibration-summary.json`)
- Local failure assessments (`evals/results/adaptive-eval-repair-2026-09-30/classifications.json`)
- Doctor follow-up results (`evals/results/adaptive-doctor-eval-repair-2026-09-30/summary.json`)
- Initial candidate provenance audit (`evals/results/adaptive-eval-repair-2026-09-30/evidence-audit.json`)
- Doctor follow-up provenance audit (`evals/results/adaptive-doctor-eval-repair-2026-09-30/evidence-audit.json`)

Raw evidence is local and gitignored. Original raw results, initial calibration mismatches, and unresolved product failures remain preserved.
