# ADR-0004: Use native goal ownership for core orchestration

Status: Accepted
Date: 2026-08-13
Revisit when: Matched multi-trial evidence on supported hosts shows that a Darrow-owned execution controller materially improves task outcomes over native goal ownership after accounting for wall time, model usage, child invocations, and human interruptions.

## Context

Codex and Claude already provide long-running goal execution, repository tools,
model routing, recovery, and completion behavior. Darrow's former
planner/executor/verifier controller duplicated those facilities through role
agents, snapshots, ledgers, repair rules, and its own continuation logic.

The [orchestration benchmark](../../evals/experiments/orchestration/README.md)
did not demonstrate incremental value from that duplicate controller and
measured substantial latency and child-agent overhead. A subsequent
[native-preflight comparison](../../evals/experiments/orchestration/snapshots/2026-08-07-native-preflight-codex-n1.md)
passed every observed task with zero Darrow child sessions while the retired
controller passed fewer tasks and took materially longer. The sample sizes and
host coverage are limited, so the evidence supports a direction rather than a
universal performance claim.

Preflight still has value: it can discover repository constraints, make
acceptance and verification explicit, select a workflow and risk gate, and
choose a proportionate model route before execution starts.

## Decision

Use Darrow as a goal compiler and launcher around host-native goal ownership,
not as a second execution runtime.

- `adaptive-goal` performs read-only preflight in the current context and emits
  one compact goal contract.
- It activates the narrowest supported host-native boundary that can honestly
  apply the selected route. Exactly one host-native goal owner then owns
  implementation, adaptation, recovery, verification, and completion.
- Darrow does not supervise planner, executor, verifier, or repair roles and
  does not implement a daemon, queue, workflow database, phase ledger, or
  general workflow runtime.
- A nested host process is a disclosed compatibility boundary requiring
  explicit user authorization, never an automatic substitute for native
  activation.
- `darrow-ticket-pipeline` remains an executable reference and comparative
  benchmark for the former static, controller-owned approach. It is not a
  second recommended orchestration path or a template for new runtime features.

The detailed preflight, route, launch, and safety contract remains in
[Capability: Native Goal Preflight](../specs/adaptive-goal-loop.md). The frozen
comparison surface remains in
[Capability: Ticket Pipeline](../specs/ticket-pipeline.md).

## Consequences

- Darrow concentrates its orchestration value before execution and delegates
  continuation mechanics to the host.
- Native execution remains observable through host-owned threads rather than a
  Darrow-defined role hierarchy.
- Unsupported route application or goal activation must stop honestly instead
  of masquerading as the selected boundary.
- Host differences require explicit launch adapters and compatibility behavior,
  but not a cross-vendor Darrow runtime.
- The retained ticket pipeline provides reproducible comparative evidence while
  remaining outside the core product direction.
- Restoring a Darrow-owned controller requires new matched evidence and a
  superseding architecture decision.
