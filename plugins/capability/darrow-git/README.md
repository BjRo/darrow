# Darrow Git

This plugin turns common Git publication requests into small, explicit
workflows. The agent still decides what the user's change means, while bundled
scripts enforce the mechanical boundaries that are easy to get subtly wrong:
branch naming, staging, commit shape, duplicate pull requests, non-force
publication, and candidate-bound reviewer evidence.

Each workflow is independently intent-triggered. Installing the plugin does not
run Git commands automatically.

Claude Code receives a static SessionStart reminder to select the matching
installed skill before preflight, including clean trees, missing inputs, and
refusals. This native context hook runs no Git or GitHub commands, classifies no
prompts, and grants no authority. It is declared only in the Claude manifest.

## What it provides

### `create-branch`

Creates one conventionally named branch for the current work. A ticket token
supplied by an active provider stays opaque and leads the slug exactly once. It
can switch the current checkout or, only when requested, create a linked
worktree. Existing changes are preserved and existing branch names are never
clobbered.

Example: _“Create a branch for DAR-123 retry handling.”_

### `prepare-task-branch`

Discovers every local task branch for an exact opaque token without mutation,
returning complete candidates and tips for the caller to select. It also
creates or reuses one exact ticket-linked task branch in the current checkout
or, only on explicit request, in a linked worktree. Existing branch tips stay
fixed, the active provider's opaque token is required, and compatible
uncommitted work is preserved without stashing or committing it. A worktree
result returns the attributed execution path while leaving the caller's
checkout untouched.

Creating a missing name refuses when another correlated local branch exists,
so callers can reuse prior work even when a newly proposed suffix differs.

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

An explicit request to publish commits to and reuse the existing PR selects a
separate path: it pushes without force and verifies that the remote branch and
forge head both equal the intended commit. It returns the repository, URL,
head/base, draft state and commit evidence without changing PR metadata.

Creation returns that same verified repository, URL, shape and full
intended/remote/forge commit evidence after observing the new PR.

Example: _“Push this branch and open a draft PR.”_

### `publish-pr-evidence`

Publishes one top-level, candidate-bound PR evidence comment with optional
ordered image or video attachments. It validates every file and presentation
label before upload, verifies the exact current PR head, reconciles prior
comments by deterministic content identity, and makes at most one authorized
comment invocation. Text-only evidence is supported. Partial or ambiguous
remote state stops without retry or cleanup.

Example: _“Attach these verification screenshots to the current PR.”_

### Bundled workflow scripts

Each skill uses a frozen UV entrypoint from the contained Python package in
`backend/`. The helpers inspect and validate repository state, perform only the authorized
Git or GitHub operation, and return structured evidence for the skill to
interpret. They are implementation details of the workflows rather than a
general Git wrapper. Existing Bash script paths remain thin compatibility
launchers with the same commands, records, and exit statuses. Native Windows
calls the UV entrypoints directly.

## Design boundaries

- The skills do not chain implicitly: creating a commit does not push, and
  creating or preparing a branch does not commit.
- Commit and pull-request text follows Conventional Commits and contains no AI
  attribution.
- Hooks and repository safety checks are respected rather than bypassed.
- No workflow force-pushes, amends, rebases, merges, releases, or deploys.

## When to use

Create or prepare a branch, create a commit, publish a requested PR, or publish
explicitly authorized evidence to its exact verified head. Do not use these
workflows to rewrite history, merge, release, deploy, or post generic comments.

## Hosts and prerequisites

Codex and Claude Code on Linux, macOS, and Windows; Git, UV, and Python
3.10–3.13 (UV can provision Python). Bash is needed only for POSIX compatibility
launchers. PR work also requires
authenticated GitHub CLI access and a usable remote. Attachment publication
requires a GitHub host and a `gh pr comment` implementation that advertises
`--attach`.

Provider calls use literal argument vectors and native filesystem APIs. The
existing hook-remediation `--command` interface is the sole shell exception:
it passes the exact authorized diagnostic to POSIX `sh` or native Windows `cmd`.
Its saved HEAD/index checks and staged-path limits still apply. A diagnostic's
command syntax must match its host.

Successful PR reports link the PR and name its base, draft state, and verified
commit once. Complete structured publication evidence remains available from
the helper. PR-head propagation is observed at most five times, one second
apart, without repeating a push or PR creation.

## Validation

`bun run check:python` runs formatting, Ruff, strict typing, deterministic and
property tests, and separate 95% statement/branch coverage gates. The package
has no runtime dependencies. Fresh-install checks copy the whole plugin and
exercise all five workflows with real local Git repositories and mocked GitHub
boundaries, using `tests/fresh-install.test.sh` on POSIX and
`tests/fresh-install.test.ps1` in native PowerShell. CI covers Python 3.10–3.13
on Linux, macOS, and Windows. Existing shell regressions continue to exercise
the compatibility launchers.

## Installation

Install `darrow-git@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Create a branch for retry handling.

To select it explicitly, choose `create-branch` from Codex's `$` skill menu,
or use `/darrow-git:create-branch` in Claude Code, followed by your request.

## Expected result

The requested branch, one commit, or verified PR, with evidence. Existing user work and safety checks are preserved.

## Troubleshooting

Keep exact conflict, existing-name, hook, or duplicate-PR refusals and follow the selected skill's recovery path. Do not force, bypass hooks, or invent another branch name.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
