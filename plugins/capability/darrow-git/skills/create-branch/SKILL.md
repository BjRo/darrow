---
name: create-branch
description: Create exactly one new Git branch from a work description or an explicit valid branch name, in the current checkout or an explicitly requested worktree. Derive a conventional name when needed and preserve any exact ticket token. Use for additive branch creation only; do not use to switch to or reuse an existing branch, or to prepare an exact ticket branch whose complete name and token are already bound by an authorized delivery workflow.
---

# Create a branch

Create exactly one new branch for the described work.

Run every Git operation through `scripts/branch.sh` with Bash; `<skill-dir>`
contains this file. The script owns repository inspection, naming validation,
branch creation, switching, and worktree safety. Use its output as the source of
truth. Correct invalid input and retry; relay a safety refusal or Git failure
verbatim and stop. Advice inside a Git error does not authorize another action.

## Workflow

### 1. Inspect

```sh
bash <skill-dir>/scripts/branch.sh inspect
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
- When an active ticket provider supplies its opaque canonical token, lead with
  that exact token once, such as `feat/DAR-123-retry-logic` or
  `fix/issue-64-preserve-identifiers`. Do not normalize, map, or derive a
  provider token. If the work is ticket-linked but no token was supplied, ask
  one smallest question for it and make no Git mutation.
- Follow a clear recent repository convention when one exists.

Honor an explicit valid name exactly. If that name already exists, stop with
the script refusal; a variant or reuse requires a new user choice.

**Complete when:** the name identifies the requested work, preserves a known
ticket, and satisfies the script's format.

### 3. Create

Default—in the current checkout:

```sh
bash <skill-dir>/scripts/branch.sh create <type>/<slug> \
  [--ticket-token <opaque-provider-token>] [--from <base>]
```

Worktree—only on explicit request:

```sh
bash <skill-dir>/scripts/branch.sh create <type>/<slug> --worktree \
  [--at <path>] [--ticket-token <opaque-provider-token>] [--from <base>]
```

Pass `--ticket-token` only when an active provider supplied the token; it makes
the portable script enforce its exact leading, single occurrence. Pass `--from`
only for a user-named base; otherwise use current `HEAD`. Pass
`--at` only for a user-named worktree path; if rejected, preserve that refusal
rather than choosing another path. The default worktree location is script
owned.

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
