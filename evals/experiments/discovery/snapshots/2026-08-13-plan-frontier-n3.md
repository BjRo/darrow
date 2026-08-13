# Planning Dependency Frontier — 2026-08-13

## Conclusion

The final matched N=3 ablation moved
`plan-implementation-direct-unknowns` from 0/3 to 3/3 on both supported
harnesses. The candidate asked only the unresolved scope root, recommended one
root answer without selecting a child, named the remaining dependent
decisions, promised frontier recomputation, and stopped without a plan in all
six trials.

| Harness | No skill | Candidate |  Delta |
| ------- | -------: | --------: | -----: |
| Claude  |      0/3 |       3/3 | +100pp |
| Codex   |      0/3 |       3/3 | +100pp |

The runner's ablation analyzer reports the comparison valid with no errors.
The candidate also passed the competition activation gate in 3/3 trials on
each harness. Every candidate trial selected `plan-implementation` first and
then loaded the canonical sibling `grilling` capability from the same
installed source plugin.

## Setup

| Dimension      | Claude                                                             | Codex                   |
| -------------- | ------------------------------------------------------------------ | ----------------------- |
| Harness        | Claude Code 2.1.220                                                | codex-cli 0.147.0       |
| Model          | `claude-sonnet-5`                                                  | `gpt-5.5`               |
| Effort         | medium                                                             | medium                  |
| Trials         | 3 control + 3 candidate                                            | 3 control + 3 candidate |
| Pass threshold | 80%                                                                | 80%                     |
| Eval digest    | `b6c24f35e4f474934a921eae050aac528338c842185a10f61e354642d33c7d1d` | same                    |

The control and candidate cells used the same prompt, fixture, hidden checks,
harness version, model, effort, threshold, and trial count. The sole measured
condition difference was whether the `darrow-discovery` skill plugin was
installed. No condition-blind judge ran.

## What changed

- `grilling` now states the canonical dependency test: another open answer
  makes a node a child when it can change that node's relevance, subject,
  options, or recommendation.
- `plan-implementation` must load that canonical sibling first, prove the
  current roots, keep recommendations at the root level, name deferred child
  decisions, recompute, and stop.
- A portable Bash renderer validates the one-root response fields before
  rendering the frontier. It is resolved from the installed plugin: through
  the plugin `bin/` path on Claude and relative to the selected absolute
  `SKILL.md` on Codex. It never resolves through the user's project.
- Deterministic regressions cover premature child questions and answers,
  combined-scope invention, refusal disguised as a recommendation, current
  implementation shape used as decision authority, missing frontier
  recomputation, and premature plans.
- A separate audit-storage case passed one transfer smoke trial on each
  harness. It exercises different root labels and child categories; it is
  supporting transfer evidence, not an N=3 promotion claim.

## Installed-plugin evidence seam

Claude loads a filtered source plugin through `--plugin-dir`; the retained
structured stream records direct `Skill` events for `plan-implementation`
followed by `grilling` in every candidate trial.

Codex receives no project `.agents/skills` copy. The fixture builds a filtered
local marketplace, installs the plugin into an isolated Codex home, and uses
the returned installed `skills/` directory as the only accepted root for the
controlled successful-content-read probe. Every candidate trial records
`plan-implementation` followed by `grilling`. The no-skill control installs no
plugin and records no activation rate because the target is absent.

## Efficiency observations

| Harness | Wall mean     | Tokens mean     | Cost total        |
| ------- | ------------- | --------------- | ----------------- |
| Claude  | 40.8s → 72.5s | 158691 → 491980 | $0.4618 → $1.7120 |
| Codex   | 67.5s → 67.0s | 61221 → 173750  | unknown → unknown |

The added canonical load, repository inspection, and validated frontier cost
more tokens on both harnesses. Claude also cost more and took longer. Codex's
observed mean wall time was roughly flat. These are within-harness
observations from three trials, not cross-provider efficiency rankings.

## Evidence artifacts

Raw bundles are gitignored under
`evals/results/discovery-plan-frontier/2026-08-13-final-installed-n3/`.

| Artifact                       | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| Claude control                 | `4bfd6ca2c2d78fd3493f213cd6477208c4dd88b139dee4e0072a314ae931d8f8` |
| Claude candidate               | `72fc45e5b5fd99ecb7ae8fb699866954596b895469427821526b58aa05ed7490` |
| Codex control                  | `513989a65db751660b53d8e0f44e767c8984c799f37334455071dbe00cdddc4b` |
| Codex candidate                | `cdaed70915c6ba04c5227d6cc84c46ac539df6cd5750e9cf7cde26d45aec52dc` |
| `plan-implementation/SKILL.md` | `fe618eabb0b10253b857f9f7710f0b45203a2411379ee309293963236b82b046` |
| `grilling/SKILL.md`            | `d3c2c0331ffb1528d6e780439d6fa15fbe57f9a644a9c170c3fad18f40b37195` |
| Frontier renderer              | `3f12a6dcb5bbcaf594f79ea8f2a468f98cd1a1d6fa3d7500f088400b5fb3c1a2` |
| Timeout eval                   | `aef9460936200bce0746fee9a2edfbb03b32e94b8c69ac3556e2540a801f7062` |

The direct result bundles cryptographically identify the eval but do not
embed a complete source-plugin or dirty-patch digest. The source hashes above
and this post-freeze snapshot preserve the exact reviewed capability bytes;
they are not a substitute for a suite manifest that captures the complete
dirty patch.

## Limitations

- Three trials establish a local result for one pressure case, not universal
  planning reliability across prompts, models, or future host versions.
- The unrelated transfer case was only a one-trial smoke per harness.
- Regex and AWK gates cover concrete adversarial behaviors but cannot prove
  every natural-language paraphrase; all six candidate transcripts were also
  manually reviewed against the normative dependency contract.
- Codex activation is a controlled successful skill-content-read probe, not a
  native invocation event. Claude exposes direct skill events.
- No blind judge ran. The claim is limited to participant-hidden deterministic
  checks plus manual semantic review.
- Provider cost remains unavailable for Codex, and efficiency values are only
  comparable within a harness under these fixed conditions.
