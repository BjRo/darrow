# Darrow Readiness Gate

This plugin determines whether authoritative inputs are sufficient for
implementation to begin without inventing product intent, making an
unauthorized architectural choice, or guessing how success will be observed.
It evaluates implementation readiness rather than ticket formatting or process
completeness.

## What it provides

### `assess-implementation-readiness`

Assesses a ticket, specification, accepted plan, or conversational request and
returns one versioned result with a `ready`, `needs-discovery`,
`needs-decision`, or `blocked` verdict. The result identifies its authoritative
basis, a concrete quality bar, readiness findings, and the smallest next
action.

Example: _“Is this ticket ready for implementation?”_

The skill can also satisfy an explicit gate inside a larger native goal. It
runs before mutation, stops the goal on a non-ready verdict, and returns
control on `ready` without granting any additional authority. The consuming
goal discovers the capability by intent; neither this plugin nor the consumer
depends on a particular Darrow sibling.

## Design boundaries

- Readiness is about safe implementation start, not ticket quality or template
  compliance.
- The skill does not plan, perform discovery, make product decisions, implement
  changes, review code, or publish work.
- A formal ticket, plan, or predetermined file list is not required when the
  outcome and quality bar are already concrete.
- The plugin does not require adaptive-goal, a tracker, or another Darrow
  plugin.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
