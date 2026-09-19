# ADR-0010: Extract the evaluation runner into Sevro

Status: Accepted
Date: 2026-09-19
Summary: Move generic evaluation infrastructure into the versioned Sevro package while Darrow retains its evaluation policy, cases, and product integration.
Supersedes: ADR-0001

## Context

Darrow's shared evaluation runner has grown beyond the thin repository helper
selected by ADR-0001. It now contains reusable execution, isolation, host
adapters, grading, evidence, and reporting infrastructure alongside policy and
assets that are specific to Darrow.

Keeping both responsibilities in `evals/runner/` couples runner development and
dependencies to marketplace changes. It also prevents other projects from
using the generic runner without adopting Darrow's source tree and evaluation
policy.

The standalone runner has a separate durable owner in
[`bjro/sevro`](https://github.com/BjRo/sevro). Darrow still needs to own the
evaluation cases and policy that define evidence for this repository.

## Decision

Extract generic evaluation infrastructure into Sevro and consume it through a
versioned public package.

- Sevro owns the execution engine, fixture and check mechanics, isolation,
  cancellation, run ownership, evidence persistence, cleanup, generic
  reporting, host adapters, public schemas, and their generic unit tests.
- Darrow owns its evaluation extension, cases, suites, conditions, corpus
  definitions, snapshots, normative specifications, plugin-local assets, and
  product integration tests.
- Darrow integrates through Sevro's public CLI and extension protocol rather
  than importing unpublished runner internals or copying runner source.
- Normal Darrow use pins an exact Sevro release and does not require a Sevro
  source checkout or Git metadata.
- Coordinated development may select an explicit local Sevro checkout. Evidence
  from such a run records the local development identity separately from a
  packaged release identity.
- Evaluation tooling remains repository development infrastructure. No
  marketplace plugin runtime gains a Bun, TypeScript, or Sevro dependency.
- The migration is staged. Generic implementation remains in Darrow until
  compatibility is proven through public interfaces and the pinned package can
  replace it without losing required behavior or evidence.

This decision establishes ownership and distribution boundaries. Package
naming and registry details, extension transport and framing, exact public JSON
schemas, and the CLI exit-code mapping remain open for the applicable
specifications and implementation planning.

## Consequences

- Sevro can evolve and release generic evaluation infrastructure independently
  of the Darrow marketplace.
- Darrow can evolve its policy, cases, and extension with the capabilities they
  assess while consuming a reproducible runner release.
- Coordinated changes require compatibility checks across both repositories and
  evidence that distinguishes packaged releases from local development builds.
- Extraction work must introduce explicit project and configuration roots plus
  configurable result and active-run storage; package installation paths cannot
  stand in for project state.
- Existing commands, evidence, isolation boundaries, and historical results
  need behavior-parity coverage before Darrow switches to the package. Any
  deliberate incompatibility must be documented as a migration.
- ADR-0001 remains the historical record of the original in-repository runner
  choice but no longer governs its long-term ownership.
