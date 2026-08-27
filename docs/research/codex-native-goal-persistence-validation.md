# Codex Native Runner Goal-Persistence Validation

Date: 2026-08-27  
Codex CLI: 0.149.1  
Codex Desktop native-agent route: `gpt-5.6-luna / medium`

## Conclusion

The Codex native-subagent fallback can keep one spawned thread as the sole work
owner while persisting the same contract as a native goal in that thread. The
candidate owner creates the goal only after the parent's activation signal,
confirms the exact objective before work, and settles it itself. Goal
persistence therefore does not introduce a second work owner.

## Matched native comparison

The control and candidate cells used the Codex Desktop native-agent API with
the same evaluator message, fixed worktree path, read-only objective,
activation message, post-run audit message, model, and effort. The only changed
input was the adaptive-goal skill and its local resources: the control loaded
commit `ddbc2a0`, while the candidate loaded the staged revision.

Both accepted owner threads received the exact activation message
`- phase: goal-owner-activated` and correctly reported that `docs/design.md`
rejects Darrow becoming a daemon or queue. Their persistence results differed:

| Cell      | Trials | `create_goal`                                     | Post-run `get_goal`         |
| --------- | -----: | ------------------------------------------------- | --------------------------- |
| Control   |      1 | Not called                                        | `goal: null`                |
| Candidate |      1 | Called exactly once and confirmed before the task | Exact objective, `complete` |

The candidate owner settled its own goal. Neither cell edited the repository,
spawned another agent, or performed an external mutation.

## Existing host-API control

The existing `goal-preflight-bounded-native-goal` eval was also run once on the
same evaluation digest
`435d46bc9e7dced95f50953b5466e6c09e49f970de2c97b5bf0191185c4175d5`, prompt,
checks, Codex CLI harness, `gpt-5.6-terra` model, and `medium` effort:

| Cell      | Pass rate | Duration |  Tokens | Children | Interruptions | Escaped defects |
| --------- | --------: | -------: | ------: | -------: | ------------: | --------------: |
| Control   |       1/1 | 58.632 s | 408,442 |        0 |             0 |               0 |
| Candidate |       1/1 | 75.295 s | 566,854 |        0 |             0 |               0 |

This confirms that the existing host-API route remains valid. The single-run
duration and token difference is not attributable and is not evidence of a
performance change.

## Failure-path evidence

Deterministic helper and contract tests cover the fail-closed paths:

- an unavailable or rejected `create_goal` records unavailable persistence,
  performs no product mutation, retains the accepted child count, releases the
  objective, and renders `launch_required`; and
- an accepted goal whose exact active state cannot be confirmed remains
  `goal-pending`; its owner and attachment are retained, and terminal cleanup
  or replacement is forbidden until the native goal's state is known.

The relevant gates run with both `bash` and `/bin/bash` and include
`goal-loop-step.test.sh`, `codex-launch.test.sh`, and
`goal-objective.test.sh`.

## Limits

- Each live comparison cell is N=1 and uses a deliberately bounded read-only
  task. It validates the ownership and persistence boundary, not reliability,
  implementation quality, or performance.
- Codex CLI 0.149.1 returns a UUID rather than the canonical child reference
  required by the activation protocol, so it cannot exercise the post-spawn
  native-agent handshake. The Desktop comparison is therefore the native-host
  evidence; the CLI eval covers the unchanged host-API path.
- The isolated matched native cell omits ledger recording so the owner-thread
  goal-control decision can be compared directly. A separate candidate-only
  Desktop probe exercised the complete helper lifecycle: parent activation,
  child `create_goal`, child `get_goal`, `goal-state active`, child
  `update_goal complete`, parent wait and cleanup, and a canonical report with
  one child and confirmed persistence.
- Provider controls do not offer deterministic injection of an accepted
  `create_goal` followed by an unavailable or mismatched `get_goal`. Those
  ambiguous-state rules are covered by deterministic contract checks rather
  than a live fault-injection trial.
