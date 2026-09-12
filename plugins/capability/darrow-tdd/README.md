# Darrow TDD

This plugin gives coding agents a strict test-first discipline for observable
behavior changes and reproducible bug fixes. It treats test-driven development
as evidence, not ceremony: each small behavior must first fail for the intended
reason through a stable public seam, then pass after the smallest product
change.

The emphasis is on durable tests that survive implementation refactoring and
whose expected values come from the request, specification, or a known-good
example—not from repeating the production algorithm in the test.

## What it provides

### `tdd`

Implements a requested change as successive vertical red/green slices. The
skill first binds the public seam, independent oracle, focused command, and
final repository gates. For each slice it adds one focused test, observes a
meaningful red while product code is unchanged, implements only enough behavior
for green, and reruns the identical command before proceeding.

Example: _“Implement this parser fix test-first through the CLI.”_

The skill also handles the important refusal cases: an unapproved public seam,
no independent oracle, no viable existing harness, or a failure caused by
syntax, fixtures, dependencies, or environment rather than the missing
behavior. It reports these limitations instead of manufacturing a red/green
story.

### Agent metadata and behavioral evals

The package includes native Codex metadata and judgment-focused eval cases for
seam selection, meaningful red evidence, vertical slicing, integration-style
tests, bug-fix value, and requests that should not trigger implementation. The
runtime capability intentionally needs no general-purpose test wrapper: it uses
the target repository's own public seam and supported commands.

## Design boundaries

- The skill changes behavior only when product implementation is part of the
  request; test review, fixture maintenance, harness repair, and suite-only
  execution remain separate tasks.
- Private methods, incidental call order, source text, and side-channel logs are
  not substitutes for a consumer-visible seam.
- Tests do not mock the behavior under test or derive their oracle from its
  implementation.
- The workflow does not commit, push, publish, or bootstrap unrelated test
  infrastructure.

## When to use

Implement a behavior change or reproducible fix through a stable public seam. Do not use it for fixture maintenance, test review, or suite-only execution.

## Hosts and prerequisites

Codex and Claude Code; the target's existing test harness and runtimes, an independent expected outcome, and an authorized public seam.

## Installation

Install `darrow-tdd@darrow` using the
[host installation, update, removal, and verification instructions](https://github.com/BjRo/darrow/blob/main/docs/installing-plugins.md).
Review this plugin's local prerequisites and safety boundaries first.

## Usage

An ordinary request can select the appropriate capability:

> Implement this parser fix test-first through the CLI.

To select it explicitly, choose `tdd` from Codex's `$` skill menu,
or use `/darrow-tdd:tdd` in Claude Code, followed by your request.

## Expected result

Observed red and green from the same focused command, then relevant final checks. Product and test files change; publication is separate.

## Troubleshooting

Syntax, fixture, dependency, and environment failures are not meaningful red. Resolve the actual failure before implementation; do not mock the subject or test a private method to manufacture evidence.
For a discovery or host problem, use the
[documented installation checks](https://github.com/BjRo/darrow/blob/main/docs/troubleshooting.md)
and report the plugin version, host version, exact invocation, and error
without credentials.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
