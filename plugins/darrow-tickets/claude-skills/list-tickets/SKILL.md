---
name: list-tickets
description: List the project's tracked tickets/issues (GitHub Issues or similar), read-only. Use whenever the user asks what bugs, issues, tickets or work items exist or are open — "what bugs are open right now?", "what's open?", "list open tickets", "show open bugs", "which tickets are in milestone X", "find tickets about Y" — even if the repo shows no tracker files; the bundled ticket CLI knows the backend.
---

# list-tickets

Report matching tickets. Read-only: this skill never mutates the tracker.

All tracker interaction goes through the `ticket` CLI at
`<skill-dir>/../../bin/ticket`, where `<skill-dir>` is the directory
containing this SKILL.md — two levels up from here, NOT the repo root. A
skill loaded from `.claude/skills/list-tickets/SKILL.md` finds the CLI at
`.claude/bin/ticket`; installed as a plugin it sits in the plugin's own
`bin/`. Run it with `bash`. Backend refusals or tracker errors →
relay verbatim and stop. No raw `gh` or tracker commands.

## Workflow

1. Derive the filters from the request and run:
   `bash <skill-dir>/../../bin/ticket list [--state open|closed|all]
   [--type bug|feature|task|chore] [--label <l>]... [--search <q>]
   [--milestone <m>] [--limit <n>]`
2. Relay the result: the ticket lines, the `total:` line (it echoes the
   filters applied) and any `note:` lines — never drop a truncation note or
   present a capped list as complete.

## Judgment

- Open tickets are the default; pass `--state closed` or `--state all` only
  when the user asked about closed or historical tickets.
- "bugs" → `--type bug`; a named label → `--label`; free-text topics →
  `--search` with the distinctive words.
- An empty result is an answer: report it together with the filters that
  produced it (the CLI prints both).

## Boundaries

- Read-only — never create, comment, close, label or relate from here,
  even when the listing suggests obvious cleanups; mention them instead.
- Don't re-rank, re-summarize or trim the list beyond what the CLI printed;
  the compact line format is the deliverable.
- Cross-repo or analytics questions (velocity, aging) are out of scope —
  say so.
