# Darrow Matt Pocock

Use Matt Pocock's curated discovery, design, diagnosis, writing, TDD and approved
implementation workflows on Codex or Claude Code. This independently installable MIT bundle includes the
supporting research, prototype and tracker-setup workflows. See the
[source and local differences](references/LOCAL-DIFFERENCES.md) for the pinned upstream origin.

## When to use

Use grilling to clarify a decision, diagnosing-bugs to find a reproducible cause,
and tdd to implement through agreed public test seams. Explicit workflows include
wayfinder, grill-with-docs, improve-codebase-architecture, to-spec, to-tickets,
wait-what, setup-matt-pocock-skills, and implement. Use implement for an approved
ticket/spec with agreed test seams. Independent Review and Git remain separate
providers; this bundle ships no duplicate reviewer or PR publisher.

## Hosts and prerequisites

Codex and Claude Code have native manifests. Unchanged upstream workflows retain
their activation metadata. Adapted implement is visible to authorized parent
recipes on both hosts, with explicit/delegated authorization enforced by its
description and first workflow guard.
Use a host with plugin support and the tools required by the chosen workflow:
repository read/write access, native delegation for research/design exploration,
and the configured tracker's authenticated tools for remote publication.
Implement requires host-advertised Adaptive Goal with native goal support,
independent Review and Git commit capabilities, and a principles-first approach
(such as the pstack bundle). Its TDD provider is included. Independent review can
use an installed provider such as Darrow Review.
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

For approved implementation use `$darrow-matt-pocock:implement <approved spec>`
on Codex or `/darrow-matt-pocock:implement <approved spec>` on Claude Code.
Adaptive Goal retains the one native continuation and acceptance owner, including
when an existing delivery recipe invokes implement. The default result is a local
commit after required evidence; push and PR need explicit or inherited authority.

Explicit-only skills never start merely because a task is large. If tracker
configuration is absent, explicitly invoke setup-matt-pocock-skills using the
same host prefix. Setup preserves the configured provider and existing labels.

## Expected result

The chosen workflow produces its bounded result: questions, a decision artifact,
a diagnosis, a prototype, tests and implementation, or approved tracker records.
Implement reports current acceptance/test evidence, independent review, changed
files and the local commit, or a concrete required-provider gap. It reuses approved
seams and asks only for new or changed seams.
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
If implement reports a required provider missing, install a compatible provider
and start a fresh session; do not bypass its contract with raw commands. If
native goal controls are unavailable, follow Adaptive Goal's launch-required
response; reading a skill or queuing a proposal does not activate a goal.
If tracker access fails, check configured provider and credentials; do not switch
providers. If setup guidance differs between hosts, follow each host entrypoint
to the shared configuration and preserve user content while fixing the pointer.

Focused package checks run with `bun test ./evals/domain/matt-pocock-bundle.test.ts`
from the source repository. The [smoke evidence](https://github.com/BjRo/darrow/blob/main/plugins/capability/darrow-matt-pocock/skills/setup-matt-pocock-skills/evals/README.md)
separates package/mount, activation and task observations. It is not a behavioral
suite for every unchanged upstream skill. The adapted recipe has separate
[implementation evidence](https://github.com/BjRo/darrow/blob/main/plugins/capability/darrow-matt-pocock/skills/implement/evals/README.md) and focused composition
fixtures.

## License

[MIT](references/LICENSE). Copyright 2026 Matt Pocock; Darrow-maintained adaptations copyright
2026 Björn Rochel under the same terms. This package is outside the remaining
Darrow BUSL boundary. See [source and local differences](references/LOCAL-DIFFERENCES.md).
