# Launch Codex readers

Use this reference for step 3 on Codex, after scope, checks, route and every
applicable input are prepared.

Call `collaboration.spawn_agent` once per applicable axis, passing the complete
returned `launch` object unchanged. It binds the selected model/effort, fresh
context, axis task name and loading message. Keep the launch batch limited to
those axes; both must be accepted before the first wait or bound child completion.

Take each accepted child ID from the native response. A returned canonical
`task_name` is an ID; the requested task label is not. Run the returned
`confirm_command`, replacing only `<accepted-child-id>` with that actual ID.
That accepted child owns the axis through completion. For an input/record error,
continue the same child through [reader-inputs.md](reader-inputs.md). Cancelling
an accepted child leaves that axis blocked; it does not authorize another spawn.

Retain the accepted native spawn event for the same child ID, exact model/effort,
`fork_turns: none` and host-visible axis marker. The confirmation file binds those
fields; it does not prove a launch by itself. Only accepted IDs may be waited on.

For a missing ID, launch/confirmation error or failure to finish, follow
[review-recovery.md](review-recovery.md). Keep that axis blocked and retain the
actual error; a replacement or inherited route cannot satisfy it.

On accepted completion, save the reader's complete JSON unchanged at its returned
`reader_record` destination and return to step 4. Product findings need no correction.
