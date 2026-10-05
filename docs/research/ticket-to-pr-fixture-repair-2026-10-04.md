# Ticket-to-PR: fixture repair and Codex re-verification

Follow-up: the [0.5.3 main-thread clarification](ticket-to-pr-main-thread-2026-10-04.md)
completed a separate two-case n:5 comparison. The 0.5.2 results below remain
unchanged baseline evidence.

Status: the approved four-case follow-up is complete. **20/20 trials achieved
the intended outcome; activation passed 20/20.** The original automated grade
is **18/20**. One failure is a real ownership violation; one is a semantic
grader false negative. All original results remain unchanged.

The fixture repairs restored successful publication and appropriate refusal.
The next product change should be a small clarification of same-thread
invocation at the recipe's delegation point, followed by a separate focused
comparison. Do not reopen the adopted architecture or change the runner.

## Results

| Case                      | Task outcome         | Original grade | Activation | Observed workflow                      |
| ------------------------- | -------------------- | -------------- | ---------- | -------------------------------------- |
| `composition-existing-pr` | 5/5                  | 4/5            | 5/5        | 4 pass; 1 child-owned goal             |
| `composition-replacement` | 5/5                  | 4/5            | 5/5        | 4 pass; 1 timing caveat                |
| `feedback-relay`          | 5/5                  | 5/5            | 5/5        | 4 pass; 1 refused readiness retry      |
| `feedback-rejected`       | 5/5 correct refusals | 5/5            | 5/5        | 5 pass                                 |
| **Total**                 | **20/20**            | **18/20**      | **20/20**  | **17 pass; 2 deviations; 1 qualified** |

Case IDs in the artifacts have the `ticket-to-pr-` prefix. These dimensions
answer different questions:

- **Task outcome:** fifteen correct deliveries and five correct refusals.
- **Ownership:** fourteen of fifteen completed deliveries kept the goal in
  the original Sol main thread. All five revoked approvals correctly stopped
  during preflight without a goal. Successful publication does not excuse the
  child-owned goal.
- **Observed workflow:** the two deviations are ownership and the explicitly
  one-use fixture readiness retry. The qualified result is a no-op branch
  preparation before goal activation. These are not three failed deliveries.
- **Final evidence:** task, PR/commit or refusal evidence was correct and
  retained for all twenty outcomes. One intermediate explanation of a recovered
  path error was inaccurate. Complete encrypted handoff contents remain
  unknown; final evidence does not close that observation gap.
- **Recovery:** two trials visibly recovered from command/path mistakes.
  This set does not measure review-driven implementation repair.

The final trial also illustrates the observation limit: its publisher's
public final says the evidence was sent, while the message itself is
encrypted. The retained publisher output and main-thread final agree on the
PR and commit. That establishes the observed outcome, not the message's exact
contents.

## Changes and frozen scope

This follow-up implements the approved repairs from the
[current-candidate investigation](ticket-to-pr-investigation-2026-10-04.md).
Ticket-to-PR is 0.5.2; Adaptive Delivery remains 0.24.6. Four affected cases each
received five fresh trials. The earlier six diagnostics, original Luna failures,
and all attribution gaps remain separate evidence.

- The two composition fixtures install the complete Git plugin through the
  existing `additional_plugins` mechanism. Its skills now resolve their own
  bundled backend. The replacement fixture explicitly binds `ship-proposal`
  despite the presence of the Git plugin's publisher.
- Accepted-feedback checks require the actual full answer, original source
  identity and acknowledgement before mutation. Repeating an otherwise valid
  acknowledgement is permitted. Changed answers, wrong references, changed
  source and missing acknowledgements still fail.
- Revoked-approval discovery explicitly occurs during read-only preflight.
  That case requires refusal without goal activation, edits or publication.
- Both feedback commit helpers include the focused tests that the fixture
  permits changing. Unrelated committed paths remain prohibited.
- The specification describes main-thread ownership and same-thread
  continuation. The README records that Artificer's current separate-owner
  transport is incompatible; migration remains a separate follow-up.

The runner runtime, Adaptive Delivery, review and verification are unchanged.
The two modified files under `evals/runner/` are deterministic fixture tests.
The experiment-local launcher and observer schedule and inspect native trials;
they do not inject instructions or modify participant requests.

## Remaining findings

### One delivery used a separate goal owner

In `composition-existing-pr` trial 4, the Sol main thread immediately launched
an Adaptive Delivery child and waited for its result. It created no native
goal. The child owned and completed the goal and delegated implementation.
Retained native routes identify that child as Luna/medium under the host's
pinned default-child configuration. The other trials do not replace this one.

The change, tests, commit lineage, existing PR and published head were correct.
Task success therefore passes while main-thread ownership fails. This is a
confirmed product contract violation. Encrypted launch contents do not explain
why the model chose that ownership arrangement.

The recipe currently says “Delegate the shortcut once” and describes relaying
the owner's response before its continuation section clarifies main-thread
ownership. That is a plausible source of ambiguity, not proven causation.
The smallest next candidate would clarify same-thread capability invocation
at that delegation point and distinguish it from launching an overall owner
child. Keep Adaptive Delivery's bounded delegation and route selection intact.
Discuss and test that candidate separately; no such wording change was mixed
into these trials.

### One semantic grader rejected a faithful completion summary

`composition-replacement` trial 5 completed the change, passed checks and
published the intended commit through `ship-proposal`. Its final response
reported the correct ready-for-review PR, repository, branches and matching
intended, remote and PR commits, with no pending action or blocker. All
deterministic checks and activation passed.

The semantic grader rejected the response because it did not sufficiently
explicitly say delivery was complete. The public contract permits faithful
summaries; it does not require a fixed completion phrase. Retain the original
runner failure and record manual task success. A future assertion-only repair
should evaluate completed effects and unresolved blockers, calibrated against
this response and an otherwise similar response that still has work pending.
Do not change the skill to reproduce the grader's preferred wording.

### A readiness retry violates the fixture's one-call rule

`feedback-relay` trial 1 obtained a successful readiness result, then retried
that command after approval. The bound fixture skill explicitly says to call
it once. The second call exited 1 because the first had already created its
invocation marker. No new readiness result was produced. Earlier readiness,
the accepted answer and final checks still supported successful delivery.

This is an observed fixture-provider contract violation, also seen in the
earlier diagnostic candidate. It is not evidence that production readiness
must be called only once: the real capability allows reassessment, and
Adaptive Delivery requires it when assumptions change. Keep this deviation
separate from task success and discuss the validity of that synthetic limit
before adding a production prohibition. The current hidden check counts
successful recorded invocations, so it does not detect this refused retry.

### One branch-preparation timing caveat

`composition-replacement` trial 1 called the branch preparation capability
before creating its main-thread goal. The helper returned `current` and changed
no branch or worktree. Adaptive Delivery assigns preparation to goal
coordination, so retain a qualified workflow result. The visible outcome does
not justify treating this as failed delivery or imposing a universal fixed
phase sequence.

## Evidence and recovery limits

- Task success includes correct refusal in the revoked-approval case. It does
  not mean that all twenty trials should publish a PR.
- Final summaries may omit repeated metadata where the retained provider
  evidence establishes it. For example, accepted-feedback trials 3 and 4
  preserve the full PR URL, commit and matching heads without repeating the
  repository name. No verbatim-copy requirement was added.
- Existing-PR trial 4 recovered from two wrong paths: a guessed readiness skill
  location and an incomplete plugin-cache path. Failed and corrected commands
  establish those causes. Its intermediate description of a corrected path
  as the same helper was inaccurate; the final publication evidence was
  correct. Replacement trial 4 recovered from assigning zsh's read-only
  `status` variable by using `check_rc` and rerunning the check. These are
  observed recoveries, not implementation repair attempts.
- Expected pre-edit missing-export test failures establish the starting
  condition; they are not failed implementation trials. This scope does not
  exercise review-driven repair, repair-budget exhaustion or recovery from an
  incorrect verification assessment.
- Encrypted assignment and relay contents remain unknown. Native identity,
  route, goal, capability-read, command and result evidence cannot prove every
  field of an encrypted handoff. Observed workflow passes are not claims of
  complete instruction-transfer compliance.
- The passive observer retains public sessions and candidate files, but not
  arbitrary fixture trace files under `.git/`. Original state checks, exact
  command arguments and exits, and frozen executables support the feedback
  findings. Do not claim those raw trace files were independently retained.
- These routine deliveries provide no new evidence about review or verification
  coordinator internals. Their contracts and routes remain unchanged. No Claude
  comparison or Artificer execution was run. Publication effects were confined
  to fixture remotes and forge commands.
- This is the approved four-case re-verification, not a full twelve-case plugin
  sweep. The two earlier recorder probes remain diagnostics; the other six
  cases were not rerun in this follow-up.

## Setup and validation

All live trials use Codex 0.159.2, the app-server entrypoint, passive owner
observation and a five-thread concurrency limit. The main candidate is
gpt-6-sol/medium; bounded implementation uses gpt-6-luna/medium. The incorrect
Luna owner in existing-PR trial 4 is a retained deviation, not an intended
comparison arm. Each trial ran separately and was inspected before the next
launch. Thresholds were 1.0; manual assessments do not overwrite original
runner grades.

The plugin snapshot retains the name `darrow-ticket-to-pr`; every case's exact
explicit invocation token was verified once. Four dry fixtures passed. All
15 focused deterministic tests passed, including installed Git backend
execution in Codex and Claude package layouts, feedback counterexamples and
commit scope under both Bash invocations. ESLint passed. One bounded independent
review found no material issue; its preflight-timing clarification was applied
and dry-validated before any live trial. Structural skill validation passed.

The forbidden-goal assertion was regraded against retained rejected-feedback
evidence and a counterexample. The accepted-feedback raw trace was not retained,
so its revised oracle was calibrated with focused deterministic tests rather
than claiming a regrade of missing data. These validations are not fresh live
trials.

All **1,299 frozen input hashes** still match. All **30 prior diagnostic result
artifact hashes** still match, and the new twenty trials have 100 result,
analysis, assessment, execution and command artifacts hashed at completion.
All 1,294 source files still match the frozen copy. All twenty jobs finished.
No failed trial was replaced or rerolled. Final documentation validation passed
for 268 pages and 16 plugins; report formatting and `git diff --check` passed.

The final summary helper initially required exact equality between the last
native final and runner response. That check was false only for revoked-approval
trial 5: the runner prepended the exact native follow-up question to the full,
unchanged final. All twenty complete native finals are retained. The original
strict check remains in `final-validation.json`; the directly verified
explanation is in `final-validation-clarification.json`. No runner change or
trial replacement was needed.

All twenty actor trees have complete usage accounting: **16,536,724 tokens**,
including cached input, and **3,914.69 summed candidate wall seconds** (65.24
minutes). Preparation, grading and manual investigation are excluded. Dollar
cost is unavailable. Candidate-reported goal usage covers a narrower interval
and must not replace these whole-tree measurements.

| Case                      | Whole-tree tokens | Summed candidate seconds |
| ------------------------- | ----------------: | -----------------------: |
| `composition-existing-pr` |         5,298,589 |                   956.81 |
| `composition-replacement` |         4,303,293 |                   919.28 |
| `feedback-relay`          |         4,991,780 |                 1,346.49 |
| `feedback-rejected`       |         1,943,062 |                   692.12 |

Evidence lives under `evals/results/ticket-to-pr-fixture-repair-2026-10-04/`:

- `plan.json`, `setup.json`, `inputs.json`, `source.patch` and
  `launcher-execution.json`: frozen scope, candidate and host configuration.
- `invocation-validation.json`, `validation.json`, `assertion-regrade.json`,
  `static-validation.json` and `independent-review.json`: preparation evidence.
- `trials/<case>/<1-5>/`: original results, public capture, analysis and separate
  manual assessment for each trial.
- `reverification-summary.json` and `finish-integrity.json`: final dimensions,
  usage and preservation hashes.
- `final-validation.json` and `final-validation-clarification.json`: source
  consistency, completed jobs, documentation checks and response preservation.

The [earlier investigation](ticket-to-pr-investigation-2026-10-04.md) and
[original Luna failure report](gpt-6-luna-evals-issue-228.md) remain baseline
evidence. Results from different candidates are not pooled.
