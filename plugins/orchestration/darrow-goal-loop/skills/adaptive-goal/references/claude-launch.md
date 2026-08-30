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

The accepted Agent call establishes the sole owner, but it does not prove that
Claude applied the agent frontmatter's model and effort. Retain the
host-reported agent id. Do not invoke Agent again for this goal or start a
nested Claude process.

If Agent is rejected or unavailable, return `Status: launch_required` with the
selected route and preserve the product tree. Do not retry on another route.

## Verify the effective route

After the foreground Agent returns, run exactly this bundled read-only check:

```sh
/bin/bash <absolute-plugin-bin>/claude-owner-route \
  --repo <absolute-repository> --agent-id <host-reported-id> \
  --selected-model <selected-model> --selected-effort <selected-effort>
```

Put the literal absolute `claude-owner-route` path directly in this command.
Do not invoke it through a variable, alias, wrapper, command substitution, or
compound shell command; the host boundary must be able to attribute the exact
observer call and its result.

The helper reads only the exact `agent-<id>.jsonl` transcript, requires every
assistant turn to expose one consistent model and effort, and compares them to
the selected route. A `confirmation: confirmed` result establishes the route.
Do not infer the route from Agent acceptance, frontmatter, or owner self-report.

If the transcript is unavailable, malformed, ambiguous, or mismatched, return
`Status: launch_required` with the selected and observed route evidence. The
owner has already run and may have produced local changes; disclose that fact
and perform no further mutation, verification, review, or publication. Never
silently downgrade or launch a replacement.

For a later same-owner continuation, run the same check after the owner returns
again; it validates every assistant turn accumulated for that id.

## Parent boundary

Once Agent is accepted, the parent performs no repository command, work
inspection, edit, verification, capability invocation, or external effect. Its
only additional read is the exact route check above. It otherwise relies on the
owner result.

The owner may invoke capability-internal agents when a bound skill requires
them; those are not replacement adaptive owners. It must not invoke
`adaptive-goal` or launch another task beginning with the adaptive-owner marker.

## Feedback and continuation

When the owner returns a result beginning `- phase: human-feedback-request`,
surface its complete question and retain the exact agent id. Do not treat the
pause as completion or launch another Agent.

On the user's later unambiguous answer in this thread, use Claude's message
control once for that retained id with the summary `Resume adaptive goal with
human feedback` and exactly this payload:

```text
- phase: human-feedback-response
<exact user answer>
```

Yield for the task notification from that same id, then verify its accumulated
route evidence again. Do not call Agent again, repeat preflight, readiness,
route resolution, or use a scheduler. The same transport may resume a
semantically blocked owner when the answer clearly resolves its stated blocker.

If the host cannot retain or resume the owner, report that limitation. Do not
claim that a replacement is the same goal.

## Result

After confirmed route observation, relay the owner's complete, paused, or
blocked result without repository inspection or parent-side engineering
verification.
