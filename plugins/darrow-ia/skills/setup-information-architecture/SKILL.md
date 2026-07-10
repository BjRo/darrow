---
name: setup-information-architecture
description: Set up or reorganize a repository's agent information architecture using a thin root router, scoped instruction files, and intent-triggered skills. Use when the user asks to create AGENTS.md or CLAUDE.md guidance, organize agent rules, split a large instruction file, build a context hierarchy, add path-based routing, or make repository instructions work across Claude Code and Codex.
---

# Setup Information Architecture

Build a repository-specific instruction graph. Do not paste a generic policy
template over existing guidance.

`<skill-dir>` means the directory containing this `SKILL.md`. Run bundled
scripts with `bash`.

## Workflow

1. Run `bash <skill-dir>/scripts/ia-setup.sh inspect [repository]`.
   This is read-only. Use its compact inventory to locate existing entrypoints,
   adapters, manifests, hooks, CI, skills, and likely guidance directories.
2. Read the existing instruction entrypoints and the canonical repository
   evidence needed to understand them. Inspect manifests, hooks, CI, and
   architecture documents selectively; do not read the whole repository.
3. Classify each piece of guidance:
   - **root**: universal constraints, safety rules, unusual completion gates,
     cross-runtime contracts, and routes needed in most sessions;
   - **scoped**: rules for a subtree, file pattern, or identifiable kind of
     edit;
   - **skill**: a repeatable ordered procedure triggered by task intent;
   - **derived**: reliable, cheap facts already expressed by canonical config;
   - **documentation**: explanatory material for humans, not agent behavior.
4. Propose the file graph before editing. For every deferred file, show the
   root or native route that will reach it. An explicit route names both the
   trigger and target, for example: `Before changing database migrations, read
   docs/agent-rules/migrations.md`.
   Unless the user explicitly names one runtime, target both Claude Code and
   Codex: prefer canonical `AGENTS.md` guidance plus the repository's declared
   Claude adapter pattern (a `CLAUDE.md` symlink or generated mirror when the
   repository supports it). Do not silently design only for the runtime
   executing this skill.
5. Ask for confirmation of the file-level actions. One question is normally
   enough. Existing explicit approval in the user's request counts; do not ask
   again merely for ceremony.
6. Apply only the confirmed actions. Preserve exact constraints and reasons.
   When adapters are generated or mirrored, edit their declared source of
   truth and regenerate or resync them instead of editing copies separately.
7. Run:
   `bash <skill-dir>/../../bin/ia-doctor verify [repository]`.
   Resolve critical findings before reporting success.

## Design Rules

- A file mention without a read trigger is not a route.
- Keep enough routing resident to avoid opening every rule file to discover
  which one applies.
- Scope guidance by ownership, not merely by directory depth. Do not duplicate
  a shared invariant across several subtree files.
- Omit ordinary dependency and directory inventories unless they encode a
  prohibition, rationale, or unusual consequence.
- Keep exact non-standard commands when guessing a conventional command would
  be unsafe or expensive.
- A nested instruction file is useful only for runtimes and working-directory
  patterns that actually discover it. Preserve an explicit root route when
  another supported runtime needs one.
- A runtime-local adapter directory is not the default source of truth for a
  cross-runtime request. Prefer shared guidance and thin adapters.
- Keep root resident context below the runtime's configured limit. Treat 32
  KiB as the Codex warning threshold when no project override is found.

## Boundaries

- Inventory and proposal are read-only. Never delete, move, or rewrite guidance
  before confirmation.
- Do not change user-level runtime settings, permissions, installed plugins, or
  global memory.
- Do not use transcript frequency as a design input.
- Do not commit or push as an implicit part of setup.
