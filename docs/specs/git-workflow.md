# Capability: Git Workflow

Consolidates the git workflow into intent-triggered skills so that branching,
committing, and PR creation are consistent, traceable, and safe regardless of
which agent runtime executes them.

Plugin: `darrow-git`. Skills: `create-commit` (M0), `create-branch`,
`prepare-task-branch`, `create-pr`.

GW-B6 applies only when the caller explicitly asks the `create-branch`
capability to allocate an additional linked worktree.

## Why

Agents left to improvise git usage produce inconsistent messages, stage
unrelated changes, and leak tool attribution into history. Encapsulating the
workflow as skills makes behavior specifiable, evaluable, and swappable —
consumers with their own conventions simply don't install this plugin.

## create-commit

### Intent triggers

"commit this", "commit my changes", "create a commit", "commit the staged
files", or an explicit skill invocation.

### Contract

Produce exactly one commit that captures the user's intended change with a
clear Conventional Commit message. Inspect state first (`git status`,
`git diff`), then stage deliberately (if needed), then commit.

### Invariants

- **GW-C1 — Staged intent only.** If files are already staged, commit exactly
  those. Never sweep in unrelated working-tree changes; never use
  `git add -A`/`git add .` as a shortcut.
- **GW-C2 — Deliberate staging.** If nothing is staged, stage only the files
  belonging to the change the user described. Unrelated dirty files stay
  untouched.
- **GW-C3 — Conventional Commits.** Subject: `<type>(<scope>)?: <imperative summary>`,
  ≤ 72 chars, no trailing period. Types: feat, fix, refactor, perf, docs,
  test, chore, build, ci, style, revert.
- **GW-C4 — No tool attribution.** No `Co-authored-by` AI trailers, no
  "Generated with ..." lines, no emoji unless the repo convention uses them.
- **GW-C5 — Body only for the why.** Body present only when the reason is
  non-obvious, a breaking change, or a migration note. Wrap at 72 chars.
- **GW-C6 — No history rewriting.** Never `--amend`, `--no-verify`, force
  operations, or rebase unless the user explicitly asked for that operation.
- **GW-C7 — Respect hooks.** If a commit hook fails, report it; don't bypass.
- **GW-C8 — Authorized staged retry only.** After a hook failure, a retry may
  refresh only literal, explicitly authorized paths that were already in the
  staged set. It preserves every other staged blob and rejects a path outside
  that set without changing the index, worktree, or history.
- **GW-C9 — Diagnosed remediation only.** A hook-directed remediation may run
  only when its diagnostic provides one unambiguous, path-scoped corrective
  command for the failed intended commit. Before refreshing staged paths, the
  capability proves the remediation did not change `HEAD` or the index; an
  ambiguous diagnostic or changed index stops the workflow.

### Non-goals

Pushing, branch creation (see create-branch), PR creation (see create-pr),
splitting one described change into multiple commits unless asked.

## create-branch

### Intent triggers

"create a branch", "branch for this", "start a branch", "new branch for X",
"create a worktree for X", "branch this in a worktree", or an explicit
skill invocation.

### Contract

Create and switch to exactly one new branch whose name traces to the work
(and the ticket, when one is known). Inspect state first, derive the name,
then create. When the user asks for a worktree, the branch is created in a
new linked worktree instead and the current checkout stays where it is.

### Invariants

- **GW-B1 — Traceable naming.** `<type>/<kebab-slug>` with the same types as
  commits. When an active ticket provider supplies an opaque canonical token,
  the slug begins with that exact token and contains it exactly once (e.g.
  `feat/DAR-123-retry-logic`, `fix/issue-64-preserve-identifiers`). Generic Git
  neither maps nor normalizes provider tokens; a ticket-linked request without
  the token asks one smallest question and performs no Git mutation. Segments
  lowercase except opaque ticket-token segments.
- **GW-B2 — No work lost.** Uncommitted changes are never stashed, reset,
  discarded, or committed to make the operation work. Switching in place
  they travel to the new branch untouched; in worktree mode they stay in
  the current checkout. If git refuses, relay verbatim and stop.
- **GW-B3 — No clobbering.** An existing branch name is never reused, reset,
  or force-moved; report it and stop — no invented variants. A failed worktree
  addition never deletes a branch that appeared concurrently.
- **GW-B4 — Deliberate base.** Base is the current HEAD unless the user names
  one; the base is stated in the report.
- **GW-B5 — No branching mid-conflict.** Merge/rebase in progress → don't
  branch; tell the user to resolve first.
- **GW-B6 — Worktree only by request.** A worktree is created only when the
  user asks for one. Default location is `.worktrees/<branch>` under the
  main worktree's root (never nested inside another worktree), kept out of
  `git status` via the repo's local excludes. A
  user-named path is resolved from the caller's current directory or reported
  as unusable — never substituted. An existing path is never reused or
  overwritten. The report states the absolute worktree path and, when the tree
  was dirty, that uncommitted changes stayed behind. Once default worktree
  creation begins, a failure never removes branch or directory state that may
  belong to another actor and never adds a local-exclude entry; harmless empty
  default directories may remain.

### Non-goals

Pushing, upstream setup, fetch/pull before branching, deleting or renaming
branches, removing/moving/pruning worktrees, checking out an existing
branch into a worktree, PR creation (see create-pr).

## prepare-task-branch

### Intent triggers

"prepare the task branch", "switch to the existing ticket branch", "create or
reuse the branch for this ticket", or a composed request from an explicitly
authorized delivery workflow that needs its exact task branch active before
downstream work.

### Contract

Prepare exactly one conventional ticket-linked task branch. By default, do so
in the current checkout: switch to an exact existing local branch without
moving it, create a missing branch from a deliberate base, or report an already
active branch without mutation. Only when the caller explicitly requests a
worktree, prepare the branch in a linked worktree and return its execution path
while leaving the caller's checkout untouched.

### Invariants

- **GW-TB1 — Exact correlation.** The caller supplies one exact conventional
  branch name and the active ticket provider's opaque canonical token. The slug
  begins with that token exactly once. Generic Git never searches for, derives,
  normalizes, or guesses a correlated name. Supplying multiple candidates and
  delegating the choice (for example, "whichever seems better") remains
  ambiguous; preparation asks for one exact selection before any Git mutation.
- **GW-TB2 — Additive preparation.** An existing branch is switched to or
  attached to a worktree without resetting or moving it; a missing branch is
  created from the named base or current `HEAD`. The result reports `current`,
  `reused`, or `created` (with a `worktree-` prefix when applicable) plus the
  exact branch, base or fully qualified existing branch tip, and worktree path
  when applicable.
- **GW-TB3 — No work lost.** Uncommitted changes are never stashed, reset,
  discarded, or committed. A refused switch relays Git's failure and leaves the
  original branch, refs, worktree, index, and stash intact. A failed worktree
  addition never deletes a branch that appeared concurrently and leaves no
  default-path directories or local-exclude entries created solely for the
  failed attempt.
- **GW-TB4 — Conflicts stop.** Merge, rebase, cherry-pick, revert, or unmerged
  index state prevents preparation before any branch mutation.
- **GW-TB5 — Explicit worktree context.** Worktree preparation occurs only on
  an explicit caller request. It reuses an exact branch's existing worktree or
  adds a new linked worktree without switching or changing the caller's
  checkout, and reports the absolute execution path. It never moves or removes
  a linked worktree and never fetches or changes a remote ref.
- **GW-TB6 — Composable capability.** The skill advertises one focused public
  intent that an authorized task recipe can request before its readiness gate,
  without assuming that recipe or any observability plugin is installed.

### Non-goals

Choosing among several plausible branches, determining ticket identity,
classifying dirty-work ownership, committing, pushing, pull-request creation,
implicit worktree allocation, or changing an existing branch tip.

## create-pr

### Intent triggers

"open a PR", "create a pull request", "PR this", "push and open a PR",
or an explicit skill invocation.

### Contract

Create exactly one pull request from the current branch into a deliberate
base, with a Conventional Commit title and a context-rich body derived from
the branch's commits (and ticket, when one is known). Push the branch (with
upstream) first if needed. Draft only when the user asks for a draft.

### Invariants

- **GW-P1 — Conventional title.** The PR title follows the Conventional
  Commit subject rules (same types as commits, ≤ 72 chars, imperative, no
  trailing period) and summarizes the whole branch, not just the last commit.
- **GW-P2 — Context-rich body.** The body states why the change exists and
  what it does, derived from the branch commits; a known ticket id is
  referenced verbatim. No filler; no boilerplate checklists unless the
  repo's PR template asks for them (GW-P8).
- **GW-P3 — No AI attribution.** No "Generated with ..." lines, no AI
  co-author credits, no tool emoji in title or body.
- **GW-P4 — Deliberate shape.** Base is the repo's default branch unless the
  user names one; draft only when the user asks. Both are stated in the
  report. Head and base are never the same — on the default branch there is
  no PR to make; report that and stop.
- **GW-P5 — Push without rewrite.** The branch is pushed (upstream set when
  missing) before the PR is created. Never force-push; a refused push is
  relayed verbatim and stops the workflow.
- **GW-P6 — One PR, no duplicates.** An existing open PR for the branch is
  reported, never duplicated. Exactly one PR per invocation.
- **GW-P7 — Committed work only.** The PR proposes committed work.
  Uncommitted changes are reported, never committed or stashed to "complete"
  the PR. No commits ahead of the base → report, stop.
- **GW-P8 — Template respected.** When the repo defines a PR template
  (`PULL_REQUEST_TEMPLATE.md` in `.github/`, the repo root, or `docs/`),
  the body follows it: headings kept verbatim, every section filled with
  real content from the branch, instructions in HTML comments followed and
  the comments removed. The template defines the body's shape and overrides
  the default why/what structure. With multiple templates
  (`.github/PULL_REQUEST_TEMPLATE/`), the user chooses; never silently
  pick one.

### Non-goals

Merging or auto-merge, assigning reviewers/labels/milestones, updating or
closing existing PRs, creating tickets, authoring or editing PR templates,
committing (see create-commit), branching (see create-branch), pushing the
default branch.
