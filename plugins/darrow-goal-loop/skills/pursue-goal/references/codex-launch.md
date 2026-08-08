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
selected `model` and `effort`. Before activation, validate a policy-sourced
handoff against the bundled profile mapping and a user-sourced handoff against
the explicit request; validate either route against the live model catalog. An
accepted `turn/start` response is the route application boundary. Confirm that
exact route with `--applied-by host-api`, record `host_api`, and count zero
children. Do not try to discover or connect to an enclosing app-server socket
from a repository shell.

**Complete when:** the existing thread owns the persisted goal and the work turn
reports the selected model and effort.

## Nested compatibility session

Use this only when same-thread goal control is unavailable or cannot honor the
selected route. Put the complete contract in a private temporary file
outside the repository, then run:

```sh
bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --provider "$provider" \
  --model "$model" --effort "$effort"
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
result. Never describe it as a same-thread continuation.

**Complete when:** the launch tool call has completed with exit zero, its route
record matches the selected route, the one nested session has reached a
terminal result, and no temporary contract remains.
