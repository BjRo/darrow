# Darrow Readiness Gate

This plugin determines whether authoritative inputs are sufficient for
implementation to begin without inventing product intent, making an
unauthorized architectural choice, or guessing how success will be observed.
It evaluates implementation readiness rather than ticket formatting or process
completeness.

## What it provides

### `assess-implementation-readiness`

Assesses a ticket, specification, accepted plan, or conversational request and
returns one human-readable result with a `ready`, `needs-discovery`,
`needs-decision`, or `blocked` verdict. The result identifies its authoritative
basis, a concrete quality bar, readiness findings, and the smallest next
action. Automated callers may explicitly request the versioned
`darrow-implementation-readiness-v1` JSON representation. A caller that
requires a raw typed value must enforce the schema at its host launcher or API
boundary.

Example: _“Is this ticket ready for implementation?”_

The skill can also satisfy an explicit gate inside a larger native goal. It
runs read-only before implementation and returns its assessment to the caller.
A non-ready verdict prevents implementation; the enclosing owner decides how
to resolve findings or whether to finish. `ready` adds no authority. The consuming
goal discovers the capability by intent; neither this plugin nor the consumer
depends on a particular Darrow sibling.

## Design boundaries

- Readiness is about safe implementation start, not ticket quality or template
  compliance.
- The skill does not plan, perform discovery, make product decisions, implement
  changes, review code, or publish work.
- A formal ticket, plan, or predetermined file list is not required when the
  outcome and quality bar are already concrete.
- JSON is an explicit machine-output mode, not the default presentation and
  not an automatic consequence of composition.
- The plugin does not require adaptive-goal, a tracker, or another Darrow
  plugin.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
