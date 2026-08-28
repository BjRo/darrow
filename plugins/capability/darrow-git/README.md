# Darrow Git

This plugin turns common Git publication requests into small, explicit
workflows. The agent still decides what the user's change means, while bundled
scripts enforce the mechanical boundaries that are easy to get subtly wrong:
branch naming, staging, commit shape, duplicate pull requests, and non-force
publication.

Each workflow is independently intent-triggered. Installing the plugin does not
run Git commands automatically.

## What it provides

### `create-branch`

Creates one conventionally named branch for the current work. A ticket token
supplied by an active provider stays opaque and leads the slug exactly once. It
can switch the current checkout or, only when requested, create a linked
worktree. Existing changes are preserved and existing branch names are never
clobbered.

Example: _“Create a branch for DAR-123 retry handling.”_

### `prepare-task-branch`

Creates or reuses one exact ticket-linked task branch in the current checkout
or, only on explicit request, in a linked worktree. Existing branch tips stay
fixed, the active provider's opaque token is required, and compatible
uncommitted work is preserved without stashing or committing it. A worktree
result returns the attributed execution path while leaving the caller's
checkout untouched.

Example: _“Prepare the existing branch for DAR-123 before continuing.”_

### `create-commit`

Creates one new Conventional Commit. An existing staged set is treated as the
user's exact selection; otherwise the skill deliberately selects only paths
belonging to the requested change. Hooks run normally, and history is never
rewritten as part of this workflow. After a reported hook failure, it can
refresh only explicitly authorized paths already in that staged set and rerun
the normal commit path; unrelated work remains excluded. An unambiguous,
path-scoped hook diagnosis can also run through a snapshot-guarded remediation
step before that retry.

Example: _“Commit these changes.”_

### `create-pr`

Pushes the current feature branch without rewriting history and opens exactly
one pull request for its committed delta. It respects the repository's default
base, pull-request template, and an explicitly requested draft state, and stops
when an open pull request already exists.

Example: _“Push this branch and open a draft PR.”_

### Bundled workflow scripts

Each skill uses its own bundled Bash script under `skills/<skill>/scripts/`.
The scripts inspect and validate repository state, perform only the authorized
Git or GitHub operation, and return structured evidence for the skill to
interpret. They are implementation details of the workflows rather than a
general Git wrapper.

## Design boundaries

- The four skills do not chain implicitly: creating a commit does not push, and
  creating or preparing a branch does not commit.
- Commit and pull-request text follows Conventional Commits and contains no AI
  attribution.
- Hooks and repository safety checks are respected rather than bypassed.
- No workflow force-pushes, amends, rebases, merges, releases, or deploys.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
