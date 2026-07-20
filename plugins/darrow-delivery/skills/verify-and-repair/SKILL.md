---
name: verify-and-repair
description: Independently review an implemented change in a Darrow-managed workspace, repair material issues, and verify the final behavior. This command is invoked explicitly by the Darrow workflow runtime; ordinary user requests should enter through `darrow run implement-change`.
---

# verify-and-repair

Review the supplied behavior in the current workspace from a fresh context,
repair material issues in the existing implementation, and verify the final
result. The implementation step has already established the change branch.

## Workspace boundary

Before inspecting or changing the implementation, run:

```bash
bash <skill-directory>/scripts/workspace-guard.sh capture
```

Retain the absolute `guard` path it prints. At the end, run `validate` with that
path. The guard rejects a changed active branch or HEAD and staging or unstaging
without treating unrelated concurrent worktree branches as this command's
effects. Its compact changed-path output is the authoritative source for the
result's repository-relative `changedPaths`. If it refuses, relay the failure
and stop without claiming verification.

## Review and repair

- Read the requested behavior, inspect the current diff, and trace the affected
  behavior through the relevant production and test code.
- Look for material correctness, boundary, regression, compatibility, security,
  and maintainability defects that could affect the requested outcome.
- Ignore style preferences, speculative generalization, broad refactoring
  opportunities, and unrelated pre-existing defects.
- Repair every material issue that can be fixed safely within the requested
  change. Preserve correct implementation work and avoid rewriting it merely to
  express a different preference.
- Add or adjust focused tests only when needed to expose a material gap. Never
  weaken, delete, skip, or rewrite an existing test to manufacture success.
- Run the smallest checks that exercise each material concern, then the relevant
  regression suite. Do not install or update dependencies to make checks run.

Report every verification command you attempted. Each top-level `verification`
entry is a verdict-determining check and contains `id`, `command`, `exitStatus`,
`purpose`, and `diagnosticChecks` (an empty array when no other command was
attempted for that concern). Put an exploratory or broader command check under
the successful verification check that exercises the same material concern.
Each nested diagnostic check contains `id`, `command`, `exitStatus`, `purpose`,
and `nonBlockingReason`. `diagnosticChecks` contains command-check objects, not
stderr or explanatory strings. Nest a failed diagnostic check only when its
failure is demonstrably caused by an unrelated pre-existing problem or runner
incompatibility; otherwise it remains a top-level verification failure. Do not
hide a relevant failure under an unrelated passing check.

Return `verified: true` only when at least one verdict-determining check ran,
every top-level verification check passed, and no material issue remains
unresolved. Return only the requested structured result, with actual commands
and exit statuses, material findings (if any), a `changedPaths` array, and a
concise `summary`. Each finding contains `severity`, `issue`, `resolution`, and
`paths`. Severity is `critical`, `high`, or `medium`; resolution is `fixed` or
`unresolved`. Use an empty `findings` array when there are none, and use
`resolution: fixed` for every finding when returning `verified: true`.

## Boundaries

- Work only in the existing branch and working tree.
- Do not commit, stage or unstage files, create or switch branches, push, open a
  pull request, mutate a ticket, or install/update dependencies, plugins,
  models, CLIs, or workers.
- Do not expand the requested behavior or perform unrelated cleanup.
