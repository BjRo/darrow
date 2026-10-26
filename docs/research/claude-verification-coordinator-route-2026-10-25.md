# Claude verification coordinator route (2026-10-25)

Adaptive Goal's Claude verification coordinator moved from Opus 5.5/high to
Sonnet 5.5/medium after a matched comparison on PR #269.

## Setup

- Case: `goal-review-high-selected-claude` (high-risk change, required
  independent review through verification).
- Two worktrees at commit `b09bb0fc`, identical except the verification
  coordinator route in `SKILL.md` and `references/claude-launch.md`.
- Claude Code 2.1.309, candidate main thread `claude-sonnet-5-5/medium`,
  `--owner-evaluation passive`, 2 trials per variant, run sequentially.

## Results

| Verification coordinator | Pass | Avg candidate time | Avg cost |
| ------------------------ | ---- | ------------------ | -------- |
| Opus 5.5/high            | 1/2  | 327 s              | $1.88    |
| Sonnet 5.5/medium        | 2/2  | 222 s              | $1.35    |

The Opus failure was an empty final message that failed the two report
propositions. The same empty-final-message failure also appeared on `main`
before this branch, so it is not specific to the route.

## Limitations

Two trials per variant is a small sample. The decision follows the
middle-tier rule for coordinators (Sol/medium on Codex): coordination broke
more often on Luna and Sonnet/low, and nothing here showed Sonnet/medium
performing worse than Opus/high.
