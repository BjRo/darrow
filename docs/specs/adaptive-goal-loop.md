# Capability: Native Goal Preflight

Darrow should turn a bounded engineering request into a well-framed native
goal contract, choose a proportionate model route, and activate the host's
narrowest goal-capable boundary. The host owns execution, recovery, and
completion.
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
request + repository -> preflight -> host goal owner -> native completion
```

Preflight can improve the native run by making completion explicit, discovering
repository constraints and checks, selecting a suitable workflow and risk
gate, and choosing a model and effort proportionate to the work. It must then
get out of the runtime's way.

## Selected design

`adaptive-goal` is a user-invoked **goal compiler and launcher**. It performs a
read-only preflight in the current context, emits one compact goal contract,
and activates one host-native goal owner. It does not supervise role agents or
implement a second adaptive loop.

The launch boundary is selected in this order:

1. activate the goal in the current thread through a host-native goal tool;
2. use a supported same-thread host API that can also apply model and effort;
3. on Codex, spawn exactly one first-class, host-visible goal runner when its
   native agent tools can apply the selected model and effort and explicitly
   close the runner after its result is collected;
4. on Claude, spawn exactly one first-class, host-visible foreground Agent
   runner when a route-specific plugin agent pins the selected concrete model
   and effort;
5. let a supported enclosing launcher start one disclosed host session only
   when the user explicitly authorizes process nesting;
6. stop as `launch_required` when none of those boundaries is available.

This order is normative. A native goal runner is an observable host agent
thread, not a shell process or Darrow role controller. A Codex runner activates
the native goal tool. Claude does not expose its session-scoped `/goal` command
to Agent-tool children, so a Claude runner owns the compiled contract as its
single foreground delegated task and MUST NOT claim `/goal` evaluator turns or
persistence. Process nesting is an explicit compatibility boundary, never an
automatic interactive fallback.

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
- the selected workflow, risk, semantic profile, model, effort, and any
  user-specified stopping budget;
- the final evaluation records required by this capability.

The contract MUST remain concise enough for the narrowest supported native
goal surface. Repository detail already present in the thread or discoverable
from named files SHOULD be referenced rather than copied.

The contract MUST distinguish **feedback checks** from **final-tree checks**.
Feedback checks are the smallest repository-supported commands that exercise
the changed seam during implementation, such as one test target, an
affected-package typecheck, or a narrow build or lint command. When a workflow
introduces acceptance or regression evidence at a stable seam with an
independent oracle, the goal owner MUST run that evidence before the
corresponding production change, confirm that it fails for the intended reason,
and rerun it after each coherent slice. For a behavior-preserving workflow, the
focused evidence begins green and stays green after each slice. Final-tree
checks are the applicable scoped repository gate plus the selected risk gate.
They MUST NOT serve as routine implementation feedback: run them once after
implementation and affected callers or documentation appear complete, and rerun
them only after later edits invalidate that result. Repository instructions that
require a different cadence take precedence; the goal MUST NOT invent a seam,
oracle, or command merely to imitate test-first work.

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

Routing uses stable semantic profiles whose concrete mappings live in bundled
configuration by default:

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

The bundled default policy maps these profiles to host-specific routes:

| Profile        | Codex route                | Claude route                 |
| -------------- | -------------------------- | ---------------------------- |
| `routine`      | `gpt-5.6-terra` / `medium` | `claude-sonnet-5` / `low`    |
| `routine-plus` | `gpt-5.6-terra` / `high`   | `claude-sonnet-5` / `medium` |
| `scaled`       | `gpt-5.6-terra` / `medium` | `claude-sonnet-5` / `medium` |
| `repo-wide`    | `gpt-5.6-terra` / `high`   | `claude-opus-5` / `high`     |
| `judgment`     | `gpt-5.6-sol` / `high`     | `claude-opus-5` / `high`     |

The original GPT-5.6 mappings were promoted after an exploratory N=1
calibration in which every task contract passed and reconstructed list-price
cost was about 72% below raw Sol controls. The observable native-runner design
later moved the two Luna profiles to Terra because the tested first-class
spawn surface accepts Terra and Sol but not Luna. Neither observation proves a
stable quality or performance ranking, and the earlier cost result does not
validate the revised routine routes. Continued multi-trial evaluation remains
required. The Claude mappings have not received equivalent comparative
calibration. The routine route uses Sonnet 5 rather than Haiku 4.5 because
current Claude Code does not support explicit effort on Haiku 4.5; exact
`Haiku 4.5 / low` application is unavailable.

An active worktree root MAY provide `.darrow/config.json` using the same strict
`{"routes":[...]}` route-object schema. Each valid repository entry replaces
the bundled entry with the same `(host, profile)`; omitted entries retain the
bundled policy. A present repository configuration MUST be readable, safe,
well-formed, duplicate-free, catalog-known, and host/harness-consistent. Any
validation failure MUST stop route preparation and selection without falling
back to bundled policy. The helper resolves both `prepare --repo` and
`route --repo` against that same active worktree root. Prepared evidence MUST
identify each policy route as `repository` or `bundled` without changing its
separate `policy` versus explicit `user` authority.

An explicit user model or effort overrides policy. An unavailable user-pinned
route stops instead of silently substituting another route. A policy-selected
route MAY use its declared fallback and MUST disclose the substitution.
Selection alone is not execution. The selected route MUST be applied at the
native-goal boundary and reconciled with the effective provider, model, and
effort before completion can be reported.

An enclosing host API MAY split activation into a read-only preflight turn and
a native-goal execution turn. The preflight handoff names its route source as
`policy` or `user`, and policy routes additionally name `repository` or
`bundled` provenance. A policy-sourced handoff MUST match the prepared
active-worktree mapping for its semantic profile; a user-sourced handoff MUST
correspond to an explicit route in the engineering request. The enclosing
launcher validates the route against both that source and the live host catalog
before starting work.

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
route_applied_by\t<current-thread|host-api|native-subagent|nested-session|none>
route_verified\t<true|false>
launch_boundary\t<same_thread|host_api|native_subagent|nested_session|launch_required>
verification_gate\t<routine|elevated|high|not-applicable>
evaluation_child_invocations\t<integer>
evaluation_human_interruptions\t<integer>
```

`evaluation_child_invocations` counts sessions or subagents created by Darrow,
not internal continuation turns or helper subagents created by native goal
mode. A same-thread launch therefore reports zero and a native goal runner
reports one. Native descendants remain visible through host telemetry. A
`decision-gated` stop reports one human interruption; ordinary native reasoning
and automatic permission review do not.

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
10. **AGL-P10 — Compiled verification cadence.** The goal contract names
    feedback checks separately from final-tree checks. It preserves applicable
    repository cadence, workflow-specific evidence ordering, and the honest
    limitation when no stable seam, independent oracle, or focused command
    exists.

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
   API turn or nested launcher passes the selected values explicitly. A Codex
   native-agent spawn passes model and effort on the spawn request. A Claude
   native-agent spawn selects the immutable plugin-agent definition whose full
   model ID and effort both match, after rejecting conflicting environment
   overrides.
7. **AGL-R7 — Authoritative reconciliation.** `route_verified` is true only when
   host metadata, an accepted host-API turn request, an accepted native-agent
   spawn with concrete route values or an immutable route-matched Claude agent
   definition, or a successfully completed launcher record proves that selected
   and effective routes are identical. Prompt text and model self-report are not
   application evidence.
8. **AGL-R8 — Profile-route integrity.** A policy-sourced host handoff matches
   the prepared active-worktree model and effort for its named semantic profile,
   with repository-or-bundled provenance disclosed. Only an
   explicit user route may bypass that mapping, and it remains subject to live
   catalog validation.

### Launch invariants

1. **AGL-L1 — Native ownership.** Exactly one host-native goal owner owns
   implementation, verification, recovery, and completion after activation.
   This is a native goal on a surface that exposes goal control or the one
   foreground Claude Agent runner allowed by AGL-L9.
2. **AGL-L2 — Same thread when exact.** A current-thread native goal tool is used
   only when the active provider, model, and effort exactly match the selected
   route. A new process MUST NOT be created merely for uniformity across hosts,
   but an unmatched current turn MUST NOT masquerade as the selected route.
3. **AGL-L3 — Honest boundary.** `same_thread`, `host_api`,
   `native_subagent`, `nested_session`, or `launch_required` is reported
   exactly. A nested process is never described as a native child or
   same-thread continuation.
4. **AGL-L4 — Explicit compatibility session.** A nested process is owned by an
   enclosing launcher that has proven its authentication boundary and received
   explicit user authorization. It creates at most one host session and waits
   for it; an interactive skill MUST NOT select it automatically.
5. **AGL-L5 — Goal persistence.** The native goal or allowed Claude Agent runner
   receives the full contract and remains the sole owner until its own terminal
   state, user interruption, budget stop, or a genuine human decision. A Claude
   Agent runner MUST NOT claim session-scoped `/goal` persistence.
6. **AGL-L6 — Final evidence.** The host-native goal owner runs the contract's
   applicable final-tree checks after implementation, affected callers, and
   documentation are complete and before claiming completion. A narrow
   feedback pass does not substitute for those checks.
7. **AGL-L7 — Proportional verification.** Native completion follows the
   selected workflow, uses the compiled feedback cadence while implementing,
   and satisfies the final verification gates required by the selected risk
   level.
8. **AGL-L8 — Observable goal runner.** When in-place Codex activation cannot
   apply the selected route, Darrow MAY create exactly one first-class native
   agent thread with explicit model and effort. That runner owns the one native
   goal. Host-native delegation beneath it remains visible and is not
   Darrow-defined planner, executor, verifier, or repair fan-out.
9. **AGL-L9 — Observable Claude goal runner.** When in-place Claude activation
   cannot apply the selected route, Darrow MAY invoke exactly one foreground
   plugin subagent. Its route-specific definition MUST pin both the selected
   full model ID and effort; family aliases are not exact route evidence. The
   launch MUST fail before spawning when a process environment override would
   replace either value. The task MUST contain the complete contract and exact
   workflow document. The accepted Agent call is the terminal boundary and
   counts as one Darrow child. Because the Agent tool exposes no child `/goal`
   API, this boundary MUST be reported as a native Agent contract runner rather
   than a `/goal` session.
10. **AGL-L10 — Codex agent cleanup.** A Codex native-runner boundary is
    available only when the host exposes both spawn and close controls. The
    runner MUST collect and explicitly close every descendant it creates as
    soon as no follow-up is needed. After collecting the runner's terminal
    result, its parent MUST explicitly close that same runner before returning.
    If a child becomes unnecessary while active, its creator MUST stop or
    interrupt it, wait for a terminal state, and close it. A completed close
    call targeting the spawned thread is cleanup evidence; prompt text and
    self-report are not.

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
   native goal runners, native descendant agents, nested sessions, human
   interruptions, and unclosed Codex agent threads. Reconcile selected routes
   and Codex native-runner cleanup against harness-observed application and
   collaboration records, and include all host-reported agent usage in token
   totals. Internal native continuation turns and native descendants are not
   Darrow child invocations.
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

- Supervising planner, executor, verifier, or repair agents. Native goal mode
  may delegate bounded work through host-visible subagents.
- Reimplementing native goal persistence, retry, recovery, or completion.
- Building a daemon, queue, workflow database, phase ledger, or task manager.
- Maintaining provider SDKs or cross-vendor role routing.
- Running parallel writers or several candidate implementations.
- Treating preflight as a separate planning model call.
- Guaranteeing that every host exposes same-thread goal and route controls.
- Publishing or deploying the completed local change.
