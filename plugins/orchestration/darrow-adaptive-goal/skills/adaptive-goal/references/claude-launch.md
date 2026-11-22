# Claude controls

## Native goal

Apply section 6's startup gate before proposing or preparing activation.

1. **Activate.** Continue a matching session goal; otherwise,
   call `ProposeGoal` with section 6's objective. Use `ask_user: false` only with
   direct-setting authority; honor host confirmation. Proposal queues activation
   at turn end. Yield; await native kickoff before implementation/assessment.
2. **Headless.** Without matching goal/usable control, return
   `Status: launch_required`, concrete boundary and `/goal <prepared-objective>`.
   Never invoke built-ins through Skill, start nested Claude or create custom stop hooks.
3. **Client.** If advertised, return the settled objective through the headless
   activation interface; yield. The client enters that
   exact native `/goal` here. Await kickoff. The client chooses no readiness,
   objective or workflow. Otherwise use `launch_required`.

## Delegation

For delegated placement only, resolve the selected route:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" claude-agent-route \
  --provider anthropic --model <claude-sonnet-5-5|claude-opus-5-5> \
  --effort <low|medium|high>
```

On Windows, use one PowerShell line. The helper verifies scoped model/effort and
rejects conflicting higher-priority environment overrides. Refusal stops assignment.

- **Assign.** Use returned `subagent_type`, `run_in_background: false` and section 7's
  complete assignment. No per-call model override/unrequested worktree isolation.
  Use this plugin's scoped agents. Parallel parts: one Agent call each in the same
  message; settle all before integration/another assignment.
- **Reuse.** Retain agent id/result. Send later work/repairs via `SendMessage` to
  that id. If unloaded, use `ToolSearch` with `select:SendMessage`. Only an actual
  failed send establishes unavailability for replacement.
- **Steer.** Use native question/continuation/user controls; retain goal/history.
  Deliver complete feedback; require supplied acknowledgement before mutation.
  Cancellation uses available stop controls and reports observed effects. Foreground
  Agent can delay delivery/stopping; never claim prevention of in-flight effects.
- **Complete.** Apply section 9; report substantive evidence here for native
  evaluation. Child returns prove no delivery. Claim only host-confirmed transitions.
