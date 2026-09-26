# Capability: Git Workflow

Consolidates the git workflow into intent-triggered skills so that branching,
committing, and PR creation are consistent, traceable, and safe regardless of
which agent runtime executes them.

Plugin: `darrow-git`. Skills: `create-commit` (M0), `create-branch`,
`prepare-task-branch`, `create-pr`, `publish-pr-evidence`.

GW-B6 applies only when the caller explicitly asks the `create-branch`
capability to allocate an additional linked worktree.

## Native discovery

- **GW-A1 — Route before preflight.** A matching Git workflow request selects
  its skill before repository inspection or a terminal response. Missing input,
  a clean tree, conflicts, and hook failures remain within the owning skill's
  scope. General inspection and unrelated comments do not select a mutation
  skill. Claude receives a plugin-local SessionStart routing reminder through
  its native context hook. The hook supplies static context only: no provider
  calls, prompt classification, workflow execution, state, or authority grants.
  Native skill discovery and the selected skill retain contextual decisions;
  installation never starts an operation or chains capabilities.

## Executable mechanics

- **GW-M1 — Contained portable implementation.** The five capabilities share
  one Python package contained in `darrow-git/backend`, with frozen UV runtime
  entrypoints and no runtime dependency on another plugin. Git and GitHub CLI
  remain the provider boundaries. Frozen UV console commands are the runtime
  interface on every platform; legacy shell-script paths are not retained.
  Command arguments, stable records, refusal statuses, and mutation safeguards
  remain intact. Internal refactoring preserves argument consumption order,
  repeated-option behavior, diagnostic text, and stdout/stderr routing as well
  as exit codes and repository effects. No workflow requires a Bash launcher.
- **GW-M2 — Literal process and filesystem boundaries.** Provider commands use
  argument vectors, never interpolated shell programs. Paths and temporary
  artifacts use native filesystem APIs. Hook remediation retains its diagnostic
  and index-snapshot authorization boundary; the literal authorized diagnostic
  command uses the native host command interpreter (POSIX sh or Windows cmd)
  with its native command-string quoting. This compatibility exception never applies to Git/GitHub
  provider arguments.
- **GW-M3 — Migration evidence.** The package meets the repository Python
  quality standard, including separate 95% statement and branch coverage,
  deterministic real-Git integration fixtures, mocked GitHub publication,
  meaningful property tests, and fresh copied-plugin tests on Linux, macOS,
  and native Windows. The propagation and presentation fixes tracked in #171
  and #174 remain separately identifiable from this migration.

## Why

Agents left to improvise git usage produce inconsistent messages, stage
unrelated changes, and leak tool attribution into history. Encapsulating the
workflow as skills makes behavior specifiable, evaluable, and swappable —
consumers with their own conventions simply don't install this plugin.

## create-commit

### Intent triggers

"commit this", "commit my changes", "create a commit", "commit the staged
files", "retry the failed commit", "fix the hook failure and retry my staged
change", or an explicit skill invocation.

### Contract

Produce exactly one commit that captures the user's intended change with a
clear Conventional Commit message. Inspect state first (`git status`,
`git diff`), then stage deliberately (if needed), then commit.

### Invariants

- **GW-C1 — Staged intent only.** If files are already staged, commit exactly
  those. Never sweep in unrelated working-tree changes; never use
  `git add -A`/`git add .` as a shortcut.
- **GW-C2 — Deliberate staging.** If nothing is staged, stage only the files
  belonging to the change the user described. Unrelated dirty files stay
  untouched.
- **GW-C3 — Conventional Commits.** Subject: `<type>(<scope>)?: <imperative summary>`,
  ≤ 72 chars, no trailing period. Types: feat, fix, refactor, perf, docs,
  test, chore, build, ci, style, revert.
- **GW-C4 — No tool attribution.** No `Co-authored-by` AI trailers, no
  "Generated with ..." lines, no emoji unless the repo convention uses them.
- **GW-C5 — Body only for the why.** Body present only when the reason is
  non-obvious, a breaking change, or a migration note. Wrap at 72 chars.
- **GW-C6 — No history rewriting.** Never `--amend`, `--no-verify`, force
  operations, or rebase unless the user explicitly asked for that operation.
  When the user asks to commit but only implies that the change belongs in
  earlier history, the explicit commit request takes precedence: create a new
  commit without asking whether to amend.
- **GW-C7 — Respect hooks.** If a commit hook fails, report it; don't bypass.
- **GW-C8 — Authorized staged retry only.** After a hook failure, a retry may
  refresh only literal, explicitly authorized paths that were already in the
  staged set. It preserves every other staged blob and rejects a path outside
  that set without changing the index, worktree, or history.
- **GW-C9 — Diagnosed remediation only.** A hook-directed remediation may run
  only when its diagnostic provides one unambiguous, path-scoped corrective
  command for the failed intended commit. Before refreshing staged paths, the
  capability proves the remediation did not change `HEAD` or the index; an
  ambiguous diagnostic or changed index stops the workflow.

### Non-goals

Pushing, branch creation (see create-branch), PR creation (see create-pr),
splitting one described change into multiple commits unless asked.

## create-branch

A request to create a branch from described ticket work belongs to
`create-branch` even when it supplies a canonical ticket token. That token does
not bind a complete branch name or turn creation into task-branch discovery;
derive the new name without asking the caller to supply one.

### Intent triggers

"create a branch", "branch for this", "start a branch", "new branch for X",
"create a worktree for X", "branch this in a worktree", or an explicit
skill invocation.

### Contract

Create and switch to exactly one new branch whose name traces to the work
(and the ticket, when one is known). Inspect state first, derive the name,
then create. When the user asks for a worktree, the branch is created in a
new linked worktree instead and the current checkout stays where it is.

### Invariants

- **GW-B1 — Traceable naming.** `<type>/<kebab-slug>` with the same types as
  commits. When an active ticket provider supplies an opaque canonical token,
  the slug begins with that exact token and contains it exactly once (e.g.
  `feat/DAR-123-retry-logic`, `fix/issue-64-preserve-identifiers`). Generic Git
  neither maps nor normalizes provider tokens; a ticket-linked request without
  the token asks one smallest question and performs no Git mutation. Segments
  lowercase except opaque ticket-token segments.
- **GW-B2 — No work lost.** Uncommitted changes are never stashed, reset,
  discarded, or committed to make the operation work. Switching in place
  they travel to the new branch untouched; in worktree mode they stay in
  the current checkout. If git refuses, relay verbatim and stop.
- **GW-B3 — No clobbering.** An existing branch name is never reused, reset,
  or force-moved; report it and stop — no invented variants. A failed worktree
  addition never deletes a branch that appeared concurrently.
- **GW-B4 — Deliberate base.** Base is the current HEAD unless the user names
  one; the base is stated in the report.
- **GW-B5 — No branching mid-conflict.** Merge/rebase in progress → don't
  branch; tell the user to resolve first.
- **GW-B6 — Worktree only by request.** A worktree is created only when the
  user asks for one. Default location is `.worktrees/<branch>` under the
  main worktree's root (never nested inside another worktree), kept out of
  `git status` via the repo's local excludes. A
  user-named path is resolved from the caller's current directory or reported
  as unusable — never substituted. An existing path is never reused or
  overwritten. The report states the absolute worktree path and, when the tree
  was dirty, that uncommitted changes stayed behind. Once default worktree
  creation begins, a failure never removes branch or directory state that may
  belong to another actor and never adds a local-exclude entry; harmless empty
  default directories may remain.

### Non-goals

Pushing, upstream setup, fetch/pull before branching, deleting or renaming
branches, removing/moving/pruning worktrees, checking out an existing
branch into a worktree, PR creation (see create-pr).

## prepare-task-branch

### Intent triggers

"prepare the task branch", "switch to the existing ticket branch", "create or
reuse the branch for this ticket", or a composed request from an explicitly
authorized delivery workflow that needs its exact task branch active before
downstream work.

### Contract

Prepare exactly one conventional ticket-linked task branch. By default, do so
in the current checkout: switch to an exact existing local branch without
moving it, create a missing branch from a deliberate base, or report an already
active branch without mutation. Only when the caller explicitly requests a
worktree, prepare the branch in a linked worktree and return its execution path
while leaving the caller's checkout untouched.

### Invariants

- **GW-TB1 — Exact preparation input.** The caller supplies one exact conventional
  branch name and the active ticket provider's opaque canonical token. The slug
  begins with that token exactly once. Generic Git never derives, normalizes,
  or chooses a correlated name. Supplying multiple candidates and
  delegating the choice (for example, "whichever seems better") remains
  ambiguous; preparation asks for one exact selection before any Git mutation.
- **GW-TB2 — Additive preparation.** An existing branch is switched to or
  attached to a worktree without resetting or moving it; a missing branch is
  created from the named base or current `HEAD`. The result reports `current`,
  `reused`, or `created` (with a `worktree-` prefix when applicable) plus the
  exact branch, base or fully qualified existing branch tip, and worktree path
  when applicable.
- **GW-TB3 — No work lost.** Uncommitted changes are never stashed, reset,
  discarded, or committed. A refused switch relays Git's failure and leaves the
  original branch, refs, worktree, index, and stash intact. A failed worktree
  addition never deletes a branch that appeared concurrently and leaves no
  default-path directories or local-exclude entries created solely for the
  failed attempt.
- **GW-TB4 — Conflicts stop.** Merge, rebase, cherry-pick, revert, or unmerged
  index state prevents preparation before any branch mutation.
- **GW-TB5 — Explicit worktree context.** Worktree preparation occurs only on
  an explicit caller request. It reuses an exact branch's existing worktree or
  adds a new linked worktree without switching or changing the caller's
  checkout, and reports the absolute execution path. It never moves or removes
  a linked worktree and never fetches or changes a remote ref.
  Default-path preparation accepts an absent optional `info/exclude` file and
  creates its ignore entry only after successful worktree creation. Existing
  unreadable exclude configuration refuses preparation without branch changes.
- **GW-TB6 — Composable capability.** The skill advertises one focused public
  intent that an authorized task recipe can request before its readiness gate,
  without assuming that recipe or any observability plugin is installed.

- **GW-TB7 — Complete token discovery.** A read-only discovery operation takes
  only the exact opaque canonical token and returns every correlated local
  branch in refname order, its full tip, and a count, without truncation. A
  correlated branch satisfies the same conventional name validation as exact
  preparation: allowed type, literal case-sensitive `<token>-` slug prefix,
  exactly one token occurrence, lowercase kebab suffix, and 60-character limit.
  Never match substrings, normalize spelling, infer provider semantics, or use
  remote refs. The delimiter is lexical: `fix/84-extra-work` can satisfy token
  `84` or token `84-extra`; no branch name alone encodes the provider's identity.
  Invalid tokens or failed enumeration refuse without mutation or a zero-count
  claim. This operation is distinct from a bounded general branch listing.
- **GW-TB8 — Guarded creation.** Immediately before preparing a missing exact
  name, repeat complete token discovery. Any match refuses creation and returns
  the candidates for caller selection, without branch or worktree mutation.
  An explicitly bound existing name remains eligible for exact preparation,
  including an explicit choice among multiple matches. The capability does not
  silently replace a supplied name or choose among candidates. This inspection
  is not a repository lock against concurrent actors after the check.

### Non-goals

Choosing among several plausible branches, determining ticket identity,
classifying dirty-work ownership, committing, pushing, pull-request creation,
implicit worktree allocation, or changing an existing branch tip.

## create-pr

### Intent triggers

"open a PR", "create a pull request", "PR this", "push and open a PR",
or an explicit skill invocation.

### Contract

Create exactly one pull request from the current branch into a deliberate
base, with a Conventional Commit title and a context-rich body derived from
the branch's commits (and ticket, when one is known). Push the branch (with
upstream) first if needed. Draft only when the user asks for a draft.

Every successful creation or explicitly authorized reuse returns the canonical
PR URL and a complete verified publication record: repository, head, base,
draft state, intended commit, remote branch commit, forge PR-head commit and
whether a push occurred. Success requires all three full commit identities to
agree after the operation.

The complete publication record is a machine-facing verification artifact.
The user-facing success report is concise: link the PR, state its base and
draft state, name the verified commit once, and mention excluded local work or
material notes. Expand repository, head and mutation details only when requested
or needed to explain uncertainty. Never summarize an incomplete observation as
verified publication.

### Invariants

- **GW-P1 — Conventional title.** The PR title follows the Conventional
  Commit subject rules (same types as commits, ≤ 72 chars, imperative, no
  trailing period) and summarizes the whole branch, not just the last commit.
- **GW-P2 — Context-rich body.** The body states why the change exists and
  what it does, derived from the branch commits; a known ticket id is
  referenced verbatim. No filler; no boilerplate checklists unless the
  repo's PR template asks for them (GW-P8).
- **GW-P3 — No AI attribution.** No "Generated with ..." lines, no AI
  co-author credits, no tool emoji in title or body.
- **GW-P4 — Deliberate shape.** Base is the repo's default branch unless the
  user names one; draft only when the user asks. Both are stated in the
  report. Head and base are never the same — on the default branch there is
  no PR to make; report that and stop.
- **GW-P5 — Push without rewrite.** The branch is pushed (upstream set when
  missing) before the PR is created. Never force-push; a refused push is
  relayed verbatim and stops the workflow. Ordinary creation publishes only the
  fully qualified current branch to the same fully qualified branch on origin;
  Git push mappings must not redirect it, and implicit tag publication is disabled.
- **GW-P6 — One PR, no duplicates.** Ordinary creation reports an existing open
  PR without pushing. Explicit authority to publish to/reuse that PR permits
  the separate reuse operation, never a duplicate or metadata update.
- **GW-P7 — Committed work only.** The PR proposes committed work.
  Uncommitted changes are reported, never committed or stashed to "complete"
  the PR. Inspection, readiness, commit context, diffstat, and creation all use
  the same selected base, including an explicitly named non-default base. An
  unavailable named base refuses without falling back to the default branch.
  No commits ahead of the selected base → report, stop.
- **GW-P8 — Template respected.** When the repo defines a PR template
  (`PULL_REQUEST_TEMPLATE.md` in `.github/`, the repo root, or `docs/`),
  the body follows it: headings kept verbatim, every section filled with
  real content from the branch, instructions in HTML comments followed and
  the comments removed. The template defines the body's shape and overrides
  the default why/what structure. With multiple templates
  (`.github/PULL_REQUEST_TEMPLATE/`), the user either names an exact template
  or explicitly delegates the choice. A request merely to open a PR does not
  delegate it. When delegated, choose from the branch's change and report the
  selected filename and reason. If no template fits the change, ask the user.
  Without a named template or delegation, ask before pushing or creating a PR;
  never silently pick one.
- **GW-P9 — Verified publication.** An authorized reuse requires the intended
  full commit ID and verifies exactly one open same-repository PR with the
  expected head, base and draft state before pushing. Push only that commit to
  the same branch without force. Read-only verification proves both the remote
  branch and forge head equal the intended commit. A mismatch, ambiguous PR,
  unavailable check or changed local head refuses completion and reports any
  push already performed. The same verification is available after creation.
- **GW-P10 — Verified creation result.** Creation observes the newly created PR
  and remote branch after `gh pr create` and returns the same verified result
  contract as reuse. A URL or successful command exit alone is not completion.
  If creation or push has occurred but observation fails, report the known
  effects and uncertainty without creating another PR.
- **GW-P11 — Bounded propagation observation.** When the remote branch already
  equals the intended commit but the forge reports another valid full commit,
  allow at most five observations, one second apart. Pin the first observed PR
  number and URL and recheck the local branch and commit before each observation.
  A changed identity, shape, unavailable observation, malformed commit, or remote
  movement refuses immediately. The observation loop never pushes or creates a
  PR; timeout preserves the known mutation effects and reports incomplete
  verification. Initial reuse preflight still requires remote/forge agreement
  before deciding whether a push is necessary.

### Non-goals

Merging or auto-merge, assigning reviewers/labels/milestones, editing existing
PR metadata or closing PRs, creating tickets, authoring or editing PR templates,
committing (see create-commit), branching (see create-branch), pushing the
default branch.

## publish-pr-evidence

### Intent triggers

"publish this evidence to the PR", "attach these screenshots to the pull
request", "post verification evidence on this PR", or an enclosing contract
that explicitly authorizes one evidence publication against its exact PR and
verified commit.

### Contract

Publish one candidate-bound, top-level PR conversation comment with an optional
ordered attachment set. Text-only evidence is valid. This is a focused
publication operation, not generic PR commenting, file hosting, or inline
review.

### Invariants

- **GW-E1 — Exact candidate and authority.** Input supplies the prepared body,
  expected full PR-head commit, and optional attachment paths in presentation
  order. Before mutation resolve exactly one open same-repository PR for the
  current branch, its canonical URL and current full head. Refuse unless the
  observed head exactly equals the expected head. Recheck the head around the
  publication attempt; a change invalidates completion.
- **GW-E2 — Complete preflight.** Feature-detect `gh pr comment --attach` and
  supported GitHub-host behavior before mutation. Validate the entire
  attachment set first: at most 50 distinct readable non-empty regular files;
  PNG, JPEG, GIF, WebP and SVG images are at most 10 MiB each; MP4, MOV and WebM
  videos are at most 100 MiB each. Reject missing, unreadable, empty, duplicate,
  unsupported or oversized inputs. If the active supported CLI advertises a
  stricter limit, refuse instead of risking a partial upload.
- **GW-E3 — Presentation rules.** Every image has meaningful caller-supplied
  alt text and every video has a caller-supplied textual explanation. Attachments
  retain caller order. The prepared comment body records that presentation
  metadata without exposing temporary paths.
- **GW-E4 — Path-independent identity.** A deterministic identity binds the
  repository, PR number, expected full head, exact prepared body, ordered
  attachment content identities, media types and presentation metadata.
  Temporary path spelling is not part of that identity.
- **GW-E5 — Reconcile before mutation.** Observe top-level PR conversation
  comments before publication. Exactly one complete identity match returns
  `existing`; an incomplete match returns `partial`; conflicting or
  unclassifiable matching state returns `ambiguous`; otherwise one authorized
  `gh pr comment` invocation publishes the body and all attachments in caller
  order. Duplicate prevention never relies on command exit status alone.
- **GW-E6 — Bounded outcomes.** Return exactly `published`, `existing`,
  `partial`, `ambiguous`, or `refused`, with repository, canonical PR URL,
  expected and observed full heads, identity, intended and observed attachment
  identities, known comment URL, stage, command/effects and uncertainty where
  applicable. After the invocation reconcile observable comments before
  claiming `published`.
- **GW-E7 — Preserve uncertain effects.** A partial or ambiguous result stops
  without retry, edit, delete, replacement, URL reuse or recovery. Recovery
  requires fresh explicit authority. Preserve every local and remote effect.
- **GW-E8 — Evidence stays external.** The operation proves no evidence file is
  staged, committed, copied into the repository or deleted. It does not retain
  or clean caller files. Temporary evidence paths may remain for inspection.

### Non-goals

Generic PR comments, issue comments, reviews or inline annotations; arbitrary
file hosting; modifying or deleting comments; retry/recovery; committing
evidence media; changing PR metadata or head content.
