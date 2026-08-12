# Discovery Skill Ablation — 2026-08-12

## Conclusion

The final current-format N=3 ablation was valid under the completed integrity
gate. The repaired `grilling` skill produced the normalized final answer `What
subject would you like me to grill?` in 3/3 candidate trials on both Claude and
Codex, while both no-skill controls passed 0/3. The strict check was not
weakened: any paraphrase, explanation, topic menu, second question, numbered
frontier, or Markdown wrapper in that answer fails.

The first exact-response revision passed 3/3 on Codex but only 2/3 on Claude;
the failed Claude turn added a paraphrase, topic menu, and explanation.
Front-loading the missing-subject gate as the first behavior after skill loading
produced the final 3/3 result on both harnesses. This closes the final-answer gap
exposed by the current-format N=1 diagnostic matrix and supersedes the earlier
N=3 result that used a weaker semantic check.

The first N=3 pressure run exposed a candidate weakness: the skill preserved
uncertainty but sometimes emitted a draft or unlabeled questions instead of the
required grilling round. A minimal `discover-feature` instruction repair made
the exact frontier response mandatory. The matched post-repair run passed 3/3
on both harnesses while both no-skill baselines remained below the 80% gate.

The final repeated suite also kept direct grilling at 3/3 on both harnesses.
Premature-brief pressure passed 3/3 on Codex and 2/3 on Claude; the failed
Claude turn treated the instruction to assume missing answers as bounded
delegation and produced a draft brief instead of the required frontier. The
subjectless claim is promoted, but that adjacent pressure result is reported as
below threshold rather than hidden inside a whole-suite success claim.

## Setup

| Dimension      | Value                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------------- |
| Claude harness | Claude Code 2.1.220, `claude-sonnet-5`                                                              |
| Codex harness  | codex-cli 0.147.0, `gpt-5.5`                                                                        |
| Effort         | medium                                                                                              |
| Pass threshold | 80%                                                                                                 |
| Candidate      | case-selected skill with sibling discovery skills mounted when the case requests plugin composition |
| Baseline       | identical prompt, fixture, checks, harness, model, effort, and trial count with no skill mounted    |
| Judge          | none; hidden deterministic repository and final-message checks only                                 |

Raw result bundles remain gitignored. The final N=3 bundle records the base
revision, a digest of the tracked and non-ignored untracked dirty patch, cell
order, result paths, resolved fallback models and efforts, harnesses, threshold,
trial count, evaluation digests, mounted-skill state, and cell exit states.
Historical manifests predate some of those fields, so the final integrity gate
rejects them as legacy evidence rather than silently treating them as
current-format ablations.

## Pre-repair current-format directional matrix

The N=1 analyzer reported `Status: valid`: every baseline/candidate task was
matched on participant-visible input, hidden checks, fixture, condition,
harness version, model, effort, threshold, and trial count. Validity describes
the comparison, not whether every task passed. Each cell exited nonzero because
at least one case missed the 80% gate.

| Behavior                                               |      Claude |       Codex | Interpretation                                  |
| ------------------------------------------------------ | ----------: | ----------: | ----------------------------------------------- |
| Resist premature brief pressure                        | 100% → 100% |   0% → 100% | Directional Codex gain; no observed Claude gain |
| Direct dependency-aware grilling with recommendations  |   0% → 100% |   0% → 100% | Directional value on both harnesses             |
| Ask only for a missing grilling subject                |     0% → 0% |     0% → 0% | Candidate still proposes a guessed-topic menu   |
| Leave an ordinary implementation plan alone            | 100% → 100% | 100% → 100% | No observed adjacent-intent takeover            |
| Resolve unknown architecture before final planning     |   0% → 100% |   0% → 100% | Directional value on both harnesses             |
| Leave feature discovery out of implementation planning | 100% → 100% | 100% → 100% | No observed adjacent-intent takeover            |

Across the six cases, Claude moved from 3/6 to 5/6 and Codex from 2/6 to
5/6. This is an N=1 diagnostic matrix, not a stability or promotion claim.
The task-level report also shows that most candidate turns used more reported
tokens; no general efficiency improvement is claimed.

## Current-format repeated value cases

Pass rate is baseline → candidate across three fresh trials per cell in the
final matched bundle.

| Behavior                                              |    Claude |      Codex | Interpretation                             |
| ----------------------------------------------------- | --------: | ---------: | ------------------------------------------ |
| Direct dependency-aware grilling with recommendations | 0% → 100% | 33% → 100% | Meets the 80% gate on both harnesses       |
| Resist premature brief pressure                       | 33% → 67% |  0% → 100% | Claude candidate is below the 80% gate     |
| Emit the exact canonical missing-subject question     | 0% → 100% |  0% → 100% | Target repair passes 3/3 on both harnesses |

For the repaired subjectless case, Claude candidate mean wall time increased
from 5.4s to 6.4s while reported tokens increased from 32,575 to 68,324; Codex
candidate mean wall time increased from 11.0s to 12.3s while reported tokens
increased from 12,588 to 27,913. These are three-trial observations, not general
latency or cost guarantees. Codex cost remains unknown.

## Boundary cases

In the current-format N=1 matrix, an ordinary implementation-plan request was
not converted into standalone grilling and feature-discovery intent was not
converted into an implementation plan; both passed in both modes on both
harnesses. Direct implementation planning with an unresolved public-seam
decision passed only with the candidate on both harnesses, which is recorded as
skill value rather than baseline boundary behavior.

A separate historical matched N=1 probe found that a settled implementation
request was implemented rather than interviewed in both modes on both
harnesses.

The settled implementation probe is deliberately N=1 because one exploratory
Codex no-skill turn consumed 117,506 reported tokens and 359.5 seconds before
the broad N=3 attempt was stopped. The completed N=1 rerun passed both modes;
it does not establish a stable efficiency result.

## Coverage evidence

The new coverage command reported the discovery scope as structurally valid:

- 23 normative invariant IDs;
- 13 IDs referenced by at least one colocated eval;
- 10 honest uncovered gaps;
- no unknown or retired references; and
- no duplicate normative definitions.

The repository-wide report found 283 invariant IDs, 160 covered and 123
uncovered, with no unknown references or duplicate definitions. Coverage means
that a claim is exercised; it does not mean the associated live behavior
passes. The uncovered list is follow-up input rather than an automatic gate.

## Corrections made from evidence

1. The discovery skill now requires the canonical `Q1 — ...` plus
   `Recommendation: ...` frontier under pressure instead of permitting a
   refusal, proposed defaults, unlabeled questions, or a draft brief.
2. Two planning negative checks were narrowed after correctly negated phrases
   such as “without turning it into an implementation plan” produced false
   failures. Their matched rerun passed both modes on both harnesses.
3. The subjectless-input contract and check now require the exact canonical
   final answer shown above. The normalized final-message check rejects any
   other content instead of trying to enumerate paraphrases, menus, or
   questionnaire forms. After a first revision still produced one Claude
   paraphrase in three trials,
   the skill front-loaded this gate before repository inspection and the rest of
   its workflow; the final rerun passed 3/3 on both harnesses.
4. Independent review found that an earlier draft overclaimed whole-turn
   behavior even though the eval observes only the normalized final answer. The
   invariant, skill, and snapshot now name that public seam explicitly; the
   corrected skill was rerun at N=3 rather than inheriting the earlier result.
5. Coverage definition parsing now recognizes actual Markdown invariant-list
   entries rather than bold ID examples in prose.
6. Suite reporting now stops cleanly when a failed cell did not produce its
   result file instead of cascading into an `ENOENT` report failure.
7. Final review added stronger ablation integrity fields after the historical
   live runs; their manifest table below is therefore retained as explicitly
   legacy evidence, not claimed as reproducible by the final analyzer.

## Evidence manifests

The current-format bundles are accepted by the final analyzer. The failed-gate
row is retained as negative evidence, not as a passing result:

| Purpose                                       | Trials | Manifest SHA-256                                                   | Runner patch SHA-256                                               |
| --------------------------------------------- | -----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Final exact-response comparison               |      3 | `2cfa2c6a4f3d27c8f25c67f766df0be7603e68b981d00224b64498ece9244b3a` | `b13232b865c50f5de5c64ea1c6e1a068a65d68e0c27e01a7ed19bf756740e6ec` |
| Initial exact-response revision (failed gate) |      3 | `84b1dbfc1b4a77968aad968762a982e9e84f445b6f7104ba3a91cb6c74a263bd` | `51527ed0d1036b57941bd9c50635956dccd380d753674f8a28a6d57cd342aab9` |
| Pre-repair current-format N=1 matrix          |      1 | `475f9aff1f8fd254b86f9db71ca37eadf978431ac57f03635fba7ff0db08162d` | `09926b640b3c8eb77ccc9793929e5cca8b5afede74ceaf6ea8f52fbdbb87e092` |

The final N=3 run used revision
`40ded980259cab06a4984cf0e4205996819131a0` with a captured dirty patch. Its
manifest records `claude-sonnet-5` and `gpt-5.5` at medium effort, three trials,
an 80% threshold, and no judge.

These hashes identify historical raw bundles. They are not accepted by the
final ablation analyzer because they lack fields added during the final review.

| Purpose                                       | Trials | Manifest SHA-256                                                   |
| --------------------------------------------- | -----: | ------------------------------------------------------------------ |
| Broad cross-harness directional matrix        |      1 | `50f302567e30811788e0e6a6bd1a0f0936f7e1158bbdff3c6270a103cbcde9a4` |
| Corrected planning checks                     |      1 | `88aca2b2d30117ec70a361d9ff07069eb827a1bc8760f1e698589c44c75ed036` |
| Direct grilling and initial pressure baseline |      3 | `2d4ac7f1a662e70078518959d9cc3276044bea51c04d0bb67206e3edbffad12d` |
| Post-repair pressure comparison               |      3 | `185e4e5caadde97654077e9838ea0c7e6d775d25a118ea381851f97f92401821` |
| Final subjectless-input comparison            |      3 | `20c18f85459560fba91a95723f4c4bf8e625f2dd3d4e395c4d2a19cddff5d0a3` |
| Settled implementation negative               |      1 | `00edd141b7ae546151ff2643fc0bad3f21ce036182442c1627e1befd86d3f34d` |

## Limitations

- Three trials support a local reliability comparison, not a universal model
  or prompt-distribution claim.
- The N=1 boundary cases should be repeated only if they become
  decision-bearing or show later instability.
- The pre-repair N=1 matrix remains directional. The subjectless behavior now
  has a current-format N=3 comparison, but this does not turn the other N=1
  boundary cases into stability claims.
- The final repeated pressure result is below threshold on Claude, so this
  snapshot does not claim that every value-suite case is promoted.
- No condition-blind qualitative judge ran; the claims here are limited to the
  participant-hidden deterministic checks.
- The exact-response check covers the normalized final answer, not host protocol
  messages or skill-loader events. In the Codex traces, the host announces skill
  use and loads `SKILL.md` before producing the exact final answer; no claim is
  made that those host-level events are absent.
- Harness-reported tokens include the context and cache accounting exposed by
  each CLI and are comparable only within the same harness/model/effort block.
- Codex does not report provider cost, so its cost remains unknown rather than
  being estimated or treated as zero.
- The first direct-grilling N=3 comparison predates the pressure-specific
  `discover-feature` prose repair. That repair did not change `grilling`, its
  discovery metadata, or the direct-grilling case.
