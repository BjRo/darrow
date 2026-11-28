# Claude controls

## Native goal

Apply section 6's startup gate before proposing or preparing activation.

1. **Continue.** Retain a matching session goal.
2. **Propose.** Call `SetGoal`; `ProposeGoal` is its alias. When it is deferred,
   load it with `ToolSearch` `select:SetGoal`. Give it one measurable end state
   of at most 500 display columns, because the approval dialog must show all of
   it. Keep section 6's full objective (criteria, constraints, authority, repair
   ledger) in this conversation, where Claude's goal evaluator reads it. Use
   `ask_user: false` only with direct-setting authority; honor host confirmation.
   A proposal queues activation at turn end. Yield; await native kickoff before
   implementation/assessment.
3. **Unavailable.** A failed load, or the error "Goal proposals are only
   available in interactive local sessions that have /goal", means `SetGoal` is
   unavailable. T3 Code, other Agent SDK clients and `claude -p` are
   non-interactive. If a client advertises a headless activation interface,
   return the settled objective through it and yield; the client chooses no
   readiness, objective or workflow. Otherwise return `Status: launch_required`,
   the concrete boundary and one `/goal <objective>` line carrying section 6's
   objective for the user or client to send next.
   Never invoke built-ins through Skill, start nested Claude or create custom stop hooks.
4. **Go signal.** Claude confirms a client `/goal` with "A session-scoped Stop
   hook is now active with condition: …" or `Goal set: <condition>`. When the
   condition states the prepared outcome and criteria, that goal is active.
   Continue in this session to implementation with the retained preflight,
   readiness and bindings. Rerun them only after a material change.

## Agent calls

Start every Agent call from this thread with `run_in_background: false`. This
includes readers that a bound workflow starts here without naming a placement.
Background agents cannot ask for permission, so a denied command hides its reason.

## Delegation

For delegated placement only, resolve the selected route:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" claude-agent-route \
  --provider anthropic --model <claude-sonnet-5-5|claude-opus-5-5> \
  --effort <low|medium|high>
```

On Windows, use one PowerShell line. The helper verifies scoped model/effort and
rejects conflicting higher-priority environment overrides. Refusal stops assignment.

- **Assign.** Use returned `subagent_type` and section 7's complete assignment.
  No per-call model override. For authorized
  [isolated workers](isolated-ticket-workers.md), set `isolation: "worktree"`
  on initial allocation; verify the returned checkout, branch and base. Other
  assignments use no isolation.
  Use this plugin's scoped agents. Parallel parts: one Agent call each in the same
  message; settle all before integration/another assignment.
- **Reuse.** Retain agent id/result. Send later work/repairs via `SendMessage` to
  that id without allocating another worktree. If unloaded, use `ToolSearch` with `select:SendMessage`. Only an actual
  failed send establishes unavailability for replacement.
- **Steer.** Use native question/continuation/user controls; retain goal/history.
  Deliver complete feedback; require supplied acknowledgement before mutation.
  Cancellation uses available stop controls and reports observed effects. Foreground
  Agent can delay delivery/stopping; never claim prevention of in-flight effects.
- **Complete.** Apply section 9; report substantive evidence here for native
  evaluation. Child returns prove no delivery. Claim only host-confirmed transitions.
