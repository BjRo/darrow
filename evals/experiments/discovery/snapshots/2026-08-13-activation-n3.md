# Discovery Skill Activation — 2026-08-13

## Conclusion

The final current-format N=3 activation suite observed the intended primary
skill in every measured positive and competition trial and kept `grilling`
from becoming primary in every negative trial on both supported harnesses.
Across 24 declared activation trials, activation recall and precision were
both 100%:

| Class       | Claude | Codex | Combined |
| ----------- | -----: | ----: | -------: |
| Positive    |    3/3 |   3/3 |      6/6 |
| Negative    |    3/3 |   3/3 |      6/6 |
| Competition |    6/6 |   6/6 |    12/12 |

This result establishes local routing reliability for four representative
discovery requests at the observed models, harness versions, and sample size.
It does not claim universal activation behavior or prove execution quality.

That separation exposed useful execution evidence. Both harnesses selected
`plan-implementation` in 3/3 competition trials, while Claude passed that
case's existing dependency-sequencing checks in 0/3 and Codex passed them in
1/3. The routing results remain 3/3; the report does not convert those outcome
failures into activation failures or hide them inside activation success.

## Setup

| Dimension      | Value                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Suite          | `evals/experiments/discovery/activation-suite.yaml`                   |
| Claude harness | Claude Code 2.1.220, `claude-sonnet-5`                                |
| Codex harness  | codex-cli 0.147.0, `gpt-5.5`                                          |
| Effort         | medium                                                                |
| Trials         | three per case and harness                                            |
| Pass threshold | 80%                                                                   |
| Judge          | none; existing participant-hidden deterministic outcome checks remain |

The suite contains one direct positive trigger, one adjacent-intent negative
trigger, and two sibling-skill competitions:

| Case                                  | Class       | Owning target         |
| ------------------------------------- | ----------- | --------------------- |
| `grilling-direct-frontier`            | positive    | `grilling`            |
| `grilling-no-trigger-ordinary-plan`   | negative    | `grilling`            |
| `discover-feature-direct-unknowns`    | competition | `discover-feature`    |
| `plan-implementation-direct-unknowns` | competition | `plan-implementation` |

Every competition case mounts all three sibling discovery skills. The owning
target is derived from the colocated skill directory, not repeated in case
metadata. No no-skill activation rate is reported because the target
capability is absent in that condition.

## Evidence seams

Claude Code exposes the direct `Skill` tool in its structured harness stream.
The runner retains a reduced record containing those tool events and the
terminal accounting envelope, while omitting ordinary assistant-message text.
This is direct host-event evidence.

Codex CLI 0.147.0 does not expose a native skill-invocation event. The runner
therefore labels its evidence `skill_file_read_probe` and observes the first
successfully completed content read of a mounted
`.agents/skills/<name>/SKILL.md` whose returned body identifies the mounted
skill. Path-existence checks, decoy paths, suppressed output, and
command-shaped text do not count. Retained Codex evidence contains only reduced
skill-read records plus bounded routing and terminal accounting records, not
ordinary agent messages, commands, or command output. This is a controlled
behavior probe required by the host's skill-loading protocol, not a claim of
direct invocation telemetry.

For two Codex negative trials, `plan-implementation` was the primary observed
skill and its canonical dependency later caused `grilling` to be read. The
negative contract concerns the primary selected capability, so those trials
correctly pass: ordinary planning was not taken over by standalone grilling.
The third Codex negative trial and all three Claude negative trials selected no
skill, which is also a measured pass rather than unknown evidence.

## Activation and outcome results

| Harness | Case                                  | Activation | Outcome |
| ------- | ------------------------------------- | ---------: | ------: |
| Claude  | `grilling-direct-frontier`            |        3/3 |     2/3 |
| Claude  | `grilling-no-trigger-ordinary-plan`   |        3/3 |     3/3 |
| Claude  | `discover-feature-direct-unknowns`    |        3/3 |     3/3 |
| Claude  | `plan-implementation-direct-unknowns` |        3/3 |     0/3 |
| Codex   | `grilling-direct-frontier`            |        3/3 |     3/3 |
| Codex   | `grilling-no-trigger-ordinary-plan`   |        3/3 |     3/3 |
| Codex   | `discover-feature-direct-unknowns`    |        3/3 |     3/3 |
| Codex   | `plan-implementation-direct-unknowns` |        3/3 |     1/3 |

The aggregate outcome rate was 67% for Claude and 83% for Codex. Those are
secondary execution observations from the activation corpus, not new skill
promotion claims. Both cell exit states are nonzero because at least one
existing outcome case missed the 80% threshold, while every declared
activation case independently met its activation gate.

## Evidence manifest

Raw bundles remain gitignored at
`evals/results/discovery-activation/2026-08-13-current-format-final-n3-v2/`.

| Artifact             | SHA-256                                                            |
| -------------------- | ------------------------------------------------------------------ |
| Suite manifest       | `7841f7092b2db1a9b582d669c53d792e6b2f92224af7e343aacf7e78cca5d1b5` |
| Runner patch         | `c34e7a59be7b94b0e3f042fbf45c2c400975a86671a367e7277bc2c64f3f4f33` |
| Claude result bundle | `c38c783ce6363c9a5d8a5793ccb29cc874b799b0a2310777f8ed1d6f586dec8f` |
| Codex result bundle  | `0976741b2e1456c4675111eb57d79420d547c34061b5a9410e7bb52d9bd7c12e` |
| Generated report     | `d722a5aa8e3f78d547a48aa269aaf12072b0882883a9da8563e4bcc6461575a7` |

The manifest records base revision
`a6bf6cb9713deaf6f4cef4f88be4998efde14578`, the captured dirty patch,
resolved models and effort, harness versions, seed, trial count, threshold,
result paths, and cell exit states. Repository-wide invariant coverage after
the change is valid: 286 invariants, 163 covered, 123 uncovered, with no
unknown references or duplicate definitions. Coverage records that the new
activation contract is exercised; it does not establish the live result by
itself.

This snapshot's final hashes and conclusions were knowable only after the run,
so its published narrative bytes necessarily postdate the launch-state patch;
the captured patch contains the pre-run draft. No runner, specification, eval,
plugin, or suite bytes changed between patch capture and the live trials.

Regenerating the Markdown report from the manifest and result bundles produced
the same report hash byte for byte. Earlier current-format N=3 bundles were
superseded after evidence-retention, probe-validation, and provider-accounting
hardening; all claims above use only the final bundle and its recorded patch.

## Limitations

- Three trials per route support a local reliability observation, not a
  universal claim across prompt distributions or future model and CLI versions.
- The Codex observation is a controlled skill-body-read probe, not a native
  invocation event. A future direct event should replace it if the host exposes
  one reliably.
- The suite covers one negative target and two sibling competitions. It does
  not establish marketplace-wide precision across every installed plugin.
- A correct primary activation does not prove that subsequent composition is
  correct or that the loaded skill follows its workflow; outcome checks remain
  an independent evidence axis.
- No condition-blind judge ran. Outcome claims here are limited to the existing
  deterministic checks.
- Harness token and cost values remain comparable only within the same
  harness, model, effort, and case. Codex provider cost is unknown.
