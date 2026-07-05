---
name: create-commit
description: Create a single, well-formed git commit for the user's intended change. Use when the user says "commit this", "commit my changes", "create a commit", "commit the staged files", or otherwise asks to commit work. Inspects state, stages deliberately, writes a Conventional Commit message.
---

# create-commit

Create exactly one commit that captures the user's intended change. Spec:
`specs/git-workflow.md` (invariants GW-C1 … GW-C7).

## Workflow

1. **Inspect before acting.** Run `git status --short` and review the diff
   (`git diff --staged` and `git diff`) to understand what changed. Check
   `git log --oneline -5` to match the repository's message conventions.
2. **Determine the commit set.**
   - Files already staged → commit exactly those. Do not add anything else.
   - Nothing staged → stage only the files that belong to the change the user
     described, each by explicit path. Leave unrelated dirty files untouched.
   - Never use `git add -A`, `git add .`, or wildcard staging as a shortcut.
   - If the user's description and the staged set clearly conflict, say so
     instead of guessing.
3. **Write the message.** Conventional Commits format:
   - Subject: `<type>(<scope>): <imperative summary>` — scope optional,
     ≤ 72 characters, no trailing period. Types: feat, fix, refactor, perf,
     docs, test, chore, build, ci, style, revert.
   - Body only when the *why* is non-obvious, the change is breaking
     (`<type>!:` plus `BREAKING CHANGE:` note), or a migration is required.
     Wrap at 72 characters. The diff already says what changed — the body
     explains why.
4. **Commit.** `git commit -m "..."` (heredoc for multi-line bodies). Report
   the resulting short hash and subject.

## Hard rules

- No AI attribution of any kind: no `Co-authored-by` trailers for tools, no
  "Generated with" lines.
- No emoji unless the repository's recent history uses them.
- Never `--amend`, `--no-verify`, `--allow-empty`, force operations, or
  rebases unless the user explicitly requested that exact operation.
- If a commit hook fails, report the failure verbatim and stop; never bypass
  hooks to force the commit through.
- One commit per invocation. If the work contains clearly separate concerns
  and nothing is staged yet, commit the change the user described and mention
  the rest — don't bundle unrelated changes.
