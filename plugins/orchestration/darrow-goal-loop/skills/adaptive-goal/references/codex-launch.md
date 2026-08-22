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
Keep a returned attachment directory readable until the goal reaches a
terminal state, including paused and native continuation turns; then run:

```sh
bash "$goal_loop" step release-objective --ledger <absolute-ledger> \
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
Release the caller-created staging file immediately after successful
materialization and before activation, in both modes, with the bundled helper:

```sh
bash "$goal_loop" step release-staging --ledger <absolute-ledger> \
  --goal-file <exact-caller-created-staging-file> \
  --expected-sha256 <exact-materialization-contract-sha256>
```

Stop before activation if this exact release fails. The inline objective is
already held in memory for the native call; the file-backed copy remains in its
helper-owned attachment until terminal cleanup.

If selected review, the exact launch boundary, or a required enforcement
boundary is unavailable before activation, record `goal-loop step launch-stop`
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
- a self-contained message whose first line is the exact observable ownership
  marker `- phase: adaptive-goal-runner`, followed by the exact complete inline
  objective or, for file-backed materialization, exactly one
  `- objective_file: <helper-returned-absolute-objective_file>` line. Add no
  copied contract, digest, workflow proof, explanation, or other task text;
  those complete requirements are already behind the authenticated objective.

Tell the runner that the accepted ownership-marked task already makes it the
sole goal owner and it must execute the supplied contract directly without
repeating adaptive-goal preflight or seeking another owner. When `create_goal`
is exposed inside the runner, call it exactly once with the materialized
objective; when it is absent, continue because the accepted runner task is the
ownership boundary. Read and verify a file-backed complete contract before
work, own that goal through completion or a material-feedback pause, run the
workflow and risk gates, and return the contract's human-readable final report
without reproducing its internal tab-separated record. In that report,
`harness` is the effective route harness `codex`, not `native-subagent` or
another launch-boundary label. For every terminal result, begin the response
with the complete canonical report and helper-owned terminal sentence before changed-file, verification, review,
risk, or blockage prose. A blocked result never omits or postpones this leading
block. If a material decision
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
question honestly. A terminal independent-review stop reports `blocked` before
the runner returns and, when native goal-state control is exposed inside that
runner, settles the created goal to that status. If the native goal surface
requires a repeated-blocker audit, automatic continuations are status-settlement
only: they preserve the same blocker and use only the goal status surface until
`blocked` is accepted, without resuming repository work, checks, review, or
publication. The runner may use native Codex subagents for
bounded work when useful, but remains the sole goal owner. Tell it to collect
each descendant's terminal result and, when the host exposes a close control,
close that descendant after its goal has been fulfilled. Do not prescribe
planner, executor, verifier, or repair roles, and do not create another Darrow
runner beneath it.

For a selected review gate, tell the runner to preserve the compiled lifecycle:
one comprehensive initial review, one all-eligible first rework, then
exact-target fix verification and blocker/regression-only later rework while
material progress continues. Each rework performs at most one authorized
repair attempt per finding, followed by invalidated checks and verification;
the runner never self-iterates on that finding before the response. Each
verification receives the previous
verification artifact and checksum, its carried regression set, the prior
pinned scope manifest, and a mechanically rendered prior-to-current repair
delta; caller prose never substitutes for that causal evidence. A non-clear
terminal outcome or explicit hard cap settles as blocked and performs no
further repository or publication work. Check evidence established after the
latest content edit and supplied to verification remains final-tree evidence
for that exact content; the review response does not invalidate it, so do not
rerun a check after a terminal response. The runner must execute the last
final-tree check for an exact target before its review invocation and must not
describe a later check as final verification. Require its terminal result to
preserve the prior blocker as `Initial independent review: blocking —
<finding>` and the standalone `Fix verification: <outcome>.` sentence without
a suffix, keeping the verifier's returned outcome verbatim. A cap-induced
overall block never rewrites `Fix verification: continue.` as `blocked`. When
the explicit hard cap causes the stop, also require the separate standalone
canonical sentence `Review gate: blocked — explicit limit reached.`

For a clear initial review, require the runner's terminal result to include the
standalone canonical sentence `Independent review: clear.`, and preserve that
sentence verbatim in the caller-facing completion. For an initial blocker that
cannot be repaired, require `Independent
review: blocking — <finding>` on its own line and preserve it verbatim. It may
use its own Markdown bullet but must otherwise be its own unquoted line. A prose
paraphrase does not replace it.

The guard-attested accepted spawn request with explicit route values is the
Codex native-runner route-application evidence. Do not run `confirm-route` or
another shell confirmation before or after that spawn; it adds no independent
host evidence. Trusted Codex hooks record the accepted Agent id, model, and
effort automatically. Otherwise record the accepted host-reported id
immediately:

```sh
bash "$goal_loop" step activate --ledger <absolute-ledger> \
  --applied-by native-subagent --boundary native_subagent \
  --agent-id <host-reported-agent-id> \
  --effective-route '<selected-route>' --route-verified true
```

Wait for that same agent to finish and collect its result. A feedback request
is a pause: relay the answer to that same agent and wait again rather than
closing or replacing it.
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
