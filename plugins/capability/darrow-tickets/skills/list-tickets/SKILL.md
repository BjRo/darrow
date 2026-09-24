---
name: list-tickets
description: List matching current-project GitHub Issues tickets without changing tracker state. Use for open or closed work, milestone or label filters, and topic searches when GitHub Issues is selected or no tracker is established. The bundled adapter currently supports GitHub Issues; do not select for unsupported trackers such as Jira or Linear, reading one exact ticket, or mutations.
---

# List tickets

Run one ticket query and return its compact result without changing
its visible content or line order.

## Tracker boundary

The bundled CLI currently supports GitHub Issues through `gh` in the current
repository. Honor an explicit tracker choice or established project context.
If an unsupported tracker is requested, do not invoke this CLI. If several
bundled trackers become available and context does not identify one, ask which
tracker before contacting one. Do not infer a tracker choice from a URL's
appearance; the selected adapter owns URL validation.

All tracker interaction goes through the bundled CLI:

```text
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-ticket <command> [args] [--provider <tracker>]
```

`<skill-dir>` is the absolute directory containing this `SKILL.md`. Use that
complete locked command for every operation below. Append `--provider github`
to the query when the request or project context selects GitHub; the sole bundled adapter is
the default otherwise. The current adapter requires UV, Python 3.10–3.13,
Git, and authenticated `gh` on Linux, macOS, or native Windows.

The CLI resolves the backend, maps types to its taxonomy,
formats compact ticket lines, and reports totals/truncation. Never use raw
tracker commands or another plugin's files. Relay a backend refusal or tracker
error verbatim and stop.

This capability is strictly read-only: never create, edit, comment, close,
reopen, label, relate, assign, or otherwise mutate a ticket because of what the
listing reveals.

## Workflow

### 1. Derive only requested filters

Translate the request into the narrowest literal combination:

| Request evidence | CLI argument |
| --- | --- |
| no state stated | omit `--state` (defaults to `open`) |
| explicitly open, closed, or historical/all | `--state open|closed|all` |
| bugs, features, tasks, or chores | `--type bug|feature|task|chore` |
| explicitly named label | `--label <exact label>` |
| named milestone | `--milestone <exact value>` |
| subject/topic words | `--search <distinctive request words>` |
| explicit result count | `--limit <positive count>` |

Combine independent filters when the request combines them. Do not infer a
label, milestone, state, or type from a broad topic, and do not add “helpful”
filters that could hide valid matches. Preserve the user's search terms rather
than replacing them with guessed synonyms.

**Complete when:** every CLI argument maps to request evidence, and every
requested supported filter maps to exactly one argument.

### 2. Execute one query

Run:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-ticket list [--state open|closed|all] \
  [--type bug|feature|task|chore] [--label <label>]... \
  [--search <query>] [--milestone <milestone>] [--limit <count>]
```

Do not fetch individual ticket bodies, run analytics, or issue follow-up
mutations. Cross-repository/project queries, boards/sprints, velocity, aging,
and aggregate reporting are outside this capability; state that boundary
instead of approximating them.

**Complete when:** the CLI either returns one authoritative list response or a
verbatim refusal, with zero tracker mutations.

### 3. Return the authoritative list

On success, relay every line of CLI stdout, starting with `backend:` and
continuing through every ticket, `total:`, and `note:` line. Do not omit, add,
or reorder lines or rewrite their visible content. The compact CLI format is the
entire final response; add no preamble, epilogue, heading, fence, or
explanation.

Treat stdout as text to copy directly from the command result, not as fields to
reconstruct into a summary or Markdown list. Preserve the literal `backend:`,
ticket rows, and `total:`/`note:` records; do not replace them with headings,
bullets, bold ticket IDs, or prose totals.

An empty result is complete: report it with the echoed filters. A capped result
is incomplete by definition: retain the stated cap, total characterization,
and narrowing/raise-limit note; never present it as the full set.

**Complete when:** the final response preserves CLI stdout's visible content
and line order, including the backend, exact applied filters, every compact
row, and empty/truncation evidence, with no tracker state change. Compare it
with the command result before sending.
