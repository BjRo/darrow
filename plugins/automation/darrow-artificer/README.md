# Local Artificer

Nominate ready GitHub issues and let a local worker run a task recipe in a
plugin-equipped Claude Code or Codex session. Return to reviewable pull requests.

## When to use

Use for explicitly authorized unattended delivery of ready GitHub issues.

One Artificer runs one ticket at a time. Run additional workers for parallel
delivery. Workers share repository claims and a WIP limit: each running delivery
or open Artificer PR occupies one slot. Unrelated PRs do not count. Open PRs
hold their slots until closed or merged and execution has ended.

Each new delivery gets a fresh native session and an isolated worktree from the
latest fetched main/master. The worker can then take another ticket if shared
capacity allows. Initially every ticket runs `ticket-to-pr`; the recipe and
native session own engineering, verification and internal subagents.

Adaptive Goal, verification and review must be installed in the selected host.
Other plugins, including TDD, Git and ticket capabilities, are optional and used
when applicable. Existing user/project configuration and authentication are
inherited. Artificer does not copy plugins, credentials or native histories.

## Hosts and prerequisites

The first version runs locally on macOS with UV/Python 3.10–3.13, Git, GitHub CLI
write access and a configured Claude Code or Codex executable. Workers in one
repository must select the same host. The host must support persistent native
sessions, native goals and the structured streaming protocol used by its adapter.
Codex uses app-server. Headless Claude enters the recipe explicitly; its prepared
owner can request native `/goal` activation through the client in that same session.

Installed-host protocol support must be checked before unattended use. Fixture
tests do not establish compatibility with every host version, plugin profile or
account configuration. Account availability and costs follow the existing host
profile; Artificer does not change authentication, permission or billing settings.
Configure that profile to permit the intended unattended work. A host permission
request that cannot be handled noninteractively stops delivery.

## Installation

Install `darrow-artificer@darrow` using the
[host installation instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Install the recipe and core delivery plugins independently. Installation grants
no recurring authority and enables no schedule.

## Usage

Explicitly invoke `$manage-artificer` (or
`/darrow-artificer:manage-artificer`) to configure, schedule or inspect a worker.
See the [skill](skills/manage-artificer/SKILL.md) and its
[commands](skills/manage-artificer/references/operations.md).

Runtime entrypoint:

```text
uv run --quiet --no-project <plugin-root>/backend/scripts/run_locked.py darrow-artificer --state <absolute-worker-state> status
```

Nominate issues with `artificer:ready`. A writer's nomination authorizes admission
under the saved recurring grant. Artificer consumes readiness and applies
`artificer:claimed` to the source issue and delivery PR. Open labeled PRs also
hold capacity when no local claim remains. Status shows worker, ticket, native
session, recovery attempts, PR, blocker and next action.

## Expected result

One recipe-owned, verified PR ready for review, with required CI green on its
final commit. A reservation or an intermediate response does not establish
completed delivery.

## Safety boundaries

Recoverable technical interruptions get two native resume attempts each.
Immediate recurrence shares the same budget; useful native progress resets it.
Explicit recovery consumes the remaining budget and refuses exhausted incidents
or another active ticket in the same worker.
Exhausted retries and missing product intent stop delivery and are reported on
the source issue and in local status. Discovery and specification happen outside
Artificer. There is no issue-comment answer loop.

Native session storage belongs to the host. Missing native state requires human
reconciliation, not a replacement owner. Confirmed stopped deliveries without an
open PR release capacity; uncertain execution or publication retains it.
Cancellation and revocation never undo worktrees, branches or published effects.
No merge, deployment, release or unrelated mutations are authorized.

## Troubleshooting

Run `status` first. Inspect the original session and published effects before
requesting explicit recovery with its exact native session ID.

Legacy archive-based installations are refused without conversion or deletion.
Reconcile their original execution and published effects before setting up new
workers. Historical implementation evidence remains in
[research](../../../docs/research/README.md#local-artificer).

## Development

From the repository root:

```sh
bun run check:python --package plugins/automation/darrow-artificer/backend
uv run --frozen --no-dev --project plugins/automation/darrow-artificer/backend python plugins/automation/darrow-artificer/backend/tests/fresh_install.py
```

Cloud execution, epic recipes and dispatch by subissues or labels are future work.

## License

See [LICENSE](LICENSE).
