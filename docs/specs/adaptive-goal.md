# Capability: Adaptive Goal

Darrow turns one bounded engineering request into a native goal in the main
thread. That thread retains acceptance, user decisions and completion while
delegating bounded implementation and selected verification. Capabilities own
their assessment protocols and internal delegation.

Plugin: `darrow-adaptive-goal`  
Skill: `adaptive-goal`
Companion capability: `doctor-adaptive-goal`

## Public identity

The public plugin is `darrow-adaptive-goal`, with orchestration skill
`adaptive-goal` and diagnostic skill `doctor-adaptive-goal`. Marketplace entries,
installation and invocation instructions, scoped Claude agents, bundled Python
entrypoints, and active eval bindings must agree with those names.

This is a naming change. Main-thread goal ownership, invocation authority,
implementation and assurance routes, capability boundaries, completion evidence,
and the shared repair allowance remain unchanged. Historical trial identifiers,
commands, hashes, snapshots and artifact paths retain their recorded names.

## Why

The useful orchestration work happens before implementation: discovering
repository constraints, making completion observable, selecting a suitable
workflow and risk gate, and choosing a proportionate model and effort. The host
already knows how to execute tools, recover from errors, delegate bounded work,
and continue a conversation.

The product therefore uses this shape:

```text
request + repository -> read-only preflight -> native main-thread goal
                                               -> bounded implementation
                                               -> selected capabilities
```

Darrow does not maintain a second execution state machine. In particular, it
does not mirror readiness, review, blockage or completion into a Darrow ledger.
The native host retains the goal and continues execution. Capability results
and observed repository or external state support completion. Transcript
auditing belongs to evaluation and diagnostics, not the live workflow.

## Selected design

`adaptive-goal` explicitly starts native goal coordination in the main thread.

1. Perform read-only preflight and resolve selected readiness before mutation.
2. Bind required operations to compatible advertised capabilities. Select
   implementation difficulty and consequence risk independently.
3. Activate one native goal in the main thread, or continue its matching active
   goal. Keep the objective within 4,000 Unicode characters and coordination
   instructions in the skill.
4. Delegate bounded implementation on the selected model and effort. The child
   owns that assignment, never the delivery goal.
5. Delegate selected verification separately, preserving its provider boundaries,
   internal delegation and explicit reviewer routes.
6. Consume candidate-bound evidence, coordinate authorized repairs and fresh
   reassessment, and retain decisions and the shared repair allowance.
7. Complete only when every required check, acceptance criterion and authorized
   effect has sufficient current evidence. Waiting for user input preserves the
   same goal and its history.

This is the ownership model on both Codex and Claude. Native host controls differ;
a missing goal or delegation boundary is reported rather than replaced with a
separate execution-owner transport, nested host process or custom continuation
loop. The main thread coordinates top-level capability jobs and does not absorb
review or verification internals.

## Invocation authority

The skill starts only when:

- the user explicitly invokes adaptive-goal orchestration;
- an explicitly invoked orchestration entrypoint delegates one bounded request
  while preserving the originating scope and permissions; or
- unambiguous feedback in the same host thread targets the retained preflight
  or owner, including corrections, constraints, cancellation, and status requests.

Complexity, duration, and ordinary engineering intent do not authorize
orchestration. A fresh conversation, an ambiguous answer, or multiple plausible
owners supplies no continuation authority.

Explicit invocation does not imply implementation intent. When the user asks
only for explanation, comparison, or lifecycle guidance, answer that question
without compiling or launching an engineering goal.

Without invocation authority, the skill performs no helper call or mutation
and returns:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## Read-only preflight

The contained Python package is `<plugin-root>/backend`. Invoke
`uv run --quiet --no-project <absolute-backend>/scripts/run_locked.py` followed
by `adaptive-goal-preflight`, `claude-agent-route`, or `host-config-doctor`.
The wrapper runs the backend with frozen runtime dependencies. On Codex, the
activated file `<plugin-root>/skills/adaptive-goal/SKILL.md` binds that
plugin root;
`../../backend` starts at the directory containing `SKILL.md`. Claude binds
`${CLAUDE_PLUGIN_ROOT}/backend`. Check the package and lock at that exact location;
unavailability does not authorize searching for a different installation.

UV and Git are host prerequisites. UV selects Python from the package's
requirements; a separate system Python installation is not required. Preflight
uses the bundled UV command and reports its actual failure instead of rejecting
the host based on an ambient Python version.

The package supports Python 3.10–3.13, UV, and Git on Linux, macOS, and native
Windows, with no Bash entrypoint adapters. Python 3.10 uses the locked `tomli`
backport for host-configuration diagnosis; newer interpreters use `tomllib` from
the standard library. Native paths and argument-vector subprocesses preserve
spaces, Unicode, and linked-worktree identity. It retains the prepared-v2,
route-v2, and Claude-agent-route-v1 records, record ordering, policy precedence,
refusal exit 2, and help exit 0. Commands emit
UTF-8 stdout/stderr with LF records regardless of the host's redirected console
encoding, including native Windows code pages. JSON uses
the standard-library parser; syntax diagnostics may name its line/column while
semantic validation, duplicate rejection, and fail-closed behavior remain required.
No helper starts a host process or implements orchestration authority checks;
authority, provider discovery by advertised intent, and native launch remain
owned by the skill and its host guides.

Editable installation must preserve Unicode source paths when Python 3.10/3.11
reads startup path files using a Windows legacy code page. Package bootstrap
records use ASCII-safe Python string literals; the runtime retains the original
paths. Subprocess test diagnostics retain undecodable startup error bytes.

Eval-only readiness, review, verification, and completion-proof mechanics live
in the same contained package, with inert fixture templates. They preserve
candidate fingerprints, closed finding sets, delayed combined assessment,
canonical artifact validation, and passive evidence beneath Git metadata.
Fresh copied-artifact tests exercise runtime-only installation and both host
routes on all three native platforms; Python quality gates independently
require 95% statement and branch coverage. Python regression tests preserve
route refusals, installed fixture contracts, closed review histories, and
mutation during independent and combined assessment on all three native
platforms, without a Bash test runner.

The helper binds discovery and every Git operation to the requested `--repo`
working tree, including a linked worktree or its subdirectory. Ambient Git
repository, worktree, common-directory, index, object-store, discovery, and
command-configuration selectors must not redirect that evidence. Require
`--is-inside-work-tree` to return `true`; bare repositories, Git metadata
directories, and failed Git observations cannot produce prepared evidence.

Before native goal activation, the main thread may inspect the request, repository
state, applicable instructions, accepted decisions, manifests, CI
configuration, and focused test surfaces. It may run the bundled
`adaptive-goal-preflight prepare` and `adaptive-goal-preflight route`
commands and invoke selected read-only input
gathering and implementation-readiness capabilities. Retrieve necessary
authoritative input before classification; preserve the returned evidence.

It must not:

- edit product or test files;
- execute tests, builds, typechecks, lints, reviews, or verification commands;
- invoke implementation or review agents;
- acquire a missing product decision by guessing; or
- perform an external publication or other requested effect.

Imperative implementation and verification language in the request belongs in
the retained delivery contract. It does not authorize work before the goal is active.
Pre-existing working-tree changes are user-owned and must be named in the
contract when they overlap the task.

If a material product choice, permission, destructive scope, security policy,
or publication authority is missing before launch, ask the smallest concrete
question and do not start implementation.

## Host-configuration doctor

`doctor-adaptive-goal` is a separate, read-only capability for diagnosing
whether the effective Codex or Claude Code host configuration can support the
delegation topology required by Adaptive Goal. Ordinary doctor intent may
select this capability, but must never activate `adaptive-goal` or launch an
owner.

The doctor identifies the host, installed version when observable, every
configuration layer checked, and every source that contributes an effective
Adaptive Goal control. For Codex effective context it starts with the
active `CODEX_HOME/config.toml` (or the default user configuration under `HOME`
on Unix and `USERPROFILE` on native Windows when `CODEX_HOME` is unset), then
applies trusted project `.codex/config.toml` files from project root through
the current directory. The closest project layer has highest precedence. A
project layer counts as used only when it supplies an effective diagnosed
control. Isolated evaluation uses only its isolated `CODEX_HOME/config.toml`;
the source checkout's `.codex/config.toml` neither substitutes for nor augments
it. The doctor reports absent, unreadable, malformed, explicitly disabled,
unset/default, inadequate, and adequate states without printing unrelated
configuration or credentials.

Codex diagnosis evaluates `agents.enabled` and
`agents.max_concurrent_threads_per_session` separately. The concurrency limit
counts spawned-agent threads and excludes the primary. `agents.max_depth` is a
different nesting control for the V1 backend and is explicitly reported as
ignored by V2; it can never compensate for inadequate V2 concurrency.

Claude Code diagnosis checks the effective process environment and installed
version. On versions that support them it evaluates
`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` and
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` as separate controls. It reports version
or backend applicability honestly rather than inventing support for an older
or unobserved host.

Capacity conclusions derive from this topology, where the primary thread is
not itself a spawned-agent slot:

```text
main -> implementation (bounded assignment, settled before assessment)
main -> verification coordinator -> review coordinator -> Standards reader
                                                       -> Spec reader
```

The baseline implementation path needs one spawned-agent slot and one layer
below the primary. With implementation settled before assessment, the full
required-assessment path needs four concurrently active spawned-agent slots and
three layers of nesting. Host limits that also count retained inactive threads
may require releasing completed assignments; the doctor cannot prove live
capacity from configuration alone. A doctor result distinguishes
those two conclusions and gives a source-specific setup action for every known
inadequate or disabled value. Unknown host defaults, versions, or backends stay
unknown rather than being called adequate. Diagnostics never mutate host or
repository configuration.

## Goal contract

Keep a compact native goal and a complete delivery contract in the main thread.

The native goal is at most 4,000 Unicode characters. It names the requested
outcome, material acceptance criteria, scope and completion conditions. It
requires current check and selected verification evidence, preserved authority,
and truthful blockers. Do not embed workflow instructions, full capability
bodies, transcripts or protocol mechanics. Never silently truncate a criterion.
If a complete bounded objective cannot fit, resolve scope with the user before
starting. A token budget is supplied only when the user explicitly requests one.

The skill and main-thread context retain:

- originating authority, acceptance, scope, non-goals and preserved local work;
- exact workflow identifier and its applicable implementation guidance;
- consequence risk, implementation profile and concrete implementation route;
- focused and final checks, readiness evidence and selected capability bindings;
- separate verification and review coordination routes and provider requirements;
- user decisions, publication limits and any explicit stopping budgets;
- the repair maximum, its authority, attempts consumed and complete assessment history.

Each child receives a self-contained bounded assignment with the relevant
acceptance, authority, candidate, checks, exact capability references and route.
State that it owns its assignment, not the goal, and must return evidence or a
concrete blocker. Do not copy parent orchestration or goal-creation instructions
into child tasks. A child return alone never proves overall completion.

Workflow selection, ordering, assessment history, repair accounting and completion
belong to the main thread. Translate applicable workflow requirements into concrete
work and evidence requirements for the implementor; it need not track the workflow
identifier, delivery status or repair allowance. When the selected workflow requires
a failing regression or acceptance check before an edit, the main thread must
obtain that evidence or explicitly include it before mutation in the bounded
assignment. A passing check after the edit cannot establish the earlier failure.
The implementor returns changes, actual check results, relevant evidence and
unresolved blockers; the main thread decides what those facts mean for delivery.

New user constraints become acceptance criteria before affected work resumes.
Reusing an existing component means calling it; copying its algorithm does not
satisfy that requirement. Material scope, acceptance, constraint or authoritative
input changes invalidate affected readiness and verification evidence. Obtain
required fresh ready evidence before resumed implementation.

Preserve caller ordering. An assessment-before-change request checks and assesses
the unchanged existing candidate before any repair. Workflow defaults do not
restart completed work or move implementation ahead of that assessment.

No Darrow ledger, objective-file protocol or mandatory serialized contract is
introduced. Equivalent clear prose is valid; exact host keys, routes, workflow
identifiers, capability references and evidence bindings remain exact.

## Capability bindings

During preflight, enumerate the exact operations in the authorized contract. For
each operation whose intent matches a host-advertised skill, bind that operation
to the exact advertised skill name and its host-supplied public instruction
reference. For file-backed Codex skills, preserve the installed absolute
`SKILL.md` path in the retained delivery contract and relevant assignments. Carry that same reference through
any bounded capability delegation; a fresh context must not depend on the
parent's skill reads or reconstruct an installation path from a name.
Typical bindings include ticket reads and updates, TDD, commits, pull
requests, and verification. When verification is selected, preflight also binds
its compatible required independent code-review capability. Assessment runs
through verification; adaptive goal does not own review's assessment protocol.

Readiness and necessary read-only input gathering may run during preflight.
Preserve completed input evidence and bind any necessary refresh. Implementation,
verification and publication bindings run in the owner when due; selected
assessment-provider bindings travel through verification with preserved authority.
The owner must follow the bound
skill before performing that operation; a direct shell, Git, forge, tracker,
or generic subagent call is not a substitute. A refusal or unavailable bound
skill stops that operation without expanding authority.

On Codex, invoking a file-backed skill means reading its public instructions
and executing them with the available host tools. It does not require a tool
named after the skill. Before mutation, the main thread loads the already-bound
verification and required review instructions when selected, and supplies their
public references to the verification coordinator. This preserves the
parent's provider selection; it does not perform assessment early. Before
reporting a bound provider unavailable, attempt its supplied public instruction
reference and identify the concrete access, prerequisite, or execution failure.
Missing dedicated skill tooling alone is not evidence of an unavailable provider.

Intent matching is candidate discovery, not complete behavioral compatibility.
Check required prerequisites, effects, evidence and stop conditions against the
bound skill's public contract before the operation. Preserve compatible
replacement skills by intent rather than plugin identity. A mismatch returns
to the owner for an authorized compatible path or a blocker; it never licenses
bypassing the bound operation's refusal through raw tools.

For authorized create-or-reuse publication, require evidence that exactly one
open PR has the intended repository, head/base and draft state and that its
forge head and remote branch equal the intended verified commit. An existing
URL without current-content evidence cannot complete the goal. The capability
owns publication mechanics; the owner ties its result to final assurance.

Bindings are derived only from the active host's advertised skills. Do not
invent a skill, assume a sibling plugin is installed, or bind an unrelated
capability merely because it is available. An operation with no matching
advertised skill remains ordinary owner work unless the user, repository, or
selected gate explicitly requires such a capability; a required missing
capability stops before launch.

Publication operations are included only when explicitly authorized. For
example, an authorized commit and pull request become separate bindings when
separate matching skills are advertised. Completion never makes either
operation implicitly due.

## Ticket-correlated task branches

For an explicitly authorized ticket delivery that needs task-branch preparation,
adaptive goal owns correlation and naming policy. Bind a host-advertised
Git capability supporting complete read-only discovery by the provider's exact
opaque canonical token and exact-name preparation. During preflight obtain
complete local evidence before binding a proposed name. One match binds that
exact branch regardless of a proposed type or suffix; multiple matches require
one explicit user choice and no mutation; zero matches permits one conventional
`<type>/<token>-<kebab-suffix>` name derived from the settled request (lowercase
suffix, unchanged token exactly once, at most 60 characters). Preserve an exact
caller-selected existing match; do not infer selection from a merely proposed
new name. Missing compatible discovery or incomplete evidence stops preparation.

Compile the token, evidence, selected name, and decision into the owner contract.
The owner refreshes discovery before preparation; changed candidates require
reapplying the same rule before mutation. Preparation remains owner work and
uses the bound capability. Existing tips, local work, conflict refusals, and
explicit worktree authority remain intact. A task recipe such as ticket-to-pr
delegates its authority envelope without choosing names or owning Git mechanics.
Fresh explicit delivery may reuse repository state but grants no automatic
cross-conversation continuation or lifecycle ledger.

## Workflow and risk

Select exactly one workflow:

- `fix-bug`: existing promised behavior is incorrect.
- `implement-feature`: new observable behavior does not exist.
- `change-feature`: approved existing behavior intentionally changes.
- `refactor`: observable behavior must remain unchanged.
- `migration`: consumers or formats require a sequenced transition.
- `mechanical`: an exact deterministic non-behavioral transformation has a
  complete oracle.
- `decision-gated`: implementation requires a missing decision or authority;
  do not launch.

Apply these tie-breakers in order:

1. `decision-gated` wins for a known missing choice or authority.
2. `migration` requires a sequenced coexistence or rollout; otherwise an
   intentional contract change is `change-feature`.
3. `fix-bug` repairs an existing promise; `change-feature` changes it.
4. `implement-feature` applies only when equivalent behavior does not exist.
5. Observable contract changes are not `mechanical`.
6. `mechanical` requires a complete oracle; judgment-preserving restructuring
   is `refactor`.
7. `refactor` preserves observable behavior.

Select risk from consequences, taking the highest applicable level:

- `routine`: localized, reversible, and limited blast radius;
- `elevated`: compatibility concerns, multiple consumers, persisted formats,
  or meaningful operational impact;
- `high`: security or authorization boundaries, destructive or irreversible
  state, privacy or safety, or broad blast radius.

Reasoning difficulty does not change consequence risk.

## Profile and route

Classify reasoning demand independently:

- `routine`: clear localized work or an exact mechanical transformation;
- `routine-plus`: localized work with materially competing implementations or
  an explicit first-pass boundary-correctness priority;
- `scaled`: straightforward work spanning several components;
- `repo-wide`: straightforward repository-wide work;
- `judgment`: an unresolved cause across plausible layers or work requiring
  architecture, planning, or review judgment.

The profile describes the bounded implementor's engineering work. Consequence risk determines
required checks and assurance; selected verification and review providers perform
their own assessment work. Neither high consequences nor delegation to those
providers alone raises the implementation profile.

Select `routine-plus` only with a concrete basis: materially competing
implementations, or an explicit user or repository instruction prioritizing
first-pass boundary correctness. A security boundary, high cost of a mistake,
or required independent review establishes no such priority by itself. Clear,
localized, fully specified work without that additional basis is `routine`,
including when its risk is high. Preserve the brief profile basis in the delivery
contract without requiring a fixed serialization.

For example, an exact security-policy change is high risk and `routine`, with
required independent review. Localized validation work with an explicit
first-pass correctness priority is `routine-plus`. An unresolved diagnosis
across plausible layers is `judgment` even when its consequence risk is routine.

Use the bundled route policy unless the user explicitly supplied a concrete
host-supported model and effort for implementation. Such a user override need not
appear in the policy catalog; the host launch remains its final availability
check. Implementation agents need only the capabilities of their bounded assignment;
ability to coordinate the entire delivery goal is not a route prerequisite.
Repository route overrides apply only through the documented
`.darrow/config.json` surface. Invalid or unreadable owned configuration stops
launch rather than falling back silently.

Bundled policy, repository policy, and explicit routes share semantic
validation before any route is reported or selected: the harness matches the
host, Codex uses `openai`, Claude uses `anthropic`, the model is a concrete safe
identifier other than `none`, and effort is one of `low`, `medium`, `high`,
`xhigh`, `max`, or `ultra`. Host availability remains a launch-time check;
validation must preserve valid off-catalog concrete models and user overrides.

The bundled Codex implementation policy is:

| Profile        | Model         | Effort   |
| -------------- | ------------- | -------- |
| `routine`      | `gpt-6-luna`  | `medium` |
| `routine-plus` | `gpt-6-luna`  | `high`   |
| `scaled`       | `gpt-6.1-sol` | `medium` |
| `repo-wide`    | `gpt-6.1-sol` | `high`   |
| `judgment`     | `gpt-6-astra` | `high`   |

Main-thread coordination is recommended on Codex `gpt-6.1-sol/medium`. A known
weaker compatible main model receives a brief nonblocking hint; do not switch
the user's session model or claim reliability for untested stronger routes.
Verification coordination uses explicit `gpt-6.1-sol/medium` or a stronger
authorized route. Review coordination remains explicitly
`gpt-6-luna/medium`; review's independent readers retain `gpt-6.1-sol/xhigh`.
Neither main-model nor implementation-model inheritance may change those roles.

On Claude, use the same ownership design with native session goals. Bounded
implementation uses the policy's scoped agents. Verification uses an explicit
`claude-opus-5-5/high` scoped agent; review coordination uses
`claude-sonnet-5-5/medium`, preserving the review capability's own reader route.
The main thread resolves its verification assignment through Adaptive Goal's
bundled scoped-agent resolver and supplies the bound verification skill. It
passes the review binding and route into that assignment; verification owns
launching the review coordinator. A review-coordinator agent does not replace
the main thread's required Opus/high verification assignment.
These are host-specific role choices, not a claim of measured equivalence.
Claude receives lighter smoke validation than Codex.

Codex bounded assignments bind an explicit model and reasoning effort with fresh
context. Claude resolves a scoped agent that pins model and effort, refuses
conflicting environment overrides, and omits a per-call model override. Host
availability remains a launch-time check. A refusal stops the affected
assignment; do not silently downgrade or invent a separate goal owner.

## Readiness

Select implementation readiness separately:

| Situation                                                         | Selection                         |
| ----------------------------------------------------------------- | --------------------------------- |
| Unassessed authoritative ticket, specification, or accepted plan  | selected                          |
| Fully bounded conversational request                              | omitted by default                |
| Same scope already assessed and resolved                          | omitted                           |
| Material scope or constraint change where reassessment adds value | selected                          |
| Explicit user request to skip the default gate                    | omitted unless policy requires it |
| User, repository, or delegating-orchestration requirement         | selected                          |

When selected, the main thread binds and invokes the matching advertised capability
during read-only preflight. It preserves the capability's complete
human-readable result. Only a semantic `ready` result permits implementation.
`needs-discovery`, `needs-decision`, or `blocked` returns the complete result,
surfaces the smallest unresolved questions, and leaves the product tree
unchanged. The returned capability result starts the response unchanged, with
no preamble or summary; the parent may append the smallest unresolved questions
after that complete result.

After the user resolves those findings, the same adaptive-goal preflight invokes
the readiness capability again for the same scope. Repeat only while the result
materially changes and concrete findings remain; never infer answers or launch
on a non-ready result. Once ready, compile the settled readiness evidence and
decisions into the owner contract so implementation does not reopen them.

No Darrow helper call records the verdict. The capability result and the fact
that no implementation began before `ready` are the evidence.

“Already assessed” is semantic and scope-specific. A readiness result preserved
in the current context counts when it covers the exact implementation scope and
every finding has been resolved, even if no standalone readiness artifact was
written. Acceptance or approval of a request establishes product authority, not
a readiness assessment. Do not infer an existing readiness result from that
label or from the request's completeness; an unassessed authoritative source
still selects readiness. The bounded conversational-request omission remains a
separate selection rule. Do not invoke readiness again merely because the goal is now being
launched. Reassess only after a material change to scope, acceptance,
constraints, or authoritative input, or when an explicit user or repository
rule requires another assessment.

If a material readiness finding appears after activation, the main thread
pauses affected implementation and invokes bound or newly necessary
advertised readiness under the same selection rules, even if initially omitted.
A non-ready result returns to that same owner. It may investigate
within authority or ask the user a material question; after findings are
resolved it obtains required ready evidence before continuing. Bounded children
receive the settled constraint before affected work resumes.

## Selected verification

Select independent review separately:

| Situation     | Selection                                                                                |
| ------------- | ---------------------------------------------------------------------------------------- |
| Routine risk  | omitted by default                                                                       |
| Elevated risk | selected when compatibility, caller impact, or counterexamples need independent judgment |
| High risk     | required; an unavailable matching capability stops before owner launch                   |
| Any risk      | selected when the user or repository requires it                                         |

The parent binds compatible advertised verification and required independent
review before launching an owner whose contract selects assurance. It checks
both public contracts and passes the review binding through verification.
An ad hoc prompt, generic subagent, direct-review bypass or same-context judgment
is not a substitute. Unsupported selected additional assessments also block;
absent unselected optional providers do not.

Required verification and review availability is a parent preflight gate. Before
owner launch, the parent must identify exact compatible advertised skills.
If it cannot, it returns `Status: launch_required` identifying every gap and makes
no product mutation. It never launches an owner to discover the absence or to
perform a self-review, separated local review, or generic-agent substitute.

A clear or localized implementation does not make a high-risk change eligible
to omit review. A stronger user or repository rule may stop implementation
before launch, but it does not turn the required review into an omission.

The owner invokes verification only after implementation and every
applicable current final-tree check succeeds. Merely running a required check
does not satisfy this dependency. If a required check fails, the owner repairs
within existing authority and reruns invalidated checks, or stops before
assessment, commit, and publication. It supplies the repository and exact current
candidate/scope/base, originating authority and every material acceptance criterion,
constraints, successful check evidence and selected provider bindings. All selected
assessment results must return before repair; concurrent assessment is permitted.
Clear requires complete current evidence for every criterion and selected result,
not a provider pass alone. Missing, stale or unsupported evidence blocks completion.

When existing authority covers all eligible blockers, default to at most two
closed-set implementation repair attempts across verification as a whole. One attempt
addresses the combined blockers together, followed by fresh follow-up after
successful invalidated checks. Provider count never increases this budget.
An explicit finite nonnegative
integer user or repository repair budget may change that limit. Apply the
same authorized maximum in the launch contract and owner report; consumed
attempts are a separate count. Finishing after one repair does not change the
default maximum to one or create an implicit override. Resolve the maximum,
its authority source and the consumed count before launch. Before each subsequent
assignment, after native continuation and before a terminal response, the main
thread reconciles its issued assignments, returned evidence, outstanding obligations
and consumed allowance. Missing or contradictory facts require bounded clarification
from the relevant assignment; the implementor does not calculate the delivery's
repair count. Obtaining clarification authorizes no additional repair or assessment.
Apply the
strictest applicable invocation, time, token, and authority limit. Additional
attempts require the preceding verification to show resolved original blockers
or changed evidence narrowing their cause. Only clear current-content evidence
satisfies the gate. Unchanged, unavailable, inconclusive, out-of-scope, or
exhausted evidence stops completion and remaining publication. Keep the original
finding set plus direct repair-caused regressions closed. Preserve original
finding identities, provider/axis provenance and disposition, target history,
attempted repairs, prior follow-ups and direct-regression lineage. No comprehensive
assessment resets the budget. Clear ends repair immediately; an uncleared second
follow-up exhausts the default even with progress.

No Darrow helper call records assessment targets or outcomes. Verification's
combined result and complete provider evidence, final content and owner summary are the
evidence.

## Main-thread lifecycle

### Activation and assignments

After preflight, activate or continue the one matching native goal in the main
thread. Never overwrite an unrelated active goal. Native activation evidence is
required before implementation or assessment. A proposal or queued activation
is not yet an active goal.

Delegate bounded implementation on its selected route. Delegate selected
verification as a separate capability assignment, after successful current
checks. Pass the complete relevant acceptance, candidate, evidence, provider
bindings and explicit review-coordinator route. Verification owns its provider
selection, internal delegation and result contract; review owns its readers.

Reuse the retained implementor for subsequent work on its assignment, including
repairs. Supply the concrete changes, findings, changed constraints and required
checks, without transferring orchestration bookkeeping. Start a replacement only
when the retained agent is unavailable or no longer fits the required route or
scope, and state the reason. Supply a replacement with the necessary task context
and prior work; replacement never resets the main thread's repair allowance.

The main thread may inspect state, run required checks, consume results and
coordinate authorized operations. It does not take over implementation from a
refused child or perform a provider's internal assessment. Incomplete handoffs
require bounded clarification or corrected evidence, not a completion claim.

### Human feedback and blockers

An explicit wait for user authorization applies even when no product question
is pending. Retain the restricted actions and the user message needed to release
them, and carry both into affected assignments. Automatic continuation, elapsed
time and a command that changes local readiness do not grant permission. Until
the actual user message arrives, keep affected work read-only and report the
waiting condition; never satisfy a user-owned gate by opening it yourself.

When a material decision is missing, stop affected mutation and ask the smallest
complete question. Interrupt or steer affected active children as necessary,
reporting any unconfirmed stop honestly. Preserve the same native goal, accepted
criteria, decisions, child results and consumed repair allowance. Resume with the
answer's actual authority; complete required acknowledgements before mutation.

Use available host controls truthfully. On Codex, literal `paused` status is used
only for an explicit user pause request. A pending question can stop affected
work without fabricating a pause transition. Blocked and complete states must
satisfy the native tool's own conditions. On Claude, use the native goal's
question/continuation behavior and supported user controls. Never clear and
recreate a goal merely to get feedback or reset budgets.

Corrections and constraints apply before the next affected action. A status
question does not cancel execution. Cancellation stops work and reports effects
already performed. A blocker names its condition, current evidence and smallest
next action. Unchanged deterministic failures are not retried without changed
conditions or evidence. Native blocked-state recurrence can be established from
the retained blocker; it does not require rerunning the unchanged failing command.
Observe current external state before repeating an
ambiguous effect. No Darrow retry state machine is added.

### Repair and assessment correction

The main thread retains the shared default maximum of two implementation repair
attempts across all providers. A bounded repair addresses the combined eligible
blockers, then successful current checks precede fresh verification. Never reset
attempts through a new child, new comprehensive review or new goal.

An assessment can be wrong or incomplete even when code is unchanged. With a
concrete error or new evidence, request a bounded correction through the same
capability's public contract. Bind the prior report and full history, explain
what changed in the assessment, and require fresh judgments and checks. A
completed blocked report is retained, never recast as aborted or replaced by a
history-free assessment. A correction consumes no implementation repair attempt
and grants no additional attempts. Repeated unresolved or unsupported conclusions
remain blocked or no-progress; correction is not a convergence waiver.

Before accepting a child's diagnosis of a missing helper or broken provider,
the main thread MUST require the attempted command/path, observed diagnostic
and comparison with the loaded capability's public instructions. A lookup at
an invented path cannot establish a missing installation. A demonstrated
invocation error goes back to the same capability for bounded correction,
preserving the earlier result. The main thread does not execute assessment
internals or substitute another checkout's helper. An unverified cause remains
an evidence gap, not a confirmed installation or fixture defect.

### Completion

Before completing the native goal, the main thread verifies:

- the outcome and every material acceptance criterion have current evidence;
- required checks succeeded for the final candidate;
- selected verification is clear, with all required provider results and history;
- repair accounting agrees with the authorized shared maximum;
- any authorized publication is bound to the verified candidate;
- no unresolved blocker or required user decision remains.

Return a self-contained summary with changed files, checks, selected assessment
outcomes, repair use/maximum, performed effects and residual risks. Evidence
files supplement the response; they do not replace its substantive conclusions.
Every terminal response includes repair use and the authorized maximum, including
blocked responses and later native continuations of the same unresolved blocker.
A child success statement, initial goal text or provider pass alone cannot
establish completion. Goal completion grants no publication authority.

## Native host boundaries

### Codex

Use native `create_goal` in the main thread, or continue its matching active
goal. Keep the objective within 4,000 characters and supply no invented budget.
Use native `spawn_agent` with `fork_turns: none`, an explicit model and effort,
and a valid lowercase/digit/underscore task name for a new bounded agent.
Retain its host-returned identity; use native follow-up for continued implementation
or repair when that implementor remains applicable. Children do not create goals.

Use native goal continuation; an eval client must keep the main session alive
through it. App-server is an evaluation entrypoint, not a separate production
execution-owner transport or a custom turn-driving loop.

### Claude

Use the same native main-thread goal ownership through Claude's `/goal`
facility. If an eligible `ProposeGoal` tool is available, provide the compact
condition and use its authorized direct-setting mode only when the user's
stated outcome permits it. Honor any host-required confirmation. The tool queues
activation at the end of the current turn; finish read-only preparation and
yield until native activation is confirmed.

An already active matching goal can continue. When model-side activation is
unavailable, surface the exact native `/goal <condition>` entry needed in this
session; do not claim it ran. A headless client may enter through that native
command. Do not invent a Skill invocation of a built-in command, launch a nested
Claude process or add a custom stop hook. Bounded Agent assignments use resolved
scoped agents and return their own results; they do not own or clear the goal.

### Unavailable boundary

If native goal activation, selected delegation or a required capability is
unavailable, preserve affected product state and report `launch_required` with
the concrete missing boundary and route. No silent model downgrade, fallback
owner, nested host process or runtime is authorized.

## Invariants

1. **ADL-P1 — Explicit activation.** Ordinary engineering intent never starts
   adaptive-goal orchestration.
2. **ADL-P2 — Read-only preflight.** Product mutation and verification begin
   only after required readiness and native main-thread goal activation. Preflight evidence belongs to the explicitly
   requested working tree and cannot be redirected by ambient Git selectors.
3. **ADL-P3 — Preserved authority.** Delegation and activation add no
   permissions or publication authority.
4. **ADL-P4 — One bounded contract.** The main thread retains the complete request,
   acceptance, scope, gates, checks and authority. The native goal is at most
   4,000 characters; children receive relevant self-contained assignments.
5. **ADL-C1 — One workflow and risk.** Classification follows the documented
   tie-breakers and consequence model. The delivery contract keeps the exact
   workflow identifier separate from its implementation sequence.
6. **ADL-R1 — Concrete selected route.** Policy or an explicit user override
   resolves to one implementation host/provider/model/effort tuple before delegation. Both sources
   pass the same host/provider, concrete-model, and effort validation before
   reporting or selection.
7. **ADL-R2 — Native route binding.** Codex launches with an explicit spawn
   tuple. Claude resolves a scoped agent with the selected model and effort,
   rejects higher-priority environment overrides, and launches without a
   per-call model override. Transcript auditing is evaluator-owned and never a
   parent workflow step.
8. **ADL-L1 — One Darrow owner.** The main thread owns the native goal and complete
   delivery. Bounded children own assignments, never that goal. Implementation,
   verification coordination, review coordination and reader routes are explicit
   and separate.
9. **ADL-L2 — Semantic gates.** Required readiness completes before implementation; every
   applicable current check succeeds before selected verification and every
   dependent commit or publication effect. The owner invokes verification with
   the candidate, originating criteria, constraints and existing evidence;
   no assessment can waive a failed check. An explicit assessment-before-change
   request starts with checks and verification of the unchanged existing
   candidate; classifier inspection is not that independent assessment.
   The gates are proven by capability results and observable
   repository behavior, not bookkeeping transitions.
10. **ADL-L3 — Same-owner feedback.** Questions, answers, steering, cancellation
    and status requests remain with the main thread's same goal. Preserve every
    affected instruction and constraint in child updates, confirm required
    acknowledgements, and do not reset acceptance or repair history.
11. **ADL-L4 — Semantic blockage.** A blocker names its condition, evidence,
    and next action without a Darrow retry state machine.
12. **ADL-L5 — Evidence-supported completion.** The main thread validates and
    reports changed files, combined verification, selected assessments, criterion
    coverage, repair accounting, publication and residual risks before completing
    the native goal. Child returns alone do not establish completion.
13. **ADL-S1 — No inferred decisions.** Missing product, safety, destructive,
    privacy, or authority choices stop before the affected mutation.
14. **ADL-S2 — No duplicate external effect.** An ambiguous external result is
    observed before another attempt. An observed existing publication is
    validated for reuse before claiming completion; further read-only
    verification does not authorize another creation request.
15. **ADL-S3 — No derived publication.** Completion or review clearance adds no
    commit, push, pull-request, merge, release, or deployment authority.
16. **ADL-C2 — Intent-bound capabilities.** Every authorized operation with a
    matching advertised skill is bound before launch and must use that skill;
    direct tools are not a substitute.
17. **ADL-X1 — No lifecycle ledger.** `adaptive-goal` ships no required run
    ledger, lifecycle hook, blocker protocol, canonical helper report, or
    model-operated transition sequence.
18. **ADL-E1 — Evidence-appropriate evaluation.** `adaptive-goal` evals prove
    repository and external effects with passive fixture event logs under
    `.git/fixture-state/`, exact public tokens with rigid output checks, and
    paraphrasable prose contracts with fail-closed semantic output checks.
    Fixture CLI help requests remain read-only and never count as completed
    assessments or external
    effects or consume publication authorization.
    Recovered skill-read record position is not temporal evidence. Preflight
    read checks require complete main-thread reads before goal activation;
    child reads and later recovery do not establish preflight. Historical
    separate-owner guard results remain labeled as that architecture. Current
    passive observations distinguish main-thread goal activation from bounded
    child acceptance without imposing the former parent-work prohibition.

19. **ADL-B1 — Token-correlated branch choice.** Before authorized ticket
    branch creation, adaptive goal consumes complete exact-token Git
    capability evidence and applies the one/many/zero-match policy above. The
    recipe owns no branch choice; the Git capability owns deterministic
    discovery and preparation.
20. **ADL-D1 — Separate read-only host diagnosis.** Host-configuration doctor
    intent selects `doctor-adaptive-goal`, never activates orchestration,
    and makes no configuration or repository mutation. Its result identifies
    every checked and contributing effective source plus host/version
    applicability, applies trusted Codex project layers in documented
    precedence order while keeping isolated evaluation CODEX_HOME-only, keeps
    concurrency and nesting distinct, derives baseline and full-path capacity
    from the topology above, refuses unreadable or malformed required input,
    and never exposes unrelated values or credentials.

## Packaging and portability

The bundled helper may prepare deterministic repository evidence and resolve a
configured route. It does not launch models, persist objectives, record owner
lifecycle, render completion, or supervise work. The contained Python package
and its regression tests support Python 3.10–3.13 on macOS, Linux, and native
Windows, using UV and Git without a Bash dependency.

Every required runtime file remains inside the plugin. Bundled helpers are
resolved without filesystem search: Claude uses its host-substituted plugin
root, and Codex uses the absolute path of the SKILL.md it activated. An
unavailable or non-executable helper stops honestly instead of falling back to
a similarly named binary. Optional capabilities are selected through
host-visible intent and are never accessed through sibling plugin paths.

## Evaluation requirements

An isolated owner-transport experiment must preserve submitted instructions and
the selected route. Keep task facts and authority in user input, with workflow
instructions separate. Reject objectives longer than 4,000 Unicode characters
before owner creation. Feedback to an active owner uses its controlling connection;
a rejected competing client must not interrupt execution or clear the goal. Retain
completed owner responses alongside transport errors, including absent goal state.
Measure automatic continuation from observed host turns, separately from explicit
feedback turns and goal-completion claims. These experiment requirements do not
adopt an alternative production owner path.

An isolated main-thread ownership comparison may keep the native goal, user
decisions, acceptance and completion responsibility in the original thread while
delegating bounded implementation and capability assignments. Match models and
effort by role against the native-owner control. The implementation route never
overrides a capability's internal reader route. Keep review and verification
unchanged, including their provider boundaries and complete result contracts.
Native continuation must be observed in the evaluation host before delivery
trials; explicit resumptions do not establish it. Keep coordination instructions
in the skill and the goal within 4,000 Unicode characters. Retain original
baselines and architecture-specific grades separately from common task checks,
capability compliance, evidence preservation and complete-tree usage measurements.
Those experimental results remain frozen. The adopted main-thread design is
specified above; new implementation evidence does not replace baseline grades.

An explicitly authorized single-role model experiment may vary the verification
coordinator route while preserving the main-thread architecture. Pin every other
role, including review coordination, independently of parent-model inheritance;
preserve the review capability's explicit reader route. Keep the capability
instructions, fixtures, common checks and passive observation unchanged. Record
the sole experimental route instruction and validate the actual nested routes
before delivery trials. Reused control trials retain every failure and evidence
gap, and their temporal limitation remains part of the comparison.

Fixture inputs must describe the host actually being diagnosed or explicitly
represent a different host with its configuration, version, and effective
environment. A diagnosis refusal cannot pass as a completed capacity check.
Semantic assertions accept equivalent decisions without requiring redundant
numeric or publication disclaimers; contradictory permission still fails.

Synthetic review providers preserve stable finding identity, severity,
disposition, evidence, original target, and subsequent target history. Repeating
a clear assessment is not failed convergence; repeated unresolved findings are.
Installed fixture helpers are excluded from the product candidate and fingerprint
checks use the same immutable runtime launcher as the provider. Forge mocks
accept the current public command contract, including file-backed PR bodies.
Publication counts record accepted creation invocations independently of free-form
argument text. A multiline PR body must not count as additional creations;
two actual creation invocations must still fail an exactly-one requirement.

### Adaptation and evaluation fidelity (#102)

The following invariants govern adaptation and evidence provenance:

- **ADL-A1 — Owner reassessment.** Material changes invalidate only affected
  assumptions, readiness, and verification evidence. The retained owner pauses
  affected implementation, invokes necessary advertised read-only readiness,
  and strengthens checks within existing scope and authority. Required ready
  evidence must precede resumed implementation. Missing product decisions or
  expanded effects require the user's answer; the main thread retains the decision and updates affected assignments.
- **ADL-A2 — Execution steering.** Unambiguous same-thread corrections, added
  constraints, cancellation, and status requests reach the retained owner even
  without a pending question. The retained owner applies every user-supplied
  instruction and constraint without weakening or omission. A status request
  does not cancel execution. Restrictions apply before the next affected action;
  cancellation stops work and reports already performed effects.
  Unsupported live delivery is reported honestly, without a replacement owner
  or a claim that cancellation succeeded.
- **ADL-A3 — Read-only input gathering.** Before classification and launch, the
  parent may invoke necessary advertised read-only capabilities to retrieve
  authoritative input, including a referenced ticket. Preserve their evidence
  and bind future operations by intent. Retrieval grants no mutation authority.
- **ADL-A4 — Budgeted closed-set repair.** Collect every selected assessment result
  before owner repair. One attempt addresses the combined eligible blockers
  together, then obtains successful current checks and fresh-context verification
  of original findings, affected evidence and direct repair-caused regressions.
  Default to at most two implementation repair attempts across verification as a whole;
  extra providers do not add budgets. An explicit finite user or repository budget
  may raise or lower this maximum;
  each additional attempt requires changed evidence showing material progress
  against the original blockers or direct repair regressions. Preserve finding
  identities, provider provenance, dispositions, target and repair history, prior
  follow-ups and direct-regression lineage. The finding set stays closed except
  for direct repair-caused regressions; a comprehensive reassessment cannot reset
  the budget. Apply the strictest invocation, time, token and authority limits.
  Unchanged, oscillating,
  inconclusive, unavailable, out-of-scope, or exhausted evidence stops affected
  work and publication. Only clear verification of current content clears the
  gate. The main thread applies the limit using native delegation; no custom repair
  controller is added. A same-candidate assessment correction requires fresh
  evidence and retained history and neither consumes nor resets that limit.
  Clear verification ends repair immediately; unused attempts are not required.
  Without an explicit override, an uncleared second verification exhausts the
  budget even when it shows progress. An unbounded request does not raise it.
- **ADL-V1 — Verification boundary.** Preserve routine review omission and required
  high-risk review. Selected assurance requires compatible host-advertised
  verification and independent review before launch. The same owner consumes
  verification's combined clear/progress/no-progress/blocked conclusion; it does
  not directly coordinate a review-specific protocol. Selecting independent
  review alone still selects verification with one assessment; it never grants
  the owner a direct-review bypass. Every material acceptance
  criterion needs current evidence or an explicit gap; missing selected evidence,
  stale candidates and provider passes without complete coverage cannot clear
  completion or remaining publication. Unselected optional providers add no gate.
  Compile this dependency inline before launch: the owner receives and validates
  the bound verification capability's complete, current-content clear assessment
  before invoking a dependent commit or publisher. Their local readiness cannot
  discharge an enclosing verification prerequisite. A successful provider call
  that returns review alone or incomplete criterion coverage leaves that
  prerequisite unsatisfied; discovering the omission in the final completion
  report is too late to protect an already performed effect.
  Verification owns bounded assessment only, never repair, continuation, budget
  policy or overall completion.
- **ADL-A5 — Semantic presentation.** The retained delivery contract is a
  completeness requirement; the native goal remains compact. Equivalent clear prose, line wrapping, punctuation,
  status presentation, and role wording are valid. Preserve exact tool keys,
  route identifiers, capability references and evidence bindings.
  No runtime contract validator or mandatory closing disclaimer is claimed.
- **ADL-E2 — Enforcement provenance.** Retain whether candidate execution used
  active eval enforcement or passive observation. Passive trials install no
  adaptive-goal guard, rewrite no launch input, and block no candidate operation
  for product-policy compliance. Ordinary fixture isolation remains in both
  conditions. Unknown or incomplete observation proves no missing fact.
  Compare direct execution and preflight on the same fixtures and model/effort
  routes separately from comparisons changing routes; report sample sizes,
  outcomes, timing, token-accounting completeness, and limitations.
- **ADL-E3 — Outcome-led evaluation.** Report achieved task outcomes separately
  from workflow compliance, capability contracts, evidence correctness and
  preservation, recovery, and cost. Establish outcomes and required safeguards
  from observable current state and effects; a successful narrative alone is
  insufficient. Accept faithful summaries and equivalent presentation when the
  provider's public contract permits them. Minor final omissions may leave the
  achieved outcome accepted when the retained evidence establishes the result
  and required gates; preserve any explicit reporting-contract violation.
  Missing required work, unauthorized effects, stale clearance and unsupported
  completion claims remain failures in their affected dimensions. A harmless
  redundant check may be an efficiency defect alongside a correct outcome;
  a recovered intermediate error remains recorded alongside correct final
  evidence. Neither is erased by recovery. A required pre-edit check remains
  required unless its workflow contract is explicitly changed. Unknown evidence,
  including encrypted handoffs, remains unknown. Preserve original grades and
  label any later acceptance assessment with its rubric and source trials;
  regrading is not new execution evidence or an unqualified compliance pass.

Real review-composition fixtures accept the canonical human report as well as
the comprehensive and additive fix-verification machine artifacts. The fixture
may validate a human report against its retained canonical source without making
callers reconstruct a provider's private serialization. Completion consumes an explicitly selected,
validated clear artifact covering current content; a verification retains its
binding to the original comprehensive finding set. Nonblocking advisories do
not prevent completion. Artifact filename ordering is not evidence of recency
or authority. A closed follow-up binds its original by both target and complete
ordered finding set, using the review provider's public validator. Another
report for that target must not invalidate an otherwise matching original;
identical copies of the same validated finding set are equivalent evidence.
Missing or changed original findings still fail the completion proof.

Synthetic review providers used in composition evals may return a faithful
inline explanation with an absolute reference to their complete retained
report. The explanation preserves the outcome, assessed scope, actionable
findings and their disposition, follow-up states and material limitations.
Repeated target history and mechanical metadata may stay in the report. Require
observed consumption of the supplied, readable current report before the caller
uses it for repair or clearance; file existence alone is insufficient. Missing,
stale, contradictory or incomplete evidence still fails. Do not add a verbatim
copy requirement or require every historical field in every agent message.
Honor a real provider's own public result contract. Preserve historical grades
under their original expectations, and label revised assessments separately.
Encrypted message content remains unknown even when a separate public result
and observed report read establish a sufficient handoff.

Verification-cadence evals preserve required focused-before-final ordering and
successful final evidence without inventing an exact invocation count. Repeated
or repaired checks remain valid when their latest relevant evidence succeeds.
An earlier repository-gate run used as a baseline is not a substitute for, nor
a prohibition on, the required successful final-tree verification.
Repair-budget advice evals assess the next authorized action without demanding
that the answer restate supplied budget arithmetic or label the remaining
attempt as final. They still reject authorization beyond the supplied budget,
reopening unrelated findings, or bypassing required verification and publication
gates.

Complete mounted-skill reads have the same activation meaning through the
host's login and non-login shell wrappers. Preflight evidence still
requires a completed full body read by the main thread before native goal activation.
For missing activation, retain bounded parent-read diagnostics for known mounted
skills: read recognition and body-presence facts, native path binding, and
ordering. Such diagnostics carry no private commands or output and confer no
activation credit by themselves.
Readiness-selection evals require actual ready evidence before affected work,
not an invented exact assessment count. Additional read-only reassessment does
not excuse non-ready evidence, missing assessment, or mutation before the gate.
Composed fixture capabilities accept the native main-thread goal and bounded
capability assignment as the execution boundary. They must not demand a separate
owner child, a second goal, or forbid required main-thread coordination. Such obsolete prerequisites
would make a correct compatibility refusal fail an unrelated behavior oracle.
Post-launch reassessment fixtures distinguish the initially assessed contract
from the later authoritative constraint. A supposedly new requirement must not
already be mandatory in the initial request or repository check. Preserve the
final expanded-behavior oracle and evidence that reassessment preceded affected
implementation; clarifying the fixture does not waive the owner readiness gate.
The later input must name the affected entrypoint and its observable result;
preserving a separate legacy helper alone must not appear to satisfy that delta.
Launch-stop evals recognize the public `launch_required` status as a pre-launch
stop without demanding a redundant explanatory sentence. An actual launch or
contradictory launch claim does not satisfy that boundary.

Behavior evals verify outcomes and public boundaries rather than private
reasoning or bookkeeping. At minimum, cover:

- direct explicit invocation;
- delegation from an explicitly invoked orchestration entrypoint;
- ordinary engineering intent that must not activate;
- advice-only explicit invocation that must not launch;
- missing preflight decision that stops before launch;
- each workflow tie-breaker and risk boundary;
- native main-thread goal activation and bounded assignments on both hosts;
- one main-thread goal, no `adaptive-goal-preflight step` calls and no
  child goal for the same contract;
- readiness selected, omitted, iterative non-ready, and unavailable behavior;
- review selected, omitted, clear, blocking, and unavailable behavior;
- exact intent-based capability invocation for ticket, Git, review, and other
  advertised operations;
- same-goal human feedback and preserved child constraints;
- semantic blockage and observe-before-retry behavior;
- preservation of local work and publication authority; and
- focused versus final verification cadence.

Across the full adaptive-goal suite, sentence-shaped propositions must not be
encoded as synonym lists, bounded-gap regexes, or lookarounds. Passive fixture
observations live only under `.git/fixture-state/`; they are test evidence, not
a product lifecycle ledger. Semantic gates remain active when the advisory
quality judge is disabled and are exercised against faithful paraphrases,
negation, contradiction, malformed results, and grader unavailability.

Use the native harness for each host claim. Develop behavior changes from
matched evidence and report trial count, outcomes, tokens, wall time, and
limitations. A model deviation in hidden telemetry is not a product failure
unless it violates an observable owner, authority, safety, gate, or outcome
invariant.

## Non-goals

- A planner/executor/verifier controller or Darrow repair loop.
- A daemon, queue, scheduler, workflow database, lifecycle ledger, or canonical
  telemetry protocol.
- Reimplementing native goal persistence or delegating overall ownership to a child.
- Unbounded child-transcript inspection or reconstruction of child work; route
  observations belong to evaluation and diagnostics.
- Nested Codex or Claude processes.
- Parallel candidate implementations or replacement adaptive owners.
- Review or readiness judgment inside adaptive-goal.
- Publication authority derived from goal completion.
