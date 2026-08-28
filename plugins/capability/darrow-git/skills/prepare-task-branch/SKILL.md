---
name: prepare-task-branch
description: Prepare one exact ticket-linked task branch in the current checkout or, only on explicit request, a linked worktree while preserving local work. Use when an authorized delivery workflow needs its attributed execution context before downstream work; do not use to list branches or choose among ambiguous branches.
---

# Prepare a task branch

Prepare exactly one named task branch in the current checkout, or in a linked
worktree only when the caller explicitly requests that context. Run every Git
operation through `scripts/branch.sh` with Bash; `<skill-dir>` contains this
file. The script owns repository inspection, name and ticket-token validation,
additive creation, exact reuse, switching, worktree allocation, and refusal
safety. Use its output as the source of truth.

## 1. Require exact correlation

Require both:

- one exact conventional branch name, `<type>/<opaque-token>-<kebab-suffix>`;
- the active ticket provider's exact opaque canonical token.

Do not search for a branch, choose among alternatives, derive or normalize a
token, or reinterpret another provider's identifier. Missing or ambiguous input
asks the smallest question and performs no Git operation.

**Complete when:** one exact name and its unchanged provider token are bound—or
the missing choice has been requested without repository mutation.

## 2. Inspect safety

Run:

```sh
bash <skill-dir>/scripts/branch.sh inspect
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
bash <skill-dir>/scripts/branch.sh prepare \
  <type>/<opaque-token>-<suffix> --ticket-token <opaque-token> [--from <base>] \
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
leaves the caller's checkout and its local changes untouched.

**Complete when:** the script reports one mode and exact branch, or its refusal
has been preserved with the original repository state intact.

## 4. Report

Copy the `## mode:` line and branch evidence line. Include every `## note:` line
when present. The report is complete when the caller can distinguish current,
reused, and created state, identify the exact branch plus its existing tip or
creation base, and—when applicable—use the absolute worktree execution path.
