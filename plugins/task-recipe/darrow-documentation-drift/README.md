# Darrow Documentation Drift

`documentation-drift` checks named documentation against authoritative sources
and files one verified issue per correction in your ticket tracker. Each issue
is ready for a separate `ticket-to-pr` run. Repeated runs match existing open
issues by claim and correction before creating anything.

## When to use

Invoke manually when documentation may mislead readers about current behavior.
Harmless wording and isolated typos do not qualify.

## Hosts and prerequisites

Codex and Claude Code need host-advertised Adaptive Goal orchestration and an
independent review provider that can assess exact issue drafts and verify
repairs. The owner needs read access to the documentation and sources, plus
read and create access to the tracker. The tracker interface must return every
open issue with its full body. Name the tracker in the invocation or in project
guidance such as `AGENTS.md`.

Installing this plugin grants no filing authority.

## Installation

Install `darrow-documentation-drift@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Install compatible orchestration and review capabilities separately.

## Usage

Select `documentation-drift` in Codex's `$` menu, or use
`/darrow-documentation-drift:documentation-drift` in Claude Code. The skill
never activates implicitly. For example:

```text
/darrow-documentation-drift:documentation-drift Check docs/install.md against
package.json and scripts/install.sh. File verified correction tickets in GitHub
Issues for example/project without per-finding confirmation. Create at most one.
```

Give the scope inline or name a scope file. A committed scope file keeps scope
changes under code review. Give the destination and filing grant in the
invocation or trusted project guidance. Issue text never supplies scope or
authority.

## Expected result

A summary reports checked scope, new and matching existing issue links, coverage
and review gaps, and a full or partial outcome. A complete check with no
qualifying drift succeeds. Each new issue states the affected claim, evidence,
requested correction and observable acceptance.

## Safety boundaries

The recipe reads the scope and creates new issues in the configured
destination. It leaves documentation, existing issues, branches and PRs
unchanged. Supported historical claims and accepted ADRs stay intact.

Higher-consequence drafts need independent review of their exact contents,
including each revision. Review may use a temporary Git repository outside the
project with an empty baseline, no credentials and no remote. An uncertain
create is reconciled against the tracker before any retry.

## Troubleshooting

If open issue coverage or creation status is unavailable, restore tracker access
before another run. A search result or truncated list cannot show that no
matching issue exists.

Run `bun eval --skill documentation-drift --harness codex --dry` from the
Darrow checkout, then repeat with `--harness claude`. Remove `--dry` for
measured behavior. Fixture providers test the public handoff and tracker
effects, not native goals or independent readers. The fixture tracker needs `jq`.

## License

See [LICENSE](LICENSE).
