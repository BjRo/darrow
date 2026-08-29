# Codex native-goal launch

Use the first boundary that can honor the compiled route.

The classifier never executes a repository check, test, build, typecheck,
lint, independent review, or verification probe. Record those commands in the
contract for the native owner. Once the ownership-marked spawn starts, run no
parent command except the exact `feedbackctl answer` acquisition required by a
material-feedback relay or a state-bound `goal-loop step` evidence call.
Waiting, messaging, stopping, and closing use host collaboration controls, not
shell commands.

## Materialize the native objective

Before a same-thread, host-API, native-runner, or shared-filesystem nested goal
activation, put the complete compiled contract in a file that is a direct child
of the exact mode-0700 `staging_dir` returned by `step start`. The contract uses the exact labeled shape from
Section 2 of the parent skill and references the absolute ledger once. The
ledger owns internal route, lifecycle, and review evidence. Preserve the
contract byte-for-byte; this is the contract,
not a lossy summary or a separate plan. Run:

```sh
bash "$goal_loop" step stage --ledger <absolute-ledger> \
  --goal-file <absolute-contract-file>
bash "$goal_loop" step materialize --ledger <absolute-ledger> \
  --goal-file <absolute-contract-file> \
  --expected-sha256 <step-stage-contract-sha256>
```

Use the returned absolute `objective_file` as the exact native goal objective.
`step stage` hashes the exact staged bytes; pass its returned
`contract_sha256` to materialization and both release transitions.
The helper reports `inline` when the complete contract is at most 4,000 bytes.
Above that limit it copies the complete contract to a private attachment,
hashes it with SHA-256, and writes a bounded objective that requires the goal
owner to read and verify the attachment before work. Stop before activation if
the helper fails, any returned file is unreadable, or the objective exceeds
4,000 bytes.

Perform this materialization before the first `create_goal` call. Call the goal
surface exactly once with the materialized objective. Do not retry `create_goal`
after a size rejection, recompact the contract after rejection, or truncate it.
Keep a returned attachment directory readable through active, paused, blocked,
and native continuation turns. Release it only after verified completion or an
explicit `step end` for abandonment, supersession, or thread destruction:

```sh
bash "$goal_loop" step release-objective --ledger <absolute-ledger> \
  --attachment-dir <exact-helper-returned-attachment-dir> \
  --expected-sha256 <exact-helper-returned-contract-sha256>
```

Do not reconstruct deletion commands. The receiving goal owner must share this
filesystem. If it does not, use a complete inline contract or stop honestly.
If the launcher fails after activation without confirming completion or an
explicit lifecycle end, retain the attachment and report the thread identifier,
exact attachment path, and expected digest as resumable lifecycle evidence; do
not remove the contract from an active, paused, or blocked goal. Once completion
or an explicit lifecycle end is confirmed, release the attachment even if
later result collection fails.
Release the caller-created staging file immediately after successful
materialization and before activation, in both modes, with the bundled helper:

```sh
bash "$goal_loop" step release-staging --ledger <absolute-ledger> \
  --goal-file <exact-caller-created-staging-file> \
  --expected-sha256 <exact-materialization-contract-sha256>
```

Stop before activation if this exact release fails. For `mode=inline`, read and
retain the exact `objective_file` bytes before the staging release, then place
those bytes after the ownership marker in the native call. Never convert an
inline objective into an `objective_file` launch line, because the staging
release deliberately removes that file. For `mode=file-backed`, use only the
helper-returned persistent objective path in the one allowed launch line; that
copy remains readable until terminal cleanup.

If selected readiness, selected review, or the exact launch boundary is
unavailable before activation, record
`goal-loop step launch-stop`
with the matching reason, release any materialized attachment, and render the
helper's `launch_required` report. Do not activate or implement first.

## Same thread

When the current runtime exposes `create_goal`, obtain the concrete active
provider, model, and effort from host metadata and require the exact match
before activation. Only after objective materialization has completed, call
`create_goal` exactly once with the exact contents of `objective_file` as
`objective`.
Supply a token budget only when the user specified one. After the native goal
call is accepted, record:

```sh
bash "$goal_loop" step activate --ledger <absolute-ledger> \
  --applied-by current-thread --boundary same_thread --agent-id none \
  --effective-route '<selected-route>' --route-verified true
```

Do not create a child agent or shell process around this boundary.

When the compiled contract selects implementation readiness, invoke the
matching installed capability and record its semantic verdict with the exact
absolute `goal-loop step readiness` transition before any repository or
external mutation. Only `ready` unlocks implementation. A non-ready verdict
records a non-waivable readiness blocker, settles the goal as blocked, and
preserves the complete readiness result before the resumable outer snapshot.
After a later resolving answer, reactivate this same goal, record `step resume
--mode answer` or qualifying `continue`, and run readiness again before
mutation.

If a material decision first emerges after activation, leave the goal active,
pause repository and external mutation, and ask the user the smallest concrete
question. Pending feedback is neither `complete` nor `blocked`. Continue the
same goal only after the explicit answer arrives, and count that question once
in `evaluation_human_interruptions`. If the turn ends while awaiting the
answer, retain any objective attachment as described above.

The prompt, route table, and model defaults are not active-route metadata.
`inherit` is a launch choice, not a model identifier. If the selected and active
routes differ, do not use this boundary.

**Complete when:** `get_goal` shows the materialized objective active on the
current thread and its concrete route is the selected route. A later paused or
blocked state retains the attachment; only completion or an explicit lifecycle
end releases it.

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

Before setting the goal, if implementation readiness is selected, the
enclosing client confirms that its installed capability catalog already
exposes a matching implementation-readiness assessment capability. If not, it
records `goal-loop step launch-stop --reason readiness-unavailable`, renders
the `launch-required` report, and performs no product mutation. It performs the
equivalent check when independent review is selected: the catalog must expose a
matching independent code-change review capability. If not, it records
`goal-loop step launch-stop --reason review-unavailable`, renders the
`launch-required` report, and performs no product mutation.

When this current-thread owner returns a valid human-feedback pause and the
originating request explicitly authorized one named answer-acquisition command,
the enclosing client may run that exact command outside the owner, treat its
successful one-line output as the explicit answer, and start a continuation on
the same thread with `- phase: human-feedback-response` and that answer. Keep
the selected model and effort, count one interruption and zero children, and
leave any repository-mandated acknowledgement to the resumed owner.

When the same thread's persisted goal is `blocked`, retain its exact objective
and ledger. For a later unambiguous user response, first record the applicable
`goal-loop step resume` transition. Only when it succeeds, reactivate that same
goal with `thread/goal/set` using the unchanged objective and status `active`,
then start one continuation turn on the same thread, model, and effort. If the
transition refuses the response, relay its stderr verbatim and idempotently
render the unchanged blocked snapshot; do not reactivate the goal or perform
repository or external mutation. Do not call `thread/goal/set` with a new
objective, create a replacement thread, or repeat the enclosing recipe. A
blocked snapshot is reportable but not objective-cleanup evidence.

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
- a self-contained message whose first line is the exact observable ownership
  marker `- phase: adaptive-goal-runner`, followed by the exact complete inline
  objective or, for file-backed materialization, exactly one
  `- objective_file: <helper-returned-absolute-objective_file>` line. Add no
  copied contract, digest, workflow proof, explanation, or other task text;
  those complete requirements are already behind the authenticated objective.

For a file-backed materialization, the spawn tool's `message` value is exactly
these two lines, with the helper-returned path substituted literally and no
leading or trailing prose:

```text
- phase: adaptive-goal-runner
- objective_file: <helper-returned-absolute-objective_file>
```

Do not use the message to tell the runner anything else. Before materializing,
compile every runner requirement below into the complete contract. The
accepted task already makes the runner the sole work owner: it executes the
contract directly without repeating adaptive-goal preflight or seeking another
Darrow owner. Goal persistence attaches to that same thread; it does not create
another work owner. The runner MUST NOT call `goal-loop step activate`, release
the objective, or render the terminal ledger report; those are creator-owned
lifecycle operations. It records its own goal persistence, selected-readiness
verdict through `goal-loop step readiness` and selected-review outcomes through
`goal-loop step review`. It reads and verifies a file-backed
contract before work, owns it through completion or a material-feedback pause,
runs the workflow and risk gates, and returns terminal status plus changed-file,
verification, review, risk, and publication facts to its creator. If a material decision
first emerges after activation, tell it to pause mutation and return the
smallest concrete question to its creator without completing or blocking the
goal. Its actual feedback request begins with the exact marker
`- phase: human-feedback-request`. The creator surfaces the question to the
user and sends the explicit answer back to the same runner thread; that actual
reply begins with `- phase: human-feedback-response`. Do not put either event
marker, a guessed answer, or a future feedback response in the initial spawn
task. If the originating request explicitly authorizes one exact named
answer-acquisition command, the creator runs it only after receiving the
question and relays its successful output as the explicit answer without
asking the caller again. Keep the runner open while feedback is pending, resume only after its
explicit answer, require the runner to complete any repository- or
contract-mandated acknowledgement with that exact answer before mutation, and
count each distinct user question once. Require one terminal line per resolved
question in the exact form `Applied relayed decision: <exact answer>`, and
preserve each line in the caller-facing completion. The creator never performs
the runner's acknowledgement. An optional Markdown bullet, inline code around
the answer, or terminal period is presentation only. If the host cannot relay an answer,
preserve the runner and objective as resumable state and return the pending
question honestly. Keep an active feedback pause distinct from a recorded
blocker: after any successful `step block`, settle that same goal `blocked` and
return ordinary blocked evidence without a `human-feedback-request` marker so
the creator can render the snapshot before relaying a later response. An
independent-review stop records its review blocker and
evidence digest, settles `blocked`, and returns that resumable state to the
creator without starting another goal or resuming repository work, checks,
review, or publication. The creator retains the runner and objective. For a
later qualifying response, the creator records `step resume`, reactivates that
same goal with the unchanged objective only after the transition succeeds, and
sends the response to
that exact runner reference with first line `- phase: blocked-goal-response`
plus `- resume-transition: recorded`. The runner verifies the retained
objective and continues without recording the transition again or calling
`create_goal` again. The runner may use
native Codex subagents for
bounded work when useful, but remains the sole work owner. Tell it to collect
each descendant's terminal result and, when the host exposes a close control,
close that descendant after its goal has been fulfilled. Do not prescribe
planner, executor, verifier, or repair roles, and do not create another Darrow
runner beneath it.

If that runner reports that `step resume` refused the response, preserve its
stderr byte-for-byte, perform no other runner or repository action, and
idempotently render the unchanged blocked snapshot. Do not replace the refusal
with explanatory prose or send a second continuation response.

The runner waits for the creator's exact `- phase: goal-owner-activated`
message before goal persistence or mutation. After that signal, the runner must
call `create_goal` exactly once. It supplies the exact materialized objective as
its `objective` and a token budget only when the user specified one. It then
calls `get_goal` in its own thread. Only when `get_goal` confirms the exact
objective is active does the runner record the semantic confirmation:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step goal-state \
  --ledger <absolute-ledger> --status active
```

The runner may then perform readiness and repository work. It owns native goal
status: use `complete` only after the full contract is fulfilled, and use
`blocked` only under the native blocked threshold after recording the blocker
and resumable snapshot. A later response delivered to this same thread resumes
the existing goal only after the creator confirms the objective, records `step
resume`, and reactivates it. Confirm the host-recorded transition marker and
continue without another `create_goal` call. The creator never calls
`create_goal`, `get_goal`, or `update_goal` for this runner-owned goal.

If `create_goal` is unavailable or rejects the request, the runner performs no
mutation, records `goal-loop step goal-state --ledger <absolute-ledger>
--status unavailable`, and returns the failure honestly. The creator then
releases the objective and renders `launch-required`; it does not replace the
runner or claim native persistence.

If `create_goal` returns acceptance but `get_goal` is unavailable or does not
confirm the exact objective active, the runner performs no mutation and leaves
the ledger in `goal-pending`; it does not record unavailable persistence. The
creator must not release the objective, close or replace the runner, or render
a terminal helper report while the native goal's state is unknown. It returns
the accepted thread reference plus the validated attachment path and expected
digest as resumable lifecycle evidence so a later invocation can confirm the
goal's terminal state before releasing the attachment.

For a selected readiness gate, the runner invokes the matching capability
before mutation, preserves its complete human-readable result, and records the
semantic verdict in the ledger. It continues only on `ready`. Any other
verdict records a non-waivable readiness blocker, returns `blocked` without
mutation, and places the complete readiness result plus smallest useful next
action before the creator's resumable outer snapshot. A later resolving answer
resumes the same runner and reruns readiness before mutation.

For a selected review gate, read
[`review-lifecycle.md`](review-lifecycle.md) completely and compile that
lifecycle plus the parent skill's canonical outcome sentences into the runner's
contract. Do not restate the lifecycle in the launch message.

The accepted spawn request with explicit route values is the
Codex native-runner route-application evidence. Do not run `confirm-route` or
another shell confirmation before or after that spawn; it adds no independent
host evidence. The runner identity is the exact `task_name` value in the
accepted public spawn result, not the short task name supplied in the request
and not an inferred thread id. Require that host-returned value to match the
canonical grammar `/root(?:/[a-z0-9_]+)+`, retain it byte-for-byte as the agent
reference, and reject a foreign root, traversal or empty segment, whitespace,
tab or newline, shell metacharacter, or unrelated safe-looking child. Do not
strip `/root/`, flatten nested paths, or otherwise normalize the value.
Recording that reference is mandatory immediately after spawn acceptance and
before the first wait:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step activate --ledger <absolute-ledger> \
  --applied-by native-subagent --boundary native_subagent \
  --agent-ref <host-returned-canonical-task-name> \
  --effective-route '<selected-route>' --route-verified true
```

Do not ask the runner to make this call and do not substitute `same_thread`.
After the activation call succeeds, send the runner exactly
`- phase: goal-owner-activated` through the matching message control. Then use
that exact agent reference as every wait, message, interrupt, and
cleanup target for the runner. A feedback request is a pause: relay the answer
to that same reference and wait again rather than closing or replacing it.
Never accept an activation merely because the helper echoes its argument; the
recorded reference must match the accepted spawn result or the same spawn's
retained host receiver identity.

If the activation transition is rejected after the spawn was accepted,
interrupt that exact reference when the host exposes interruption, then run
`goal-loop step launch-stop --reason launch-unavailable` with the same
`--agent-ref` and no alternate reason. Release a materialized objective, render
the `launch_required` report, and preserve `evaluation_child_invocations: 1`
plus the observed interruption and cleanup state. Do not retry activation,
spawn a replacement, report zero children, or reinterpret this as ordinary
blocked work.
Once that spawn is accepted, `spawn_agent` is forbidden for the rest of the
invocation, including tool discovery, waiting, retry, or cleanup. Use only the
matching wait, message, stop, or close control for the accepted thread; never
create a helper or replacement while locating that control.

**Cleanup:**
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

Do not close, interrupt, or release the objective merely because this owner is
blocked. Keep the exact agent reference and objective through every resumable
blocked turn. Before cleanup without completion, record `step end` for explicit
abandonment, supersession, or thread destruction; then target that same owner
with the available close or interrupt control and release the objective once.

After collecting a completed result, release any file-backed objective through
the exact helper call above. After collecting a blocked result, retain it and
record the exact blocker instead. Interpret only the runner's semantic status
and review facts; do not inspect the repository. Then call the helper exactly
once for that turn:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step report \
  --ledger <absolute-ledger> --status <complete|blocked|launch-required> \
  --human-interruptions <nonnegative-integer>
```

Return that exact helper output first, followed by the runner's collected
changed-file, verification, review, risk, feedback, and publication facts. For
a non-ready implementation-readiness verdict only, preserve the complete
readiness result first and place that exact blocked snapshot after it. A
blocked helper output leaves the ledger and objective resumable; a complete or
launch-required output is terminal. Ignore any child-authored report block;
only the creator's helper call is report authority.

**Complete when:** the accepted spawn matches the selected route, the visible
runner is the sole work owner, that thread owns the one confirmed persisted
goal, and its terminal result proves the contract and final-tree checks
complete.

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
