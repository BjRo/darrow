# Claude controls

## Native goal

Continue a matching active session goal. Otherwise, after preflight clears, use
native `ProposeGoal` with section 6's objective. Set `ask_user: false` only when
the user's outcome authorizes direct setting; honor host confirmation requirements.
The proposal queues activation at turn end. Yield and wait for the native kickoff
before implementation or assessment; a proposal alone proves no activation.

Headless sessions may lack model-side activation. With no matching goal or usable
control, return `Status: launch_required`, identify the boundary and supply
`/goal <prepared-objective>` for this session. Never invoke a built-in command
through Skill, start nested Claude or create a custom stop hook.

If the host advertises a headless-client activation interface, return the settled
objective through it after read-only preflight/readiness, then yield. The client
can enter that exact native `/goal` in this session. Await native kickoff; the
client does not choose readiness, objective or workflow. Otherwise retain the
normal `launch_required` response.

## Bounded delegation

Direct placement launches no implementor. For delegation, resolve the selected
implementation route with the bundled helper:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" claude-agent-route \
  --provider anthropic --model <claude-sonnet-5-5|claude-opus-5-5> \
  --effort <low|medium|high>
```

On Windows, use one PowerShell line. The helper verifies the scoped model/effort
and refuses conflicting higher-priority environment overrides. A refusal stops
the assignment without route substitution.

Call the exact returned `subagent_type` with `run_in_background: false`, no
per-call model override or unrequested worktree isolation, and section 7's
self-contained assignment. Use this plugin's scoped agents, without assuming a
sibling plugin exists. For concurrent parts, issue one Agent call per part in
the same message and settle all before integration or another assignment.

Retain the returned agent id and result. Send later implementation and repairs
with `SendMessage` to that id. If unloaded, first load it through
`ToolSearch` with `select:SendMessage`. Only an actual failed send establishes
unavailability for section 7's replacement decision.

## Feedback and completion

Use native goal question/continuation and supported user controls. Preserve the
same goal, decisions and repair history. Send complete relevant feedback to the
retained child id. Required acknowledgement must succeed before mutation resumes.
For cancellation, use available stop controls and report observed effects.
A foreground Agent may prevent immediate delivery/stopping; report that limit
without claiming prevention of an in-flight effect.

Apply section 9 and report substantive evidence here for native goal evaluation.
A child return cannot establish delivery. Claim only host-confirmed lifecycle
transitions.
