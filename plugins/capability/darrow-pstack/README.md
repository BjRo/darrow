# Darrow Pstack

Investigate changes, correct recurring mistakes, maintain project verification,
and check performance measurements with six explicitly invoked workflows from
Lauren Tan's pstack. Edit writing with `unslop`, or apply optional engineering
guidance through an editable Markdown routing table.
The `principles-first` entry reads the selected table and loads only matching
instructions from 24 bundled principles or your own plain Markdown files.
`setup-principles` initializes, exports and customizes that table.

## When to use

Invoke a focused workflow for one of these tasks:

| Skill                         | Result                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `blast-radius`                | Downstream risks and executable proof of the change's safety assumptions          |
| `correct`                     | Bounded fixes that prevent evidenced, recurring agent mistakes                    |
| `create-verification-skill`   | A project-local skill and feature map, exercised on the real app                  |
| `maintain-verification-skill` | Source and live checks of an existing verification skill, with proven corrections |
| `why`                         | Design rationale cited from commits, PR discussions and other records             |
| `benchmark-checklist`         | A performance verdict supported by checked measurements                           |

These six workflows require explicit invocation on both hosts. Ordinary matching
intent does not activate them. They do not replace independent review or delivery
orchestration.

Explicitly invoke `unslop` to edit supplied writing. It does not activate from
ordinary writing requests. Ask for a principles-first approach to authorized design, implementation or
troubleshooting. Use setup when changing your routing choices. Ordinary
engineering requests do not activate the approach automatically.

## Hosts and prerequisites

Codex and Claude Code. Git identifies repository scope and the current linked
worktree root; outside Git, personal configuration and bundled defaults remain
available. No other Darrow plugin, execution controller or additional runtime
is required.
Workflows need the tools for their target: Git and optional forge access for
history, a runnable application for verification, or measurement tools for
performance. Verification maintenance uses native source readers when available
and otherwise discloses sequential source inspection. Missing live evidence is
reported as a gap.

## Installation

Install `darrow-pstack@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
The plugin is independently installable. Updating it never adds routes to an
existing configuration automatically.

## Usage

For example, invoke `$darrow-pstack:blast-radius` in Codex or
`/darrow-pstack:blast-radius` in Claude Code, followed by:

> Check this local diff. Prove the assumption that makes the changed cache cleanup safe.

Use the same host prefix with each workflow name in the table. An ordinary
request such as "what could this break?" does not select these explicit-only
workflows.

Invoke `$darrow-pstack:unslop` in Codex or `/darrow-pstack:unslop` in Claude
Code with the text you want edited. For principle guidance:

> Use a principles-first approach to compare these two API designs.

Invoke `$darrow-pstack:principles-first` in Codex, or invoke
`/darrow-pstack:principles-first` in Claude Code. For configuration, choose
`setup-principles` or `/darrow-pstack:setup-principles` and specify personal
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

The selected workflow returns its findings, evidence and unresolved gaps.
`correct` may edit the authorized repository area. Verification creation writes
a project skill, its feature map and helpers, then exercises one mapped feature.
Maintenance edits only the existing verification skill and its own resources.
Investigation and performance proof scripts use disposable scratch space.

`unslop` rewrites supplied text while preserving its meaning and intended tone.
The selected guidance informs the existing task. Applying guidance reads the
effective table and matching bodies; setup writes only the explicitly chosen
configuration or export. Setup asks for scope when none is given and preserves
existing customization unless you explicitly request reset.

## Safety boundaries

Explicit invocation selects the workflow and its documented local effects.
It grants no unrelated product repair, commit, push, PR or merge authority.
Verification runs use isolated local or approved test environments; external
side effects require request-specific authority. Maintenance publishes a PR only
when explicitly or previously authorized. Generated skills use the target
repository's conventions for Codex and Claude entrypoints, never plugin caches.

Principles grant no implementation, publication or Git authority. They change
no accepted scope, compatibility obligation, verification, review, repair
allowance, stop condition or completion rule. They require no particular tool,
model or delegation. The caller retains execution ownership. Ticket-to-PR may
request the approach through public skill discovery; Adaptive Goal remains
independent and owns its ordinary assurance and delivery contract.

## Troubleshooting

For an unavailable history source, profiling tool or app prerequisite, retain
the gap in the report. A verification skill whose instructions never ran is a
draft. Do not repair product startup or weaken a feature map merely to report
success. Workflow source pins, support files and adaptations are recorded in
[workflow provenance](references/workflows/LOCAL-DIFFERENCES.md).
If the host protects a project skill directory, report the refused write and
undelivered skill. A declared project path does not override host permissions.

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

[MIT](references/LICENSE), including the moved Darrow adaptations. Lauren Tan authored the
upstream pstack source. Björn Rochel maintains Darrow's adaptations, routing
and packaging. See [source provenance and local differences](references/PROVENANCE.md).
Unrelated Darrow plugins retain their own licenses.
