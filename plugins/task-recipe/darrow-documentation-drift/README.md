# Darrow Documentation Drift

`investigate-documentation-drift` investigates documentation against named
authoritative sources and files worthwhile correction tickets. One standing
GitHub issue defines the investigation scope. Repeated runs match existing open
issues by the affected claim and requested correction before creating anything.

## When to use

Invoke manually when documentation may mislead readers about current behavior.
Harmless wording and isolated typos do not qualify. Use a separate delivery
recipe to implement a correction after its ticket is ready.

## Hosts and prerequisites

Codex and Claude Code need host-advertised Adaptive Goal orchestration and an
independent review provider that can assess exact issue drafts and verify
repairs. Adaptive Goal keeps the native goal and acceptance in the main thread.
Review owns independent judgment. The owner needs read access to the scoped
documentation and authoritative sources, plus GitHub Issues read and create
access. GitHub CLI or a compatible configured connector must expose complete
relevant open issues and allow uncertain creations to be reconciled.

Missing inputs, providers, permissions or reliable tracker state stop their
dependent work. Installing this plugin grants no filing authority.

## Installation

Install `darrow-documentation-drift@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Install compatible orchestration and review capabilities separately.

## Usage

Implicit activation is forbidden. Select `investigate-documentation-drift` in
Codex's `$` menu, or use `/darrow-documentation-drift:investigate-documentation-drift`
in Claude Code. For example:

```text
$darrow-documentation-drift:investigate-documentation-drift https://github.com/example/project/issues/42
The effective project is example/project. The configured tracker destination is
GitHub Issues in example/project. Create verified correction tickets there
without per-finding confirmation. For this run, create at most one new ticket.
```

Supply the project, tracker destination and filing grant through the invocation
or effective trusted project guidance outside the standing issue. The standing
issue supplies documentation scope and authoritative sources, never permission
to publish or change destinations. Caller limits apply unchanged.

## Expected result

A summary reports checked scope, new and matching existing issue links, coverage
and review gaps, and full or partial outcome. A complete investigation with no
qualifying drift is successful. Each new ticket states the affected claim,
authoritative evidence, requested correction and observable acceptance. It is
ready for separate ticket-to-PR delivery.

## Safety boundaries

The recipe authorizes scoped investigation and, only under the caller's filing
grant, new correction issues in the configured destination. It neither edits
application documentation nor changes existing issues. It does not schedule
runs, deliver fixes, open PRs, audit agent guidance, or broaden investigation.
Supported historical claims and accepted ADR history remain intact.

Review can use a temporary Git repository with a private empty baseline and
the exact draft, separate from the inspected project. It contains no credential
files or remote. Only necessary pinned evidence is copied or referenced there.
This preparation grants no project commits or publication beyond issue creation.

Routine discrepancies are verified directly. Higher-consequence drafts require
independent review of their exact contents, including a revised candidate after
repairs. Unsupported claims are withheld. Uncertain creation is reconciled
before retrying. Indeterminate results block that correction while cleared
independent work can continue.

## Troubleshooting

Supply missing scope or external authority before dependent work. If open issue
coverage or creation status is unavailable, restore tracker access and reconcile
the specific correction before another create attempt. A search result or a
truncated issue list cannot establish that no matching issue exists.

Run scoped preparation with `bun eval --skill investigate-documentation-drift
--harness codex --dry` from the Darrow checkout. Repeat with `--harness claude`.
Remove `--dry` for measured behavior. Fixture providers test the public handoff
and tracker effects; they do not establish native goal or independent reader execution.
The fixture tracker uses `jq` to preserve exact submitted issue bodies.

## License

See [LICENSE](LICENSE).
