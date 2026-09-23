# Adaptive Delivery Luna owner routes: trials for issue #231

On 2026-09-23, [issue #229](https://github.com/BjRo/darrow/issues/229)
established that a GPT-6 Luna Codex agent could spawn one child. This trial
checked whether Luna could own routine Adaptive Delivery work, including a
goal that requires independent review.

## Method

- Host: Codex CLI 0.156.1, with the evaluation candidate parent fixed at
  `gpt-5.6-terra` / medium and passive owner observation.
- Control: bundled `routine` owner route `gpt-5.6-terra` / medium on the
  unchanged policy.
- Candidate: bundled `routine` owner route `gpt-6-luna` / medium. The parent,
  prompts, fixtures, outcome checks, and harness settings remained the same;
  the route assertion expected the candidate model.
- Cases: `goal-preflight-mechanical-native-goal` (small exact edit) and
  `goal-preflight-high-risk-routine` (localized security setting with bound
  verification and independent review). Each execution asserted the owner's
  effective model and effort from native host evidence.

## Results

| Case                                      | Terra control | Luna candidate         |
| ----------------------------------------- | ------------- | ---------------------- |
| Mechanical edit                           | Pass, 1m07s   | Pass, 1m18s            |
| High-risk routine with independent review | Pass, 7m13s   | Pass, 14m56s on repeat |

The first Luna high-risk run stopped in parent preflight after 22.6 seconds.
The parent reported that only Python 3.9.6 was available, so it did not launch
an owner. The unchanged Terra control and the repeated Luna run completed in
the same harness. This first Luna attempt is a failed trial and supplies no
evidence about Luna's owner behavior.

The passing Luna review run observed exactly one `gpt-6-luna` / medium owner.
Its final checks confirmed a canonical clear independent-review artifact and
completion against the exact final worktree. Both passing cases observed the
selected effective owner route.

## Routine-plus trial

The `goal-preflight-quality-sensitive-localized` case tests a specified edit
whose semantic-version boundaries make first-pass correctness important. With
the same Codex CLI, parent model, prompt, fixture, outcome checks, and passive
owner observation, Terra/high passed in 1m28s and Luna/high passed in 1m56s.
Native evidence confirmed the effective owner route in each run. This is one
trial per route and covers the boundary-correctness part of `routine-plus`, not
all work with competing implementations.

An independent review found that the first hidden check did not reject a
leading zero in the third component (`1.2.03`). The check and its mutation
probe now cover that counterexample. A fresh Luna/high trial passed the revised
case in 1m42s with the effective owner route confirmed. The Terra/high control
was not rerun against the revised check, so the 1m28s versus 1m56s comparison
applies only to the original common checks.

The seven passing runs each used one trial. Child-inclusive token accounting was
incomplete, so these results do not establish relative cost. The timing
differences are observations from single runs, not latency estimates. Luna is
viable as a native owner for these cases; further matched trials are needed
before claiming reliability, speed, or cost benefits from either new default.

Local result records (gitignored) are:

- Terra mechanical: `evals/results/2026-09-23T10-14-53-303Z-codex-gpt-5.6-terra-medium.json`
- Terra high-risk: `evals/results/2026-09-23T10-16-11-749Z-codex-gpt-5.6-terra-medium.json`
- Luna mechanical: `evals/results/2026-09-23T10-28-04-182Z-codex-gpt-5.6-terra-medium.json`
- Luna high-risk preflight stop: `evals/results/2026-09-23T10-29-33-302Z-codex-gpt-5.6-terra-medium.json`
- Luna high-risk pass: `evals/results/2026-09-23T10-30-58-519Z-codex-gpt-5.6-terra-medium.json`
- Terra routine-plus: `evals/results/2026-09-23T11-21-12-316Z-codex-gpt-5.6-terra-medium.json`
- Luna routine-plus: `evals/results/2026-09-23T11-23-37-529Z-codex-gpt-5.6-terra-medium.json`
- Luna routine-plus with the revised check: `evals/results/2026-09-23T11-31-20-850Z-codex-gpt-5.6-terra-medium.json`
