---
name: doctor-information-architecture
description: Audit and improve repository agent information architecture across AGENTS.md, CLAUDE.md, scoped rules, referenced guidance, and procedural skills. Use when the user asks to doctor, inspect, trim, deduplicate, reorganize, or update agent instructions; diagnose broken or stale routes; reduce resident context; check Claude Code and Codex parity; or assess whether guidance belongs in root instructions, scoped files, or skills.
---

# Doctor Information Architecture

Diagnose repository guidance without turning the audit into a general runtime
health check. The default phase is read-only.

`<skill-dir>` means the directory containing this `SKILL.md`. Run the bundled
script with `bash`.

## Workflow

1. Run `bash <skill-dir>/scripts/ia-doctor.sh inspect --runtime both
   [repository]` unless the user explicitly selected one runtime.
   Treat its structural findings as leads, not automatic edit decisions.
2. Read every instruction entrypoint reported by the script. Then read only
   the referenced guidance and canonical repository evidence needed to assess
   specific findings. Do not scan transcripts, global settings, or the entire
   codebase.
3. Classify candidate actions:
   - **keep**: behavior-changing constraints, prohibitions, safety rules,
     unusual completion gates, exact non-standard commands, non-obvious
     reasons, cross-project contracts, or routing that avoids many reads;
     keep means preserve both content and its valid scope unless independent
     evidence justifies relocation;
   - **move**: guidance with a narrower path/intent scope, or an ordered task
     procedure that can reliably load as a skill;
   - **rewrite**: ambiguous routes, duplicated summaries, stale paths, or
     prose that mixes a derivable fact with a necessary constraint;
   - **remove**: only facts that are reliable and cheap to recover from a
     canonical source in a few reads.
   Also classify every choice that arbitrates live patterns as **settled** or
   **open**. A settled choice needs an explicit user decision, ADR, policy, or
   existing canonical instruction. For an open choice, present evidence,
   options, trade-offs, and a recommendation without writing policy. Stop and
   ask the user to choose; a note that the decision remains open and approval
   for unrelated file edits do not resolve it.
4. Present a compact proposal before changing files. Name every file and
   estimated resident-byte effect. Explain why removals are derivable and how
   moved guidance remains reachable.
5. Ask for confirmation and for a choice on every open decision. One grouped
   question is normally enough. Existing approval to apply safe findings does
   not settle a repository decision the user has not made.
6. Apply only confirmed actions. Edit a declared source of truth rather than
   its generated adapters, then use the repository's sync mechanism.
7. Run `bash <skill-dir>/scripts/ia-doctor.sh verify --runtime both
   [--mirror source=target]... [repository]`. Use a single runtime only when the
   user selected it, and pass mirrors only when repository evidence declares
   the generated relationship. Report separate before/after root bytes/tokens
   for the selected runtimes and any remaining findings. State that these are
   compact structural metrics, not an exact simulation of context assembly.

## Decision Gate

Before adding or revising a rule that selects among live implementation
patterns, identify its arbiter. Valid arbiters are an explicit choice in the
conversation, an accepted ADR, policy, or existing canonical instruction.
Pattern counts, recency, directory names, apparent completeness, and your own
recommendation never settle the choice. A request to "decide," "make it
clear," or apply broad cleanup is not a choice of one named option. With no
arbiter, make no policy edit: cite the competing repository paths, explain
each option's trade-offs (at least one benefit, cost, or risk), recommend an
option, and pause for the user's answer. When the
requested outcome depends on that choice, pause before any checked-in mutation;
do not partially apply unrelated cleanup first.

## Judgment Rules

- Optimize total retrieval cost, not root line count. A short path-to-rule
  index can be valuable even when generated from frontmatter.
- File mentions need an explicit read trigger unless a verified runtime-native
  scope loads the target.
- Account for every supported runtime. Nested files and path-scoped rules are
  not assumed to behave identically across Claude Code and Codex.
- Codex selects that chain at session startup; later reading beneath a nested
  `AGENTS.md` does not load it on demand. Claude nested memory does load when
  Claude works in its subtree. A root-anchored Codex workflow therefore still
  needs an explicit route to required nested guidance.
- Claude native scoped guidance does not need an invented root route. Confirm
  native scope from repository/runtime evidence before relying on it.
- A symlink or declared generated mirror is an adapter relationship, not
  wasteful duplication.
- Lack of observed usage never justifies deletion. Eval sessions, short
  windows, routing failures, and rare safety paths make usage incomplete.
- Preserve a valid existing scope by default. A rarely triggered safety rule
  with an explicit route remains deferred; moving it into root spends context
  on every task and is not a cleanup.
- Preserve bootstrap guidance needed before helper scripts or skills become
  usable.
- Split mixed bullets instead of deleting their non-derivable prohibition or
  rationale along with a derivable stack fact.
- Do not rewrite a derived inventory as an imperative merely to keep it. A
  stack list recoverable from manifests has no behavioral force unless
  separate evidence supplies a prohibition, rationale, or unusual consequence.
- When moving an ordered procedure to a skill, keep it in a repository-owned,
  non-ignored, version-control-eligible, runtime-discoverable skill surface. If
  runtime-specific skill mounts are ignored or unsuitable for a dual-runtime
  repository, use a shared `SKILL.md` plus an explicit intent route. Do not
  silently downgrade the move into an ordinary documentation page.
- A moved skill must be repository-owned, version-control-eligible, and
  discoverable by the selected runtimes. Use the runtime's own validator for
  full metadata/schema checks.
- Do not convert pattern frequency, recency, or an agent recommendation into a
  canonical rule. Preserve evidenced decisions and surface unresolved choices.
- Reject an ordinary routed repository path that works only relative to the
  instruction file containing it. Ordinary routes resolve from the session
  root; do not reinterpret loader-native imports or skill-bundled resources as
  ordinary routes.

## Boundaries

- Do not inspect or change runtime installation, versions, permissions,
  auto-mode settings, global memory, MCP servers, or installed plugins.
- Do not modify checked-in guidance before confirmation.
- Do not automatically commit or push.
- An unreadable instruction or canonical evidence source blocks dependent
  recommendations; report it instead of inferring absence.
- Do not expand the structural audit into a complete TOML, YAML, Markdown, or
  native runtime conformance implementation.
