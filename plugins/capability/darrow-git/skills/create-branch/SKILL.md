---
name: create-branch
description: Always use for new branch or worktree creation from a work description or an explicit valid name. Derive a conventional name. Require a canonical provider identifier only when the request is actually ticket-linked; ticket-free work needs no identifier. Ticket-linked creation with a missing identifier stays here. Exclude switching to or reusing an existing branch, and exact task-branch preparation whose complete name and identifier are already bound by an authorized delivery workflow.
---

# Create a branch

Create exactly one new branch for the described work.

Run every Git operation through the frozen UV entrypoint below. The script owns
repository inspection, naming validation,
branch creation, switching, and worktree safety. Use its output as the source of
truth. Correct invalid input and retry; relay a safety refusal or Git failure
verbatim and stop. Advice inside a Git error does not authorize another action.

Set `<skill-dir>` from the successful `SKILL.md` read, including the final
`create-branch` directory. Resolve `<skill-dir>/../../backend` once to its
absolute path and use that value as `<backend>` below. Remove the `..` path
components before passing the launcher to UV; Claude's native read check may
refuse the unresolved spelling. Keep the same bundled backend, without a
guessed plugin namespace or parent `skills` directory. Correct a mistaken
launcher path before treating the runtime as missing.

## Workflow

### 1. Inspect

```sh
uv run --quiet --no-project "<backend>/scripts/run_locked.py" darrow-create-branch inspect
```

- `mode: ready`: continue. In-place branching carries uncommitted changes to
  the new branch; worktree creation leaves them in the current checkout.
- `mode: conflict`: report the merge or rebase conflict and stop.

**Complete when:** the script reports `ready` and its current branch, default
branch, dirty state, and recent naming evidence have been considered.

### 2. Name the branch

Use `<type>/<kebab-slug>`:

- Choose the eventual Conventional Commit type: `feat`, `fix`, `refactor`,
  `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, or `revert`.
- Use 2–5 short lowercase words that name the work.
- When an active ticket provider supplies its opaque canonical identifier,
  lead with that exact identifier once, such as `feat/DAR-123-retry-logic` or
  `fix/issue-64-preserve-identifiers`. Do not normalize, map, or derive a
  provider identifier. Use its `ticket-id:` value unchanged. If the work is
  ticket-linked but no identifier was supplied, ask one smallest question for
  it and make no Git mutation.
- For work that is not linked to a ticket, derive the name without requesting
  a provider identifier.
- Follow a clear recent repository convention when one exists.

Honor an explicit valid name exactly. If that name already exists, stop with
the script refusal; a variant or reuse requires a new user choice.

**Complete when:** the name identifies the requested work, preserves a known
ticket, and satisfies the script's format.

### 3. Create

Default—in the current checkout:

```sh
uv run --quiet --no-project "<backend>/scripts/run_locked.py" darrow-create-branch create <type>/<slug> \
  [--ticket-id <ticket-id>] [--from <base>]
```

Worktree—only on explicit request:

```sh
uv run --quiet --no-project "<backend>/scripts/run_locked.py" darrow-create-branch create <type>/<slug> --worktree \
  [--at <path>] [--ticket-id <ticket-id>] [--from <base>]
```

Pass `--ticket-id` only when an active provider supplied the identifier; it makes
the portable script enforce its exact leading, single occurrence. Pass `--from`
only for a user-named base; otherwise use current `HEAD`. Pass
`--at` only for a user-named worktree path; if rejected, preserve that refusal
rather than choosing another path. The default worktree location is script
owned. Relay the script's absolute worktree path even when the user supplied a
relative path. A failed addition must preserve a branch that appeared
concurrently and must not add a local-exclude entry. Once Git worktree creation
begins, leave empty default-path directories rather than risk removing state
created or replaced by another actor.

Keep the operation additive: leave existing branches, worktrees, commits,
stashes, and working-tree changes intact. An existing branch is not new branch
creation and cannot satisfy a worktree request.

**Complete when:** the script prints `<name> (from <base>)` or `<name> (from
<base>) at <path>` without a refusal.

### 4. Report

Copy the success line and every `## note:` line. For an in-place branch created
from a non-default current branch, mention that base explicitly. The report is
complete when it identifies the new branch, its base, and—when applicable—the
linked worktree path and the location of pre-existing changes.
