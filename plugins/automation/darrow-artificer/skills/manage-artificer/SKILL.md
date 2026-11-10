---
name: manage-artificer
description: Manage local Artificer only when explicitly invoked to configure, schedule, inspect, pause, revoke, cancel, or recover nominated GitHub ticket delivery. Never select for ordinary implementation, tickets, pull requests, scheduling discussion, or background-work requests.
disable-model-invocation: true
---

# Manage local Artificer

Manage one repository installation through `darrow-artificer`. Its configured
worker pool admits ready tickets, each in one native Claude Code or Codex session.
The task recipe, Adaptive Goal, verification and review own engineering.
Other plugins are optional and remain the session's concern.

## Establish the operation

Require explicit invocation and a requested operation. Discover the installation
from the current checkout; an absolute `--state` override is optional. For `status`, use only the read-only
command and report its worker/ticket/session mapping, PRs, blockers and next actions.

For setup or scheduling, read [operations](references/operations.md). Establish
the repository, checkout, selected host, writer grantor and ticket scope.
First `init` authorizes recurring unattended delivery; no extra authorization
flag or separate account-usage acceptance is required. Explain allowed recurring reads, claims, blocker reports,
worktrees, recipe invocation, scoped commits, non-force pushes and one verified PR
per delivery. Never infer that grant from an ordinary implementation request.
The grant persists until revoked. Installation alone enables nothing.

Artificer runs locally on macOS with the selected host's default profile
(`~/.codex` or `~/.claude`), plugins and login, or an explicit profile directory
chosen at `init`. Ignore ambient `CODEX_HOME` and `CLAUDE_CONFIG_DIR` defaults.
Use the saved host; when absent, ask for it rather than detecting the invoking app. Account usage follows that configuration; do not promise zero
additional cost, change billing/authentication or buy credits. Missing required
authority stops setup. Workers in the same repository share host selection and
profile and WIP, with one state directory and repository-wide revocation.

## Execute the bounded command

After initialization, invoke from any checkout or worktree:

```text
darrow-artificer <operation>
```

For first initialization, use the bundled frozen entrypoint documented in
[operations](references/operations.md); it installs `~/.local/bin/darrow-artificer`.
For an existing installation, rerun `init` to repair the command; omitted settings
reuse its saved context without changing or reauthorizing the grant. On macOS,
PATH setup supports zsh and Bash. Preview the shell-file destinations and obtain
the user's choice before passing `--setup-path` from an agent's noninteractive
command, unless the user already explicitly requested PATH integration. Preserve
shell settings and use only `~/.local/bin`; do not choose a Homebrew directory.
Declining PATH integration still permits initialization. Explain opening a new
terminal or sourcing the printed file. Use the reference for exact arguments. Execute only the
requested operation. Scheduling needs recurring authority; creating or installing
this plugin does not authorize a live installation in the development repository.

Shared WIP counts running reservations and open Artificer PRs once, excluding
unrelated PRs. WIP zero pauses admission while permitting reconciliation.
Each worker runs one active ticket; use `configure --workers N` for parallel delivery.

Recoverable technical interruptions resume the original native session at most
twice per interruption. Only successful completion of a native turn resets the
budget; tool success or restart alone does not. This measures execution recovery,
not retries of engineering operations within a healthy turn.
Missing product intent stops for preparation outside Artificer, with a
source-issue blocker report. Do not start discovery or an issue-comment reply loop.

Cancellation requires the exact delivery ID. Revocation disables the installation's
future admissions and continuations; it does not cancel existing execution.
Neither operation undoes published effects. A failed command may be partially
applied: inspect its evidence before retrying.

Recovery requires the original session ID and reconciliation of existing effects.
Never create a fresh owner to recover a delivery or clear an uncertain claim to
manufacture capacity. Use native storage/resume, not copied archives. If native
state or execution/publication evidence is unavailable, retain ownership and
explain the required human reconciliation. Legacy installations are refused;
do not silently convert, delete, relaunch or release their records.
Capacity release preserves explicit recovery eligibility for confirmed unfinished
work. Recovery must reacquire capacity and issue ownership under current authority
and refuses completed, cancelled, unknown-eligibility or conflicting deliveries.
Claude PR reports require the prepared `/goal` handoff but still lack independent
native completion evidence. Preserve their published PRs and report that gap as
needing attention; do not describe them as verified completed deliveries.

## Report the result

Lead with the observed outcome and next action. Include the absolute state path,
repository and affected delivery/ticket IDs. Report changed shared WIP or schedule,
native session and recovery attempts when relevant. A reservation, open PR or mock
result is not verified completed delivery.

After revocation, state that future admissions and continuations are disabled
for this repository installation, while existing execution and published effects remain.
After a recovery failure, identify the retained claim and explain that a human
must reconcile original execution and effects before another recovery attempt.
