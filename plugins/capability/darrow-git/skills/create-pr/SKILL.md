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

Set `<skill-dir>` to the directory containing the `SKILL.md` you successfully
read, including its final `create-pr` segment. Keep that actual path when
resolving `../../backend`; do not add a guessed plugin namespace or substitute
the parent `skills` directory. If a launcher path fails, correct that path
before declaring the runtime unavailable.

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
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-create-pr inspect [--base <branch>] [--template <filename>]
```

When the user names a base, pass that exact `--base` to inspection, every
template reinspection, and creation. Readiness, commits, and diffstat must all
describe that same base. An unavailable named base is a refusal; never substitute
the default branch.

Follow the reported mode:

- `ready`: use the reported branch, base, commit IDs, commit summaries,
  diffstat, template state, and working-tree state to prepare the proposal.
- `exists`: report the existing PR and stop for ordinary creation. With explicit
  publish-and-reuse authority, retain the reported intended commit and follow
  the existing-publication path below; never run `create` for that PR.
- `no-commits`: report that the branch has nothing ahead of the base and stop.
- `wrong-branch`: report that a feature branch is required and stop; suggest
  `create-branch` without creating one.
- `conflict`: report the in-progress operation or unmerged files and stop.
- `empty` or `no-remote`: report the exact missing prerequisite and stop.

Preserve every applicable `## note:` for the final report. For a single
automatically detected template, omit `--template` from inspection and creation.
Its reported path is the template file to read, not a selector argument.
The selector accepts only a filename from inspection's multiple-template list.
If inspection reports
multiple PR templates, use an exact listed filename named by the user. The user
may instead explicitly delegate selection with a request such as "pick whichever
seems best" or "use the appropriate template." In that case, choose the
template that fits the branch's committed change. If none fits, ask the user.
A request merely to open a PR does not delegate selection: ask the user to
choose one listed filename and stop
without pushing or creating a PR. For a named or delegated choice, rerun
inspection with `--template <filename>` and use the selected template content
it reports. The resolved multiple-template note does not need repeating in the
final report. For any selected template, including a single template, read
[`references/pr-template.md`](references/pr-template.md) completely before
drafting the body.

**Complete when:** mode is `ready`, the exact head and base are known, and any
template choice is resolved; otherwise the terminal state has been reported
without mutation.

### 2. Draft the proposal

Write a Conventional Commit title that summarizes the whole branch, not merely
its last commit: `<type>(<scope>): <imperative summary>`. Use the same allowed
types as commits, at most 72 characters, with no trailing period.

Without a repository template, use the Markdown headings `## Summary`,
`## Evidence`, and `## Merge Danger` in that order. With a template, put the same
useful content under its relevant headings; preserve its structure instead of
adding competing headings.

- **Summary.** Start the change summary with a small fenced `diff` sketch
  when it can show a meaningful change in behavior or structure. Sketch
  the relevant calls, branch conditions, or ownership changes. Follow with a
  sentence explaining why the change is needed and what it does. For a
  straightforward correction such as a typo, use a sentence in place of
  the sketch.
- **Evidence:** Present available before/after observations with their source
  and scope: supplied screenshots, output, or actual failing/passing runs. Label
  inferred behavior as inference. If only one side is observed, say which is
  missing; if neither is observed, state that rather than inventing a comparison.
  A test added in a commit is coverage, not evidence of a passing run. Preserve
  limits such as stub-only checks, absent suite results, or untested live services.
- **Merge Danger.** Use both bold labels in the default body and within
  the selected template. For example, a cleanup that deletes old records
  could use these two lines.

  > **Rollback:** One-way door. Reverting stops future deletions. Already
  > deleted records need separate recovery.
  >
  > **Blast radius:** Users who still have records in the old format lose
  > those records when the cleanup runs.

  Use **Two-way door** when a revert or routine rollback undoes the effects
  of the change. Classify any lasting effects, including writes, deletions,
  migrations, and external actions. If they are irreversible or costly to
  undo, use **One-way door**. Say when reversibility is unknown. Identify the
  condition that puts people, data, or systems in scope and what changes for
  them. Qualify unknown downstream effects.

When the available context cannot ground a sketch, read the committed diff
before drafting. Pass both full IDs reported by inspection as `comparison
commit` and `intended commit`, in that order. Start with relevant paths from
the diffstat when the change is broad.

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-create-pr diff <comparison-commit> <intended-commit> [<repo-relative-path>...]
```

The command shows the committed patch since the merge base. Quote paths
that contain spaces. If the output is truncated, narrow the paths. If the
patch is unavailable or still lacks the detail needed for a faithful sketch,
write a short summary using the evidence you have.

Scale detail to the change: a sentence per section may be enough for a small
change. Use available committed context and conversation evidence; identify
material unknowns instead of delaying publication to manufacture evidence.
This drafting step grants no test execution, media upload, separate comment,
or PR metadata-update authority. Git supplies the complete presentation itself;
no Explanation skill or second PR publisher is required.

Pass each heading with its content as a separate `-b` section. For the default
body, each section starts with its `##` heading, followed by a blank line and
the content. Use a quoted shell heredoc or equivalent literal argument for
each section so Markdown backticks and dollar signs reach the PR intact.
If the branch name or conversation supplies a ticket identifier, add it
verbatim to the body as `Refs <identifier>` or in the template's ticket
section. Omit filler and boilerplate checklists. Never add tool
attribution to the title or body. Presentation sources and applicable notices
are recorded in [CREDITS.md](CREDITS.md).

**Complete when:** the title names the branch-wide effect. The body opens the
change summary with a grounded sketch when useful, states evidence and its
limits, and labels rollback and blast radius. It follows the selected template
and preserves any known ticket identifier.

### 3. Push and create

Run exactly one creation command:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-create-pr create --title <title> -b <section>... [--template <filename>] [--base <branch>] [--draft]
```

Pass `--base` only when the user named that base. Pass `--draft` only when the
user asked for a draft. Pass `--template` only with an exact filename from the
multiple-template list, resolved through the user's named or delegated choice.
Omit it for a single automatically detected template; never pass that template's
path as a selector.
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
and include every material `## note:`. If the user delegated a choice among
multiple PR templates, name the chosen filename and give one brief reason it
fits the branch's change. For incomplete publication, explain the
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
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-create-pr publish-existing --expected-head <full-commit-id> [--base <branch>] [--draft]
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
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-create-pr verify --expected-head <full-commit-id> [--base <branch>] [--draft]
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
