---
name: principles-first
description: Apply a principles-first approach when the user requests it or another skill requests it as authorized work. Exclude ordinary engineering without an approach request, and route configuration changes to setup-principles.
---

# Apply principles first

Apply guidance within the caller's existing task and authority. This approach
owns no goal, execution, assurance, repair allowance or completion decision.

## Read the routing table

Resolve the personal home from the host's actual runtime environment before
checking paths, for example by querying `HOME` through the shell or the host
equivalent. Use that evidenced absolute path; never infer a home from an OS
account name or a previously observed path.

Select the first existing table in this order:

1. `~/.darrow/principles.md`;
2. `.darrow/principles.md` at the current worktree root from
   `git rev-parse --show-toplevel`, when inside Git; and
3. the [bundled default table](assets/default-principles.md).

Resolve repository scope from the caller's selected task working directory.
Use an explicit task directory from the request, otherwise the current working
directory.
Run `git -C "<task-directory>" rev-parse --show-toplevel`, or run Git with that
working directory, even when the host tool started elsewhere. Use that returned
worktree root for routing, including when the task targets a linked worktree.

Select the table before reading its contents; read bundled defaults only when
they are the selected table. Read that selected file completely before applying guidance. Use the worktree's
own root from any subdirectory, including linked worktrees. A subdirectory's
`.darrow` is not repository configuration. Outside Git, consider only personal
and bundled tables; do not search the working directory or its ancestors.

The selected file replaces the entire table. Never merge personal and
repository rows. Resolve custom references beside that selected file; a
personal reference never substitutes a repository file of the same name.

The Markdown table has `ID`, `Trigger`, and `Reference` columns. Each row
associates one readable situation with one reference. A bundled reference is
`skill:<id>`. A custom reference is
`custom-principles/<name>.md`, resolved beside the selected `principles.md`,
never from the working directory. Custom files are plain Markdown; no
frontmatter, skill registration or `SKILL.md` wrapper is required.

Validate the entire selected table before loading any referenced instructions.
Each row needs an identifiable ID, an intelligible trigger and an intelligible
reference in one of the two forms above. A syntactically valid reference can
name content that is unavailable; that is distinct from unintelligible routing.

If the selected file cannot be read, stop with its path and actual read error.
If a trigger or reference cannot be understood, stop with the file, problem row
and a needed correction. Never skip a bad row, fall back to a different table,
or apply other guidance while configuration is invalid.

Complete when: the whole effective table is read and intelligible, and its
applicable rows are known; otherwise the configuration diagnostic is returned.

## Apply matching guidance

Evaluate row triggers against the current work. Before applying a matching
principle, read its full referenced instructions. For `skill:<id>`, use the
host-advertised skill or read the contained `../<id>/SKILL.md` relative to this
entry's installed directory. Bundled paths are relative to the plugin, never
to an external routing table. For custom references, read the entire selected
table-relative Markdown file. Check or read only the exact path of an applicable
listed reference. Do not list, recurse, glob or search custom directories to
discover filenames or instructions, including when no row matches.
Apply the instructions to the actual design
decision or implementation within the accepted task.
Reevaluate the effective rows as the work moves through design, debugging and
completion. A later matching trigger requires the same full instruction read
before application. Automatic bundled-leaf activation comes only from these
effective rows; a removed route never returns through a leaf description or a
lower-precedence table. Leave unmatched and unlisted files unread; do not scan
custom directories.

When a matching, intelligible reference has an unavailable body, briefly name
the unavailable skill or file and continue with model judgment for that
guidance and any other available matching instructions. Do not claim the
missing guidance was applied. A valid missing body is not a configuration error
and adds no restoration, confirmation or assurance gate. The caller's required
checks still apply. This fallback never waives an unreadable table or an
unintelligible routing row.

Guidance cannot change scope, acceptance, compatibility obligations, authority,
required checks, stop conditions or the owner's repair and completion rules.
It grants no Git effects or additional implementation attempt.

Complete when: every applied principle has been fully read, its relevant
decision is reflected in the work, and the caller's boundaries still hold.
