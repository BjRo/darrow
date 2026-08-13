# Codex native-goal launch

Use the first boundary that can honor the compiled route.

## Same thread

When the current runtime exposes `create_goal`, obtain the concrete active
provider, model, and effort from host metadata. Confirm the exact match before
activation:

```sh
bash "$goal_loop" confirm-route --selected "$selected_route" \
  --effective "$active_route" --applied-by current-thread
```

Only after that succeeds, call
`create_goal` exactly once with the complete goal contract as `objective`.
Supply a token budget only when the user specified one. Continue in the same
thread and record:

```text
launch_boundary\tsame_thread
route_applied_by\tcurrent-thread
route_verified\ttrue
evaluation_child_invocations\t0
```

Do not create a child agent or shell process around this boundary.

The prompt, route table, and model defaults are not active-route metadata.
`inherit` is a launch choice, not a model identifier. If the selected and active
routes differ, do not use this boundary.

**Complete when:** `get_goal` shows the compiled objective active on the current
thread and its concrete route is the selected route.

## Supported host API

When the enclosing client exposes Codex app-server thread control, set the goal
on the current thread with `thread/goal/set`, then start the work turn with the
selected workflow document, `model`, and `effort`. Before activation, validate
a policy-sourced handoff against the prepared active-worktree profile mapping
(with `repository` or `bundled` provenance) and a user-sourced
handoff against the explicit request; validate either route against the live
model catalog. Resolve the workflow document from the helper's prepared
evidence, hash the exact content loaded into the execution turn, and record the
workflow identifier, path, and hash with that receiving turn. An accepted
`turn/start` response is the route
application boundary. Confirm that exact route with `--applied-by host-api`,
record `host_api`, and count zero children. Do not try to discover or connect to
an enclosing app-server socket from a repository shell.

**Complete when:** the existing thread owns the persisted goal and the work turn
reports the selected model and effort.

## Observable native goal runner

When in-place activation cannot honor the selected route and the runtime
exposes both `spawn_agent` and `close_agent`, prefer one first-class Codex agent
thread over a shell process. Confirm that the spawn tool accepts the selected
concrete model and reasoning effort, that the close tool can close the spawned
thread, and that the Codex provider already matches. A spawn-only surface is
not this boundary: stop as `launch_required` instead of creating a thread that
cannot be cleaned up. An unavailable user-pinned route stops; a policy route
may use only its declared fallback.

Spawn exactly one agent with:

- task name `adaptive_goal_runner`;
- `fork_turns` set to `none`, so explicit model and effort overrides are valid;
- `model` and `reasoning_effort` set to the selected concrete values; and
- a self-contained message containing the complete goal contract plus the
  exact selected workflow document, its absolute path, identifier, and content
  hash.

Tell the runner to call `create_goal` exactly once with the contract, own that
goal through terminal completion, run the workflow and risk gates, and return
the required final record. The runner may use native Codex subagents for
bounded work when useful, but remains the sole goal owner. Tell it to collect
each descendant's result and call `close_agent` on that descendant as soon as
no follow-up is needed. It must not leave completed descendant threads open.
Do not prescribe planner, executor, verifier, or repair roles, and do not
create another Darrow runner beneath it.

An accepted spawn request with explicit route values is route-application
evidence. Confirm the exact route with `--applied-by native-subagent`, record:

```text
launch_boundary\tnative_subagent
route_applied_by\tnative-subagent
route_verified\ttrue
evaluation_child_invocations\t1
```

Wait for that same agent to finish and collect its terminal result. Then call
`close_agent` on the runner's exact thread before returning to the user. The
completed close call must target the same thread created by the accepted spawn;
self-report is not cleanup evidence. Use host collaboration events or status to
confirm that every observed descendant spawn also has one later completed close
for that same thread. If descendant cleanup cannot be observed, it is not
verified. If the runner becomes unnecessary while still active, use the host's
stop or interrupt control, wait for a terminal state, and close it. If closing
fails, report the cleanup failure and do not claim complete. The host UI exposes
the runner and any native descendants for inspection while they are needed.
Descendants are native goal delegation, not additional Darrow child
invocations. Do not run a shell process around the agent or substitute its
prompt self-report for accepted spawn or close evidence.

**Complete when:** the accepted spawn matches the selected route, the visible
runner owns the one persisted goal, and its terminal result proves the contract
and final-tree checks complete, every descendant it created has been closed,
and the parent has successfully closed the runner thread.

## Explicit nested compatibility session

This boundary is for a supported enclosing launcher only after the user
explicitly authorizes process nesting. An interactive skill must not infer that
authorization from route mismatch. Put the complete contract in a private
temporary file outside the repository, then run:

```sh
bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --provider "$provider" \
  --model "$model" --effort "$effort" --allow-nested
```

Replace every placeholder with its literal value. In particular,
`--goal-file` must receive the absolute path returned when the file was created;
do not reference a shell variable assigned in another tool call.

Run this as one foreground command. If the command tool yields, wait on that
same process or command session and make no other tool call. The launcher
applies provider, model, and effort to `codex exec`, requires a successful
nested turn, then emits `nested_result_begin`/`nested_result_end` and the
effective-route record. Partial edits, a populated result file, or a running
process are not completion evidence. Use the emitted record verbatim, record
`nested_session`, and count one child invocation. Only after the launch call
itself exits zero may you remove the temporary contract and return the delimited
result. Never describe it as a native subagent or same-thread continuation.

**Complete when:** the explicitly authorized launch call exits zero, its route
record matches the selected route, the one nested session reaches a terminal
result, and no temporary contract remains.
