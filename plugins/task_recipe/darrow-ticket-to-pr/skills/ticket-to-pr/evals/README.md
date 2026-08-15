# Ticket-to-PR eval matrix

These cases cover the explicit activation matrix and TPR-E1–TPR-E11 public
behavior. Prompts are participant-visible; repository and output checks are the
hidden assertions. Behavior cases use `{{entrypoint}}` as the only mode- and
host-specific prompt seam.

The tracked comparative suite selects one representative case for each of
TPR-E1–TPR-E11 and runs the candidate, raw adaptive-goal control, and ticket-
pipeline control against the same workload template, fixture, checks, model,
effort, and trial count. The suite records the exact qualified entrypoint
substituted for each host and mode. This is a matched comparative benchmark,
not a strict skill ablation.

Activation is graded only by the five `activation-*.yaml` cases. Claude's
direct Skill event is preferred. Codex may use a visible completed skill read;
otherwise the runner uses the private activation sentinel injected only into
the mounted evaluation copy. Behavior cases are never failed by an unavailable
activation channel.

Claude's print-mode CLI does not apply interactive slash-command preprocessing.
For a workload containing `{{entrypoint}}`, the runner therefore removes
`disable-model-invocation` from the mounted evaluation copy only and records
`claude_headless_explicit_bridge` as the transport. The source skill and every
negative or natural-language case retain the production guard.
Unguarded controls record `claude_headless_model_invocation` instead, so reports
do not claim that the explicit-only bridge changed those mounted copies.

Run the progressive calibration before the full three-trial matrix:

```sh
cd evals
bun runner/suite.ts --suite experiments/ticket-to-pr/activation-suite.yaml --trials 1 --no-judge
bun runner/suite.ts --suite experiments/ticket-to-pr/candidate-suite.yaml --case ticket-to-pr-e2-authoritative-intake --trials 1 --no-judge
bun runner/suite.ts --suite experiments/ticket-to-pr/candidate-suite.yaml --case ticket-to-pr-e1-ready-delivery --trials 1 --no-judge
bun runner/suite.ts --suite experiments/ticket-to-pr/suite.yaml --case ticket-to-pr-e2-authoritative-intake --trials 1 --no-judge
```

After those probes pass structurally, run the tracked comparative suite with
`--trials 3` and the candidate edge suite with `--trials 3`. Smaller samples do
not satisfy or weaken that release gate.

Forge CLIs are fail-closed unless a case explicitly supplies a fixture-local
mock; Git publication cases use local bare remotes.

The runner also compares the selected branch, every repository ref, index,
tracked files, and untracked files for no-mutation cases. Cases that explicitly
create repository state declare that expectation and assert the exact intended
state separately. Terminal cases check concise outcomes and tie successful
publication facts to fixture-visible state.

Harness environments inherit model-provider authentication only. They omit
forge tokens, host forge config, SSH agents, and interactive Git helpers; the
outer macOS sandbox denies discovered real forge executables. Evaluating
adversarial skill content that might exfiltrate provider credentials through an
arbitrary network client still requires a separately managed egress boundary.
