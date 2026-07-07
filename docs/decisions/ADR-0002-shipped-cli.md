# ADR-0002: Shipped CLIs are bash, placed at plugin level

Status: Accepted
Date: 2026-07-07

## Context

darrow-tickets needs a backend facade (`ticket`) shared by three skills
(create-ticket, update-ticket, list-tickets) — the first shipped CLI, which
ADR-0001 and the product spec (§8) deferred deciding a language for. Two
constraints shape the decision:

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
portability rules already codified in AGENTS.md. Revisit (Go static binary)
if a shipped CLI outgrows bash — complex state, concurrency, or heavy
parsing; TS/Bun stays runner-only because consumers can't be assumed to
have bun.

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
- M1's generator emits plugin-level `bin/` as-is — the layout is already
  the generated artifact shape.
