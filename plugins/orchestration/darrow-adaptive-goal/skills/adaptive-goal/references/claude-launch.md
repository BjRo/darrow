# Claude controls

## Without a native goal

Claude Code gives skills no way to start a native goal. Adaptive Goal runs here
without a native goal, and this thread works on the goal until it is done.

1. **Continue in this turn.** After section 6's startup gate, prepare the bound
   branch, implement or delegate, assess and complete in the same turn. Reuse
   the retained preflight, readiness and bindings. Rerun them only after a
   material change.
2. **Persist.** End the turn only at section 9's definition of done or at one
   of these stops:
   - readiness returns a result other than `ready`;
   - a launch is refused;
   - the lifecycle reaches `blocked` or `no-progress`;
   - the repair budget is exhausted;
   - a material question needs the user's answer.
3. **Client goal.** When the session already has an active goal, such as one a
   client started with `/goal`, keep it and continue. That goal adds host
   persistence and changes nothing else.

Use ordinary turns and the controls below. Never invoke built-ins through Skill,
start nested Claude or create custom stop hooks.

## Agent calls

Start every Agent call from this thread with `run_in_background: false`. This
includes readers that a bound workflow starts here without naming a placement.
Background agents cannot ask for permission. When a background agent's command
is denied, this thread never sees the reason.

## Delegation

For delegated placement only, resolve the selected route:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" claude-agent-route \
  --provider anthropic --model <claude-sonnet-5-5|claude-opus-5-5> \
  --effort <low|medium|high>
```

On Windows, use one PowerShell line. The helper verifies the scoped model and
effort. It rejects higher-priority environment overrides that conflict with
them. A refusal stops the assignment.

- **Assign.** Use this plugin's scoped agents. Pass the returned
  `subagent_type` and section 7's complete assignment, and omit the Agent
  call's `model` field. For authorized
  [isolated workers](isolated-ticket-workers.md), set `isolation: "worktree"`
  on the first allocation, then verify the returned checkout, branch and base.
  Omit `isolation` for other assignments. For parallel parts, make one Agent
  call per part in the same message. Wait until every part settles before
  integrating or making another assignment.
- **Reuse.** Keep each agent's id and result. Send later work and repairs to
  that id with `SendMessage`, and allocate no new worktree for it. If
  `SendMessage` is not loaded, load it with `ToolSearch` and
  `select:SendMessage`. Treat an agent as unavailable, and replace it, only
  after a send to it actually fails.
- **Steer.** Use the host's native controls for questions, continuation and
  user input. Keep the goal and its history. Deliver complete feedback, and
  require the supplied acknowledgement before any mutation. To cancel, use the
  available stop controls and report the effects you observed. A foreground
  Agent call can delay delivery and stopping, so claim only the stops you
  observed. An in-flight effect can still complete.
- **Complete.** Apply section 9 and report the substantive evidence in this
  thread. A child's return is no proof of delivery. Claim only transitions the
  host confirmed.
