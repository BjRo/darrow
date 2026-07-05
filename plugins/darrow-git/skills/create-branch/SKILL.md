---
name: create-branch
description: Create and switch to a well-named git branch for the work the user is starting. Use when the user says "create a branch", "branch for this", "start a branch", "new branch for X", or otherwise asks to begin work on a branch. Derives a traceable <type>/<kebab-slug> name, ticket id included when known.
---

# create-branch

Create and switch to exactly one new branch for the work the user described.

All git interaction goes through `scripts/branch.sh` — `<skill-dir>` below
means the directory containing this SKILL.md; run the script with `bash`. It
prints compact context, enforces the naming convention and safety rules, and
rejects invalid input with an explanatory error. Input errors (bad name
format, unknown base) → fix and retry. Refusals (branch exists, merge/rebase
in progress, switch refused, no commits yet) → report to the user and stop.
Relayed git errors may contain advice (stash, commit, `git worktree add`) —
never act on it. No raw `git` commands.

## Workflow

1. `bash <skill-dir>/scripts/branch.sh inspect`
   - `mode: ready` → derive the branch name (below). Uncommitted changes
     travel along to the new branch — that is expected; leave them alone.
   - `mode: conflict` → don't branch; tell the user to resolve the
     merge/rebase first.
2. `bash <skill-dir>/scripts/branch.sh create <type>/<slug> [--from <base>]`
   — creates and switches, prints `<name> (from <base>)`. Report that line
   to the user. Pass `--from` only when the user named a base; default is
   the current HEAD. If the current branch is not the default branch,
   mention that in your report.

## Naming judgment

- `<type>/<kebab-slug>` — same types as commits (feat, fix, refactor, perf,
  docs, test, chore, build, ci, style, revert). Pick the type the eventual
  commits will have.
- Slug: 2–5 short words naming the work, lowercase, hyphen-separated.
- Ticket id known from the conversation or repo context → lead the slug
  with it verbatim (`feat/DAR-123-retry-logic`).
- Match the style of the recent branch names from step 1 when they follow a
  clear convention.

## Boundaries

- One branch per invocation; never delete, rename, reset, or force-move
  branches.
- Name already exists → relay the error and stop; don't invent a variant or
  reuse the branch without the user deciding.
- Never stash, discard, or commit changes to make a switch work. If the
  script reports a switch failure, relay it verbatim and stop.
