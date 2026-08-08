# Codex native-goal launch

Use the first boundary that can honor the compiled route.

## Same thread

When the current runtime exposes `create_goal` and the selected model and effort
match the active thread, call
`create_goal` exactly once with the complete goal contract as `objective`.
Supply a token budget only when the user specified one. Continue in the same
thread and record:

```text
launch_boundary\tsame_thread
evaluation_child_invocations\t0
```

Do not create a child agent or shell process around this boundary.

Resolve the active model's concrete identifier before recording the route;
`inherit` is a launch choice, not a model identifier.

**Complete when:** `get_goal` shows the compiled objective active on the current
thread and its concrete route is the selected route.

## Supported host API

When the enclosing client exposes Codex app-server thread control, set the goal
on the current thread with `thread/goal/set`, then start the work turn with the
selected `model` and `effort`. Record `host_api` and zero children. Do not try to
discover or connect to an enclosing app-server socket from a repository shell.

**Complete when:** the existing thread owns the persisted goal and the work turn
reports the selected model and effort.

## Nested compatibility session

Use this only when same-thread goal control is unavailable or cannot honor an
explicit selected route. Put the complete contract in a private temporary file
outside the repository, then run:

```sh
bash "$goal_loop" launch --host codex --repo "$repo" \
  --goal-file "$goal_file" --model "$model" --effort "$effort"
```

Wait for the command. Record `nested_session` and one child invocation. Remove
the temporary file after the session exits. Never describe it as a native child
or same-thread continuation.

**Complete when:** the one nested session has reached a terminal result and no
temporary contract remains.
