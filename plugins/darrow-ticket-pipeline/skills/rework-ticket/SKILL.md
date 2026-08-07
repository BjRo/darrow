---
name: rework-ticket
description: Repair the bounded blocking findings from one ticket-pipeline review or QA failure, preserving unrelated work and rerunning affected checks. Use only when explicitly invoked by deliver-ticket for the rework phase or when the user supplies a complete rework-phase packet with mode review or qa_fix.
---

# Rework a ticket change

Repair only the root causes named by the supplied review or QA artifact. This
phase writes the local tree but does not decide whether the repaired change is
approved or passed.

## Working model

- **Review mode:** address blocking findings from the latest
  `changes_requested` review artifact.
- **QA-fix mode:** address reproducible acceptance or gate failures from the
  latest `failed` QA artifact.
- **Bounded repair:** the smallest coherent code/test/configuration change that
  closes a named root cause without expanding ticket behavior or opportunistic
  cleanup.
- **Downstream authority:** a fresh review or QA owns the next verdict. Rework
  may record evidence but never approve its own repair.

## Workflow

### 1. Validate repair authority and scope

Read the packet's mode, current ticket-body snapshot, approved refine and
challenge artifacts, current full diff, implementation/prior rework artifacts,
named latest review or QA artifact, pre-existing-work baseline, applicable
repository instructions, and accepted decisions. Require `local_worktree` as
the write boundary for this absolute repository.

For `review` mode, require the named review status to be
`changes_requested`. For `qa_fix`, require the named QA status to be `failed`.
Extract every blocking finding/failure, exact evidence, violated criterion or
rule, and requested root-cause correction. Advisory observations are not repair
scope unless the same change is necessary to close a blocker.

Compare current user-owned paths with the persisted baseline. An overlap,
stale artifact, missing required evidence, or mismatch between mode and source
artifact stops before edits: use `needs_human` for a material conflict/choice
and `blocked` for unreadable evidence or unavailable required tooling.

**Complete when:** every authorized blocker is enumerated, repair scope and
non-goals are explicit, and user-owned paths are protected before the first
write.

### 2. Repair each root cause

Reproduce or inspect each blocker through its named public seam before changing
the tree. Apply the smallest repair that satisfies the approved ticket contract
and repository guidance. Update durable tests when the finding exposes missing
coverage; do not weaken expectations, delete failing coverage, narrow the
ticket, or special-case only the reported example when the criterion is
broader.

Do not silently dismiss or downgrade a blocking finding. If current unchanged
tree evidence proves it was already resolved, record `already_resolved` with
the exact proof and make no gratuitous edit. If the finding is incorrect,
contradicts authoritative evidence, requires destructive work, or demands a
material product/safety/authority decision, stop `needs_human` with the exact
conflict for the controller.

Preserve unrelated current changes and every baseline fingerprint. Do not edit
the ticket, perform the next review/QA, codify, create or switch branches or
worktrees, stage, commit, push, open a pull request, merge, release, deploy, or
mutate external state.

**Complete when:** each blocker is repaired or proven already resolved, every
changed path is necessary to that root cause, and no unrelated or user-owned
work changed.

### 3. Prove the repair on the final tree

Run a focused reproduction for every disposition, then every repository gate
affected by the repair. Use literal commands from authoritative sources and
rerun affected evidence after the last edit. Do not replace a required command
or report an unrun gate as passed.

Classify the result:

- `blocked` when required evidence, tooling, configuration, or environment is
  unavailable;
- `needs_human` for a finding conflict, user-work collision, destructive step,
  or new material decision;
- `failed` when an authorized bounded repair was attempted but a named blocker
  or affected gate still fails;
- `complete` only when every blocker is repaired/already resolved and all
  affected gates pass.

`complete` authorizes only the controller's fresh downstream review or QA; it
does not mean the ticket is verified.

**Complete when:** every disposition has current-tree command evidence, status
follows from it, and baseline/unrelated work remains intact.

### 4. Write the phase artifact

**Artifact contract:** Before writing, read
`<skill-dir>/../../config/phase-artifact.md` completely. Write exactly one
artifact to the packet's absolute output path, copying its run ID, phase,
iteration, and agent fields exactly.

Include:

- `### Finding dispositions` — each source finding/failure as `repaired`,
  `already_resolved`, `unresolved`, or `escalated`, with root cause and evidence;
- `### Changed files` — every changed absolute path and the finding it repairs;
- `### Gates` — literal focused and affected commands with observed results;
- `### Remaining risks` — residual uncertainty or `None observed`.

**Complete when:** the artifact validates against the shared contract, matches
the latest tree and mode, accounts for every supplied blocker, and the response
reports its absolute path without claiming downstream approval, QA, or
publication.
