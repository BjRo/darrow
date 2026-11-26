# Task recipes

Task recipes are independently installable, explicitly invoked delivery
envelopes. They preserve the originating request and permissions while
delegating bounded execution to a compatible orchestration capability. They do
not add a controller, queue, ledger, durable state, or implicit activation.

## Choose a plugin

- [Ticket to PR](darrow-ticket-to-pr/README.md) packages one exact ticket as a new-branch implementation and one-PR request.
- [Documentation Drift](darrow-documentation-drift/README.md) checks named documentation against authoritative sources and files one verified ticket per correction.

See the [plugin catalog](../../docs/choosing-plugins.md) to choose by task, or
the [documentation hub](../../docs/README.md) for setup and troubleshooting.
