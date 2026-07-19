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
   Treat unreadable required evidence as blocking. The inventory is an
   IA-oriented structural aid, not a complete runtime configuration validator.
2. Read the existing instruction entrypoints and the canonical repository
   evidence needed to understand them. Inspect manifests, hooks, CI, and
   architecture documents selectively; do not read the whole repository.
3. Classify each piece of guidance by placement:
   - **root**: universal constraints, universal or bootstrap safety rules,
     unusual universal completion gates, universal cross-runtime contracts,
     and routes needed in most sessions; runtime parity never makes a narrow
     rule universal;
   - **scoped**: rules for a subtree, file pattern, or identifiable kind of
     edit;
   - **skill**: a repeatable ordered procedure triggered by task intent;
   - **derived**: reliable, cheap facts already expressed by canonical config;
   - **documentation**: explanatory material for humans, not agent behavior.
   Separately classify every behavior-changing choice as **settled** only when
   an explicit user decision, ADR, policy, or existing canonical instruction
   arbitrates it. When multiple valid patterns have no arbiter, mark the choice
   **open**; show the evidence, options, trade-offs, and recommendation instead
   of turning majority or recency into a rule. Stop and ask the user to choose;
   neither recording "decision open" nor receiving approval for file edits
   resolves the architecture choice.
4. Propose the file graph before editing. For every deferred file, show the
   root or native route that will reach it. An explicit route names both the
   trigger and target, for example: `Before changing <area>, read
   <session-root-relative-guidance-path>`.
   Unless the user explicitly names one runtime, target both Claude Code and
   Codex. For a new graph with no declared direction, prefer canonical
   `AGENTS.md` guidance plus a thin Claude adapter: a symlink, native
   `@AGENTS.md` import, explicit read route, or generated mirror when the
   repository supports it. Existing repository evidence declaring
   `CLAUDE.md` canonical and `AGENTS.md` as its adapter wins over that new-graph
   preference. Do not silently design only for the runtime executing this
   skill.
   Write ordinary routed repository paths from the session root,
   including paths inside routed maps and nested entrypoints. Preserve native
   loader imports and skill-bundled resource paths instead of rewriting them as
   ordinary routes.
5. Ask for confirmation of the file-level actions and for a choice on each open
   decision. One grouped question is normally enough. Existing explicit
   approval in the user's request counts for file actions, but it does not
   settle a repository decision the user has not actually made.
6. Apply only the confirmed actions. Preserve exact constraints and reasons.
   When adapters are generated or mirrored, edit their declared source of
   truth and regenerate or resync them instead of editing copies separately.
7. Run `bash <skill-dir>/../../bin/ia-doctor verify --runtime both
   [--mirror source=target]... [repository]`. If the user explicitly scoped the
   work to one runtime, pass that runtime instead. Supply `--mirror` only for a
   generated adapter relationship declared by repository evidence.
   Resolve critical findings before reporting success. Treat the output as a
   compact structural gate, not proof of complete runtime-schema validity.

## Decision Gate

Before writing or changing any rule that selects among live implementation
patterns, identify its arbiter. Valid arbiters are an explicit choice in the
conversation, an accepted ADR, policy, or existing canonical instruction.
Code counts, directory names, recency, apparent completeness, and your own
recommendation are evidence about options, never an arbiter. A request to
"decide," "make the guidance clear," or apply broad structural changes is not
itself a choice of one named option. If no arbiter exists, do not write a
default or preference: report the competing repository paths, give trade-offs
for each option (at least one benefit, cost, or risk), give a recommendation,
and pause for the user's answer. When the requested
outcome depends on that choice, pause before any checked-in mutation; do not
partially apply unrelated structural cleanup first.

## Design Rules

- A file mention without a read trigger is not a route.
- Keep enough routing resident to avoid opening every rule file to discover
  which one applies.
- Scope guidance by ownership, not merely by directory depth. Do not duplicate
  a shared invariant across several subtree files.
- Preserve the scope supplied by repository evidence or the user's trigger. Do
  not broaden a database-only or frontend-only rule into a universal root rule
  merely to simplify placement.
- Omit ordinary dependency and directory inventories unless they encode a
  prohibition, rationale, or unusual consequence.
- Keep exact non-standard commands when guessing a conventional command would
  be unsafe or expensive.
- A nested instruction file is useful only for runtimes and working-directory
  patterns that actually discover it. Preserve an explicit root route when
  another supported runtime needs one.
- Codex discovers the root-to-current-working-directory chain at session
  startup; reading a file below a nested `AGENTS.md` later does not load that
  file on demand. Claude nested memory, by contrast, loads when Claude works in
  that subtree. Preserve an explicit root route whenever root-anchored Codex
  sessions must reach nested guidance.
- Claude native scoped guidance may be reachable without an invented root
  route. Confirm native scope from repository/runtime evidence before relying
  on it.
- A runtime-local adapter directory is not the default source of truth for a
  cross-runtime request. Prefer shared guidance and thin adapters.
- In a new dual-runtime graph, put canonical deferred guidance in an existing
  repository-owned shared convention or a neutral non-ignored location such as
  `.agent-shared/` or `docs/agent-guidance/`. Do not create canonical guidance
  under `.agents/` or `.claude/` unless it is intentionally runtime-native.
- Never infer a canonical choice from the most numerous or newest code pattern.
  Encode a settled choice; surface an open one for the user to decide.
- Do not turn a cheap derived fact into an imperative just to retain it. For
  example, a manifest-derived stack list does not become "use the existing
  toolchain" without independent evidence of that constraint. Remove or defer
  the fact; preserve only an evidenced prohibition, rationale, or unusual
  consequence.
- Ordinary routed repository paths resolve from the session root. Do not preserve
  containing-file-relative ordinary routes when lifting nested guidance, and
  do not rewrite loader-native imports or skill-bundled resources.
- Keep active root guidance below the runtime's configured limit. Treat 32 KiB
  as the Codex warning threshold when no project override is found.

## Boundaries

- Inventory and proposal are read-only. Never delete, move, or rewrite guidance
  before confirmation.
- Do not change user-level runtime settings, permissions, installed plugins, or
  global memory.
- Do not use transcript frequency as a design input.
- Do not commit or push as an implicit part of setup.
- Do not expand the structural audit into a TOML, YAML, Markdown, or native
  runtime conformance implementation; use the runtime's own validator for that.
