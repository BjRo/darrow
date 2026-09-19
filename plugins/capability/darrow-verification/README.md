# Darrow Verification

`verify-change` coordinates one bounded implementation assessment against its
originating acceptance. It invokes a compatible independently installed code
review provider, preserves the complete review/check/repair evidence, and
accounts for every material criterion before returning clear, progress,
no-progress or blocked to the caller.

## When to use

Use for implementation acceptance verification or targeted follow-up. Direct
code review, readiness, implementation and running tests alone remain separate
intents.

## Usage

```text
Verify this implementation, HEAD to WORKTREE, against the acceptance in SPEC.md.
Coordinate assurance that this candidate meets all of its acceptance criteria.
Verify the attempted repairs against these original findings and target history.
```

Choose `verify-change` from Codex's `$` skill menu, or use
`/darrow-verification:verify-change` in Claude Code, followed by your request.

Supply the repository, scope/candidate, originating objective and criteria,
constraints, and successful current required checks. Follow-up also needs the
original complete findings and evidence, stable identities/dispositions,
original/prior/current targets and history, attempted repairs, previous results
and carried direct regressions. Missing evidence remains visible and blocks
clearance; a passing review cannot prove an unassessed criterion.

## Hosts and prerequisites

The plugin is self-contained and supports Claude Code and Codex. A compatible
review provider needs native fresh-agent support and its own check tools.
The host must allow a bounded provider assessment context and that provider's
independent readers; unavailable depth or authority blocks the operation.
The report renderer requires
[UV and Python](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md#uv-and-python-for-plugin-helpers).
Discover the
review provider by host-advertised intent, then check prerequisites, authorized
effects, result evidence and stop conditions. The provider must independently
assess standards and acceptance with fresh readers, run appropriate deterministic
checks, and support closed follow-up judgments when that mode is requested.
Its name, internal layout and serialization are immaterial. Missing or
incompatible required review blocks instead of falling back to self-review.

## Safety boundaries

Independent review remains separately usable. Ordinary implementation, running
tests, readiness, direct code review and presentation alone do not invoke this
coordinator. Selecting verification requires code review within that operation;
it does not change which engineering goals require assurance.

QA execution and reviewer-facing evidence packages are future separately selected
capabilities. Their absence does not block review-only verification. This initial
version supports review only; explicitly requiring an unsupported additional
assessment returns blocked. Existing findings and check/repair evidence remain
available without a rich presentation package.

## Expected result

A candidate-bound report preserves the complete provider result and maps every
material criterion to evidence or an explicit gap. Product files remain unchanged;
the provider may retain local assessment/check artifacts under its public rules.
Verification can prepare a temporary assessment draft. Its renderer reads that
draft and the provider's existing local report, preserves the assessment text and adds
a validated absolute report link. It refuses missing or unreadable evidence and
does not interpret provider formats, decide findings or set artifact retention.

The active owner implements, repairs, owns the shared budget and continuation,
and decides completion. Verification returns one assessment and targeted evidence
needs, never repairs or publishes. A later orchestration integration can consume
the candidate, criterion conclusions, provider findings/evidence and closed
follow-up handoff without importing provider internals or adding a controller.

## Installation

Install `darrow-verification@darrow` using the
[host installation instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
A compatible review capability must be separately available when invoked.

## Troubleshooting

Missing review, incompatible effects, stale target identity, unreadable original
findings, incomplete required evidence, a missing backend or lock, UV, or a
supported Python runtime blocks assessment. Supply the exact missing input or
compatible provider, preserving prior evidence for follow-up. Do not replace
the blocked result with self-review, another checkout's renderer, or a new
repair loop.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
