---
name: create-ticket
description: Create one evidence-grounded GitHub Issues ticket after checking for a plausible duplicate. Use for creating, filing, opening, or tracking one ticket when GitHub Issues is selected or no tracker is established. Do not select for requests naming another tracker such as Jira or Linear, bulk creation, updating an existing ticket, or planning the work.
---

# Create one ticket

Record the problem or desired outcome already known. Do not refine, decompose,
review, or start the work.

## Working model

- **One ticket:** one invocation creates at most one tracker object. A bulk
  request needs the user to select one item first.
- **Plausible duplicate:** an open ticket appears to describe the same problem
  or desired outcome, not merely the same component or keyword. Report it and
  stop; the user decides whether to file anyway.
- **Evidence-grounded body:** facts come from the request, conversation, or
  repository. Unknowns stay explicit questions; they never become invented
  reproduction steps, versions, paths, or acceptance criteria.
- **Caller-owned structure:** dependency, parent, milestone, and assignee
  choices are recorded only when the user names them.

## Tracker boundary

This provider supports GitHub Issues through `gh` in the current repository.
Honor an explicit tracker choice or established project context. If another
tracker is explicitly requested, do not invoke this CLI. If several installed
providers remain plausible, ask which tracker before contacting one. Do not
infer a provider choice from a URL's appearance; once this provider is selected,
the CLI owns URL validation, including unfamiliar hosts and foreign projects.

All tracker interaction goes through the bundled CLI:

```sh
skill_dir=<absolute directory containing this SKILL.md>
ticket="$skill_dir/../../bin/ticket"
```

Run it with `bash`. It resolves the backend, validates ticket structure,
restricts labels to the existing taxonomy, verifies relation targets, owns
backend relation syntax, and rejects tool attribution. Never use raw tracker
commands or another plugin's files.

Correct and retry a CLI input error caused by your title/body/arguments. Relay
a backend refusal—missing backend, remote, ticket target, milestone, assignee,
or tracker operation—verbatim and stop; do not invent a fallback.

## Workflow

### 1. Inspect taxonomy and classify the request

Run:

```sh
bash "$ticket" inspect
```

Require exactly one intended ticket. Choose its type from the described work,
not the user's vocabulary:

- `bug`: observed behavior violates an expected behavior;
- `feature`: a new user/product capability or outcome;
- `task`: bounded engineering work with a completion condition;
- `chore`: maintenance with no new product behavior.

Note existing labels. The CLI maps the type to an existing type label
automatically; select additional labels only when inspect showed the exact
label and the evidence clearly matches it.

**Complete when:** one ticket outcome, deliberate type, and usable backend are
known—or the request/backend has stopped before mutation.

### 2. Search before creating

Choose the few most distinctive outcome, error, command, or component terms
and run one focused open-ticket search:

```sh
bash "$ticket" list --search "<distinctive terms>"
```

Compare the returned titles to the requested problem/outcome. If any is a
plausible duplicate, report its ID and title plus why it may match, create
nothing, and stop for the user's decision. Do not dismiss a match merely
because its wording differs, and do not block on tickets that only share a
broad area.

**Complete when:** either one or more plausible candidates are reported with
zero creations, or the search evidence supports creating exactly one ticket.

### 3. Draft only what is known

Write a concise searchable title that states the problem or desired outcome,
not a speculative implementation. Keep it one line with no trailing period.

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

**Complete when:** title and required sections are specific, non-empty,
non-invented, and sufficient to record the user's current knowledge.

### 4. Apply only caller-authorized metadata and create

Write the body to a private temporary file outside the repository, then run:

```sh
bash "$ticket" create --title <title> --type <type> --body-file <absolute-file> \
  [--label <existing-label>]... [--milestone <named-value>] \
  [--assignee <named-value>] [--depends-on <caller-named-id>]... \
  [--parent <caller-named-id>]
```

Never infer `depends-on` or `parent` from content, and never hand-write relation
markers into the body. Include milestone or assignee only when explicitly
requested. Never create a label, milestone, or alternative value. If a desired
extra label does not exist, omit it and retain that omission for the report.

**Complete when:** the CLI creates exactly one ticket and verifies every
requested relation, or reports a verbatim refusal with no second creation
attempt.

### 5. Report the authoritative result

Return the CLI output verbatim so the report includes backend, created ID,
canonical URL, type, labels, and relations. Then name any dedup candidates or
requested labels/metadata omitted and the evidence-based reason. Do not add a
plan, implementation advice, suggested tracker configuration, attribution, or
another tracker mutation. If attribution was requested, say only that ticket
policy required omitting it.

**Complete when:** the user can identify the created ticket and every applied
or omitted field—or can see exactly why no ticket was created.
