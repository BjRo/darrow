# Darrow Ticket to PR

`ticket-to-pr` is an explicitly invoked shortcut for the request users would
otherwise give adaptive-delivery: read and implement one exact ticket in the
current repository on a new branch, then open one verified pull request when
the change is ready.

The recipe owns only that bounded authority envelope and one adaptive-delivery
delegation. `adaptive-delivery` owns readiness, capability binding, route selection,
the separate engineering owner, verification, review, publication, blockage,
and same-owner human feedback through the main thread. Ticket-to-PR performs no
ticket read, repository preflight, Git or forge work, lifecycle bookkeeping, or
post-goal inspection of its own.

Explicit caller repair and review limits pass through unchanged. Without an
override, adaptive-delivery supplies its default repair budget; the recipe
does not define a separate retry policy.

Completion includes the owner's evidence that the remote branch and open PR
both point at the intended verified commit. Reusing an existing URL therefore
requires publishing any additional intended local commits without force;
the recipe still chooses no publication command or capability.

When the ticket or selected verification contract requires reviewer-facing
evidence, the same explicit invocation authorizes at most one focused evidence
publication against that exact PR and verified commit. It grants no generic
comment authority. Partial, ambiguous, refused, or changed-head publication
stops completion without recipe-owned retry or recovery.

## When to use

Use this explicit shortcut for one exact ticket, a new branch, implementation,
verification, and one PR. Do not use it for ticket browsing, bulk delivery,
scheduler entry, or work that lacks an exact ticket reference.

## Hosts and prerequisites

Codex or Claude Code with a compatible host-visible adaptive-delivery capability.
The delegated owner needs the tracker, Git, forge access, and target repository
tools required by the requested work. Missing capabilities remain missing;
the recipe does not install them or read sibling plugin files.

## Installation

Install `darrow-ticket-to-pr@darrow` using the
[host installation and update instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Independently choose compatible supporting capabilities when the host lacks them.

## Usage

This recipe is explicit-only. A natural-language ticket question does not start it.
Choose `ticket-to-pr` in Codex's `$` menu, or use
`/darrow-ticket-to-pr:ticket-to-pr` in Claude Code, and supply the exact ticket:

```text
Use ticket-to-pr to implement the ticket reference I supplied and open one PR.
```

## Expected result

One delegated ticket-delivery outcome, with owner evidence for the intended
commit, remote branch, and open PR. The recipe itself performs no preflight
or publication. Feedback continues through the same owner.

## Safety boundaries

Authority covers only the supplied ticket outcome. It does not authorize
merging, releases, deployment, bulk work, or unattended recurring execution.
The recipe adds no controller or state store.

## Troubleshooting

A missing exact ticket or unavailable compatible orchestrator needs the
smallest missing input or capability choice. For an accepted handoff, preserve
the owner identity and its refusal evidence instead of starting a duplicate.
Use the [host discovery checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
for installation symptoms.

## License

See [LICENSE](LICENSE).
