# Issue 34 hook-recovery comparison

This comparison evaluates the `ticket-to-pr-e6-recovery` repair for
[issue 34](https://github.com/BjRo/darrow/issues/34). The control and candidate
used the same current case YAML, prompt, fixture, hidden checks, eval runner,
`adaptive-goal` source, Codex CLI 0.147.0, `gpt-5.5` model, medium effort,
explicit entrypoint, 80% threshold, and three trials. Only the mounted
`ticket-to-pr` skill changed: the control archived the skill from base
`ffe707147abd5612ff8ac4ecd4d6d8303acf2560`, while the candidate mounted the
repaired working-tree skill.

| Variant            |  Task pass | Required activation | Wall mean / p95 | Mean tokens |
| ------------------ | ---------: | ------------------: | --------------: | ----------: |
| Base skill control |   0/3 (0%) |          3/3 (100%) | 243.7s / 273.4s |     757,786 |
| Repaired candidate | 3/3 (100%) |          3/3 (100%) | 254.5s / 262.3s |     694,390 |

The control failed the exact terminal-state report in every trial. One control
trial additionally failed to create the expected preserved branch/index state
or a valid stopped-goal route record. The candidate preserved the deliberate
base, ticket branch, intended staged file, worktree, and single failed hook
attempt in every trial; it emitted no prohibited recovery-command evidence and
reported the exact durable state without claiming successful delivery.

Both variants used this runner shape, substituting only `--skill-dir`:

```sh
cd evals
bun runner/run.ts \
  --harness codex \
  --model gpt-5.5 \
  --effort medium \
  --trials 3 \
  --threshold 0.8 \
  --case ticket-to-pr-e6-recovery \
  --case-exact \
  --skill-dir <control-or-candidate-ticket-to-pr-skill> \
  --additional-skill-dir ../plugins/orchestration/darrow-goal-loop/skills/adaptive-goal \
  --required-skill-activations '{"ticket-to-pr-e6-recovery":["adaptive-goal"]}' \
  --entrypoint '$darrow-ticket-to-pr:ticket-to-pr'
```

The archived control plugin received the current
`tpr-e6-recovery.yaml` before execution so both variants were judged by the
same contract. Raw result bundles remain gitignored.

Limitations: this is one safety-critical case on Codex rather than the full
cross-host matrix. The runner reported tokens but not provider cost, and no
advisory LLM judge was used. Three stochastic trials establish the configured
gate but do not prove universal recovery behavior; deterministic adapter,
fixture, shell, type, lint, and full-runner tests cover the declared command
and host-protocol variants separately.
