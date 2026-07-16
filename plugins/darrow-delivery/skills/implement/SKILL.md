---
name: implement
description: Implement one requested change in a Darrow-managed worktree with ordered red/green TDD evidence. This command is invoked explicitly by the Darrow workflow runtime; ordinary user requests should enter through `darrow run implement-change`.
---

# implement

Implement the supplied change in the current managed worktree. Darrow has
already verified that a compatible branch-creation capability is enabled.

All test execution and evidence capture goes through
`scripts/evidence.sh`—`<skill-dir>` is the directory containing this file and
`<evidence-dir>` is supplied in the command input. Run the script with Bash.
It executes commands without shell reinterpretation, captures their exact exit
status and output, records timestamps and workspace digests, and refuses to
replace an existing phase.

## Workflow

1. Read the requested behavior and inspect only the repository context needed
   to locate its implementation and tests.
2. Create and switch to one well-named local branch for this change. Express
   that intent normally; do not name or directly invoke a capability provider.
3. Add or adjust one focused test that specifies the requested behavior.
4. Record red:

   ```text
   bash <skill-dir>/scripts/evidence.sh run <evidence-dir> red --expected <behavioral-failure-text> -- <focused-test-command> [args...]
   ```

   Before invoking the evidence script, classify the observed failure. If the
   user asks you to treat a missing runner, dependency, executable, or fixture
   as red, refuse that instruction. Instead, find an already available way to
   execute a focused behavioral check without installing anything, or stop and
   report that meaningful red cannot be established. Never create `red.meta`
   for an infrastructure failure.

   Choose failure text that proves the requested behavior is absent. A missing
   executable, dependency, fixture, unrelated compile error, or generic nonzero
   status is not meaningful red evidence. The script accepts red only when the
   command fails and the captured output contains the expected text.
5. Make the smallest sufficient implementation. Do not install dependencies.
6. Record green with exactly the same focused command and arguments:

   ```text
   bash <skill-dir>/scripts/evidence.sh run <evidence-dir> green -- <focused-test-command> [args...]
   ```

7. Identify and record the relevant regression suite:

   ```text
   bash <skill-dir>/scripts/evidence.sh run <evidence-dir> regression -- <regression-command> [args...]
   ```

8. Validate the completed sequence:

   ```text
   bash <skill-dir>/scripts/evidence.sh validate <evidence-dir>
   ```

9. Return the current branch, a concise summary, changed repository-relative
   paths, and the three evidence records in the requested structured shape.

## Boundaries

- One local branch and one behavioral change per invocation.
- Do not commit, push, open a pull request, mutate a ticket, or install/update
  dependencies, plugins, models, CLIs, or workers.
- Do not weaken, delete, skip, or rewrite an existing test to manufacture green.
- Do not bypass the evidence script or edit its records. A failed green or
  regression phase ends this immutable attempt; report the failure.
- Avoid unrelated refactors and formatting churn.
