# ADR-0002: Plugin-local shared CLIs use Bash

Status: Accepted
Date: 2026-07-07

## Context

darrow-tickets needs a backend facade (`ticket`) shared by three skills
(create-ticket, update-ticket, list-tickets). This ADR covers small shared tools
that ship inside a plugin, not the independently installed global orchestration
CLI covered by [ADR-0003](ADR-0003-global-cli.md). Two constraints shape the
decision:

- **Consumer footprint.** Plugins install into arbitrary projects via the
  marketplace; every runtime dependency the CLI needs is friction for every
  consumer.
- **Deployment geometry.** A shared CLI must resolve from a skill in every
  layout: the repo (`plugins/<name>/skills/<skill>/`), the plugin cache
  (`…/<plugin>/<hash>/skills/<skill>/`), and the eval fixture (skill dir
  mounted at `.claude/skills/<skill>` / `.agents/skills/<skill>`).

## Decision

**Language: bash.** Zero runtime dependencies beyond the backend's own CLI
(`gh` for GitHub Issues); JSON handling via gh's built-in `--jq` (embedded,
no external jq). Consistent with the existing skill scripts and the shell
portability rules already codified in AGENTS.md. Revisit the plugin-local tool
if it outgrows Bash through complex state, concurrency, or heavy parsing;
consumers of capability-only plugins cannot be assumed to have Bun.

**Placement: `plugins/<name>/bin/<cli>`**, referenced from skills as
`<skill-dir>/../../bin/<cli>`. Two levels above the skill dir is the plugin
root in the repo and in the plugin cache; the eval fixture mounts a
plugin's `bin/` at `<mount>/../bin` (e.g. `.claude/bin`), preserving the
same relative geometry. No env-var dependency (`CLAUDE_PLUGIN_ROOT` has no
Codex analog); plugin self-containment holds.

**Enforcement lives in the CLI.** Where several skills share one facade,
the CLI owns mechanics plus every checkable invariant (input validation,
attribution rejection, existence checks); SKILL.md keeps judgment only.
Per-skill scripts appear only when a skill needs behavior the shared CLI
shouldn't carry. The CLI's deterministic test sits next to it
(`bin/<cli>.test.sh`, run with bash 5 and /bin/bash 3.2).

## Consequences

- Consumers need nothing beyond git + the backend CLI the plugin already
  requires; no interpreter/runtime matrix.
- The fixture runner gains one rule (mount plugin `bin/` beside the skill
  mounts) that applies to all future plugins with shared CLIs.
- bash caps CLI complexity; the AGENTS.md portability classes apply in
  full. A future CLI that fights bash triggers a new ADR, not a workaround.
- Directly authored plugins retain `bin/` as canonical source. Mechanical
  packaging may copy it, but no generator owns a second plugin tree.
