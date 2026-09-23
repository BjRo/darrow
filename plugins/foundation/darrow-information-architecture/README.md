# Darrow Information Architecture

This plugin helps organize repository guidance for coding agents. It keeps the
always-loaded root instructions small, routes agents to narrower guidance when
it applies, and moves repeatable procedures into skills.

It supports both Codex (`AGENTS.md`) and Claude Code (`CLAUDE.md`) while
preserving the loading behavior of each runtime.

## What it provides

### `setup-information-architecture`

Use this when a repository has no agent guidance, one large instruction file,
or an instruction layout that needs redesigning. The skill:

- inventories existing entrypoints, guidance, skills, and runtime adapters;
- classifies guidance as root, scoped, procedural, derived, or documentation;
- proposes a routed file structure before making changes; and
- verifies the resulting structure for both supported runtimes.

Example: _“Set up a lean agent information architecture for this repository.”_

### `doctor-information-architecture`

Use this to audit and improve an existing instruction structure. The skill
finds broken routes, unnecessary resident context, duplication, scope drift,
and guidance that belongs in a skill. It proposes keep, move, rewrite, or
remove actions and reports the context impact before editing.

Example: _“Doctor this repository's agent instructions.”_

### Bundled inspectors

The contained `backend/` package supplies `ia-setup inspect`, `ia-doctor
inspect|verify`, and `ia-write` for approved atomic guidance replacements. Run
all commands through
`uv run --quiet --no-project <plugin>/backend/scripts/run_locked.py`.
The inspectors are read-only; policy and edit decisions remain in the skills.
These are compact structural checks, not complete validators for every Codex
or Claude Code configuration format.

Verification starts from the selected runtime's active entrypoints and native
scoped guidance, then follows explicit Markdown routes through deferred maps
in any repository directory. Other entrypoints remain visible in inventory.
Native imports (including `@AGENTS.md`) resolve from the importing file;
skill resources resolve from their owning skill directory. Ordinary guidance
routes continue to require session-root paths. Explicitly declared mirrors
remain part of the verification gate.

## Design model and boundaries

- **Root guidance** contains rules needed in most sessions and routes to
  everything else.
- **Scoped guidance** applies to a particular area or kind of change.
- **Skills** hold repeatable, intent-triggered procedures.
- **Canonical repository evidence** remains the source for facts that are
  cheap and reliable to recover.

The skills preserve settled decisions from explicit policy or accepted ADRs.
When the repository supports multiple live patterns without an arbiter, they
surface the choice instead of silently turning the dominant pattern into a
rule.

Both skills inspect and propose first, require confirmation before changing
checked-in guidance, and never commit or push implicitly.

## When to use

Organize or audit repository agent guidance. Use another capability for product implementation.

## Hosts and prerequisites

Codex and Claude Code;
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers),
and repository file access on Linux, macOS, or native Windows.
Git resolves the primary worktree when available;
plain directories work without it. The runtime package has no third-party dependencies.

Paths use native filesystem identity while guidance names require exact documented
case. LF, CRLF, and UTF-8 BOM guidance are supported. Directory symlinks are not
traversed; selected broken, looping, external file adapters and unreadable evidence
fail closed. Native imports outside the repository remain host-owned and outside
this compact repository audit. Windows symlink privileges are not assumed.
Output records use UTF-8 on every host, including redirected Windows output.

Approved updates preserve adapter sources, permissions, and newline conventions.
See [atomic guidance updates](references/file-updates.md) for the digest-checked
writer and its concurrency boundary. Inventory and verification never write guidance.

## Validation

The package follows the contained Python + UV migration pattern: committed lock,
separate development tools, Ruff complexity ≤5, strict mypy, property tests, and
separate 95% line/branch coverage gates. Run `scripts/check-python --package
plugins/foundation/darrow-information-architecture/backend` from the Darrow checkout.
The setup and doctor regressions run in pytest across all supported hosts;
no Bash test harness or runtime launcher remains.
The fresh-artifact test copies only this plugin and exercises all public entrypoints
with locked runtime dependencies on Linux, macOS, and native Windows in CI.

## Installation

Install `darrow-information-architecture@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Set up a lean agent information architecture for this repository.

To select it explicitly, choose `setup-information-architecture` from Codex's `$` skill menu,
or use `/darrow-information-architecture:setup-information-architecture` in Claude Code, followed by your request.

## Expected result

An inventory and proposed guidance structure; checked-in guidance changes only after confirmation. No implicit commit or push.

## Troubleshooting

Resolve broken routes and unsettled policy through the named owner. The inspectors do not validate every host configuration format.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
