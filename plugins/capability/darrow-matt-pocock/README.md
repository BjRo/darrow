# Darrow Matt Pocock

Use Matt Pocock's curated discovery, design, diagnosis, writing and TDD
workflows on Codex or Claude Code. This independently installable MIT bundle
also includes research, prototyping and tracker setup. See the
[source and local differences](references/LOCAL-DIFFERENCES.md) for the pinned upstream origin.

## When to use

Use grilling to clarify a decision, diagnosing-bugs to find a reproducible cause,
and tdd to implement through agreed public test seams. Explicit workflows include
wayfinder, grill-with-docs, improve-codebase-architecture, to-spec, to-tickets,
wait-what, and setup-matt-pocock-skills. Use separate Review and Git providers
for independent review and PR publication.

## Hosts and prerequisites

Codex and Claude Code have native manifests. Upstream workflows retain their
activation metadata.
Use a host with plugin support and the tools required by the chosen workflow:
repository read/write access, native delegation for research/design exploration,
and the configured tracker's authenticated tools for remote publication.
Missing capabilities remain explicit gaps. No JavaScript or Sevro runtime is
required by this plugin.

## Installation

Install `darrow-matt-pocock@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
The package can be installed independently; it does not read sibling plugins.
Restart the host after installing or updating. Compare and preserve local changes
before removing superseded copies; marketplace changes do not uninstall caches.

## Usage

Ordinary request: "Diagnose why this test intermittently fails."

Explicit Codex request: `$darrow-matt-pocock:to-tickets Break this approved spec into tickets.`

Explicit Claude Code request: `/darrow-matt-pocock:to-tickets Break this approved spec into tickets.`

Explicit-only skills never start merely because a task is large. If tracker
configuration is absent, explicitly invoke setup-matt-pocock-skills using the
same host prefix. Setup preserves the configured provider and existing labels.

## Expected result

The chosen workflow produces questions, a decision artifact, a diagnosis, a
prototype, tests and implementation, or approved tracker records.
Setup creates shared tracker, label and domain guidance reachable from both host
entrypoints. Publishing follows the request and inherited permissions; new seams
and ticket breakdowns still require human confirmation.

## Safety boundaries

The [compatibility guidance](references/COMPATIBILITY.md) preserves host capability limits,
explicit activation and authority. Local work grants no push or PR permission.
Use native tracker relationships without silently changing provider or labels.
This bundle owns no delivery controller and never starts orchestration implicitly.

## Troubleshooting

If a skill is missing, check the installed plugin name, version and a fresh host
session. If two copies match, compare local changes before removing a duplicate.
If tracker access fails, check configured provider and credentials; do not switch
providers. If setup guidance differs between hosts, follow each host entrypoint
to the shared configuration and preserve user content while fixing the pointer.

Focused package checks run with `bun test ./evals/domain/matt-pocock-bundle.test.ts`
from the source repository. The [smoke evidence](https://github.com/BjRo/darrow/blob/main/plugins/capability/darrow-matt-pocock/skills/setup-matt-pocock-skills/evals/README.md)
separates package and mount checks, activation, and task outcomes for setup.

## License

[MIT](references/LICENSE). Copyright 2026 Matt Pocock; Darrow-maintained adaptations copyright
2026 Björn Rochel under the same terms. This package is outside the remaining
Darrow BUSL boundary. See [source and local differences](references/LOCAL-DIFFERENCES.md).
