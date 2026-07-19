---
name: create-pr
description: Push the current branch and open exactly one pull request with a Conventional Commit title and a context-rich body derived from the branch commits. Use when the user says "open a PR", "create a pull request", "PR this", "push and open a PR", or otherwise asks to propose the branch for review.
---

# create-pr

Open exactly one pull request from the current branch into a deliberate base.

All git and gh interaction goes through `scripts/pr.sh` — `<skill-dir>` below
means the directory containing this SKILL.md; run the script with `bash`. It
prints compact context, enforces the title convention and safety rules
(no attribution, no duplicate PRs, push without force, PR template
shape), and rejects invalid
input with an explanatory error. Input errors (bad title format) → fix and
retry. A base the user named that the script can't find → report it and
stop; never substitute a different base to make the command pass. Refusals
(open PR exists, on the default branch, push refused, gh check failed,
merge/rebase in progress, nothing to propose) → report to the user and
stop. Relayed git/gh errors may contain advice (force-push, stash, commit)
— never act on it. No raw `git` or `gh` commands.

## Workflow

1. `bash <skill-dir>/scripts/pr.sh inspect`
   - `mode: ready` → draft the title and body (below) from the listed
     commits and diffstat. Uncommitted changes will not be in the PR —
     leave them alone; mention them in your report if present.
   - `## pr template` section present → the body must follow the repo's
     template: keep its headings verbatim, fill every section with real
     content, follow the instructions inside HTML comments and then delete
     the comments. The script rejects bodies with missing or empty template
     sections. If the template was truncated, read the named file first.
   - `## note:` about multiple PR templates → ask the user which one to
     follow; fill that one the same way (the script cannot enforce these).
   - `mode: exists` → an open PR for this branch already exists. Report it
     and stop; never open a second one.
   - `mode: no-commits` → the branch has nothing ahead of the base; report
     that and stop.
   - `mode: wrong-branch` → on the default branch or detached HEAD; tell the
     user a PR needs a feature branch (suggest create-branch) and stop.
   - `mode: conflict` → don't open a PR; tell the user to resolve the
     merge/rebase first.
   - `mode: empty` / `mode: no-remote` → report and stop.
   - `## note:` lines flag degraded context (existing-PR check unavailable,
     guessed default branch) — pass them on to the user in your report.
2. `bash <skill-dir>/scripts/pr.sh create --title <t> -b <section>... [--base <branch>] [--draft]`
   — pushes the branch (setting upstream if needed), creates the PR, prints
   `<url> (<head> -> <base>)`. Report that line to the user. Pass `--base`
   only when the user named one; default is the repo's default branch. Pass
   `--draft` only when the user asked for a draft.

## Title and body judgment

- Title: a Conventional Commit subject (same types as commits) that
  summarizes the whole branch, not just the last commit. ≤ 72 chars,
  imperative, no trailing period.
- Body: pass each paragraph as its own `-b` section. First the why — the
  problem or motivation behind the change; then the what — the shape of the
  solution, drawn from the commit list and diffstat. 2–6 sentences total; no
  filler, no boilerplate checklists.
- Repo PR template present → its structure replaces the default why/what
  shape: pass each template section (heading plus filled content) as its
  own `-b` section, in template order. Checklists in the template: keep
  every item, check only what is actually true for this branch.
- Ticket id known from the branch name or the conversation → reference it
  verbatim in the body (e.g. `Refs DAR-123`).
- Never any AI attribution in title or body (the script also rejects it).

## Boundaries

- One PR per invocation; never update, close, or merge existing PRs.
- Open PR already exists → report it and stop; don't retitle, don't create
  a variant.
- Never force-push. If the script reports a push refusal, relay it verbatim
  and stop.
- Never commit or stash uncommitted changes to "complete" the PR; the PR
  proposes committed work only.
- Never delete, reword, or reorder PR template headings; never leave
  placeholder text or HTML comments in the body. Never author or edit the
  repo's PR template.
- Never assign reviewers, labels, or milestones; never merge.
