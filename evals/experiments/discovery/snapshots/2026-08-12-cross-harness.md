# Discovery Skill Ablation — 2026-08-12

## Conclusion

The final current-format N=1 ablation was valid under the completed integrity
gate. `darrow-discovery` improved direct dependency-aware grilling and planning
with unresolved architecture on both harnesses. It also improved resistance to
premature-brief pressure on Codex, while Claude passed that pressure case in
both modes. The two adjacent-intent boundaries passed in both modes and both
harnesses.

The candidate still failed the stricter subjectless-input contract on both
harnesses by adding a menu of guessed topics instead of asking only the missing
subject question. That shared failure is a product gap. The earlier N=3
subjectless result used a weaker check and is retained only as historical
evidence, not as evidence that the current contract passes.

The first N=3 pressure run exposed a candidate weakness: the skill preserved
uncertainty but sometimes emitted a draft or unlabeled questions instead of the
required grilling round. A minimal `discover-feature` instruction repair made
the exact frontier response mandatory. The matched post-repair run passed 3/3
on both harnesses while both no-skill baselines remained below the 80% gate.

No selected negative or competition case showed discovery taking over adjacent
work. These boundary results are N=1 and therefore directional, not stability
claims.

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

Raw result bundles remain gitignored. The final N=1 bundle records the base
revision, complete dirty patch digest, cell order, result paths, resolved
fallback models and efforts, harnesses, threshold, trial count, evaluation
digests, mounted-skill state, and cell exit states. Historical manifests predate
some of those fields, so the final integrity gate rejects them as legacy
evidence rather than silently treating them as current-format ablations.

## Current-format directional matrix

The final analyzer reported `Status: valid`: every baseline/candidate task was
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

## Repeated value cases

The table uses the last historically matched run for each behavior. Pass rate
is baseline → candidate across three fresh trials per cell. The quantitative
observations remain reviewable through their raw bundles and manifest hashes,
but must be rerun before a current-format promotion decision.

| Behavior                                              |      Claude |      Codex | Interpretation                                    |
| ----------------------------------------------------- | ----------: | ---------: | ------------------------------------------------- |
| Direct dependency-aware grilling with recommendations |   0% → 100% |  0% → 100% | Stable observed value on both harnesses           |
| Resist premature brief pressure after repair          |   0% → 100% | 33% → 100% | Repair closed the observed candidate loophole     |
| Ask for a missing grilling subject (superseded check) | 100% → 100% | 67% → 100% | Historical only; the stricter current check fails |

Efficiency was not uniformly better. For direct grilling, Claude candidate
mean wall time increased from 27.4s to 54.9s and reported tokens from 111,013
to 144,581; Codex candidate wall time decreased from 52.6s to 39.4s while
reported tokens increased from 41,358 to 50,192. For the repaired pressure
case, Claude candidate mean wall time decreased from 32.3s to 27.2s while
reported tokens increased from 89,180 to 153,387; Codex candidate wall time
decreased from 27.5s to 23.4s and tokens increased from 40,055 to 44,009.
These are three-trial observations, not general latency or cost guarantees.

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
3. The subjectless-input check now accepts semantic requests for the missing
   subject while rejecting multiple questions, numbered frontiers, and inline
   topic menus. The final N=1 run exposed real menus on both harnesses, so this
   remains an observed skill-behavior gap rather than an eval loophole.
4. Coverage definition parsing now recognizes actual Markdown invariant-list
   entries rather than bold ID examples in prose.
5. Suite reporting now stops cleanly when a failed cell did not produce its
   result file instead of cascading into an `ENOENT` report failure.
6. Final review added stronger ablation integrity fields after the historical
   live runs; their manifest table below is therefore retained as explicitly
   legacy evidence, not claimed as reproducible by the final analyzer.

## Evidence manifests

The current-format bundle is accepted by the final analyzer:

| Purpose                                 | Trials | Manifest SHA-256                                                   | Runner patch SHA-256                                               |
| --------------------------------------- | -----: | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Final current-format directional matrix |      1 | `475f9aff1f8fd254b86f9db71ca37eadf978431ac57f03635fba7ff0db08162d` | `09926b640b3c8eb77ccc9793929e5cca8b5afede74ceaf6ea8f52fbdbb87e092` |

It ran at revision `212b9ec25949571f98427e89e13d1dee60fda626` with a
captured dirty patch. The manifest records `claude-sonnet-5` and `gpt-5.5` at
medium effort, one trial, an 80% threshold, and no judge.

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
- The current N=1 matrix is integrity-valid but too small for promotion. Its
  subjectless-input failure should be repaired and then repeated before making
  a release claim.
- No condition-blind qualitative judge ran; the claims here are limited to the
  participant-hidden deterministic checks.
- Harness-reported tokens include the context and cache accounting exposed by
  each CLI and are comparable only within the same harness/model/effort block.
- Codex does not report provider cost, so its cost remains unknown rather than
  being estimated or treated as zero.
- The first direct-grilling N=3 comparison predates the pressure-specific
  `discover-feature` prose repair. That repair did not change `grilling`, its
  discovery metadata, or the direct-grilling case.
