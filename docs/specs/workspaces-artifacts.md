# Specification: Workspaces and Artifacts

Defines repository-local Darrow state, concurrent Git workspaces, immutable
artifacts, ticket publication, retention, and cleanup.

Read [workflow runtime](workflow-runtime.md) for execution semantics and
[observability](observability.md) for journals, transcript content, and export.

## Canonical repository state

- **WA-1 — One repository home.** Every repository-specific Darrow file lives
  under the canonical `.darrow/` directory in the primary Git worktree. Darrow
  resolves the primary worktree from Git's worktree list rather than treating a
  linked worktree's top-level directory as the repository home.
- **WA-2 — Shared across linked worktrees.** Every Darrow process started from a
  linked worktree resolves the same primary `.darrow/`. It does not create an
  independent state directory in that linked checkout.
- **WA-3 — Explicit initialization.** `darrow init` creates or repairs the
  layout. `darrow run` and other commands never initialize silently.
- **WA-4 — Idempotent tracked configuration.** Initialization updates
  `.gitignore` and `.gitattributes` idempotently, preserves existing rules, and
  does not commit.

The initial layout is:

```text
.darrow/
  project.yaml                 # project configuration; versioned
  workflows/                   # project workflow sources; versioned
  tickets/                     # explicitly published ticket artifacts; versioned when chosen
  runs/                        # run records, snapshots, content and artifacts; ignored
  locks/                       # short-lived allocation coordination; ignored
  runtime/                     # local Temporal and worker state; ignored
  worktrees/                   # managed linked worktrees; ignored
```

- **WA-5 — Required ignore rules.** `darrow init` ensures `.darrow/runs/`,
  `.darrow/locks/`, `.darrow/runtime/`, and `.darrow/worktrees/` are ignored.
  It does not ignore `.darrow/project.yaml`, `.darrow/workflows/`, or
  `.darrow/tickets/` as a whole.
- **WA-6 — Ticket diff classification.** `darrow init` ensures this attribute is
  present without overriding a more specific existing rule:

  ```gitattributes
  .darrow/tickets/**/artifacts/** linguist-generated
  ```

  This affects GitHub diff presentation and language statistics; it does not
  make the content disposable or unreviewable.

## Managed worktrees

- **WA-7 — Exclusive workspace ownership.** A mutating run owns one linked
  worktree exclusively for its lifetime. An attached current worktree is allowed
  only through an explicit caller choice and is then exclusively owned by that
  run.
- **WA-8 — Default managed path.** A managed worktree defaults to:

  ```text
  .darrow/worktrees/<run-id>/
  ```

  Darrow reports its absolute path in model-facing and machine-readable output.

- **WA-9 — Exact custom path.** An explicitly requested worktree path is used
  exactly or rejected. Darrow never invents a substitute. An existing path is
  never reused or overwritten. A custom path inside the primary checkout must
  already be ignored; otherwise Darrow refuses with an actionable instruction.
  A path outside the checkout requires no Git ignore rule.
- **WA-10 — Pinned base.** Worktree creation uses a pinned commit. A managed
  worktree may begin detached at that commit. Creating and naming a Git branch is
  a later explicit workflow or capability action, not an implicit worktree side
  effect.
- **WA-11 — Dirty checkout choice.** If the invoking checkout has staged,
  unstaged, or untracked changes and the caller did not select `--base` or
  `--workspace current`, Darrow returns `waiting_for_input` with these choices:
  start from the pinned `HEAD` while leaving changes untouched, attach the
  current worktree exclusively, or abort.
- **WA-12 — No silent local-change transfer.** Darrow never copies, stashes,
  commits, resets, discards, or selectively excludes invoking-checkout changes to
  make a managed worktree start.
- **WA-13 — Dedicated, not sandboxed.** Linked worktrees separate filesystem and
  Git work state. They are not a security boundary; the harness environment owns
  sandboxing and permissions.

## Concurrent Darrow processes

- **WA-14 — Repository concurrency.** Two or more Darrow processes may advance
  independent runs against the same repository. Darrow does not hold a
  repository-wide lock for a run's duration.
- **WA-15 — Allocation coordination only.** Short-lived coordination under
  `.darrow/locks/` serializes run-ID, worktree-path, attached-workspace, and branch
  ownership allocation. A process releases the allocation lock before agent work
  begins.
- **WA-15a — Persistent workspace ownership.** Managed and attached workspaces
  receive a repository-local ownership record while the allocation lock is held.
  The record is visible to later Darrow processes before the lock is released,
  identifies exactly one run and absolute workspace path, and is removed only by
  that run at a terminal boundary. A restart may recover the run's workspace from
  this record; it never adopts another run's workspace.
- **WA-16 — Independent run state.** Each run has its own plan, attempts,
  artifacts, worktree, and conclusion. Failure or cancellation of one process
  cannot cancel, clean, or mutate another run.
- **WA-17 — Explicit integration.** Merge, rebase, cherry-pick, pull-request
  creation, or other integration between work streams is a declared command or
  capability action. Darrow does not integrate runs implicitly.

## Run-local artifacts

- **WA-18 — Immutable attempt path.** Every step attempt writes artifacts under:

  ```text
  .darrow/runs/<run-id>/artifacts/<step-id>/<attempt-id>/
  ```

  A later attempt never overwrites an earlier path.

- **WA-19 — Typed reference.** An artifact reference contains a stable artifact
  ID, type, schema identity and digest, content hash, size, producer step and
  attempt, repository-relative or content-store location, and creation time.
- **WA-20 — Checkpoint boundary.** Mutable files in a worktree are not artifacts
  until a step checkpoints them into an immutable artifact path and records the
  reference.
- **WA-21 — Content outside workflow history.** Source snapshots, diffs,
  transcripts, model responses, logs, test output, and patches remain in the
  repository-local content/artifact store. Temporal history receives only the
  bounded structured data and references required for control flow.
- **WA-22 — Schema source is local.** Artifact schemas ship with the engine,
  plugin, or workflow pack that owns them. The resolved schema is copied into the
  run snapshot and locked by version and digest. Local execution requires no
  remote schema registry.

## Run snapshot

- **WA-23 — Self-contained execution inputs.** Before execution, Darrow copies
  the resolved workflow, command and capability skill directories, bundled
  scripts, command and artifact schemas, and Darrow metadata into:

  ```text
  .darrow/runs/<run-id>/snapshot/
  ```

- **WA-24 — Immutable snapshot.** Snapshot content is content-addressed or
  otherwise write-protected by verification. Resume verifies digests before
  executing another attempt. Plugin, workflow, or marketplace updates affect new
  runs only.
  Initial execution, continuation, resume, and inspection validate the lock,
  plan digest, snapshot manifest, workflow, profile, schema tree, command, and
  capability digests. Artifact inspection recomputes each content hash.
- **WA-25 — External binaries recorded, not copied.** Darrow records engine,
  adapter, harness, provider, model, and native permission provenance but does
  not copy their binaries or model weights. If no compatible runtime is
  available, the run waits instead of silently substituting one.

## Ticket artifact publication

- **WA-26 — External ticket record.** A ticket is an external tracker record.
  `.darrow/tickets/` contains only published artifacts and metadata; it is not a
  ticket backend.
- **WA-27 — Repository-unique ticket key.** The publication key is stable and
  repository-unique across backend, tracker project, and native ticket ID. Its
  metadata records all three components and the canonical ticket URL. The local
  implementation derives the key from the three identity components, not from
  the URL, so a URL presentation change cannot silently create a second ticket
  workspace.
- **WA-28 — Publication layout.** Published artifacts use:

  ```text
  .darrow/tickets/<ticket-key>/
    ticket.json
    artifacts/
      <step-id>/
        <attempt-id>/
          <artifact>
  ```

- **WA-29 — Explicit publication.** A run-local artifact enters a ticket
  workspace only through a declared publication step. Workflows without a ticket
  or publication step keep artifacts run-local. The local workflow declaration
  attaches `publish` to a command step outside any retry loop, locks the resolved
  ticket identity and a nonempty set of artifact types, and publishes matching
  artifacts only after that attempt succeeds. A declared type that the attempt
  did not produce fails the publication instead of silently publishing a partial
  selection. Repeating the same publication is idempotent; conflicting metadata
  or content is refused. Publication never mutates the external ticket, commits,
  pushes, or rewrites history.
- **WA-30 — Learning summary.** A delivery workflow may publish a compact summary
  of decisions, outcomes, failed approaches, and lessons for cross-ticket
  reasoning. Publishing the summary does not require retaining every raw
  intermediate artifact.

## Retention and cleanup

- **WA-31 — No background deletion.** The local product performs no background,
  startup-time, shutdown-time, or opportunistic artifact or worktree garbage
  collection.
- **WA-32 — Report before delete.** `darrow clean` without a deletion selection
  lists eligible worktrees and artifacts with their run state, age, size,
  reference status, and proposed action. `--run-data`, `--worktrees`, and
  `--tickets` are the deletion selections; `--run` and `--older-than` filter
  either a report or a selection. Ticket age is the publication time. Darrow
  validates every matching selected resource before deleting any of them and
  refuses the entire selection when one is protected.
- **WA-33 — Active references protected.** An artifact, snapshot, content item,
  worktree, or ticket artifact referenced by an active run is not eligible for
  deletion.
- **WA-34 — Run-local eligibility.** Run-local artifacts and snapshots are
  eligible only after their run is terminal and no active run references them.
  `--run-data` selects the run's artifacts, snapshot, content, and normalized
  command results while retaining its plan, lock, run record, audit journal, and
  cleanup record. A terminal run remains inspectable after those selected bodies
  are removed.
- **WA-35 — Safe worktree removal.** A managed worktree is eligible only after
  its run is terminal and it is clean, or after Darrow can prove every remaining
  change was checkpointed and the explicit cleanup selection includes it. Darrow
  refuses uncheckpointed dirty state. The local M2 implementation conservatively
  refuses every dirty managed worktree; checkpoint-proof deletion remains a
  compatible future expansion. Cleanup never deletes a Git branch and never
  removes an attached current workspace.
- **WA-36 — Ticket purge is a working-tree change.** `darrow clean --tickets`
  may delete old checked-in ticket artifacts that are not protected by an active
  run. A ticket artifact is eligible only when its source run is locally known
  and terminal, its content still matches the publication digest, and both its
  body and `ticket.json` have no pre-existing staged, unstaged, or untracked
  changes. Each publication is a cleanup resource; removing it also removes its
  record from `ticket.json`, retaining the ticket identity when no publications
  remain. The resulting deletion and metadata update remain ordinary
  uncommitted working-tree changes for user review. Darrow never commits,
  pushes, rewrites history, or mutates the external ticket.
- **WA-37 — No remote store dependency.** Configurable automatic retention and a
  remote artifact store are deferred to hosted operation. Local cleanup and
  resume do not require either.
