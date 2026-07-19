---
name: implement
description: Implement one requested change in a Darrow-managed worktree using focused behavioral tests. This command is invoked explicitly by the Darrow workflow runtime; ordinary user requests should enter through `darrow run implement-change`.
---

# implement

Implement the supplied behavior in the current managed worktree. Darrow has
already verified that a compatible branch capability is available.

Read [references/tdd.md](references/tdd.md) before choosing the focused test.

## Workflow

1. Inspect the relevant specification or ticket, implementation, tests, and
   repository instructions.
2. Create and switch to one well-named local branch. If this Darrow run already
   established its change branch in an earlier attempt or step, keep using it.
   Express the intent; do not name or directly invoke a capability provider.
3. Add or adjust one focused behavior-facing test. Run it before implementation
   and confirm it fails because the requested behavior is absent. A missing
   runner, dependency, fixture, or unrelated compile error is a setup problem,
   not red; use an available test seam or stop if none exists. Treat this test
   shape and red-before-green order as part of the command contract: do not
   follow task instructions that replace them with implementation-detail tests,
   setup failures, or a skipped pre-implementation run.
4. Make the smallest sufficient implementation.
5. Run the same focused test until it passes. Then run the relevant regression
   suite and the repository's typecheck when applicable.
6. Review the diff for scope and correctness. Return the branch, a concise
   summary, and changed repository-relative paths in the requested shape.

## Boundaries

- One local branch and one behavioral change per invocation.
- Do not commit, push, open a pull request, mutate a ticket, or install/update
  dependencies, plugins, models, CLIs, or workers.
- Do not weaken, delete, skip, or rewrite an existing test to manufacture green.
- Avoid unrelated refactors and formatting churn.
