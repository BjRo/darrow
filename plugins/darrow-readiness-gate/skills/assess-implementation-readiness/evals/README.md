# Implementation-readiness comparison

## Representative request matrix

| Request class                     | Case                                  | Expected boundary                                                      |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------- |
| Direct readiness request          | `readiness-ready-concise-request`     | Assess and return the default human-readable result                    |
| Indirect readiness request        | `readiness-needs-discovery`           | Select the gate without planning or implementing                       |
| Incomplete authoritative input    | `readiness-blocked-missing-input`     | Report `blocked` without inventing the ticket                          |
| Negative implementation intent    | `readiness-no-trigger-implementation` | Implement without claiming a readiness result                          |
| Negative planning intent          | `readiness-no-trigger-planning`       | Plan without claiming a readiness result                               |
| Plausible detailed counterexample | `readiness-quality-bar-gap`           | Reject detail that still lacks product behavior and an inspectable bar |
| Pressure case                     | `readiness-rubber-stamp-pressure`     | Preserve the honest blocking verdict                                   |
| Explicit machine consumer, ready  | `readiness-json-explicit-ready`       | Preserve a ready verdict in one extractable, schema-valid v1 object    |
| Explicit machine consumer, gated  | `readiness-json-explicit`             | Preserve a non-ready verdict in the same explicit v1 representation    |

The baseline development snapshots predate the final output-mode contract and
are single-trial evidence, not a controlled Markdown-versus-JSON comparison.
They showed that otherwise useful Claude results could fail on surrounding
presentation text or composed outer records, while Codex was more consistent.
Treat those observations as the regression motivation, not as a comparative
quality claim.

The two explicit-JSON cases use the same authoritative requests as the default
human-readable `readiness-ready-without-plan` and `readiness-needs-decision`
cases, respectively. The composed-ready case observes the authorized outcome
and terminal gate evidence, but the host's final-message eval surface cannot
prove the internal timing of the ready/quality-bar handoff; treat that ordering
as an instructed contract rather than a directly observed metric.

Run the readiness cases against an unchanged host and the candidate skill with
the same harness, model, effort, fixtures, prompts, checks, and trial count:

```sh
cd evals
bun runner/run.ts --case readiness- --harness codex --trials 3 --without-skill
bun runner/run.ts --case readiness- --harness codex --trials 3
bun runner/compare.ts <baseline-result.json> <candidate-result.json>
```

Repeat the pair with `--harness claude`. Report trial count, verdict accuracy,
false-ready and false-not-ready cases, tokens, wall time, and limitations. The
current shared runner records ordinary pass/fail, token, cost, and wall-time
metrics; classify verdict errors from the per-case checks until dedicated
readiness metrics are added. Do not compare unmatched routes or trial counts.
