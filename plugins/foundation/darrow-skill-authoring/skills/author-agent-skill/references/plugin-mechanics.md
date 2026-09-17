# Plugin helper mechanics

Read this reference before adding or changing executable mechanics in a skill.
Choose the smallest runtime surface that supports the target's declared hosts.

## Choose the implementation

- Use existing host tools directly when their invocation is already short,
  stable, and hard to misuse.
- Use portable Bash for genuinely small POSIX launchers, environment adapters,
  and command glue. If Bash owns any logic or tests, also read
  `portable-shell.md` from this reference directory.
- Use a contained Python package managed by UV for substantial parsing,
  filesystem traversal, state validation, subprocess coordination, or mechanics
  that must run on native Windows. Python is warranted by the behavior and host
  support, not by the presence of one conditional.
- Do not introduce a shared plugin runtime or depend on a sibling plugin. Keep
  contextual judgment, authority, and material choices in `SKILL.md`.

## Package Python inside the plugin

Follow the target repository's instructions and existing Python package
conventions. Do not copy inventories, paths, thresholds, or CI structure from
the repository that supplied this skill. If the target has no established
convention, treat the package layout, supported Python range, UV adoption, and
quality bar as contract inputs rather than silently imposing this plugin's own
implementation.

When the target selects Python plus UV, keep the complete package and its
environment inside the owning plugin, and commit both `pyproject.toml` and
`uv.lock`. Declare the supported Python range, expose narrow console entrypoints,
put runtime dependencies in `project.dependencies`, put quality and test tools
in the development dependency group, and set UV's default groups to empty so a
runtime sync cannot install development tools.

Invoke a runtime entrypoint through its package without development groups:

```text
uv run --quiet --frozen --no-dev --project <package-dir> <entrypoint> [arguments]
```

This form works in POSIX shells and native Windows terminals. A small POSIX
launcher may calculate `<package-dir>` for existing Unix callers, but it only
dispatches to the same locked entrypoint and contains no duplicated mechanics.
Give every public operation the same arguments, output, refusal, and exit-status
contract on each supported platform.

## Test and release the helper

Keep fast Python unit and integration tests beside the package. Apply the target
repository's formatting, lint, typing, property-test, and coverage gates rather
than importing thresholds from the skill's source repository. Directly exercise
path normalization, malformed input, failure output, subprocess status, and
platform-specific path forms.

Copy the complete plugin to a fresh temporary directory, remove local virtual
environments and generated state, sync only locked runtime dependencies, and
invoke each public entrypoint from the copy. Confirm that development tools are
absent from the runtime dependency tree. Run this fresh-artifact check on every
claimed native platform; a POSIX compatibility layer does not establish native
Windows support.
