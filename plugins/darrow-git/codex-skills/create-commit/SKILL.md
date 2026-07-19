---
name: create-commit
description: Create a single, well-formed git commit for the user's intended change. Use when the user says "commit this", "commit my changes", "create a commit", "commit the staged files", or otherwise asks to commit work. Inspects state, stages deliberately, writes a Conventional Commit message.
---

# create-commit

Create exactly one commit for the user's intended change.

All git interaction goes through `scripts/commit.sh` — `<skill-dir>` below
means the directory containing this SKILL.md; run the script with `bash`. It
prints compact context, enforces message format and staging rules, and
rejects invalid input with an explanatory error — fix and retry if it does.
No raw `git` commands.

## Workflow

1. `bash <skill-dir>/scripts/commit.sh inspect`
   - `mode: staged` → the commit set is already decided. Don't re-reason it;
     pass no paths in step 2. Mention the "not included" files to the user
     without committing them.
   - `mode: unstaged` → pick only the files belonging to the change the user
     described; unrelated dirty files stay untouched. Peek at a specific file
     with `... commit.sh diff <path>` if needed. If the user's description
     and the actual changes clearly conflict, say so instead of guessing.
   - `mode: conflict` → don't commit; tell the user to resolve the
     merge/rebase first.
2. `bash <skill-dir>/scripts/commit.sh commit -m "<subject>" [-m "<body>"] [<path>...]`
   — stages given paths, validates, commits, prints `<hash> <subject>`.
   Report that line to the user.

## Message judgment

- Subject: `<type>(<scope>): <imperative summary>` — concise, specific, match
  the style of the recent subjects from step 1.
- Body only when the *why* is non-obvious, breaking (`<type>!:` +
  `BREAKING CHANGE:` note), or a migration — the diff already says what
  changed; a body explains why. Wrap at 72 chars.
- No emoji unless recent history uses them.

## Boundaries

- One commit per invocation; don't bundle clearly separate concerns — commit
  what the user described and mention the rest.
- Never amend, rebase, force, or bypass hooks unless the user explicitly
  asked for that exact operation. If the script reports a commit failure
  (hook, identity, conflict), relay it verbatim and stop.
