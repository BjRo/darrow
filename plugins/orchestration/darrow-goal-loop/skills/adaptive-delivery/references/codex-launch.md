# Codex subagent owner

Use this guide after preflight, readiness, capability binding, route selection,
and contract compilation are complete.

## Feedback continuation fast path

When the current user message unambiguously addresses the retained owner—an
answer, correction, new constraint, status request, or cancellation—take this
path before any other action or response. No pending question is required.

1. Relay exactly once: use `followup_task` for an idle or paused owner, or
   `send_message` for an owner that is still running.
2. Set `target` to the retained canonical owner reference.
3. Set `message` to the complete current user message byte-for-byte. Its first
   and last characters must be the user's first and last characters. Add no
   prefix, suffix, quotation, summary, explanation, or lifecycle marker.
4. Wait for that same owner and relay its result.

For explicit cancellation, also use the available stop/interrupt control and
report its result. Do not infer that an in-flight effect was prevented.

Keep `target` and all routing metadata outside `message`. Do not repeat
preflight, readiness, routing, launch, or the feedback content on this path.

## Launch

Require the host-visible subagent control. Spawn exactly one subagent with:

- `fork_turns` set to `none`;
- `model` set to the selected concrete Codex model;
- `reasoning_effort` set to the selected effort;
- the complete task whose first line is exactly
  `- phase: adaptive-delivery-owner`, followed by an explicit sole-owner instruction; and
- no surrounding explanation or second objective.

The accepted spawn result proves application of the selected model and effort.
Retain its exact host-returned canonical reference for every wait or
continuation. A caller-selected task name is optional and is not ownership
evidence. Do not
create a nested goal, spawn another adaptive owner, or start a nested Codex
process.

If the spawn is rejected or unavailable, return `Status: launch_required` with
the selected route and preserve the product tree. Do not retry on another route.

## Parent boundary

Once the spawn is accepted, the parent performs no repository command,
inspection, edit, verification, capability invocation, or external effect. Wait
for the accepted owner and use only its returned facts.

The owner may invoke capability-internal agents when a bound skill requires
them; those are not replacement adaptive owners. It must not invoke
`adaptive-delivery` or launch another task beginning with the adaptive-owner marker.

## Feedback and continuation

For every answer, correction, added constraint, or status request delivered
through `followup_task` or `send_message`, preserve every instruction and
constraint from the user's current message. Do not omit, weaken, broaden, or
translate an implementation property into merely equivalent output behavior.
The `target` argument carries the retained owner identity; keep that transport
metadata separate from the feedback content.

When the owner returns a material-decision question as its paused result,
surface the complete question and retain the exact owner. The question needs no
lifecycle marker. Do not treat the pause as completion or start another owner.

On any later unambiguous feedback in this thread, use the feedback
continuation fast path. The same transport may resume a semantically blocked
owner when the answer clearly resolves its stated blocker; preserve the
original contract.

The fast path preserves the complete user message, including implementation
constraints; do not rewrite it as a new implementation task. A status request
does not stop execution. Never create a replacement owner for delivery. Report
if the host cannot deliver feedback during a running tool.

The owner applies restrictions before its next affected action, reassesses
invalidated assumptions and readiness, and strengthens checks within authority.
Missing product decisions or expanded effects return a question to the user.
These are owner actions, not permission for parent-side capability calls.

If the host cannot retain or resume the owner, report that limitation. Do not
claim that a replacement is the same goal.

## Result

Relay the owner's complete or blocked result without reconstructing repository
facts or running checks in the parent. This relay completes the handoff; do not
create or close a mirrored current-thread goal with `create_goal` or
`update_goal`. Absence of a parent-side cleanup control does not invalidate an
otherwise completed owner.
