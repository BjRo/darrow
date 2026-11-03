# Assurance coordination replacement (#291)

Evidence checkpoint: November 2, 2026, before the reported Claude session reset.
Checkpoint candidate: `f556fc573db26bdad3bb7f1fdc51255f06851161`.
Later gate results belong with the published pull request and its exact head.

The replacement is implemented. Native Codex delivery paths and Claude's
standalone assurance paths have functional evidence. Full Claude Adaptive Goal
and Ticket-to-PR completion remain unproven. Do not adopt the replacement before
those checks and the separately approved held-out study satisfy
[#291](https://github.com/BjRo/darrow/issues/291). Functional passes do not prove
quality preservation or the comparative cost and latency targets.

## Replacement and migration

An observed supported owner executes Verification and Review public coordination
inline. A weaker or unknown owner delegates one bounded assessment to a capable
coordinator. Applicable Standards and Spec readers remain fresh and independent.
Initial and closed follow-up operations preserve capability-owned helpers,
provider prerequisites, routes, complete results and candidate/finding history.
The original native owner keeps implementation placement, repairs, authority,
continuation and completion.

This covers standalone capabilities, Adaptive Goal, Ticket-to-PR and Artificer.
Artificer remains Codex-only, with its existing owner model and pinned transport.

- Update the independently installed capabilities selected for new deliveries.
  A compatible replacement's public prerequisites still apply, including any
  explicit provider isolation requirement.
- Preserve in-flight deliveries in their original installation and native
  thread. Missing candidate, finding, target or repair history blocks a closed
  follow-up.
- Default two-axis assessment needs two spawned slots and one nesting layer
  inline, or three slots and two layers with fallback, excluding the primary.
  Settled implementation, inactive retained threads and provider prerequisites
  still affect available capacity. Doctor now distinguishes those requirements.
- Install the single replacement workflow. Historical benchmark conditions and
  original grades remain evidence under their original contracts; they are not
  selectable production modes.
- Claude fallback calls must explicitly set `run_in_background: false`.
  Frontmatter alone did not prevent a native background launch in the retained
  trial. Background execution cannot satisfy the foreground contract.

## Codex native regression evidence

Each row is one fresh functional trial, n=1, jobs=1, threshold=1, passive owner
observation, native app-server entrypoint, installed Codex 0.166.0. Task and
activation checks passed. These are distinct fixture cases, not a randomized
sample or a stability estimate. Run Codex before Claude as requested.

Inline owners used GPT-6.1 Sol/medium. Weaker and explicitly unknown owners used
GPT-6 Luna/medium and one GPT-6.1 Sol/medium assessment coordinator. Real Review
readers used GPT-6.1 Sol/xhigh; the compatible independent fixture provider
selected its own documented route. Closed fixture follow-ups use only their
applicable axis. The prohibited-coordination case passed by returning blocked
without launching children. Semantic graders used GPT-6 Luna/high.

Costs below include candidate and descendant native usage, recovered from
hash-verified complete transcript bundles. They use the existing frozen October
30 short-context API-equivalent rates, exclude semantic graders, and are not
subscription charges. No matched vanilla/current comparison was run here.

| Case                                            | Candidate wall seconds | API-equivalent dollars |
| ----------------------------------------------- | ---------------------: | ---------------------: |
| `code-review-placement-inline`                  |                   99.4 |              $0.224261 |
| `code-review-placement-unknown`                 |                  128.4 |              $0.238765 |
| `code-review-placement-weaker`                  |                  118.0 |              $0.198551 |
| `goal-inline-verification-initial-and-followup` |                  212.0 |              $0.493186 |
| `ticket-to-pr-inline-assurance-composition`     |                  216.0 |              $0.319811 |
| `verification-coordination-prohibited`          |                   28.9 |              $0.003669 |
| `verification-criterion-gap`                    |                  135.0 |              $0.208034 |
| `verification-existing-review`                  |                  148.8 |              $0.267248 |
| `verification-followup-clear`                   |                  137.8 |              $0.184424 |
| `verification-followup-no-progress`             |                  112.3 |              $0.148219 |
| `verification-followup-progress`                |                  126.7 |              $0.167927 |
| `verification-followup-regression`              |                  121.4 |              $0.169604 |
| `verification-placement-unknown`                |                  172.9 |              $0.254684 |
| `verification-placement-weaker`                 |                  168.9 |              $0.294877 |
| `verification-replacement`                      |                  108.6 |              $0.190347 |

These 15 trials consumed 10,965,288 input tokens, including 10,058,496 cached
input tokens, and 102,108 output tokens, for $3.363605 API-equivalent candidate
and descendant cost. This total describes these regression fixtures only.
The existing-review semantic grader separately cost $0.001248. Complete
per-session counters, routes and original evidence references are retained in
`/Users/bjro/Benchmarks/darrow/291-functional-codex-usage.json`.

Passing evidence comes from `291-codex-existing-review-v5`,
`291-codex-weaker-v2`, `291-codex-unknown-v1`, and
`291-codex-functional-batch-v1` through `v3` beneath that private benchmark root.

## Claude native regression evidence

Validation uses installed Claude Code 2.1.309. Eligible owners are Claude
Sonnet 5.5/medium; weaker/unknown owners use Haiku 5.5/medium and the exact scoped
Sonnet 5.5/medium coordinator. Real Review readers use Opus 5.5/xhigh.
Semantic graders remain GPT-6 Luna/high. Trials use n=1, jobs=1, threshold=1,
passive owner observation and their own native Claude transcripts.

Each row passed all task checks at n=1. Activation is reported separately;
unavailable means native command expansion emitted no complete Skill-tool
receipt. Complete native readers and validated results prove bounded workflow
execution, not that missing activation observation. Costs are native list-cost
estimates including descendants, not actual subscription charges or a matched
comparison. Reported input includes cache usage.

| Case                                          | Activation  | Wall seconds | Input / output tokens | Native list-cost dollars |
| --------------------------------------------- | ----------- | -----------: | --------------------: | -----------------------: |
| `verification-existing-review`                | passed      |      150.837 |       604,343 / 8,937 |                $0.626952 |
| `code-review-placement-inline`                | unavailable |      129.047 |       374,552 / 6,979 |                $0.562556 |
| `code-review-placement-weaker`                | unavailable |      144.884 |       294,899 / 7,697 |                $0.546975 |
| `code-review-placement-unknown`               | unavailable |      193.876 |       282,366 / 6,046 |                $0.577958 |
| `verification-followup-clear`                 | passed      |       82.765 |       405,423 / 6,550 |                $0.335000 |
| `code-review-fix-verification-resolved`       | passed      |      171.781 |       183,015 / 2,697 |                $0.800041 |
| `doctor-adaptive-goal-claude-inline-capacity` | unavailable |       28.920 |        63,073 / 1,217 |                $0.112241 |
| `verification-replacement`                    | passed      |       83.164 |       257,266 / 4,050 |                $0.335436 |
| `verification-criterion-gap`                  | passed      |       59.090 |       252,452 / 4,077 |                $0.326480 |

Evidence is retained under `291-claude-functional-batch-v5`, `v6`, `v8`,
`291-claude-doctor-v2` and `291-claude-provider-batch-v2` beneath the private
benchmark root.

The first full Adaptive Goal trial passed the product, initial Review,
closed-follow-up, native reader-route and goal-activation checks. It failed the
final-response check: Claude's native goal judge repeatedly demanded a separate
Adaptive Goal result artifact and stronger route proof despite the completed
public workflow and observed preflight route. Its goal remained active and its
terminal response was empty. It is not a completed delivery or a passing trial.
The retained trial took 447.586 seconds and reports 3,508,803 input tokens,
24,826 output tokens and $1.487340 native list cost.

The oracle now distinguishes activation from completion: these four new composed
delivery cases require `native_goal: complete`, and an active or blocked goal
cannot pass that condition. Both retained Codex compositions have complete
native final-state receipts; that additional inspection is not new execution.

Later Claude composition attempts stopped with `usage_limit_reached` (429),
reporting a session reset at midnight Europe/Berlin. Ticket-to-PR also exposed an
invalid fixture entry: its explicit-only native command cannot be invoked by
placing it inside `/goal` and then calling Skill. The revised cases enter via
explicit native skill invocation and then supply `/goal` in a second user turn
on the same session, as the public Claude activation contract requires. Harness
I/O facts live in repository guidance rather than becoming goal acceptance
criteria. Both cases prepare successfully without invoking a model; native
completion remains unavailable until account capacity permits execution.

Private failures are retained in
`291-claude-functional-batch-v8/goal-inline-verification-initial-and-followup-claude`,
`291-claude-goal-v2` and `291-claude-ticket-to-pr-v1`. Dry preparation is
`291-claude-two-turn-preparation-v1`; it is not native behavior evidence.

## Artificer native composition

The opt-in probe runs the real admission/claim, worker, native goal, Ticket-to-PR,
Adaptive Goal, Verification, Review and Git paths with pinned Codex 0.159.2.
Ticket/operator feedback, forge, PR and required CI are local fixtures; it makes
no real GitHub changes. Delivery stops for an actual operator question, exits,
then resumes at WIP zero from the original claim, native thread and goal.

Three fresh engineering deliveries were retained. The third passed the current
strong assurance gate: public canonical result/scope validation, passing complete
reader judgments, exact reviewed-to-published content, complete Verification
criterion reconciliation, assessment before publication, one claim, one intended
commit, one local fixture PR and successful required CI. A separate read-only
GPT-6 Luna/high semantic judge checked each criterion and the complete provider
handoff. A counterexample omitting C2 evidence was rejected. This is functional
composition evidence, not a quality-preservation study.

The third delivery took 308.357 seconds; its separate assurance oracle took
8.236 seconds. Actual routes were GPT-6 Sol/medium owner, Luna/medium implementor,
one Sol 6.1/medium assessment coordinator and two Sol 6.1/xhigh readers. Whole-tree
usage was 2,824,079 input tokens, including 2,646,912 cached input tokens, and
20,117 output tokens. Dollar valuation is unavailable because the retained
rate card does not price the owner route; no price is inferred.

Private evidence is `291-artificer-assurance-v3.json` beneath the benchmark root.
The stronger native goal-creation identity check also passed against retained
RPC events, with stable creation timestamp 1793645219 across both processes.
That retrospective check is separately labeled
`291-artificer-assurance-v3-goal-identity-regrade.json`, not another execution.
The second delivery's later mechanical and semantic regrade likewise is not a
fresh engineering trial.

## Diagnostic failures and revised oracles

Original outputs and grades are retained unchanged. Oracle revisions and
regrades do not count as new execution. Every fresh retry followed diagnosis
and a relevant instruction, fixture or oracle repair.

- Codex existing-review v2 changed evaluator inputs during execution and is
  invalid as passing evidence. V3 required unrelated submitted-code inspection
  for positive reader facts; v4 additionally required an unused common-control
  receipt. Their original unavailable grades remain. V5 used stable inputs and
  the chosen host's positive bound-reader evidence.
- Codex weaker-owner v1 blocked by demanding route fields the accepted spawn
  response does not repeat. The repaired handoff correlates the explicit native
  call with its returned child ID; the native oracle still checks actual routes.
- Batch v1's follow-up case failed host startup under an inapplicable Review
  artifact profile. Batch v2 uses the ordinary profile. The first Ticket-to-PR
  attempt failed preparation because unused mount metadata exceeded the native
  fixture environment limit. No participant ran in that attempt. Exact paths
  remain mounted and excluded; metadata is passed only to fixtures consuming it.
- Codex batch v2's Adaptive Goal task failed an initial-reader oracle that
  incorrectly counted a later legitimate closed follow-up as an earlier unbound
  launch. The repaired operation prefix retains earlier-unbound rejection.
- Claude v1 exposed Unix transcript-directory normalization and unnecessarily
  nested coordination; its task failed. Native path lookup now follows the
  observed punctuation normalization. Regrading its placement is not a task pass.
- Claude batches v2/v3 passed task checks but lacked or failed activation:
  explicit plugin dispatch needs the complete native Skill receipt, and inline
  supporting workflows need not emit another Skill event. Primary activation
  remains separately required and missing observations remain unavailable.
- Claude v4 refused artifact retention with no Write tool. Its fixture now
  states existing Bash private-artifact authority explicitly; actual denials
  still block. Batch v5's standalone Review discarded a partial reader batch;
  the instructions now explicitly block that operation instead of relaunching.
- Claude v6's weaker owner confused the selected reader route with its own
  coordination eligibility. Placement now binds the active context before
  reader selection. V7 omitted the foreground flag and its background child
  stopped on a genuine Bash denial. V8 explicitly sets the flag; the refusal
  was retained, never bypassed.
- The older Claude doctor case and replacement-provider string assertion could
  not prepare on Claude because they required Codex-only evidence. A new native
  doctor boundary case uses the complete common no-child receipt. Replacement
  execution is proven by completed native readers and the complete provider
  handoff; its obsolete transcript substring assertion was removed. No model
  ran in either preparation failure.
- Artificer v1's old native start records omitted route fields. The revised
  oracle accepts actual completed child turn contexts only when both old fields
  are absent; partial or contradictory evidence still fails. Its regrade is not
  another delivery. Later proof additionally checks complete canonical assurance
  and candidate binding rather than inferring them from routes or publication.

## November 3 five-trial Codex cohort

Five-trial Codex cohorts on the published head `53ce656c` found
`code-review-placement-unknown` at 2/5. Luna sometimes followed the Claude
instructions on Codex, and once answered before its fallback coordinator
finished. Repairs, each followed by a fresh cohort on a new frozen snapshot:

- Review's route helper refuses a `--host` that contradicts the running host
  (`CODEX_THREAD_ID` or `CLAUDECODE=1`).
- New placement helpers in Review (`review-route place`) and Verification
  (`darrow-verify-placement`) read the session's own model and effort from the
  host transcript and return `inline` or `fallback`. Only the pinned Claude
  fallback agent may pass `--pinned-fallback-agent`; a Codex child observes its
  own route.
- Fallback callers wait for the child's complete result and return it verbatim.
  The accepted-call receipt exchange was removed.
- Adaptive Goal runs Verification, which owns placement. Its own Verification
  launch path and the `codex-verification-input` helper were removed.
- Adaptive Goal's completion summarizes each assessment with its report link
  instead of pasting pre-publication next actions.

Final cohorts: 5 trials, 3 jobs, threshold 0.8, passive app-server observation,
host-default candidate routes from each case. Review cases ran on snapshot v21,
Verification cases on v23, Adaptive Goal-mounting cases on v25 and the
revised-oracle case on v26. Each plugin's files are byte-identical from its
cohort snapshot to v26, which equals the working tree.

| Case                                            | Passed |
| ----------------------------------------------- | -----: |
| `code-review-placement-inline`                  |    5/5 |
| `code-review-placement-weaker`                  |    5/5 |
| `code-review-placement-unknown`                 |    5/5 |
| `verification-existing-review`                  |    5/5 |
| `verification-placement-weaker`                 |    4/5 |
| `verification-placement-unknown`                |    5/5 |
| `verification-coordination-prohibited`          |    5/5 |
| `verification-followup-clear`                   |    5/5 |
| `verification-followup-progress`                |    5/5 |
| `verification-followup-no-progress`             |    5/5 |
| `verification-followup-regression`              |    5/5 |
| `verification-criterion-gap`                    |    5/5 |
| `verification-replacement`                      |    5/5 |
| `goal-inline-verification-initial-and-followup` |    5/5 |
| `ticket-to-pr-inline-assurance-composition`     |    5/5 |
| `doctor-adaptive-goal-counterexample-depth`     |    5/5 |

The `verification-placement-weaker` miss handed only review to its fallback and
then used the wrong backend for rendering.

`verification-coordination-prohibited` first asserted that no spawn was
attempted. With the same correctly blocked behavior it scored 1/5, 4/5 and 3/5,
because Sevro could not statically inspect submitted `exec` programs (path
arrays, template literals, `ALL_TOOLS` filters), and the absence claim then
graded _unavailable_. The case now asserts `child_sessions: none`: complete host
session and accepted-spawn records show that no child session ran. Regrading the
15 retained trials passes all of them (the old assertion was unavailable in 7)
and fails all 5 retained `verification-placement-weaker` trials in which a
fallback child ran; regrades are not execution evidence. A fresh v26 cohort
passed 5/5. Activation and the
Ticket-to-PR publisher-transcript domain were also unavailable in some trials.
Claude cohorts were not run. Raw results remain outside the repository under
`/Users/bjro/Benchmarks/darrow/291-n5-functional-v*-2026-11-03`.

## Repository checks and remaining gate

The complete canonical `bun run check:python` gate passed all 11 registered
packages on frozen source v14, including locked dependencies, formatting, lint,
strict typing, tests and separate coverage thresholds. Review passed 479 tests
with one skip (98.26% statements, 95.81% branches); Adaptive Goal passed 365
(98.25%, 97.10%); Artificer passed 167 (99.19%, 96.82%). Python source is unchanged
between that frozen copy and the working candidate.

Current focused placement, activation, composition and case-resolution checks
passed 41 tests. The stricter native completion and doctor preparation checks
passed five tests. Documentation structure/packaging checks passed 267 Markdown
pages and 15 plugins; documentation guard tests passed 11. Typechecking,
ESLint and Prettier passed at their recorded checkpoints. Final checks and
closed independent repair verification precede publication. At this checkpoint, the final full serial
tooling run on frozen v15 had not finished; published-head CI must prove the actual
branch commit, which frozen-copy evidence alone cannot establish.

Prior tooling runs exposed cold-start timeouts and a source change during
execution. Frozen v12 retained 499 passes and four timing failures. The new
public native-proof matrix now has an explicit 90-second budget; unrelated
fixture timing failures passed serial diagnosis: the three existing tests passed
in 56.19 seconds together, and the native-proof matrix passed separately in
14.16 seconds. No failed behavior assertion was waived. Round-trip property tests
that invoke Git or the placement command no longer use Hypothesis's default
200 ms deadline. Their behavioral invariants remain unchanged.

Adoption still requires the separately approved study design, exact independent
trial count and budget: API-equivalent workflow cost at most 2.5 times matched
vanilla, mean latency at most 1.1 times current Adaptive Goal, no demonstrated
consequential regression, and evidence excluding a five-percentage-point loss at
95% confidence in each of defect detection, false-alarm control, acceptance
coverage and actionable findings. Keep equal 25% category weights, matched
scope/routes/checks, condition-blind independent judgment and user adjudication
of disputed or consequential findings. Neither the earlier four-task pilot nor
these functional cases can satisfy that contract.
