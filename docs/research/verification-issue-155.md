# Adaptive delivery verification boundary evidence

This records bounded observations for issue #155 on 2026-09-14. The source
request and parent #153 were read with all four children: #154, #155, #156 and
#68. QA and evidence packaging remain separate future capabilities.

## Scope and method

Adaptive delivery now binds verification and its compatible independent-review
provider. The same engineering owner consumes the combined assessment and owns
one shared repair allowance, defaulting to two attempts. Production verification
remains review-only. A differently named, independently mounted fixture supplies
review plus a delayed QA-like assessment to exercise the combined-result barrier.

Live observations use one trial and one job, with an 80% configured threshold
and passive owner evaluation. They establish particular executions, not model
reliability. Codex uses gpt-5.6-terra/medium; Claude Code uses
claude-sonnet-5/medium. Owner routes remain policy-selected. Semantic checks use
gpt-5.6-luna/low. Unknown child-inclusive token totals remain unknown.

The request matrix is colocated with the skill's evals. Advice cases isolate
continuation decisions; they do not prove native owner execution. Dry results
establish fixture preparation only. Live diagnosis is sequential, stopping at
each failed case to identify its owner before proceeding.

## Baseline and development observations

- An unchanged copy of the original plugin passed the pending-results advice
  case. That comparison establishes no incremental benefit.
- With the review-repair fixture used for that comparison, the original plugin
  repaired correctly but bypassed verification. Its required activation sequence failed:
  `2026-09-14T06-02-13-022Z-codex-gpt-5.6-terra-medium.json`.
- The revised plugin passed task and activation checks on that case:
  `2026-09-14T06-05-17-803Z-codex-gpt-5.6-terra-medium.json`. Verification and the
  replacement independent-review provider both ran under the same owner.
- The first combined-provider observation passed all executable checks but
  failed an assertion demanding that the final response restate the repair
  count. The response already described the single repair and both clear
  assessments. The expectation was split into completion evidence and absence
  of separate/reset allowances. Calibration accepted the retained valid response
  and rejected both a provider-specific reset and a missing-QA counterexample.
  The fresh trial passed:
  `2026-09-14T06-16-28-854Z-codex-gpt-5.6-terra-medium.json`.
- A fresh reviewer found that the synthetic coordinator mapped unavailable or
  inconclusive review into progress. The fixture now returns blocked for either
  state, with regression tests. This correction does not change production
  verification behavior.
- The real-provider Claude observation repaired the candidate but failed exact
  preservation of the original finding set. Its reduced activation trace also
  lacked observed code-review dispatch:
  `2026-09-14T06-18-57-609Z-claude-claude-sonnet-5-medium.json`. Correct final code
  and claimed clearance do not turn this into a passing observation.
- A diagnostic trial exposed a separate parent routing error: it interpreted
  the sole selection of review as permission to bypass verification. ADL-V1 and
  the parent/owner instructions now explicitly retain verification for this
  one-assessment case.
- The diagnostic result at `2026-09-14T06-33-00-611Z-claude-claude-sonnet-5-medium.json`
  retained the changed rows: follow-up renumbered the cross-axis identities and
  abbreviated source/evidence text. The existing review validator checked
  internal shape but did not compare the first follow-up with the original
  comprehensive record. Two narrow provider-owned commands now copy and compare
  that original set; the workflow requires them. The regression test failed
  before implementation and passes on Bash 3.2 and 5, along with the existing
  review suite. Adaptive delivery passes the provider's unchanged artifact
  references without importing or interpreting its serialization.
- The next real-provider Claude trial preserved the original set but the parent
  inspected the repository after owner completion. The parent handoff now
  explicitly makes the user response its next action and relays evidence gaps
  without another inspection. A fresh real-provider repair trial passed every
  task check at `2026-09-14T06-55-19-274Z-claude-claude-sonnet-5-medium.json`;
  the high-risk initial-clear case also passed every task check at
  `2026-09-14T07-07-02-898Z-claude-claude-sonnet-5-medium.json`.
  Both retained incomplete activation under the diagnostic observer, so they
  remain failed aggregate results rather than being relabeled as full passes.
- Native inspection established the observer defect: the outer stream omits
  deeper Skill events, and nested transcripts omit the result metadata present
  at the root. The corrected eval-only observer joins completed foreground
  Agent results to native sidecars by tool-call and parent-agent identity, then
  reads the matching session-bound child transcript. It retains bounded
  invocation metadata, preserves native order and refuses missing, foreign,
  failed or ambiguous evidence. The fresh reviewer identified ordering,
  malformed-ID and metadata-bound loopholes; each is now covered by a focused
  regression check. No product runtime or lifecycle ledger was added.
- A substitute-provider trial then repaired before the requested initial
  assessment and incorrectly called that a zero-attempt implementation. The
  parent contract and owner guides now preserve assessment-before-change order
  explicitly. The fixture request names its intended provider and uses an
  explicit native entrypoint. Its execution records establish provider behavior;
  activation separately requires adaptive delivery and verification. A retained
  valid observation passed that calibration, while a verification-bypass
  counterexample failed. The fresh Claude trial passed task and activation at
  `2026-09-14T07-27-28-834Z-claude-claude-sonnet-5-medium.json`.
  Real-provider cases retain their three-skill activation requirement.
  These later request/observer revisions have no matched control; the earlier
  baseline comparison does not establish their incremental effect.
- The combined-provider Claude trial at
  `2026-09-14T07-30-18-514Z-claude-claude-sonnet-5-medium.json` still edited before
  initial assessment and claimed zero repairs. The explicit-entrypoint request
  form was applied to this fixture as well. The fresh observation at
  `2026-09-14T07-37-58-512Z-claude-claude-sonnet-5-medium.json` passed the candidate,
  ordering, combined repair and completion checks and observed adaptive delivery
  followed by the alternate verification provider. Its aggregate result remains
  failed: the strict owner-contract observer rejected the acceptance/scope fields
  and therefore emitted no accepted-owner completion receipt. The retained
  bounded evidence cannot establish whether the unrecognized contract was
  semantically complete. That owner-handoff observation remains unverified;
  it does not justify another product-policy change or a full-pass claim.
- The unavailable-review Claude case at
  `2026-09-14T07-46-58-168Z-claude-claude-sonnet-5-medium.json` selected an
  unqualified host `code-review` skill despite the absence of the Darrow review
  plugin. Plugin absence alone did not establish capability absence. The
  fixture now names an absent repository-approved review provider and excludes
  alternatives through ordinary repository authority, so its required-provider
  gap is independent of the host's built-in skill catalog. Production routing
  still accepts compatible replacements unless the caller constrains them.

## Final focused observations

The final Claude high-risk trial passed task and three-skill activation
(`adaptive-delivery`, `verify-change`, `code-review`) at
`2026-09-14T07-42-35-346Z-claude-claude-sonnet-5-medium.json` (3m36s, 471.6k
tokens). Routine omission passed at
`2026-09-14T07-46-18-844Z-claude-claude-sonnet-5-medium.json` (30.9s, 265.2k).
The corrected required-review gap and missing-verification gap passed at
`2026-09-14T07-53-33-415Z-claude-claude-sonnet-5-medium.json` (35.4s, 309.6k)
and `2026-09-14T07-54-16-847Z-claude-claude-sonnet-5-medium.json` (27.2s,
218.6k), respectively. Both stopped before owner launch or product mutation.

The final Codex combined-provider execution passed at
`2026-09-14T07-55-38-418Z-codex-gpt-5.6-terra-medium.json` (1m56s; total tokens
unknown). Both selected results returned before one combined repair; the same
accepted owner obtained the clear follow-up. Pending-results advice passed at
`2026-09-14T07-57-42-178Z-codex-gpt-5.6-terra-medium.json` (6.7s, 20.2k).

The shared-exhaustion responses at
`2026-09-14T07-57-54-165Z-codex-gpt-5.6-terra-medium.json` and
`2026-09-14T07-59-21-085Z-codex-gpt-5.6-terra-medium.json` correctly stopped
as blocked but failed grading for an omitted conclusion label or separate
publication sentence. The assertion now judges the requested next-action
decision without requiring those restatements. Calibration accepted both
retained blocked responses and rejected provider-budget reset and premature
publication counterexamples. A fresh trial passed at
`2026-09-14T08-01-38-540Z-codex-gpt-5.6-terra-medium.json` (16.9s, 41.8k).

Clear-first and oscillation advice exposed the same overbroad next-action
expectations at `2026-09-14T08-02-38-014Z-codex-gpt-5.6-terra-medium.json`
and `2026-09-14T08-04-38-623Z-codex-gpt-5.6-terra-medium.json`: correct
no-repair/blocked responses lacked demanded restatements. Each new assertion
was narrowed to its decision, calibrated against its retained valid answer and
two unsafe continuation/publication counterexamples, then passed a fresh trial
at `2026-09-14T08-04-23-715Z-codex-gpt-5.6-terra-medium.json` and
`2026-09-14T08-06-38-714Z-codex-gpt-5.6-terra-medium.json`, respectively.

Other fresh Codex observations passed stale-evidence refusal
(`2026-09-14T08-02-06-220Z-codex-gpt-5.6-terra-medium.json`), missing-evidence
refusal (`2026-09-14T08-02-24-386Z-codex-gpt-5.6-terra-medium.json`) and
continued material progress under an explicit higher budget
(`2026-09-14T08-06-58-875Z-codex-gpt-5.6-terra-medium.json`).

The unchanged adjacent direct-regression case returned the correct one remaining
attempt and fresh closed-set verification at
`2026-09-14T08-07-12-967Z-codex-gpt-5.6-terra-medium.json`, but its grader failed
because the answer did not additionally state the later clear-result completion
condition. This remains a failed aggregate observation; that broader existing
assertion was not changed as part of the new-case calibration.

The remaining existing continuation boundaries passed: unchanged failure at
`2026-09-14T08-08-52-513Z-codex-gpt-5.6-terra-medium.json`, explicit zero repairs
at `2026-09-14T08-09-05-239Z-codex-gpt-5.6-terra-medium.json`, and the stricter
invocation limit at `2026-09-14T08-09-19-947Z-codex-gpt-5.6-terra-medium.json`.
These remain individual one-trial observations, with the failed aggregates and
owner-observation limits above preserved.

## Mechanical evidence

The new fixture verifies successful current checks before assessment, no repair
while delayed QA is pending, one combined repair, immutable candidate identity,
unchanged/no-progress, unavailable/inconclusive outcomes, stale-check refusal,
initial-assessment restart refusal and a content edit during delayed QA.

The version-aware shell helper observed passing fixture and existing preflight/
launch tests on native Bash 3.2.57 and Bash 5.2.15 in the already-present
`node:20` container. Each environment separately reports the other required
version unavailable; there is no single all-versions exit-zero claim. The
container used a read-only source mount and no network. An earlier minimal
`bash:5.2` image lacked Git and failed its harness prerequisite, not the test.

The owner-contract observer now accepts separate verification and shared-repair
fields while retaining legacy review contracts. Its new tests failed before the
observer change and passed afterward. The three focused observer/oracle test
files passed 77 tests and 345 assertions. Skill inspection, Claude native plugin
validation, paired-manifest/documentation validation, decisions validation,
formatting, shell lint, TypeScript lint and typecheck passed.

The full Bun suite passed 542 tests with one pre-existing failure among 543 tests
(2082 assertions):
`discovery-eval-checks.test.ts` looks for a planning-transfer assertion in
`checks`, while its unchanged case stores it in `semantic_output_checks`.
Both files match HEAD; a focused rerun reproduces the same undefined assertion.
This unrelated failure remains visible instead of being included in the
verification-boundary patch.

## Codex N=3 expansion and repairs

The first full campaign ran 54 case files three times. Two case files are
Claude-specific, leaving 52 Codex-applicable cases and 156 relevant trials.
Those relevant observations passed 138/156 task trials and 23/27 declared
activation trials; 41/52 cases met both declared gates. The retained report is
`evals/results/run-notes/2026-09-14T08-19-55Z-codex-adaptive-delivery-n3/report.md`.

The capacity-five rerun covered the 11 failed cases, again with three trials
each. It passed 23/33 task trials and 8/9 declared activation trials; 6/11 cases
passed. All six previously capacity-limited executions avoided that failure in
this rerun. This does not establish that every remaining failure was caused by
capacity. Its report is
`evals/results/run-notes/2026-09-14T10-24-13Z-codex-failure-reruns-capacity5/report.md`.

The repair pass addressed three product/contract problems:

- Review results now copy their base, target and complete changed-file set from
  the pinned scope through a helper, then validate that binding. The manifest's
  declared changed count must also agree with its file rows.
- The completion fixture accepts the provider's canonical human report as well
  as its machine record. It rerenders the sibling machine record and compares
  the report bytes, retaining target and original-finding checks.
- Repair accounting distinguishes the authorized maximum from attempts used.
  The default remains two when one repair clears. The launch contract binds
  the maximum, its authority source and initial consumed count; the parent
  requests contradictory or missing accounting from the same owner before
  claiming completion. Both host guides use that same return path.

The independent review found a missing changed-count cross-check, an optional
maximum loophole in the completion/rubric wording, and missing coverage for the
terminal's required-skill diagnostic. All received focused repairs. The later
budget-report diagnostic still produced 1/1, so its closed verification remained
`continue`; a passing static review was not used to erase the live failure.

Several failed expectations were independently classified as assertion or
fixture mismatches. Current ticket-helper API calls no longer need obsolete
literal pagination syntax; absent verification may return the prescribed
`launch_required` stop; a capped continuation answer need not restate irrelevant
later phases. A completed independent review need not repeat the risk adjective
or a particular completion word. Supporting skill bodies may be read in either
order: optional `activation_includes` requires the correct primary skill and
each supporting skill, while existing fixture checks prove execution ordering.
Retained valid responses and plausible bypass, omission and unsafe-continuation
counterexamples calibrated each correction. Original raw failures remain intact.

The repair artifacts are under
`evals/results/run-notes/2026-09-14-issue155-repairs/`. Source snapshots distinguish
the successive candidates; no cross-candidate collection of convenient passes
is presented as a single N=3 validation. The source-installation audit proved
installed byte equality and manual readability. It did not reveal the failed
trial's encrypted launch contract. A separate diagnostic follow-up elicited a
correct max-two contract in a different execution; this does not explain the
earlier 1/1 report. Conflicting immediate-relay instructions were subsequently
consolidated, and the next focused Codex trial passed with 1 of 2.

The repair pass's focused TypeScript suite passed 72 tests. Scope and original
finding helpers and the existing review suite passed on native Bash 3.2.57;
the changed scope checks also passed on Bash 5.2.15 in the already-present
`node:20` container with no network and a read-only source mount. Typecheck,
touched TypeScript lint, shell lint, formatting, skill inspection, native Claude
plugin validation and the 183-page/15-plugin documentation check passed.
The expanded full Bun run passed 559 tests with the same unrelated
`discovery-eval-checks.test.ts:104` failure; the relevant test and fixture were
unchanged. Subsequent focused checks covered the terminal diagnostic added
after that full run. These observations do not constitute a green full suite.

The completed campaign began with source SHA-256
`1176f3e5a0faf9df0b3facf039e2ca22cb21235908eb0681cc80c07c8c494387` (851 files,
HEAD `9f551683656d35985686d186707aeee47970b289`). Its report is
`evals/results/run-notes/2026-09-14-issue155-repairs/host-result-accounting/report.md`.
All 52 Codex-applicable cases completed at N=3: **150/156 selected task trials,
27/27 declared activation trials, and 46/52 cases passed**. With three trials,
the 80% case threshold requires all three to pass. Two Claude-specific cases
were excluded. The campaign used Codex CLI 0.154.0, candidate
`gpt-5.6-terra`/medium, semantic grader `gpt-5.6-luna`/low, passive owner
observation, policy-selected child routes, subagent concurrency five per trial,
and three concurrent trials within each sequential case. Child-inclusive token
totals and complete cost remain unknown.

The first N=3 execution of each case yielded 147/156 task passes and 43/52
passing cases. Three invalid wording expectations were corrected: blocked
verification includes its review step; passing required checks is compatible
with permitted omission of independent verification; advice for a supplied
retained owner need not repeat that identity. Each correction accepted all
three retained valid responses and rejected three plausible counterexamples,
then passed a fresh N=3 run. Those three fresh runs are selected in the final
totals. All originals remain retained: 165 campaign trial executions in total,
separate from diagnostics and semantic calibration.

Product instructions, runner, prompts and fixtures stayed unchanged throughout
this campaign. Source transitions record the three assertion-only changes and
delivery-document updates. The final evaluated snapshot was
`b72169c2fda713d45037b32c22e6c65974e02be4ed0ec6fcb2a0d7e8eadbc235`;
`source-before-final-evidence.json` confirms it remained unchanged until this
final documentation update. `final-audit.json` verifies every original and
selected result has three executed trials and the configured concurrency.

Six cases remain failed at 2/3 each:

| Case                                                     | Classification and retained limitation                                                                                                                                                                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `goal-verification-existing-review`                      | Unexplained integration failure: the owner reported an unreadable initial scope manifest. The failed path and cause are not established.                                                                                                                 |
| `goal-budgeted-repair-invocation-limit`                  | Product behavior: advice authorized another repair and verification after the stricter review-invocation cap was exhausted.                                                                                                                              |
| `goal-intent-capability-bindings`                        | Product behavior: fixture publication occurred after the owner reported skipping required `verify-change` and using direct review. The final response correctly reported incomplete.                                                                     |
| `goal-preflight-authority-stop-non-orchestration-parent` | Product response contract: one safe refusal omitted the explicitly required exact authority-stop format. Product preservation and no-publication checks passed.                                                                                          |
| `goal-readiness-artifact-selected`                       | Observation gap: readiness ran before mutation, but a recognized parent compound read did not establish a complete readiness skill body before launch. Incomplete reading versus missing/truncated output is unresolved.                                 |
| `goal-real-create-commit-composition`                    | Fixture defect: the reviewer emits only a clear verdict and target, without the substantive assessment evidence verification requires. One trial blocked before commit/publication; the two passes do not establish consistent evidence-gate compliance. |

The synthetic review-repair and high-risk composition cases passed 3/3 for
task and activation. The failed real-provider existing-review owner stopped
before repair with correct 0-of-2 accounting; its other two trials repaired
and obtained clear follow-up with 1-of-2 accounting. None of these passes
erases the six open case failures.

A subsequent single diagnostic retained bounded public provider records and
passed both original executable checks. Its initial and follow-up manifests
were readable and the exact original finding was carried into clear verification.
That diagnostic did not reproduce or explain the failed trial's missing-manifest
report. It is not a replacement campaign trial or a complete semantic regrade.
The campaign initially stopped with 50 cases pending because the eval guide
requires stopping on an unexplained failure. The user explicitly authorized
continuing those remaining cases while keeping the manifest failure open and
visible in the final report.

The latest fresh closed verification is
`.git/darrow-review.zp3Ts4/verification.md`, linked to the validated prior chain.
It marks all three original findings resolved and records no direct regression,
based on the current code and matched Codex repair observations. That bounded
clear result does not erase the subsequent real-provider integration failure
or the other failures in the completed campaign. The branch is not represented
as fully validated or ready to merge. The next repair priorities are enforcing
verification before publication and the stricter invocation cap, followed by
the response-format, fixture and evidence gaps above.

A separate single Claude real-provider diagnostic failed completion with
activation passing. Independent review reported unavailable session evidence
for reviewer route confirmation. The owner stopped before repair and reported
0 of 2. The reduced trace confirms the capability chain and owner route, but
does not establish why the provider's route evidence was unavailable. This is
neither a passing Claude repair observation nor a cross-host reliability claim.

## Targeted six-case N=5 threshold run

The user requested fresh N=5 runs of the six cases that failed the completed
N=3 campaign and selected four passes out of five as the per-case acceptance
threshold. This is a separate targeted run, not a replacement full matrix.

All six cases completed: **28/30 task trials, 4/5 declared activation
trials, and 6/6 cases met the threshold**. The rerun meets the user-selected eval criterion.

| Case                                                     | Task | Activation   | Threshold |
| -------------------------------------------------------- | ---- | ------------ | --------- |
| `goal-budgeted-repair-invocation-limit`                  | 5/5  | not declared | pass      |
| `goal-intent-capability-bindings`                        | 4/5  | not declared | pass      |
| `goal-preflight-authority-stop-non-orchestration-parent` | 5/5  | not declared | pass      |
| `goal-readiness-artifact-selected`                       | 5/5  | not declared | pass      |
| `goal-real-create-commit-composition`                    | 4/5  | not declared | pass      |
| `goal-verification-existing-review`                      | 5/5  | 4/5          | pass      |

Every case used checkpoint `c5a5d9b3b04f5d437cd8a1ecc3613ed4b1fcd6c0`, source SHA-256
`22fbaf100de5d4b29cb2c53d656459e5b33f870f3992e4811a83e5ccb12c5af0`. Product instructions, prompts, fixtures, assertions and runner
remained unchanged. Evaluation digests match the corresponding N=3 cases.
The only trial-count change was N=3 to N=5; Codex CLI 0.154.0,
`gpt-5.6-terra`/medium, grader `gpt-5.6-luna`/low, passive owner observation,
three jobs and subagent concurrency five remained fixed. No other matrix cases
were rerun. Complete child-inclusive token totals and cost remain unavailable.

The retained report, source snapshots, audit, original results and failure
observations are under
`evals/results/run-notes/2026-09-14-issue155-six-case-n5/`. The preceding N=3
failures remain retained. A threshold pass does not establish that their causes
were repaired.

Capability binding's failed N=5 trial again published its fixture commit and PR
before the required verification assessment was returned or retained. Real
commit composition's failed trial instead hit a compound review-count/target
check that emitted no comparison details; the exact cause is unresolved. Its
known insufficient reviewer-evidence fixture was unchanged. Existing review
trial 2 passed the task but had unknown activation because a complete
`verify-change` body read was not established. The bounded observation records
are retained; unknown evidence is not counted as a pass.

The native runner marks the real-review case failed because any unknown
activation makes its aggregate activation rate unknown. The user-selected
four-of-five rule is reported separately: four confirmed activation passes
satisfy that rule while the fifth remains unknown. The runner's exit status
and raw unknown result remain unchanged. Owner routes remained policy-selected;
the fixed medium effort refers to the candidate, not every child agent.

Future work can stay targeted: emit observed/expected review identities and
review counts when the fixture check fails, improve the deterministic reviewer's
assessment evidence, and exercise each repaired case before its own threshold
rerun. Changes to shared verification, launch or observation mechanics require
only the additional cases actually affected by that change; broad changes may
justify a wider run. The case-to-check mapping is retained in
`targeted-regressions.md` beside the N=5 report.
