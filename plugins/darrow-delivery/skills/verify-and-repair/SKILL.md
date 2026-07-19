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

Return `verified: true` only when the relevant checks pass and no material issue
remains unresolved. Return only the requested structured result, with actual
commands and exit statuses, material findings (if any), and a concise summary.

## Boundaries

- Work only in the existing branch and working tree.
- Do not commit, stage or unstage files, create or switch branches, push, open a
  pull request, mutate a ticket, or install/update dependencies, plugins,
  models, CLIs, or workers.
- Do not expand the requested behavior or perform unrelated cleanup.
