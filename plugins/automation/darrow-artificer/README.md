# Local Artificer

Explicitly authorize nominated GitHub issues for local ticket-to-PR delivery.
Artificer owns admission and local execution/storage mechanics. The independently
installed ticket recipe and adaptive goal retain engineering ownership.

## When to use

Use for explicitly authorized local delivery of nominated GitHub issues. Do not
use it for an ordinary implementation request, general jobs, or GitHub Actions.

## Usage

Invoke `$manage-artificer` with an operation and absolute installation state
path. Installation alone starts no automation. See the
[skill](skills/manage-artificer/SKILL.md) and its
[commands](skills/manage-artificer/references/operations.md).

Implicit invocation is disabled. Claude Code can explicitly invoke
`/darrow-artificer:manage-artificer` for management; execution still uses Codex.

## Hosts and prerequisites

Initial prerequisites: macOS, Codex CLI 0.159.2 with normal persistent ChatGPT
login, UV/Python 3.10–3.13, Git, GitHub CLI with repository write access, and the
independently installed delivery capabilities. The default launchd interval is
15 minutes. WIP and per-activation limits independently default to one.

The app-server adapter keeps the original main thread and its native goal alive
through automatic continuation. New grants default to `gpt-6-sol`/`medium`.
Adaptive Goal selects bounded implementation and assurance assignments;
Artificer does not override their routes or run engineering phases.
Healthy native execution has no overall time limit. Individual protocol requests
and process shutdown remain bounded; failures retain the claim and native state
for explicit human recovery. Test/eval entrypoints own their experiment limits.

## Installation

Install `darrow-artificer@darrow` using the
[host installation instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Choose the supporting delivery plugins independently. Then explicitly configure
the recurring grant and schedule using the linked commands; no schedule is
enabled during plugin installation.

Runtime entrypoint:

```text
uv run --quiet --no-project <plugin-root>/backend/scripts/run_locked.py darrow-artificer --state <absolute-path> status
```

## Expected result

An authorized activation reserves eligible issues and hands each to its native
owner. Status reports the issue, delivery, native identity and next action.
Questions appear on the issue; a verified open PR remains outstanding until
closed or merged and execution ends. An admission is not completed delivery.

## Safety boundaries

Claims remain occupied while questions or PRs are pending. Cancellation, failed
launches and expired archives never automatically free capacity or replace an
owner. Session archives use authenticated encryption with a separate private
key and exclude authentication credentials. Default retention is five days
from the last successful save.

The recurring grant accepts normal ChatGPT account usage, including available
credits after included allowance is exhausted. Codex enforces availability under
the existing account billing settings. The adapter forces ChatGPT authentication
and the OpenAI provider and removes model API credentials from the child
environment. Artificer never purchases credits, changes billing settings or
switches to API-key billing. Access failures require explicit human recovery.
This policy does not guarantee zero additional cost.

## Troubleshooting

Run `status` first. For login or allowance failures, restore access and use the
explicit resume comment; a timer does not retry stopped delivery. Lost state,
uncertain effects, and unavailable original owners require human reconciliation.
Use `recover` only with the inspected original main-thread identifier.
Never remove a claim to manufacture free capacity.

Version 0.2.0 changes native storage and recovery to one main-thread identity.
Earlier separate-owner records require reconciliation with their original
installation; they are not automatically converted, retried or released. Keep
their state, worktrees, claims and published effects until reconciled.

Version 0.3.0 replaces subscription-only confirmation with explicit account usage
acceptance (`--accept-chatgpt-account-usage`, saved as `account_usage_accepted`).
Existing grants are not silently expanded to authorize credit usage.

## License

See [LICENSE](LICENSE).
