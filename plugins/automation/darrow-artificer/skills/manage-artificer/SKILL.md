---
name: manage-artificer
description: Manage local Artificer only when explicitly invoked to configure, schedule, inspect, pause, revoke, cancel, or recover nominated GitHub ticket delivery. Never select for ordinary implementation, tickets, pull requests, scheduling discussion, or background-work requests.
disable-model-invocation: true
---

# Manage local Artificer

Manage one local worker through its bundled frozen command. One worker admits
one ready ticket at a time and wraps one native Claude Code or Codex session.
The task recipe, Adaptive Goal, verification and review own engineering.
Other plugins are optional and remain the session's concern.

## Establish the operation

Require explicit invocation, a requested operation and an absolute worker state
path. Ask for missing inputs before mutation. For `status`, use only the read-only
command and report its worker/ticket/session mapping, PRs, blockers and next actions.

For setup or scheduling, read [operations](references/operations.md). Establish
the repository, controlling checkout, selected host, writer grantor, ticket scope
and recurring authority. Explain allowed recurring reads, claims, blocker reports,
worktrees, recipe invocation, scoped commits, non-force pushes and one verified PR
per delivery. Never infer that grant from an ordinary implementation request.
The grant persists until revoked. Installation alone enables nothing.

The first version runs locally on macOS with the host's existing profiles,
plugins and login. Account usage follows that configuration; do not promise zero
additional cost, change billing/authentication or buy credits. Missing required
authority stops setup. Workers in the same repository share host selection and
WIP, but each worker has its own state path and revocation.

## Execute the bounded command

Let `<skill-dir>` be the directory containing this file. Invoke:

```text
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-artificer --state <absolute-worker-state> <operation>
```

Use the linked operations reference for exact arguments. Execute only the
requested operation. Scheduling needs recurring authority; creating or installing
this plugin does not authorize a live installation in the development repository.

Shared WIP counts running reservations and open Artificer PRs once, excluding
unrelated PRs. WIP zero pauses admission while permitting reconciliation.
Each worker runs one active ticket; add workers for parallel delivery.

Recoverable technical interruptions resume the original native session at most
twice per interruption. Useful native progress resets the budget; restart alone
does not. Missing product intent stops for preparation outside Artificer, with a
source-issue blocker report. Do not start discovery or an issue-comment reply loop.

Cancellation requires the exact delivery ID. Revocation disables that worker's
future admissions and continuations; it does not cancel existing execution.
Neither operation undoes published effects. A failed command may be partially
applied: inspect its evidence before retrying.

Recovery requires the original session ID and reconciliation of existing effects.
Never create a fresh owner to recover a delivery or clear an uncertain claim to
manufacture capacity. Use native storage/resume, not copied archives. If native
state or execution/publication evidence is unavailable, retain ownership and
explain the required human reconciliation. Legacy installations are refused;
do not silently convert, delete, relaunch or release their records.

## Report the result

Lead with the observed outcome and next action. Include the absolute state path,
repository and affected delivery/ticket IDs. Report changed shared WIP or schedule,
native session and recovery attempts when relevant. A reservation, open PR or mock
result is not verified completed delivery.

After revocation, state that future admissions and continuations are disabled
for this worker, while existing execution and published effects remain.
After a recovery failure, identify the retained claim and explain that a human
must reconcile original execution and effects before another recovery attempt.
