# Adaptive Delivery main-thread model comparison

Completed all 50 comparison slots: D (Luna/medium main) passed 18/25
task checks; E (Sol/medium main) passed 24/25. Sol recovered more
composition failures, but capability compliance remains incomplete. Discuss Sol as
the preferred main-thread candidate for the next iteration; production adoption
remains a separate decision.

Only the main model differed. Bounded implementors and capability coordinators
remained Luna/medium; real independent readers remained Sol/xhigh. Eleven valid D
trials were reused, including failures. Every baseline failure and attribution gap
was retained. No participant wording or capability implementation changed.

## Final task results

| Case                                     | D: Luna/medium | E: Sol/medium |
| ---------------------------------------- | -------------- | ------------- |
| Real review composition                  | 5/5            | 5/5           |
| Combined repair                          | 5/5            | 5/5           |
| Focused repair verification              | 3/5            | 5/5           |
| User steering                            | 4/5            | 5/5           |
| Incomplete assessment blocks publication | 1/5            | 4/5           |
| **Total**                                | **18/25**      | **24/25**     |

The E incomplete-assessment ordering failure remains in these frozen scores; see the eval concern below. Task scores exclude only the two predeclared separate-owner architecture assertions, symmetrically for D and E. Original raw grades remain retained.

## Separate evidence and compliance results

| Measure                                                      | D               | E              |
| ------------------------------------------------------------ | --------------- | -------------- |
| Capability compliance: pass / fail / unknown (20 applicable) | 3 / 14 / 3      | 10 / 5 / 5     |
| Evidence correctness: pass / fail / unknown (25)             | 14 / 11 / 0     | 22 / 3 / 0     |
| Evidence preservation: pass / fail / unknown (25)            | 16 / 6 / 3      | 19 / 1 / 5     |
| Observed role routes matched                                 | 25/25           | 25/25          |
| Maximum goal length                                          | 1104 characters | 945 characters |
| Native terminal goal: complete / blocked                     | 19 / 6          | 20 / 5         |

Capability compliance combines the observed workflow obligations with required report preservation. Encrypted delivery claims are unknown. The five steering trials per arm select no assurance capability. Correctness is measured independently across implementor, assessment and final claims; a minor identity or timing error is distinguished from a false implementation verdict below.

Final compliance aggregation also applies the frozen candidate-binding/reporting obligations to D focused repair 3 (incorrect current blob) and D combined repair 5 (incorrect full-report reference). Their original mechanics-pass assessments and correctness failures remain unchanged; the derived classifications are explained in `compliance-notes.json`.

## Whole-tree usage and time

| Measure                                    | D          | E          |
| ------------------------------------------ | ---------- | ---------- |
| Candidate wall time, all 25 (sum)          | 126.30 min | 148.59 min |
| Candidate wall time (median)               | 189.6 s    | 232.7 s    |
| Outer runner time including grading (sum)  | 130.31 min | 152.47 min |
| Complete whole-tree usage captures         | 24/25      | 24/25      |
| Total recorded tokens, known captures only | 35,601,200 | 42,187,498 |
| Input tokens, known captures only          | 35,293,314 | 41,853,322 |
| Cached input tokens (subset of input)      | 32,706,560 | 39,185,280 |
| Output tokens, known captures only         | 307,886    | 334,176    |
| Median whole-tree tokens, known captures   | 859,679    | 1,112,767  |
| Dollar cost                                | Unknown    | Unknown    |

These counters include all captured native descendants, after excluding copied ancestor turns. Cached input is already included in input; it is not added again. D focused repair 1 has truncated capture. E incomplete assessment 1 interrupts an extra assessor. Neither trial is assigned an estimated token total. The remaining known sums are not full-arm totals or billed cost.

| Case                                     | D median time | E median time | D median tokens (coverage) | E median tokens (coverage) |
| ---------------------------------------- | ------------- | ------------- | -------------------------- | -------------------------- |
| Real review composition                  | 683.2 s       | 718.7 s       | 3,745,373 (5/5)            | 4,163,648 (5/5)            |
| Combined repair                          | 165.0 s       | 219.8 s       | 650,206 (5/5)              | 934,662 (5/5)              |
| Focused repair verification              | 357.3 s       | 381.0 s       | 1,225,453 (4/5)            | 1,505,364 (5/5)            |
| User steering                            | 140.0 s       | 119.4 s       | 572,611 (5/5)              | 560,109 (5/5)              |
| Incomplete assessment blocks publication | 178.1 s       | 199.0 s       | 893,042 (5/5)              | 1,085,920 (4/5)            |

For the 23 corresponding case/round pairs with complete usage on both sides, recorded tokens sum to 34,797,523 for D and 40,458,600 for E (16.3% difference). Across all 25, E candidate wall time is 17.7% higher. Early blocking can reduce work, so these are descriptive resource comparisons, not equal-output efficiency or dollar-cost claims.

## What the comparison shows

Sol is the stronger main-thread candidate in this sample. The clearest evidence is
recovery: it obtains the real incomplete assessment in all five trials and clears
several recoverable report-path or rendering failures. That supports the hypothesis
that a stronger coordinator can retain obligations while Luna performs bounded
implementation. It does not establish reliable capability-contract compliance.

Both arms reach 5/5 task success for real review composition and combined repair.
Those task checks are insufficient to establish correct composition: provider
boundaries, complete handoffs and precise evidence still fail. No observed actor
route changes explain the D/E outcome difference. Real independent readers remain
Sol/xhigh; implementation and capability coordinators remain Luna/medium.

### Failure groups and recommended follow-up

| Group                                                        | Observed cases                                                                                                     | Assessment                                                                                                                                                                                                                                                   | Recommended discussion after this comparison                                                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Available shell protocol mistaken for absent registered tool | D incomplete assessment 1–4 never recover; D 5 recovers in main; E recovers through its assessor                   | Participant discovery/composition failure. The existing protocol is available; claiming it is unavailable does not establish the real acceptance gap.                                                                                                        | Prefer the Sol main-thread candidate for the next controlled iteration. Discuss how main requests correction of a capability's incomplete result while leaving capability execution with its coordinator. |
| Capability boundary collapsed                                | D real review 2–3, combined repair 3, focused repair 4, incomplete assessment 5; E real review 1–4                 | Composition contract failure. Verification sometimes launches readers or invokes a provider itself; D combined 3 executes both coordinator jobs in main, and D incomplete 5 invokes assessment in main. Reader models alone do not prove correct separation. | Decide the smallest main-thread acceptance check for capability assignment/result boundaries. Keep review and verification internals unchanged during that discussion.                                    |
| Incomplete or misrepresented report handoff                  | D combined 4–5 and focused repair 5; E focused repair 2                                                            | D combined 4 definitely drops reports; D combined 5's complete-delivery claim is encrypted but its visible full-report reference is wrong. E focused 2 shortens required output. D focused 5 does not recover a relative path.                               | Define which evidence main must receive or request again before accepting a capability result. Distinguish a concise user response from the capability's unchanged full-report obligation.                |
| Incorrect evidence details                                   | D real review 2, focused repair 3, combined repair 4–5, incomplete assessment 5; E real review 1 and 5, steering 4 | Incorrect repair description, truncated current identifier, inaccurate artifact or repeated-invocation claim, implementor claim about the Git-base diff, or misleading time. These differ in severity; not all invalidate the implemented candidate.         | Retain separate correctness checks and discuss candidate-bound evidence validation. Do not replace them with task-pass counts.                                                                            |
| Obligations lost in final completion response                | D focused repair 3 and 5; D steering 1 also misses the required window acknowledgement                             | Main-thread execution/presentation failure. In D focused 5, the first final has finding and repair count; native continuation's terminal final loses them.                                                                                                   | Main should carry the originating acceptance and required terminal evidence through native continuation. No custom continuation loop is indicated by these results.                                       |
| Formatting-only contract deviation                           | D real review 4                                                                                                    | Initial verifier adds 36 inline-code backticks to an otherwise identical renderer result. Evidence is correct and preserved.                                                                                                                                 | Discuss whether that strict return-format contract is useful before changing it. Keep this failure distinct from omitted evidence.                                                                        |
| Ordering assertion rejects an already valid sequence         | E incomplete assessment 4                                                                                          | Eval concern plus unnecessary extra provider work. Frozen task failure retained.                                                                                                                                                                             | Repair and re-verify the assertion separately after discussing the intended duplicate-call contract. Do not silently relabel this comparison's score.                                                     |

### Observable recovery

E incomplete assessment trials 1–4 initially end an assessor turn with an incorrect
unavailable-protocol explanation. Sol requests correction in the same assessor
context; the actual service then returns the coverage gap. Trial 5 shows in-flight
recovery instead: unproductive registry searches, an encrypted assessor status,
an encrypted main reply, then shell resolution and successful invocation. The
sequence supports recovery but does not reveal the exact messages or prove which
instruction caused the change. Trial 1 unnecessarily starts an extra assessor
and interrupts it; that trial's whole-tree usage remains unknown.

Sol also recovers a repeatedly mistranscribed report path and missing combined
renderer in real-review trial 1, a misplaced provider reference in real-review
trial 4, and a truncated directory name in real-review trial 5. In combined repair
trial 5, the initial assessor's short public final is followed by a main request
and a complete public report. Its follow-up handoff is still encrypted, so that
trial's overall preservation remains unknown. Earlier combined trials contain
similar requests without publicly inspectable complete delivery.

Luna also recovers some local helper-path and redundant-window operations. Those
incidents are not equivalent to recovering a missing capability result. In focused
repair trial 5, the provider's service output contains the absolute report path,
but its public final gives only a relative path. Verification exposes the missing
reference and returns no rendered follow-up. Main makes no correction request,
repeats the blocker over three native turns and blocks. Publication is safely
withheld, but the recoverable handoff remains unresolved.

There is no meaningful single recovery percentage: incidents differ, some trials
have none, and encrypted messages leave gaps. Per-incident outcomes remain in each
trial's `assessment.json` and `classification.md`.

D incomplete assessment trial 5 is a distinct recovery. During native continuation,
main finds the shell protocol and runs the assessment itself after its assigned
assessor refuses. The actual coverage gap is obtained and publication is correctly
withheld, so the frozen task passes. The assessor is never resumed: main absorbs
its job, violating the tested architecture. The final also says the service returned
the result repeatedly, while retained calls and gate events show one actual
invocation. This is evidence that Luna can recover discovery, but not that it
preserves the capability boundary during recovery.

### Evidence correctness and preservation

E real-review trial 1's combined assessment incorrectly attributes a timeout change
to the repair; the actual repair changes only retry from 0 to 3. Main's final
description is accurate. In E real-review trial 5, the implementor incorrectly says
both values changed relative to Git base; subsequent verification and main correctly
separate the timeout-only base diff from the retry-only repair. That incorrect
intermediate claim stays recorded.

E focused-repair trial 2 reduces a required 2,817-character combined renderer result
to 926 characters, dropping original/current provider targets, mode, compatibility
and closed-history details. The remaining claims and saved reports are sound, but
the required handoff fails. Main accepts it. D combined-repair trial 4 similarly
shortens reports and claims a two-row invocation-history file contains the complete
combined result. There are no encrypted assessor messages in that trial that could
supply the missing content. D combined trial 5 points to a review-only result as
the full combined result; it contains neither the QA outcome nor the combined
assessment. Both failures remain separate from task success.

E steering trial 4 says delivery took 32 seconds, using a pre-pause native goal
counter despite 119 seconds of measured candidate time. That is a timing correctness
failure, not a steering task failure. Trials explicitly labelling their limited
counters as goal-recorded usage/time are distinguished. Whole-tree measurements
in this report come from retained actor counters and harness time.

### Frozen eval concern

E incomplete-assessment trial 4 retains this event order:

```text
check passed
check passed
verification invoked
review returned clear
verification returned incomplete
review returned clear
```

The required sequence occurs and the combined service runs once. The assessor then
performs an unnecessary standalone review. The frozen assertion overwrites its
recorded review position with the last review event and rejects the earlier valid
sequence. Task remains failed; the actual incomplete assessment is preserved and
publication is correctly withheld. Neither fixture nor checker was changed for
this comparison. This is not evidence that Sol produced a false clearing verdict.

## Preserved A context and attribution limits

The stopped separate-owner A arm remains 6/11 task successes: real review 3/3,
combined repair 1/2, focused repair 0/2, steering 2/2 and incomplete assessment 0/2.
Its candidate wall time totals 4,139.166 seconds; 10 complete usage captures total
15,208,888 recorded tokens and one is unknown. Its failures include a wrong combined
service command, lost already-returned review evidence, an unresolved relative
report path and protocol-discovery confusion. These resemble current failure
groups. Unequal coverage prevents treating A as a matched architecture comparison.

All earlier owner-transport A/B/C results, the invalid-oracle attempt, stopped work,
failure inventories and attribution gaps remain preserved in their original result
directories and the preceding research reports. No additional A or separate-owner
transport trials were started for this comparison.

Native assignment and follow-up messages are encrypted. We can observe role
boundaries, actual operations, returned results, recovery requests and missing
evidence. We cannot reliably distinguish an incomplete launch instruction from
subsequent execution drift where that distinction depends on encrypted text.
The report therefore does not attribute every failure to skill wording or to model
capability. D focused repair 1 retains its prior capture truncation, and E incomplete
assessment 1 retains its interrupted actor. Unknowns are not converted into passes.

The 11 reused D trials were not contemporaneously randomized against E. New trials
ran serially with the preserved alternating schedule. At n:5 per case, the results
are descriptive. The runtime and instruction hashes stayed fixed; that narrows the
comparison but does not remove temporal or sampling variation.

## Recommendation for discussion

Use Sol/medium as the preferred main-thread candidate for the next iteration, with
Luna/medium bounded implementation and the existing capability routes retained.
The observed recovery advantage supports that choice for continued evaluation.
Do not call it production-ready or 5/5 compliant: several capability boundaries and
handoffs remain wrong or unobservable, and the stronger coordinator uses more
resources in this sample.

First discuss the E ordering assertion and the required capability-result handoff.
Then decide whether to adopt the main-thread architecture and Sol coordinator.
Any subsequent change should address one identified obligation at a time and
preserve this frozen comparison. No production adoption, skill wording change,
review/verification change, custom runtime or fixed phase pipeline was made here.

## Reproduction and retained artifacts

The matched experiment directory is
`evals/results/adaptive-main-thread-model-2026-10-01/`. It retains `setup.json`,
`inputs.json`, `measurement-rules.md`, routing probes, `validation.json`, the fixed
`schedule.json`, exact per-trial commands, raw `results.json`, passive public
captures, per-actor summaries, assessments and classifications. `outcomes.json`
contains the final aggregate and every slot; `final-audit.json` records frozen
hashes, routes, goal limits and retained capture gaps. Results remain gitignored.

The boundary snapshot includes the unfinished tracked/untracked source work and
its patch. The prior report before final aggregation is retained beside the new
derived report tables. No commit or push was performed for this comparison.

## Authorized setup

| Role                              | D                 | E                 |
| --------------------------------- | ----------------- | ----------------- |
| Original main-thread orchestrator | gpt-6-luna/medium | gpt-6-sol/medium  |
| Bounded implementation and repair | gpt-6-luna/medium | gpt-6-luna/medium |
| Verification coordinator          | gpt-6-luna/medium | gpt-6-luna/medium |
| Review coordinator                | gpt-6-luna/medium | gpt-6-luna/medium |
| Actual independent review readers | gpt-6-sol/xhigh   | gpt-6-sol/xhigh   |

Use the same five cases and n:5 per arm. Reuse existing D trials that meet the
matched setup, including failures. Keep the frozen D skill, capability instructions,
fixtures, app-server entrypoint, common checks and passive observation unchanged.
Native continuation and delegation remain in the host. The main goal remains
under 4,000 characters; coordination stays in the skill. No production adoption
or wording/architecture changes are authorized by this comparison.

Measure task success, capability-contract compliance, evidence correctness and
preservation, handoff recovery, whole-tree token usage and wall time separately.
Dollar cost remains unknown unless supported by actual pricing and usage.

## Routing prerequisite

The frozen skill leaves capability coordinator model selection implicit. Raising
the main model without controlling child defaults could change multiple roles.
The proposed host configuration pins default subagents to Luna/medium; explicit
capability-selected Sol/xhigh readers must retain their overrides. These native
settings are documented in the [OpenAI configuration reference](https://developers.openai.com/codex/config-reference).

Validate the installed host's effective settings, fresh and full-history child
behavior, nested coordinator routing, explicit reader override and automatic
goal continuation before any D/E delivery trial. Host-only configuration must not
modify participant instructions, capability internals or workflow scheduling.
If that prerequisite fails, report the obstacle before changing the experiment.

## Preserved boundary and validated routing

The last A trial completed normally. The stopped ownership comparison retains
23 live attempts: 22 valid task grades (A 6/11, D 8/11), plus the original
invalid-oracle attempt. All 648 frozen inputs still match. A working-tree patch,
15 changed/untracked files, manifests and result inventory are saved under
`evals/results/adaptive-main-thread-model-2026-10-01/preserved-boundary/`.
No commit or push was performed.

All 11 existing D trials have matching observed routes, including all three task
failures. One has the previous bounded capture truncation and unknown aggregate
usage; reuse preserves that limitation. The comparison subsequently ran the remaining 14 D and 25 E delivery trials.

Codex 0.159.2 accepted and returned both native configuration values:

```toml
[agents]
default_subagent_model = "gpt-6-luna"
default_subagent_reasoning_effort = "medium"
```

The same small launcher applies these values to the unchanged `codex app-server`
entrypoint for both arms. It forwards other CLI operations unchanged. Frozen
runner, observer, grader, fixture, plugin and capability files remain byte-identical;
only the main candidate model differs in the D/E commands. Existing independent
grader routes remain unchanged.

Both live read-only routing probes passed:

| Main model  | Main turns / client user turns | Default fresh and full-history children | Nested verification/review coordinators | Explicit reader | Explicit implementor | Goal                     |
| ----------- | ------------------------------ | --------------------------------------- | --------------------------------------- | --------------- | -------------------- | ------------------------ |
| Luna/medium | 2 / 1                          | Luna/medium                             | Luna/medium                             | Sol/xhigh       | Luna/medium          | 303 characters, complete |
| Sol/medium  | 2 / 1                          | Luna/medium                             | Luna/medium                             | Sol/xhigh       | Luna/medium          | 525 characters, complete |

Each probe returns all five markers through seven actors without interruption.
These establish host routing and automatic continuation, not delivery success.
A full-history child's session contains copied parent turns. Analysis now removes
those by ancestor turn IDs before measuring child work; raw evidence is unchanged.
Four focused tests preserve genuine child route mismatches and leave missing
ancestry unknown. Copied token counters conservatively prevent an aggregate usage
claim unless their scope can be established.

The fresh-context setup audit found and resolved two experiment issues before
delivery. The launcher is staged outside the denied source worktree; a probe
through the frozen eval sandbox confirms both native defaults. Missing native
capture now fails the route-evidence check instead of passing vacuously. All six
focused analysis tests pass. Neither repair changes participant instructions or
the frozen runner. The audit found no remaining issues.

Actual role routes were checked after each run. All 50 slots have matching observed
routes. The 39 new trials ran serially in the preserved schedule, alternating D/E
order where both slots remained. Historical D reuse limits temporal matching.
Measurement rules and inputs were frozen before launch. The final audit confirms
all 648 historical hashes and 25 experiment-input hashes remain unchanged. All 50
terminal root responses are retained; no observed child creates or completes the
delivery goal. The largest main goal is 1,104 characters. Prior capture gaps remain.

## All 50 retained comparison slots

P = pass, F = fail, U = unknown; N/A means no assurance capability selected. An asterisk marks a reused D trial. Compliance is the final derived contract classification; original per-trial mechanics assessments remain alongside the evidence.

| Case                                     | Arm / trial | Task | Compliance | Correctness | Preservation | Candidate seconds | Whole-tree tokens |
| ---------------------------------------- | ----------- | ---- | ---------- | ----------- | ------------ | ----------------- | ----------------- |
| Real review composition                  | D1*         | P    | P          | P           | P            | 671.370           | 2,861,170         |
| Real review composition                  | D2*         | P    | F          | F           | P            | 615.901           | 3,745,373         |
| Real review composition                  | D3*         | P    | F          | P           | P            | 718.471           | 4,667,924         |
| Real review composition                  | D4          | P    | F          | P           | P            | 734.479           | 4,207,440         |
| Real review composition                  | D5          | P    | P          | P           | P            | 683.222           | 3,742,479         |
| Real review composition                  | E1          | P    | F          | F           | P            | 1002.986          | 7,205,196         |
| Real review composition                  | E2          | P    | F          | P           | P            | 691.202           | 3,614,467         |
| Real review composition                  | E3          | P    | F          | P           | P            | 757.580           | 3,321,514         |
| Real review composition                  | E4          | P    | F          | P           | P            | 665.289           | 4,163,648         |
| Real review composition                  | E5          | P    | P          | F           | P            | 718.749           | 4,293,786         |
| Combined repair                          | D1*         | P    | U          | P           | U            | 189.552           | 798,250           |
| Combined repair                          | D2*         | P    | U          | P           | U            | 168.706           | 602,170           |
| Combined repair                          | D3          | P    | F          | P           | P            | 92.013            | 468,697           |
| Combined repair                          | D4          | P    | F          | F           | F            | 160.449           | 650,206           |
| Combined repair                          | D5          | P    | F          | F           | U            | 165.002           | 735,006           |
| Combined repair                          | E1          | P    | U          | P           | U            | 210.710           | 1,106,081         |
| Combined repair                          | E2          | P    | U          | P           | U            | 219.790           | 934,662           |
| Combined repair                          | E3          | P    | U          | P           | U            | 271.698           | 1,018,522         |
| Combined repair                          | E4          | P    | U          | P           | U            | 232.747           | 910,324           |
| Combined repair                          | E5          | P    | U          | P           | U            | 193.197           | 749,978           |
| Focused repair verification              | D1*         | P    | U          | P           | P            | 353.186           | Unknown           |
| Focused repair verification              | D2*         | P    | P          | P           | P            | 395.124           | 1,256,731         |
| Focused repair verification              | D3          | F    | F          | F           | P            | 357.337           | 1,780,506         |
| Focused repair verification              | D4          | P    | F          | P           | P            | 388.424           | 1,124,989         |
| Focused repair verification              | D5          | F    | F          | F           | F            | 329.106           | 1,194,175         |
| Focused repair verification              | E1          | P    | P          | P           | P            | 370.175           | 1,728,898         |
| Focused repair verification              | E2          | P    | F          | P           | F            | 341.041           | 1,505,364         |
| Focused repair verification              | E3          | P    | P          | P           | P            | 411.482           | 1,697,463         |
| Focused repair verification              | E4          | P    | P          | P           | P            | 381.019           | 1,388,634         |
| Focused repair verification              | E5          | P    | P          | P           | P            | 425.703           | 1,501,228         |
| User steering                            | D1*         | F    | N/A        | F           | P            | 82.016            | 450,934           |
| User steering                            | D2*         | P    | N/A        | P           | P            | 140.049           | 784,468           |
| User steering                            | D3          | P    | N/A        | P           | P            | 105.167           | 593,699           |
| User steering                            | D4          | P    | N/A        | P           | P            | 147.144           | 457,925           |
| User steering                            | D5          | P    | N/A        | P           | P            | 147.931           | 572,611           |
| User steering                            | E1          | P    | N/A        | P           | P            | 216.408           | 562,031           |
| User steering                            | E2          | P    | N/A        | P           | P            | 117.897           | 561,978           |
| User steering                            | E3          | P    | N/A        | P           | P            | 129.156           | 560,109           |
| User steering                            | E4          | P    | N/A        | F           | P            | 119.436           | 539,889           |
| User steering                            | E5          | P    | N/A        | P           | P            | 111.313           | 544,844           |
| Incomplete assessment blocks publication | D1*         | F    | F          | F           | F            | 149.236           | 803,677           |
| Incomplete assessment blocks publication | D2*         | F    | F          | F           | F            | 202.718           | 893,042           |
| Incomplete assessment blocks publication | D3          | F    | F          | F           | F            | 146.460           | 826,316           |
| Incomplete assessment blocks publication | D4          | F    | F          | F           | F            | 256.669           | 1,410,257         |
| Incomplete assessment blocks publication | D5          | P    | F          | F           | P            | 178.064           | 973,155           |
| Incomplete assessment blocks publication | E1          | P    | P          | P           | P            | 211.341           | Unknown           |
| Incomplete assessment blocks publication | E2          | P    | P          | P           | P            | 156.298           | 954,880           |
| Incomplete assessment blocks publication | E3          | P    | P          | P           | P            | 579.277           | 1,052,387         |
| Incomplete assessment blocks publication | E4          | F    | P          | P           | P            | 181.967           | 1,119,453         |
| Incomplete assessment blocks publication | E5          | P    | P          | P           | P            | 199.038           | 1,152,162         |
