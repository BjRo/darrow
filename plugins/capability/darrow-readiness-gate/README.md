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
- The plugin does not require adaptive-delivery, a tracker, or another Darrow
  plugin.

## When to use

Check whether authoritative intent and observable acceptance are sufficient to begin implementation. Do not use it to implement or grade ticket formatting.

## Hosts and prerequisites

Codex and Claude Code with read access to the repository and request. No tracker or sibling plugin is required.

## Installation

Install `darrow-readiness-gate@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Assess whether this request is ready before any code changes.

To select it explicitly, choose `assess-implementation-readiness` from Codex's `$` skill menu,
or use `/darrow-readiness-gate:assess-implementation-readiness` in Claude Code, followed by your request.

## Expected result

One ready, needs-discovery, needs-decision, or blocked assessment, with evidence and a next action. Repository and tracker state stay unchanged.

## Troubleshooting

A non-ready verdict is an assessment result. Resolve the named missing fact or decision. For missing discovery, verify installation and try the explicit invocation below.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0 two
years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
