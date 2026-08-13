---
name: update-ticket
description: Apply exactly one requested mutation—comment, close/reopen, label, relation, or explicit description edit—to exactly one verified tracker ticket. Use when the user asks to update, comment on, close, reopen, label, relate, or rewrite an existing ticket, whether referenced by ID or topic; do not use for creating tickets or bulk/multi-mutation requests.
---

# Update one ticket once

Resolve the target, verify it, and apply only the single mutation the user
authorized.

## Working model

- **Verified target:** one fetched ticket whose ID and title match the user's
  reference. Similarity or a best guess is not enough.
- **Single mutation:** one comment, state transition, label operation, relation
  operation, or description edit. A request containing several mutations must
  be split by the user; apply none until they select the first.
- **Append by default:** findings, progress, evidence, and cross-references are
  comments. The description changes only when the user explicitly asks to edit,
  rewrite, or replace it.
- **Caller-owned relation:** add/remove dependency or parent only when the user
  names both the relation and target ticket.

## Tracker boundary

All tracker interaction goes through the bundled CLI:

```sh
skill_dir=<absolute directory containing this SKILL.md>
ticket="$skill_dir/../../bin/ticket"
```

Run it with `bash`. The CLI verifies targets and relation targets, limits one
relation operation per call, enforces existing labels and deliberate state
transitions, owns backend syntax, and rejects tool attribution. Never use raw
tracker commands or another plugin's files.

Correct and retry an input error caused by your arguments or payload. Relay a
refusal—missing ticket, ambiguous target, already-satisfied/conflicting state,
duplicate relation, unknown label, or backend failure—verbatim and stop. Do not
work around it with a different mutation.

## Workflow

### 1. Require one target and one mutation

Identify the requested mutation before touching the tracker. If the user asks
for multiple changes (for example, comment and close), report that this
capability applies one at a time and ask which to perform first. Do not choose
an order or apply a partial subset.

Resolve the target:

- Explicit ID, including one already bound unambiguously in the conversation:
  run `bash "$ticket" get <id>`. If the returned title conflicts with the
  user's description, report the mismatch and stop.
- Topic/name only: run `bash "$ticket" list --search "<distinctive terms>"`.
  Use a result only when exactly one ticket plausibly matches. For zero or
  multiple plausible matches, report the candidates and stop for selection.

Never mutate from a search result without first having one unambiguous ID.

**Complete when:** exactly one fetched ID/title matches the request and exactly
one authorized mutation is concrete—or zero mutations have occurred and the
smallest target/mutation choice is requested.

### 2. Select the literal operation

Use exactly one command shape:

| User intent | CLI operation |
| --- | --- |
| add findings/progress/evidence | `comment <id> --body-file <file>` |
| close / reopen | `close <id>` / `reopen <id>` |
| add / remove one label | `label <id> --add <label>` / `--remove <label>` |
| add/remove dependency | `relate <id> --depends-on <target>` / `--remove-depends-on <target>` |
| set/remove parent | `relate <id> --parent <target>` / `--remove-parent` |
| explicit description edit/rewrite | `describe <id> --body-file <file>` |

Do not pair a close with a comment, add a label while commenting, or update any
other field as a side effect. Milestone and assignee updates are unsupported;
say so rather than approximating them. Never delete a ticket or edit/delete
another author's comment.

**Complete when:** one CLI operation corresponds exactly to the user's single
requested mutation and no drive-by change is planned.

### 3. Prepare evidence payloads without invention

For a comment or description edit, write the payload to a private temporary
file outside the repository. Preserve quoted errors and known ticket, commit,
branch, and pull-request identifiers verbatim. Record only user/conversation or
repository evidence; do not editorialize, assess the work, pad the update, or
invent status.

For an explicit partial description edit, start from the fetched current body
and preserve every unrelated byte. For an explicit full replacement, use only
the authorized replacement. Tracker-native relations survive the rewrite; do
not add relation marker lines to the description.

Exclude AI/tool attribution, co-author credit, and attribution emoji from every
payload, even when requested. Do not replace them with an attribution
disclaimer inside the ticket.

**Complete when:** the payload is the minimal exact requested content, retains
unrelated description bytes when applicable, and contains no invented facts or
unauthorized metadata.

### 4. Execute once and report

Run the selected CLI command once. Do not follow it with a second mutation,
even if the output suggests an obvious cleanup. Return the verified target ID
and title, followed by the mutation CLI's output verbatim; it records the
authoritative comment URL, state transition, label change, description rewrite,
or resulting relation.

**Complete when:** exactly one mutation is confirmed on exactly one verified
ticket, or a verbatim refusal/candidate list explains why tracker state stayed
unchanged.
