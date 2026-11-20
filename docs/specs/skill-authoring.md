# Skill Authoring retirement

The standalone Skill Authoring plugin is retired. Use writing-for-agents and repository development guidance.
The standalone creation/audit workflow, inspector and shell-matrix backend are no longer maintained.
This implements [migration #328](https://github.com/BjRo/darrow/issues/328)
and [ticket #339](https://github.com/BjRo/darrow/issues/339).

## Retirement invariants

- **R1 — Remove the maintained provider.** Remove `plugins/foundation/darrow-skill-authoring`,
  including manifests, skills, backend, launchers, colocated evals and dedicated
  CI/install checks. Do not retain aliases or executable compatibility shells.
  Verify tracked and unignored distributable payload and public entrypoints are
  absent; preserve ignored developer caches and user-owned state.
- **R2 — Preserve surviving consumers.** Migrate live callers before removal.
  Keep shared Sevro tools, generic fixtures and useful repository checks for
  surviving workflows. Do not retain a retired backend for tooling convenience.
- **R3 — Preserve history.** Keep historical reports and observations unchanged.
  Preserve unaffected ADRs and supersede only replaced assertions. The immutable
  source below preserves the removed implementation and former contract.
- **R4 — Coordinate publication.** The parent migration owns final marketplace
  removal and consumer uninstall/reinstall and fresh-session guidance. Removing
  repository payload does not uninstall cached copies or authorize changes to
  personal installations.

## Immutable source

- [Former plugin](https://github.com/BjRo/darrow/tree/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/plugins/foundation/darrow-skill-authoring)
- [Former contract](https://github.com/BjRo/darrow/blob/de1809c8bcd2dc29ce8d664fbf4ba8b36a259e89/docs/specs/skill-authoring.md)

Historical commands describe that revision, not supported current entrypoints.
