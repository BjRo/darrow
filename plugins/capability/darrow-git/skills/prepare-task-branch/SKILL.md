---
name: prepare-task-branch
description: "Use only to find existing local task branches by an exact ticket identifier, or prepare a specific complete branch name already chosen by the caller. Preparation may switch to, reuse, or create that exact name, with a worktree only when requested. Do not select for creating a new branch from a work or ticket description: create-branch owns naming and asks for any missing canonical identifier. Multiple discovery candidates require an exact caller choice. Exclude general branch listing."
---

# Prepare a task branch

Prepare exactly one named task branch in the current checkout, or in a linked
worktree only when the caller explicitly requests that context. Run every Git
operation through the frozen UV entrypoint below; `<skill-dir>` contains this
file. The script owns repository inspection, name and ticket-ID validation,
complete discovery, additive creation, exact reuse, switching, worktree
allocation, and refusal safety. Use its output as the source of truth.

Set `<skill-dir>` to the directory containing the `SKILL.md` you successfully
read, including its final `prepare-task-branch` segment. Keep that actual path
when resolving `../../backend`; do not add a guessed plugin namespace or
substitute the parent `skills` directory. If a launcher path fails, correct that
path before declaring the runtime unavailable.

The package lives at `<skill-dir>/../../backend` inside this plugin.

## 1. Bind discovery or preparation input

For discovery, require only the active provider's exact opaque canonical
identifier. Use its non-secret `ticket-id:` value unchanged.
Run the read-only operation:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-prepare-task-branch discover --ticket-id <ticket-id>
```

Relay `mode: discovered`, the unchanged identifier, the exact count, and every
candidate with its full tip. Do not truncate the result. Discovery inspects all
local branches in refname order, using the same validation as preparation:
allowed conventional type, literal case-sensitive `<ticket-id>-` prefix, identifier
exactly once, lowercase kebab suffix, and at most 60 characters. It never reads
remote refs or interprets provider identity. The delimiter is lexical:
`fix/84-extra-work` can match identifier `84` or `84-extra`; do not infer a provider
from that spelling. A failed enumeration is not zero matches.

Discovery makes no selection or mutation. The caller or enclosing workflow
chooses the exact branch using this complete evidence. Stop after reporting
discovery unless an exact preparation name is already bound. Never use the
bounded general listing from `inspect` as complete identifier evidence.

For preparation, require both:

- one exact conventional branch name, `<type>/<ticket-id>-<kebab-suffix>`;
- the active ticket provider's exact opaque canonical identifier.

Do not choose among alternatives, derive or normalize an
identifier, or reinterpret another provider's identifier. Permission to pick one of
multiple candidates—such as "whichever seems better"—does not bind one exact
name. Ask the caller to select a single candidate and perform no Git operation.
Other missing or ambiguous input likewise asks the smallest question without
repository mutation.

**Complete when:** complete discovery evidence has been returned, or one exact
name and its unchanged provider identifier are bound—or
the missing choice has been requested without repository mutation.

## 2. Inspect safety

Run:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-prepare-task-branch inspect
```

- `mode: ready`: consider the current branch, deliberate base, dirty state, and
  branches checked out in other worktrees, then continue.
- `mode: conflict`: report the in-progress operation and stop.

Do not classify dirty-work ownership. Preparation may carry compatible
uncommitted changes unchanged; Git refusal stops without a stash, reset,
discard, commit, or alternate branch.

**Complete when:** the script reports `ready`, or its conflict result has been
relayed without another operation.

## 3. Prepare once

Run:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-prepare-task-branch prepare \
  <type>/<ticket-id>-<suffix> --ticket-id <ticket-id> [--from <base>] \
  [--worktree [--at <path>]]
```

Pass `--from` only for an exact deliberate base supplied or established by the
caller. Otherwise a missing branch is created from current `HEAD`; an existing
branch keeps its current tip regardless of `--from`. Pass `--worktree` only for
an explicit caller request and `--at` only for its exact named path. Continue
downstream work from the absolute path returned by a worktree mode; do not
continue it from the caller's checkout.

Interpret the script's authoritative mode:

- `current`: the exact branch was already active and no ref changed;
- `reused`: the exact existing local branch was switched to without moving it;
- `created`: the missing branch was created and switched to from the reported
  base.
- `worktree-current`: the exact branch was already active in another linked
  worktree, whose path is reused as the execution context;
- `worktree-reused`: the exact existing branch was attached to a new linked
  worktree without moving its tip;
- `worktree-created`: the missing branch was created in a new linked worktree
  from the reported base.

Relay a validation refusal or Git failure verbatim and stop. Do not invent a
variant, fetch, use a remote-only branch, reset an existing branch, move or
remove a worktree, or retry through a destructive operation. A worktree refusal
leaves the caller's checkout and its local changes untouched. A failed
worktree addition does not delete a branch that appeared concurrently or leave
default-path directories or local-exclude entries created for the failed
attempt.

Before creating a missing exact name, the script repeats complete identifier
discovery. If any correlated local branch exists, it refuses and returns every
candidate. Return that evidence to the caller; do not silently switch to a
different name. An explicitly bound existing name remains eligible, including
the caller's explicit choice among several matches. This check does not lock
the repository against other actors after inspection.

**Complete when:** the script reports one mode and exact branch, or its refusal
has been preserved with the original repository state intact.

## 4. Report

Report the mode and exact branch evidence. Include every material note when
present. Ordinary prose and code formatting are valid; preserve the meaning
without requiring the script's line prefixes. The report is complete when the
caller can distinguish current,
reused, and created state, identify the exact branch plus its existing tip or
creation base, and—when applicable—use the absolute worktree execution path.
