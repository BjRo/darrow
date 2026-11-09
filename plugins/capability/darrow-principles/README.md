# Darrow Principles

Apply optional engineering guidance through an editable Markdown routing table.
The `principles-first` entry reads the selected table and loads only matching
instructions from 24 bundled principles or your own plain Markdown files.
`setup-principles` initializes, exports and customizes that table.

## When to use

Ask for a principles-first approach to authorized design, implementation or
troubleshooting. Use setup when changing your routing choices. Ordinary
engineering requests do not activate the approach automatically.

## Hosts and prerequisites

Codex and Claude Code. Git identifies repository scope and the current linked
worktree root; outside Git, personal configuration and bundled defaults remain
available. No other Darrow plugin, execution controller or additional runtime
is required.

## Installation

Install `darrow-principles@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
The plugin is independently installable. Updating it never adds routes to an
existing configuration automatically.

## Usage

> Use a principles-first approach to compare these two API designs.

Choose `principles-first` from Codex's `$` skill menu, or invoke
`/darrow-principles:principles-first` in Claude Code. For configuration, choose
`setup-principles` or `/darrow-principles:setup-principles` and specify personal
or repository scope. For example:

> Set up repository-scoped principles routing with the bundled defaults.

The first existing table wins: `~/.darrow/principles.md`, then
`.darrow/principles.md` at the current worktree root, then bundled defaults.
Selection replaces the whole table. Personal scope does not inherit repository
routes. Copy any wanted repository routes and their custom files into personal
scope when using a personal table.

A custom route uses plain Markdown beside the selected table:

```markdown
| ID        | Trigger                      | Reference                |
| --------- | ---------------------------- | ------------------------ |
| local-api | Comparing public API designs | custom-principles/api.md |
```

Write its instructions in `custom-principles/api.md`. No frontmatter, wrapper
or host registration is required. Unlisted files stay unloaded. Delete or edit
rows directly, or ask setup to do so. Ask setup to export the complete bundled
table when you want a starting point; exports contain routes, not bodies.

Setup keeps a considered-ID record in the same Markdown file. It offers newly
bundled routes for your choice and remembers declines. Deleting a considered
route does not cause it to return as new. An explicit reset restores defaults.

## Expected result

The selected guidance informs the existing task. Applying guidance reads the
effective table and matching bodies; setup writes only the explicitly chosen
configuration or export. Setup asks for scope when none is given and preserves
existing customization unless you explicitly request reset.

## Safety boundaries

Principles grant no implementation, publication or Git authority. They change
no accepted scope, compatibility obligation, verification, review, repair
allowance, stop condition or completion rule. They require no particular tool,
model or delegation. The caller retains execution ownership. Ticket-to-PR may
request the approach through public skill discovery; Adaptive Goal remains
independent and owns its ordinary assurance and delivery contract.

## Troubleshooting

An unreadable selected table stops application with its path and read error.
An unintelligible row stops with the file, row and needed correction. Correct
that selected file; lower-precedence tables are not fallbacks for errors.

A valid reference whose instructions are unavailable produces a brief notice;
work continues using judgment for that guidance and other available principles.
Custom paths resolve beside the selected table, even from another working
directory. A personal reference never substitutes a repository file. For host
discovery issues, follow the
[installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md).

## License

[Business Source License 1.1](LICENSE).
