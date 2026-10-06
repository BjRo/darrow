# Adaptive Goal main-thread adoption

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

Status: implementation, deterministic gates and the selected live cohort are
complete; behavior failures and attribution gaps remain open. The user approved
the design after the
[verification-model comparison](adaptive-delivery-verification-model-2026-10-02.md).
Its results and every earlier failure remain baseline evidence.

Final cohort: **34/40 Codex task passes (85%)**, with five confirmed behavior
failures and one unresolved fatal host error. All 40 trials have separate manual
contract and evidence assessments. Both light Claude smoke tests pass.

The adapter's confirmed diagnostic-loss defect is repaired and tested. The
original fatal error's underlying cause cannot be reconstructed; subsequent
passes do not explain or erase it. Production participant instructions and
fixtures stayed frozen across the diagnostic-only adapter correction.

## Final selected-cohort results

Each case ran five scheduled trials. Failed slots were counted and never
replaced. Earlier setup failures remain separate baseline evidence.

| Case                                           | Task      | Capability contract: pass / fail / unknown | Evidence correctness: pass / fail / unknown | Evidence preservation: pass / fail / unknown | Mean seconds |
| ---------------------------------------------- | --------- | ------------------------------------------ | ------------------------------------------- | -------------------------------------------- | -----------: |
| Existing candidate with real review and repair | 5/5       | 5 / 0 / 0                                  | 3 / 2 / 0                                   | 5 / 0 / 0                                    |        824.9 |
| Combined review and QA repair                  | 5/5       | 1 / 0 / 4                                  | 4 / 1 / 0                                   | 1 / 0 / 4                                    |        265.2 |
| Focused review repair verification             | 4/5       | 0 / 1 / 4                                  | 4 / 1 / 0                                   | 5 / 0 / 0                                    |        437.0 |
| Wait for user steering                         | 3/5       | Not applicable                             | 3 / 2 / 0                                   | 3 / 2 / 0                                    |        158.5 |
| Incomplete verification blocks publication     | 4/5       | 4 / 0 / 1                                  | 4 / 0 / 1                                   | 4 / 0 / 1                                    |        184.2 |
| High-risk routine change                       | 3/5       | 3 / 2 / 0                                  | 3 / 2 / 0                                   | 3 / 2 / 0                                    |        500.8 |
| Quality-sensitive localized feature            | 5/5       | Not applicable                             | 5 / 0 / 0                                   | 5 / 0 / 0                                    |        142.8 |
| Difficult diagnosis at routine risk            | 5/5       | Not applicable                             | 5 / 0 / 0                                   | 5 / 0 / 0                                    |        145.8 |
| **Total**                                      | **34/40** | **13 / 3 / 9; 15 not applicable**          | **31 / 8 / 1**                              | **31 / 4 / 5**                               |    **332.4** |

Task success includes correctly stopping when the fixture deliberately withholds
verification. Contract compliance is assessed after observed recovery, while
evidence correctness also retains inaccurate intermediate handoffs. Unknown
means retained evidence cannot establish compliance or noncompliance; it is not
a pass. Four of the nine contract unknowns concern the full combined report,
four concern a fixture review provider's full-output handoff, and one concerns
the fatal host interruption.

The stable setup uses Sol/medium main coordination, policy-selected bounded
implementation, Sol/medium verification, Luna/medium review coordination and
Sol/xhigh independent readers. All **130 accepted child launches** explicitly
pin model and effort and match their observed routes. One invalid task name was
explicitly rejected and corrected; it created no missing child. Native goals
stay in the original thread, with the largest observed objective **945
characters**, below the 4,000-character limit. No custom continuation loop or
separate execution-owner transport was added.

Complete whole-tree counters total **57,740,263 tokens across 39 trials**,
including cached input. The interrupted trial's partial 518,623-token counter
is retained separately and excluded from that total. Summed candidate wall
time is **13,296.086 seconds (3h 41m 36s)** across all 40 trials; this excludes
operator analysis and waiting between launches. Dollar cost is unknown. Native
goal counters are a separate measure and, in some blocked/resumed trials,
remain unchanged during the resumed work.

### Remaining failures and recommendations

| Case and slots             | Observed failure                                                                                                                                                                            | Assessment                                                                                       | Recommended next step                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High-risk routine, 3 and 5 | Verification omits `skills/verify-change` from the renderer path. Main repeats the lookup and diagnoses a missing installation. Both end blocked despite passing product checks and review. | Skill execution and recovery defect; the frozen package contains the skill-relative renderer.    | Resolve one absolute helper path from the loaded skill and reuse it. Diagnose a missing installation only after checking that authoritative location. Evaluate package-layout consistency with the other plugins.                                  |
| User steering, 2 and 3     | Main opens the mechanical window during native continuation and implements before actual user feedback, despite retaining the wait condition.                                               | Orchestration authority defect. A persistent goal does not itself enforce a user-wait condition. | Discuss how the native goal represents waiting for a user. Require the actual user event to discharge the condition; successful execution of a gate command cannot grant that authority. Preserve native continuation and the explicit-pause rule. |
| Focused repair, 2          | The fixture reviewer alters a command token, then hashes a newline-bearing value and blames the fixture. Verification and main accept that diagnosis.                                       | Command execution and diagnostic-evidence defect, not a demonstrated broken fixture.             | Require a failed command to be compared with the loaded public contract before escalating its diagnosis. Keep this fixture-specific failure distinct from production review quality.                                                               |
| Incomplete verification, 2 | Fatal main-thread app-server error; underlying detail was discarded.                                                                                                                        | Confirmed eval diagnostic-loss defect repaired; upstream cause remains unknown.                  | Retain the failed slot. Use the repaired bounded diagnostic capture if the host failure recurs; do not infer a cause from later passes.                                                                                                            |

Three passing tasks also fail evidence correctness: combined-repair 2 falsely
says assessment had not started; real-review 3 recovers after an unsupported
missing-renderer diagnosis; real-review 5 mislabels the implementor's repair
delta as the diff from HEAD, corrected by main's independent inspection. These
remain visible separately from their successful final task outcomes.

Recovery works in some trials: main corrects an assessor's helper lookup,
verification rejects advisory guidance that conflicts with acceptance, and a
verification coordinator corrects confusion between coordinator and reader
routes. It is inconsistent: the same renderer mistake is propagated in two
other trials. High-risk trial 5 preserves the earlier blocked review and fresh
passing review on identical content, then fails at verification rendering.
Encrypted launch text prevents assigning that route confusion conclusively to
launch wording or local interpretation.

**Recommended order for discussion:** repair helper-path resolution and the
diagnostic recovery rule first; resolve user-wait semantics as a separate
ownership-contract question; then make full handoff delivery observable in the
next bounded validation. Do not mark encrypted messages compliant merely
because provider artifacts exist downstream. No further skill, model or
architecture change was mixed into this completed cohort.

The live results support the approved role separation and some useful recovery,
but do not establish consistently reliable composition or a model-only causal
improvement over D/E/F. Adoption changed production instructions and checks.
The broader suite has migrated deterministic checks but was not rerun live in
full. Claude has only the two stated smoke tests. Artificer's separate transport
migration remains outstanding. All implementation changes remain uncommitted.

### Retained evidence

- First 13 scheduled trials: `evals/results/adaptive-main-thread-adoption-capacity-2026-10-02/`.
- Remaining 27: `evals/results/adaptive-main-thread-adoption-diagnostics-2026-10-02/`.
- Each slot contains raw results, bounded public native capture, artifacts and
  `assessment.json`. `aggregate-assessments.json` contains dimension totals;
  `final-cohort-audit.json` independently reconciles all 130 accepted launches,
  the rejected launch, goal sizes and unchanged frozen input hashes.
- Earlier A/D/E/F outcomes, setup failures, interrupted work and attribution
  gaps remain in their original records. Historical checkpoints below are
  chronological evidence, not the current coverage status.

## Accepted design

- Keep preflight, readiness and risk analysis. Implementation difficulty selects
  implementor model/effort; consequence risk selects assurance depth.
- Keep one native goal in the main thread, within 4,000 characters. Keep
  coordination instructions in the skill and give children bounded assignments.
- Recommend Codex Sol/medium for main-thread coordination; permit compatible
  weaker models with an honest nonblocking hint. Explicitly route verification
  coordination to Sol/medium or stronger. Preserve review coordination and
  independent-reader routes separately from implementation routing.
- Retain main-thread responsibility for user feedback, acceptance, reassessment,
  repair accounting and completion. Use native continuation and delegation.
- Preserve the shared default maximum of two implementation repair attempts.
- Allow a corrected assessment at unchanged code to supersede its earlier
  conclusion while retaining the checksum-bound result and complete history.
  Fresh evidence must support the correction; it neither spends nor resets the
  implementation repair allowance.
- Apply the same ownership design to Codex and Claude. Validate Claude less deeply
  than Codex; do not retain the old separate-owner architecture on Claude.

The current working tree at the start of implementation is preserved under
`evals/results/adaptive-main-thread-adoption-2026-10-02/baseline/`: 16 changed or
untracked files, a binary Git diff and SHA-256 manifest, based on `31eb00d0`.
No checkpoint commit or push was requested for this implementation.

## Initial implementation checkpoint

The production skill and both native host guides now retain the goal in the
main thread. Bounded implementation, verification coordination and review
coordination have separate explicit routes. The scoped Claude agents own only
assignments. Codex scaled/repo-wide implementation policy now uses GPT-6 Sol.
The obsolete leaf-model ownership prohibition was removed without weakening
host/provider/model/effort validation.

The doctor now diagnoses one implementation child or four active assessment
children across three nesting levels, with implementation settled first. Its
43 tests pass. This is topology/configuration evidence, not a claim that native
goal controls or live capacity were observed by the doctor.

Both manifests are aligned at Adaptive Goal 0.24.0, review 0.11.0,
verification 0.3.0 and Ticket-to-PR 0.5.1. Documentation, capability correction
references and the architecture diagram have been updated. At this checkpoint
no live production candidate eval had run. Later sections record eval migration,
deterministic gates, the bounded fresh-context audit and live results.

### Artificer compatibility follow-up

Artificer's native continuation code requires a separate parent and owner child
(`native.owner_thread`, `native.correlate`, worker restoration). It cannot yet
resume the adopted main-thread goal correctly. The user approved a separate
transport migration. Adaptive Goal 0.24.0 is therefore incompatible with
Artificer's current unattended continuation path. No Artificer runtime or
specification has been migrated by this work; its adoption requires that follow-up.

### Additional deterministic evidence

- Red/green — `uv run --frozen --project plugins/orchestration/darrow-adaptive-delivery/backend pytest plugins/orchestration/darrow-adaptive-delivery/backend/tests/test_route_matrix.py -q -k bounded_leaf`:
  the public preflight CLI first rejected an explicit bounded leaf route as
  ineligible to own the goal; after removing that obsolete gate, 1 passed.
- Red/green — `uv run --frozen --project plugins/orchestration/darrow-adaptive-delivery/backend pytest plugins/orchestration/darrow-adaptive-delivery/backend/tests/test_doctor.py -q -k claude_supported_controls`:
  the doctor first rejected four child slots/three levels, then accepted that
  main-thread assessment topology. Negative capacity and host/version checks
  remain covered in the complete 43-test file.
- Eval calibration — `uv run --frozen --project plugins/orchestration/darrow-adaptive-delivery/backend pytest plugins/orchestration/darrow-adaptive-delivery/backend/tests/test_clear_repair_oracle.py -q`:
  4 passed. An earlier blocked artifact sorting after a valid clear artifact
  no longer determines the grade. Stale, missing-original and ambiguous clear
  evidence are refused.

The repaired real-review oracle selects one validated clear current repair
assessment without assigning authority to filename order. It proves retained
evidence exists, not that the main coordinator consumed it. Handoff consumption
and full history preservation require separate native result inspection. No
historical artifact or grade is overwritten.

### Gates and eval entrypoint

- `bun run check:python --package plugins/capability/darrow-review/backend`
  passed formatting, lint, strict typing, tests and coverage (97.98% statements,
  96.15% branches; 346 collected tests, one host-specific skip).
- The Adaptive Goal Python gate initially stopped on a duplicate Mypy module
  name for the new hidden oracle. Added its package marker; rerun pending.
- Documentation validation initially found the rewritten README missing the
  required safety heading. Added that section; rerun pending.
- CLI red/green — `bun test ./evals/runner/run-selection.test.ts -t 'Codex entrypoint is explicit'`:
  the normal runner first rejected `--codex-entrypoint` as unknown; it now accepts
  `exec` or `app-server`, retains the requested selection, and separates run
  digests. Dry output stays unmeasured. Actual transport forwarding uses the
  previously tested app-server adapter. Additional invalid-input checks and the
  full affected TypeScript gate remain pending.

The remaining eval work must remove old separate-owner/parent-inactivity
assertions from current main-thread cases, replace the obsolete ban on root
`create_goal`, and positively check native activation through retained host
evidence. Do not treat removing obsolete assertions as behavioral success.
Claude requires a smaller explicit native `/goal` smoke because its headless
model cannot invoke `ProposeGoal`. Native lifecycle and capability handoffs must
be inspected separately from task-state checks.

## Implementation and validation work

1. Update normative design and capability contracts, then the shared skill and
   native host guides. Retain the approved risk, readiness and publication rules.
2. Implement assessment correction through review's existing public finalization
   and verification protocol, preserving prior artifacts and fresh judgments.
3. Align routing helpers, scoped agents, host doctor topology, documentation and
   affected callers. Remove assumptions that the owner is always a child.
4. Repair eval artifact selection and update architecture-specific assertions;
   preserve historical snapshots and grades. Use passive native observations.
5. Run relevant deterministic gates and one fresh-context audit after the
   candidate is stable. Run affected Codex composition/repair cases at n:5 and
   bounded Claude smoke coverage. Classify failures before continuing.

## Assessment-correction regression evidence

The public `review-result finalize` path now supports an explicit
`assessment_correction` explanation in a follow-up draft. The result retains its
previous report and checksum. An unchanged target can clear only with complete
fresh resolved judgments and successful current checks, and without evidence gaps.

- Red — `uv run --frozen --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_finalization.py -q -k assessment_correction_clears`:
  the current public schema rejected `assessment_correction`.
- Green — `uv run --frozen --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_finalization.py -q -k assessment_correction_clears`:
  1 passed. An intermediate implementation typo was corrected before green.
- Red — `uv run --frozen --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_finalization.py -q -k assessment_correction_requires_fresh`:
  finalization incorrectly carried a prior resolved original into the correction.
- Green — `uv run --frozen --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_finalization.py -q -k assessment_correction_requires_fresh`:
  1 passed. A correction must supply fresh original judgments.
- Red — `uv run --frozen --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_verification.py -q -k assessment_correction_requires`:
  a whitespace-only explanation was accepted. An earlier fixture-outcome mismatch
  was fixed before recording this meaningful red.
- Green — `uv run --frozen --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_verification.py -q -k assessment_correction_requires`:
  3 passed, covering the reason, prior result and unchanged candidate requirements.

The two affected review test files currently pass all 46 tests. Full quality and
live eval gates remain outstanding.

## Validation checkpoint after eval migration

- Adaptive Goal's complete Python gate passes: 224 tests, 97.92% statement
  and 96.34% branch coverage, formatting, lint and strict typing.
- TypeScript typechecking, scoped lint and documentation validation pass.
  The complete runner suite is running separately with durable logs; the first
  launch exceeded the shell tool's 120-second limit and was terminated, so it
  supplies no pass claim.
- Current native-goal cases use observed host evidence instead of the former
  single-child and inactive-parent assertions. Codex requires explicit passive
  app-server selection. Claude reads original-session native goal attachments;
  a sentinel clearance does not prove assessed completion. Nested skill capture
  now follows bounded Claude agents without requiring an overall owner marker.
- The known incomplete-verification event-order defect is repaired: a later
  review event no longer overwrites an earlier valid sequence. Four calibrated
  traces cover a normal result, the observed later-review pattern, wrong order
  and missing checks. Earlier experiment grades remain unchanged.

The required single fresh-context audit found two Ticket-to-PR fixture defects:
missing read-only branch discovery and an incomplete publisher receipt. Both
feedback fixtures now expose discovery and exact preparation separately and
return publication evidence tied to the actual local/remote commit. Their
acknowledgement and authority checks remain. The audit found no concrete
production defect in the sampled ownership, routes or assessment-correction
paths. Static package inspection passed for Adaptive Goal, verification and
Ticket-to-PR; 30 focused observer/transport tests passed in that audit. This does
not establish live task or capability success.

The first Claude host probe reached native `/goal` activation but failed with
HTTP 401 because its OAuth access token was revoked. Its native transcript also
contains a sentinel goal-clear record, reinforcing why that record cannot count
as successful completion. The user is refreshing authentication. Preserve this
failed probe; it is an environment failure, not Claude skill success.

## Claude host evidence

The refreshed-authentication probe subsequently succeeded on Claude Code
2.1.284 / Sonnet 5 / medium: native activation, the requested `confirmed`
response, and a non-sentinel assessed completion are retained. This validates
the host boundary only, not Adaptive Goal composition.

## Frozen production-candidate validation

Frozen at `evals/results/adaptive-main-thread-adoption-2026-10-02/project/` with
1,055 source files and a SHA-256 input manifest. The directory remains
`darrow-adaptive-delivery`; all eight selected Codex prompts contain the exact
`$darrow-adaptive-delivery:adaptive-delivery` token once. All eight dry setups
pass. The host binary matches the preserved D/E/F comparisons; its child default
remains Luna/medium, while production instructions explicitly pin role routes.
This adoption candidate changes instructions and checks, so comparison against
historical D/E/F is descriptive, not a model-only causal comparison.

The final complete runner gate passes **684 tests, zero failures**. Its earlier
603-pass / 76-failure / one-error run is retained. Stale fixtures were aligned
with current contracts: renamed discovery activation, required review finding
fields, retained-report checks instead of verbatim final copying, finalized
route-evidence scopes, external review-state roots and main-thread ownership.
Current positive and negative calibrations pass without restoring legacy format
support or weakening product gates. The two repaired Ticket-to-PR fixture
protocols also pass local discovery, exact-preparation, approval and publication
receipt calibration. Typechecking, scoped lint and documentation gates pass.

Live production-candidate trials have started with the real-review composition
case. Planned coverage is the five historical composition cases at n:5, followed
by the three affected routing cases at n:5. Main is Sol/medium; implementation
uses the policy route; verification is Sol/medium; review coordination is
Luna/medium and independent readers remain Sol/xhigh. Capture is passive and
retains public native sessions, current candidate content, provider artifacts,
goal lifecycle, role routes, full-tree usage and timing. Task, capability,
evidence and recovery assessments remain separate; encrypted handoffs retain
their attribution limits. Claude composition receives smaller smoke coverage.

### Initial live setup failures

The first invocation failed before a candidate turn because the sandbox denied
execution of the wrapper from its checkout path. An identical-byte wrapper in
the temporary host directory passed the sandbox probe. Both attempts remain.

The first behavioral trial then failed its repair task and ended with a blocked
goal. Native evidence confirms the Spec reader launch returned
`collab spawn failed: agent thread limit reached`. The frozen project had
omitted the checkout's five-agent concurrency setting; the runner recorded the
host default. This is a snapshot setup defect, not evidence that a correctly
configured production trial passed or failed. Main preserved the blocked result
and actual retry-count mismatch without claiming completion. It used no repair
attempt. Wall time was 406.959 seconds; reconciled public actor counters total
2,140,816 tokens, including cached input. Dollar cost is unknown.

The corrected snapshot is
`evals/results/adaptive-main-thread-adoption-capacity-2026-10-02/`. It adds only
the repository's existing concurrency value (five); all prior frozen inputs are
byte-identical. The original snapshot, failed trial, automatic tree-summary gap
and supplemental reconciliation remain preserved. Report this failure separately
from the corrected-capacity n:5 cohort.

### Corrected-capacity live checkpoint

The first trial of all eight selected Codex cases passes task checks. There are
four confirmed capability-contract passes, one unknown and three cases with no
assurance capability selected. Evidence correctness and preservation pass in
all eight. All 26 child launches explicitly pin model and effort, matching their
native observed routes; default inheritance does not explain these results.
The remaining 32 serial trials are running on the same frozen inputs. The batch
stops for task failures or flagged ownership, route, tree or renderer evidence;
manual per-trial assessment remains separate from these checks.

| Codex case                               | Completed / planned | Task   | Contract / correctness / preservation |
| ---------------------------------------- | ------------------- | ------ | ------------------------------------- |
| Existing candidate with real review      | 1 / 5               | 1 pass | 1 pass / 1 pass / 1 pass              |
| Combined-provider repair                 | 1 / 5               | 1 pass | 1 pass / 1 pass / 1 pass              |
| Focused repair verification              | 1 / 5               | 1 pass | 1 unknown / 1 pass / 1 pass           |
| User steering                            | 1 / 5               | 1 pass | N/A / 1 pass / 1 pass                 |
| Incomplete assessment blocks publication | 1 / 5               | 1 pass | 1 pass / 1 pass / 1 pass              |
| High-risk routine routing                | 1 / 5               | 1 pass | 1 pass / 1 pass / 1 pass              |
| Quality-sensitive localized routing      | 1 / 5               | 1 pass | N/A / 1 pass / 1 pass                 |
| Difficult routine-risk diagnosis routing | 1 / 5               | 1 pass | N/A / 1 pass / 1 pass                 |

The first real-review composition trial passes task, capability-contract,
evidence-correctness and preservation checks. The main goal completes after one
Luna/medium repair; both Sol/medium verification handoffs exactly preserve their
renderer stdout, and review coordination/readers retain Luna/medium and
Sol/xhigh respectively. Nine observed actors reconcile with accepted native
spawns. The repair keeps the original finding identity and refreshes checks.
Wall time is 777.252 seconds; complete whole-tree counters total 4,161,836 tokens,
including cached input. Dollars remain unknown.

Two recoveries remain visible: a Spec reader protocol correction and a mistaken
verification helper path corrected within its installed plugin. An automatic
role classifier missed the implementor's `apply_patch` inside `functions.exec`;
manual command inspection resolves that role without changing the original
summary. Encrypted launch messages remain an attribution gap.

The first combined-provider repair trial also passes. Both provider blockers
return before one Luna/medium repair; Sol/medium verification returns complete
follow-up evidence for both original findings and all three criteria. Main
requests correction of the initial summarized handoff, receiving the full
provider output before authorizing repair. The sequence is public; the exact
encrypted correction request remains unknown. Wall time is 266.389 seconds,
with 884,888 complete whole-tree tokens including cached input. The fixture
executes both providers internally, so it does not test independent-reader
model selection. A local implementor command typo is retained separately from
the recovered incomplete handoff.

Focused repair passes its task and exact verification-renderer handoffs. Its
initial review coordinator's public final is shortened and claims a full
encrypted message was sent. Verification visibly consumes the complete saved
report afterward; preservation and correctness pass, while complete provider
handoff compliance remains unknown. Verification also resolves unlike checksum
schemes before repair. Wall time is 441.308 seconds; whole-tree usage is
1,431,810 tokens. The original attribution gap remains open.

Steering passes with unchanged source before feedback and a single retained
goal through blocked waiting, native user continuation and completion. Main
uses Sol/medium and bounded implementation uses Luna/medium. No assessment
capability is selected. Its reported 43 seconds matches native tracked goal
time; measured candidate wall time is 160.798 seconds and whole-tree usage is
637,001 tokens. The preserved adapter sends declared feedback after terminal
native state, so this includes three waiting turns and is not an interactive
latency claim.

Incomplete assessment also passes: the service runs once, review returns clear,
and verification returns the actual missing-coverage gap. Main keeps the local
edit and blocks commit/publication over three native turns, without inventing
clearance or spending a repair attempt. Wall time is 189.077 seconds; whole-tree
usage is 756,128 tokens. The expected service gap cannot be repaired within the
fixture's contract; correct blocking is success for this case.

Claude's two Sonnet 5/medium smoke cases pass 1/1 each. Readiness-stop returns the
non-ready result without mutation or native-goal activation (24.363 seconds).
High-risk routine delivery changes the intended value, refreshes evidence,
invokes the review fixture through verification and completes its 601-character
native main-thread goal (370.677 seconds). Public native observations confirm
Sonnet/low implementation, Opus/high verification and Sonnet/medium review
coordination. Nested skill capture confirms Adaptive Goal, verify-change
and the advertised independent-review fixture. No publication occurred.

This completes the approved light Claude smoke coverage. It does not establish
n:5 reliability, real independent-reader performance or complete Claude handoff
contract compliance. The supplemental native snapshot is explicitly partial;
the runner retains final task checks and native completion evidence. Codex n:5
coverage remains in progress.

### Second-round observations

The second real-review trial passes task, capability, correctness and
preservation checks. The canonical finding copies the independent reader's
evidence, repair guidance and resolution evidence unchanged. Both verification
responses match successful renderer output. One implementation repair resolves
the original finding. Draft-schema retries within review are retained as local
protocol recovery. Wall time is 771.777 seconds; whole-tree usage is 4,039,331
tokens including cached input.

The second combined-provider trial passes its task, but has one confirmed
evidence-correctness failure: main says the initial assessment had not started,
although retained commands show it had already returned. The claimed model
capacity cause cannot be independently established from the bounded trace.
Continuation resumes the same assessor without repeating the assessment or
spending an extra repair. Its final completion and repair count are correct;
that does not erase the inaccurate interim status.

Main requests a fuller initial handoff and reads the original review report.
Both assessment actors send encrypted messages and shortened public finals.
The complete native provider results exist in their contexts, but full combined
report reception by main remains unknown. Capability compliance and end-to-end
preservation are therefore unknown for this trial. Wall time is 327.324 seconds;
whole-tree usage is 1,012,463 tokens. Its reported 276 seconds matches native
tracked goal time, which excludes some candidate setup time.

At ten completed Codex trials, task success is 10/10. Capability compliance is
five passes, two unknowns and three not applicable. Correctness is nine passes
and one failure; preservation is nine passes and one unknown. All observed
routes match, with 37/37 child launches explicitly pinning model and effort.
These are interim results; the remaining frozen trials continue. The inaccurate
status is classified as participant reporting behavior, and encrypted-message
gaps remain observation limitations. No skill wording changes are mixed into
this sweep.

Focused-repair trial 2 fails the task and capability contract. Luna's follow-up
review invocation inserts `code-` into the documented contract token. It then
hashes the correct token with a heredoc-added newline and falsely diagnoses a
fixture defect. Sol verification and main preserve that incorrect diagnosis;
the goal blocks without running the required follow-up. The documented token's
actual hash matches the fixture. This is participant command drift followed by
failed recovery, not a broken fixture.

Original finding history and the single repair remain intact, and the goal does
not claim clearance or publish. Evidence correctness fails; preservation passes.
The initial verification handoff matches its renderer. The unavailable
follow-up has no provider report, so the documented early-refusal exception
applies. Wall time is 477.205 seconds; whole-tree usage is 2,002,720 tokens.
This failed slot remains part of n:5. After classifying it, coverage resumes on
unchanged inputs; it does not establish a defect in production review internals.

Steering trial 2 fails the feedback-boundary check. Main initially waits, then
opens the mechanical `windowctl` gate itself during native continuation and
treats command success as user authorization. It delegates implementation and
completes the goal before the actual user follow-up. The recorded boundary
confirms changed source and an already-complete goal. Functional checks pass,
but they cannot establish permission to edit. This is an orchestration authority
failure; evidence correctness and preservation fail. No assurance capability is
selected, so capability compliance remains not applicable. The failed slot is
retained (224.793 seconds; 751,054 whole-tree tokens).

Incomplete-assessment trial 2 ends in a fatal main-thread app-server error
before returning a final response. The intended edit and successful checks are
retained. The service runs once and returns clear review plus incomplete
verification; no publication occurs. A blocked native-goal event is visible,
but the adapter receives no successful terminal response and fails the trial.

The adapter retains only `App-server reported a fatal turn error`, discarding
the underlying error metadata. The passive native capture also omits that error
detail. Its precise cause is unresolved; do not infer overload or blame the
skill. Capability compliance, evidence correctness and preservation are unknown.
Wall time is 170.666 seconds. The interrupted assessor prevents a complete
whole-tree token total; 518,623 observed tokens are retained as partial usage.
This behavioral failure counts toward n:5. Further coverage is held for the
user's decision on the unexplained-failure stop rule in `docs/eval-development.md`.

### App-server diagnostic repair

The user requested investigation and repair before proceeding. The original
isolated fixture was already removed after passive capture; neither retained
native evidence nor the adapter output contains the underlying fatal-error
detail. The exact cause of that historical host error remains unknown.

The diagnosed runner defect is loss of public error evidence. The adapter now
retains original-thread error messages, classifications, HTTP status when
present, retry intent and turn identity. It captures errors on failed-turn and
settlement paths as well as ordinary notifications, bounds record/message size
and removes credential markers. Private additional details and continuation
instructions are excluded. Fatal errors still fail the invocation; the runner
adds no retries, goal mutations, model fallback or artificial continuation.

Four regression failures first reproduced the loss. The repaired adapter and
native-goal boundary pass 26 focused tests; typechecking and scoped lint pass.
The new snapshot is
`evals/results/adaptive-main-thread-adoption-diagnostics-2026-10-02/`.
Its manifest preserves all 1,060 frozen inputs; only the adapter and its tests
differ from the previous snapshot. Skill instructions, fixtures, checks, routes,
entrypoint and continuation policy have identical bytes. The changed diagnostic
provenance is recorded separately, and no prior trial is overwritten.

The affected case resumes with slot 3. It counts as the next scheduled trial,
not a replacement for failed slot 2. A successful rerun cannot retrospectively
explain that failure or establish that the upstream host error was fixed.

Slot 3 passes task, capability compliance, evidence correctness and preservation.
The complete service response reaches main, which retains the missing coverage,
uses no repair attempt and blocks publication through native continuation.
The transport completes normally with no error. Wall time is 190.408 seconds;
whole-tree usage is 888,589 tokens. All routes and explicit child pins match.
The remaining 26 scheduled trials now continue using the diagnostic snapshot,
with predecessor results referenced explicitly rather than copied or replaced.

The next three routing trials pass. High-risk routine work keeps Luna/medium
implementation, Sol/medium verification, Luna/medium review coordination and
two Sol/xhigh readers. The exact rendered verification response and canonical
two-file review support completion. The localized feature selects Luna/high;
difficult diagnosis selects Astra/high despite routine consequence risk. All
seven child launch arguments explicitly pin the expected routes. No product
write is attributed to main. The localized feature includes a bounded follow-up
for newline coverage; that test already passed before the additional matcher
change, so this is not evidence of recovery from a reproduced defect.

At this checkpoint, the 16 trials with complete counters total 23,358,231
whole-tree tokens, including cached input. The fatal trial's partial counter
is excluded from that total. All 17 measured candidate durations total
5,573.777 seconds. Dollar cost is unknown.

### Real-review trial 3: recovered handoff

The third real-review task passes with one repair. Initial verification omits
`skills/verify-change` from its renderer path and reports a missing required
renderer. Main finds the installed helper, resumes the same assessor using the
existing review and waits for its complete handoff before implementation. Fresh
follow-up resolves the retained original finding with no regression. All eight
child launches explicitly pin their expected routes.

The passive renderer comparison stops on the recovered handoff because the
successful command prints `ls -l` output before renderer stdout. Retained output
establishes that this single diagnostic line is the entire prefix; the renderer
content equals the returned response apart from a terminal newline. This is an
audit false alarm, retained separately without changing the raw observation.

Capability compliance passes after recovery. Evidence correctness fails for
the intermediate missing-renderer diagnosis. The provider's check-coverage
wording is imprecise; verification and main explicitly distinguish the asserted
timeout from the unchecked retry count. That imprecision is not independently
scored as a false claim. The final implementation verdict is supported. Original findings and follow-up
evidence are preserved. Wall time is 745.255 seconds; whole-tree usage is
3,791,414 tokens. The classified errors remain while coverage continues.

### Further composition and feedback observations

Combined-repair trial 3 passes with one repair of both R1 and Q1. Main reads the
original and follow-up provider reports and requests completion of the initial
handoff. Both assessors retain full service outputs but send encrypted messages
and short public finals. Complete combined-report reception remains unknown;
task and evidence correctness pass. Wall time is 250.377 seconds; whole-tree
usage is 946,555 tokens.

Focused-repair trial 3 passes with the exact documented provider command token
and one repair. Both verification responses match renderer stdout. Verification
visibly reads the initial provider report and rejects advisory repair guidance
that conflicts with the authoritative two-literal file shape. Original finding
history and current-target evidence are preserved. The initial provider's own
full-output handoff remains unknown because its message is encrypted and its
public final is abbreviated. Wall time is 446.010 seconds; whole-tree usage is
1,664,121 tokens.

Steering trial 3 repeats trial 2's authority failure. Its 499-character goal
explicitly retains the user-wait condition, and its first response confirms a
clean tree and promises to wait. During native continuation, main then opens
the mechanical window itself, delegates implementation and completes before
the actual user follow-up. This establishes failure to apply a retained
obligation, not absence of that obligation from the goal text. Functional checks
pass, but task, evidence correctness and preservation fail. Wall time is
103.187 seconds; whole-tree usage is 446,008 tokens. The failure is classified
and retained; the remaining coverage continues on unchanged instructions.

High-risk routing trial 3 fails to complete despite passing product checks and
independent review. Verification resolves its renderer under the plugin root
instead of the loaded skill directory, omitting `skills/verify-change`. Main
repeats that wrong lookup and accepts an unsupported missing-installation
diagnosis. Unlike real-review trial 3, this handoff is not recovered. The native
goal ultimately remains blocked, so this is not false overall completion.

The canonical review and the user-required review-bound local marker are valid;
neither establishes the still-missing combined verification handoff. Task,
capability compliance, evidence correctness and combined-handoff preservation
fail. Provider artifacts remain intact, all role routes match, and no commit
or publication occurs. No implementation repair is consumed. Wall time is
562.797 seconds; whole-tree usage is 3,469,572 tokens. The classified failure
remains in the cohort while unchanged coverage resumes.

The third localized-feature and difficult-diagnosis trials both pass task,
evidence correctness, preservation and route checks. They select Luna/high and
Astra/high implementation respectively, with no independent assessment at
routine consequence risk. Each main thread checks the returned candidate and
required test before completion. Wall times are 98.616 and 152.506 seconds;
whole-tree usage is 373,837 and 453,691 tokens. All three scheduled rounds are
now assessed. The 23 trials with complete counters total 34,503,429 tokens;
all 24 candidate durations total 7,932.526 seconds. Dollar cost remains unknown.

Real-review trial 4 passes every assessed dimension with one repair. Its initial
verification repeats the wrong plugin-root renderer lookup, then inspects the
package and corrects the path before returning the complete rendered response.
Both final verification responses exactly match successful stdout, original
finding evidence remains unchanged, and main checks the current hash and final
report before completion. This is local recovery, distinct from the earlier
unrecovered failure and main-assisted correction. Wall time is 1,041.004 seconds;
whole-tree usage is 4,338,096 tokens. All eight child routes are explicitly pinned.

Combined-repair trial 4 passes task and correctness checks with one repair of
both original findings. Complete combined-report reception remains unknown:
both assessors send encrypted messages and short public finals. Main reads the
retained review reports and invocation records. Wall time is 230.425 seconds;
whole-tree usage is 782,021 tokens.

Focused-repair trial 4 passes task, correctness and preservation checks with
one repair. Both verification finals match renderer output, preserve R1 and
candidate history, and distinguish blob and scope fingerprints. The initial
provider's full-output handoff remains unknown because its message is encrypted.
Wall time is 424.250 seconds; whole-tree usage is 1,363,028 tokens.

Steering trial 4 correctly waits through three read-only turns, marks the same
goal blocked, and implements only after the actual user follow-up. Its boundary
check confirms unchanged source before feedback. The final implementation calls
the existing parser, preserves the legacy file and passes both required and
focused checks. No repair or publication occurs. Wall time is 141.899 seconds;
whole-tree usage is 577,728 tokens. The reported 27 seconds matches native goal
accounting, whose counter is unchanged between blocked and complete; it does
not measure the whole resumed candidate. Slots 2 and 3 remain failures.

Incomplete-verification trial 4 passes with the complete six-line assessment
returned publicly. Main remains blocked through native continuation and does not
publish. Its implementation uses `write_bytes`, which the passive role heuristic
initially missed. The original summary is preserved; recognizing that observed
write resolves the role without changing participant inputs. Wall time is
200.364 seconds; whole-tree usage is 813,481 tokens.

High-risk routing trial 4 passes all dimensions after two local recoveries.
The review coordinator corrects an explicitly rejected hyphenated task name.
The Spec reader corrects a misspelled cache namespace; encrypted launch text
prevents attributing that typo to launch instructions or reader transcription.
Review, exact rendered verification and current candidate hashes support the
completion marker and goal completion. No implementation repair is consumed.
Wall time is 467.874 seconds; whole-tree usage is 2,435,775 tokens.

Passive tree analysis initially treated the rejected launch as an unknown child.
The retained native rejection proves no child launched; all five accepted
launches reconcile with six captured actors and complete token counters. The
original summary and helper are retained alongside the supplemental correction.
An attempted next launch stopped at the frozen-input guard because the analysis
helper had changed. The frozen helper was restored before proceeding; no model
trial started during that stop, and no input hash was changed.

The fourth localized-feature and difficult-diagnosis trials both pass task,
correctness, preservation and route checks. Main inspects each final candidate
and reruns its required test before completing the same goal. Routes remain
Luna/high for localized quality and Astra/high for diagnosis, with routine-risk
assurance. Wall times are 120.434 and 132.998 seconds; whole-tree usage is
495,837 and 460,220 tokens. All four scheduled rounds are now assessed.

Real-review trial 5 passes task, contract and preservation checks after one
repair. Both verification responses match renderer stdout; original finding
fields and exact candidate identity survive reassessment. Its Luna implementor
incorrectly describes the retry repair as part of the diff from HEAD. Main's
independent inspection and final verification correctly distinguish the repair
from the current HEAD comparison. This is a retained intermediate correctness
failure despite successful recovery and a correct main final. A review reader
also recovers a missing cache-namespace path segment; encrypted launch text
leaves its origin unknown. Wall time is 789.207 seconds; whole-tree usage is
3,840,401 tokens. This case finishes at 5/5 task success.

Combined-repair trial 5 passes with one repair and correct final claims. Its
initial assessment is returned completely in public. The follow-up returns a
short public final, and main requests the full retained output without a rerun.
The correction is encrypted, so complete combined-report reception remains
unknown. Wall time is 251.639 seconds; whole-tree usage is 867,521 tokens.
This case finishes at 5/5 task success, with earlier attribution gaps retained.

Focused-repair trial 5 passes with one repair, correct identities and preserved
finding history. Verification rejects advisory constant extraction in favor of
the authoritative two-literal requirement. The follow-up provider corrects a
relative helper path and uses the exact command token. It sends an encrypted
handoff and short final, leaving contract delivery unknown; verification visibly
reads its full retained report, so downstream preservation passes.

Its initial renderer comparison was another passive false alarm: the command
prints the draft before rendering. A supplemental comparison proves that the
entire prefix equals the printed draft and the remaining renderer output equals
the final response. Original observations and frozen inputs remain unchanged.
Wall time is 396.088 seconds; whole-tree usage is 1,612,236 tokens. The case
finishes at 4/5 task success, preserving the earlier command-token failure.

### Earlier host research

Installed Claude Code is 2.1.284. Its native
[/goal documentation](https://code.claude.com/docs/en/goal) describes same-session
continuation and a 4,000-character condition. Bounded inspection of the installed
`ProposeGoal` implementation shows a model-callable native route for eligible
interactive local sessions, with direct setting when `ask_user: false` is
authorized by the user's own stated outcome. The tool queues activation for the
end of the turn; a proposal alone is not an active goal. Availability is gated
by host settings, and this tool is unavailable in headless sessions.

The native `/goal` command supports headless entry. Skill instructions and smoke
coverage must distinguish an already active goal, a queued native activation,
and a host where model-driven activation is unavailable. No nested host process,
custom stop hook, scheduler or substitute owner is authorized.
