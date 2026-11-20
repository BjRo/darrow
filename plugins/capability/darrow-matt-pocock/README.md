# Darrow → Matt Pocock

Use Matt Pocock's curated discovery, design, diagnosis, writing and TDD workflows
on Codex or Claude Code. This independently installable MIT bundle includes the
supporting research, prototype and tracker-setup workflows. See the
[source and local differences](references/LOCAL-DIFFERENCES.md) for the pinned upstream origin.

## When to use

Use grilling to clarify a decision, diagnosing-bugs to find a reproducible cause,
and tdd to implement through agreed public test seams. Explicit workflows include
wayfinder, grill-with-docs, improve-codebase-architecture, to-spec, to-tickets,
wait-what, and setup-matt-pocock-skills. This slice does not provide implement,
a reviewer, or a PR publisher.

## Hosts and prerequisites

Codex and Claude Code have native manifests and preserved activation metadata.
Use a host with plugin support and the tools required by the chosen workflow:
repository read/write access, native delegation for research/design exploration,
and the configured tracker's authenticated tools for remote publication.
Independent review can use an installed provider such as Darrow Review.
Missing capabilities remain explicit gaps. No JavaScript or Sevro runtime is
required by this plugin.

## Installation

Follow the repository's [host installation instructions](../../../docs/getting-started.md).
The package can be installed independently; it does not read sibling plugins.
During migration this candidate is not yet in the marketplace. For local Claude
Code use `claude --plugin-dir /absolute/path/to/darrow-matt-pocock`; for Codex add
the package to a local marketplace and install its `darrow-matt-pocock` entry.
Restart the host after installing or updating. Remove verified superseded local
copies separately; marketplace changes do not remove cached installations.

## Usage

Ordinary request: “Diagnose why this test intermittently fails.”

Explicit Codex request: `$darrow-matt-pocock:to-tickets Break this approved spec into tickets.`

Explicit Claude Code request: `/darrow-matt-pocock:to-tickets Break this approved spec into tickets.`

Explicit-only skills never start merely because a task is large. If tracker
configuration is absent, explicitly invoke setup-matt-pocock-skills using the
same host prefix. Setup preserves the configured provider and existing labels.

## Expected result

The chosen workflow produces its bounded result: questions, a decision artifact,
a diagnosis, a prototype, tests and implementation, or approved tracker records.
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
from the source repository. The [smoke evidence](skills/setup-matt-pocock-skills/evals/README.md)
separates package/mount, activation and task observations. It is not a behavioral
suite for every unchanged upstream skill.

## License

[MIT](LICENSE). Copyright 2026 Matt Pocock; Darrow-maintained adaptations copyright
2026 Björn Rochel under the same terms. This package is outside the remaining
Darrow BUSL boundary. See [source and local differences](references/LOCAL-DIFFERENCES.md).
