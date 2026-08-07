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
