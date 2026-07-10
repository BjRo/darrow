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

1. Run `bash <skill-dir>/scripts/ia-doctor.sh inspect [repository]`.
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
4. Present a compact proposal before changing files. Name every file and
   estimated resident-byte effect. Explain why removals are derivable and how
   moved guidance remains reachable.
5. Ask for confirmation. One grouped question is normally enough. Existing
   explicit approval to apply safe findings counts; do not ask again merely
   for ceremony.
6. Apply only confirmed actions. Edit a declared source of truth rather than
   its generated adapters, then use the repository's sync mechanism.
7. Run `bash <skill-dir>/scripts/ia-doctor.sh verify [repository]`. Report
   before/after resident bytes and approximate tokens plus any remaining
   findings.

## Judgment Rules

- Optimize total retrieval cost, not root line count. A short path-to-rule
  index can be valuable even when generated from frontmatter.
- File mentions need an explicit read trigger unless a verified runtime-native
  scope loads the target.
- Account for every supported runtime. Nested files and path-scoped rules are
  not assumed to behave identically across Claude Code and Codex.
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

## Boundaries

- Do not inspect or change runtime installation, versions, permissions,
  auto-mode settings, global memory, MCP servers, or installed plugins.
- Do not modify checked-in guidance before confirmation.
- Do not automatically commit or push.
- An unreadable instruction or canonical evidence source blocks dependent
  recommendations; report it instead of inferring absence.
