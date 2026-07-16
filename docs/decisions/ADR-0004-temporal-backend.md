# ADR-0004: Temporal is the first durable execution backend

Status: Accepted
Date: 2026-07-16

## Context

Darrow runs must survive process exits, agent-turn boundaries, human waits, and
worker restarts while preserving bounded workflow state and immutable attempts.
The engine needs durable execution, replayable deterministic control flow,
activity boundaries, queries, cancellation, and explicit continuation.

Adding a custom lightweight engine first would create two execution semantics
before the product has proved one. Comparing backends is therefore less useful
than testing whether Temporal can satisfy Darrow's concrete local and hosted
requirements.

Temporal can impose distribution and operational weight. The product must hide
that weight from the default local experience and retain an engine interface so
workflow, plugin, and artifact contracts do not expose Temporal APIs.

## Decision

Use Temporal as the first execution backend and continue with it until a core
requirement produces a showstopper.

- The Darrow engine is a generic interpreter over an immutable `ResolvedPlan`;
  each workflow remains data rather than newly compiled Temporal code.
- Temporal history is authoritative for active control state. Repository-local
  journals are audit and inspection records, not an alternate state machine.
- Local Darrow owns service and worker startup, readiness, namespacing, shutdown
  policy, and data paths under the repository's `.darrow/` directory.
- Default local use requires no user-managed Docker, PostgreSQL, or telemetry
  collector.
- Workflows, commands, capabilities, and artifacts do not depend on Temporal
  types or APIs.
- Active-run migration between local and hosted environments is out of scope.

Re-evaluate this decision only if Temporal cannot satisfy one of these core
requirements with acceptable engineering:

1. zero-configuration local startup and resume;
2. durable recovery across process and worker restarts;
3. bounded workflow history for long-running agent work;
4. an acceptable installation and distribution footprint; or
5. semantic parity between local, self-hosted, and managed operation.

Implementation difficulty, unfamiliarity, or the theoretical appeal of a
lighter test backend is not by itself a trigger for another backend.

## Consequences

- M1 must prove the thinnest local Temporal-backed vertical slice rather than
  first building an in-memory production alternative.
- The Temporal feasibility spike validates replay safety, activity retry
  boundaries, uncertain effects, local auto-start, recovery, long waits, history
  growth, and deployment parity against the criteria above.
- Tests may use Temporal's supported test facilities or deterministic unit tests
  around compiler and interpreter logic without defining another product
  backend.
- If a showstopper is demonstrated, a replacement or second backend requires a
  new ADR and must preserve the existing workflow and CLI contracts.
