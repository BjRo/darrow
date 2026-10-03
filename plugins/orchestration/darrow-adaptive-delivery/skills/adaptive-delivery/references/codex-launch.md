# Codex native goal and bounded assignments

Use after read-only preflight, readiness, binding and implementation route selection.

## Main-thread goal

Keep overall ownership in this original thread. Use native `create_goal` with
an objective of at most 4,000 Unicode characters: outcome, material acceptance,
authority and completion conditions. Supply `token_budget` only if explicitly
requested. Continue a matching active goal; never overwrite an unrelated one.
Keep workflow, routing and coordination instructions in the skill and conversation.

Require successful native goal activation before implementation or assessment.
If goal controls are unavailable or refuse activation, report `launch_required`
with that concrete boundary. Do not launch an owner child, nested Codex process,
custom continuation loop or scheduler. Native host continuation keeps the same
main thread working.

## Bounded delegation

Use `spawn_agent` with:

- `fork_turns: none`;
- a `task_name` containing only lowercase letters, digits and underscores;
- explicit `model` and `reasoning_effort` for that role;
- a self-contained assignment, relevant acceptance and authority, repository and
  scope, preserved work, required checks and exact public skill references;
- a clear statement that the child owns its assignment, not the delivery goal.

Implementation and repair use the preflight-selected implementation route.
Verification coordination uses `gpt-6-sol/medium` or a stronger authorized route.
Pass `gpt-6-luna/medium` explicitly for review coordination through verification;
review's independent readers retain their own `gpt-6-sol/xhigh` route. Do not
replace capability internals with generic children or inherit the implementor's
route into assessment roles.

A fresh child reads and follows the relevant bound skills. No tool named after
the skill is required. Include installed absolute public instruction paths;
never reconstruct them from a name. An unreadable reference is a concrete gap.

Retain accepted child identities and results. Wait for conflicting work to settle
before assigning more work. Children do not invoke Adaptive Delivery, create
overall goals, expand authority or decide overall completion. A rejected route
does not authorize silently switching models.

## Coordination and feedback

The main thread may inspect current state, run checks, invoke authorized bound
operations, and validate returned evidence. It arranges selected verification,
combined repairs and fresh follow-up through the capability's public contract.
It does not take over provider assessment internals.

A missing material decision stops affected mutation. Ask the user here, preserve
the same goal and repair history, and update affected children with every
relevant constraint. Use `send_message` for a running child or `followup_task`
for an idle child; interrupt affected work when needed. Preserve the complete
answer when a repository acknowledgement requires it, and require successful
acknowledgement before mutation. Report unconfirmed delivery or stopping honestly.

Native `paused` status requires the user's explicit pause request. A pending
question or instruction to wait stops affected work without inventing a pause
transition. Native continuation does not release a user-owned restriction; keep
affected work read-only until the user's actual answer or authorization arrives.
Respect
native blocked-state recurrence conditions. On an answer, continue the same goal
and preserve consumed attempts; do not create another goal. Status questions do
not cancel work. Cancellation stops work and reports already performed effects.

## Completion

Apply section 8 of the skill before native completion. Consume actual check,
capability and publication evidence; resolve missing or contradictory handoffs
through bounded clarification or correction. A child success message is not
proof of overall completion. Report substantive conclusions in this session.

Only mark the native goal complete when all required work and evidence are
satisfied. Unavailable controls or incomplete evidence are reported as limitations,
never converted into a completion claim.
