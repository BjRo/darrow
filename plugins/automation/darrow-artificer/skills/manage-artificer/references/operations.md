# Local operations

Use the frozen entrypoint in the skill, with `--state` before the operation.
Worker state paths and reported paths are absolute. The repository's common Git
directory holds shared admission records and locking. Native conversation state
stays in the selected host's existing profile.

## Configure and schedule a worker

```text
init --repository OWNER/REPO --checkout PATH --host codex|claude --authorize-recurring-delivery [--issue NUMBER ...]
```

The checkout resolves to the primary repository through Git's worktree listing.
Origin must match the authorized GitHub repository. The grantor needs write
access. Omitted issue scope means all eligible writer-nominated `artificer:ready`
issues. The initial recipe is always `ticket-to-pr`.

Require that recipe, Adaptive Goal, verification and review in the host. Optional
plugins are neither required nor copied. Use the existing configured model,
authentication and plugin profile; Artificer does not select billing providers.

Run `init` with a different state path to add another worker to the same
repository. Host selection and WIP are shared. Each worker runs one ticket at a
time; an open PR can hold WIP after its worker moves on.

```text
configure [--WORK_IN_PROGRESS_LIMIT N] [--SCHEDULE_SECONDS N]
```

WIP defaults to one and accepts nonnegative integers. Zero pauses new admission.
The schedule defaults to 900 seconds and accepts positive integers. Lowering WIP
does not cancel existing deliveries. `tick` performs one admission/reconciliation
activation and starts at most one delivery for this worker.

After explicit recurring authorization, `schedule` installs a launchd interval.
`unschedule` removes it. After changing the interval, unschedule and schedule to
apply the new definition. It runs without an open terminal or Desktop. Inspect
partial launchd failures before retrying.

## Inspect, cancel and revoke

`status` shows this worker's repository, enabled state, host, shared WIP and
delivery records: issue, original session, attempts, PR, detail and next action.

`cancel DELIVERY_UUID` stops only that delivery's identified process group.
Capacity is released on reconciliation only when execution has ended and no
open delivery PR exists. Missing execution/publication evidence retains it.
Worktrees, branches and published effects are preserved.

`revoke` prevents this worker's future admissions and continuations. It does not
cancel already running work or revoke other workers.

## Native recovery

```text
recover DELIVERY_UUID --thread ORIGINAL_NATIVE_SESSION_ID
```

Inspect the original session, process group, worktree, branch and any PR first.
This explicit operation resumes that exact session; it never binds a replacement
identity. Running, released, revoked and unknown-session deliveries are refused.
Recovery also refuses another active or uncertain delivery in the same worker.
Never repeat uncertain publication or use a fresh summary-based owner.

Recovery is limited to two attempts per technical interruption, including explicit
recovery. An exhausted incident requires inspection in the original host session.
Repeated immediate failure uses the same budget. Useful native tool progress
resets it. Product/specification questions stop and are reported on the source
issue for preparation elsewhere. Source-issue comments do not resume work.

Legacy archive installations and unavailable native state require human
reconciliation. Preserve their claims, original state and effects; no archive
restoration, expiry, automatic migration or claim deletion is provided.
