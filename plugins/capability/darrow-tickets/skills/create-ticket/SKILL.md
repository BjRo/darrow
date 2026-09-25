---
name: create-ticket
description: Create one evidence-grounded GitHub Issues ticket or an explicitly requested finite batch of distinct tickets. Use for requests to create, file, open, or track tickets when GitHub is selected or no tracker is established, including a batch whose intended items need clarification. Do not select for unsupported trackers such as Jira or Linear, planning a ticket breakdown without a creation request, or updating tickets.
---

# Create requested tickets

Record the problem or desired outcome already known. Do not refine, decompose,
review, or start the work.

## Working model

- **Explicit batch:** a singular request creates at most one ticket. Create
  several only when the caller identifies a finite set of distinct intended
  tickets. Multiple acceptance criteria for one outcome remain one ticket.
  Do not turn a broad request into a ticket breakdown.
- **Plausible duplicate:** an open ticket appears to describe the same problem
  or desired outcome, not merely the same component or keyword. Report it and
  skip that item until the user decides whether to file anyway. Continue with
  independent requested items.
- **Evidence-grounded body:** facts come from the request, conversation, or
  repository. Unknowns stay explicit questions; they never become invented
  reproduction steps, versions, paths, or acceptance criteria.
- **Caller-owned structure:** dependency, parent, milestone, and assignee
  choices are recorded only when the user names them. The caller may delegate
  the order of an already defined batch; that does not authorize new tickets
  or inferred relations.
- **Whole-batch failure stop:** after any backend refusal, failed relation
  write, or failed relation readback, create no later ticket in this invocation.
  Report every remaining item as not attempted, including independent items.

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
to each command when the request or project context selects GitHub; the sole bundled adapter
is the default otherwise. The current adapter requires UV, Python 3.10–3.13,
Git, and authenticated `gh` on Linux, macOS, or native Windows.

It resolves the backend, validates ticket structure,
restricts labels to the existing taxonomy, verifies relation targets, owns
backend relation syntax, and rejects tool attribution. Never use raw tracker
commands or another plugin's files.

Correct and retry a CLI input error caused by your title/body/arguments before
that item has been created. Relay a backend refusal—missing backend, remote,
ticket target, milestone, assignee, or tracker operation—verbatim. End the
entire batch immediately: do not create any later requested ticket. Retain
completed effects and account for every remaining item; do not invent a
fallback or retry an uncertain creation.

## Workflow

### 1. Establish the requested set and inspect taxonomy

Identify one intended ticket, or the explicit finite list of distinct tickets.
If the count, an item's outcome, or a requested relation is ambiguous, clarify
before any tracker mutation. Do not decompose a feature or choose parent and
dependency structure on the caller's behalf. Identify items that need a ticket
created earlier in the batch and put their creation after that target. Other
items may be processed in the order the caller gave or delegated. Repeat the
search, draft, create, and relation check for one item before moving to the
next; retain their outcomes for the final report. Do not search every item up
front and then create them all. The required sequence is search item 1 →
create item 1 → verify its relations → search item 2 → create item 2 → verify
its relations, continuing in that order until every item has an outcome.

Run:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-ticket inspect
```

Choose each item's type from its described work, not the user's vocabulary:

- `bug`: observed behavior violates an expected behavior;
- `feature`: a new user/product capability or outcome;
- `task`: bounded engineering work with a completion condition;
- `chore`: maintenance with no new product behavior.

Note existing labels. The CLI maps the type to an existing type label
automatically; select additional labels only when inspect showed the exact
label and the evidence clearly matches it.

**Complete when:** the finite requested set, each item's type and named
relations, and a usable backend are known—or clarification/refusal has stopped
the request before mutation.

### 2. Search before creating

For each item, after any previous item's creation and relation readback,
compare its outcome with all earlier batch items and choose the few most
distinctive outcome, error, command, or component terms for a focused
open-ticket search. Run this search even if an earlier search covered similar
terms:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-ticket list --search "<distinctive terms>"
```

Compare the returned titles to this item's requested problem/outcome. If any
is a plausible duplicate, record its ID and title plus why it may match, do
not create that item, and continue with independent items. Do not silently
reuse the candidate as a target for another requested relation. Mark an item
whose named relation target was skipped as not attempted. Do not dismiss a
match merely because its wording differs, and do not block on tickets that
only share a broad area or error word. Compare which operation fails, under
what condition, and the desired outcome.

If the CLI reports a truncated list, narrow the query or raise `--limit` and
search again before deciding the item is clear. If plausible candidates still
cannot be assessed from a complete result, leave that item uncreated and report
why. Continue independent items. A prior batch item with the same outcome is a
duplicate even if the tracker search omits it.

**Complete when:** each item reached has been compared with prior batch
outcomes and has an assessable tracker search, or is left uncreated with an
explicit reason; every plausible duplicate is marked skipped before creation.

### 3. Draft only what is known

For each item that passed its duplicate check, write a concise searchable
title that states its problem or desired outcome, not a speculative
implementation. Keep it one line with no trailing period.

Use exactly the required body structure for the chosen type:

| Type | Required sections |
| --- | --- |
| `bug` | `## Observed`, `## Expected`, `## Reproduction` |
| `feature` | `## Motivation`, `## Acceptance criteria` |
| `task`, `chore` | `## Outcome`, `## Done criteria` |

Give every required section real request/repository evidence. Preserve error
messages verbatim. When required detail is unknown, state only the known signal
in its section and put the precise missing question under optional `## Open
questions`; never fill space with guessed mechanics or boilerplate.

Before creating, make a private claim-to-source checklist: map every factual
sentence and acceptance bullet to the exact request, conversation, or
repository words that support it. Do not put this checklist in the ticket.
Delete any claim without a source. Preserve the source's quantities and
qualifiers; do not transfer a constraint on one dimension to another (for
example, “visible columns” constrains columns, not which rows are exported).
Do not infer that current behavior is absent merely because a feature is
requested.

Do not derive secondary requirements such as pagination, filtering, naming,
performance, rollout, or compatibility merely because an implementation might
need to consider them. Open questions are not discovery prompts: include one
only when the caller explicitly identified an uncertainty, supplied sources
conflict, or a fact required to truthfully populate a mandatory section is
missing. An unstated optional behavior or possible design choice stays omitted.

Do not add AI/tool attribution, co-author credit, or attribution emoji to the
ticket—even when requested. Keep it no more elaborate than the supplied
evidence.

**Complete when:** every item to create has its own specific, non-empty,
non-invented title and required sections sufficient to record the caller's
current knowledge.

### 4. Apply only caller-authorized metadata and create

For each item to create, write its body to a private temporary file outside
the repository, then run one `create` command for that item:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-ticket create --title <title> --type <type> --body-file <absolute-file> \
  [--label <existing-label>]... [--milestone <named-value>] \
  [--assignee <named-value>] [--depends-on <caller-named-id>]... \
  [--parent <caller-named-id>]
```

Never infer `depends-on` or `parent` from content, and never hand-write relation
markers into the body. Use the ID returned by an earlier creation only when
the caller named that item as this item's relation target. Include milestone or
assignee only when explicitly requested for this item. Never create a label,
milestone, or alternative value. If a desired extra label does not exist, omit
it and retain that omission for the report.

If `create` reports a refusal after printing a created ID, record the ticket
as created with the reported partial relations and stop all further ticket
creations in this invocation, even for independent items. If the creation
effect is uncertain, say so and never issue a second `create` attempt for that
item.

**Complete when:** every non-skipped item reached has exactly one verified
creation attempt and its CLI result is recorded, or a refusal has stopped
pending mutations.

### 5. Verify requested relations and report every outcome

After each successful `create` that requested relations, run `get
<created-id>` through the same locked CLI and compare its `parent:` and
`depends-on:` lines with the requested targets. A failed read or mismatch
means the ticket was created but its relation is unverified or wrong; report
that evidence and create no later ticket in this invocation. Never report a
relation as verified solely because its write returned successfully.

Report one outcome for every requested item in the caller's order: created
(with the CLI's authoritative creation output, ID, canonical URL, type, labels,
and verified relations), skipped as a plausible duplicate (ID, title, reason),
refused or creation uncertain (verbatim diagnostic and any completed effect),
or not attempted (reason). Name any requested labels or metadata omitted and
why. Do not add a plan, implementation advice, suggested tracker
configuration, attribution, or another tracker mutation. If attribution was
requested, say only that ticket policy required omitting it.

**Complete when:** the user can identify the outcome and applied or omitted
fields of every requested item, including any created ticket with an
unverified relation and every item left unattempted after a failure.
