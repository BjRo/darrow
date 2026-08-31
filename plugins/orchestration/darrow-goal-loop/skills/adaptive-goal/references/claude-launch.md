# Claude Agent owner

Use this guide after preflight, readiness, capability binding, route selection,
and contract compilation are complete.

## Resolve the routed agent

Run the bundled resolver once with the selected route:

```sh
/bin/bash <absolute-plugin-bin>/claude-agent-route \
  --provider anthropic --model <claude-sonnet-5|claude-opus-5> \
  --effort <low|medium|high>
```

Use its exact `subagent_type`. The resolver verifies that the route-specific
agent exists, its frontmatter pins the selected model and effort, and no
conflicting host environment override is active. A nonzero result is
`Status: launch_required`; do not invoke Agent anyway or select another route.

## Launch

Invoke the resolved Agent exactly once with:

- `run_in_background` set to `false`;
- no per-call model override;
- no worktree isolation or resume option on the initial call; and
- the complete task whose first line is exactly
  `- phase: adaptive-goal-owner`.

The resolver has rejected higher-priority environment overrides, and the Agent
call supplies no per-call model override. The accepted call therefore uses the
scoped agent's model and effort frontmatter and establishes the sole owner.
Retain the host-reported agent id. Do not invoke Agent again for this goal or
start a nested Claude process.

If Agent is rejected or unavailable, return `Status: launch_required` with the
selected route and preserve the product tree. Do not retry on another route.

## Parent boundary

Once Agent is accepted, the parent performs no repository command, work
inspection, edit, verification, capability invocation, route-observation shell
call, or external effect. It relies on the owner result.

The owner may invoke capability-internal agents when a bound skill requires
them; those are not replacement adaptive owners. It must not invoke
`adaptive-goal` or launch another task beginning with the adaptive-owner marker.

## Feedback and continuation

When the owner returns a material-decision question as its paused result,
surface the complete question and retain the exact agent id. The question needs
no lifecycle marker. Do not treat the pause as completion or launch another
Agent.

On the user's later unambiguous answer in this thread, use Claude's
`SendMessage` control once for that retained id. Use any concise continuation
summary the tool requires and send the exact user answer as the message, with no
wrapper or lifecycle marker. A successful call delivers the answer and
auto-resumes the stopped owner; never send a second continuation message for
that answer.

Yield for the task notification from that same id and relay its result. Do not
call Agent again, repeat preflight, readiness, route resolution, or use a
scheduler. The same transport may resume a semantically blocked owner when the
answer clearly resolves its stated blocker.

If the host cannot retain or resume the owner, report that limitation. Do not
claim that a replacement is the same goal.

## Result

Relay the owner's complete, paused, or blocked result without repository
inspection or parent-side engineering verification.
