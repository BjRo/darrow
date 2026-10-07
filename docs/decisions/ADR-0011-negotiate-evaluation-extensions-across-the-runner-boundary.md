# ADR-0011: Negotiate evaluation extensions across the runner boundary

Status: Accepted
Date: 2026-09-26
Summary: Keep evaluation execution and host observation in Sevro while a negotiated, versioned Darrow extension supplies repository policy without concealing failed or unavailable evidence.

## Context

[ADR-0010](ADR-0010-extract-the-evaluation-runner-into-sevro.md) assigns generic
evaluation infrastructure to Sevro and Darrow evaluation policy to this
repository. The current in-repository runner still combines host observations,
Darrow-specific grading, and execution-changing assistance. Moving those files
unchanged would make the package depend on Darrow policy and would let an
extension's judgment obscure the evidence that produced it.

The owner-authored [extraction issue](https://github.com/BjRo/darrow/issues/95)
agrees on a versioned, language-independent extension boundary, capability
negotiation, additive grading by default, explicit replacement, and distinct
execution, grading, and task outcomes. This decision records that boundary.

## Decision

Sevro's engine owns trial scheduling, generic fixture and check mechanics,
isolation, cancellation, run ownership, evidence persistence, cleanup, and
generic reporting. A host adapter invokes or resumes its host and returns
bounded observations with an explicit source and completeness state. It reports
facts; it does not decide whether those facts satisfy a Darrow contract.
Host-specific facts that do not fit a common observation use a namespaced
domain field.

Darrow owns an evaluator extension alongside its cases and policies. It
resolves Darrow layout and benchmark inputs into neutral case descriptions,
declares preparation artifacts and optional instrumentation, and grades Darrow
route, ownership, review, and other domain contracts. Extension data and
returned checks or metrics have a Darrow namespace. An extension adds checks
and metrics to built-in grading unless configuration explicitly replaces a
named grader or the task-verdict policy. Evidence identifies active graders
and every replaced default.

The engine and extension negotiate a compatible protocol version and declared
capabilities before resolving a case. The engine rejects an incompatible
version or unavailable required capability. It validates requested
instrumentation against the selected host and the configured passive or
enforced condition before host execution. An extension cannot silently change
a passive trial into an enforced trial. Requested and actual instrumentation
remain separate evidence.

The lifecycle is ordered: negotiate, resolve, prepare the fixture and extension
inputs, validate instrumentation, execute the host, run built-in checks, run
extension grading, combine separate execution/grading/task states, persist the
completed evidence, then clean up the fixture. The engine retains control of
the lifecycle and persists each completed trial before cleanup. Cancellation,
extension failure, missing required evidence, and grader error remain explicit
in retained evidence. None can become a successful task assessment through an
extension verdict. A dry run cannot count as observed behavioral success.

This decision does not select a transport or framing convention, exact JSON
schemas, package registry, or CLI exit-code mapping. Those public details need
versioned specifications and compatibility tests before extraction.

## Consequences

- Sevro can run an independent evaluation with built-in grading and no Darrow
  extension; installing an extension does not silently remove those graders.
- Darrow policy can evolve with its cases without entering Sevro's host
  adapters or marketplace plugin runtimes.
- Public integration tests must exercise negotiation, additive and explicit
  replacement behavior, unavailable evidence, failure persistence, and the
  passive/enforced boundary through the CLI and extension protocol.
- Evidence and comparison identity must record the runner, extension,
  negotiated protocol, configuration, graders, and actual instrumentation so
  materially different evaluations cannot appear equivalent.
