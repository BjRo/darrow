# Executable helper mechanics

Read this reference before adding or changing executable mechanics in a skill.
Choose the smallest runtime surface that follows the target repository's
instructions and supports its declared hosts.

## Choose the implementation

- Inspect the target's repository instructions, manifests, lockfiles, existing
  helper code, and supported hosts before selecting an implementation.
- Use existing host or repository tools directly when their invocation is
  short, stable, and hard to misuse.
- Use small command glue in an environment the target already supports for
  launchers, adapters, and simple composition. If the target selects shell,
  also read `portable-shell.md` from this reference directory.
- Use a packaged helper in the target's established runtime for substantial
  parsing, filesystem traversal, state validation, subprocess coordination, or
  other structured mechanics.
- If no applicable runtime or package-manager convention exists, ask for that
  contract input. Do not import the source repository's choice as a default.
- Do not introduce a shared plugin runtime or depend on a sibling plugin. Keep
  contextual judgment, authority, and material choices in `SKILL.md`.

## Contain a packaged helper

Follow the target repository's package layout, manifest, lockfile, dependency,
entrypoint, and quality conventions. Do not copy inventories, paths, version
ranges, thresholds, or CI structure from the repository that supplied this
skill.

Keep the complete package and its generated state inside the owning plugin.
Commit the target ecosystem's manifest and lockfile when it uses them. Expose
narrow public entrypoints, declare the supported runtime range, and separate
runtime dependencies from quality and test tools according to the target's
established conventions.

Invoke public operations through the target's locked package command. Prefer a
host-provided installed skill directory when one skill owns the helper, and do
not add a launcher solely to calculate that package location. Retain a small
compatibility launcher only when an explicitly required external contract needs
a stable command or the launcher adapts an actual host lifecycle or protocol.
An old script path alone does not establish that requirement. It only dispatches
to the same entrypoint and contains no duplicated mechanics. Give every public
operation the same arguments, output, refusal, and exit-status contract on each
supported platform.

## Convert existing mechanics

1. Establish the required public inputs, outputs, refusals, side effects, and
   ordering constraints. Preserve those contracts rather than the old code's
   structure.
2. Design for the selected language. When the target chooses Python, use its
   idioms and standard library, simplify control flow, and reuse focused
   mechanics within the module or package. Do not translate Bash verbatim or
   introduce a general framework to share a few lines.
3. Audit every entrypoint and caller. Remove unnecessary Bash shims, obsolete
   aliases, and backward-compatibility branches; update instructions,
   documentation, fixtures, and tests to the canonical locked commands. Keep
   shell regression suites with tests, separate from runtime entrypoints.
4. Verify behavior at public seams, using before/after comparisons where useful.
   Exercise a fresh copied plugin without the removed entrypoints. Treat
   coverage as support for simplification, not justification for redundant code.

## Test and release the helper

Keep fast unit and integration tests beside the package. Apply the target
repository's formatting, lint, typing, property-test, and coverage gates rather
than importing thresholds from the skill's source repository. Directly
exercise path normalization, malformed input, failure output, subprocess
status, and platform-specific path forms.

Copy the complete plugin to a fresh temporary directory, remove local virtual
environments, dependency directories, and generated state, install only locked
runtime dependencies, and invoke each public entrypoint from the copy. Confirm
that development tools are absent from the runtime dependency tree when the
target ecosystem distinguishes them. Run this fresh-artifact check on every
claimed native platform; a compatibility layer does not establish native host
support.
