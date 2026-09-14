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
  `- phase: adaptive-delivery-owner`.

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

The owner invokes selected verification with the compiled review binding,
criteria, current checks and closed finding/repair history. Bounded assessment
contexts return their complete results to verification and then to this owner;
they inherit scope and authority without owning repairs, budgets or completion.
The owner waits for the combined conclusion and applies one shared repair budget.

The owner may invoke capability-internal agents when a bound skill requires
them; those are not replacement adaptive owners. It must not invoke
`adaptive-delivery` or launch another task beginning with the adaptive-owner marker.

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

Corrections, added constraints, cancellation, and status requests also target
the retained id through `SendMessage`; no pending question is required. Deliver
the user's exact feedback once. A status request does not cancel work. For
explicit cancellation use a host stop control when available and report its
observed result and already performed effects. If the foreground Agent call
prevents live message delivery, report that host limitation and deliver at the
next available boundary. Do not claim immediate stopping without evidence or
launch a replacement to apply steering.

The owner applies restrictions before its next affected action and reassesses
invalidated assumptions and gates itself, using necessary readiness and
stronger checks within existing authority. Product decisions or expanded
effects return to the user. The parent never repeats capability preflight.

## Result

Apply the main skill's section 8 completion-evidence check before relaying the
result. Request missing or contradictory accounting through `SendMessage` to
the retained owner id and wait for its amended status. This correction
authorizes no engineering work or assessment. If continuation is unavailable,
report the evidence gap.

Relay the validated complete result or the owner's paused or blocked result
without repository inspection or parent-side engineering verification. Do not
run a final `git status`, read the changed file, or confirm the owner's checks.
