# Adaptive Goal main-thread ownership pilot

> Naming: explanatory prose uses Adaptive Goal. Recorded commands, identifiers,
> snapshots, hashes and artifact paths retain their historical names. See the
> [rename note](adaptive-goal-rename-2026-10-05.md).

The user approved an isolated Codex comparison of the current native subagent
owner (A) and a main-thread native goal with bounded implementation assignments
(D). Production adoption requires a later discussion. Keep review and verification
unchanged, including their internal delegation and reader routing.

## Preserved baseline

Checkpoint `31eb00d0`, the completed 60-trial owner pilot, and the stopped
17-trial transport follow-up remain intact. The latter's three remaining slots
are unrun. Preserve every failure, attribution gap and uncommitted experiment
change. See the [transport report](adaptive-delivery-owner-transport-2026-10-01.md).

## Approved comparison

Use five fresh trials per case per arm, 50 delivery trials total:

- `goal-verification-existing-review`
- `goal-verification-combined-repair`
- `goal-review-repair-verification`
- `goal-steering-without-question`
- `goal-verification-incomplete-blocks-publication`

Match Luna/medium main threads and implementation execution, existing capability
routes, fixtures, common acceptance checks, host version and capacity limits.
Independent review readers retain the capability-selected Sol/xhigh route.
Use passive evaluation, serial trials and interleaved arms. Keep comparison-only
prompt/check adaptations separate from unchanged source cases and raw grades.
Preserve the plugin directory name and verify the explicit invocation token.

Measure task success, capability-contract compliance, evidence preservation,
whole-tree token usage and wall time separately. Dollar cost needs actual pricing;
missing usage or prices remain unknown. Keep assignment omissions, execution
deviations, evidence loss/misdescription and unresolved attribution distinct.

## Host prerequisite

Before preparing the candidate or running delivery trials, test actual native
main-thread continuation in the same headless Codex adapter. The read-only
diagnostic creates a goal, returns an unfinished first-turn checkpoint, then
requires native automatic continuation and one bounded reader before completion.
It sends no explicit follow-up and contains no custom continuation loop.

The goal stays under 4,000 characters. Coordination instructions belong to the
skill; user scope and authority remain in the user context. A host prerequisite
failure stops dependent delivery trials for diagnosis rather than substituting
the separate app-server owner or expanding that experiment.

## Native headless diagnostic result

On Codex CLI **0.159.2**, Luna/medium created one active main-thread goal and
returned the requested first-marker checkpoint. The host started a second native
turn automatically, then interrupted it after **7 milliseconds** as the headless
invocation ended. The bounded reader never ran and the second marker was not
returned. The CLI/adapter reported successful invocation after about 11 seconds;
that is not a completed-goal result.

The existing adapter awaits CLI process exit; it does not issue a stop at the
first final response or manage goal state. Its explicit second-turn path applies
only when a follow-up user prompt was supplied; this diagnostic supplied none.
This is a host lifecycle prerequisite failure, not a measured failure of the
proposed Adaptive Goal skill. Automatic turn start is observed, but completed
automatic continuation is not established in this headless path.

Evidence is retained under `native-goal-probe-2026-10-01T08-54-20.714Z`, including
the request, unchanged harness result, bounded public session evidence and audit.
Account/rate-limit metadata is excluded from token observations.

### Why the CLI exits

The user requested a cause investigation before choosing another entrypoint.
The version-matched OpenAI source (`rust-v0.159.2`) explains the observed lifecycle:

1. `exec` retains the initial `turn/start` response's turn ID. Its notification
   filter accepts turn events only for that initial thread and turn.
2. On `TurnStatus::Completed`, the JSON event processor emits `turn.completed`
   and returns `CodexStatus::InitiateShutdown`. It does not check goal state.
3. The main loop sends `thread/unsubscribe`, breaks, then calls
   `client.shutdown()`. That shuts down the embedded app-server runtime, whose
   cleanup includes shutting down its threads.
4. The normal text event processor also returns `InitiateShutdown` on turn
   completion. Removing `--json` does not change this lifecycle.

Sources: [initial-turn filter and shutdown](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/exec/src/lib.rs),
[JSON completion handler](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/exec/src/event_processor_with_jsonl_output.rs),
[client shutdown](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/app-server-client/src/lib.rs),
[runtime cleanup](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/app-server/src/in_process.rs),
and [text completion handler](https://github.com/openai/codex/blob/rust-v0.159.2/codex-rs/exec/src/event_processor_with_human_output.rs).

This is an initial-turn completion boundary in the CLI client. The native goal
scheduler started another turn before client shutdown interrupted it. The exact
7 ms interval is observed timing, not a configured timeout. Successful exit
reflects the initial turn; it does not establish completion of the persistent goal.
The runner waits for process exit and removes temporary state afterward. Stdin
is consumed during prompt preparation, before the initial model turn; it is not
an ongoing continuation control channel in this path.

The causal explanation combines the retained native timeline with the tagged
source. It is not a new runtime shutdown trace or a completed continuation test.
The original diagnostic, failures and audit remain intact. Source copies, line
references and hashes are retained in `exec-lifecycle-source` beside the probe.

### Approved entrypoint and retest

The user approved implementing the app-server eval entrypoint and retesting the
prerequisite. It is an opt-in path in the existing Codex adapter; normal exec
runs keep their entrypoint. It reuses fixture isolation, installed plugin setup
and native evidence readers, pins the requested main-thread model/effort, and
leaves goal creation and delegation to the participant. The client submits no
automatic continuation prompt and never mutates goal state. Review and
verification capabilities and the production Adaptive Goal skill are unchanged.

Both Luna/medium native probes completed successfully on Codex 0.159.2:

| Probe                                            | Time   | Main-thread turns | Client user turns | Bounded readers | Goal size      | Completion evidence                                            |
| ------------------------------------------------ | ------ | ----------------- | ----------------- | --------------- | -------------- | -------------------------------------------------------------- |
| ------------------------------------------------ | ------ | ----------------- | ----------------- | --------------- | -------------- | -------------------------------------------------------------- |
| `app-server-goal-probe-2026-10-01T11-49-13.536Z` | 28.3 s | 2                 | 1                 | 1               | 545 characters | Both markers, native goal complete, completing final preserved |
| `app-server-goal-probe-2026-10-01T11-54-23.543Z` | 35.8 s | 2                 | 1                 | 1               | 707 characters | Both markers, native goal complete, completing final preserved |

The native logs bind each reader to its original main thread and confirm
Luna/medium on the reader. Neither run contains an interrupted turn. Each keeps
the unfinished first checkpoint and the completing final response. Per-thread
usage is retained; dollar cost remains unknown. These are host diagnostics,
not delivery trials or evidence that the ownership architecture improves outcomes.

The required fresh-context eval audit found a terminal race: malformed protocol
after a successful final readback could be reported as success. The client now
checks settlement and drains output before accepting success. Two protocol
regressions cover malformed trailing data and a late root error. The second live
probe used that repair. The initial probe and original exec failure are retained.

Checks passed: 12 protocol tests, 66 focused existing Codex tests, five command-level
runner compatibility tests, TypeScript
typecheck, scoped lint, documentation validation and diff whitespace checks.
An earlier test invocation used Bun's substring filters and also selected frozen
copies beneath ignored results; exact `./evals/runner/...` paths resolved the
selection problem. No frozen input was edited.

### Comparison preparation

The isolated D candidate is prepared at experiment version 0.23.17. Control A
retains 0.23.14. D retains the shared preflight, readiness, workflow/risk
selection and capability bindings, with main-thread goal ownership and bounded
implementation and capability assignments. Coordination stays in the skill;
the goal contains outcome and completion criteria within 4,000 characters.

Control A matches all 132 retained files of the previous frozen native control.
The copied review and verification capabilities match all 106 and 33 production
files respectively. Both arms use the same frozen app-server runner, fixtures,
Luna/medium main and implementation routes, and unchanged reviewer routes.
All five fixtures build successfully. Comparison copies preserve all task and
semantic checks; only ownership-specific prompt wording and transcript assertions
are adapted. Original snapshots and runner ownership grades remain available.

The installed-skill probe `skill-invocation-probe-2026-10-01T12-08-25.653Z`
completed successfully. Its retained native input observation proves byte-exact
injection of the installed A skill body through the intended explicit token.
This establishes skill delivery through the entrypoint, not capability compliance.

The required fresh-context candidate audit found two material gaps. Before freeze,
the candidate regained the rule to observe ambiguous external effects before
retrying, and the input inventory gained the imported evidence-filter dependency.
The packaged skill inspector passes. There are 644 frozen inputs; each trial
checks their hashes before launch. The prior experiments remain untouched.

### Early trials and a grading repair

Four combined-repair trials are complete: A passes 1/2 common task checks and D
passes 2/2. A's first owner omitted the `verification` command argument, received
usage help and then incorrectly reported missing fixture inputs. A fresh
deterministic diagnostic proves the documented fixture invocation works. Preserve
that execution failure, its interrupted follow-up turn and incomplete usage.

Both D trials created and completed main-thread goals (912 and 843 characters),
with separate assessment, repair and follow-up assignments on Luna/medium.
Neither needed an automatic second main-thread turn. Their user-facing reports
omit complete assessment evidence and target references, so functional success
does not establish full reporting compliance. Native encrypted messages leave
internal handoff attribution partly unverified.

The first real-review A trial passes activation and repairs the candidate, but
its raw task grade fails on an eval defect. Two initial reports share a target
while carrying different finding sets. The provider's public validator matches
exactly one to the follow-up; the fixture's target-only lookup rejected both as
ambiguous. The repaired lookup delegates complete original-finding validation to
the unchanged provider. It accepts matching evidence among unrelated records and
still rejects missing/changed findings and stale content. Retained artifacts and
counterexamples pass, along with 23 focused tests and the full Python quality
gate (224 Adaptive Goal tests). Both manifests advance to 0.23.18 for this
eval-helper repair; the production orchestration skill is unchanged.

The frozen A/D candidates, participant fixtures, runner and capabilities remain
unchanged. Grading revision 2 replaces only the hidden proof helper after the
participant returns, with 648 input hashes and explicit provenance. The original
real-review trial remains preserved and needs a fresh corrected-grader trial for
the n:5 comparison; artifact regrading cannot reconstruct its deleted worktree.

That trial also has genuine composition deviations: verification initially ran
review internals, then duplicated the assessment through a provider; its summary
mixed the two records' severity. Follow-up returned review's report instead of
verification's combined assessment. All readers used Sol/xhigh, so these are
separate from a reviewer-model downgrade. The separate initial provider coordinator
also used Sol/xhigh; preserve actual internal routes in later comparisons.

The first corrected-grader D real-review trial passes common task checks and
composed activation. The main thread kept a 524-character goal, delegated a
separate repair, and received complete initial and follow-up combined assessments.
Both verification coordinators used separate review providers; all three
independent readers used Sol/xhigh. Original finding identity and current target
were preserved, and no actor was interrupted. The main final accurately described
the finding, repair, checks, clear verification and one-of-two repair accounting,
with links to both reports. It condensed the assessments, omitting target IDs,
severity and the check's limited coverage; preserve that presentation gap.

This trial took 671.4 seconds with 2,861,170 cumulative tokens across nine observed
actors, including cached input. Its reported goal usage of 221,422 tokens covers
a different scope and must not substitute for whole-tree usage. Dollar cost
remains unknown. It completed within one main-thread turn and therefore adds no
automatic-continuation evidence beyond the prerequisite probes.

The fresh corrected-grader A real-review trial also passes task and activation.
Its first verifier incorrectly bound review to Luna/medium and blocked on the
correct Sol/xhigh resolver output. The parent prompted the same owner to recover.
A second initial assessment used Sol/xhigh readers, then the owner repaired the
candidate. Follow-up needed a second turn after ambiguous scope lookup; the owner
retrieved exact artifact paths from the earlier verifier. Both successful
assessments ran review internals inside verification rather than invoking a
separate provider. Follow-up returned substantive criterion coverage and the full
review report but omitted verification's required renderer. Final evidence and
repair accounting survived. The eight actors used 4,122,648 cumulative tokens
over 1,017.0 seconds, without interrupted turns. Encrypted assignments prevent
attributing the initial artifact gap to omitted versus ignored launch instructions.

The first focused repair pair is complete. D passes all common task and activation
checks, preserves the required two-export shape despite advisory guidance, and
coordinates separate initial/follow-up provider assignments. Both combined results
are rendered. Its final condenses the assessments and omits target/report references.
A broad state search caused one command event to exceed the observer's two-million-
character cap; retain that truncation and leave aggregate usage incomplete. Duration:
353.2 seconds; six actors; 689-character completed main-thread goal.

A passes deterministic state/sequence checks and activation but fails completion.
Its owner rendered and returned a complete combined clear assessment. After two
parent follow-ups, it asserted the result was unavailable and withdrew completion;
the parent then reported blocked. The retained renderer stdout and first owner
final establish that the result existed. Native encrypted follow-ups prevent
separating parent-message effects, context handling and model retrieval failure.
Record this as lost or misdescribed completion evidence with that attribution gap,
not a proven transport defect. A also executed provider mechanics inline. Its two
actors completed normally in 405.8 seconds, using 637,301 cumulative tokens.

The first steering pair has opposite outcomes. A passes, retaining the same owner
through the two explicit user turns and acknowledging the implementation window.
D pauses correctly and receives the second user turn, but skips the required
initial window inspection. It prints only stdout from a failed `windowctl open`,
then implements directly in main and completes the goal. Thus both a repository
prerequisite and D's bounded-implementor rule are lost after steering. The
app-server retains the unchanged-worktree boundary and both root turns. A uses
123.9 seconds and 641,523 cumulative tokens; D uses 82.0 seconds and 450,934 tokens.

Both first incomplete-verification trials fail to obtain the assessment while
correctly withholding commit/publication. They search the callable-tool registry
and repository files but never attempt the advertised shell protocols. A fresh
diagnostic of the frozen fixture confirms both commands resolve on the supplied
PATH and return the expected incomplete combined result. Preserve the unsupported
availability claims as execution failures. D completes three root turns from a
single client user turn, then marks its 697-character goal blocked. This supplies
real delivery evidence of native continuation, despite task failure. A takes
106.9 seconds and 407,784 tokens; D takes 149.2 seconds and 803,677 tokens.

The second real-review pair also passes common task checks. D's two verification
coordinators both absorb review-provider internals; A separates the initial
provider but absorbs the follow-up provider and omits the follow-up combined
assessment renderer. All actual independent readers still use Sol/xhigh. D's
fix reader misinterprets the supplied comparison between two diff files, claiming
the repair changed timeout and preserved retry. The actual repair changes retry
and preserves timeout. That inaccurate provenance survives into retained review
and verification results despite structurally valid target binding. A's reader
describes the repair correctly. Preserve this semantic evidence defect separately
from the task grades. D takes 615.9 seconds and 3,745,373 tokens; A takes 618.6
seconds and 3,067,110 tokens. Neither tree has an interrupted turn.

The second D focused-repair trial passes common task checks, with separate initial
and follow-up provider assignments and rendered combined assessments. Its bounded
implementor preserves the two-export constraint and main refreshes the checks.
The final accurately summarizes the repair, original finding, limited check
coverage and one-of-two accounting with report links, while condensing complete
assessments and target identifiers. The 813-character goal completes; six Luna
actors finish normally in 395.1 seconds, using 1,256,731 cumulative tokens.

The second A focused-repair trial repairs correctly and obtains a clear provider
result, but blocks at the handoff. The provider receives an absolute report path
and shortens it to a relative path in its final. Verification refuses the incomplete
handoff; neither it nor the callers request the missing absolute path. This is
observed loss of usable evidence and missed recovery, distinct from A trial 1's
loss of an already rendered result. Both assessments use separate providers.
Six Luna actors finish normally in 382.9 seconds, using 1,200,649 tokens.

Both second steering trials pass common task checks. D preserves the pause,
delegates implementation after feedback and correctly opens the required window;
its implementor redundantly retries opening the already-open window before checking
its state. A retains its same owner throughout. A's raw architecture check rejects
the parent's `list_agents` observation, although retained calls show no parent
repository work after acceptance. Preserve that allowlist mismatch in the raw
grade; the comparison already excludes the assertion symmetrically. D takes
140.0 seconds and 784,468 tokens; A takes 89.3 seconds and 394,300 tokens.

The second incomplete-assessment pair repeats the first pair's failure. Both
architectures search the model tool registry rather than executing the advertised
shell protocols, then incorrectly report them unavailable. Local changes and
checks succeed, and publication remains blocked. D again uses three native root
turns from one client user turn before blocking its goal. A uses an owner follow-up
to supply fuller status. D takes 202.7 seconds and 893,042 tokens; A takes 172.6
seconds and 711,520 tokens. The frozen-fixture command diagnostic still establishes
that the missing assessment is an execution error.

### Partial comparison checkpoint

These are common task grades, excluding preserved ownership-specific assertions
symmetrically. They do not establish capability-contract compliance.

| Case                                     | A: native subagent owner | D: main-thread goal |
| ---------------------------------------- | ------------------------ | ------------------- |
| Existing candidate with real review      | 3/3                      | 3/3                 |
| Combined repair                          | 1/2                      | 2/2                 |
| Focused repair and reassessment          | 0/2                      | 2/2                 |
| Steering between user turns              | 2/2                      | 1/2                 |
| Incomplete assessment blocks publication | 0/2                      | 0/2                 |

Status: stopped at the user's requested safe boundary after 23 live trials,
22 with valid task grades (A 6/11, D 8/11). The original invalid-oracle trial
remains additional evidence. The third real-review pair passes task checks:
D retains a separate initial provider but absorbs follow-up review internals;
A preserves both provider boundaries. D recovers a mangled reader-input path
through a diagnostic continuation; A needs three owner turns to deliver full
completion evidence. Both preserve rendered combined results and all actual
readers use Sol/xhigh. D takes 718.5 seconds and 4,667,924 tokens; A takes 784.1
seconds and 3,566,668 tokens. No actor is interrupted in either trial.

The remaining A repetitions are unrun. All failures, capture limits and encrypted
launch attribution gaps remain. No architectural improvement is established.
The user authorized a [D/E main-thread model comparison](adaptive-delivery-main-thread-model-2026-10-01.md),
reusing eligible D trials and retaining A as additional context. Production
adoption remains a separate decision.

Local evidence: main-thread pilot (`evals/results/adaptive-main-thread-owner-2026-10-01/`).
