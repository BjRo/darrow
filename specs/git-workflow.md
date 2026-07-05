# Capability: Git Workflow

Consolidates the git workflow into intent-triggered skills so that branching,
committing, and PR creation are consistent, traceable, and safe regardless of
which agent runtime executes them.

Plugin: `darrow-git`. Skills: `create-commit` (M0), `create-branch`, `create-pr`.

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

### Non-goals

Pushing, branch creation (see create-branch), PR creation (see create-pr),
splitting one described change into multiple commits unless asked.

## create-branch

Stub — specified in M0 after create-commit is proven. Core invariants will
cover: traceable naming (ticket-derived when available), safe switching with a
dirty tree, no work lost.

## create-pr

Stub — specified in M0 after create-branch. Core invariants will cover:
context-rich body from commits/ticket, correct base branch, no AI attribution.
