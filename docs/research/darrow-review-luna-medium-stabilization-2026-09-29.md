# Darrow Review stabilization on Luna/medium

## Scope and accepted decisions

This follow-up starts from darrow-review **0.9.1** at checkpoint
`5de063cf1e6f78ea2c2204ce4f97d83f2243a9df`. The previous
[full sweep](darrow-review-luna-medium-full-sweep-2026-09-29.md) measured
**137/155 task passes** and **153/155 activation/avoidance passes** across
31 cases with five trials each. Those results remain historical evidence.

The candidate is **0.10.6**, following the **0.10.0–0.10.5** diagnostics below.
The user approved a self-contained inline review
that faithfully explains issues without copying the saved report verbatim or
requiring the reader to open a report file. Complete canonical JSON and Markdown
remain available to subsequent verification. Explicit machine responses retain
all data, with object-key order and whitespace free to vary. Legacy review
formats remain unsupported.

The coordinator remains **Codex gpt-6-luna / medium**. The normal independent
readers remain **gpt-6-sol / xhigh**; the route-override case supplies its own
explicit route. Improving the coordinator does not lower reviewer capability.

## Failure clusters and repairs

| Cluster                        | Observed problem                                                                                                                                                                                 | Ownership and repair                                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enclosing goal completion      | Public completion scripts called a hidden grading helper. Other trials stopped at the review report while authorized goal work remained.                                                         | Both fixture and skill defects. Public scripts now validate their own completion conditions. The skill explicitly resumes an enclosing goal after returning review evidence.                                                                    |
| Response presentation          | Exact-copy checks rejected escaping changes, omitted repeated history, and equivalent JSON key ordering.                                                                                         | The user changed the presentation contract. Human responses preserve issues and decisions inline; saved reports still preserve every field. Machine checks compare complete JSON data.                                                          |
| Prior verification history     | Reader preparation derived omitted history from a validated prior artifact, but finalization did not. A regression-only round could lose already resolved original findings.                     | Deterministic helper defects. Preparation and finalization now share prior-artifact validation and derive the same history. Finalization carries resolved originals only where no current state replaces them.                                  |
| Caller input paths             | An extensionless JSON input was treated as a directory or searched under the plugin root.                                                                                                        | Skill defect. Bind inputs to the requested repository and inspect/read the exact supplied path before claiming evidence is unavailable.                                                                                                         |
| Reader handoff                 | The coordinator sometimes rejected its own launches as abbreviated and abandoned accepted independent readers. Native launch bodies were encrypted, so exact prompt mismatch remains unverified. | Observed coordinator failure, with the precise message difference unknown. The new handoff sends a short generated loading command. Complete axis instructions and schema are bound into the validated input and read directly by the reviewer. |
| Advisory presentation          | A correct `continue` artifact was summarized without distinguishing the remaining advisory from the blocking finding.                                                                            | Skill presentation defect. The response must identify the completion effect of every remaining issue.                                                                                                                                           |
| Human-output envelope          | A hidden exclusion check still looked for retired TSV syntax and would miss current machine JSON appended to prose.                                                                              | Eval defect found in the required fresh-context audit. A JSON-aware oracle now rejects actual protocol records in human output while allowing ordinary Markdown and unrelated JSON.                                                             |
| Adjacent review composition    | Adaptive-delivery fixtures searched for canonical review records under `.git`, although current review state is external.                                                                        | Fixture defect. Affected searches and proof validation now use the explicit isolated review-state root. Adaptive-delivery packaging is updated to **0.23.8**; its owner behavior is unchanged.                                                  |
| Skill-read observation         | A yielded command delivered the full body before its final output chunk, which the observer alone inspected.                                                                                     | Runner defect. Recover only earlier chunks bound to the same completed command and actor. Preserve the historical unproved reads separately.                                                                                                    |
| Reader JSON and citations      | Instructions demanded strings for array fields and did not explain citations for an inline objective.                                                                                            | Skill and diagnostic defects. Clarify the schema and permitted citations; give exact array-validation errors for the bounded correction.                                                                                                        |
| Host delegation interpretation | Luna treated permission for skill-requested subagents as a blanket prohibition.                                                                                                                  | Skill clarification. State the explicit reader requirement and preserve actual host restrictions; retain a no-delegation control.                                                                                                               |
| Skill path lookup              | Luna dropped a directory when expanding a host catalog alias.                                                                                                                                    | Skill delivery defect. Advertise the resolved absolute entrypoint through the existing conditional session hook.                                                                                                                                |
| Reviewer override evaluation   | A positive fixture required an unadvertised model; the route oracle could select an abandoned scope.                                                                                             | Eval defects. Use an advertised supported override and bind route checks to the unique finalized scope.                                                                                                                                         |

## Evidence before the final sweep

All live rows below used Codex gpt-6-luna/medium and threshold 100%. Diagnostic
runs used one trial/job; threshold runs used five trials. Early runs used up to
three jobs; expanded activation diagnostics and subsequent campaigns use five.
Raw failures are preserved. A regrade is not a new model trial.

| Candidate/check stage                                         | Trials | Raw task | Activation | Interpretation                                                                                                                                                                           |
| ------------------------------------------------------------- | -----: | -------: | ---------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completion-script and return-boundary diagnostic: clean goal  |      1 |      1/1 |        1/1 | Authorized goal continuation completed.                                                                                                                                                  |
| Completion-script and return-boundary diagnostic: repair goal |      1 |      1/1 |        1/1 | Initial review, repair, verification, and completion succeeded.                                                                                                                          |
| Inline progress/advisory diagnostic                           |      1 |      0/1 |        1/1 | Canonical behavior correct; semantic assertion unnecessarily demanded historical detail.                                                                                                 |
| Inline progress/advisory threshold run                        |      5 |      2/5 |        5/5 | All canonical behavior correct; three responses rejected for unnecessary historical detail. All five pass the corrected semantic proposition; the reversed-blocker counterexample fails. |
| First sweep, stopped at progress/advisory                     |      5 |      3/5 |        5/5 | One blocked handoff and one advisory-label omission. Other three trials passed. These are retained product failures, not regraded away.                                                  |

Assertion calibration also checked equivalent reordered machine JSON, changed
data, surrounding prose, complete inline findings, and omission of a seeded
Spec issue. The new default-presentation check correctly rejects one previously
passing 0.9.1 response that omitted that Spec issue.

The fresh-context skill audit found the stale human-output oracle above and no
production defect in the history/return changes. Its 77 targeted deterministic
checks passed. This audit did not establish live model reliability.

## Deterministic regression checks

Each behavior-changing helper fix was reproduced through its public boundary
before implementation, then passed with the fix. Commands below use the
repository development environment; shipped commands use the frozen runtime
bootstrap.

```sh
uv run --quiet --frozen --group dev --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_finalization.py -k external_history_finalization -q
uv run --quiet --frozen --group dev --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_finalization.py -k regression_only_finalization -q
uv run --quiet --frozen --group dev --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/evals/test_assert_records.py -k human_response -q
uv run --quiet --frozen --group dev --project plugins/orchestration/darrow-adaptive-delivery/backend pytest plugins/orchestration/darrow-adaptive-delivery/backend/tests/test_proof.py -k completion_accepts_current_external_review_state -q
uv run --quiet --frozen --group dev --project plugins/capability/darrow-review/backend pytest plugins/capability/darrow-review/backend/tests/test_reader_inputs.py -k 'inputs_bind_exact_scope or fix_input_preserves_complete or changed_inputs' -q
```

The short-handoff regression initially failed three instruction-delivery checks;
after implementation all **41 reader-input tests** passed. Changed inputs remain
refused, including edits to the bound reviewer instructions.

The subsequent live short-handoff diagnostic passed **1/1 task and activation**.
This is diagnostic evidence, not a stability measurement.

`bun run check:python` passed for every registered package on 0.10.6. The review package
passed **336 tests**, with one PowerShell skip, **97.97% statement** and **96.07% branch** coverage;
adaptive-delivery passed **218 tests** with **97.98% statement** and **96.57%
branch** coverage. The fresh copied review plugin passed all seven public
entrypoints using runtime-only dependencies; its provider transcript was mocked.
Documentation validation and `git diff --check` also passed.

## Final sweep and composition checks

All **31 cases now have a fresh 5/5 task and activation/avoidance batch** on the
unchanged 0.10.6 runtime and skill. The selected coverage batches total
**155/155 task passes**, **145/145 positive activation passes**, and **10/10
negative avoidance passes**. They were assembled from sequential runs and
focused retests, not one uninterrupted clean sweep. Corrected assertions and
their calibration are documented below; historical failures remain retained.

**Two read-only failures remain unresolved.** Pull-request and Standards-only
review each had one unexplained worktree change, followed by two unchanged n:5
batches passing every check with no additional changes observed. Each case is
**14/15 task and 15/15 activation** across those three batches. The second
diagnostic supplies each case's selected coverage row below. The user explicitly
authorized finishing coverage while keeping both original failures open.
Clean repeats do not establish a repair or long-run reliability.

The 31 coverage batches share one runtime/skill digest. Their native audit found
191 accepted gpt-6-sol/xhigh readers and ten accepted gpt-5.6-sol/xhigh override
readers, all with fresh context and no unclassified or unaccepted spawn.
Three complete skill reads were confirmed through the repaired completed-call
output recovery. The unavailable-check case includes one honest preflight block
without a reader; these counts do not imply every positive trial launched one.
The runtime/skill digest is
`52d842d75aa5522b855fde29f9c7233990960c665507bea1d3ff4fb27f8e2c0a`.

| Case                                     | Task | Activation/avoidance |
| ---------------------------------------- | ---: | -------------------: |
| guidance-alternative                     |  5/5 |                  5/5 |
| presentation-default                     |  5/5 |                  5/5 |
| spec-only                                |  5/5 |                  5/5 |
| fix-verification-unavailable             |  5/5 |                  5/5 |
| reviewer-route-override                  |  5/5 |                  5/5 |
| fix-verification-regression-second-round |  5/5 |                  5/5 |
| both-axes                                |  5/5 |                  5/5 |
| empty-diff                               |  5/5 |                  5/5 |
| fix-verification-regression-scope        |  5/5 |                  5/5 |
| fix-verification-resolved                |  5/5 |                  5/5 |
| fixed-point                              |  5/5 |                  5/5 |
| guidance-uncertain                       |  5/5 |                  5/5 |
| guidance-unresolved                      |  5/5 |                  5/5 |
| invalid-base                             |  5/5 |                  5/5 |
| low-noise                                |  5/5 |                  5/5 |
| merge-base-branch                        |  5/5 |                  5/5 |
| neither-axis                             |  5/5 |                  5/5 |
| presentation-blocked                     |  5/5 |                  5/5 |
| pull-request (original failure open)     |  5/5 |                  5/5 |
| read-only-adversarial                    |  5/5 |                  5/5 |
| repair-guidance                          |  5/5 |                  5/5 |
| reviewer-route-unavailable               |  5/5 |                  5/5 |
| standards-only (original failure open)   |  5/5 |                  5/5 |
| value-comparison                         |  5/5 |                  5/5 |
| fix-verification-progress-advisory       |  5/5 |                  5/5 |
| presentation-machine-v1                  |  5/5 |                  5/5 |
| worktree-scope                           |  5/5 |                  5/5 |
| goal-contract-pass                       |  5/5 |                  5/5 |
| goal-contract-repair-verification        |  5/5 |                  5/5 |
| no-trigger-after-edit                    |  5/5 |                  5/5 |
| no-trigger-implementation                |  5/5 |                  5/5 |

### Adjacent composition results

Both checks ran separately with Codex gpt-6-luna/medium as the parent,
`--owner-evaluation passive`, one trial and one job, using adaptive-delivery
0.23.8, verification 0.2.10, and review 0.10.6. They do not count toward the 155
review trials or constitute a full adaptive-delivery sweep.

| Case                                | Task | Activation | Observed owner                   | Result                                                                                                                                          |
| ----------------------------------- | ---: | ---------: | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `goal-verification-existing-review` |  1/1 |        1/1 | gpt-6-luna/medium, fresh context | Initial independent review found the retry-count regression; the owner repaired it and completed after clear closed verification.               |
| `goal-preflight-high-risk-routine`  |  0/1 |        1/1 | gpt-6-luna/high, fresh context   | All implementation, independent-review, exact-target, and completion checks passed. Only the expected Luna/medium owner-route assertion failed. |

The first check took about 14 minutes. Its first follow-up verifier returned
blocked without fresh judgments or a validated verification artifact. The same
owner launched another follow-up and obtained a clear canonical result. The raw
pass is end-to-end evidence with that recovery, not a claim of uninterrupted
provider success. Supporting `verify-change` and `code-review` activation was
observed in both checks. Encrypted owner contracts remain role-unverified in
native receipts; task and authority checks supply the bounded composition
evidence.

The second check exposed an **Adaptive Delivery profile-selection defect**.
Bounded live command inspection showed selection of `routine-plus`, and the
retained native receipt confirms its bundled gpt-6-luna/high route. The current
policy still maps clear, localized work to `routine` and gpt-6-luna/medium;
high consequence risk separately requires review. The case remains valid and
failed. Its actual Standards and Spec reader launches used fresh
gpt-6-sol/xhigh routes, and the canonical review passed. Keep this routing
failure for the planned later Adaptive Delivery investigation; do not weaken
the assertion or change orchestration policy during this review follow-up.

The adjacent checks therefore stand at **1/2 task and 2/2 activation**. The
review component completed in both; the full adjacent gate is not green.

### Remaining failures and recommendation

| Plugin / case                         | Assessment                                                                                             | Recommended next action                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Review / pull-request                 | Original read-only failure remains unexplained; two clean n:5 repeats are not a repair.                | Keep the failure open, retain changed paths and bounded command evidence on recurrence, and preserve the read-only contract.        |
| Review / standards-only               | Same observable failure class, but a shared cause is unproved; two clean n:5 repeats are not a repair. | Keep it open under the expanded capture. Do not invent a skill rule without identifying the write.                                  |
| Adaptive Delivery / high-risk routine | Wrong reasoning profile selected; the current eval expectation is valid.                               | Investigate risk versus reasoning-demand classification when this plugin's planned turn arrives. Retain the failed adjacent result. |

The review candidate has complete n:5 coverage and the known deterministic
repairs are verified. Keep both accepted unresolved review failures visible.
No claim of perfect activation or mutation-free long-run behavior follows from
these samples. No plugin installation was performed as part of these measurements.

### Earlier sweep diagnostics

The short-handoff candidate passed progress/advisory **5/5 task and activation**.
The next case, default presentation, initially scored **1/5 task, 5/5
activation**. Every response explained both seeded issues and the corrected
behavior, but the semantic assertion demanded a separate resolution-check
sentence. That exceeded the accepted semantic presentation contract. The
corrected assertion accepts resolved behavior expressed in repair guidance;
all five retained responses pass calibration, while omitted-Spec and
wrong-domain repair counterexamples fail. The raw 1/5 run remains under
`sweep-final/code-review-presentation-default/`; its fresh retest has a distinct
path under `sweep-final-retries/`. This regrade is not counted as five new passes.

The fresh default-presentation retest passed **5/5 task and activation**, as did
explicit machine output. These three completed cases contribute **15/15 task
and activation passes** before the worktree-scope pause.

### Worktree activation evidence

The first worktree-scope batch passed **5/5 task checks** but only **3/5
activation checks**. Trials 3 and 5 each launched the configured independent
Standards reader and produced the correct read-only review. Their native
compound-command records contained only **50 and 48 characters**, respectively,
without the mounted skill body or frontmatter. The activation checker therefore
had no complete read to accept. Those observations establish missing read
evidence, not whether the model did or did not receive the body elsewhere.

Two subsequent natural single-trial diagnostics passed task and activation.
A diagnostic that explicitly grouped the full skill read and repository
inspection commands into one shell command also passed, so grouping alone does
not explain the misses. Each diagnostic captured the complete body in both the
native command event and the model-visible tool output.

Two repeats of the original **n:5 / jobs:5** conditions with expanded observation
each passed **5/5 task and activation** on the unchanged candidate. All three
matched batches remain evidence: **15/15 task passes, 13/15 confirmed
activations**. These green batches do not erase the two earlier unknown reads
or establish a causal improvement.

The evidence is retained in `sweep-final/code-review-worktree-scope/`,
`activation-boundary-diagnostic/`, `activation-boundary-diagnostic-2/`,
`compound-read-diagnostic/`, `activation-boundary-n5/`, and
`activation-boundary-n5-2/`. The expanded observer
records complete-body presence across model-visible output wrappers as well as
native command events. It retains hashes and metadata; the bounded small-output
diagnostic is restricted to these synthetic fixture reads.

The user chose to **resolve activation evidence before continuing**. A controlled
probe then reproduced a concrete observer defect: a command read the full skill,
yielded after one second, and printed a marker after three seconds. Codex sent
the complete **20,002-character** skill body in the initial tool result for
process `54171`. The completed native command for that same process contained
only the **14-character** final marker. The review passed, while activation
failed because the observer inspected only the completed command's last output.

The runner now recovers earlier exec-result chunks bound by process identifier
to one completed native command in the same actor's session. Normal successful
mounted-read and complete-body checks still apply. Missing, unrelated, late,
partial, and ambiguous output cannot establish a read. Retained diagnostics
distinguish original completion output from recovered chunks without saving
their text. The public adapter regression failed before the change and passed
after it; **91 Codex adapter tests**, **5 runner compatibility tests**, typecheck,
and affected TypeScript lint passed.

Raw evidence lives in `yielded-read-diagnostic/`, including a bounded transport
sample with the public skill body replaced by a marker. This establishes an
observation failure mechanism matching the earlier symptom. The original two
trials' early private outputs are gone, so their individual reads cannot be
retroactively proved or regraded. The fresh controlled diagnostic passed
**1/1 task and activation** with the same split output; its retained diagnostic
confirms the body came from one recovered early chunk. The ordinary worktree
retest then passed **5/5 task and activation** without diagnostic instructions.
These runs are preserved under `yielded-read-fixed/` and `activation-fixed-n5/`.
The sweep resumed only after these checks. Its first three passing cases used
the earlier observer; later cases use the repaired observer, with the same
plugin candidate.

### Goal-continuation follow-up

The first resumed clean-goal batch on **0.10.0** passed **4/5 task and 4/5
activation**, with different trials failing each check. Trial 2 correctly
stopped after the Spec reader's `sources` field remained invalid through the
one permitted correction. The old validation error conflated a wrong JSON type
with an empty required array. Its exact invalid value was not retained.

Inspection found contradictory reader instructions saying every field should
be a string despite the array/object schema. The input's source-file list can
also legitimately be empty when the objective is supplied inline, while the
output's citation list must be nonempty. **0.10.1** clarifies scalar versus
container types in all four reader templates, requires a citation even for a
passing review, and explains inline-objective and baseline citations. Array
validation now distinguishes wrong type from the exact minimum entry count.
Both diagnostic assertions failed before the change; all **106 record/input
tests** passed after it.

Trial 1 completed the goal but lacked complete verified activation. Retained
read commands included partial output and a failed command; neither held the
complete body. Parent diagnostics were suppressed because the review launched
two independent readers. That diagnostic-only suppression is now removed,
without granting single-owner or activation credit. The expanded trial observer
records source coverage and public reader-record field types. A subsequent
unchanged single-trial diagnostic passed both checks and cannot explain or
replace the original failed observation. The five-trial **0.10.1** verification
passed **5/5 task and activation** under `goal-source-correction-n5/`, with a
complete skill body observed in all five trials. The full Python gate passed
again: review now has **325 tests**, **97.95% statement** and **96.07% branch**
coverage. All seven public entrypoints passed the fresh runtime-only installation
check. A fresh campaign, `sweep-0101`, reused this measured clean-goal case and
started the remaining cases on 0.10.1; the following failures paused it.
Earlier 0.10.0 passes remain separate.

### Alternative-repair presentation calibration

The 0.10.1 repair-goal case passed **5/5 task and activation**. The following
alternative-repair case initially scored **0/5 task, 5/5 activation**. All five
canonical verifications correctly accepted the different implementation and
preserved the complete original findings and advice. All responses explained
the resolved behavior. The semantic check still demanded repetition of original
advice as historical prose, contrary to the accepted presentation contract.

The corrected proposition accepts the behavioral explanation without requiring
that repetition. It still rejects demanding the original suggested syntax,
falsely claiming that syntax was implemented, or describing the wrong fallback
value. Calibration correctly classified all **8 samples**: five retained valid
responses and three invalid counterexamples. The raw failure remains under
`sweep-0101/code-review-guidance-alternative/`; a distinct fresh n:5 retest is
under `sweep-0101-retries/code-review-guidance-alternative/`. Calibration does
not count as new model trials.

The fresh alternative-repair retest passed **5/5 task and activation**. Spec-only
review then scored **2/5 task, 5/5 activation**. Its three rejected responses
correctly explained the sole defect and failed verdict, but the grader required
a literal axis label and a repeated citation label for the request given inline.
The clarified presentation invariant accepts a fail verdict tied to one defect
as its blocking effect, and the expected-versus-actual behavior as attribution
to that inline request. Mixed blocking/advisory findings still need individual
distinctions. The corrected check classified **8/8 samples** correctly: all five
retained responses and counterexamples with a passing verdict, vague mismatch,
or wrong required value. The raw 2/5 run is preserved; the fresh retest uses
`sweep-0101-retries/code-review-spec-only/`.

### Conditional delegation policy

The corrected Spec-only retest passed **4/5 task, 5/5 activation**. Trial 3
loaded the complete skill but launched no reviewers. It claimed the session
prohibited subagents. Bounded policy receipts show that this trial received
both the review reminder and the same host rule permitting skill-requested
delegation as the passing trials. Its blocked report is a real coordinator
failure, not a presentation or activation-observer defect.

**0.10.2** makes the skill's explicit reader requirement and the host's
skill-request exception clear in both the main instructions and session reminder.
Actual unconditional restrictions, absent native tools, and launch failures
still block and must be reported with their specific evidence. The fresh
Spec-only n:5 run passed **5/5 task and activation**, with all ten expected
reviewers returning. It is retained under `delegation-clarification-n5/`.
A separate explicit no-delegation control checks the restriction boundary.
That control loaded the skill, made **zero native or observed spawn attempts**,
and reported blocked without substituting coordinator judgment. It used an
explicit user restriction, not an injected unconditional developer policy.
The ordinary Spec-only task checks correctly failed under that changed request;
this is not counted as a passing review trial or canonical-artifact test.
Its evidence is in `delegation-prohibition-control/restriction-check.json`.

The 0.10.2 Python quality gate and documentation checks passed. The next
campaign, `sweep-0102`, reused the measured 0.10.2 Spec-only case and started
the remaining cases on that candidate. The unavailable-check case paused it.
Earlier campaigns remain separate historical evidence.

### Unavailable-check request

On 0.10.2, unavailable fix verification first passed **4/5 task, 5/5
activation**. Trial 4 reported blocked verification but did not execute the
check: it treated the prompt's announced unavailable evidence and request to
report that gap as an instruction not to run it. The unchanged hidden check
requires a real captured `bash external-check.sh` attempt, so that trial failed.

The fixture already models unavailability with a harmless command exiting 127.
The request now asks for the prescribed checks and a verification outcome,
letting the fixture establish the evidence gap instead of announcing the result.
The required capture, blocked status, read-only check, artifact validation, and
inline explanation checks are unchanged. This is a clarified scenario, not a
matched behavior comparison or a regrade of the raw failure. The fresh retest
is under `sweep-0102-retries/code-review-fix-verification-unavailable/`.

### Skill entrypoint lookup

The clarified unavailable-check case passed **4/5 task and activation** on
0.10.2. The failed trial omitted the `darrow-review` directory while expanding
the host catalog's root alias. Its later searches used another wrong root or
insufficient depth, then it loaded a system skill and incorrectly claimed the
review plugin was absent. This is a genuine failed load, not observer loss.
Sibling trial catalogs show the correct alias and path; other trials recovered
from the same initial path mistake by locating the installed file.

**0.10.3** adds the resolved absolute skill entrypoint to the existing conditional
session hook. The path comes from the hook's installed directory; it does not
depend on model alias expansion, a sibling plugin, or a shared runtime. Both
Bash and PowerShell launchers refuse an absent or unreadable entrypoint before
advertising it. The public hook regression failed before implementation and
passed on Bash afterward, including a path with spaces and quotes and an
unrelated invocation directory. PowerShell was not installed and its test was
skipped. The fresh n:5 case passed **5/5 task and activation**, with all five
trials reading the complete skill on their first skill-read attempt. It is
retained under `hook-path-n5/`.

The full Python quality gate passed on 0.10.3: the review package passed
**326 tests**, with **one PowerShell test skipped**, **97.95% statement** and
**96.07% branch** coverage. Documentation validation passed. The new
`sweep-0103` campaign reused only that measured 0.10.3 case and started the
remaining cases on the same candidate, beginning with both negative activation
boundaries. The failures below paused it before full coverage.

### Reviewer-override fixture and scope selection

Both negative activation cases passed **5/5 task and avoidance** on 0.10.3.
The repository-override case then scored **3/5 task, 5/5 activation**. Trial 1
claimed the configured `gpt-5.5/xhigh` route was unavailable without a launch
attempt. Four other trials launched that route successfully. The host's
advertised override list nevertheless omits `gpt-5.5`; a fresh diagnostic
participant reported the same list. The local model cache includes it, so this
does not establish a service outage or universal model unavailability. It does
establish an unsuitable positive fixture for the advertised launcher surface.
The override fixture now selects the advertised, already plugin-supported
`gpt-5.6-sol/xhigh` route. Default readers and production routing are unchanged.
The diagnostic's public catalog statement is retained separately under
`route-catalog-diagnostic/`; it is not a fresh threshold pass.

Trial 5 completed the correct review with both readers, but the route oracle
chose an abandoned preparation directory by lexicographic ordering. The saved
final report identified a different, completed scope. The oracle now binds
route evidence to exactly one finalized review or verification directory and
rejects missing or ambiguous finalization. Three regression checks failed
before this change; all **17 route-oracle tests** passed after it. The original
fixture files are gone, so the retained trial is not retroactively regraded.
The raw 3/5 batch remains under `sweep-0103/code-review-reviewer-route-override/`;
the corrected fixture receives a separate fresh n:5 run.

That fresh override run passed **5/5 task and activation**, including all ten
configured `gpt-5.6-sol/xhigh` reader launches. It is retained under
`sweep-0103-retries/code-review-reviewer-route-override/`. The full Python gate
passed again, with **329 review tests passing and one PowerShell test skipped**.

### Direct delegation instruction

The second-round regression case then scored **4/5 task, 5/5 activation** on
0.10.3. Trial 4 read the complete skill but launched no reader and claimed the
host prohibited subagents. Its bounded receipts confirm the same conditional
skill-delegation policy and session reminder. The other four trials completed
the required independent verification and preserved the original resolution.
This is a recurring coordinator failure; the earlier 0.10.2 clarification did
not eliminate it.

**0.10.4** replaces the long prohibition discussion with a direct instruction
to spawn independent reviewers, placed first in the skill and repeated at the
native launch step. The reminder uses that same instruction. Applicable
higher-priority restrictions still take precedence, and blocked delegation
still requires its specific evidence. The routing reference also uses the
current JSON field names in its blocked-record instructions. A separate
fresh n:5 retest passed **5/5 task and activation**, with all five independent
verifiers launched. It is retained under `delegation-imperative-n5/`. An
explicit no-delegation control checks that the restriction boundary still holds.
It read the skill, made **zero native or observed launch attempts**, and reported
blocked under the explicit restriction. Its ordinary Spec-only task checks
failed as expected for that changed request. The control establishes the
restriction boundary, not a complete canonical blocked artifact. The fresh
31-case campaign is `sweep-0104`; only the measured 0.10.4 regression case is
reused, and all other cases run against this candidate.
The first negative-case attempt was interrupted while checking the control:
the diagnostic's wording classifier initially missed the valid word "forbids".
The actual response and zero-launch receipts satisfy the boundary. That
interrupted negative attempt is preserved separately and is not a threshold
measurement; its replacement uses `sweep-0104-retries/`.

### Launch ordering and missing route coverage

The 0.10.4 campaign completed seven cases with **35/35 raw task and activation
passes**. Native launch inspection nevertheless found an extra inherited
Standards agent in progress/advisory trial 3. It launched before route and
input preparation with `fork_turns: all` and no explicit model or effort.
The later two readers used the correct Sol/xhigh route and supplied the final
verification. Native child-session metadata proves that the extra agent was
actually created; the adapter's `unaccepted` label means it lacked required
route evidence, not that the host rejected the call.

That early launch violates the review contract. The case did not run the
independent route oracle, so its task pass did not establish complete
conformance. Replaying the bounded native evidence through that oracle rejects
this trace and accepts the other four. This is a **5/5 calibration** of launch
classification, not a regrade of the complete artifact checks. A new deterministic
counterexample also rejects an inherited launch followed by valid readers;
all **18 route-oracle tests** pass.

**0.10.5** puts the preparation prerequisites before the opening delegation
instruction and in the reminder: pin scope, capture checks, select the route,
and prepare inputs before the first launch. The progress/advisory case now
checks both complete native routes and rejects extra launches. The 0.10.4
presentation batch was allowed to finish at **5/5** before its campaign stopped.
The fresh ordering retest is `preparation-order-fixed-n5/`. Its initial attempt
was interrupted before measurement to correct the newly added oracle invocation
to use the frozen Python environment; the original snapshot remains retained.

The corrected retest passed **5/5 task and activation**, including the new route
check: ten configured, fresh reader launches and no extra inherited attempt.
The `sweep-0105` campaign reuses only this final-candidate case and runs the
remaining 30 cases on 0.10.5. Its separate audit pauses on axis-tagged native
launch attempts with unaccepted route evidence or inherited context, even when
the case's raw task score passes.

### Completed executor output

Machine-format presentation on 0.10.5 passed **5/5 task, 4/5 activation**.
Trial 1's native command completed successfully with an empty aggregated output.
Unlike the early historical misses, the expanded observer retained proof that
the same actor's model-visible tool result contained the exact complete skill
body. That result's hash also matches a successful sibling's result with the
same read and status commands. This is a confirmed observer miss, not a failed
skill load. The raw batch remains under
`sweep-0105/code-review-presentation-machine-v1/`.

A subsequent unchanged n:5 capture passed **5/5 task and activation** and
retained the redacted transport envelope: a completed executor header followed
by plain text. It has no process identifier, so the earlier yielded-chunk
recovery does not cover it. This unchanged repeat documents the transport and
intermittency; it is not evidence that the observer was fixed.

The runner now also recovers plain completed-executor output when one unique
matching tool call encloses exactly one native command, with no intervening
tool calls, duplicate results, or reused command identity in that actor's
session. Normal mounted-path and complete-body checks still apply. Multiple
commands, unmatched calls, partial text, arbitrary objects, nested result JSON,
and cross-actor output cannot establish a read. Recovery metadata distinguishes
this path from yielded chunks without retaining private tool text.

The public adapter regression failed before implementation and passed after it;
all **94 Codex adapter tests**, the **5 compatibility tests**, typecheck, and
affected lint passed. The fresh live verification uses
`completed-output-fixed-n5/`. No review-plugin instructions changed for this
observer repair.

That fresh confirmation passed **5/5 task and activation**. All five native
command records already contained the body in this particular batch; the
empty-output recovery itself is established by the failing-then-passing
adapter regression against the observed executor format. The campaign resumed
using this fresh machine-format result and the repaired observer. Earlier
passing 0.10.5 cases had complete direct native reads and remain valid evidence.

### Exact caller evidence reads

The 0.10.5 campaign completed eight cases with **39/40 task** and **40/40
activation** passes. The alternative-repair case was **4/5 task, 5/5 activation**.
Its failed coordinator loaded the full skill but claimed the supplied
`.git/verification-input` was an empty directory. The grader successfully read
that exact file as JSON, then rejected the coordinator's invented empty original
set. The retained first command searched ordinary files with a directory glob
for the ignored path; the remaining file-access commands were not retained.
This is a product failure, not an activation failure or missing fixture input.

An unchanged diagnostic batch retained only exact-path filesystem facts and
relevant tool commands. All five inputs were regular JSON files. One observed
coordinator attempted `cat .git/verification-input/*`, then recovered after
listing and reading the exact file. This proves a directory assumption in that
diagnostic trial, without claiming to reconstruct the earlier failed trial's
unretained commands.

That unchanged diagnostic batch finished at **5/5 task and activation**, with
five accepted Spec readers on gpt-6-sol/xhigh and fresh context. It establishes
intermittency and the observed recovery, not a product repair.

**0.10.6** adds `review-result read-evidence --repo ... --input ...` as the first
file-backed fix-verification step. It resolves the exact path against the bound
repository and returns its absolute path and complete JSON object. Directories,
missing or unreadable files, and invalid JSON produce concrete path-specific
errors. Review judgment and record-completeness checks remain in their existing
boundaries. The six public-dispatch regression tests failed before implementation
and passed afterward, including an extensionless hidden file read from another
working directory. A fresh copied plugin also exercised the command with only
runtime dependencies. The original prompt and alternative-repair assertions
remain unchanged.

The fresh 0.10.6 alternative-repair case passed **5/5 task and activation**, with
five configured gpt-6-sol/xhigh readers in fresh context. The complete Python
gate passed: **336 review tests passed, one PowerShell test skipped**, with
**97.97% statement and 96.07% branch coverage**. The `sweep-0106` campaign runs
all 31 cases on this candidate, including new measurements for previously
passing cases.

### Redundant unavailable-check assertion

The 0.10.6 unavailable-check batch passed **3/5 task and 5/5 activation**.
Both failed trials produced valid blocked verification records and explained
the unavailable external verifier correctly. Their retained tracebacks name
line 10 of the Python oracle: `assert record['evidence_gaps']`. The preceding
checks for the exact blocked command and its retained capture had passed.
Bounded artifact observations independently show empty gap arrays in those two
records. This is an eval defect: CR-C20 and the result protocol derive `blocked`
from a blocked applicable check independently of an additional gap entry.

The oracle no longer demands duplicate storage of the same unavailable evidence
in `evidence_gaps`. The normative text now states that distinction explicitly.
It still requires the actual command, applicable blocked status, matching
retained receipt, no invented regression, and blocked outcome. Calibration used
a real exit-127 capture and a schema-valid record with no duplicate gap; it
accepted that record and rejected missing receipt, wrong command, altered check
evidence, false clear outcome, and invented regression: **6/6 classifications**.
The old assertion rejects the same valid record. This calibration is not a
regrade of the two historical artifacts, which were already cleaned up.

The fresh measurement is `unavailable-no-duplicate-gap-n5/`. Only the eval and
clarifying specification changed; the 0.10.6 runtime and skill instructions are
unchanged, so other completed cases remain applicable. Public synthetic result
and check records are now retained for subsequent diagnosis alongside the
bounded transport observations.

### Plain output before native command completion

The corrected unavailable-check case passed **5/5 task, 4/5 activation**. The
missed trial's early model-visible output contained the complete mounted skill.
Its shell command continued into a broad instruction-file search and completed
later with only the search tail retained as native output. The tool envelope
was plain text without the numeric process identifier used by the first
yielded-output repair. The native completion occurred after other tool calls,
outside the span required by the completed-output repair. The skill was loaded;
the observer did not correlate its early text.

A controlled single-trial probe reproduced **task pass, activation fail** using
one awaited literal `exec_command`, `text(result.output)`, and a short sleep
after printing the skill. Bounded receipts prove the early complete body and
one later native completion with the exact submitted command; the completion
contains only `READ_COMPLETE`. No native command-start event was observed.

The observer now also accepts this narrow source-to-completion binding: an
unconditional top-level awaited literal command, direct return of its output,
one unique matching native completion, and the same actor. It rejects dynamic
or conditional code, fabricated or changed output, mismatched working
directories, ambiguous commands or results, and missing completion. Submitted
code alone is insufficient. Recovery retains metadata rather than command or
skill contents and combines later process-bound chunks when needed.

The public adapter regression failed before the fix. All **97 Codex adapter
tests**, **5 compatibility tests**, typing, and affected lint pass afterward.
The controlled live retest is `plain-yield-fixed/`; ordinary confirmation will
follow before the campaign resumes. The earlier natural trial's submitted code
was not retained, so this is a reproduced mechanism and confirmed delivery,
not a retrospective adapter regrade of that trial.

The controlled retest passed **1/1 task and activation**, with its native
diagnostic explicitly confirming literal-command output recovery. The ordinary
`plain-yield-fixed-n5/` confirmation then passed **5/5 task and activation**.
All five ordinary skill reads were present directly in their native output.
Four trials launched the configured Standards verifier; one stopped at the
captured unavailable prerequisite and reported a mechanically blocked attempt
without claiming successful repair verification. All four launches were fresh
gpt-6-sol/xhigh readers. The campaign resumes with this ordinary result; the
controlled probe is excluded from its case totals.

### Direct wrong-value presentation

The override case completed four trials before its fifth stalled. Three passed
task checks; all four passed activation and the exact configured-route checks.
The other completed response identified the unsafe exported mode, the required
safe value, its location, and its blocking effect. The semantic grader rejected
it solely because it lacked a separate recommendation to change the value.
For this direct wrong-value defect, expected versus actual already supplies the
correction and resolution condition under the approved inline contract.

CR-C16 now makes that distinction explicit. Non-obvious repair constraints and
verification conditions remain required. The corrected proposition accepts the
four retained responses and rejects vague mismatch, wrong-value, contradictory
repair, and nonblocking counterexamples: **8/8 calibration classifications**.
The other presentation assertions were inspected; their distinct behavioral
and repair-guidance requirements were preserved.

The fifth trial had no new native activity for **676 seconds** after its last
tool completed. The owned runner was interrupted with SIGINT; the four finished
trials and interruption diagnostic remain retained. Both the candidate snapshot
and original case files were unchanged throughout that partial attempt. This is
an interrupted batch, not a completed n:5 result or a demonstrated skill defect
in the unfinished trial. The exact cause of the stall is unverified.

The fresh full retest is `route-inline-fixed-n5/`. Its only behavioral grading
change is the calibrated semantic proposition; plugin runtime, reviewer route,
read-only checks, and complete canonical-artifact checks are unchanged.

The fresh retest passed **5/5 task and activation**. All ten native readers used
the configured gpt-5.6-sol/xhigh route and fresh context. No trial stalled in
this batch. The campaign resumes with this fresh result; the four-trial partial
attempt and its calibration remain separate evidence.

### Two-axis inline findings

The combined Standards/Spec case scored **0/5 task, 5/5 activation** on 0.10.6.
Every response identified both blocking defects: prohibited console output and
`NaN` instead of `null` for nonnumeric input. All canonical records passed the
reader-authored guidance and complete-artifact checks. The semantic proposition
still demanded a separate suggested repair, causal rationale, constraint,
resolution check, and explicit advisory label for each inline issue. It even
rejected the most detailed response for not naming `Number`.

This assertion exceeded the user's approved self-contained issue explanation.
CR-C16 now clarifies that stating an obvious actual-versus-required behavior
can supply the correction without repeating implementation advice. Proposed
implementations must still preserve their advisory status and relevant
constraints; canonical evidence retains complete reader reasoning. The revised
case accepts all five retained responses and rejects six counterexamples:
either missing defect, wrong required value, a repair that breaks numeric
inputs, a false pass, and logging advice that preserves the prohibited output.
That is **11/11 calibration classifications**, not fresh behavioral evidence.

The fresh n:5 measurement is `both-inline-fixed-n5/`. Runtime and skill bodies
remain 0.10.6 and unchanged. The raw failed batch is preserved under
`sweep-0106/code-review-both-axes/`.

That fresh run passed **5/5 task and activation**. All ten independent readers
used gpt-6-sol/xhigh with fresh context. The campaign resumed with the fresh
result, leaving the raw failure and calibration separate.

### Regression presentation and duplicate assertion

The repair-regression scope case scored **4/5 task, 5/5 activation**. Its failed
response correctly reported `continue`, multiplier 2, `Math.abs` causing
`scale(-2)` to return 4 instead of -4, and the need to restore signed
multiplication and rerun the failing check. All canonical and scope assertions
passed. Rejection for missing separately labeled advisory guidance again
exceeded CR-C16's accepted inline contract.

The corrected assertion accepts those behavioral explanations and still rejects
a missing regression, false clear outcome, wrong sign, reverting multiplier to
1, and widening scope to the unrelated naming TODO. All five retained outputs
and those five counterexamples classified correctly: **10/10 calibration**.
The explicit `repair-guidance` case has the same fixture and formerly identical
presentation assertion as implicit `both-axes`; it now uses that case's exact
calibrated proposition. Canonical reader-guidance preservation checks remain
in both cases. No skill or runtime change was needed.

The fresh regression-scope retest, `regression-inline-fixed-n5/`, passed **5/5
task and activation**, with five accepted fresh gpt-6-sol/xhigh verifiers.

### Grouped resolved findings

Fully resolved verification scored **4/5 task, 5/5 activation**. The rejected
response said all three prior findings were resolved, both blockers were fixed,
the advisory export was removed, checks passed, and no regressions or gaps
remained. Its canonical artifact and both native reviewer routes passed.
Requiring the response additionally to repeat the exact DEBUG and timeout values
contradicted CR-C16's allowance to group resolved findings.

The revised assertion accepts that grouping while rejecting wrong values when
stated, an unexplained verdict or file link alone, unresolved findings, failed
checks, and blocked verification. Five retained responses and five
counterexamples classified correctly: **10/10 calibration**. The fresh n:5
retest is `resolved-inline-fixed-n5/`; runtime and skill instructions remain
unchanged.

The fresh retest passed **5/5 task and activation**, with all ten configured
gpt-6-sol/xhigh verifiers accepted in fresh contexts.

### Remaining defect without historical advice

The unresolved-repair case scored **4/5 task, 5/5 activation**. Its rejected
answer said verification must continue, explained the whitespace-only input
still returned an empty string, identified the original-length check instead
of the trimmed result, and requested another repair. Canonical verification
checks passed. The grader wanted an additional discussion of whether following
the original trim/local-variable advice establishes resolution.

That historical-detail requirement had already been removed from the paired
alternative-repair case and contradicts the accepted presentation contract.
The unresolved assertion now accepts an accurate current diagnosis without
repeating old advice. It still rejects false resolution based on syntax,
an incorrect fallback, an omitted whitespace defect, and a wrong cause.
Five retained responses and four counterexamples classified correctly:
**9/9 calibration**. The fresh run is `unresolved-inline-fixed-n5/`.

The fresh run passed **5/5 task and activation**, with five accepted fresh
gpt-6-sol/xhigh verifiers.

### Check failure versus reader findings

The low-noise case scored **4/5 task, 5/5 activation**. Its rejected response
reported an overall failed verdict, a failed formatting check, and no findings
from either independent review axis. The grader incorrectly treated passing
axes as inconsistent with the overall failure and also demanded a discussion of
the deliberately duplicated auth guard. CR-C10 makes check status an independent
input to the verdict, and the case excludes a centralization demand without
requiring commentary about the guard.

The assertion now states those distinctions explicitly. All five retained
responses passed calibration; false overall pass, centralization demand,
duplicate formatter finding, and omitted check-failure counterexamples failed:
**9/9 classifications**. The fresh n:5 run is `low-noise-inline-fixed-n5/`.
No plugin behavior changed.

The fresh run passed **5/5 task and activation**, with ten accepted fresh
gpt-6-sol/xhigh readers. Trial 1 naturally exercised completed-call activation
recovery: native output lacked the skill body, the matched tool result contained
it completely, and the retained diagnostic confirmed successful recovery. This
adds direct live evidence for the existing observer repair; no new observer
change was needed.

### Pull-request worktree mutation: unresolved

Pull-request review scored **4/5 task, 5/5 activation**. Trial 3 passed review
scope, canonical evidence, native routes, and presentation, but failed the
clean-worktree assertion. The old assertion discarded `git status` output, and
the completed fixture/session was cleaned up. The retained evidence proves a
dirty worktree at grading but cannot identify the changed path or attribute
the write. This is an unresolved read-only failure, not a presentation error.

The fixture now proves a clean starting state and prints changed paths before
comparing the final status. The diagnostic observer records each distinct
worktree status and changed-file hashes during this synthetic case. Neither
change relaxes the read-only expectation. The first unchanged-candidate
diagnostic, `pr-worktree-diagnostic-n5/`, passed **5/5 task and activation**
with all five worktrees observed clean throughout. This clean repeat is not a
fix or an explanation of the original failure. A second focused batch is
`pr-worktree-diagnostic-n5-2/`; it also passed **5/5 task and activation**, with
all five worktrees observed clean throughout. Saved source references did not
identify the historical changed path. Across these three batches the raw
evidence is **14/15 task and 15/15 activation**. The user explicitly chose
“Continue coverage; keep failure open,” overriding the eval-development stop
rule for this failure. The second diagnostic supplies current PR coverage;
the original failure remains open and is neither classified as repaired nor
reassigned to the eval without evidence.

### Standards-only worktree mutation: unresolved

After the user authorized continued coverage, adversarial read-only review,
repair guidance, and unavailable-route handling each passed **5/5 task and
activation**. Standards-only review then scored **4/5 task, 5/5 activation**.
Trial 5 passed every review, route, canonical-artifact, and presentation check,
but its final worktree status had additional content. The old `cmp` check
reported only end-of-file on the baseline, and the fixture was already removed.
The final response claimed no files were modified; that claim does not override
the failed state check. The changed path and writer remain unknown. Similar
symptoms do not establish a shared cause with the PR failure.

The sweep stopped after all five trials. The state assertion now emits the
status diff, and the diagnostic observer records worktree states across every
review case, including bounded commands referring to newly changed paths.
`standards-worktree-diagnostic-n5/` and
`standards-worktree-diagnostic-n5-2/` each passed **5/5 task and activation** on
the unchanged 0.10.6 runtime and skill. Each had five accepted fresh
gpt-6-sol/xhigh Standards readers, five unchanged fixture worktrees, and zero
unexpected statuses. Across the original and two diagnostics, the evidence is
**14/15 task and 15/15 activation**. No product repair is claimed. The remaining
value-comparison, worktree-scope, and progress/advisory state checks also now
print a diff on failure without changing their pass criteria. The user explicitly
authorized continuing the remaining coverage while keeping both original
worktree failures open. The second diagnostic supplies current Standards-only
coverage; it does not establish a repair.

## Evidence locations and limits

Local raw results, snapshots, calibration outputs, and diagnostic logs are
under `evals/results/review-finish-2026-09-29/`. They are gitignored. The earlier
full sweep remains under `evals/results/review-full-sweep-2026-09-29/`.

Native observations retain bounded identity, route, skill-read, and artifact
facts, not full private transcripts. Encrypted native launch messages cannot
be compared with plaintext helper output. The initial diagnostic comparison
using a different installed path was invalid and is retained with that explicit
correction; it supplies no prompt-mismatch evidence. Activation and task scores
are reported separately. This work measures Codex on macOS; it does not supply
new live Claude or native Windows evidence.
