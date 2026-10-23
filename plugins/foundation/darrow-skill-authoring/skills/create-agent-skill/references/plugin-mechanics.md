# Executable helper mechanics

Read this before adding or changing executable mechanics. Use the smallest
runtime surface that fits the target repository and its declared hosts.

## Choose the implementation

- First inspect the target's instructions, manifests, lockfiles, existing
  helpers, and supported hosts.
- Call existing tools directly when the call is short, stable, and hard to
  misuse.
- Use small command glue for launchers and simple composition, in an
  environment the target already supports. For shell, also read
  `portable-shell.md` in this directory.
- Use a packaged helper in the target's runtime for substantial parsing,
  filesystem traversal, state validation, or subprocess coordination.
- If the target has no applicable runtime or package-manager convention, ask.
  Do not import this repository's choice as a default.
- Add no shared plugin runtime and no dependency on a sibling plugin. Keep
  judgment, authority, and material choices in `SKILL.md`.

## Contain a packaged helper

Follow the target's package layout, manifest, lockfile, dependency,
entrypoint, and quality conventions. Do not copy this repository's paths,
versions, thresholds, or CI structure.

Keep the package and its generated state inside the owning plugin. Commit the
manifest and lockfile, expose narrow public entrypoints, declare the supported
runtime range, and keep runtime dependencies separate from test and quality
tools.

Invoke operations through the target's locked package command, from the
host-provided installed skill directory when one skill owns the helper. Do not
add a launcher only to locate the package. Keep a launcher only for a required
external command contract or a real host protocol; an old script path is not
such a requirement. Every operation has the same arguments, output, refusals,
and exit status on each supported platform.

## Convert existing mechanics

Preserve the required public inputs, outputs, refusals, side effects, and
ordering, not the old code's structure. Write idiomatic code for the new
language; for Python, use the standard library instead of translating Bash
line by line. Update every caller, document, fixture, and test to the
canonical locked command, and remove obsolete shims, aliases, and
compatibility branches. Verify at public seams, including a fresh copied
plugin without the removed entrypoints.

## Test the helper

Keep fast tests beside the package and apply the target's formatting, lint,
typing, and coverage gates. Test path normalization, malformed input, failure
output, subprocess status, and platform-specific path forms.

Copy the plugin to a fresh directory, remove local environments and generated
state, install only locked runtime dependencies, and run each public
entrypoint from the copy. Confirm that development tools are absent from the
runtime dependencies. Do this on every claimed native platform.
