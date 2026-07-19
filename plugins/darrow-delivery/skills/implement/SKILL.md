---
name: implement
description: Implement one requested change in a Darrow-managed worktree using focused behavioral tests. This command is invoked explicitly by the Darrow workflow runtime; ordinary user requests should enter through `darrow run implement-change`.
---

# implement

Implement the supplied behavior in the current workspace. Darrow already owns
that workspace exclusively and has verified that a compatible branch capability
is available.

## Delivery contract

- Create and switch to one well-named local branch. If this run already
  established its change branch, keep using it. Express the intent; do not name
  or directly invoke a capability provider.
- Use Red/Green TDD to implement the requested change. Use an existing focused
  behavioral test when it covers the requested behavior; otherwise add or
  adjust one. Run that test before changing production code and confirm it fails
  because the requested behavior is missing. Then make the smallest change that
  passes the same test and run the relevant regression tests. If the normal test
  command fails for an unrelated setup reason, run the focused test directly or
  through another available command; an unrelated failure is not red.
- Return the branch, a concise summary, and changed repository-relative paths in
  the requested shape.

## Boundaries

- One local branch and one behavioral change per invocation.
- Do not commit, push, open a pull request, mutate a ticket, or install/update
  dependencies, plugins, models, CLIs, or workers.
- Do not weaken, delete, skip, or rewrite an existing test to manufacture green.
- Avoid unrelated refactors and formatting churn.
