# Ticket-to-PR: main-thread handoff clarification

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

Status: the bounded comparison is complete. **Both cases pass 5/5** for task
success, original automated checks, activation and main-thread ownership.
All ten final outcomes have correct retained publication evidence. One
incorrect intermediate commit summary was recovered and remains qualified.

Recommendation: retain 0.5.3 and close this handoff clarification. The observed
child-owner failure did not recur. Keep the recovered evidence/path mistakes,
encrypted-content gaps and earlier failures documented; this result does not
establish perfect reliability or full-plugin regression coverage.

## Results

| Case                  | Task success | Original grade | Activation | Main-thread goal | Other observed workflow                      |
| --------------------- | ------------ | -------------- | ---------- | ---------------- | -------------------------------------------- |
| Existing PR           | 5/5          | 5/5            | 5/5        | 5/5              | 4 pass; 1 recovered incorrect commit summary |
| Replacement publisher | 5/5          | 5/5            | 5/5        | 5/5              | 5 pass                                       |
| **Total**             | **10/10**    | **10/10**      | **10/10**  | **10/10**        | **9 pass; 1 qualified**                      |

| Dimension, same ten selected trials per candidate | 0.5.2 baseline                 | 0.5.3 candidate     |
| ------------------------------------------------- | ------------------------------ | ------------------- |
| Task success                                      | 10/10                          | 10/10               |
| Original automated grade                          | 8/10                           | 10/10               |
| Activation                                        | 10/10                          | 10/10               |
| Main-thread ownership                             | 9/10                           | 10/10               |
| Complete native final retained                    | 10/10                          | 10/10               |
| Other observed workflow                           | 8 pass; 1 failure; 1 qualified | 9 pass; 1 qualified |

The baseline workflow failure is its child-owned goal, and its qualification is
the no-op branch-preparation timing caveat. The candidate's qualification is
the incorrect intermediate commit identity described below. These are distinct
observations. Its final task and evidence still pass; complete capability
contract compliance cannot be inferred from encrypted assignments.

All candidate main threads ran on Sol/medium, and all observed children ran on
Luna/medium. Every goal was created and completed by the original main thread;
bounded children created no goals. The objectives were 705–1,059 characters.
Every replacement trial invoked the selected `ship-proposal` provider. No
publication was repeated to recover missing wording or evidence.

## Candidate and comparison

Ticket-to-PR 0.5.3 makes the original-thread requirement explicit at the point
where the recipe invokes Adaptive Goal:

- Step 2 is now “Invoke Adaptive Goal once in this thread.”
- The recipe loads and follows the capability's instructions in the current
  main thread, carrying the delivery request and authority envelope.
- It explicitly prohibits launching a child to receive that handoff.
- Adaptive Goal continues to select and delegate bounded implementation
  and capability assignments under its own contract.

The corresponding specification and TPR-C2 were clarified before the skill
edit. Both manifests advance from 0.5.2 to 0.5.3. No description, activation
policy, capability name, route, authority, repair limit or architecture changed.

The baseline is the two publication cases from the
[0.5.2 fixture-repair report](ticket-to-pr-fixture-repair-2026-10-04.md), five
trials each. That selected baseline achieved 10/10 tasks, 10/10 activation,
9/10 main-thread ownership and 8/10 original automated grades. One trial used
a child as the goal owner; another was a semantic completion false negative.
A separate no-op branch-preparation timing caveat remains recorded.

The new candidate received five fresh trials for each of those same cases:
`ticket-to-pr-composition-existing-pr` and
`ticket-to-pr-composition-replacement`. Models, effort, fixtures, checks,
entrypoint, passive observer and host configuration are matched. The source
comparison permits only four changed files: specification, target skill and
both version manifests. Every other frozen source file is identical.

This is a sequential comparison against preserved evidence, not a randomized
simultaneous experiment. Small samples can support keeping a targeted change;
they cannot prove a failure is impossible or establish causation for every
difference between batches. Historical results remain separate.

## Recovered errors and evidence limits

### Incorrect intermediate commit identifier

In existing-PR trial 4, the commit operation returned `401ed97`. The Luna commit
agent's final instead said `401ed979…`, which does not match the actual commit.
The Sol main thread ran `git rev-parse HEAD` and obtained
`401ed9755cac9a1ad83e054fa7c04ac2cd7931bc` before publication. The publisher
verified that full ID against the remote branch and PR; the main final reported
the same correct value.

This is an incorrect intermediate capability handoff with successful recovery,
not a failed delivered outcome. Its workflow assessment remains qualified even
though original automated checks pass. No new rule requires every summary to
copy all metadata verbatim, but a supplied commit identity must be accurate.
The error remains visible rather than being erased by the correct final result.

The same trial's publisher initially resolved its bundled launcher from
`skills/../../backend` instead of `skills/create-pr/../../backend`. It failed
before publication, located the actual file, then ran the prescribed operation
successfully. The retained failed and corrected commands establish the cause.
This is a recovered path error; the complete Git plugin was installed correctly.

Replacement trial 5 recovered from the same relative-path mistake in the commit
assignment. Its commit helper returned an accurate short ID. After a follow-up
confirmed that the helper had emitted only that short form, the main thread
read the full current `HEAD`, reran checks and pinned publication to it. A valid
short hash is not an incorrect handoff simply because later publication needs
the full ID. The publisher's public final says evidence was sent; that message
is encrypted, while its retained command output and the main final agree.

### Publication evidence without an extra wording marker

In replacement trial 3, the coordinator requested the publisher's returned
output through a follow-up. The child returned the original output and noted
that it contained no literal count of open PRs. It did not repeat publication.

The provider's advertised contract supports only the existing open PR. Its
executable queries open PR heads and requires the complete result to equal the
one intended full hash before emitting `publication: verified`. An empty or
multiple-line result would fail that comparison. The retained successful
operation and fixture state establish publication to the single intended PR.
No additional “exactly one” text field is necessary for this outcome.

The main final accurately preserves the full commit, URL and publication
bindings. The encrypted follow-up contents remain unknown; the observed
request for another result and the returned public evidence do not prove every
instruction in that message.

### Scope of the evidence

- Observe ownership through the main thread's native goal activation and
  completion, together with its own goal call and bounded child records.
  A good final answer alone does not prove the correct owner.
- Task success, ownership, workflow and evidence correctness are separate.
  Correct final outcomes do not erase intermediate inaccurate evidence.
- Encrypted assignments and relay messages remain unknown. Their public
  outcomes do not establish complete handoff-field compliance.
- These are routine configuration deliveries. No review or verification
  coordinator ran, so this comparison does not validate their internals or
  review-driven repair. Their capabilities and model routes remain unchanged.
- The feedback cases were not rerun for 0.5.3. Their 0.5.2 results and the
  readiness retry remain recorded in the prior report. The earlier diagnostic
  cases and other plugin cases are not pooled into this comparison.
- Claude execution and Artificer migration remain outside this scope. The
  fixture's remotes and forge commands isolate all publication effects.

## Preparation and validation

The host is Codex 0.159.2 with app-server entrypoint, passive owner observation
and a five-thread concurrency limit. The main candidate is gpt-6-sol/medium;
bounded child assignments use gpt-6-luna/medium. Adaptive Goal stays at
0.24.6. Goal size remains limited to 4,000 characters, with coordination in the
skill.

The snapshot retains the plugin name `darrow-ticket-to-pr`, and both exact
explicit invocation tokens were checked. Both dry fixtures passed. Each live
trial runs separately and is inspected before the next launch. Original
automated thresholds are 1.0; manual assessments preserve the original grade.

One bounded independent skill audit found no material issue. The structural
inspector returned `valid`. The audit separately confirmed unchanged
explicit-only discovery, semantic matching of differently named compatible
capabilities, authority exclusions and the rule against substituting native
goal controls for the capability. It performed no target delivery actions,
Git/GitHub commands or edits.

The unchanged deterministic fixture tests retain their previous 15/15 result;
they were not rerun as if this wording edit changed their mechanics. No Python
source, package or lock changed. Documentation and diff checks passed before
freezing.

The generic `skill-creator` validator initially lacked PyYAML under system
Python. An isolated UV invocation resolved that dependency, then rejected the
existing `disable-model-invocation` frontmatter key. The same invocation rejects
the unchanged 0.5.2 baseline for the same reason; frontmatter is byte-identical.
This validator accepts a narrower metadata set than the dual-host skill uses.
Darrow's inspector passes, and the existing Claude and Codex invocation
policies remain intact. This compatibility limitation is preserved in
`native-validator-compatibility.json`; no metadata or runtime changes were made
to satisfy the generic validator.

An initial experiment-local setup check incorrectly compared appended
`plan.json` and `setup.json` metadata as source files. Restricting the comparison
to the frozen project directory confirmed exactly the four intended changes.
This happened before any live trial and required no candidate or runner change.
The initial diagnostic is preserved in `setup-check-clarification.json`.

## Usage and preservation

Whole-tree usage is complete for all ten candidate trials: **11,152,408 tokens**,
including cached input, and **2,243.78 summed candidate wall seconds** (37.40
minutes). The same ten baseline cases used 9,601,882 tokens and 1,876.08 seconds
(31.27 minutes). This batch used more tokens and time; the small sequential
samples do not establish that the wording caused that difference. Different
numbers of bounded Git assignments and evidence follow-ups contribute to the
observed work. Dollar cost is unavailable.

| Case                  | Candidate whole-tree tokens | Candidate wall seconds |
| --------------------- | --------------------------: | ---------------------: |
| Existing PR           |                   5,347,411 |               1,113.63 |
| Replacement publisher |                   5,804,997 |               1,130.15 |

These times exclude preparation, grading and manual investigation. The
candidate's own goal-usage summaries cover narrower intervals and do not
replace whole-tree measurements.

All **1,299 frozen inputs** and **130 prior result artifacts** still match their
hashes. The ten new trials have 50 result, analysis, assessment, execution and
command artifacts hashed at completion. No failed baseline trial was replaced,
and no candidate trial was rerolled.

Evidence is under `evals/results/ticket-to-pr-main-thread-2026-10-04/`:

- `plan.json`, `setup.json`, `inputs.json`, `source.patch`,
  `launcher-execution.json` and `matched-setup.json`: frozen candidate and
  comparison controls.
- `invocation-validation.json`, `validation.json` and `static-validation.json`:
  preparation and independent audit evidence.
- `trials/<case>/<1-5>/`: original results, public captures, analyses and
  separate manual assessments.
- `reverification-summary.json`, `matched-comparison.json` and
  `finish-integrity.json`: final measurements and preserved artifact hashes.

The [0.5.1 investigation](ticket-to-pr-investigation-2026-10-04.md), 0.5.2
results and [original Luna failures](gpt-6-luna-evals-issue-228.md) remain
unchanged evidence.
