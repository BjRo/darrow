---
name: implement-ticket
description: Implement one approved ticket-pipeline plan in the authorized local working tree, preserving pre-existing user work and returning exact final-tree evidence. Use only when explicitly invoked by deliver-ticket for the implement phase or when the user supplies a complete implement-phase packet.
---

# Implement an approved ticket

Turn the approved plan into a verified local-tree change. This phase writes
product files but neither reviews nor publishes the result.

## Working model

- **Approved contract:** the ticket outcome and criteria, latest completed
  refine artifact, and matching approved challenge artifact together define
  scope. The plan may leave incidental coding choices open; it may not delegate
  a product, safety, or authority decision to the implementer.
- **User-work baseline:** every pre-existing path and fingerprint in the packet
  is user-owned. Preserve its content, mode, and index state exactly.
- **Final-tree evidence:** a command result proves only the tree on which it
  actually ran. Rerun affected evidence after the last product edit.

## Workflow

### 1. Validate the handoff before editing

Read the current ticket-body snapshot, latest refine artifact, matching
challenge artifact, user-work baseline, applicable repository instructions,
and accepted decisions. Require the challenge to be approved and the packet's
write boundary to be `local_worktree` for this absolute repository.

Compare current pre-existing paths with the persisted baseline. Treat a new
overlapping change or a plan that would overwrite, stage, unstage, clean,
reset, revert, or otherwise disturb user work as `needs_human`. Also stop
`needs_human` when the approved plan is stale or leaves a material product,
safety, migration, permission, privacy, or external-state choice unresolved.
Use `blocked` for unreadable required inputs.

**Complete when:** scope, acceptance criteria, authorized paths, user-owned
paths, applicable guidance, and required engineering discipline are concrete,
or the phase has stopped before edits with the exact missing decision/evidence.

### 2. Implement only the approved behavior

Follow any engineering discipline named by the ticket or plan. Otherwise use
the shortest reliable sequence that preserves the repository's established
design. Make the smallest coherent product and test changes that satisfy the
approved criteria.

You may choose local implementation details that do not alter observable
behavior, safety, scope, or the plan's verification strategy. Do not add
unrequested features, speculative abstractions, cleanup unrelated to the
ticket, or “helpful” publication/configuration changes. If current code makes
the approved plan impossible without expanding scope or changing its contract,
stop `needs_human` instead of silently redesigning it.

Do not edit the ticket, run review/QA/codify, create or switch branches or
worktrees, stage files, commit, push, open a pull request, merge, release,
deploy, or mutate external state.

**Complete when:** each approved criterion is implemented through its intended
public seam, affected durable tests exist, no unapproved path or behavior was
changed, and all baseline fingerprints remain intact.

### 3. Prove the final tree

Run the plan's focused commands plus every applicable repository lint,
typecheck, test, build, and task-specific gate. Use each exact documented
command; do not weaken, replace, or omit a gate to obtain green output. After
any fix, rerun every affected command.

Classify non-passing evidence precisely:

- unavailable command, dependency, configuration, or environment required for
  proof: `blocked`;
- proven pre-existing failure outside authorized paths that prevents a
  required clean gate: `blocked`, with before/after evidence and no repair;
- in-scope behavior or gate still failing after the bounded implementation
  attempt: `failed`;
- new material decision or collision with user work: `needs_human`.

Use `complete` only when every acceptance criterion is implemented, all
runnable applicable gates pass on the latest tree, and preserved work still
matches its baseline. Never label a command passed when it did not run.

**Complete when:** every criterion and applicable gate has an exact final-tree
result, and the phase status follows mechanically from those results.

### 4. Write the phase artifact

**Artifact contract:** Before writing, read
`<skill-dir>/../../config/phase-artifact.md` completely. Write exactly one
artifact to the packet's absolute output path, copying its run ID, phase,
iteration, and agent fields exactly.

Include:

- `### Changed files` — every changed absolute path and its approved purpose;
- `### Acceptance implementation` — each ticket criterion mapped to the
  observable implementation and durable test/evidence;
- `### Gates` — each literal command, status, and concise observed result;
- `### Remaining risks` — honest residual risk, preserved pre-existing
  failures, or `None observed`.

For `needs_human`, `blocked`, or `failed`, keep the same headings and name the
exact stopping condition and smallest next action. Do not change product files
after recording final evidence.

**Complete when:** the artifact validates against the shared contract, matches
the latest tree and status, reports only observed evidence, and the response
names its absolute path without claiming review, QA, or publication.
