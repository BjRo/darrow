# Codex controls

## Native goal

After preflight, continue a matching goal or call `create_goal`, including for an
existing candidate when `get_goal` reports none. Observe activation before work.
Unavailable/refused controls: `Status: launch_required` plus concrete boundary.
Use native continuation; never an owner child, nested Codex or custom scheduler.

## Delegation and feedback

1. **Spawn.** Only for delegated placement: `spawn_agent` with `fork_turns: none`,
   lowercase/digit/underscore `task_name`, selected `model`/`reasoning_effort` and
   section 7's complete assignment/public skill paths. Parallel parts get distinct
   names/files and shared interfaces; await all before integration.
2. **Reuse.** Retain accepted identities. Use `send_message` while running,
   `followup_task` while idle; section 7 governs replacement.
3. **Steer.** Deliver relevant feedback through those controls; interrupt affected
   work when needed. Report unconfirmed delivery/stopping.
4. **Wait.** `paused` requires explicit user pause. Questions stop affected work
   without that transition. Host continuations, including user-role
   `codex_internal_context`, cannot release user-owned waits. Honor native blocked
   recurrence; resume the same goal after answers. Apply section 9 before completion.
