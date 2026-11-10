# Local operations

Run `darrow-artificer` from any checkout or worktree of the GitHub repository.
Config, claims, locks and worker records live in
`~/.darrow/artificer/<owner>/<repo>/`, shared by independent clones. `--state`
before the operation explicitly selects a directory outside repository checkouts;
initialization records that location for later discovery. Native conversation
state stays in the selected host profile.

## Initialize and schedule

For first setup, let `<skill-dir>` be the directory containing `SKILL.md`:

```text
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" darrow-artificer init
```

In an interactive terminal, setup detects the checkout and repository, asks for
missing settings including host, shows the configuration and asks to save it.
When the agent runs the helper without a terminal, supply explicit inputs:

```text
init --repository OWNER/REPO --checkout PATH --host codex|claude [--issue NUMBER ...] [--profile-dir ABSOLUTE_PATH] [--setup-path]
```

First `init` authorizes unattended delivery and installs `~/.local/bin/darrow-artificer`.
No separate recurring-delivery flag or account-usage acceptance is needed.
Guided macOS setup previews PATH destinations and offers that change separately
from its final save confirmation. Noninteractive setup edits shell files only
with `--setup-path`; obtain that choice before adding the flag unless PATH setup
was already requested. Declining PATH setup still permits initialization.

Zsh uses `$ZDOTDIR/.zshrc`, with HOME when ZDOTDIR is unset. A set ZDOTDIR must
name a nonempty absolute directory. Broken or non-directory parents refuse
before any installation writes. Bash uses `~/.bashrc`
and the first existing `.bash_profile`, `.bash_login`, or `.profile`, creating
`.bash_profile` when none exists. The guarded entry preserves surrounding bytes,
permissions and symlinks. Repeated setup and shell startup do not duplicate it.
An already-present PATH entry leaves shell files alone. Unsupported shells and
platforms require manual integration; malformed managed entries, unreadable
files and broken links refuse before setup effects. Open a new terminal or use
the printed `source` instruction; a child command cannot update its parent shell.

Rerun `init --setup-path` through the bundled entrypoint if the command is missing,
or use `darrow-artificer init --setup-path` when it is reachable. Existing
installations reuse saved context for omitted flags, preserve grant/revocation,
host/profile/checkout/issue scope, and do not recreate labels. Conflicting explicit
settings or state refuse. Use `configure` for worker and WIP changes.

The wrapper resolves
the current Artificer installation from the chosen host's default profile on
every run, including after plugin updates. For Claude, Artificer must be installed
at user scope in that default profile; project-scoped copies do not satisfy or
override the wrapper lookup. Missing Artificer there refuses clearly.
Commands without initialized state explain how to run `init`; they create nothing.

Delivery worktrees are created under the checkout where `init` ran, including
when that checkout is itself a linked worktree.
Origin must match the authorized GitHub repository. The grantor needs write
access. Omitted issue scope means all eligible writer-nominated `artificer:ready`
issues. The initial recipe is always `ticket-to-pr`.

Require that recipe, Adaptive Goal, verification and review in the host. Optional
plugins are neither required nor copied. Use the existing configured model,
authentication and plugin profile; Artificer does not select billing providers.

`--profile-dir` names a dedicated host profile directory: `CODEX_HOME` for Codex
or `CLAUDE_CONFIG_DIR` for Claude. Every launch and resume for that worker uses
it, including scheduled ticks, regardless of the caller's environment. Without
it, `~/.codex` or `~/.claude` applies, ignoring ambient profile variables. Set it only at `init`; native
sessions stay in that profile. It must be an existing absolute directory with
its own login, required plugins and unattended permission settings.

Use `configure --workers N` to size the pool. Host, profile and WIP are shared.
Each worker runs one ticket at a time; an open PR can hold WIP after execution ends.
Before claiming tickets, Artificer requires enabled `darrow-ticket-to-pr` and
`darrow-adaptive-goal` through the host CLI plugin listing in the selected profile.
Missing plugins or listing failures leave issues unclaimed and appear in status.
Claude listing runs in the checkout so project installations are visible.
Session starts and resumes use installed plugins as-is, without snapshots.

```text
configure [--workers N] [--WORK_IN_PROGRESS_LIMIT N] [--SCHEDULE_SECONDS N]
```

WIP defaults to one and accepts nonnegative integers. Zero pauses new admission.
The schedule defaults to 900 seconds and accepts positive integers. Lowering WIP
does not cancel existing deliveries. `tick` performs one admission/reconciliation
activation and fills free worker slots up to the shared WIP limit.

After initialization, `schedule` installs one launchd interval for the installation.
Each scheduled tick resolves the current plugin through the installed wrapper.
`unschedule` removes it. After changing the interval, unschedule and schedule to
apply the new definition. It runs without an open terminal or Desktop. Inspect
partial launchd failures before retrying.

## Inspect, cancel and revoke

`status` shows the installation's repository, enabled state, host, profile,
configured worker count, shared WIP, plugin blocker and all
delivery records: issue, original session, attempts, PR, detail and next action.

`cancel DELIVERY_UUID` stops only that delivery's identified process group.
Capacity is released on reconciliation only when execution has ended and no
open delivery PR exists. Missing execution/publication evidence retains it.
Worktrees, branches and published effects are preserved.
Cancelling resumable released work makes that delivery terminal without taking
capacity or changing issue/PR ownership.

`revoke` prevents the whole pool's future admissions and continuations. It does
not cancel already running work.

## Native recovery

```text
recover DELIVERY_UUID --thread ORIGINAL_NATIVE_SESSION_ID
```

Inspect the original session, process group, worktree, branch and any PR first.
This explicit operation resumes that exact session; it never binds a replacement
identity. Running, revoked and unknown-session deliveries are refused.
Recovery also refuses when the pool has no free worker slot.
Never repeat uncertain publication or use a fresh summary-based owner.
For confirmed unfinished released work, recovery reacquires shared WIP and issue
ownership under the repository lock. It rechecks writer authority, grant/scope,
publication and conflicts before launch. WIP zero/full, another delivery owning
the issue, completed/cancelled work and historical records with unknown recovery
eligibility are refused. Resolving a missing-intent blocker outside Artificer
does not automatically resume it; use this explicit command with the original ID.

Recovery is limited to two attempts per technical interruption, including explicit
recovery. An exhausted incident requires inspection in the original host session.
Repeated immediate failure uses the same budget. Successful completion of a
native turn resets it; successful tools, incidental reads and diagnostics do not.
This bounds execution interruptions, not attempts at an engineering operation
inside a healthy turn. Product/specification questions stop and are reported on the source
issue for preparation elsewhere. Source-issue comments do not resume work.

Codex requires observed native goal completion before accepting delivery success.
Claude must enter its owner-prepared `/goal` before a PR completion report, but
its supported stream has no independent goal completion evidence. Such PRs are
retained, marked owned and reported as needing attention. Inspect the original
Claude session; a valid PR or model completion report alone cannot clear this gap.

Every command refuses an existing `.git/artificer` directory. Reconcile its
original execution and effects, remove that legacy directory yourself, then run
`darrow-artificer init`. There is no migration. Unavailable native state still
requires human reconciliation; never replace the original session.
