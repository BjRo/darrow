# Codex controls

## Native goal

After section 6's preflight clears, continue the matching active goal or call
`create_goal`. If `get_goal` reports none, create the first goal here even for
an existing candidate. Require successful activation before implementation or
assessment. Unavailable/refused controls return `Status: launch_required` with
the concrete boundary. Use native continuation, never an owner child, nested
Codex process or custom scheduler.

## Bounded delegation

For direct placement, spawn no implementor. Otherwise call `spawn_agent` with:

- `fork_turns: none`;
- `task_name` containing lowercase letters, digits and underscores only;
- explicit selected `model` and `reasoning_effort`;
- section 7's self-contained assignment and exact public skill paths.

For concurrent parts, use distinct task names and owned files, supply the shared
interface, and wait for all before integration. Retain accepted identities.
Send later work and repairs to that implementor with `send_message` while
running or `followup_task` while idle. Section 7 governs replacement.

Deliver relevant feedback through those same controls, interrupting affected
work when needed. Report unconfirmed delivery or stopping honestly.
Native `paused` requires an explicit user pause request. A pending question
stops affected work without that transition. A host-generated continuation,
including a user-role `codex_internal_context`, cannot release a user-owned wait.
Respect native blocked-state recurrence. Continue the same goal after an answer
and apply section 9 before `update_goal` completion.
