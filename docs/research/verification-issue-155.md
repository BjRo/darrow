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
