---
name: update-ticket
description: Apply exactly one requested change — comment, close/reopen, label, relation, or description rewrite — to exactly one verified tracker ticket (GitHub Issues or similar). Use whenever the user asks to change an existing ticket/issue — "update the ticket", "comment on #12", "add my findings to the ticket", "close the issue", "close the login ticket", "reopen #12" — even when they reference it by topic instead of id, and even if the repo shows no tracker files; the bundled ticket CLI can search the tracker.
---

# update-ticket

Apply exactly the requested change to exactly one verified ticket.

All tracker interaction goes through the `ticket` CLI at
`<skill-dir>/../../bin/ticket`, where `<skill-dir>` is the directory
containing this SKILL.md — two levels up from here, NOT the repo root. A
skill loaded from `.claude/skills/update-ticket/SKILL.md` finds the CLI at
`.claude/bin/ticket`; installed as a plugin it sits in the plugin's own
`bin/`. Run it with `bash`. The CLI verifies targets, enforces
one-relation-change-per-call, existing-labels-only, deliberate state
transitions and the no-attribution rule; it rejects invalid input with an
explanatory error — fix input errors and retry. Refusals (already closed,
duplicate relation, missing ticket, tracker errors) → relay verbatim and
stop. No raw `gh` or tracker commands.

## Workflow

1. Resolve the target:
   - The user named an id → `bash <skill-dir>/../../bin/ticket get <id>` and
     confirm the title matches what they described. A mismatch → report it
     and stop instead of mutating the wrong ticket.
   - No id → `bash <skill-dir>/../../bin/ticket list --search "<keywords>"`.
     Exactly one plausible match → use it and name it in your report. Zero
     or several → list the candidates and stop; the user picks.
2. Apply the one change the user asked for:
   - Findings/progress → write the text to a temp file outside the repo
     (e.g. under `mktemp -d`), then `... ticket comment <id> --body-file <f>`
   - "close it" / "reopen it" → `... ticket close <id>` / `... ticket reopen <id>`
   - Label change → `... ticket label <id> --add <l>` or `--remove <l>`
   - Relation change → `... ticket relate <id> --depends-on <n> |
     --remove-depends-on <n> | --parent <n> | --remove-parent`
   - Explicit "rewrite/replace the description" request → write the new text
     to a temp file, then `... ticket describe <id> --body-file <f>` (the
     CLI preserves the recorded relations)
3. Report the CLI's output verbatim (it states transitions from → to and
   resulting relations).

## Judgment

- Exactly the asked change: a comment request changes no status, labels or
  relations; a close request adds no comment unless the user asked for one.
- Comment content is evidence: quote errors and commit/PR ids verbatim;
  reference tickets by their real ids. Don't editorialize or pad.
- Status changes only to a state the user named or clearly implied.
- Relations only between tickets the user named.

## Boundaries

- One ticket, one change per invocation; a request for several changes →
  do them as separate CLI calls only if the user listed them explicitly,
  and report each result.
- The description is replaced only when the user explicitly asked for a
  rewrite (`describe`); never touch it as a side effect of anything else,
  and never edit or delete other people's comments.
- Milestone or assignee changes on an existing ticket are not supported by
  the CLI — say so instead of improvising.
- Never delete tickets; never close a ticket the user didn't ask to close.
- No AI attribution in comments (the CLI also rejects it).
