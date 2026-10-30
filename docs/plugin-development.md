# Plugin development

Implementation constraints for changes to plugin content.

Keep plugins independently installable and self-contained. Never reference
files outside a plugin or assume a sibling plugin is installed.

Add or adjust the applicable invariant under `docs/specs/` before implementation.

## Skills and versions

Keep contextual judgment in the skill. Put repeatable, error-prone command and
tool-protocol mechanics behind narrow bundled scripts so the model supplies
intent-level inputs instead of reproducing call details.

Whenever a plugin changes, increment its semantic version in both
`.claude-plugin/plugin.json` and `.codex-plugin/plugin.json`, keeping them identical.
The Codex manifest must point at `./skills/`.

## Runtime mechanics

Plugin helpers must refuse unreadable configuration with a clear error rather
than silently skipping it.

Use a contained Python package managed by UV for substantial deterministic
plugin mechanics when Python materially improves clarity or native Windows
support. Commit `pyproject.toml` and `uv.lock`, keep runtime and development
dependencies separate, invoke runtime entrypoints with frozen resolution, and
register the package in `python-packages.txt`.

For Python conversions, follow `docs/specs/python-quality.md`.

Keep genuinely small host-specific launchers and command glue in portable
Bash, using baseline Unix utilities and the host CLIs the capability wraps.
Do not introduce JavaScript/TypeScript, Ruby, JVM, compiled, or shared Darrow
runtime dependencies inside a plugin.

## Paths and worktrees

Plugin helpers must emit absolute paths in model-facing output so callers can
use them from any working directory.

Use `git rev-parse --show-toplevel` for the checkout being inspected or changed.
Only when an operation specifically needs the primary checkout, resolve it from
the first `git worktree list --porcelain` entry. Keep worktree-local inspection
and edits in the requested checkout.

## Shell compatibility

- Support old BSD awk and Bash 3.2 in plugin shell scripts.
- Avoid early-exit pipelines under `pipefail`; use here-strings for bounded matching.
- Avoid `${var//pat/}` on unbounded input and `awk -v` for backslash-bearing values.
