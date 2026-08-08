# Capability: Native Goal Preflight

Darrow should turn a bounded engineering request into a well-framed native
goal, choose a proportionate model route, and activate the host's goal
capability. The host owns execution, persistence, recovery, and completion.
Darrow owns only the preflight policy that improves what the native loop is
asked to achieve.

Plugin: `darrow-goal-loop`  
Skill: `adaptive-goal` (Adaptive Goal Loop)

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
repository constraints and checks, selecting a suitable workflow and risk
gate, and choosing a model and effort proportionate to the work. It must then
get out of the runtime's way.

## Selected design

`adaptive-goal` is a user-invoked **goal compiler and launcher**. It performs a
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

An enclosing host SHOULD assemble deterministic repository evidence before the
classifier turn and request one structured handoff without repository tools.
The classifier selects a goal shape; it does not perform a second exploratory
repository session. Any host optimization MUST preserve the same instruction,
local-work, route, and decision gates as an interactive preflight.

### Goal contract

The goal contract is the compact, host-portable instruction passed to the
native goal. It contains:

- one outcome;
- observable acceptance criteria;
- relevant scope and explicit non-goals;
- applicable repository and task-specific verification;
- preserved local-work and permission boundaries;
- the selected workflow, risk, semantic profile, model, effort, and stopping
  budget;
- the final evaluation records required by this capability.

The contract MUST remain concise enough for the narrowest supported native
goal surface. Repository detail already present in the thread or discoverable
from named files SHOULD be referenced rather than copied.

### Composable goal dimensions

Preflight selects one workflow and one risk level. These dimensions compose; a
domain label is not a template.

The marked intent-routing section in the parent `adaptive-goal` `SKILL.md` is the
canonical policy for workflow, risk, verification depth, and reasoning demand.
It contains the concise selection triggers, tie-breakers, and proportional risk
gates needed before any workflow playbook is visible. Interactive preflight
follows that section directly; prepared classification and execution MUST load
and inject the same section rather than maintaining host-specific copies. The
selected workflow document contains execution detail only and MUST be read after
selection.

The workflow determines the execution sequence:

Each workflow is maintained as its own bundled Markdown playbook under
`skills/adaptive-goal/references/workflows/`. The helper enumerates those files;
it does not flatten their evolving instructions into a TSV catalog. The exact
selected document MUST be loaded into the native execution turn.

| Workflow            | Required sequence                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `fix-bug`           | reproduce, establish cause, add regression evidence, fix, rerun the reproducer and affected gates                                            |
| `implement-feature` | establish the new public behavior, add acceptance evidence, implement, update affected documentation and callers, verify                     |
| `change-feature`    | characterize current behavior and compatibility, update acceptance evidence, implementation, callers and docs, verify old and new boundaries |
| `refactor`          | characterize preserved behavior, restructure in bounded slices, prove behavior remains unchanged, run affected gates                         |
| `migration`         | inventory consumers and compatibility, sequence the migration, update consumers and docs, run broader gates                                  |
| `mechanical`        | apply the exact deterministic transformation and run its complete oracle                                                                     |
| `decision-gated`    | name the smallest missing decision and do not launch writing work                                                                            |

Risk adds proportional verification without changing the workflow:

| Risk       | Required verification                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `routine`  | focused acceptance or characterization evidence plus the scoped repository gate                     |
| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample         |
| `high`     | elevated gates plus an adversarial boundary or state-transition check and broader final-tree review |

### Semantic profiles

Routing uses stable semantic profiles whose concrete mappings live in one
bundled configuration:

- `routine` — ordinary localized coding, including exact mechanical work and
  clear high-risk changes;
- `routine-plus` — ordinary localized coding where its additional quality is
  specifically worthwhile;
- `scaled` — larger straightforward work across several files or components;
- `repo-wide` — straightforward repository-wide change;
- `judgment` — hard diagnosis, architecture, planning, or review.

Risk and profile are independent selections. Risk represents the cost of an
incorrect result and adds verification gates; routing represents the kind and
scale of reasoning needed to reach the result and selects a model route. Risk
alone MUST NOT raise or lower the profile, and reasoning difficulty MUST NOT
weaken the risk gate. Thus a clear security-boundary change can use `high`
verification with a routine coding route, while a difficult
behavior-preserving refactor can use `routine` verification with a judgment
route.

The single bundled policy maps these profiles to host-specific routes:

| Profile        | Codex route                | Claude route                 |
| -------------- | -------------------------- | ---------------------------- |
| `routine`      | `gpt-5.6-luna` / `high`    | `claude-haiku-4-5` / `low`   |
| `routine-plus` | `gpt-5.6-luna` / `xhigh`   | `claude-sonnet-5` / `medium` |
| `scaled`       | `gpt-5.6-terra` / `medium` | `claude-sonnet-5` / `medium` |
| `repo-wide`    | `gpt-5.6-terra` / `high`   | `claude-opus-5` / `high`     |
| `judgment`     | `gpt-5.6-sol` / `high`     | `claude-opus-5` / `high`     |

The GPT-5.6 mappings were promoted after an exploratory N=1 calibration in
which every task contract passed and reconstructed list-price cost was about
72% below raw Sol controls. That result is a product-routing decision under
explicitly accepted uncertainty, not proof of a stable quality or performance
ranking. Continued multi-trial evaluation remains required before claiming a
general advantage. The Claude mappings preserve the plugin's prior model tiers
under the shared task-oriented vocabulary; they have not received equivalent
comparative calibration.

An explicit user model or effort overrides policy. An unavailable user-pinned
route stops instead of silently substituting another route. A policy-selected
route MAY use its declared fallback and MUST disclose the substitution.
Selection alone is not execution. The selected route MUST be applied at the
native-goal boundary and reconciled with the effective provider, model, and
effort before completion can be reported.

An enclosing host API MAY split activation into a read-only preflight turn and
a native-goal execution turn. The preflight handoff names its route source as
`policy` or `user`. A policy-sourced handoff MUST match the bundled mapping for
its semantic profile; a user-sourced handoff MUST correspond to an explicit
route in the engineering request. The enclosing launcher validates the route
against both that source and the live host catalog before starting work.

### Launch record

Preflight produces these tab-separated records before activation and carries
them into the native goal's final response:

```text
format\tdarrow-native-goal-preflight-v4
workflow\t<workflow>
risk\t<routine|elevated|high>
profile\t<profile>
selected_route\t<harness>\t<provider>\t<model>\t<effort>
effective_route\t<harness>\t<provider>\t<model>\t<effort>
route_applied_by\t<current-thread|host-api|nested-session|none>
route_verified\t<true|false>
launch_boundary\t<same_thread|host_api|nested_session|launch_required>
verification_gate\t<routine|elevated|high|not-applicable>
evaluation_child_invocations\t<integer>
evaluation_human_interruptions\t<integer>
```

`evaluation_child_invocations` counts sessions or subagents created by Darrow,
not internal continuation turns owned by native goal mode. A same-thread launch
therefore reports zero. A `decision-gated` stop reports one human interruption;
ordinary native reasoning and automatic permission review do not.

## `adaptive-goal` — Adaptive Goal Loop

### Intent

Compile one engineering request into a bounded native goal and activate it with
the least launch machinery the host supports.

### Input

- a concrete engineering request;
- enough repository access to inspect applicable constraints and checks;
- optional workflow, route, budget, or permission overrides.

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
4. **AGL-P4 — One workflow.** Exactly one workflow is selected and its choice
   is explained by task evidence.
5. **AGL-P5 — No router call.** Dimension and route selection occur in the
   current reasoning turn plus deterministic local mechanics; no child model is
   called solely to choose another model.
6. **AGL-P6 — Preserved work.** Pre-existing changes are recorded as user-owned
   and included in the native goal's constraints when overlap is safe. Unsafe
   overlap stops for direction.
7. **AGL-P7 — Composable dimensions.** Exactly one risk level supplements the
   workflow without changing its execution sequence.
8. **AGL-P8 — Bounded classifier.** A prepared host-API preflight uses one
   structured classifier response and no repository tool calls; deterministic
   evidence assembly is not model work.
9. **AGL-P9 — Canonical intent router.** Interactive and prepared preflight use
   the same parent-skill workflow, risk, and reasoning-demand selection policy.
   Prepared classification extracts that policy from the skill and MUST NOT
   duplicate it in host adapter source.

### Routing invariants

1. **AGL-R1 — Reasoning-based route.** A route is selected from the kind and
   scale of reasoning required, independently of verification risk. Ordinary
   localized work uses `routine` or explicitly justified `routine-plus`, larger
   straightforward work uses `scaled` or `repo-wide`, and hard diagnosis or
   design judgment uses `judgment`. Risk alone does not determine profile.
2. **AGL-R2 — Selected route.** The selected harness, provider, model, effort,
   and any fallback are visible before activation and remain distinct from the
   effective route.
3. **AGL-R3 — User authority.** Explicit user routing wins. Unavailable pinned
   routes stop honestly.
4. **AGL-R4 — Measured defaults.** Profile mappings change through comparative
   quality, cost, latency, and reliability evidence.
5. **AGL-R5 — Host-native scope.** The goal runs on the current host. Darrow
   does not introduce a cross-vendor planner, verifier, or repair role.
6. **AGL-R6 — Applied route.** Goal activation explicitly applies the selected
   provider, model, and effort. A same-thread route must already match; a host
   API turn or nested launcher must pass the selected values explicitly.
7. **AGL-R7 — Authoritative reconciliation.** `route_verified` is true only when
   host metadata, an accepted host-API turn request, or a successfully completed
   launcher record proves that selected and effective routes are identical.
   Prompt text and model self-report are not application evidence.
8. **AGL-R8 — Profile-route integrity.** A policy-sourced host handoff matches
   the bundled model and effort for its named semantic profile. Only an
   explicit user route may bypass that mapping, and it remains subject to live
   catalog validation.

### Launch invariants

1. **AGL-L1 — Native ownership.** Exactly one native goal owns implementation,
   verification, recovery, and completion after activation.
2. **AGL-L2 — Same thread when exact.** A current-thread native goal tool is used
   only when the active provider, model, and effort exactly match the selected
   route. A new process MUST NOT be created merely for uniformity across hosts,
   but an unmatched current turn MUST NOT masquerade as the selected route.
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
7. **AGL-L7 — Proportional verification.** Native completion follows the
   selected workflow and satisfies the verification gates required by the
   selected risk level.

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

## Packaging and portability

1. **AGL-X1 — Independent plugin.** `darrow-goal-loop` references no sibling
   plugin and requires none to complete a run.
2. **AGL-X2 — Host branches.** Host-specific launch instructions are disclosed
   only after the host is known; the main skill carries the shared sequence.
3. **AGL-X3 — User invocation.** The skill remains explicitly invoked because
   goal activation can consume meaningful model budget and edit the worktree.
4. **AGL-X4 — Self-contained mappings.** Route configuration, canonical risk
   guidance, workflow playbooks, and deterministic route mechanics ship inside
   the plugin.
5. **AGL-X5 — Portable shell.** Bundled shell mechanics support Bash 5 and
   `/bin/bash` 3.2 and refuse unreadable configuration.

## Evaluation requirements

1. Compare raw `native-goal`, workflow-only preflight, and workflow-plus-risk
   preflight on the same human-authored repository snapshots and task contracts.
2. Treat Darrow's value as the increment from preflight over raw native goal;
   the retired child-controller benchmark remains historical evidence only.
3. Hold the classifier route, task, checks, and judge constant. Record the
   selected and effective implementation routes separately. When profile
   routing changes model or effort, compare against raw-native and vanilla
   controls run on those same effective routes rather than attributing a model
   change to preflight.
4. Measure task pass, quality, wall time, tokens, actual cost when supplied,
   nested sessions, and human interruptions. Reconcile selected routes against
   harness-observed application records and include reconciled nested usage in
   token totals. Internal native continuation turns are not Darrow child
   invocations.
5. Use at least three trials per evidence-bearing default decision. An explicit
   product decision MAY accept N=1 uncertainty to simplify or change policy,
   but its rationale, limitations, and follow-up calibration requirement MUST
   be recorded without presenting the result as empirically established.
6. Include dissimilar task shapes and at least one case for each launch stop:
   missing product intent, unavailable pinned route, and unsafe publication.
7. Repository information architecture MUST be identical across comparison
   cells unless automatic IA setup is the isolated intervention. Benchmark
   guidance routes only to authoritative upstream evidence and MUST NOT expose
   hidden checks or case-specific expected solutions.
8. Report classifier turns, classifier wall time, and classifier token usage
   separately from native-goal execution so lower implementation cost cannot
   hide preflight overhead.
   The reference Codex evaluation runs the prepared classifier on
   `gpt-5.6-terra` at `low` effort; implementation remains on the matched
   per-case route.
9. Evaluate the composable dimensions incrementally: raw native goal, workflow
   only, then workflow plus risk. Hold the implementation route fixed while
   attributing each increment.
10. Include held-out human-authored OSS bug-fix, new-feature, and refactor tasks
    before drawing a workflow-selection conclusion.

## Non-goals

- Supervising planner, executor, verifier, or repair agents.
- Reimplementing native goal persistence, retry, recovery, or completion.
- Building a daemon, queue, workflow database, phase ledger, or task manager.
- Maintaining provider SDKs or cross-vendor role routing.
- Running parallel writers or several candidate implementations.
- Treating preflight as a separate planning model call.
- Guaranteeing that every host exposes same-thread goal and route controls.
- Publishing or deploying the completed local change.
