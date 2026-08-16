# Codex native-goal launch

Use the first boundary that can honor the compiled route.

## Materialize the native objective

Before a same-thread, host-API, native-runner, or shared-filesystem nested goal
activation, put the complete compiled contract in a private temporary staging
file outside the repository. Preserve it byte-for-byte; this is the contract,
not a lossy summary or a separate plan. Run:

```sh
bash "$goal_loop" materialize-objective --repo "$repo" \
  --goal-file <absolute-contract-file>
```

Use the returned absolute `objective_file` as the exact native goal objective.
The helper reports `inline` when the complete contract is at most 4,000 bytes.
Above that limit it copies the complete contract to a private attachment,
hashes it with SHA-256, and writes a bounded objective that requires the goal
owner to read and verify the attachment before work. Stop before activation if
the helper fails, any returned file is unreadable, or the objective exceeds
4,000 bytes.

Perform this materialization before the first `create_goal` call. Call the goal
surface exactly once with the materialized objective. Do not retry `create_goal`
after a size rejection, recompact the contract after rejection, or truncate it.
Keep a returned attachment directory readable until the goal reaches a
terminal state, including paused and native continuation turns; then run:

```sh
bash "$goal_loop" release-objective \
  --attachment-dir <exact-helper-returned-attachment-dir> \
  --expected-sha256 <exact-helper-returned-contract-sha256>
```

Do not reconstruct deletion commands. The receiving goal owner must share this
filesystem. If it does not, use a complete inline contract or stop honestly.
If the launcher fails after activation without confirming `complete` or
`blocked`, retain the attachment and report the thread identifier, exact
attachment path, and expected digest as resumable lifecycle evidence; do not
remove the contract from a still-active or paused goal. Once terminal status is
confirmed, release the attachment even if later result collection fails.
Remove the caller-created staging file after activation accepts an inline
objective; in file-backed mode it may be removed as soon as materialization
succeeds because the helper has already made and verified its private copy.

## Same thread

When the current runtime exposes `create_goal`, obtain the concrete active
provider, model, and effort from host metadata. Confirm the exact match before
activation:

```sh
bash "$goal_loop" confirm-route --selected "$selected_route" \
  --effective "$active_route" --applied-by current-thread
```

Only after that succeeds and objective materialization has completed, call
`create_goal` exactly once with the exact contents of `objective_file` as
`objective`.
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

**Complete when:** `get_goal` shows the materialized objective active on the
current thread and its concrete route is the selected route. A later paused
state retains the attachment; complete or blocked releases it.

## Supported host API

When the enclosing client exposes Codex app-server thread control, materialize
the objective, set it on the current thread with `thread/goal/set` exactly once,
then start the work turn with the selected workflow document, `model`, and
`effort`. Before activation, validate
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
exposes `spawn_agent`, prefer one first-class Codex agent thread over a shell
process. Confirm that the spawn tool accepts the selected concrete model and
reasoning effort and that the Codex provider already matches. A close control
is optional lifecycle support, not a launch prerequisite. An unavailable
user-pinned route stops; a policy route may use only its declared fallback.

Materialize the objective before spawning, then spawn exactly one agent with:

- task name `adaptive_goal_runner`;
- `fork_turns` set to `none`, so explicit model and effort overrides are valid;
- `model` and `reasoning_effort` set to the selected concrete values; and
- a self-contained message containing the exact materialized objective and,
  for a file-backed contract, its absolute path and expected SHA-256, plus the
  exact selected workflow document, its absolute path, identifier, and content
  hash.

Tell the runner to call `create_goal` exactly once with the materialized
objective, read and verify a file-backed complete contract before work, own
that goal through terminal completion, run the workflow and risk gates, and
return the required final record. A terminal independent-review stop settles
the created goal as `blocked` before the runner returns. If the native goal
surface requires a repeated-blocker audit, automatic continuations are
status-settlement only: they preserve the same blocker and use only the goal
status surface until `blocked` is accepted, without resuming repository work,
checks, review, or publication. The runner may use native Codex subagents for
bounded work when useful, but remains the sole goal owner. Tell it to collect
each descendant's terminal result and, when the host exposes a close control,
close that descendant after its goal has been fulfilled. Do not prescribe
planner, executor, verifier, or repair roles, and do not create another Darrow
runner beneath it.

For a selected review gate, tell the runner to preserve the compiled lifecycle:
one comprehensive initial review, one all-eligible first rework, then
exact-target fix verification and blocker/regression-only later rework while
material progress continues. Each verification receives the previous
verification artifact and checksum, its carried regression set, the prior
pinned scope manifest, and a mechanically rendered prior-to-current repair
delta; caller prose never substitutes for that causal evidence. A non-clear
terminal outcome or explicit hard cap settles as blocked and performs no
further repository or publication work.

An accepted spawn request with explicit route values is route-application
evidence. Confirm the exact route with `--applied-by native-subagent`, record:

```text
launch_boundary\tnative_subagent
route_applied_by\tnative-subagent
route_verified\ttrue
evaluation_child_invocations\t1
```

Wait for that same agent to finish and collect its terminal result. **Cleanup:**
Close the subagent when the goal has been fulfilled and its terminal result has
been collected, if the runtime exposes a close control. A completed close call
must target the same thread created by the accepted spawn; self-report is not
cleanup evidence. If the runner becomes unnecessary while still active, use a
host stop or interrupt control when available. Absence or failure of a close
control does not invalidate the accepted launch or an otherwise fulfilled goal;
report any residual cleanup state and preserve the terminal result. The host UI
exposes the runner and any native descendants for inspection while they are
needed. Descendants are native goal delegation, not additional Darrow child
invocations. Do not run a shell process around the agent or substitute its
prompt self-report for accepted spawn evidence.

**Complete when:** the accepted spawn matches the selected route, the visible
runner owns the one persisted goal, and its terminal result proves the contract
and final-tree checks complete.

## Explicit nested compatibility session

This boundary is for a supported enclosing launcher only after the user
explicitly authorizes process nesting. An interactive skill must not infer that
authorization from route mismatch. Put the complete contract in a private
temporary staging file outside the repository; the launcher materializes its
bounded native objective, then run:

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
