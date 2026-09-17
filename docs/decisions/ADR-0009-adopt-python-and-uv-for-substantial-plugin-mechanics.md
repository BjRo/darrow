# ADR-0009: Adopt Python and UV for substantial plugin mechanics

Status: Accepted
Date: 2026-09-17
Summary: Adopt contained Python packages managed by UV incrementally for substantial cross-platform plugin mechanics, invoking them directly from installed skill-relative paths.
Supersedes: ADR-0005
Revisit when: UV and supported Python cannot provide independently installable helpers across every supported native host, or a lighter common runtime offers materially better portability and containment.

## Context

ADR-0005 standardized portable Bash because it was available on Darrow's
original macOS and Linux hosts without another runtime. That kept plugins
independent, but substantial parsers and filesystem validators accumulated
conservative shell code and remained unavailable on native Windows.

The Langfuse plugin established the repository's contained Python and UV
pattern: a plugin-local package and lock, frozen execution, separate runtime and
development dependencies, fresh-artifact validation, and repository-wide
Python quality gates. Issue #168 selects incremental migration so each plugin
can adopt that established pattern without creating a shared Darrow runtime.

## Decision

Use a contained Python package managed by UV for substantial deterministic
plugin mechanics when Python materially improves clarity, testing, or native
Windows support.

- Keep the package, `pyproject.toml`, `uv.lock`, entrypoints, dependencies,
  environments, and state inside the owning plugin.
- Colocate a backend used by one skill inside that skill directory. Use a
  plugin-root backend only when multiple skills or non-skill plugin components
  share it.
- Invoke public runtime entrypoints with frozen resolution and without
  development dependencies. Keep development tools in the locked development
  group and register each package in the repository Python inventory.
- Resolve contained backends from the installed skill directory supplied by
  the host, such as Claude Code's `${CLAUDE_SKILL_DIR}` or the absolute
  `SKILL.md` path in Codex's skill catalog, and invoke its locked UV
  entrypoints directly. Do not add a launcher whose only responsibility is
  locating the same backend and forwarding arguments. Retain portable Bash only
  when a host contract requires command, lifecycle, or protocol adaptation that
  direct invocation cannot express.
- Validate cross-platform entrypoints from a fresh copied plugin artifact on
  Linux, macOS, and native Windows. Apply the repository Python quality gates
  across the declared Python support range.
- Adopt Python incrementally. A plugin without substantial cross-platform
  mechanics does not need a Python package, and no plugin may depend on a
  sibling package or shared Darrow runtime.
- Keep contextual judgment, authority, and material choices in `SKILL.md`;
  language choice does not expand a helper's responsibility.

ADR-0008 remains the authoritative record for the Langfuse plugin's hook and
failure semantics. This decision generalizes the established packaging and
quality model to later plugin migrations.

## Consequences

- Migrated helpers can run through the same locked console entrypoints on
  native Windows, macOS, and Linux.
- Substantial mechanics gain strict typing, focused unit and integration tests,
  property tests where useful, and separate line and branch coverage gates.
- Adopters of a Python-backed plugin need UV and a supported UV-managed Python;
  plugins that have not migrated keep their existing prerequisites.
- Necessary host adapters remain narrow and inspectable, while path-only UV
  launchers do not create a second, platform-specific entrypoint.
- Every migration must preserve the plugin's independent installation boundary
  and prove behavior at its existing public entrypoints.
