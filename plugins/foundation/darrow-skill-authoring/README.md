# Darrow Skill Authoring

`darrow-skill-authoring` provides one workflow for creating, revising, and
validating focused agent skills that remain useful in both Claude Code and
Codex.

## Skill

- `author-agent-skill` defines an observable skill contract, tests discovery
  and workflow behavior, separates deterministic mechanics from judgment, and
  verifies the resulting package in fresh context.

The plugin is self-contained. It does not require another Darrow plugin, an MCP
server, or a workflow runtime. Its locked Python inspector validates portable
metadata and containment for inline Markdown-linked local resources on Linux,
macOS, and native Windows; the workflow inspects other path forms, and native
runtime validators remain authoritative for their complete formats.

## Design boundaries

Validation keeps the target repository read-only. On first use, UV may create
`skills/author-agent-skill/backend/.venv` inside the installed plugin and fetch
the locked Python environment. Creation and revision require a supplied goal,
destination, supported runtimes, and clear authority. The skill does not invent
a capability or publish it without a separate explicit request.

## Development

From this plugin directory, prepare the locked helper environment without
development dependencies:

```text
uv sync --quiet --frozen --no-dev --project skills/author-agent-skill/backend
```

From the repository root, run the Python quality checks with
`bun run check:python`. From this plugin directory, run the compatibility shell
suites through the version-aware matrix:

```text
uv run --quiet --frozen --no-dev \
  --project skills/author-agent-skill/backend \
  verify-shell-tests -- \
  skills/author-agent-skill/scripts/inspect-skill.test.sh \
  skills/author-agent-skill/scripts/verify-shell-tests.test.sh \
  skills/author-agent-skill/scripts/interpreter-routing.test.sh
```

The matrix reports observed interpreter versions. Exit `3` leaves an unavailable
required version unverified; two executable names do not prove two versions.

Run the judgment evals from the repository `evals` directory:

```sh
bun runner/run.ts --case author-agent-skill --harness claude --dry
bun runner/run.ts --case author-agent-skill --harness claude
```

See the [eval case and shell-evidence notes](skills/author-agent-skill/evals/README.md)
when changing reporting checks or interpreting coverage.

## When to use

Create, revise, or validate one reusable skill. Do not use it for generic instruction-file prose or an invented capability.

## Hosts and prerequisites

Codex and Claude Code; UV and a UV-managed Python `>=3.10,<3.14`. Shell-matrix
verification also needs the target interpreters and their baseline Unix tools.
Live evaluations need the target's supported host harness.

## Installation

Install `darrow-skill-authoring@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Validate this skill for Claude Code and Codex.

To select it explicitly, choose `author-agent-skill` from Codex's `$` skill menu,
or use `/darrow-skill-authoring:author-agent-skill` in Claude Code, followed by your request.

## Expected result

Validation reports evidence without edits. Revision produces a bounded skill and checks. Installation and publication need separate authority.

## Troubleshooting

An unreadable required resource blocks dependent advice. The version-aware shell helper keeps a missing interpreter unverified; fix the exact named input before rerunning.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
