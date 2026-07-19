---
name: create-ticket
description: Create exactly one well-formed tracker ticket for a problem or desired outcome. Use when the user says "create a ticket", "file an issue", "open a bug for this", "track this", "turn this into a ticket", or otherwise asks to record work in the tracker.
---

# create-ticket

Create exactly one ticket that captures the problem or desired outcome.

All tracker interaction goes through the `ticket` CLI at
`<skill-dir>/../../bin/ticket`, where `<skill-dir>` is the directory
containing this SKILL.md — two levels up from here, NOT the repo root. A
skill loaded from `.claude/skills/create-ticket/SKILL.md` finds the CLI at
`.claude/bin/ticket`; installed as a plugin it sits in the plugin's own
`bin/`. Run it with `bash`. The CLI resolves the backend, enforces
body structure per type, existing-labels-only, relation-target existence and
the no-attribution rule, and rejects invalid input with an explanatory error
— fix input errors and retry. Backend refusals (missing gh, no remote,
tracker errors) → relay verbatim and stop. No raw `gh` or tracker commands.

## Workflow

1. `bash <skill-dir>/../../bin/ticket inspect` — note the backend and which
   labels exist (create maps `--type` to an existing label automatically).
2. `bash <skill-dir>/../../bin/ticket list --search "<keywords>"` — search
   with the most distinctive words of the problem. A result that plausibly
   describes the same problem → report its id and title and stop; the user
   decides whether to file anyway. Create only when nothing matches.
3. Write the body to a temp file outside the repo (e.g. under `mktemp -d`;
   never a file in the working tree), then:
   `bash <skill-dir>/../../bin/ticket create --title <t> --type <type> --body-file <f> [--label <l>]... [--milestone <m>] [--assignee <a>] [--depends-on <id>]... [--parent <id>]`
4. Report the CLI's output verbatim (id, URL, type, labels, relations,
   notes), plus any dedup candidates or labels you left out and why.

## Judgment

- Type: bug | feature | task | chore — chosen from what the user describes,
  not the words they use ("it crashes" is a bug even if nobody says "bug").
- Body structure the CLI requires: bug → `## Observed`, `## Expected`,
  `## Reproduction`; feature → `## Motivation`, `## Acceptance criteria`;
  task/chore → `## Outcome`, `## Done criteria`.
- Evidence only: quote error messages verbatim; take paths, commands and
  versions from the conversation or the repo. Anything you don't know goes
  under an optional `## Open questions` heading — never invent repro steps
  or speculative details.
- The ticket is only as elaborate as what is already known: record the
  request, don't refine or expand it.
- Title: concise, specific, states the problem or outcome — not the
  implementation. No trailing period.
- Extra `--label` values: only labels shown by inspect, and only when they
  clearly apply (e.g. an area label matching the affected code).
- `--depends-on` / `--parent`: only when the user named the related ticket.
  Never infer structure from content.
- `--milestone` / `--assignee`: only when the user asked for them; the
  backend rejects unknown values — relay that verbatim, never invent
  alternatives.

## Boundaries

- One ticket per invocation; bulk requests → ask the user to go one by one.
- A plausible dedup match → report and stop; never file a duplicate on your
  own judgment.
- Never create labels or milestones; a label that doesn't exist is omitted
  and mentioned in your report.
- Never plan, break down, or review the work itself — other capabilities
  own that; this skill records.
- No AI attribution anywhere (the CLI also rejects it).
