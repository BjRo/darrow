# Capability: Adaptive Delivery

Darrow turns one bounded engineering request into a compact goal contract and
hands it to exactly one route-selected, host-visible subagent. The parent owns
read-only preflight and launch; the subagent owns implementation, adaptation,
verification, feedback, and completion.

Plugin: `darrow-adaptive-delivery`  
Skill: `adaptive-delivery`

## Why

The useful orchestration work happens before implementation: discovering
repository constraints, making completion observable, selecting a suitable
workflow and risk gate, and choosing a proportionate model and effort. The host
already knows how to execute tools, recover from errors, delegate bounded work,
and continue a conversation.

The product therefore uses this shape:

```text
request + repository -> read-only preflight -> compact contract -> one subagent owner
```

Darrow does not maintain a second execution state machine. In particular, it
does not require the parent or owner to mirror launch, readiness, review,
blockage, continuation, cleanup, or completion into a Darrow ledger. Host
acceptance establishes the owner and its host-native route. Codex receives the
concrete route on the spawn call. Claude resolves a scoped agent whose
frontmatter pins model and effort, rejects higher-priority environment
overrides, and omits a per-call model override. Semantic owner results
establish readiness, review, feedback, blockage, and completion. Transcript
auditing belongs to evaluation and diagnostics, not the live parent workflow.

## Selected design

`adaptive-delivery` is an explicitly invoked goal compiler and launcher.

1. The parent performs read-only preflight in the current repository.
2. When readiness is selected, the parent invokes the advertised readiness
   capability and resolves its findings with the user before implementation.
3. It binds every required operation to any matching host-advertised capability
   and compiles one compact, self-contained goal contract.
4. It resolves one concrete route from the selected semantic profile.
5. It starts exactly one host-visible subagent on that route.
6. That subagent becomes the sole Darrow work owner and follows the contract to
   completion, a user-feedback pause, or a genuine blocker.
7. The parent only waits, relays feedback to the same owner, and returns the
   owner's result. It does not run post-launch shell checks, implement, verify,
   or reconstruct the engineering result.

The accepted subagent task is the native goal boundary. Neither parent nor
owner mirrors the same contract into a second current-thread goal using
`create_goal` or `update_goal`; relaying the owner's result completes the
Darrow handoff without a separate goal lifecycle. A Codex subagent does
not create another nested goal, and a Claude Agent does not claim session-level
`/goal` persistence. The owner may use ordinary host-native delegation for a
bounded subtask, but it remains responsible for the complete contract and must
not start another adaptive-delivery owner.

## Invocation authority

The skill starts only when:

- the user explicitly invokes adaptive-delivery orchestration;
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
format: darrow-adaptive-delivery-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## Read-only preflight

The contained Python package is `<plugin-root>/backend`, invoked through
`uv run --quiet --frozen --no-dev --project <absolute-backend>` followed by
`adaptive-delivery-preflight` or `claude-agent-route`. On Codex, the activated
file `<plugin-root>/skills/adaptive-delivery/SKILL.md` binds that same plugin root;
`../../backend` starts at the directory containing `SKILL.md`. Claude binds
`${CLAUDE_PLUGIN_ROOT}/backend`. Check the package and lock at that exact location;
unavailability does not authorize searching for a different installation.

The package supports Python 3.10–3.13, UV, and Git on Linux, macOS, and native
Windows, with no runtime dependencies or Bash entrypoint adapters. Native paths
and argument-vector subprocesses preserve spaces, Unicode, and linked-worktree
identity. It retains the prepared-v2, route-v2, and Claude-agent-route-v1 records,
record ordering, policy precedence, refusal exit 2, and help exit 0. Commands emit
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

Before the owner is accepted, the parent may inspect the request, repository
state, applicable instructions, accepted decisions, manifests, CI
configuration, and focused test surfaces. It may run the bundled
`adaptive-delivery-preflight prepare` and `adaptive-delivery-preflight route`
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
the owner contract. It does not authorize the parent to perform that work.
Pre-existing working-tree changes are user-owned and must be named in the
contract when they overlap the task.

If a material product choice, permission, destructive scope, security policy,
or publication authority is missing before launch, ask the smallest concrete
question and do not start the owner.

## Goal contract

The contract is self-contained and concise. It contains, in plain language:

- the outcome and observable acceptance criteria;
- scope, non-goals, preserved local work, and permissions;
- the selected workflow and risk;
- the implementation sequence from the selected workflow;
- focused feedback checks and final-tree checks;
- the readiness result or the reason readiness was omitted;
- the verification selection, required review binding and shared repair rule;
- the exact capability bindings for matching implementation operations;
- the human-feedback rule;
- publication limits and the completion evidence to return; and
- the selected model route and any explicit stopping budget.

The inline feedback rule makes later implementation constraints part of the
owner's acceptance criteria before work resumes. Verifying equivalent outputs
does not establish a required implementation property such as reuse of an
existing component. The parent compiles this rule into the owner contract;
leaving it only in parent-facing guidance is insufficient.
When feedback requires using an existing component, reuse means calling that
component from the implementation. Copying or inlining its algorithm creates
another source of behavior and does not satisfy component reuse.

The inline adaptation rule preserves reassessment for material scope,
acceptance, constraint, and authoritative-input changes. A new caller constraint
can invalidate readiness assumptions without changing the feature's stated
scope. Invalidated readiness requires a new ready assessment before affected
implementation; the original ready result cannot satisfy that gate.

The seven-field template covers role, outcome, acceptance, scope and authority,
execution, verification and gates, and completion evidence. Equivalent clear
prose, line wrapping, punctuation, and role wording are valid. Keep the exact
workflow identifier distinct from its implementation steps and preserve scope,
permissions, gates, capability bindings, and concrete route. The shipped skill
does not provide a host contract validator. An eval guard may enforce a stricter
structured template as a separately identified diagnostic condition; its
rejections do not define product behavior.

The compiled sequence starts at the caller-authorized entry point and preserves
explicit ordering and prerequisites. Workflow defaults do not restart completed
phases or move implementation ahead of a requested review of an existing
candidate. When the caller requires review before change, check and review that
unchanged candidate first; repair follows the review under existing authority.

The contract must be understandable without another Darrow file except the
selected workflow document, which the parent reads and incorporates before
launch. Target a task body small enough to pass inline to the host tool. If the
complete contract cannot fit the active host's task input without dropping a
material requirement, stop as `launch_required`; do not truncate or create a
protocol for out-of-band objective persistence.

## Capability bindings

Before launch, enumerate the exact operations in the authorized contract. For
each operation whose intent matches a host-advertised skill, bind that operation
to the exact advertised skill name. Include those bindings in the owner
contract. Typical bindings include ticket reads and updates, TDD, commits, pull
requests, and verification. When verification is selected, preflight also binds
its compatible required independent code-review capability. Assessment runs
through verification; adaptive delivery does not own review's assessment protocol.

Readiness and necessary read-only input gathering may run during preflight.
Preserve completed input evidence and bind any necessary refresh. Implementation,
verification and publication bindings run in the owner when due; selected
assessment-provider bindings travel through verification with preserved authority.
The owner must follow the bound
skill before performing that operation; a direct shell, Git, forge, tracker,
or generic subagent call is not a substitute. A refusal or unavailable bound
skill stops that operation without expanding authority.

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
adaptive delivery owns correlation and naming policy. Bind a host-advertised
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

Use the bundled route policy unless the user explicitly supplied a concrete
host-supported, owner-capable model and effort. Such a user override need not
appear in the policy catalog; the host launch remains its final availability
check. A route that cannot compose the goal's bound capabilities is not
owner-capable and must be rejected before launch.
Repository route overrides apply only through the documented
`.darrow/config.json` surface. Invalid or unreadable owned configuration stops
launch rather than falling back silently.

Bundled policy, repository policy, and explicit routes share semantic
validation before any route is reported or selected: the harness matches the
host, Codex uses `openai`, Claude uses `anthropic`, the model is a concrete safe
identifier other than `none`, and effort is one of `low`, `medium`, `high`,
`xhigh`, `max`, or `ultra`. Host availability remains a launch-time check;
validation must preserve valid off-catalog concrete models and user overrides.

The bundled Codex owner policy is:

| Profile        | Model           | Effort   |
| -------------- | --------------- | -------- |
| `routine`      | `gpt-5.6-terra` | `medium` |
| `routine-plus` | `gpt-5.6-terra` | `high`   |
| `scaled`       | `gpt-5.6-sol`   | `medium` |
| `repo-wide`    | `gpt-5.6-sol`   | `high`   |
| `judgment`     | `gpt-6-astra`   | `high`   |

`gpt-5.6-luna` is not eligible for adaptive-delivery ownership because an owner
must be able to invoke bound readiness and review capabilities through their
native delegation boundaries. This restriction does not remove Luna from
explicit leaf work or evaluation roles outside adaptive-delivery ownership.

Route binding is host-specific:

- Codex: one accepted subagent spawn with the selected concrete model and
  reasoning effort.
- Claude: the bundled resolver validates one scoped agent whose frontmatter
  pins the selected model and effort and rejects higher-priority environment
  overrides. The foreground Agent call omits a per-call model override, so
  native host precedence applies that definition.

If route resolution or launch is rejected or unavailable, stop as
`launch_required`; do not retry with a different owner or silently downgrade.
An eval harness may independently audit the child's transcript to detect a host
regression, but that observation does not add a post-launch product step.

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

When selected, the parent binds and invokes the matching advertised capability
during read-only preflight. It preserves the capability's complete
human-readable result. Only a semantic `ready` result permits owner launch.
`needs-discovery`, `needs-decision`, or `blocked` returns the complete result,
surfaces the smallest unresolved questions, and leaves the product tree
unchanged. The returned capability result starts the response unchanged, with
no preamble or summary; the parent may append the smallest unresolved questions
after that complete result.

After the user resolves those findings, the same adaptive-delivery preflight invokes
the readiness capability again for the same scope. Repeat only while the result
materially changes and concrete findings remain; never infer answers or launch
on a non-ready result. Once ready, compile the settled readiness evidence and
decisions into the owner contract so implementation does not reopen them.

No Darrow helper call records the verdict. The capability result and the fact
that no owner launched before `ready` are the evidence.

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

If a material readiness finding appears after launch, the retained engineering
owner pauses affected implementation and invokes bound or newly necessary
advertised readiness under the same selection rules, even if initially omitted.
A non-ready result returns to that same owner. It may investigate
within authority or relay a material question through the parent; after findings
are resolved it obtains required ready evidence before continuing. The parent
does not take over preflight, launch another owner, or perform the investigation.

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
closed-set owner repair attempts across verification as a whole. One attempt
addresses the combined blockers together, followed by fresh follow-up after
successful invalidated checks. Provider count never increases this budget.
An explicit finite nonnegative
integer user or repository repair budget may change that limit. Apply the
same authorized maximum in the launch contract and owner report; consumed
attempts are a separate count. Finishing after one repair does not change the
default maximum to one or create an implicit override. Resolve the maximum,
its authority source and the consumed count before launch. Before relaying
completion, compare the owner's accounting with that bound allowance. Missing
or contradictory accounting requires corrected status evidence from the same
owner; obtaining that evidence authorizes no additional repair or assessment.
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

## Owner lifecycle

### Launch

The parent launches exactly one adaptive-delivery owner. Its task begins with:

```text
- phase: adaptive-delivery-owner
```

The complete contract follows inline. A marker without the complete contract
is invalid. Its first contract field tells the subagent that it is already the
accepted sole owner. Parent-facing clauses that requested route selection or
owner launch are not copied into its engineering outcome. The owner does not
repeat preflight, invoke `adaptive-delivery`, create another adaptive owner, or
create a second nested goal for the same contract.

After launch acceptance, the parent performs no repository or external work.
It may only wait, relay user feedback or request status from the same owner, or stop that
owner after explicit abandonment or supersession.

### Human feedback

When a material decision first emerges after launch, the owner pauses mutation
and returns the smallest complete question as its paused result. The question
needs no lifecycle marker or canonical serialization.

The parent surfaces the question and retains the same owner. A later explicit
answer is relayed verbatim to that owner. No lifecycle marker or fixed display
summary is required.

The answer grants only explicitly supplied authority. The same owner supplies the
complete answer to any required acknowledgement and requires that operation to
succeed before resuming mutation. A rejected acknowledgement leaves the gate
closed: correct the invocation within authority or return the blocker. Knowing
the intended implementation does not waive the gate. Pending feedback is neither
completion nor a terminal blocker, and no replacement owner is launched.

Corrections, added constraints, cancellation, and status requests also reach
the retained owner without requiring a pending question. On Codex, the same
verbatim feedback fast path handles these messages and answers to questions;
use the host control appropriate to whether that retained owner is running
or idle, without recompiling the engineering request. When feedback is
delivered as a message, it preserves every user-supplied instruction and
constraint without weakening or omission; targeting and host-required routing
metadata remain separate. Restrictions apply before the next affected action.
Status alone does not cancel execution. Cancellation stops further work and
reports already performed effects. Report host transport or stopping
limitations without claiming an unobserved stop.

### Blockage

When work cannot proceed without a state change outside the owner's authority,
the owner returns a concise semantic record:

```text
Status: blocked
Blocker: <specific condition>
Evidence: <current evidence or none>
Next action: <smallest action that could unblock the goal>
```

There is no Darrow retry, waiver, digest, or blocker-transition protocol. A
later user response may resume the same retained owner when it clearly resolves
the blocker. Before repeating an external effect whose result was ambiguous,
the owner observes current external state and does not duplicate an effect that
already completed. An unchanged deterministic failure is not retried without
changed evidence or conditions. These are owner safety duties, not ledger
states.

If the host cannot retain or resume the owner, report that limitation
truthfully. A fresh adaptive-delivery invocation may use current repository and
external state but is a new owner and receives no implicit continuation
authority.

### Completion

The owner returns concise human-readable evidence:

- whether the requested outcome is complete, awaiting feedback, or blocked;
- changed files or an explicit statement that none changed;
- focused and final verification evidence;
- readiness and combined verification outcomes when selected, including complete
  assessment results, material criterion coverage, consumed repair attempts and
  the authorized repair maximum;
- performed publication effects, if any; and
- remaining risks or blockers.

Workflow, risk, semantic profile, and selected route are already established at
the launch boundary and need not be echoed in completion prose. They may be
included for readability, but completion does not depend on their formatting or
restatement.

The host launch guides return through the same completion-evidence check in the
main skill. An owner return alone does not bypass that check. Missing or
contradictory accounting requires a status correction from the retained owner;
if that owner cannot be resumed, report the evidence gap instead of completion.
The parent relays those facts without reconstructing them or running additional
checks. No exact serialization, canonical report prefix, route telemetry row,
child counter, or interruption counter is required. Goal completion grants no
new authority.

## Host launch boundaries

### Codex

Use one first-class host-visible subagent with `fork_turns: none`, the selected
concrete model and reasoning effort, and the complete ownership-marked contract.
The canonical reference returned by the accepted launch identifies the owner
for waiting, feedback, and cleanup; a caller-selected task name is optional.
Do not call `create_goal` inside that subagent for the same contract. Do not
spawn a replacement after acceptance.

### Claude

Resolve one route-specific plugin agent whose frontmatter pins the selected
model and effort, then invoke it once in the foreground with the complete
ownership-marked contract. Use the returned agent id for feedback continuation.
The resolver rejects conflicting environment overrides and the Agent call
omits a per-call model override, leaving the scoped agent frontmatter as the
native route binding. Do not invoke Agent again for the same goal. A later
continuation targets the returned owner id.

### Unavailable launch

If the selected owner boundary or a required readiness/verification/review capability is
unavailable, preserve the product tree and return:

```text
Status: launch_required
Reason: <specific unavailable boundary or capability>
Selected route: <provider/model/effort>
```

The unavailable boundary must be clear; this status block is an example.

Nested host processes are not an adaptive-delivery fallback.

## Invariants

1. **ADL-P1 — Explicit activation.** Ordinary engineering intent never starts
   adaptive-delivery orchestration.
2. **ADL-P2 — Read-only preflight.** Product mutation and verification begin
   only in the accepted owner. Preflight evidence belongs to the explicitly
   requested working tree and cannot be redirected by ambient Git selectors.
3. **ADL-P3 — Preserved authority.** Delegation and activation add no
   permissions or publication authority.
4. **ADL-P4 — One bounded contract.** The owner receives the complete request,
   acceptance, scope, gates, checks, and authority inline.
5. **ADL-C1 — One workflow and risk.** Classification follows the documented
   tie-breakers and consequence model. The launch contract keeps the exact
   workflow identifier separate from its implementation sequence.
6. **ADL-R1 — Concrete selected route.** Policy or an explicit user override
   resolves to one host/provider/model/effort tuple before launch. Both sources
   pass the same host/provider, concrete-model, and effort validation before
   reporting or selection.
7. **ADL-R2 — Native route binding.** Codex launches with an explicit spawn
   tuple. Claude resolves a scoped agent with the selected model and effort,
   rejects higher-priority environment overrides, and launches without a
   per-call model override. Transcript auditing is evaluator-owned and never a
   parent workflow step.
8. **ADL-L1 — One Darrow owner.** Exactly one route-selected subagent owns the
   complete run. It creates no replacement adaptive owner or nested goal for
   the same contract.
9. **ADL-L2 — Semantic gates.** Readiness completes before launch; every
   applicable current check succeeds before selected verification and every
   dependent commit or publication effect. The owner invokes verification with
   the candidate, originating criteria, constraints and existing evidence;
   no assessment can waive a failed check. An explicit assessment-before-change
   request starts with checks and verification of the unchanged existing
   candidate; classifier inspection is not that independent assessment.
   The gates are proven by capability results and observable
   repository behavior, not bookkeeping transitions.
10. **ADL-L3 — Same-owner feedback.** Questions, answers, steering, cancellation,
    and status requests remain attached to the accepted owner when supported.
    For message-based relay, the payload equals the complete current user
    message verbatim and exactly once; prefixes, suffixes, quotations,
    summaries, lifecycle markers, and routing metadata do not enter that
    payload.
11. **ADL-L4 — Semantic blockage.** A blocker names its condition, evidence,
    and next action without a Darrow retry state machine.
12. **ADL-L5 — Owner-sourced completion.** The parent relays the owner's
    changed-file, combined verification conclusion, selected assessment results,
    criterion coverage, consumed repair budget, publication, and residual-risk facts.
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
17. **ADL-X1 — No lifecycle ledger.** `adaptive-delivery` ships no required run
    ledger, lifecycle hook, blocker protocol, canonical helper report, or
    model-operated transition sequence.
18. **ADL-E1 — Evidence-appropriate evaluation.** `adaptive-delivery` evals prove
    repository and external effects with passive fixture event logs under
    `.git/fixture-state/`, exact public tokens with rigid output checks, and
    paraphrasable prose contracts with fail-closed semantic output checks.
    Fixture CLI help requests remain read-only and never count as completed
    assessments or external
    effects or consume publication authorization.
    Recovered skill-read record position is not temporal evidence. Pre-owner
    read checks require complete parent-local reads before the native spawn
    request; child reads and post-launch recovery do not establish preflight.
    Owner-boundary guards ignore only the named readiness preflight traces in
    that ledger; all product-tree and other fixture-state changes remain
    protected before owner launch.

19. **ADL-B1 — Token-correlated branch choice.** Before authorized ticket
    branch creation, adaptive delivery consumes complete exact-token Git
    capability evidence and applies the one/many/zero-match policy above. The
    recipe owns no branch choice; the Git capability owns deterministic
    discovery and preparation.

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

### Adaptation and evaluation fidelity (#102)

The following invariants govern adaptation and evidence provenance:

- **ADL-A1 — Owner reassessment.** Material changes invalidate only affected
  assumptions, readiness, and verification evidence. The retained owner pauses
  affected implementation, invokes necessary advertised read-only readiness,
  and strengthens checks within existing scope and authority. Required ready
  evidence must precede resumed implementation. Missing product decisions or
  expanded effects require the user's answer; the parent never takes over.
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
  Default to at most two owner repair attempts across verification as a whole;
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
  gate. The same owner applies the limit; no parent repair controller is added.
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
- **ADL-A5 — Semantic presentation.** The seven contract fields are a
  completeness template. Equivalent clear prose, line wrapping, punctuation,
  status presentation, and role wording are valid. Preserve exact tool keys,
  route identifiers, and the owner task marker consumed by the owner interface.
  No runtime contract validator or mandatory closing disclaimer is claimed.
- **ADL-E2 — Enforcement provenance.** Retain whether candidate execution used
  active eval enforcement or passive observation. Passive trials install no
  adaptive-delivery guard, rewrite no launch input, and block no candidate operation
  for product-policy compliance. Ordinary fixture isolation remains in both
  conditions. Unknown or incomplete observation proves no missing fact.
  Compare direct execution and preflight on the same fixtures and model/effort
  routes separately from comparisons changing routes; report sample sizes,
  outcomes, timing, token-accounting completeness, and limitations.

Real review-composition fixtures accept the canonical human report as well as
the comprehensive and additive fix-verification machine artifacts. The fixture
may validate a human report against its retained canonical source without making
callers reconstruct a provider's private serialization. Completion consumes an explicitly selected,
validated clear artifact covering current content; a verification retains its
binding to the original comprehensive finding set. Nonblocking advisories do
not prevent completion. Artifact filename ordering is not evidence of recency
or authority.

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
host's login and non-login shell wrappers. Parent-before-owner evidence still
requires a completed full body read by that parent before the accepted launch.
For missing activation, retain bounded parent-read diagnostics for known mounted
skills: read recognition and body-presence facts, native path binding, and
ordering. Such diagnostics carry no private commands or output and confer no
activation credit by themselves.
Readiness-selection evals require actual ready evidence before affected work,
not an invented exact assessment count. Additional read-only reassessment does
not excuse non-ready evidence, missing assessment, or mutation before the gate.
Composed fixture capabilities use the accepted owner contract as the execution
boundary. They must not demand a second active current-thread goal or forbid
the parent's required read-only input gathering. Such obsolete prerequisites
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
- one accepted Codex owner and one accepted Claude owner;
- no `adaptive-delivery-preflight step` calls and no nested `create_goal` for
  the same contract;
- readiness selected, omitted, iterative non-ready, and unavailable behavior;
- review selected, omitted, clear, blocking, and unavailable behavior;
- exact intent-based capability invocation for ticket, Git, review, and other
  advertised operations;
- same-owner human-feedback relay;
- semantic blockage and observe-before-retry behavior;
- preservation of local work and publication authority; and
- focused versus final verification cadence.

Across the full adaptive-delivery suite, sentence-shaped propositions must not be
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
- Reimplementing native goal persistence inside the selected subagent.
- Unbounded child-transcript inspection or reconstruction of owner work; the
  narrow Claude model/effort observation is required host evidence.
- Nested Codex or Claude processes.
- Parallel candidate implementations or replacement adaptive owners.
- Review or readiness judgment inside adaptive-delivery.
- Publication authority derived from goal completion.
