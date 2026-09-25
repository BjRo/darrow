# Darrow Tickets

This independently installable plugin provides everyday ticket operations. Four
skills decide what the user means and how to present evidence; one contained
Python package selects a tracker adapter and performs the requested operation.
GitHub Issues through `gh` is the only bundled adapter in this release.

The operation skills and CLI shape remain stable as adapters are added inside
this plugin. Callers request ticket operations by intent without reading its
files. An explicit tracker choice takes precedence over project context. With
one bundled adapter, GitHub is the default; with several, an unresolved choice
must be clarified before tracker access. An unavailable selected adapter never
falls back to GitHub.

## Prerequisites

Install `darrow-tickets` from the Darrow marketplace after checking
[hosts and prerequisites](#hosts-and-prerequisites).

Claude's session-start hook supplies static discovery context so matching
requests activate the owning skill before repository inspection or prerequisite
judgments. It uses the same frozen Python package, without inspecting the
repository or contacting GitHub. Workflow and authority remain in the skill.

## What it provides

### `create-ticket`

Creates one evidence-grounded ticket or an explicitly requested finite set of
distinct tickets. It checks each item for a plausible duplicate, selects its
type, uses the tracker's existing label taxonomy, structures its body,
preserves unknowns as open questions, and records only caller-named relations.
It verifies requested relations after creation and reports every batch outcome.

Example: _“File a bug for the failing CSV import.”_

### `list-tickets`

Runs one read-only query using only the state, type, label, milestone, topic,
and limit filters present in the request. It returns compact results with honest
totals and truncation information.

Example: _“Which open bugs are in the next milestone?”_

### `read-ticket`

Retrieves one exact current-project ticket by ID or canonical URL. It returns
the authoritative metadata, a provider-owned `ticket-token:`, tracker-native relations, and full description
without summarizing, interpreting, or changing tracker state.

Example: _“What does ticket #42 say?”_

### `update-ticket`

Applies exactly one requested mutation to exactly one verified ticket. It can
comment, close or reopen, add or remove a label, add or remove a dependency or
parent relation, or explicitly replace the description. Progress and evidence
append as comments by default.

Example: _“Comment on #42 with the failing command.”_

### `darrow-ticket`

A contained Python facade used by all four skills. Its public argument parser
preserves provider-owned identifiers, selects one bundled adapter, and then
dispatches one operation. Shared validation covers ticket body structure and
attribution. The GitHub adapter owns numeric IDs, repository resolution, `gh`
calls, label mapping, relation syntax, and GitHub output. Future adapters stay
inside this package and own their own identifiers, scope, credentials, native
state mapping, and relation mechanics.

Invoke the package directly from any current-project working directory:

```text
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" darrow-ticket inspect
```

Pass `--provider github` after a command's arguments to select the bundled
adapter explicitly. Unsupported choices, including `--provider linear`, refuse
before tracker access. A supplied URL is validated by the selected adapter;
its appearance does not select a tracker.

The commands include local `temp-file`, plus `inspect`, `list`, `get`, `create`, `comment`, `describe`,
`close`, `reopen`, `label`, and `relate`. Existing GitHub options, compact reports,
refusals, and exit codes are preserved. There is no Bash compatibility launcher.
GitHub JSON is decoded and validated in Python; subprocesses use argument
vectors and the resolved origin's host/repository. Temporary creation payloads
use `$HOME/.darrow/tmp` on Linux/macOS or `%LOCALAPPDATA%\Darrow\Tmp` on Windows.
Set `DARROW_TMP_DIR` to another absolute directory if needed. `temp-file`
allocates a private skill draft without contacting the tracker; the skill
deletes it after use. The separate provider copy is closed before `gh` opens
it and removed after success or failure.

Exit codes: 2 input/filesystem error, 3 unusable backend, 4 provider failure,
5 invalid title, 6 attribution, 7 body structure, 8 label error, 9 state refusal,
64 unknown or missing command.

## Design boundaries

- `create-ticket` may create an explicitly requested finite batch of distinct
  tickets in one skill invocation. A singular request creates at most one.
  The CLI still creates one ticket per `create` command; `update-ticket`
  mutates at most one ticket.
- Similar titles are not enough to guess a target, duplicate, label, relation,
  milestone, or assignee.
- Ticket content contains repository or user evidence, never invented versions,
  reproduction steps, acceptance criteria, or AI attribution.
- `read-ticket` and `list-tickets` are strictly read-only, and `update-ticket`
  applies only the single mutation requested.
- A selected adapter is the only tracker contacted. Adding another adapter must
  preserve exact target validation, honest pagination and failure reporting,
  and the provider-owned opaque `ticket-token:` value.
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
uv run --quiet --no-project "<plugin-root>/backend/scripts/run_locked.py" python "<plugin-root>/backend/tests/fresh_install.py"
```

It checks the installed entrypoint, absence of development dependencies and old
launchers, and all eleven commands from a fresh copy. Git runs natively and `gh`
must be installed; provider operations are mocked so validation cannot write
to live GitHub state. The colocated skill evals exercise judgment separately.

## When to use

Operate on current-project GitHub Issues. Linear and other trackers are not yet
supported; an explicit request for one stops before tracker access.

## Hosts and prerequisites

Codex and Claude Code on Linux, macOS, and native Windows;
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
Git, `gh` authenticated for the repository's GitHub host, and a usable `origin`
remote. Runtime dependencies are otherwise empty.

## Installation

Install `darrow-tickets@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.
Existing `darrow-tickets-github` installations must be removed before installing
the renamed plugin, then a new host session started. Installing both identities
would expose duplicate ticket skills.

## Usage

An ordinary request can select the appropriate capability:

> What does ticket #42 say?

To select it explicitly, choose `read-ticket` from Codex's `$` skill menu,
or use `/darrow-tickets:read-ticket` in Claude Code, followed by your request.

## Expected result

Read and list return tracker evidence without changes. Create reports each
requested ticket outcome; update performs one requested mutation.

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
