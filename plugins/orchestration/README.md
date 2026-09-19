# Orchestration plugins

Orchestration plugins own an explicit continuation and completion contract.
They start only when the user invokes them and remain independently
installable from the capabilities they may compose.

## Choose a plugin

- [Adaptive Delivery](darrow-adaptive-delivery/README.md) provides the current
  bounded engineering helper and a separate read-only host-capacity doctor.
- [Ticket pipeline](darrow-ticket-pipeline/README.md) is an installable deprecated reference for deliberate comparisons.

Read the chosen plugin's local prerequisites, expected effects, and safety
boundaries before adopting it. See the [intent-first selection guide](../../docs/choosing-plugins.md)
for the complete catalog and layer relationships, or the
[documentation hub](../../docs/README.md) for first success and troubleshooting.
