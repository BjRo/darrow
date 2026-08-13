# Ticket-to-PR evaluation suites

The suites keep three evidence questions separate:

- `activation-suite.yaml` measures explicit selection boundaries only;
- `candidate-suite.yaml` runs every TPR-E1–TPR-E13 behavior variant with the
  candidate recipe; and
- `suite.yaml` compares one designated representative for each TPR-E1–TPR-E13
  group across the candidate, raw adaptive-goal, and ticket-pipeline modes.
  Only the candidate cells are gating in the comparative suite. The two baselines
  are marked `gating: false`, so a baseline contract failure stays visible in the
  manifest and report without invalidating a passing candidate gate.

Every comparative case contains one `{{entrypoint}}` placeholder. The suite
substitutes the host-qualified invocation for the mounted mode and records that
adapter beside the common workload digest. No other participant input or hidden
check changes between modes.

Claude print mode records `claude_headless_explicit_bridge` when the runner
removes an explicit-only guard from the mounted copy after seeing the workload's
explicit entrypoint. This is a disclosed transport adapter, not native slash-
command evidence; the source skill and non-explicit cases remain unchanged.
Unguarded controls use the separately recorded
`claude_headless_model_invocation` transport.

Use `--trials 1 --no-judge` for the progressive calibration documented beside
the skill evals. Use `--trials 3` for tracked release evidence. Raw result
bundles remain gitignored under `evals/results/`.
