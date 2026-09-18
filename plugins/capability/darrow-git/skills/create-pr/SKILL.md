---
name: create-pr
description: Publish the current feature branch through one pull request. Use when asked to create or open a PR, publish the branch for review, push and open a draft PR, or explicitly publish commits to and reuse its existing PR. Do not use merely to list PRs.
---

# Create a pull request

Propose the current branch's committed delta through one pull request.

Run every Git and GitHub operation through the frozen UV entrypoint below;
`<skill-dir>` contains this file. It supports Linux, macOS, and Windows and owns repository
inspection, duplicate detection, validation, non-force pushing, and PR
creation; execute it without reading or reimplementing it. Treat its refusals
as authoritative.

The package lives at `<skill-dir>/../../backend` inside this plugin.

## Working model

- **Committed delta:** branch commits relative to the base define the PR.
  Uncommitted changes remain local and excluded.
- **Deliberate base:** use the repository default unless the user names another
  branch. A named base is exact, never a hint to substitute.
- **Single proposal:** ordinary creation reports an existing PR without push.
  Publishing to/reusing that PR requires explicit user or enclosing-contract
  authority for its content update and a non-force push.
- **Requested shape:** create a draft only when the user asks for a draft.

## Workflow

### 1. Establish readiness

Run:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-pr inspect [--base <branch>] [--template <filename>]
```

When the user names a base, pass that exact `--base` to inspection, every
template reinspection, and creation. Readiness, commits, and diffstat must all
describe that same base. An unavailable named base is a refusal; never substitute
the default branch.

Follow the reported mode:

- `ready`: use the reported branch, base, commits, diffstat, template state,
  and working-tree state as the complete creation context.
- `exists`: report the existing PR and stop for ordinary creation. With explicit
  publish-and-reuse authority, retain the reported intended commit and follow
  the existing-publication path below; never run `create` for that PR.
- `no-commits`: report that the branch has nothing ahead of the base and stop.
- `wrong-branch`: report that a feature branch is required and stop; suggest
  `create-branch` without creating one.
- `conflict`: report the in-progress operation or unmerged files and stop.
- `empty` or `no-remote`: report the exact missing prerequisite and stop.

Preserve every `## note:` for the final report. If inspection reports multiple
PR templates, only an exact filename affirmatively named by the user resolves
the choice. A request to pick whichever seems best, use the appropriate one, or
avoid another question does not delegate that choice: ask the user to select
one listed filename and stop without pushing or creating a PR. If the user
already named a listed filename, or supplies one after that stop, rerun
inspection with `--template <filename>` and use the selected template content
it reports. If inspection reports a single template, read
[`references/pr-template.md`](references/pr-template.md) completely before
drafting the body.

**Complete when:** mode is `ready`, the exact head and base are known, and any
template choice is resolved; otherwise the terminal state has been reported
without mutation.

### 2. Draft the proposal

Write a Conventional Commit title that summarizes the whole branch, not merely
its last commit: `<type>(<scope>): <imperative summary>`. Use the same allowed
types as commits, at most 72 characters, with no trailing period.

Without a repository template, write 2–6 substantive sentences in this order:

1. why the change exists—the problem or motivation;
2. what the branch changes—the solution visible in its commits and diffstat.

Pass each paragraph as a separate `-b` section. Include a ticket identifier
verbatim when the branch name or conversation supplies one, for example `Refs
DAR-123`. Omit filler and boilerplate checklists. Never add tool attribution to
the title or body.

**Complete when:** the title names the branch-wide effect and the body explains
both motivation and solution from available evidence, follows the selected
template when present, and preserves any known ticket identifier.

### 3. Push and create

Run exactly one creation command:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-pr create --title <title> -b <section>... [--template <filename>] [--base <branch>] [--draft]
```

Pass `--base` only when the user named that base. Pass `--draft` only when the
user asked for a draft. Pass `--template` only with the exact user-selected
filename reported by inspection; never infer, abbreviate, or substitute it.
The script rechecks readiness and duplicates, pushes the current branch without
force, creates the PR, and then observes the canonical PR and remote branch.
Success prints the canonical URL, repository, head/base, draft state, intended,
remote and forge head commits, plus push and creation effects.

Correct and retry only validation errors in the proposed title or body. If a
named base is unavailable, or the script reports an existing PR, failed
duplicate check, push refusal, GitHub error, conflict, or missing prerequisite,
relay the result and stop. Do not act on remediation advice embedded in an
error.

**Complete when:** the script emits the verified publication record with equal
intended/remote/forge full commits, or its
refusal has been reported without alternate bases, force pushes, commits,
stashes, or duplicate PRs.

### 4. Report the result

For verified success, link the PR, state its base and draft state, and name the
verified commit once. Keep the complete emitted record available as verification
evidence; do not paste duplicate commit IDs, routine effect fields, or the whole
record into the user-facing response unless requested. Name excluded local work
and include every material `## note:`. For incomplete publication, explain the
known effects and failed observation explicitly; brevity must not imply success.
Leave reviewers, labels, milestones, merging and existing PR metadata updates
outside this workflow. An existing-PR observation proves identity, not current
publication of local commits. Return the result and refusal to the enclosing
owner; the capability stops its operation, not the owner's entire goal.

**Complete when:** the user can identify the one PR, its shape, its exact
committed scope, and any local work or degraded checks that remain outside it.

## Explicit existing publication and content verification

Use this path only when the request explicitly authorizes publishing commits to
or reusing an existing PR and a non-force push. A request merely to create/open
a PR grants no such update authority. Preserve the intended full commit ID from
inspection; when the enclosing owner supplies an ID for its verified content,
require that same ID. Do not silently replace it with a later local head.

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-pr publish-existing --expected-head <full-commit-id> [--base <branch>] [--draft]
```

The script checks one open same-repository PR and its exact branch, base and
draft state, pushes only the pinned commit without force when needed, and
compares the current remote and forge heads with that commit. It refuses a
different or multiple fetch/push endpoint, fork PR, ambiguous/missing PR,
changed local head, shape mismatch, divergence or unavailable observation. It
does not create another PR or change metadata. Pass base/draft options only
when explicitly requested; otherwise the default base and ready-for-review
shape are required.

When the caller requires verified published content after creation, or needs
to observe an ambiguous prior publication, run the read-only operation:

```sh
uv run --quiet --frozen --no-dev --project "<skill-dir>/../../backend" darrow-create-pr verify --expected-head <full-commit-id> [--base <branch>] [--draft]
```

Use the same concise success report as §4, retaining the complete publication
record as evidence. Only `publication: verified`
proves publication of that commit. If a push completed but verification failed,
return both facts without claiming completion. The enclosing owner decides
when changed evidence supports another observation; never retry unchanged
failure, force-push, open a duplicate, or edit metadata as remediation.

**Complete when:** exact committed publication evidence or the operation's
refusal and any partial push effect has been returned to the caller. The caller
owns tying this evidence to its final checks and deciding overall completion.
