# Capability: Native Goal Preflight

Darrow should turn a bounded engineering request into a well-framed native
goal, choose a proportionate model route, and activate the host's goal
capability. The host owns execution, persistence, recovery, and completion.
Darrow owns only the preflight policy that improves what the native loop is
asked to achieve.

Plugin: `darrow-goal-loop`  
Skills: `pursue-goal`, `check-goal-readiness`

## Why

Codex and Claude already provide goal-like long-running work, repository tools,
model selection, effort controls, and their own completion behavior. Darrow's
former planner/executor/verifier controller repeated those facilities through
child prompts, snapshots, route ledgers, repair rules, and telemetry. The
orchestration benchmark found no incremental value from that controller and
measured substantial wall-time and child-invocation overhead.

The retained opportunity is earlier and smaller:

```text
request + repository -> preflight -> native goal -> native completion
```

Preflight can improve the native run by making completion explicit, discovering
repository constraints and checks, selecting a suitable goal template, and
choosing a model and effort proportionate to the work. It must then get out of
the runtime's way.

## Selected design

`pursue-goal` is a user-invoked **goal compiler and launcher**. It performs a
read-only preflight in the current context, emits one compact goal contract,
and activates one native goal. It does not supervise role agents or implement a
second adaptive loop.

The launch boundary is selected in this order:

1. activate the goal in the current thread through a host-native goal tool;
2. use a supported same-thread host API that can also apply model and effort;
3. let a supported enclosing launcher start one disclosed host session only
   when the current surface cannot activate the selected route in place;
4. stop as `launch_required` when none of those boundaries is available.

This order is normative. Process nesting is a compatibility boundary, not the
default architecture.

## Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` describe capability requirements.
Host tool names and current model identifiers may change without changing the
capability when these requirements still hold.

## Shared model

### Preflight

Preflight is the work performed before a native goal is active. It may inspect
the request, repository state, applicable instructions, accepted decisions,
manifests, CI configuration, and focused test surfaces. It MUST NOT edit product
files, invoke implementation agents, or consume a separate model call solely
to classify or route the task.

### Goal contract

The goal contract is the compact, host-portable instruction passed to the
native goal. It contains:

- one outcome;
- observable acceptance criteria;
- relevant scope and explicit non-goals;
- applicable repository and task-specific verification;
- preserved local-work and permission boundaries;
- the selected template, semantic profile, model, effort, and stopping budget;
- the final evaluation records required by this capability.

The contract MUST remain concise enough for the narrowest supported native
goal surface. Repository detail already present in the thread or discoverable
from named files SHOULD be referenced rather than copied.

### Templates

Templates shape the goal's definition of done, not its implementation plan.

| Template         | Use when                                                               | Required completion shape                                                                 |
| ---------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `mechanical`     | An exact deterministic oracle covers the requested transformation      | Apply the transformation and make the named oracle pass                                   |
| `bounded-change` | Behavior and scope are clear                                           | Implement the behavior, add or update durable tests, and run scoped gates                 |
| `diagnose-fix`   | A reproducible defect or failing check is the entry point              | Reproduce, establish the cause, fix it, add regression evidence, and rerun the reproducer |
| `migration`      | A public contract, schema, dependency, or cross-boundary shape changes | Preserve approved compatibility, update affected consumers, and run broader gates         |
| `decision-gated` | Product behavior, authority, or safety policy is missing               | Name the smallest decision and do not launch writing work                                 |

One base template is selected per goal. Risk, compatibility, and publication
constraints are contract fields, not additional orchestration phases.

### Semantic profiles

Routing uses stable semantic profiles whose concrete mappings live in one
bundled configuration:

- `fast` — deterministic mechanical work with a complete oracle;
- `standard` — clear, bounded implementation or diagnosis;
- `deep` — architectural, cross-boundary, migration, security-sensitive, or
  materially ambiguous work that is nevertheless approved to proceed.

An explicit user model or effort overrides policy. An unavailable user-pinned
route stops instead of silently substituting another route. A policy-selected
route MAY use its declared fallback and MUST disclose the substitution.

### Launch record

Preflight produces these tab-separated records before activation and carries
them into the native goal's final response:

```text
format\tdarrow-native-goal-preflight-v1
template\t<template>
profile\t<profile>
route\t<harness>\t<provider>\t<model>\t<effort>
launch_boundary\t<same_thread|host_api|nested_session|launch_required>
evaluation_child_invocations\t<integer>
evaluation_human_interruptions\t<integer>
```

`evaluation_child_invocations` counts sessions or subagents created by Darrow,
not internal continuation turns owned by native goal mode. A same-thread launch
therefore reports zero. A `decision-gated` stop reports one human interruption;
ordinary native reasoning and automatic permission review do not.

## `pursue-goal`

### Intent

Compile one engineering request into a bounded native goal and activate it with
the least launch machinery the host supports.

### Input

- a concrete engineering request;
- enough repository access to inspect applicable constraints and checks;
- optional template, route, budget, or permission overrides.

### Output

- a completed native-goal result when activation succeeds;
- the launch record and concise goal contract;
- or the smallest missing decision or launch capability when activation stops.

### Preflight invariants

1. **AGL-P1 — Read-only preflight.** Product files remain unchanged until the
   native goal is active.
2. **AGL-P2 — Repository evidence.** Applicable instructions, accepted
   decisions, pre-existing work, scope, and focused verification are inspected
   before the contract is finalized.
3. **AGL-P3 — No invented intent.** Preflight may make acceptance criteria
   observable but MUST NOT choose materially ambiguous product behavior.
4. **AGL-P4 — One template.** Exactly one template is selected and its choice is
   explained by task evidence.
5. **AGL-P5 — No router call.** Template and route selection occur in the
   current reasoning turn plus deterministic local mechanics; no child model is
   called solely to choose another model.
6. **AGL-P6 — Preserved work.** Pre-existing changes are recorded as user-owned
   and included in the native goal's constraints when overlap is safe. Unsafe
   overlap stops for direction.

### Routing invariants

1. **AGL-R1 — Proportionate profile.** `fast` requires a complete mechanical
   oracle; ordinary engineering work uses at least `standard`; approved
   high-risk or cross-boundary work uses `deep`.
2. **AGL-R2 — Auditable route.** The selected harness, provider, model, effort,
   and any fallback are visible before activation and in the final record.
3. **AGL-R3 — User authority.** Explicit user routing wins. Unavailable pinned
   routes stop honestly.
4. **AGL-R4 — Measured defaults.** Profile mappings change through comparative
   quality, cost, latency, and reliability evidence.
5. **AGL-R5 — Host-native scope.** The goal runs on the current host. Darrow
   does not introduce a cross-vendor planner, verifier, or repair role.

### Launch invariants

1. **AGL-L1 — Native ownership.** Exactly one native goal owns implementation,
   verification, recovery, and completion after activation.
2. **AGL-L2 — Same thread first.** A current-thread native goal tool is used
   whenever it can honor the selected route. A new process MUST NOT be created
   merely for uniformity across hosts.
3. **AGL-L3 — Honest boundary.** `same_thread`, `host_api`, `nested_session`, or
   `launch_required` is reported exactly. A nested process is never described
   as a native child or same-thread continuation.
4. **AGL-L4 — One compatibility session.** A nested fallback is owned by an
   enclosing launcher that has proven its authentication boundary. It creates
   at most one host session and waits for it; Darrow does not supervise retries
   or role fan-out around it.
5. **AGL-L5 — Goal persistence.** The native goal receives the full contract and
   remains active until its own terminal state, user interruption, budget stop,
   or a genuine human decision.
6. **AGL-L6 — Final evidence.** The native goal runs the contract's applicable
   checks against the final tree before claiming completion.

### Safety invariants

1. **AGL-S1 — Permission preservation.** Goal activation grants no authority
   beyond the request and current host policy.
2. **AGL-S2 — Meaningful human gates.** Missing product decisions, destructive
   operations, security or privacy policy, external publication, and new
   authority stop before launch unless already approved.
3. **AGL-S3 — Local publication boundary.** Completion does not authorize a
   branch, commit, push, pull request, merge, release, deployment, or unrelated
   external mutation.
4. **AGL-S4 — Honest blockage.** An unavailable applicable check or launch
   surface is blocked or `launch_required`, never passed by assertion.

## `check-goal-readiness`

### Intent

Report whether the current host can compile and activate each semantic profile
without making a paid model call or changing setup.

### Invariants

1. **AGL-K1 — Static diagnosis.** Readiness inspects bundled mappings, installed
   host tooling, and capabilities already exposed by the current surface.
2. **AGL-K2 — Launch boundaries.** It reports same-thread goal control,
   same-thread model/effort override, supported host API control, and nested
   compatibility separately.
3. **AGL-K3 — No equivalence guesses.** A CLI executable on `PATH` is evidence
   only for a nested boundary, not for same-thread control.
4. **AGL-K4 — Route-local degradation.** Missing optional launch machinery
   disables only affected boundaries or profiles.
5. **AGL-K5 — Read-only.** Readiness does not authenticate, install, edit
   configuration, launch a model, or disclose credential values.

## Packaging and portability

1. **AGL-X1 — Independent plugin.** `darrow-goal-loop` references no sibling
   plugin and requires none to complete a run.
2. **AGL-X2 — Host branches.** Host-specific launch instructions are disclosed
   only after the host is known; the main skill carries the shared sequence.
3. **AGL-X3 — User invocation.** Both skills remain explicitly invoked because
   goal activation can consume meaningful model budget and edit the worktree.
4. **AGL-X4 — Self-contained mappings.** Route configuration and deterministic
   readiness mechanics ship inside the plugin.
5. **AGL-X5 — Portable shell.** Bundled shell mechanics support Bash 5 and
   `/bin/bash` 3.2 and refuse unreadable configuration.

## Evaluation requirements

1. Compare `vanilla`, raw `native-goal`, and `darrow-goal-loop` on the same
   human-authored repository snapshots and task contracts.
2. Treat Darrow's value as the increment from preflight over raw native goal;
   the retired child-controller benchmark remains historical evidence only.
3. Hold harness, candidate model, effort, task, checks, and judge constant
   within a comparison. Record any route change selected by preflight.
4. Measure task pass, quality, wall time, tokens, actual cost when supplied,
   nested sessions, and human interruptions. Internal native continuation turns
   are not Darrow child invocations.
5. Use at least three trials per decision-bearing cell. A one-trial calibration
   may detect gross regressions but cannot promote a default.
6. Include dissimilar task shapes and at least one case for each launch stop:
   missing product intent, unavailable pinned route, and unsafe publication.

## Non-goals

- Supervising planner, executor, verifier, or repair agents.
- Reimplementing native goal persistence, retry, recovery, or completion.
- Building a daemon, queue, workflow database, phase ledger, or task manager.
- Maintaining provider SDKs or cross-vendor role routing.
- Running parallel writers or several candidate implementations.
- Treating preflight as a separate planning model call.
- Guaranteeing that every host exposes same-thread goal and route controls.
- Publishing or deploying the completed local change.
