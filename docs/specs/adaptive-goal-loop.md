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

`adaptive-goal` is a user-authorized **goal compiler and launcher**. It starts
after either direct user invocation or delegation from an orchestration
entrypoint the user explicitly invoked. It performs a read-only preflight in
the current context, emits one compact goal contract, and activates one
host-native goal owner. It does not supervise role agents, infer orchestration
from ordinary engineering intent, or implement a second adaptive loop.

The launch boundary is selected in this order:

1. activate the goal in the current thread through a host-native goal tool;
2. use a supported same-thread host API that can also apply model and effort;
3. on Codex, spawn exactly one first-class, host-visible goal runner when its
   native agent tool can apply the selected model and effort;
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
- the selected independent-review gate, when risk, repository policy, or the
  user requires one, including any explicit user-supplied review limit;
- the final evaluation records required by this capability.

The contract MUST remain concise. Repository detail already present in the
thread or discoverable from named files SHOULD be referenced rather than
copied. Preflight SHOULD keep the complete contract within 4,000 bytes, but it
MUST NOT omit, truncate, or rewrite a material requirement merely to satisfy an
inline native-objective limit.

The **native goal objective** is the bounded value submitted to the host goal
surface. When the complete contract is at most 4,000 bytes, the objective is
that contract inline. When it is larger and the receiving goal owner shares the
launcher's filesystem, the launcher MUST materialize a file-backed objective
before its first goal-set call:

1. copy the complete contract byte-for-byte to a private regular file outside
   the repository, with an absolute path and restrictive permissions;
2. calculate its SHA-256 digest and produce an inline objective of at most
   4,000 bytes that tells the goal owner to read and verify that exact file
   before doing any work;
3. stop before goal activation if the file cannot be materialized or the
   bounded objective cannot be produced; and
4. keep the attachment readable across active and paused states until the goal
   reaches a terminal state, then release it through a validated helper rather
   than reconstructing a destructive command.

If a launcher fails after activation without confirming a terminal goal state,
it MUST retain the attachment and expose the thread identifier, validated
attachment path, and expected digest as resumable lifecycle evidence; it MUST
NOT make a still-active or paused goal's contract unreadable. Once terminal
status is confirmed, the attachment MUST be released even if later terminal
result collection fails.

The goal owner MUST stop with the evidence gap if the attachment is missing,
unreadable, or does not match the expected digest. Oversize handling happens
before activation: a rejected goal-set call MUST NOT trigger lossy
recompaction, truncation, or a second activation attempt. A launch boundary
that does not share a filesystem with its goal owner MUST keep the complete
contract inline or stop honestly; it cannot substitute a local-only pointer.

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

The goal contract MAY include branch, commit, push, pull-request, or other
publication effects only when each effect was explicitly authorized by the
originating request and current host policy. Preflight preserves and enumerates
that authority; it never derives publication authority from successful
implementation or goal completion.

### Independent review composition

Independent review is a conditional capability gate, not an implementation
phase owned by adaptive-goal. Preflight selects it by this policy:

| Situation     | Independent review selection                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Routine risk  | Do not select automatically                                                                     |
| Elevated risk | Select when compatibility, caller impact, or counterexample analysis needs independent judgment |
| High risk     | Select by default                                                                               |
| Any risk      | Select when repository policy or the user requires it                                           |

The compiled contract MUST state `selected` or `omitted` with its reason in
one unambiguous independent-review clause. A selected clause carries the
portable intent, timing, semantic continuation, target invalidation, and
publication block into the native goal owner.
For a structured host-API handoff, selection and reason MUST be separate
validated fields, an explicit user-supplied round limit MUST be the optional
positive-integer `roundLimit` field, and the host launcher MUST generate the
canonical clause. An
omitted limit means progress-bounded convergence with no implicit numeric cap;
it does not mean three rounds. The launcher treats those fields as
authoritative, validates any limit against the originating request, replaces
any redundant classifier-written
`Independent review:` line, and compiles the canonical clause without dropping
material requirements. A missing, mismatched, ambiguous, or unauthorized
limit fails closed. When that complete contract exceeds the native inline
limit, the launcher uses the verified file-backed objective path.

When selected, the goal contract explicitly requests an available environment
capability matching the intent **independently review this pinned code change**
without prescribing its plugin, command, result schema, or serialization. It
MUST NOT name, locate, or read files from a sibling plugin. Before any
repository mutation, the goal owner confirms that the environment exposes a
capability matching that intent. An ad hoc review prompt, generic subagent,
same-context judgment, or capability written during the run is not availability
evidence. When no matching capability is available, the goal stops honestly
instead of synthesizing or downgrading the requirement. A matching capability
may itself use fresh readers; that is its execution machinery, not a substitute
for capability discovery. An availability stop preserves the mandatory
native-goal launch record alongside the evidence gap.

After implementation and applicable final-tree checks, the goal owner supplies
the exact final change, originating objective or specification, repository
standards, and deterministic-check evidence to that capability. The goal owner
starts the review boundary when it begins that capability procedure, including
any exact-target preparation performed as part of the procedure. Until the
capability returns its ordinary response, the goal owner MUST finish only that
capability invocation and MUST NOT perform repository work outside it. A
background launch is not a completed invocation. The goal owner reads the
returned response semantically; it does not require a machine-readable
envelope. The first invocation is one comprehensive review of the exact
current change and establishes a closed finding set. A result with no blocking
findings satisfies the gate for that content. Blocking findings prevent
completion and every not-yet-performed publication effect.

The first rework attempts every eligible finding together. A finding is
eligible only when its repair is already authorized, clearly within the
originating scope, low risk, does not expand requested behavior, and does not
materially expand verification. Every eligible blocker is attempted; an
eligible advisory is also attempted in this first rework. An ineligible blocker
is recorded as blocked and stops convergence. An ineligible advisory remains a
residual risk and never keeps the gate open.

After each rework, the goal owner reruns invalidated checks and invokes the same
independent capability in fix-verification mode. It supplies the original
target and findings, canonical finding order, prior and current target
fingerprints, every attempted finding, prior target history, the prior scope
manifest, any immediately prior verification artifact and carried regression
records, and current check evidence. The capability pins the current scope and
the prior-to-current repair delta mechanically against the prior scope's same
effective base; caller prose does not establish causality. Fix verification is exact-target-bound and may inspect only those
attempts and their direct consequences. It records each attempted finding as
resolved, unresolved, or blocked; an unresolved blocker as progressing or
unchanged; and any direct repair-caused regression tied to the finding whose
repair caused it. Unrelated observations cannot enter the closed convergence
set. Advisories never determine the gate outcome.

`clear` satisfies the exact-content gate. `continue` permits another rework only
when at least one unresolved blocker or repair-caused regression materially
progressed. A direct repair-caused regression first detected by verification is
progressing for one repair attempt; unchanged evidence after that attempt is no
progress. Later rework addresses only unresolved blockers and repair-caused
regressions; it never resumes advisory work. A repeated current target,
unchanged blocking evidence, or a target fingerprint that oscillates to any
earlier state produces `no_progress`. `no_progress`, `blocked`, unavailable or
inconclusive evidence, exhausted repair authority, or an explicit limit stops
the goal with the unsatisfied gate and authorizes no further repair or
publication.

There is no default numeric review or rework limit. Convergence continues only
while the verifier reports material progress. When the originating request
supplies an explicit review-round limit, that number is a hard cap on all
independent-review capability invocations, including the initial comprehensive
review; reaching it stops even otherwise-progressing convergence. A limit
grants no new authority and never permits completion without `clear` evidence
for the exact final content.

On a host with persisted native-goal status, every terminal unsatisfied-review
stop MUST settle the active goal as `blocked` before the goal owner returns. If
the host requires additional turns before accepting the blocked transition,
those automatic continuations are status-settlement turns only: they preserve
the same gate and MUST NOT resume repository inspection, editing, verification,
review, or publication. Review invocations are not native-goal turns. This is
continuation policy compiled into one native goal, not a Darrow-owned retry
controller.

The canonical review capability remains read-only and owns no repair or
publication action. Adaptive-goal owns only selection and the outer continuation
contract. Same-context inspection remains useful verification but never
satisfies a selected independent-review gate.

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

| Risk       | Required verification                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `routine`  | focused acceptance or characterization evidence plus the scoped repository gate                         |
| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample             |
| `high`     | elevated gates plus an adversarial boundary or state-transition check and independent final-tree review |

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
11. **AGL-P11 — Canonical review selection.** Preflight applies the normative
    risk, policy, and user-intent selection policy and, when selected, compiles
    the portable independent-review intent, target binding, and semantic
    continuation into the goal without naming an implementation or output
    format.

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
   host metadata, an accepted host-API turn request, a Codex native-agent spawn
   with concrete route values, transcript-derived Claude child-route evidence
   confirmed against its immutable runner definition, or a successfully
   completed launcher record proves that selected and effective routes are
   identical. Prompt text and model self-report are not application evidence.
   When a Claude child route cannot be observed, the effective model and effort
   are `unknown`; when the observed route mismatches, the effective row records
   that observed tuple. Failed verification never copies the selected tuple into
   the effective row.
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
   receives the full contract inline or reads and verifies the exact
   file-backed contract before doing work, then remains the sole owner until
   its own terminal state, user interruption, budget stop, or a genuine human
   decision. The launcher keeps a file-backed contract readable for that
   lifetime. A Claude Agent runner MUST NOT claim session-scoped `/goal`
   persistence.
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
   replace either value. The task MUST contain the exact workflow document and
   supply the complete contract either inline or through a verified file-backed
   objective on a shared filesystem. The accepted Agent call is the terminal
   boundary and counts as one Darrow child. Because the Agent tool exposes no
   child `/goal` API, this boundary MUST be reported as a native Agent contract
   runner rather than a `/goal` session. After it returns, the parent MUST
   reconcile the child's transcript-derived model and effort with the selected
   route. Missing
   or mismatched transcript evidence records `route_verified=false` and
   `launch_required` instead of successful route application.
10. **AGL-L10 — Codex agent cleanup.** Codex launch instructions SHOULD tell
    each agent creator to collect its child's terminal result and, when the host
    exposes a close control, close that child after its goal has been fulfilled.
    The runner applies the same guidance to descendants it creates. Absence or
    failure of a close control MUST NOT make a spawn-capable native-runner
    boundary unavailable or invalidate an otherwise fulfilled goal. If a child
    becomes unnecessary while active, its creator SHOULD stop or interrupt it
    when the host exposes that control. A claimed close still requires host
    evidence targeting the spawned thread; prompt text and self-report are not
    cleanup evidence.
11. **AGL-L11 — Review-gated continuation.** A selected independent-review gate
    starts when the goal owner begins the matching capability procedure,
    including exact-target preparation. The owner finishes only that invocation
    and awaits its ordinary response before other repository work. The gate
    completes only when one comprehensive initial review and any subsequent
    fix-verification chain reports `clear` for the exact final content. Repairs
    rerun invalidated checks. Each fix verification is bound to the prior
    pinned scope and mechanically rendered repair delta, and every later round
    checksum-links its immediately prior verification artifact and carries its
    regression lifecycle forward. Stale binding, unavailability, inconclusive
    evidence, or a non-clear terminal outcome stops completion.
12. **AGL-L12 — Progress-bounded review convergence.** The initial invocation is
    comprehensive and establishes a closed finding set. First rework attempts
    every eligible blocker and advisory together; later rework addresses only
    unresolved blockers and repair-caused regressions. Fix verification cannot
    introduce unrelated findings, advisories never gate, and convergence
    continues only for materially progressing blockers or regressions. `clear`
    satisfies the gate; `no_progress`, `blocked`, unavailable evidence,
    exhausted authority, repetition, or oscillation stops. There is no implicit
    numeric cap. An explicit user limit is a hard cap on all review invocations
    and stops otherwise-progressing work when reached. A persisted native goal
    settles every terminal unsatisfied gate as `blocked`; host-required
    continuation before that transition is status settlement only and never
    resumes repository work, verification, review, or publication.

### Safety invariants

1. **AGL-S1 — Permission preservation.** Goal activation grants no authority
   beyond the request and current host policy.
2. **AGL-S2 — Meaningful human gates.** Missing product decisions, destructive
   operations, security or privacy policy, external publication, and new
   authority stop before launch unless already approved.
3. **AGL-S3 — No derived publication authority.** A native goal MAY perform a
   branch, commit, push, pull request, or other publication effect only when
   that exact effect was explicitly pre-authorized in the originating request
   and remains permitted by host policy. Goal activation and completion grant
   no additional or subsequent authority. Merge, release, deployment, and
   unrelated external mutation remain unauthorized unless separately explicit.
4. **AGL-S4 — Honest blockage.** An unavailable applicable check or launch
   surface is blocked or `launch_required`, never passed by assertion.
5. **AGL-S5 — Review before publication.** When independent review is selected,
   no not-yet-performed commit, push, pull request, or other publication effect
   may occur after blocking findings or an unavailable or inconclusive review,
   or against content changed after review. A clear review grants no new
   publication authority.

## Packaging and portability

1. **AGL-X1 — Independent plugin.** `darrow-goal-loop` references no sibling
   plugin files or named implementation. Conditional capabilities are requested
   through host-visible intent; a required but unavailable capability stops
   honestly.
2. **AGL-X2 — Host branches.** Host-specific launch instructions are disclosed
   only after the host is known; the main skill carries the shared sequence.
3. **AGL-X3 — Authorized invocation.** The skill accepts direct explicit user
   invocation or one delegated call from an orchestration entrypoint the user
   explicitly invoked. Host metadata permits model invocation so that delegated
   composition can load the skill. An ordinary engineering request, task
   complexity, duration, or number of steps is not invocation authority. A
   delegated call preserves the originating request and authority without
   expanding either; absent direct or delegated authority, the skill stops
   before preflight helper calls, native-goal activation, or worktree mutation
   and returns exactly:

   ```text
   format\tdarrow-adaptive-goal-authority-stop-v1
   status\tinvocation_required
   reason\texplicit-orchestration-entrypoint-required
   ```

4. **AGL-X4 — Self-contained mappings.** Route configuration, canonical risk
   guidance, workflow playbooks, and deterministic route mechanics ship inside
   the plugin.
5. **AGL-X5 — Portable shell.** Bundled shell mechanics support Bash 5 and
   `/bin/bash` 3.2 and refuse unreadable configuration.
6. **AGL-X6 — Environment capability mapping.** Review composition depends only
   on the independent-review intent and semantic outcome, allowing the
   environment to provide implementations with ordinary prose, native command,
   or structured responses.

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
   interruptions, and Codex cleanup-control availability and outcomes.
   Reconcile selected routes and any claimed Codex native-runner cleanup against
   harness-observed application and collaboration records, and include all
   host-reported agent usage in token totals. Internal native continuation turns
   and native descendants are not Darrow child invocations.
5. Use at least three trials per evidence-bearing default decision. An explicit
   product decision MAY accept N=1 uncertainty to simplify or change policy,
   but its rationale, limitations, and follow-up calibration requirement MUST
   be recorded without presenting the result as empirically established.
6. Include dissimilar task shapes and at least one case for each launch stop:
   missing product intent, unavailable pinned route, and unsafe publication.
7. Include activation evidence for direct invocation and an ordinary
   engineering request that must not select the skill. Verify delegated
   invocation with a cross-host parent-to-child composition probe that
   distinguishes an attempted invocation from a loaded child body. Include a
   hostile delegation from an explicitly invoked non-orchestration skill. The
   host MAY reject that chain before loading adaptive-goal; when it loads the
   child, require the exact adaptive-goal authority-stop record. Either boundary
   must stop before preflight or mutation.
8. Repository information architecture MUST be identical across comparison
   cells unless automatic IA setup is the isolated intervention. Benchmark
   guidance routes only to authoritative upstream evidence and MUST NOT expose
   hidden checks or case-specific expected solutions.
9. Report classifier turns, classifier wall time, and classifier token usage
   separately from native-goal execution so lower implementation cost cannot
   hide preflight overhead.
   The reference Codex evaluation runs the prepared classifier on
   `gpt-5.6-terra` at `low` effort; implementation remains on the matched
   per-case route.
10. Evaluate the composable dimensions incrementally: raw native goal, workflow
    only, then workflow plus risk. Hold the implementation route fixed while
    attributing each increment.
11. Include held-out human-authored OSS bug-fix, new-feature, and refactor tasks
    before drawing a workflow-selection conclusion.
12. Evaluate review selection with routine work where review is omitted,
    elevated work where independent judgment is and is not material, high-risk
    work where review is required, an unavailable required capability, a
    blocking-finding repair/verification path with a new target fingerprint, and
    pending-review case that detects repository work between exact-target
    preparation and the ordinary response, and publication pressure after
    blocking findings. Include progress-bounded sequences for several original
    blockers repaired together, one first-rework advisory, a non-gating
    unresolved advisory, a partially successful progressing blocker, unchanged
    evidence, repeated and oscillating targets, a repair-caused regression, and
    an unrelated observation excluded from fix verification. Include an
    explicit user limit that stops otherwise-progressing convergence plus
    unavailable or inconclusive verification under publication pressure. Run
    composition cases on Claude Code and Codex, including ordinary semantic
    responses so orchestration cannot couple itself to one provider's result
    format. Compare matched control and candidate trials for task pass,
    blocked-run rate, review invocations, repair cycles, tokens, wall time,
    false positives, and limitations.

    Representative issue-32 control/candidate evidence and its N=1 limitations
    are recorded in
    [`review-convergence-issue-32.md`](../research/review-convergence-issue-32.md).

13. Exercise native-objective materialization at the 4,000-byte boundary and
    above it. Prove that the oversized contract is preserved byte-for-byte in a
    private file, its submitted pointer remains within the native limit, a
    missing or unreadable input stops before activation, and no rejection-driven
    activation retry is introduced. Cover complete, blocked, paused,
    materialization-validation failure, goal-set rejection, and launcher failure
    lifecycles, including exact-once goal activation and attachment release.

## Non-goals

- Supervising planner, executor, verifier, or repair agents. Native goal mode
  may delegate bounded work through host-visible subagents.
- Reimplementing native goal persistence, retry, recovery, or completion.
- Building a daemon, queue, workflow database, phase ledger, or task manager.
- Maintaining provider SDKs or cross-vendor role routing.
- Running parallel writers or several candidate implementations.
- Treating preflight as a separate planning model call.
- Guaranteeing that every host exposes same-thread goal and route controls.
- Deriving publication authority or implementing Git and forge operations
  itself. An explicitly authorized native goal may use compatible environment
  capabilities for those effects.
- Implementing code-review judgment, fresh reviewer fan-out, or review result
  validation inside adaptive-goal.
