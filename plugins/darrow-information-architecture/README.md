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

`skills/setup-information-architecture/scripts/ia-setup.sh` inventories the
repository surfaces needed to design an instruction graph. `bin/ia-doctor`
inspects routes, runtime reachability, adapter drift, duplicates, cycles, and
root context size; the doctor skill reaches it through its colocated script.
These are compact structural checks, not complete validators for every Codex
or Claude Code configuration format.

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

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. "Darrow" is a trademark of Björn Rochel; forks
must rename. Part of the [Darrow](https://github.com/BjRo/darrow) marketplace.
