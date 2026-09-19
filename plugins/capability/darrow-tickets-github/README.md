# Darrow Tickets for GitHub

This independently installable plugin provides everyday ticket operations for
GitHub Issues. The skills decide what the user means and how to present evidence;
one bundled CLI resolves the current repository, validates targets and taxonomy,
and performs only the requested operation through `gh`.

The result is a consistent ticket workflow without teaching every skill raw
tracker commands. Skill names and operation contracts stay provider-neutral;
other trackers belong in separate provider plugins. Callers request ticket
operations by intent without reading this plugin's files. Explicit tracker
choices and established project context select the provider; unresolved choices
between installed providers require clarification before tracker access.

## Prerequisites

Install `darrow-tickets-github` from the Darrow marketplace after checking
[hosts and prerequisites](#hosts-and-prerequisites).

Claude's session-start hook supplies static discovery context so matching
requests activate the owning skill before repository inspection or prerequisite
judgments. It uses the same frozen Python package, without inspecting the
repository or contacting GitHub. Workflow and authority remain in the skill.

## What it provides

### `create-ticket`

Creates at most one evidence-grounded ticket after checking open work for a
plausible duplicate. It selects an explicit type, uses the tracker's existing
label taxonomy, structures the body for that type, preserves unknowns as open
questions, and records relations only when the user names them.

Example: _“File a bug for the failing CSV import.”_

### `list-tickets`

Runs one read-only query using only the state, type, label, milestone, topic,
and limit filters present in the request. It returns compact results with honest
totals and truncation information.

Example: _“Which open bugs are in the next milestone?”_

### `read-ticket`

Retrieves one exact current-project ticket by ID or canonical URL. It returns
the authoritative metadata, a provider-owned `ticket-token: N`, tracker-native relations, and full description
without summarizing, interpreting, or changing tracker state.

Example: _“What does ticket #42 say?”_

### `update-ticket`

Applies exactly one requested mutation to exactly one verified ticket. It can
comment, close or reopen, add or remove a label, add or remove a dependency or
parent relation, or explicitly replace the description. Progress and evidence
append as comments by default.

Example: _“Comment on #42 with the failing command.”_

### `darrow-ticket`

A contained Python facade used by all four skills. It resolves the current
GitHub repository, inspects its taxonomy, searches and fetches tickets, validates
structured bodies and transition targets, owns backend-specific relation
syntax, and rejects ambiguous or unsupported mutations. It exposes the
capability through deterministic commands rather than as a general tracker
client.

Invoke the package directly from any current-project working directory:

```text
uv run --quiet --frozen --no-dev --project "<plugin-root>/backend" darrow-ticket inspect
```

The commands remain `inspect`, `list`, `get`, `create`, `comment`, `describe`,
`close`, `reopen`, `label`, and `relate`. Their options, compact reports,
refusals, and exit codes are preserved. There is no Bash compatibility launcher.
GitHub JSON is decoded and validated in Python; subprocesses use argument
vectors and the resolved origin's host/repository. Temporary creation payloads
are closed before `gh` opens them and removed after success or failure.

Exit codes: 2 input/filesystem error, 3 unusable backend, 4 provider failure,
5 invalid title, 6 attribution, 7 body structure, 8 label error, 9 state refusal,
64 unknown or missing command.

## Design boundaries

- One invocation creates or mutates at most one ticket; bulk operations require
  the user to select work explicitly.
- Similar titles are not enough to guess a target, duplicate, label, relation,
  milestone, or assignee.
- Ticket content contains repository or user evidence, never invented versions,
  reproduction steps, acceptance criteria, or AI attribution.
- `read-ticket` and `list-tickets` are strictly read-only, and `update-ticket`
  applies only the single mutation requested.
- GitHub calls use the origin repository's host even when `GH_HOST` or
  `GH_REPO` names another target in the caller's environment.
- Parent relations are supported within the current repository. An existing
  foreign parent stops reads and parent changes with its canonical URL.
  Dependency reads follow all pages; a failed page stops reporting and any
  mutation waiting on that read.
- Label additions and removals refuse literal names containing commas because
  `gh` would split those names into separate labels.

## Validation

From the Darrow checkout, run `bun run check:python`. The package includes
mocked provider and filesystem tests plus deterministic property tests. CI runs
Python 3.10–3.13 on Linux, macOS, and Windows. Run the copied-artifact check with:

```text
uv run --quiet --frozen --no-dev --project "<plugin-root>/backend" python "<plugin-root>/backend/tests/fresh_install.py"
```

It checks the installed entrypoint, absence of development dependencies and old
launchers, and all ten commands from a fresh copy. Git runs natively and `gh`
must be installed; provider operations are mocked so validation cannot write
to live GitHub state. The colocated skill evals exercise judgment separately.

## When to use

Operate on current-project GitHub Issues. Use the matching provider for another tracker and clarify an ambiguous provider before access.

## Hosts and prerequisites

Codex and Claude Code on Linux, macOS, and native Windows;
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
Git, `gh` authenticated for the repository's GitHub host, and a usable `origin`
remote. Runtime dependencies are otherwise empty.

## Installation

Install `darrow-tickets-github@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> What does ticket #42 say?

To select it explicitly, choose `read-ticket` from Codex's `$` skill menu,
or use `/darrow-tickets-github:read-ticket` in Claude Code, followed by your request.

## Expected result

Read and list return tracker evidence without changes. Create and update perform at most one requested operation.

## Troubleshooting

A foreign URL, ambiguous reference, unreadable relation, or backend error is authoritative. Do not strip a foreign URL to its numeric suffix.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
