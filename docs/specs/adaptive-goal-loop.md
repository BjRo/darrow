# Capability: Native Goal Preflight

Darrow should turn a bounded engineering request into a well-framed native
goal contract, choose a proportionate model route, and activate the host's
narrowest goal-capable boundary. The host owns execution, recovery, and
completion.
Darrow owns the preflight policy and deterministic protocol validation that
improve what the native loop is asked to achieve.

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

The bundled helper maintains a private, temporary protocol-evidence ledger for
one explicitly invoked run. That ledger authenticates the ordering and inputs
of preflight, route selection, objective materialization, activation evidence,
readiness verdicts, review outcomes, cleanup, and terminal reporting. It is not an execution
controller: it never schedules work, invokes a model or capability, selects a
repair, retries a failed phase, or decides whether semantic work should
continue. The one host-native goal owner retains all implementation,
adaptation, recovery, review-invocation, and completion judgment.

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
thread, not a shell process or Darrow role controller. A first-class Codex
runner is itself the host-native owner boundary for the compiled contract. It
attaches the exact materialized objective to itself once for native persistence
before mutation; unavailable persistence stops the run. That persisted state
belongs to the existing owner and is not a second owner boundary.
Claude does not expose its session-scoped `/goal` command to Agent-tool
children, so a Claude runner owns the compiled contract as its single
foreground delegated task and MUST NOT claim `/goal` evaluator turns or
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
files, execute a focused check, test, build, lint, review, or verification
command, invoke implementation agents, or consume a separate model call solely
to classify or route the task. Imperative implementation, check, and review
steps in the originating request are owner instructions to compile into the
contract; their wording does not authorize the classifier to execute them
before activation.

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
- whether the implementation-readiness gate is selected and why, plus its
  portable pre-mutation continuation clause when selected;
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
   before doing any work, and that the accepted ownership-marked task makes it
   the sole work owner while native goal control persists that same contract;
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

### Implementation-readiness composition

Implementation readiness is an optional intent-matched capability gate, not a
planning or assessment phase owned by adaptive-goal. Preflight selects it by
this policy:

| Situation                                                                                                      | Readiness selection                                                         |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| The request derives its authority from an unassessed ticket, specification, or explicitly accepted plan        | Select by default                                                           |
| Repository policy, the user, or a delegating orchestration explicitly requires readiness                       | Select                                                                      |
| The request is a bounded conversational request without an authoritative artifact                              | Omit                                                                        |
| Preserved context establishes that the same current authority and scope already completed readiness assessment | Omit                                                                        |
| The user explicitly skips the default gate                                                                     | Omit unless repository policy or delegating orchestration still requires it |

An explicitly accepted plan is authoritative whether it is persisted in a file
or accepted in the preserved conversation. Prior assessment is contextual and
semantic: it exists when preserved context records that readiness was completed
and every blocking finding was resolved for the same authority and scope. A
mere assertion that assessment happened is not evidence. Material changes to
scope, acceptance criteria, the authoritative source, or applicable constraints
invalidate that evidence when another readiness assessment can change whether
implementation should start. Irrelevant edits do not force a redundant gate.

The compiled contract MUST state exactly one `Readiness gate: selected —
<reason>` or `Readiness gate: omitted — <reason>` line. For a structured
host-API handoff, `darrow-native-goal-handoff-v4` carries the authoritative
selection and reason in a separate `readinessGate` object. The classifier omits
the prose line from `goalContract`; the enclosing launcher validates the
structured decision, removes any redundant classifier-written line, and
compiles the canonical clause. Missing, empty, contradictory, or extra
readiness fields fail closed.

When selected, the clause requests an available environment capability matching
the intent **assess implementation readiness of this authoritative request**.
It MUST NOT name or assume a plugin, sibling path, readiness-capability command, or result
serialization, and composition alone MUST NOT request JSON. The read-only
classifier or enclosing launcher proves before activation that the host exposes
a compatible capability. Generic delegation, an ad hoc assessment prompt, or a
capability created during the run is not availability evidence. When the gate
is unavailable, preflight records `readiness-unavailable`, performs no product
mutation, and stops as `launch_required` with `Implementation readiness
availability: unavailable.`

The goal owner invokes the proven capability after activation and before any
repository or external mutation. The portable clause matches the composition
contract in `implementation-readiness.md`: continue only on an explicit
`ready`; otherwise stop and preserve the complete readiness result and smallest
next action. A ready result returns its concrete quality bar to the goal owner
without adding implementation or publication authority. A non-ready result
settles the enclosing goal as blocked and permits no product mutation. It is a
terminal gate result, not a newly emerged human-feedback question; the generic
feedback-pause rule MUST NOT convert it into a resumable pause.

Readiness selection and outcome are protocol-ledger evidence. Routing records
`selected` or `omitted`. A selected gate activates into a readiness-pending
state, and the owner records exactly one semantic verdict through the bundled
helper before work. Only `ready` unlocks the ordinary active state;
`needs-discovery`, `needs-decision`, or `blocked` closes the mutation gate and
allows only terminal collection, cleanup, and reporting. For a
filesystem-sharing delegated owner, the selected clause identifies the
launcher's absolute bundled `goal-loop` executable solely for that evidence
call against `Protocol ledger:`. The ledger stores the semantic selection and
verdict, not the capability's complete result, and never invokes or parses the
capability itself.

When a selected readiness gate returns non-ready, the complete human-readable
readiness result is the first response content. The exact helper-rendered native
goal report follows it as the required outer record. This narrow ordering
exception preserves both contracts; `darrow-readiness-gate` remains unchanged.

### Independent review composition

Independent review is a conditional capability gate, not an implementation
phase owned by adaptive-goal. Preflight selects it by this policy:

| Situation     | Independent review selection                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Routine risk  | Do not select automatically                                                                     |
| Elevated risk | Select when compatibility, caller impact, or counterexample analysis needs independent judgment |
| High risk     | Select by default                                                                               |
| Any risk      | Select when repository policy or the user requires it                                           |

A persisted-format coexistence transition that coordinates a writer, a
dual-format reader, a migration utility, and multiple consumers needs
independent compatibility judgment, so it selects review under the elevated
risk rule.

The compiled contract MUST state `selected` or `omitted` with its reason in
one unambiguous independent-review clause. A selected clause carries the
portable intent, timing, semantic continuation, target invalidation, and
publication block into the native goal owner.
For a filesystem-sharing delegated owner, that selected clause also identifies
the launcher's absolute bundled `goal-loop` executable solely so the owner can
record each returned semantic review outcome against the contract's
`Protocol ledger:` path. This protocol-helper reference does not select, name,
or prescribe the independent-review capability itself. A delegated owner MUST
stop before mutation when selected review is required but either protocol path
is absent.
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
capability matching that intent. The read-only classifier or enclosing launcher,
not the implementation owner, proves that availability before activation. An ad hoc review prompt, generic subagent,
same-context judgment, or capability written during the run is not availability
evidence. When no matching capability is available, the goal stops honestly
instead of synthesizing or downgrading the requirement. A matching capability
may itself use fresh readers; that is its execution machinery, not a substitute
for capability discovery. An availability stop preserves the mandatory
human-readable completion report alongside the evidence gap and includes the
standalone canonical sentence `Independent review availability: unavailable.`

This capability check is part of read-only preflight. A known selected review
gate MUST be proven available before the goal owner edits product files; the
owner cannot implement first and disclose the missing gate afterward.

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
For ledger evidence, the owner passes either the reviewer's exact literal
target fingerprint for helper-side SHA-256 derivation or an already-derived
SHA-256. It MUST NOT recreate that hashing through shell variables,
substitutions, command lists, redirects, or pipelines.

A preexisting candidate described as review-ready is not already-verified
evidence. Before the initial comprehensive review, the owner MUST run every
applicable exact-target check required by the selected risk gate against that
candidate and supply the resulting current evidence to the review capability.
The candidate's current content is the first review target: the owner MUST NOT
edit it before that review returns, even when an exact-target check fails or the
content already differs from the approved final outcome. Any authorized repair
starts only from the review's closed finding set.

The caller-facing completion text MUST make the semantic outcome explicit. A
clear initial review uses the standalone canonical sentence `Independent
review: clear.` on its own unquoted line. An optional Markdown bullet or
balanced strong emphasis around the label or the entire exact sentence is
presentation, not a semantic change. Prose paraphrases, negated framing, quotations, and qualified or
ambiguous continuations do not satisfy this outcome. After repair, retain both
`Initial independent review: blocking — <finding>` and
the standalone sentence `Fix verification: clear.` (or the actual non-clear
outcome) so the prior
finding and exact-target verification remain visible without depending on a
provider-specific serialization. Supporting detail belongs on another line;
the canonical outcome sentence has no suffix. It preserves the verifier's
returned outcome verbatim even when an explicit limit converts the overall
review gate to `blocked`; the separate review-gate sentence reports that stop.
An initial blocking result that cannot be repaired is reported on its own line
as `Independent review: blocking — <finding>`.

An initial `unavailable`, `inconclusive`, or otherwise terminal unsatisfied
review outcome never replaces the outer launch result. Before returning, the
owner MUST append the complete human-readable completion report defined below,
including the truthful blocked review-gate state and counters.

The first rework attempts every eligible finding together. A finding is
eligible only when its repair is already authorized, clearly within the
originating scope, low risk, does not expand requested behavior, and does not
materially expand verification. Every eligible blocker is attempted; an
eligible advisory is also attempted in this first rework. An ineligible blocker
is recorded as blocked and stops convergence. An ineligible advisory remains a
residual risk and never keeps the gate open.

One rework performs at most one authorized repair attempt per finding. After
that attempt, the goal owner runs the invalidated checks and requests fix
verification; it MUST NOT self-iterate on the same finding before that response.
A second attempt belongs to a later rework and is available only when
verification returns `continue` and existing authority covers it.

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

Check evidence established after the latest content edit and supplied to fix
verification remains final-tree evidence for that exact content. The review
response does not itself invalidate those checks. If that response reaches an
explicit limit or another terminal stop without authorizing a later edit, the
goal owner MUST NOT rerun a check after the response. With selected review,
the last final-tree check for an exact target occurs before its review
invocation; a post-review check is not final verification and is forbidden
after a terminal response.

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

Before every fix-verification invocation after the first, the owner MUST compare
the prospective current target fingerprint with the complete prior target
history. When the verifier's requested later repair would restore exact content
already present in that history, the owner MUST reject it before editing the
current target or rerunning its checks. A repeated or earlier fingerprint stops
as `no_progress` before the capability is invoked; the owner MUST NOT make a
redundant verification call.
Because no new verifier result exists in that branch, caller-facing text
preserves the latest returned `Fix verification: continue.` outcome and reports
the separate repeated-target or oscillation `no_progress` stop explicitly. It
MUST NOT synthesize `Fix verification: no_progress.` unless the capability
actually returned that outcome.

There is no default numeric review or rework limit. Convergence continues only
while the verifier reports material progress. When the originating request
supplies an explicit review-round limit, that number is a hard cap on all
independent-review capability invocations, including the initial comprehensive
review; reaching it stops even otherwise-progressing convergence. A limit
grants no new authority and never permits completion without `clear` evidence
for the exact final content. A terminal stop caused by that limit MUST report
the standalone canonical sentence `Review gate: blocked — explicit limit
reached.`

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
| `mechanical`        | apply the exact deterministic non-behavioral transformation and run its complete oracle                                                      |
| `decision-gated`    | name the smallest missing decision and do not launch writing work                                                                            |

`decision-gated` is terminal preflight, not a selected route waiting for
application. Its completion report MUST use `profile: none`, `harness: none`,
`model: none > none`, `effort: none`, `route_applied_by: none`,
`route_verified: false`, `launch_boundary: launch_required`,
`verification_gate: not-applicable`, zero child invocations, and one human
interruption. It MUST NOT copy a selected route or an ordinary launch boundary
into those fields.

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
  clear, fully specified changes regardless of consequence severity;
- `routine-plus` — ordinary localized coding only when implementation itself
  needs additional reasoning, such as an explicit priority on
  boundary-sensitive first-pass correctness over the cheapest routine route or
  repository evidence of materially competing implementations;
- `scaled` — larger straightforward work across several files or components;
- `repo-wide` — straightforward repository-wide change;
- `judgment` — hard diagnosis, architecture, planning, or review.

Profile selection uses the reasoning uncertainty established by the request
and permitted read-only preflight at activation time. A request that explicitly
identifies an unresolved hard diagnosis across multiple plausible layers or
state transitions is `judgment`; finding a small eventual patch or recognizing
the cause after activation MUST NOT retroactively downgrade that route.

A sequenced transition spanning a producer or writer, compatibility reader,
migration utility, and multiple consumers is `scaled`. Short individual edits
or a compact repository do not reduce that multi-component implementation to
`routine`.

Risk and profile are independent selections. Risk represents the cost of an
incorrect result and adds verification gates; routing represents the kind and
scale of reasoning needed to reach the result and selects a model route. Risk
alone, a security boundary, and added verification work MUST NOT raise or lower
the profile when implementation behavior is clear and fully specified;
reasoning difficulty MUST NOT weaken the risk gate. Thus a clear
security-boundary change can use `high` verification with a routine coding
route, while a difficult
behavior-preserving refactor can use `routine` verification with a judgment
route.

Changing an existing promised output for inputs that callers may already use
is a compatibility concern. When the request requires compatibility evidence
for that contract change, risk is at least `elevated` even if the edit itself is
localized and reversible.

The bundled default policy maps these profiles to host-specific routes:

| Profile        | Codex route                | Claude route                 |
| -------------- | -------------------------- | ---------------------------- |
| `routine`      | `gpt-5.6-luna` / `medium`  | `claude-sonnet-5` / `low`    |
| `routine-plus` | `gpt-5.6-luna` / `high`    | `claude-sonnet-5` / `medium` |
| `scaled`       | `gpt-5.6-terra` / `medium` | `claude-sonnet-5` / `medium` |
| `repo-wide`    | `gpt-5.6-terra` / `high`   | `claude-opus-5` / `high`     |
| `judgment`     | `gpt-5.6-sol` / `high`     | `claude-opus-5` / `high`     |

The Codex localized defaults were promoted from Terra to Luna after matched
N=3 trials on two dissimilar, fully specified implementation tasks. At both
medium and high effort every Terra and Luna trial passed the same hidden checks
with no escaped defects. Luna medium reduced aggregate wall time by 14.6%; Luna
high was effectively wall-time neutral in aggregate, with opposite per-case
results. Host-reported token totals also favored Luna, but the harness did not
supply actual cost and its cumulative token accounting is too noisy for a
precise cost claim. This evidence supports the localized defaults only; it does
not justify changing the untested `scaled`, `repo-wide`, or `judgment` routes,
and broader held-out calibration remains required. The Claude mappings have not
received equivalent comparative calibration. The routine route uses Sonnet 5
rather than Haiku 4.5 because current Claude Code does not support explicit
effort on Haiku 4.5; exact `Haiku 4.5 / low` application is unavailable.

An active worktree root MAY provide one shared `.darrow/config.json` object
with independent `routes` and `reviewers` sections. The goal-loop capability
owns only `routes`; it MUST syntax-check but otherwise ignore `reviewers`. Each
valid repository route replaces the bundled entry with the same
`(host, profile)`; an absent or empty `routes` section and omitted entries retain
bundled policy. A present repository configuration MUST be readable and well-formed as
a whole, while every owned route MUST be safe, duplicate-free, catalog-known,
and host/harness-consistent. Any validation failure MUST stop route preparation
and selection without falling back to bundled policy. The helper resolves both
`prepare --repo` and `route --repo` against that same active worktree root.
Prepared evidence MUST identify each policy route as `repository` or `bundled`
without changing its separate `policy` versus explicit `user` authority.

An explicit user model or effort overrides policy. An unavailable user-pinned
route stops instead of silently substituting another route. A policy-selected
route MAY use its declared fallback and MUST disclose the substitution.
Selection alone is not execution. The selected route MUST be applied at the
native-goal boundary and reconciled with the effective provider, model, and
effort before completion can be reported.

Route identity and launch mechanics are separate evidence. The effective route
is the `(model, effort)` pair after the host and provider are fixed by the
boundary; `fork_turns` is launch policy, not part of route identity. A host that
emits a normalized accepted route record lets an evaluator compare that one
pair atomically. Current Codex CLI collaboration events redact native-agent
spawn arguments: they prove that one native runner was accepted, but do not
independently expose its model or effort. On that surface, evaluation MUST
report the limitation and reconcile the declared selected/effective pair with
an accepted spawn whose observable prompt begins with the canonical
`- phase: adaptive-goal-runner` ownership marker; an unrelated generic spawn is
not goal-owner evidence. It MUST NOT pretend that unavailable `model`,
`reasoning_effort`, or `fork_turns` event fields were observed.

The receiver of that first-line marker is already the activated sole work
owner. It executes the supplied contract directly and MUST NOT recursively run
adaptive-goal preflight or seek another owner. Before mutation, that receiver
MUST persist the exact contract through its native goal control and confirm the
same objective active in its thread. This persistence does not introduce a
second work owner. Missing or unconfirmed native goal control leaves the work
owner visible but requires an honest `launch_required` result without mutation.

An enclosing host API MAY split activation into a read-only preflight turn and
a native-goal execution turn. The preflight handoff names its route source as
`policy` or `user`, and policy routes additionally name `repository` or
`bundled` provenance. A policy-sourced handoff MUST match the prepared
active-worktree mapping for its semantic profile; a user-sourced handoff MUST
correspond to an explicit route in the engineering request. The enclosing
launcher validates the route against both that source and the live host catalog
before starting work.

### Launch record and completion report

Preparation, routing, materialization, activation, readiness, review, cleanup,
and terminal reporting produce `darrow-goal-step-v1` evidence records in
prerequisite order.
The helper-owned protocol ledger MUST carry the internal workflow, risk,
profile, selected and effective routes, application boundary, verification,
counters, fixed helper evidence mode, and cleanup values. The compiled goal contract
carries the exact `Protocol ledger: <absolute path>` reference and the
completion-report requirement but MUST NOT duplicate those internal records.
Every launch boundary records its evidence through the helper so the terminal
report can be rendered from one authority without relying on parent-thread
memory.

For a delegated owner, the creator MUST render the completion report through
the retained helper ledger after collecting the terminal result. It MUST NOT
return the owner's prose unchanged when that prose omits or malforms the
report. Rendering those retained values is result collection, not
parent-thread repository verification; the creator still MUST NOT inspect,
edit, or recheck the completed work.

Immediately before sending any terminal response, the sender MUST perform one
response-only validation that exactly one contiguous report block begins with
`format: darrow-native-goal-report-v1` and contains every ordered field below.
If it is absent or malformed, the sender uses the exact helper-persisted output;
it never reconstructs fields. This validation reads no repository state.

Except for the selected non-ready readiness outcome below, every terminal
response MUST begin with the human-readable completion record. The first
non-whitespace line is the `format:` line: no prose, heading, bullet, or
Markdown code fence precedes or wraps the record. When selected readiness
returns `needs-discovery`, `needs-decision`, or `blocked`, the complete
human-readable readiness result MUST precede the exact helper report, and no
other content may precede that result.
The native goal carries the values forward and reports them to its caller. Each
field uses `key: value`; the effective provider and model form one `model` value
separated by `>`, while effort remains its own field:

```text
format: darrow-native-goal-report-v1
workflow: <workflow>
risk: <routine|elevated|high>
profile: <profile>
harness: <harness>
model: <provider> > <model>
effort: <effort>
route_applied_by: <current-thread|host-api|native-subagent|nested-session|none>
route_verified: <true|false>
launch_boundary: <same_thread|host_api|native_subagent|nested_session|launch_required>
verification_gate: <routine|elevated|high|not-applicable>
evaluation_child_invocations: <integer>
evaluation_human_interruptions: <integer>
enforcement: helper
```

The helper appends exactly one canonical terminal sentence: `Native goal
completed.`, `Native goal settled as blocked.`, or `Native goal requires host
launch.` A confirmed Codex native runner also emits `Native goal persistence:
confirmed.`; an accepted runner that cannot confirm its native goal emits
`Native goal persistence: unavailable.` Applicable persistence and review
sentences precede the terminal sentence. The 14 report fields remain the fixed
parseable block.

For every activated workflow, `verification_gate` equals `risk`; high risk
requires selected independent review in the ledger. `route_verified: true`
requires a concrete effective route, application boundary, and non-launch-
required boundary. `launch_boundary: launch_required` always implies
`route_verified: false`. The fixed decision-gated tuple remains the sole
exception with `verification_gate: not-applicable`.

For a verified route, `harness`, `model`, and `effort` describe the effective
route that matched selection. `harness` is the route harness (`codex` or
`claude`), never `route_applied_by` or `launch_boundary`. For an unverified or
unavailable route they describe only observed effective values, using `unknown`
or `none` rather than copying selection. The tab-separated preflight and
route-application records remain ledger-owned internal protocol evidence and
MUST NOT be reproduced in the human-facing completion report.

Validation is scoped to the single contiguous block beginning with
`format: darrow-native-goal-report-v1`; fields in a preserved companion
capability result are not duplicate report fields. The internal-record ban
detects Darrow's exact preflight and route-application format markers even when
Markdown presentation prefixes them, without rejecting unrelated capability
serializations.

`evaluation_child_invocations` counts sessions or subagents created by Darrow,
not internal continuation turns or helper subagents created by native goal
mode. A same-thread launch therefore reports zero and an accepted native goal
runner reports one, including when a later activation-evidence transition is
rejected and the accepted runner must be interrupted. Native descendants remain visible through host telemetry. A
`decision-gated` stop reports one human interruption. After launch, each
distinct material question presented for user decision also reports one,
including a question answered and relayed during the same run. Ordinary native
reasoning and automatic permission review do not.

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
- the human-readable completion report and concise goal contract;
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
    exists. When the originating request explicitly requires adding or
    updating focused evidence, that evidence file is inside compiled scope and
    MUST NOT be contradicted by a narrower non-goal.
11. **AGL-P11 — Canonical review selection.** Preflight applies the normative
    risk, policy, and user-intent selection policy and, when selected, compiles
    the portable independent-review intent, target binding, and semantic
    continuation into the goal without naming an implementation or output
    format.
12. **AGL-P12 — Complete contract identity.** The compiled contract carries
    exactly one nonempty value for each of these canonical labels before its
    internal launch record: `Outcome`, `Acceptance criteria`, `Scope`,
    `Non-goals`, `Preserved work`, `Permissions`, `Workflow sequence`,
    `Feedback checks`, `Final-tree checks`, `Readiness gate`, `Independent review`,
    `Stopping budget`, `Human feedback`, and `Completion report`. A label may
    reference repository facts or state that no optional authority or budget
    exists, but it MUST NOT be omitted. The launch boundary authenticates one
    digest for this complete contract; caller-facing evals do not reconstruct
    completeness from duplicated report-field regexes.
13. **AGL-P13 — Canonical readiness selection.** Preflight applies the
    authoritative-artifact, preserved-assessment, explicit-requirement, and
    user-skip policy. A structured handoff carries exactly one validated
    `readinessGate` decision, and the launcher compiles its portable intent and
    semantic continuation without naming a capability implementation or
    requesting JSON.

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
   bound to that completed Agent's host-reported id and confirmed against its
   immutable runner definition, or a successfully completed launcher record
   proves that selected and effective routes are identical. The Claude
   observation and confirmation MUST be one deterministic lifecycle operation;
   unrelated child evidence, prompt text, and model self-report are not
   application evidence.
   When a Claude child route cannot be observed, the effective model and effort
   are `unknown`; when the observed route mismatches, the effective row records
   that observed tuple. Failed verification never copies the selected tuple into
   the effective row.
8. **AGL-R8 — Profile-route integrity.** A policy-sourced host handoff matches
   the prepared active-worktree model and effort for its named semantic profile,
   with repository-or-bundled provenance disclosed. Only an
   explicit user route may bypass that mapping, and it remains subject to live
   catalog validation.

### Protocol-ledger invariants

1. **AGL-E1 — One private run ledger.** `goal-loop step start` mints one
   unpredictable run identifier, one mode-0700 ledger directory, and one
   separate mode-0700 staging directory below the resolved temporary root.
   Every later step names the absolute ledger path; the ledger binds the exact
   staging directory.
   Symlinked, malformed, unlocked, corrupt, foreign-repository, or
   foreign-host state is refused.
2. **AGL-E2 — Monotonic helper protocol.** Protocol-bearing helper operations
   are invoked through `goal-loop step`. The helper refuses missing
   prerequisites, skipped steps, duplicate steps, concurrent mutation, and a
   call after terminal reporting. A refusal never advances state. A process
   signal received while a step owns the ledger lock releases the lock and
   terminates that step; it MUST NOT release exclusivity and then continue.
3. **AGL-E3 — Evidence, not execution control.** The ledger records
   caller-chosen workflow, risk, profile, routes, objective identity, owner
   identity, native-goal persistence, readiness and review evidence, counters,
   cleanup, and report fields. It MUST
   NOT select or invoke a workflow, model, goal owner, readiness assessor,
   reviewer, repair, retry, continuation, publication effect, or terminal goal
   status.
4. **AGL-E4 — Bound objective identity.** Materialization verifies a
   caller-supplied SHA-256 digest. A Claude run mechanically requires the
   Claude host and file-backed materialization; another host cannot claim that
   path. The staging file is a canonical direct child of that run's exact
   staging directory. Staging and attachment release remain exact-once and
   digest-bound, and staging release removes the now-empty run directory.
5. **AGL-E5 — Review-chain evidence.** The owner records its semantic
   review selection with the route and its interpretation of each selected
   independent-review response through a validated enum and exact target
   fingerprint. The helper refuses evidence for an omitted review,
   verification before a blocking comprehensive review, a second comprehensive
   review, verification after any terminal review outcome, and verification of
   any fingerprint already present in the target history. An explicit review
   limit and invocation count are persisted; reaching the limit closes the
   chain without replacing the last semantic outcome.
   A selected review cannot report completion without a clear exact-target
   chain. The helper never parses or invokes another plugin.
6. **AGL-E6 — Helper-only protocol evidence.** The plugin MUST NOT package or
   register Claude or Codex lifecycle hooks, hook sidecars, host-session
   bindings, or a hook executable. Ordered state transitions are recorded only
   by explicit `goal-loop step` calls made while an explicitly invoked
   adaptive goal is running. Ordinary turns therefore execute no Darrow goal
   lifecycle code. The helper validates every requested transition against its
   private ledger but does not intercept arbitrary host tool calls or terminal
   responses. A failed Agent call is explicitly reconciled to a zero-child
   launch-unavailable stop before cleanup and reporting.
7. **AGL-E7 — Helper-rendered terminal output.** `goal-loop step report`
   renders the complete ordered `darrow-native-goal-report-v1` block and every
   applicable canonical review sentence from validated ledger values. The
   model MUST NOT hand-author or translate those records. The helper persists
   the exact report together with its canonical terminal sentence. The sender
   requires the final response to begin with that exact output and contain
   exactly one report, except that a selected non-ready readiness result
   precedes the exact report as the companion capability contract requires.
   The fixed `enforcement: helper` field truthfully identifies the only
   packaged evidence mechanism. Both `complete` and `blocked`
   reports after activation require a resolved owner identity and verified
   effective route; pending or unverified activation can only stop through the
   applicable `launch_required` path. A Codex runner accepted before its
   activation transition is rejected retains its exact canonical agent
   reference and one child invocation in that launch-required evidence.
8. **AGL-E8 — Deliberate route-gate exits.** A confirmed Claude observation
   succeeds. A rejected observed route exits nonzero, records the rejection,
   and cannot mark the route verified or continue the goal. An unavailable
   observation exits zero as a bounded observation
   result, records no confirmation, and can only produce an unverified
   `launch_required` report.
9. **AGL-E9 — Pre-activation terminal evidence.** A selected readiness or
   review capability that is unavailable or an unavailable exact launch boundary
   is recorded before
   activation as a terminal launch stop. Any materialized objective is
   released, no product work starts, and only the helper-rendered
   `launch_required` report may follow. A Codex spawn accepted immediately
   before a rejected activation-evidence transition is not a pre-activation
   zero-child stop: `launch-unavailable` records the exact accepted canonical
   agent reference and preserves one child invocation through interruption,
   objective cleanup, and terminal reporting.
10. **AGL-E10 — Readiness-state evidence.** Routing records readiness as
    `selected` or `omitted`. Selected readiness activation enters exactly one
    pending state and accepts exactly one semantic verdict. Only `ready`
    unlocks product mutation and ordinary active work. `needs-discovery`,
    `needs-decision`, or `blocked` terminalizes the mutation gate and prevents
    a complete report. Omitted readiness rejects outcome evidence. The ledger
    neither stores the complete readiness result nor parses or invokes the
    matching capability.

### Launch invariants

1. **AGL-L1 — Native ownership.** Exactly one host-native goal owner owns
   implementation, verification, recovery, and completion after activation.
   This is a native goal on a surface that exposes goal control, the one
   first-class Codex runner allowed by AGL-L8, or the one foreground Claude
   Agent runner allowed by AGL-L9. After a delegated owner returns terminally,
   its creator only collects and reports that result; it MUST NOT inspect or
   change the repository or rerun the owner's checks.
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
   its own terminal state, user interruption, or budget stop. A material human
   decision that emerges after activation pauses mutation and follows AGL-L13;
   it does not end ownership while the host can request and return feedback.
   The launcher keeps a file-backed contract readable for that lifetime. A
   Claude Agent runner MUST NOT claim session-scoped `/goal` persistence.
   A Claude classifier MAY read repository evidence needed to compile this
   contract, but MUST NOT edit product files or run implementation or
   verification commands before the selected Agent starts. It performs that
   read-only inspection through host-native read, glob, and search tools rather
   than shell discovery or command lists. Its only pre-owner shell calls are
   the exact standalone bundled preflight, route, runner-resolution,
   materialization, staging-release, and temporary-root helpers.
   An exact standalone `true` MAY occur as an inert host no-op; it advances no
   sequence state, supplies no evidence, and is ignored by the lifecycle
   oracle. No compound command or other extra shell call receives that
   exemption.
   Its only pre-owner writes are the contract staging file inside the
   ledger-owned isolated staging directory and helper materialization. The
   staging Write is singular,
   host-native, and never replaced or preceded by shell redirection, a heredoc,
   or `tee`. It is canonically inside that root and bound by exact path and content digest to
   the successful materialization result. The classifier releases that staging
   file through the exact helper before activating the owner; only a successful
   bound release permits activation.
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
   agent thread with explicit model and effort. The accepted task is the one
   native owner boundary and the runner owns the compiled contract directly;
   it MUST NOT repeat adaptive preflight, create another owner, or relabel that
   accepted boundary as `same_thread`. Before repository or external mutation,
   the runner MUST call the available native `create_goal` control exactly once
   with the exact materialized objective, omit a token budget unless the user
   supplied one, and require `get_goal` to confirm that objective active on its
   own thread. This is persistence for the accepted owner, not an inner Darrow
   owner. The runner records that confirmation through the ledger's goal-state
   transition before readiness or active work. If `create_goal` is unavailable
   or rejects the request, it records unavailable persistence, performs no
   product mutation, and returns the exact evidence gap so the creator can
   release the objective and report `launch_required` honestly. That report
   preserves the accepted child count and persistence sentence but clears the
   route fields: an applied child route is not an effective native-goal route
   without the required persistence. If `create_goal` returns acceptance but
   `get_goal` is unavailable or does not confirm the exact objective active,
   the runner performs no product mutation and MUST leave persistence pending.
   The creator MUST NOT release the objective, close or replace the runner, or
   render a terminal helper report while the native goal's state is unknown;
   it returns the accepted thread reference, attachment path, and digest as
   resumable lifecycle evidence.
   An inline contract follows the ownership marker byte-for-byte. For a
   file-backed materialization, the remaining task body is exactly one
   `- objective_file: <helper-returned-absolute-path>` line; the owner reads
   that bounded objective and verifies the complete attached contract. No
   copied contract, digest, workflow proof, or explanatory suffix is added to
   that one-field boundary. The creator constructs that exact body from the
   helper-returned objective path; zero, multiple, malformed, or out-of-root
   candidates remain launch failures.
   The public collaboration result's exact `task_name` is the Codex runner's
   canonical agent reference. It MUST match
   `/root(?:/[a-z0-9_]+)+` without normalization; foreign roots, empty or
   traversal segments, whitespace, control characters, shell metacharacters,
   and unrelated safe-looking references fail closed. The creator MUST NOT
   strip `/root/` or derive the reference from the requested short task name.
   It records the accepted native-subagent activation with that exact
   `agent_ref` immediately after spawn acceptance and before waiting. The same
   reference MUST identify every later wait, message, interrupt, and cleanup
   control for this runner. The Codex evidence adapter accepts activation only
   when that reference equals the accepted spawn output or a retained
   host-reported receiver identity from the same spawn; an echoed helper value
   or syntactically valid different child is insufficient. The runner may then record
   readiness and review evidence but never activation, objective release, or
   the terminal report.
   If the post-spawn activation transition is rejected, the creator interrupts
   that exact accepted reference, records `launch-unavailable` with the same
   reference, preserves one child invocation and the observed cleanup state,
   and renders `launch_required`; it MUST NOT retry, substitute another stop
   reason, or claim that no child was invoked. After collecting the terminal result, the creator performs exact helper
   cleanup and renders the helper-owned report without repository inspection.
   Host-native delegation beneath the runner remains visible and is not
   Darrow-defined planner, executor, verifier, or repair fan-out.
9. **AGL-L9 — Observable Claude goal runner.** When in-place Claude activation
   cannot apply the selected route, Darrow MAY invoke exactly one foreground
   plugin subagent. Its route-specific definition MUST pin both the selected
   full model ID and effort; family aliases are not exact route evidence. The
   launch MUST fail before spawning when a process environment override would
   replace either value. Before the Agent call, the launcher MUST successfully
   materialize the complete contract as a forced file-backed objective on the
   shared filesystem. The task begins with the ownership marker. Its remaining
   body is exactly one
   `- objective_file: <helper-returned-absolute-path>` line. That one body,
   reconciled with the completed materialization record, binds the task without
   making the classifier read, hash, or reproduce the bounded objective; the
   goal owner reads it and verifies the complete contract. When that exact
   file-backed reference is present, it is the sole task authority. Any copied
   contract, explanatory suffix, or later prompt text invalidates the launch.
   A marker-only task is invalid. The
   accepted Agent call is the terminal
   boundary and counts as one Darrow child. Because the Agent tool exposes no
   child `/goal` API, this boundary MUST be reported as a native Agent contract
   runner rather than a `/goal` session. Immediately before an accepted
   foreground Agent starts, the launcher explicitly records a provisional
   native-subagent activation with agent id `pending`, the exact selected
   route, and `route_verified: false`. No other unverified activation shape is
   valid, and every non-provisional activation requires route verification.
   This makes the ledger available to the sole owner for selected readiness and review
   without claiming post-run route evidence. No terminal report may be rendered
   while the id is pending or the route is unverified. The launcher MUST NOT
   record a duplicate activation.
   The route gate requires that provisional activation and rejects a
   staging-released or otherwise unactivated ledger; it cannot reconstruct
   missing pre-spawn activation evidence after the Agent returns.
   After the Agent
   returns, the parent MUST
   use one standalone lifecycle gate to bind the Agent result's host-reported
   id, replace that provisional id, bind it to the child's transcript-derived
   model and effort, and reconcile that observation with the selected route. An observed route requires an explicit
   confirmation result; an unavailable observation has none. Missing or
   mismatched transcript evidence records `route_verified=false` and
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
13. **AGL-L13 — Human-feedback relay.** When a material decision becomes
    necessary after activation, the goal owner pauses repository and external
    mutation and asks the smallest concrete question. A current-thread owner
    asks the user directly; a delegated owner sends the question to its parent,
    which returns the user's explicit answer to the same owner when the host
    supports feedback relay. When the originating request explicitly authorizes
    one named answer-acquisition command, the parent runs that exact command
    only after receiving the question and treats its successful output as the
    explicit answer; it does not ask the caller the same question again.
    Pending feedback is a pause, not completion or
    blockage, and the answer grants only the decision or authority it states.
    If the host cannot relay feedback, the owner stops honestly with the
    question and observed durable facts instead of guessing. Every pause
    response begins with `- phase: human-feedback-request` and states the
    complete smallest question; the marker without that question is not a valid
    pause result. A terminal human-readable completion report is optional on a
    nonterminal pause. When present it remains a truthful current snapshot, but
    the host preserves the active owner and objective as the durable
    continuation state instead of reconstructing them from caller-facing report
    fields.
    After feedback is relayed, the same owner completes any
    repository- or contract-mandated acknowledgement handshake with that exact
    answer before resuming mutation; the creator does not acknowledge on the
    owner's behalf. For each resolved question, the owner's terminal result
    states that the exact answer was applied on one line as
    `Applied relayed decision: <exact answer>`. The creator preserves each such
    line in the caller-facing completion. An optional Markdown bullet, inline
    code around the answer, or terminal period is presentation only.
    An enclosing host API that owns a current-thread goal's continuation MAY
    perform the one explicitly authorized named answer-acquisition command only
    after observing the valid pause, record its successful one-line output as
    the explicit answer, and start the continuation on that same thread and
    selected route. This is a zero-child host-API relay, not a replacement goal
    owner; the resumed owner still performs any acknowledgement itself.
14. **AGL-L14 — Readiness-gated continuation.** A selected readiness gate runs
    after owner activation and before repository or external mutation. The
    owner preserves the capability's complete ordinary result, records exactly
    one semantic verdict through the protocol ledger, and continues only after
    `ready` returns a concrete quality bar. Every non-ready verdict prevents
    mutation, settles the goal as blocked, and returns the complete readiness
    result before the outer native-goal report.

### Safety invariants

1. **AGL-S1 — Permission preservation.** Goal activation grants no authority
   beyond the request and current host policy.
2. **AGL-S2 — Meaningful human gates.** Missing product decisions, destructive
   operations, security or privacy policy, external publication, and new
   authority stop before launch unless already approved. A material decision
   discovered only after launch follows AGL-L13 and MUST NOT be inferred.
3. **AGL-S3 — No derived publication authority.** A native goal MAY perform a
   branch, commit, push, pull request, or other publication effect only when
   that exact effect was explicitly pre-authorized in the originating request
   and remains permitted by host policy. Goal activation and completion grant
   no additional or subsequent authority. Merge, release, deployment, and
   unrelated external mutation remain unauthorized unless separately explicit.
4. **AGL-S4 — Honest blockage.** An unavailable applicable check or launch
   surface is blocked or `launch_required`, never passed by assertion. Once
   route observation is unavailable or rejected, or launch has been recorded
   unavailable, the canonical terminal report MUST use `launch_required`; it
   MUST NOT recast that launch-evidence failure as ordinary blocked work.
5. **AGL-S5 — Review before publication.** When independent review is selected,
   no not-yet-performed commit, push, pull request, or other publication effect
   may occur after blocking findings or an unavailable or inconclusive review,
   or against content changed after review. A clear review grants no new
   publication authority.
6. **AGL-S6 — Readiness before mutation.** When readiness is selected, no
   repository or external mutation may occur until the matching capability
   returns `ready` and that verdict is recorded. A user may explicitly skip the
   default artifact-derived gate, but cannot silently override a repository or
   delegating-orchestration requirement.

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
   format: darrow-adaptive-goal-authority-stop-v1
   status: invocation_required
   reason: explicit-orchestration-entrypoint-required
   ```

4. **AGL-X4 — Self-contained mappings.** Route configuration, canonical risk
   guidance, workflow playbooks, and deterministic route mechanics ship inside
   the plugin.
5. **AGL-X5 — Portable shell.** Bundled shell mechanics support Bash 5 and
   `/bin/bash` 3.2 and refuse unreadable configuration.
6. **AGL-X6 — Environment capability mapping.** Readiness and review
   composition depend only on their intent and semantic outcomes, allowing the
   environment to provide implementations with ordinary prose, native command,
   or structured responses.
7. **AGL-X7 — Inert eval skills.** A checked-in eval fixture MUST NOT use the
   host-discoverable `SKILL.md` filename. Eval setup materializes an inert skill
   template as `SKILL.md` only inside the isolated repository where that skill
   is intended to participate in discovery.

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
   host-reported agent usage in token totals. When native-spawn route arguments
   are redacted, distinguish accepted-boundary evidence from independently
   observed route identity instead of requiring fields the host does not emit.
   Internal native continuation turns and native descendants are not Darrow
   child invocations. Codex native-runner coverage MUST use the public
   `{"task_name":"/root/<task>"}` response shape and prove one correlated
   reference across accepted spawn, activation ledger evidence, wait target,
   cleanup target, and terminal child count. It MUST cover nested canonical
   paths, a different safe-looking child, traversal, foreign-root, whitespace,
   tab/newline, and shell-metacharacter references, plus a spawned-then-
   interrupted activation failure that still reports one child invocation.
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
14. Exercise an after-launch material decision with both a current-thread owner
    and a delegated owner. Verify that mutation pauses, the smallest concrete
    question reaches the user, the explicit answer returns to the same owner,
    and continuation preserves the original scope and authority. An unavailable
    feedback relay stops honestly; a pending answer is never reported as
    completion or blockage while relay remains available.
15. Evaluate readiness composition with an unassessed artifact-derived request
    that selects and invokes the gate before mutation, a bounded conversational
    request that omits it, preserved prior-assessment context that omits a
    redundant gate, a material scope change that makes reassessment valuable,
    an explicit user skip, a higher-authority requirement that
    survives that skip, a selected unavailable capability that stops before
    activation and mutation, a `ready` verdict that unlocks work, and each
    non-ready verdict that blocks without mutation. Exercise strict v4 handoff
    validation, duplicate-label rejection, readiness ledger ordering, covered
    helper-only plugin packaging, and companion-result-before-outer-report ordering on
    Codex and Claude. Compare candidate and control trials under the same
    fixtures, prompts, checks, harness, model, and effort, reporting trial count
    and limitations.

## Non-goals

- Supervising planner, executor, verifier, or repair agents. Native goal mode
  may delegate bounded work through host-visible subagents.
- Reimplementing native goal persistence, retry, recovery, or completion.
- Building a daemon, queue, task manager, or phase ledger that schedules work,
  owns continuation, or coordinates execution roles. A private helper ledger
  that only validates caller-chosen protocol evidence is explicitly in scope.
- Maintaining provider SDKs or cross-vendor role routing.
- Running parallel writers or several candidate implementations.
- Treating preflight as a separate planning model call.
- Guaranteeing that every host exposes same-thread goal and route controls.
- Deriving publication authority or implementing Git and forge operations
  itself. An explicitly authorized native goal may use compatible environment
  capabilities for those effects.
- Implementing code-review judgment, fresh reviewer fan-out, or review result
  validation inside adaptive-goal.
- Implementing readiness judgment or assuming a particular readiness plugin,
  command, result serialization, or sibling-plugin installation.
