---
name: setup-principles
description: Set up, export, or customize principles-first Markdown routing in repository or personal scope, including adding, editing, deleting and considering new bundled routes. Exclude applying principles to engineering work; use principles-first for that.
---

# Set up principles

## Initialize configuration

For a configuration request, require repository or personal scope. Ask the
user to choose when unspecified; never choose personal scope for them.
Repository scope means `.darrow/principles.md` at the current worktree root
from `git rev-parse --show-toplevel`, including when invoked in a subdirectory
or linked worktree. Use the request's explicit task directory when provided,
otherwise the current working directory. Run that query from the selected directory,
using `git -C "<task-directory>" rev-parse --show-toplevel` or the tool's working
directory when it differs from the host's initial directory. Personal scope means `~/.darrow/principles.md`. Resolve that home from the
host's actual runtime environment before any destination check; never infer
it from an OS account name or a previously observed path.

When the destination is absent, create its parent directory and initialize it
with the entire [bundled table](../principles-first/assets/default-principles.md).
Add a small `## Setup metadata` section in that same Markdown file. Its
`Considered bundled IDs: ` line lists every installed bundled ID once,
separated by comma and space. This baseline records all defaults as considered,
independently of which rows remain active after future customization.

Initialize only an absent destination; preserve an existing file. Keep the
considered-ID metadata when rows are later edited or deleted. Principle bodies
stay in separate lazy-loaded files.

Complete when: the chosen scope is explicit and a newly initialized file has
every default row plus the complete considered-ID baseline, with no unrelated
configuration changes.

## Export the bundled table

When the user requests an export, read the entire
[bundled default table](../principles-first/assets/default-principles.md). Copy that complete
Markdown table to the user's requested destination, or display it inline if
they requested display. The export includes every trigger and skill reference;
keep principle instructions separate. Exporting does not initialize repository
or personal configuration and does not apply the referenced principles.

Complete when: the requested export contains every bundled route and reference,
with no principle bodies and no unrequested configuration changes.

## Customize and consider updates

Read the selected destination completely before editing, including its setup
metadata. Use the same table format and configuration-error rules as
[principles-first](../principles-first/SKILL.md): stop on an unreadable file
with its path and actual error, or an unintelligible row with file, row and
needed correction. Missing referenced guidance does not invalidate a valid row.

Apply requested row additions, edits or deletions without changing installed
files or restoring lower-precedence routes. Preserve unrelated rows and the
considered-ID record. A personal table replaces repository routes; copy wanted
repository routes and custom files into personal scope only when requested.
Custom references stay relative to their destination table. Only an explicit
reset request replaces an existing table with the complete installed defaults
and a fresh complete considered-ID baseline.

For an update check, compare installed bundled IDs with `Considered bundled
IDs`, independently of the active rows. Offer only unconsidered installed IDs,
show their triggers and references, and wait for the user's selection. Add only
accepted rows. Record both accepted and declined offered IDs as considered,
leaving declined rows absent and all customizations intact. Rechecking must not
reoffer them. A deleted considered route is not new. An update alone never adds
routes. Do not invent a migration for legacy files without setup metadata.

Complete when: the requested edits or explicit reset are reflected in the chosen
file, unrelated customizations remain intact, and all decided new IDs are
recorded without reintroducing deleted or declined routes.
