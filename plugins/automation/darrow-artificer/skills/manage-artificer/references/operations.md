# Local operations

All commands use the frozen entrypoint in the skill and `--state` before the
operation. State paths are absolute and outside the working tree. Each
repository has one controlling installation bound through its common Git
directory. macOS launchd is the initial scheduler; other native hosts are not
claimed supported.

## Configure and enable

`init --repository OWNER/REPO --checkout PATH --plugin PLUGIN_ROOT ...
--credential-home PATH --authorize-recurring-delivery
--confirm-no-paid-credits-or-auto-reload`

Use one `--plugin` for each complete independently installed delivery plugin.
The selected set must advertise the ticket-to-PR recipe, adaptive delivery,
readiness, and its required Git, ticket and assurance capabilities. Artificer
copies complete runtime plugin contents into each dedicated native home; it
does not reach into sibling plugin files or install missing capabilities.
Optional `--issue NUMBER` arguments restrict admission; no issue arguments
means all authorized ready nominations in this exact repository.

Normal `codex login` must have populated `auth.json` in the credential home.
Authentication is stored separately from encrypted session archives; Codex
refreshes it. The archive key is a private `archive.key` in the state directory.
Keep that key separate when backing up or transferring `session.enc` archives.
Losing it makes those archives unusable and does not release ownership.

After an authorized init, `schedule` installs the launchd interval. The default
is 900 seconds, not a accumulated tick budget. The scheduler works while the
user is logged into macOS, independently of an open Desktop app or terminal.
`unschedule` removes that schedule. Inspect command failures before retrying;
bootstrap may have left the plist in place.

`configure --WORK_IN_PROGRESS_LIMIT N --MAX_STARTS_PER_ACTIVATION N
--SESSION_RETENTION_DAYS N --SCHEDULE_SECONDS N` updates supplied fields only.
Defaults are 1, 1, 5 and 900. WIP may be zero; other settings must be positive
integers. After changing the interval, unschedule and schedule to apply the new
launchd definition. `tick` runs one bounded activation under the same lock.

## Status, replies and cancellation

`status` returns repository, enabled state, and each delivery's issue and native
identity. `cancel DELIVERY_UUID` stops that delivery's process group and retains
its claim. `revoke` disables future admissions and continuations. These commands
do not undo GitHub effects, commits, pushes or PRs.

An authorized repository writer answers a question with an issue comment:

```text
/artificer reply DELIVERY_UUID QUESTION_UUID
The complete answer, preserved including whitespace and newlines.
```

Ordinary discussion is inert. Multiple competing authorized replies need human
resolution; do not pick one. After access is restored, a stopped delivery needs
an explicit issue comment `/artificer resume DELIVERY_UUID` before continuation.
No scheduled retry happens merely because login or subscription allowance returns.

## Recovery

Inspect the saved delivery, native process identity, worktree, branch, commits,
remote branch and PR. Do not repeat an uncertain publication. Missing or expired
archives, corrupt state and missing owner identity keep the claim occupied.

`recover DELIVERY_UUID --parent NATIVE_PARENT_UUID --owner /root/EXACT_OWNER`
binds inspected native records only after execution ends. It does not launch
anything, change the owner, release a claim, or grant new effects. An explicit
human resume comment is still required. If the original owner is unavailable,
report human recovery required; a fresh summary-driven agent is not restoration.
