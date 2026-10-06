# Ticket-to-PR: current-candidate investigation

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

Follow-up: the approved fixture repairs and four-case n:5 re-verification are
complete in the [repair report](ticket-to-pr-fixture-repair-2026-10-04.md).
The diagnostic results below remain the unchanged 0.5.1 baseline.

Status: all six historical failing cases have one fresh diagnostic trial on the
unchanged candidate. Explicit activation and required supporting-skill reads pass
in all six. The original runner grades are two passes and four failures.

Four intended outcomes were achieved: two recorded handoffs, one completed
delivery, and one correctly blocked revoked approval. Two publication cases
could not reach implementation because their fixtures omit the Git backend.
These are diagnostic observations, not an n:5 reliability result.

Recommendation: repair the fixtures and align stale ownership documentation,
then run the four affected cases with n:5. Keep the recipe as the authority
envelope and Adaptive Goal as the main-thread coordinator. No skill,
fixture, contract or runner changes were made during this investigation.

## Results

All trials use Codex 0.159.2 at medium effort, the app-server entrypoint and passive
owner observation. The mock handoff probes use Luna; real Adaptive Goal
composition uses the adopted Sol main-thread route. These are different case
roles, not a matched model comparison.

| Case                      | Main model | Original grade | Observed outcome                                                                                    | Classification                                                                          |
| ------------------------- | ---------- | -------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `compatible-orchestrator` | Luna       | Pass           | Differently named compatible orchestrator invoked; recipe remains read-only                         | No observed failure within the recorder's scope                                         |
| `unattended-grant`        | Luna       | Pass           | Complete grant receipt forwarded to the fixture orchestrator                                        | No observed failure at this handoff seam; not an Artificer runtime test                 |
| `feedback-relay`          | Sol        | Fail           | Approved strict policy implemented, tests strengthened and passed, one verified commit/PR published | Invalid acknowledgement-count assertion; separate repeated-readiness workflow deviation |
| `feedback-rejected`       | Sol        | Fail           | Revoked approval rejected; no edits or publication; new approval requested                          | Invalid requirement to activate a goal through unresolved preflight                     |
| `composition-existing-pr` | Sol        | Fail           | Stopped before implementation at missing Git executable                                             | Fixture packaging defect; publication unmeasured                                        |
| `composition-replacement` | Sol        | Fail           | Same missing Git executable; replacement publisher never reached                                    | Fixture packaging defect; provider substitution unmeasured                              |

Case IDs in retained evidence have the `ticket-to-pr-` prefix. The other six
colocated cases were not rerun in this diagnostic round. Historical failures
remain in the [original Luna report](gpt-6-luna-evals-issue-228.md); these results
neither replace those trials nor combine with them into a success rate.

## Failure clusters

### 1. Supporting plugin packaging is incomplete

Both existing-PR cases declare Git capabilities through `additional_skills`.
That copies the skill directories into the primary Ticket-to-PR plugin, while
the fixture mounts only the primary plugin's mechanics. The current Git skills
require `../../backend/scripts/run_locked.py` relative to their skill directory.
Ticket-to-PR has no such backend.

The retained commands resolve the documented path under
`darrow-ticket-to-pr/0.5.1/backend/scripts/run_locked.py` and fail with
`No such file or directory`. The replacement trial also lists the installed
plugin directory and confirms the absence. Both coordinators correctly stop;
there is no evidence of an activation miss or forgotten implementation step.

This is an eval composition defect. Production Git mechanics belong to the
independently installed Git plugin. Adding a Git backend to Ticket-to-PR would
violate that boundary. The participant's suggestion to restore Ticket-to-PR's
backend reflects the fixture's invalid installation, not a production remedy.

**Proposed repair:** use the existing `additional_plugins` mechanism for the full
Git plugin. For the replacement case, make the authoritative fixture request
explicitly select the compatible `ship-proposal` publisher, so the newly present
`create-pr` capability does not introduce an unspecified choice. Keep checks for
actual replacement execution, no duplicate PR, preserved commits and observed
remote/forge head identity. This changes the fixture's provider selection; it is
a proposal for discussion, not an implemented change.

### 2. Feedback checks require more than the public contract

**Accepted feedback:** the exact answer was acknowledged twice, both times
successfully and before any production edit. The first call exposed only empty
stdout; the second exposed its full exit result. The fixture command verifies
the exact answer and unchanged source hash on every successful acknowledgement.
The hidden assertion nevertheless requires exactly one discovery and one
acknowledgement row. Neither the repository guidance nor the decision command's
public contract forbids repeating a successful acknowledgement.

The completed implementation returns `strict`, preserves `identity`, strengthens
the acceptance test, passes both tests and publishes one commit. The final
response preserves the full commit, URL, repository, head/base and draft state,
matching the publisher's retained remote and forge evidence.

**Proposed repair:** assert exact answer, original source identity and ordering
before mutation, allowing repeated valid acknowledgements. Keep counterexamples
for changed answers, wrong approval references, changed source and missing
acknowledgement. This is a deterministic state/ordering check; a semantic grader
is unnecessary.

**Rejected feedback:** discovery occurs during read-only preflight. The supplied
approval is then rejected as revoked. The same main thread asks for a new valid
approval and performs no implementation, commit, publication or child launch.
All other checks pass. The sole failure requires a native goal, while Adaptive
Delivery requires resolving missing material decisions before launch and permits
same-thread continuation of retained preflight.

**Proposed repair:** define this case as preflight refusal without goal activation.
It must still submit the actual answer, preserve the refusal, leave the repository
unchanged and request valid replacement authority. A true post-launch feedback
case would need a decision that becomes discoverable only after legitimate goal
activation. The present case does not establish active-goal continuation.

### 3. One workflow deviation and a fixture robustness risk

In the accepted-feedback trial, the coordinator obtains readiness successfully,
then repeats the explicitly one-use fixture command after feedback. The repeated
call fails because the readiness marker already exists. Earlier readiness,
current checks and publication evidence still support the achieved outcome.
Retain this as a composition workflow deviation, separate from task success.
It does not justify adding lifecycle bookkeeping to the Ticket-to-PR recipe.

Both feedback fixtures permit focused test changes, but their commit helper
stages only `src/migration.js`. In this trial the commit agent staged both the
production and test file before invoking the helper, so publication succeeded.
The mismatch remains a fixture robustness risk, not a cause of this failure.
Align the helper with its allowed implementation and verification scope while
preserving checks that reject unrelated committed paths.

### 4. Ownership documentation has drifted

The shipped recipe's continuation section correctly assigns the native goal and
bounded delegation to the main thread. Its specification still mentions a
separate engineering owner in introductory and unattended-entry passages. The
skill and README also describe Artificer continuation without the compatibility
qualification documented for the adopted Adaptive Goal design.

Align those descriptions with main-thread ownership and explicitly retain the
separate Artificer migration limitation. The successful receipt-forwarding probe
does not prove that Artificer can resume this architecture. There is no evidence
that the stale specification wording caused these live failures.

## Repair options

1. **Repair fixtures at the existing plugin boundaries — recommended.** Mount
   the complete Git plugin, explicitly bind the alternative publisher, correct
   the feedback expectations and commit scope, and align documentation. This
   preserves real Git integration and uses the existing runner unchanged.
2. **Use synthetic branch and commit capabilities for publisher substitution.**
   Keep the built-in publication case on the full Git plugin, but isolate the
   replacement case with self-contained fixture providers. This avoids competing
   publishers, at the cost of less real Git integration in that case.
3. **Support selected skills from independently packaged plugins in the runner.**
   A plugin-scoped skill-selection feature could retain Git's mechanics while
   exposing only branch and commit capabilities. It is a broader runner change
   and is unnecessary for this bounded plugin finish.

For option 1, add a deterministic fixture check that exercises the installed
read-only branch entrypoint before spending live trials. Existing fixture tests
passed but did not exercise this installed-package path. Regrade assertion-only
changes against retained evidence where sufficient, preserving original grades;
then run the four affected cases fresh at n:5 on the same adopted routes. Do not
count diagnostic or regraded trials toward the changed fixture's n:5 result.

## Evidence and limitations

- Task success, workflow compliance and evidence remain separate. The unnecessary
  readiness retry remains a defect despite successful delivery. The two packaging
  blockers are not successful publication trials.
- Child assignments and `send_message` contents in the completed delivery are
  encrypted. Their contents remain unknown. Visible child effects and final main
  evidence establish the outcome, not every instruction or handoff field.
- The passive observer copied candidate files and public sessions but not the
  feedback trace files under arbitrary `.git/` paths. The original state checks,
  exact command arguments/exits and frozen executable support the feedback
  diagnoses. Do not claim a retained raw trace that is absent.
- The differently named mock orchestrator's recorder proves an invocation, not
  independent transfer of every logical envelope field. The grant recorder does
  retain its submitted receipt. Neither is full delivery evidence.
- No independent review or verification coordinator ran for these routine tasks;
  this round provides no new evidence about their internals. The successful
  implementation and Git assignments used Luna/medium. The parent used
  Sol/medium and retained its own 663-character native goal.
- No Artificer migration, Claude run, architecture change or runner modification
  was performed. No production GitHub effect was made; publication used fixture
  remotes and forge commands.

## Setup, validation and cost

Frozen source: `0b2fad6cd62e51434c7a624d76a6a69c050d63ff`, Ticket-to-PR
0.5.1, Adaptive Goal 0.24.6. Exact invocation tokens, all six dry setups and
the five-thread concurrency limit were verified. All 1,299 frozen input hashes
still match. Trials ran sequentially, with each failure classified before the
next launch. Original results are unchanged.

Skill structural validation passed. The two explicitly selected deterministic
fixture files passed 10/10 tests. An earlier unqualified Bun test invocation
matched archived copies as well, producing 215 failures and three errors across
46 files, reporting empty source-worktree inventories. That invalid test
selection and the scope of its retained evidence are recorded separately in
`initial-static-test-failure.json`; the exact source of shared-process
contamination was not established. Explicit current-file selection passed
unchanged tests. No live trial used the invalid static selection as validation.

All six actor trees have complete usage accounting: **2,283,719 tokens** including
cached input and **602.90 summed candidate wall seconds** (about 10.0 minutes).
This excludes preparation, grading and manual investigation. Dollar cost is
unavailable. Mock and real-composition costs are not a model comparison.

Evidence is under `evals/results/ticket-to-pr-investigation-2026-10-04/`:

- `plan.json`, `inputs.json`, `setup.json`, `invocation-validation.json` and
  `validation.json`: scope, frozen inputs, host and preparation evidence.
- `trials/<case>/1/`: original result, public capture, analysis and assessment.
- `diagnostic-summary.json`: per-case dimensions, observed routes and cost.
- `finish-integrity.json`: frozen-input check and hashes of 30 result artifacts.
- `static-tests.json` and logs: scoped deterministic validation.

The observer is the unchanged passive observer from the Adaptive Goal work.
The local launch and summary helpers only schedule trials and inspect evidence;
they do not inject developer instructions or change participant requests.
