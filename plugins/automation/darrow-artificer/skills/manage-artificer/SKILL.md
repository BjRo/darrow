---
name: manage-artificer
description: Manage local Artificer only when explicitly invoked to configure, schedule, inspect, pause, revoke, cancel, or recover nominated GitHub ticket delivery. Never select for ordinary implementation, tickets, pull requests, scheduling discussion, or background-work requests.
disable-model-invocation: true
---

# Manage local Artificer

Use the bundled frozen command for one explicitly requested local operation.
Artificer admits nominated issues; a task recipe and its original native Codex
owner perform the engineering. This entry never implements a ticket itself.

## 1. Establish the requested operation

Require explicit invocation. Determine the operation and absolute installation
state path. If either is missing, ask for that input before changing anything.
For status, use only the read-only status command and report delivery IDs, issue
numbers, current state and the smallest needed action.

For enabling or changing a schedule, read [operations](references/operations.md).
Establish the exact repository, controlling checkout, ticket scope (explicit
IDs or all authorized `artificer:ready` nominations), recipe, grantor, permitted
effects, credential location and independently installed delivery plugins. Explain
that the grant persists until revoked. Require explicit authority for recurring
claims, question comments, worktrees, intended commits, non-force pushes and one
verified PR per delivery. Never infer this grant from a request to implement
one ticket, inspect status, or explain automation.

The initial host is macOS with Codex CLI 0.154.0, UV, Git and GitHub CLI.
ChatGPT login must be persistent. Require confirmation that the account has no
paid credit balance or automatic credit reload; never purchase credits, switch
to an API key, or infer that subscription login alone proves zero extra cost.
If necessary authority or account evidence is missing, ask for it and stop.

**Complete when:** the exact operation, installation and its required authority
are known. Read-only status requires no new recurring grant.

## 2. Run the bounded command

Let `<skill-dir>` be the absolute directory containing this file. The package is
at `<skill-dir>/../../backend`. Invoke:

```text
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-artificer --state <absolute-state-path> <operation>
```

Use [operations](references/operations.md) for exact arguments. Run only the
requested operation. A configured installation does not authorize enabling its
schedule unless recurring operation was requested. Creating this plugin does
not enable it in the development repository.

An individual cancellation requires its exact delivery ID. If ambiguous, show
the status mapping and ask which delivery. `WORK_IN_PROGRESS_LIMIT=0` pauses new
admissions but permits outstanding replies and completion. Revocation stops
subsequent admissions and continuations; neither operation cancels running
deliveries. Cancellation preserves claims and published effects.

Never clear a claim, reapply readiness, relaunch a delivery, or invent a fresh
owner to resolve failure. Recovery requires the original parent and owner,
authoritative reconciliation of existing execution/worktree/branch/PR effects,
and an explicit human instruction. Treat a failed command as potentially
partially applied. Inspect its reported local state before proposing any retry.

**Complete when:** the command has an observed result or a precise failure with
partial effects retained. No prohibited recovery or unrelated operation ran.

## 3. Report the result

Lead with the observed outcome and next action. Include the absolute state
path, affected repository and delivery/issue IDs, effective limits or schedule
when changed, and any needs-attention reason. Preserve the exact reply syntax
when a human answer is pending. Never present an admission, question, open PR,
archive save, or mock test as completed ticket delivery.

After revocation, state that future admissions and continuations are disabled;
existing execution and published effects were not cancelled or undone.

**Complete when:** the user can identify what changed and what remains, without
an unsupported claim of native restoration, zero extra cost, or delivery success.
