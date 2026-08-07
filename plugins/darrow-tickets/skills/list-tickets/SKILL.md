---
name: list-tickets
description: List matching tickets or issues for the current project without changing tracker state. Use when the user asks what tickets, issues, bugs, or work items exist; what is open or closed; what belongs to a named milestone or label; or what matches a topic—even when no tracker files exist in the repository.
---

# List tickets

Run one backend-neutral query and return its compact result unchanged.

## Tracker boundary

All tracker interaction goes through the bundled CLI:

```sh
skill_dir=<absolute directory containing this SKILL.md>
ticket="$skill_dir/../../bin/ticket"
```

Run it with `bash`. The CLI resolves the backend, maps types to its taxonomy,
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
bash "$ticket" list [--state open|closed|all] \
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

Relay the CLI's ticket lines, `total:` line, and every `note:` line. Do not
rerank, rewrite, summarize, trim, or enrich the rows. The compact CLI format is
the deliverable.

An empty result is complete: report it with the echoed filters. A capped result
is incomplete by definition: retain the stated cap, total characterization,
and narrowing/raise-limit note; never present it as the full set.

**Complete when:** the user sees the exact applied filters, every returned
compact row, and honest empty/truncation evidence without any state change.
