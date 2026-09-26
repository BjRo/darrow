# Darrow Skill Authoring

`darrow-skill-authoring` supplies two independently selectable skills for
Claude Code and Codex:

- `create-agent-skill` builds a new, focused skill from an approved capability,
  destination, runtime, and authority contract.
- `audit-agent-skill` reviews an existing skill or named draft without edits and
  returns findings with evidence and repair acceptance criteria.

## When to use

Use creation when you need a new reusable agent skill. Use audit when you need
findings on an existing skill or draft. Implement audit findings as ordinary
engineering work under the target repository's instructions.

## Safety boundaries

Neither skill owns a general revision workflow.
The plugin is self-contained and does not require another Darrow plugin, MCP
server, or workflow runtime.

Creation may write the new skill and its local tests under the approved
contract. Audit leaves checked-in files unchanged and never performs the
target skill's external action. Neither skill commits, installs, or publishes
without separate user authority.

## Shared mechanics

The plugin-level locked Python backend supplies `inspect-skill` and
`verify-shell-tests` to both skills. The inspector checks portable metadata
and inline Markdown-linked local resources; the skills inspect other path
forms and use native validators for their complete formats. The shell matrix
reports observed interpreter versions rather than inferring them from command
names. On first use, the launcher prepares a locked environment in a
user-writable Darrow cache, leaving the installed plugin read-only.

## Hosts and prerequisites

Claude Code and Codex are supported. The shared backend requires
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers).
The skill needs access to the target repository; the shell matrix only claims
versions it actually runs.

## Development

From this plugin directory, prepare the runtime backend:

```text
uv sync --quiet --frozen --no-dev --project backend
```

From the repository root, run `bun run check:python`. From this plugin
directory, run the bundled shell regression suites:

```text
uv run --quiet --frozen --no-dev \
  --project backend \
  verify-shell-tests -- \
  backend/tests/shell/inspect-skill.test.sh \
  backend/tests/shell/verify-shell-tests.test.sh \
  backend/tests/shell/interpreter-routing.test.sh
```

The matrix exits `3` when a required interpreter is unavailable and leaves
that target unverified. Run the colocated evals with the shared runner and
`--plugin darrow-skill-authoring`; use one trial and one job while diagnosing.
The [eval notes](skills/create-agent-skill/evals/README.md) describe the active
case boundaries.

## Installation

Install `darrow-skill-authoring@darrow` using the
[host installation instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).

## Usage

Ordinary requests can select either skill:

> Create a skill that validates our release notes.

> Audit this skill's discovery and safety boundaries without editing it.

For explicit selection, use `create-agent-skill` or `audit-agent-skill` in
Codex's `$` skill menu, or `/darrow-skill-authoring:create-agent-skill` and
`/darrow-skill-authoring:audit-agent-skill` in Claude Code.

## Expected result

Creation returns a new skill, local evidence, and any unverified host support.
Audit returns read-only findings with repair acceptance criteria.

## Troubleshooting

An unreadable required resource blocks dependent advice. For host problems,
follow the [installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin and host versions, invocation, and error without
credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
