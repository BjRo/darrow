# Darrow Ticket to Pull Request

This independently installable task recipe turns one authoritative ticket in
the current repository into exactly one verified pull request. It is
available to Claude Code and Codex with the same public behavior.

## What it provides

### `ticket-to-pr`

Explicitly invoke `/ticket-to-pr` on Claude Code or `$ticket-to-pr` on Codex
with one stable ticket reference or one authoritative supplied specification.
The recipe performs read-only intake, protects existing work, reconstructs
correlated durable Git and pull-request state, and delegates preflight and the
complete bounded delivery to adaptive-goal.

The invocation authorizes one task branch, intended commits, a non-force push,
and exactly one pull request. It does not authorize merge, deployment, release,
ticket mutation, or unrelated effects. Ordinary implementation requests and
ticket discussion do not activate it.

Examples: _“/ticket-to-pr DAR-123”_ on Claude Code and
_“$ticket-to-pr DAR-123”_ on Codex.

## Composition

The recipe discovers ticket reading, adaptive goal, independent review, and
Git publication through
host-visible compatible intents or public contracts. It does not reference
sibling plugin files or assume a named provider is installed. A missing
required delivery capability blocks honestly.

Progress is reconstructed from repository and forge facts. The plugin stores
no private ledger, introduces no phase runtime or background controller, and
ships no SDK or exporter.

## Terminal behavior

Every invocation reports exactly one of `pr_created`, `pr_existing`, `stopped`,
`blocked`, or `interrupted`, together with the relevant durable repository and
PR state, verification/review evidence, native-goal launch evidence, and
preserved local work. Success always refers to the exact current committed
content.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
