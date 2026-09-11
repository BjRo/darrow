# Task recipes

Task recipes are independently installable, explicitly invoked delivery
envelopes. They preserve the originating request and permissions while
delegating bounded execution to a compatible orchestration capability. They do
not add a controller, queue, ledger, durable state, or implicit activation.

## Choose a plugin

- [Ticket to PR](darrow-ticket-to-pr/README.md) packages one exact ticket as a new-branch implementation and one-PR request.

Read the chosen plugin's local prerequisites, expected effects, and safety
boundaries before adopting it. See the [intent-first selection guide](../../docs/choosing-plugins.md)
for the complete catalog and layer relationships, or the
[documentation hub](../../docs/README.md) for first success and troubleshooting.
