# Plugin development

Implementation constraints for changes to plugin content.

Keep plugins independently installable and self-contained. Never reference
files outside a plugin or assume a sibling plugin is installed.

Keep current behavior in the owning skill, its local references, schemas and tests.
Record consequential architectural choices in `docs/decisions/`. A separate
specification is not required for every change.

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
mechanics when Python materially improves clarity or native Windows support.
Before adding, changing, or converting Python helpers, read `docs/python-quality.md`.
It owns package registration, locks, dependency separation, installed runtime
environments, conversions, tests, and release checks.

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

## Curated upstream inputs

Run `bash scripts/acquire-curated-skills <new-output-directory>` to acquire
pinned inputs for the Matt and pstack bundles. Requires Bash 3.2 or later,
Node 22.20.0 or later, npm/npx, Git, curl, shasum and network access. The script
owns the exact source and installer pins. Package-local `references/upstream/`
records own selections, required support files, full MIT notices and local differences.

Acquisition uses isolated staging and refuses an existing destination. It must
neither install into this checkout nor change the user's skills. Failure removes
staging without leaving a destination that appears complete. Success retains
`skills/`, `LICENSE`, provenance, selection, required files and content hashes
for each input, plus original acquisition logs and lock records.

Preserve original inputs and record adaptations separately. Do not attribute
Darrow's principle adaptations to the unslop pin; their upstream revision is
unknown. Updates require a deliberate new pin and complete notice/support closure.
Verify `files.sha256` from each acquired package. Two fresh acquisitions can
establish reproducible contents; downloading files does not establish host behavior.

Check the public acquisition command with
`bun test ./evals/domain/curated-inputs.test.ts` and repeat with
`CURATED_TEST_SHELL=/bin/bash`. These fixtures substitute network collaborators
and establish package contents and refusals, not upstream workflow reliability.
