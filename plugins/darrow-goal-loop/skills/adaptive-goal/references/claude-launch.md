# Claude native-goal launch

Use the first boundary that can honor the compiled route.

## Same thread

When the current Claude surface exposes native goal control to the agent, read
its concrete active route and require `confirm-route` to accept the selected and
effective routes before setting the compiled contract as the current thread's
goal. Record `same_thread`, `current-thread`, verified true, and zero children.

Do not treat a `claude` executable on `PATH` as evidence of same-thread control.

**Complete when:** the current thread reports the contract as its active native
goal and the selected route is effective.

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

Invoke the `Agent` tool exactly once with:

- `subagent_type` set to that exact namespaced runner;
- `run_in_background` set to `false`;
- no per-invocation `model` override, because the selected full model ID and
  effort are pinned together in the runner definition;
- no `resume` or worktree isolation; and
- a self-contained task containing the complete goal contract plus the exact
  selected workflow document, its absolute path, identifier, and content hash.

Tell the runner to own the contract through terminal completion, run the
workflow and risk gates, and return the required final record. The runner may
use host-native subagents for bounded work, but it remains the sole goal owner
and must not create another Darrow runner.

After live catalog and environment validation, the accepted foreground Agent
call identifies the exact immutable plugin-agent definition that applies both
model and effort. Prompt text and runner self-report prove neither. Confirm the
selected route with `--applied-by native-subagent`, then record:

```text
launch_boundary\tnative_subagent
route_applied_by\tnative-subagent
route_verified\ttrue
evaluation_child_invocations\t1
```

Wait for that same foreground Agent call to return. Do not launch a second
runner or substitute a nested process after the child has started.

Claude does not expose its session-scoped `/goal` command as an Agent tool or a
child-session API. The delegated contract is therefore the native Agent
runner's task, not an undisclosed `/goal` evaluator. Do not claim `/goal`
persistence, evaluator turns, or status telemetry for this boundary.

**Complete when:** the accepted Agent call names the exact selected-route
runner, the visible runner returns terminally, and its result proves the
contract and final-tree checks complete.

## Enclosing launcher

An external client that performed preflight before starting Claude may invoke
one native `/goal` session with:

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
