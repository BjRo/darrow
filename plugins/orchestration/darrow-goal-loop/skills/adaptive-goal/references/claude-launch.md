# Claude native-goal launch

Use the first boundary that can honor the compiled route.

## Materialize the native objective

For a boundary whose goal owner shares this filesystem, put the complete
contract in a private temporary staging file outside the repository and run:

```sh
bash "$goal_loop" materialize-objective --repo "$repo" \
  --goal-file <absolute-contract-file>
```

Use the exact returned `objective_file`: it contains the complete contract
inline through 4,000 bytes or a bounded path-and-SHA-256 objective above that
limit. A file-backed owner reads and verifies the complete contract before
work. Stop before activation if materialization fails. Never truncate or
recompact after a size rejection, and never retry the goal or Agent call after
one begins. Keep any returned attachment readable through paused states and the
terminal result, then release it only with:

```sh
bash "$goal_loop" release-objective \
  --attachment-dir <exact-helper-returned-attachment-dir> \
  --expected-sha256 <exact-helper-returned-contract-sha256>
```

Do not reconstruct deletion commands.
If the launcher fails after activation without confirming a terminal result,
retain the attachment and report the goal identifier, exact attachment path,
and expected digest as resumable lifecycle evidence; do not remove the contract
from a still-active or paused goal. Once terminal status is confirmed, release
the attachment even if later result collection fails.
Remove the caller-created staging file after activation accepts an inline
objective; in file-backed mode it may be removed as soon as materialization
succeeds because the helper has already made and verified its private copy.

## Same thread

When the current Claude surface exposes native goal control to the agent, read
its concrete active route and require `confirm-route` to accept the selected and
effective routes before setting the compiled contract as the current thread's
goal. Set the exact materialized objective rather than an oversized inline
contract. Record `same_thread`, `current-thread`, verified true, and zero
children.

If a material decision first emerges after activation, leave the goal active,
pause repository and external mutation, and ask the user the smallest concrete
question. Pending feedback is neither completion nor blockage. Continue the
same goal after the explicit answer arrives, count the question once, and keep
any file-backed objective attached while paused.

Do not treat a `claude` executable on `PATH` as evidence of same-thread control.

**Complete when:** the current thread reports the materialized objective as its
active native goal and the selected route is effective.

## Observable native Agent runner

When same-thread activation cannot honor the selected route and the runtime
exposes Claude's `Agent` tool, use one plugin-shipped Adaptive Goal Loop runner.
This is a host-visible Claude subagent, not a recursive CLI process.

Reject the boundary before spawning when any of these conditions holds:

- the selected harness is not `claude` or the active provider differs from the
  selected provider;
- live host metadata does not prove that the selected concrete model and effort
  are available without substitution;
- the exact selected model/effort tuple has no runner in the table below;
- `CLAUDE_CODE_SUBAGENT_MODEL` is set to any value other than the selected
  concrete model; or
- `CLAUDE_CODE_EFFORT_LEVEL` is set to any value other than the selected effort.

`inherit` is not accepted because older Claude Code versions interpret it as a
forced parent-model override. `auto` is not concrete effort evidence. A
conflicting environment override wins over agent frontmatter, so it is a stop
rather than a silent substitution.

Resolve the runner and validate those environment boundaries before invoking
Agent:

```sh
claude_agent_route="$skill_dir/../../bin/claude-agent-route"
bash "$claude_agent_route" --provider "$provider" \
  --model "$model" --effort "$effort"
```

Use the exact `subagent_type` and absolute `agent_file` from that output. A
nonzero exit is `launch_required`; do not spawn anyway.

Select exactly one namespaced runner from the exact selected route:

| Selected model    | Effort   | `subagent_type`                                  |
| ----------------- | -------- | ------------------------------------------------ |
| `claude-sonnet-5` | `low`    | `darrow-goal-loop:adaptive-goal-sonnet-5-low`    |
| `claude-sonnet-5` | `medium` | `darrow-goal-loop:adaptive-goal-sonnet-5-medium` |
| `claude-opus-5`   | `high`   | `darrow-goal-loop:adaptive-goal-opus-5-high`     |

These runners cover every bundled Claude policy route. A repository override or
explicit user route with another tuple requires a supported same-thread/API
boundary or stops as `launch_required`; do not reduce a full model ID to a
family alias.

Materialize the objective before invoking the `Agent` tool exactly once with:

- `subagent_type` set to that exact namespaced runner;
- `run_in_background` set to `false`;
- no per-invocation `model` override, because the selected full model ID and
  effort are pinned together in the runner definition;
- no `resume` or worktree isolation; and
- a self-contained task containing the exact materialized objective and, when
  file-backed, its absolute contract path and expected SHA-256, plus the exact
  selected workflow document, its absolute path, identifier, and content hash.

Tell the runner to read and verify a file-backed complete contract before work,
own the contract through completion or a material-feedback pause, run the
workflow and risk gates, and return the contract's human-readable final report
without reproducing its internal tab-separated record. When a material
decision first emerges after activation, it pauses mutation and sends the
smallest concrete question to its creator through host parent messaging when
available. The creator surfaces the question to the user and relays the exact
answer to that same runner without launching a replacement. Pending feedback
is neither completion nor blockage, and each distinct user question counts
once. If this Agent boundary exposes no usable feedback relay, the runner
returns the pending question and resumable lifecycle facts without further
mutation; the launcher retains the objective attachment and reports the pause
honestly. Preserve the
contract's exact `Independent review: selected|omitted — reason` clause in the
task. When selected, tell the runner explicitly to confirm the compatible
capability before product edits, invoke it after final-tree checks, and report
its outcome and any blocking findings. Do not require a provider-specific
serialization. The runner may use host-native subagents for bounded work, but
it remains the sole goal owner and must not create another Darrow runner.

Wait for that same foreground Agent call to return, then verify what actually
ran before recording anything. Selecting a namespaced `subagent_type` whose
frontmatter pins a model is necessary but not sufficient evidence that the
host applied it: the Agent call can be accepted and run to completion on a
different model than its own frontmatter names, and a misrouted runner will
still confidently self-report the selected model. Prompt text and runner
self-report prove neither model nor effort. Derive the effective route from
the child's own transcript instead:

Before interpreting the child as terminally successful, also reconcile its
result against the compiled independent-review clause. A selected gate requires
evidence of one comprehensive initial review and, after any repair, a closed-set
fix-verification chain whose prior artifacts and pinned repair deltas remain
continuous and that is clear for the exact final content. Preserve edits
but report the run incomplete or blocked when verification was unavailable,
inconclusive, no-progress, explicitly capped, or left blockers or regressions,
even if deterministic checks passed or route verification separately failed.
Interpret the capability's ordinary response; do not parse or reproduce its output format.

```sh
claude_verify_route="$skill_dir/../../bin/claude-verify-route"
bash "$claude_verify_route" --repo "$repo" --agent-id "$agent_id"
```

`$agent_id` is the id the Agent tool result reports for this call. Feed the
resulting `observed_route` into the existing confirmation gate rather than
asserting the selected route back at it:

```sh
bash "$goal_loop" confirm-route \
  --selected  'claude|anthropic|<model>|<effort>' \
  --effective 'claude|anthropic|<observed-model>|<observed-effort>' \
  --applied-by native-subagent
```

If `claude-verify-route` finds no transcript evidence, or `confirm-route`
rejects the pair because the observed route does not match the selected one,
this boundary has failed even though the Agent call itself succeeded. In that
case:

- do not record `route_verified: true`, and do not report the child's work as
  having run on the selected route;
- when no transcript route is observable, use `harness: claude`,
  `model: anthropic > unknown`, and `effort: unknown` in the human report; when
  a mismatched route is observable, report that exact effective harness,
  provider, model, and effort. Never copy the selected model or effort into the
  report after failed verification;
- preserve whatever the child already wrote to the working tree without
  discarding it silently, and tell the user plainly which model actually ran
  instead of the selected one, citing the observed route;
- record `launch_required`, naming the unavailable capability (for example,
  "claude-opus-5 is not currently applicable through this subagent boundary on
  this host/account — it silently substituted claude-sonnet-5"); and
- stop rather than continue the contract as if the selected route had run. A
  failed verification is a stop, not a retry loop — do not launch a second
  runner or substitute a nested process to try again.

Only once `confirm-route` accepts a real, transcript-derived effective route
equal to the selected route may you record:

```text
launch_boundary\tnative_subagent
route_applied_by\tnative-subagent
route_verified\ttrue
evaluation_child_invocations\t1
```

Do not launch a second runner or substitute a nested process after the child
has started.

Claude does not expose its session-scoped `/goal` command as an Agent tool or a
child-session API. The delegated contract is therefore the native Agent
runner's task, not an undisclosed `/goal` evaluator. Do not claim `/goal`
persistence, evaluator turns, or status telemetry for this boundary.

**Complete when:** the accepted Agent call names the exact selected-route
runner, the visible runner returns terminally, `claude-verify-route` plus
`confirm-route` prove the observed transcript route equals the selected route,
and the result proves the contract and final-tree checks complete.

## Enclosing launcher

An external client that performed preflight before starting Claude may invoke
one native `/goal` session with the complete staging file; the launcher
materializes the bounded objective before starting the process:

```sh
bash "$goal_loop" launch --host claude --repo "$repo" \
  --goal-file "$goal_file" --provider "$provider" \
  --model "$model" --effort "$effort" --allow-nested
```

This boundary is not available to a skill already running inside Claude:
recursive Claude processes may not inherit the active session's authentication
or control state. `--allow-nested` must reflect explicit user authorization; it
is never inferred from route mismatch. An enclosing launcher records
`nested_session` and one child, waits for the result, and removes the temporary
contract.

**Complete when:** the external launcher—not an active Claude agent—owns the one
session and its authentication is proven before product work begins.

## Unavailable launch

When the active Claude surface exposes neither matching same-thread goal
control nor the required Agent runner, preserve the compiled contract, record
`launch_required`, name the missing capability, and stop without editing product
files. Do not probe a recursive `claude` process with a paid model call.

**Complete when:** the user has one exact external launch action rather than a
simulated or unauthenticated goal run.
