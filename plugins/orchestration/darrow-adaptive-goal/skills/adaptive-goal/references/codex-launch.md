# Codex controls

## Native goal

Apply section 6's startup gate before `create_goal`, including for an existing
candidate when `get_goal` reports none. Continue matching goals; observe activation
before work. Default call: `create_goal({objective})`.
Unavailable/refused controls: `Status: launch_required` plus concrete boundary.
Use native continuation; never an owner child, nested Codex or custom scheduler.

## Delegation and feedback

1. **Spawn.** Only for delegated placement: `spawn_agent` with `fork_turns: none`,
   lowercase/digit/underscore `task_name`, selected `model`/`reasoning_effort` and
   section 7's complete assignment/public skill paths. Parallel parts get distinct
   names/files and shared interfaces; await all before integration.
2. **Reuse implementors.** Retain accepted producing identities. Use `send_message` while running,
   `followup_task` while idle; section 7 governs replacement.
3. **Steer.** Deliver relevant feedback through those controls; interrupt affected
   work when needed. Report unconfirmed delivery/stopping.
4. **Wait.** `paused` requires explicit user pause. Questions stop affected work
   without that transition. Host continuations, including user-role
   `codex_internal_context`, cannot release user-owned waits. Set native `blocked`
   only after the host's consecutive-turn threshold; verification conclusions
   alone do not establish it. Resume the same goal after answers.
   Apply section 9 before completion.
