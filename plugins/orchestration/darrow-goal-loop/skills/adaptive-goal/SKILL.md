---
name: adaptive-goal
description: Compile one bounded engineering request and activate it as a host-native goal with a proportionate workflow, risk gate, model, and effort. Use when the user explicitly requests adaptive goal orchestration or an already explicitly invoked orchestration delegates one bounded request; do not select merely because ordinary work is complex or long-running.
---

# Adaptive Goal Loop

Compile the request, activate one host-native goal owner, and let the host own
the loop.

## Confirm invocation authority

Start only when the current context establishes one of these entry conditions:

- the user explicitly invoked adaptive goal orchestration; or
- an orchestration entrypoint the user explicitly invoked delegates one bounded
  request and preserves the originating request and permissions.

A delegated call adds no authority. Treat its originating request as the
authority source and preserve every scope, permission, publication, and safety
boundary. Ordinary engineering intent, task complexity, duration, or number of
steps never authorizes orchestration. If neither entry condition is present,
stop before running the helper, consuming further orchestration budget, or
editing the worktree. Return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

### Enforce the activation barrier

Do not edit product files until read-only preflight is complete and exactly one
goal owner has been activated on a verified route. Preflight includes preparing
repository evidence, selecting workflow/risk/profile/route, and proving any
selected independent-review capability is already available. Direct
implementation in the classifier turn is invalid. Same-thread implementation
is valid only after concrete active-route metadata matches selection and the
native goal is accepted. If no boundary can prove those conditions, preserve
the product tree and stop with the complete human-readable `launch_required`
report.

On every harness, repository evidence collection is inspection only. The
classifier MUST NOT execute a focused check, test command, build, typecheck,
lint, review, or verification probe before the goal owner starts, even when the
command is read-only with respect to product files or would make later review
easier. It records the applicable commands in `Feedback checks:` and
`Final-tree checks:` for the owner to run. After a delegated owner starts, the
creator uses only that exact thread's wait, feedback relay, stop, or close
controls and the state-bound objective-release helper described by the launch
guide; it runs no repository or verification command itself.

Treat imperative implementation, check, and review steps in the originating
request as owner instructions to compile into the contract. Their imperative
wording never authorizes the classifier to execute them before activation.

Review availability is a hard part of that barrier when review is selected.
Before any goal-owner spawn for such a contract, identify a host-advertised
skill or tool whose description explicitly matches independent review of the
exact current code change. `spawn_agent`, an Agent tool, a fresh context, or a
review prompt is generic delegation—not a review capability. If generic
delegation is all the environment exposes, do not spawn, edit, or run
implementation checks; return the unavailable-review evidence gap and the
complete `launch_required` report. Include the standalone canonical sentence
`Independent review availability: unavailable.` When review is omitted, this
availability check does not apply.

### Claude activation is mandatory

On Claude, this entire preflight and launch sequence is mandatory even for a
small or obvious task. Before any product write, run `prepare --host claude`,
select the dimensions, run `route --host claude`, read `claude-launch.md`, and
activate the first boundary that can apply that exact helper-selected route.
Do not implement directly in the classifier turn, replace the selected harness
with a boundary label such as `current-thread`, or report same-thread activation
without route-confirmation evidence. If any required step cannot run, stop as
`launch_required`; skipping the sequence is a failed skill execution.
Use this fixed, non-reorderable Claude boundary sequence: (1) prepare, (2)
route, (3) resolve the exact immutable runner, (4) probe `TMPDIR`, (5) make the
one staging Write, (6) materialize, (7) release staging, (8) invoke the one
foreground Agent, (9) after its terminal result run the route gate, and (10)
release a file-backed objective when present. Never jump to the temporary-root
probe, Write, materialization, Agent, or gate because its detailed section
appears earlier in a guide or seems immediately actionable. A missing, failed,
out-of-order, duplicate, or retried step stops before Agent activation.
Claude's materialization call always includes `--force-file-backed`; its Agent
task therefore carries exactly one objective body field,
`- objective_file: <exact-helper-returned-path>`, after the ownership marker.
Never copy the inline contract into a Claude Agent call or omit that field.
The first protocol-bearing Bash call is the exact standalone `prepare` command. Resolve any
unknown repository, plugin, or helper path beforehand with Claude's native
`Read`, `Glob`, or `Grep`, using `ToolSearch` only to load those native tools
when needed; never substitute Bash `find`, `ls`, or another shell
inspection, even with output redirected to `/dev/null`.
Reason internally until every literal argument is known. An exact standalone
`true` is tolerated only as an inert host no-op: it advances no sequence state
and supplies no evidence. Do not issue any other planning or placeholder Bash
call, or combine `true` with another command; those are executed boundary
events, not a scratchpad.
The classifier may inspect repository evidence needed to compile the contract,
but MUST NOT edit product files or run implementation or verification commands
before the selected Agent owner starts. Stage the compiled contract once with
the host file-write tool inside the runner's isolated temporary root, resolving
that root only with the standalone `/usr/bin/printenv TMPDIR` command;
all pre-owner Bash calls are limited to the exact bundled prepare, route,
runner-resolution, materialization, staging-release, and temporary-root probe
commands. Use Claude's native `Read`, `Glob`, and `Grep` tools for any permitted
repository inspection; `ToolSearch` may load those tools. Never use Bash for discovery, listing, status, hashing,
inspection, implementation, tests, or a compound command before the Agent;
even a read-only shell command invalidates sole-owner evidence. Stage the
contract only with the one native `Write`: never use `>`, `>>`, a heredoc,
`tee`, or another shell file-creation command. Use that exact staging path for
materialization, require the returned
contract digest to match the staged bytes, and require the exact successful
staging release before owner activation; path aliases or locations outside the
isolated temporary root are not private staging.

## 1. Prepare without writing

Resolve the repository and bundled helper to absolute paths, substitute them
literally, then run one standalone command:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop prepare --repo <absolute-repo> --host <codex|claude>
```

On Claude, do not translate this into assignments, shell expansions, command
lists, or a preliminary lookup command; `claude-launch.md` owns the exact
allowed command shape.

Use the prepared repository state, instruction routes, profile mappings,
workflow paths, and risk gates as evidence. Inspect additional repository files
only when a material decision, unsafe overlap, or verification command remains
unknown. Keep product files unchanged and treat recorded local changes as
user-owned.

Turn the request into observable completion criteria without choosing missing
product behavior. If behavior, authority, destructive scope, or a safety policy
is materially missing, select `decision-gated`, read its workflow document, and
stop with this record:

```text
format: darrow-native-goal-report-v1
workflow: decision-gated
risk: high
profile: none
harness: none
model: none > none
effort: none
route_applied_by: none
route_verified: false
launch_boundary: launch_required
verification_gate: not-applicable
evaluation_child_invocations: 0
evaluation_human_interruptions: 1
```

Name the smallest missing decision and do not activate implementation work.

## 2. Compile workflow, risk, and route

<!-- intent-routing-begin -->
### Select exactly one workflow and one risk

- [`fix-bug`](references/workflows/fix-bug.md): existing promised behavior is
  incorrect.
- [`implement-feature`](references/workflows/implement-feature.md): new
  observable behavior does not exist.
- [`change-feature`](references/workflows/change-feature.md): approved existing
  behavior intentionally changes.
- [`refactor`](references/workflows/refactor.md): observable behavior must
  remain unchanged.
- [`migration`](references/workflows/migration.md): consumers or formats require
  a sequenced transition.
- [`mechanical`](references/workflows/mechanical.md): the request is an exact
  deterministic non-behavioral transformation with a complete oracle.
- [`decision-gated`](references/workflows/decision-gated.md): a required product
  choice or authority is missing.

Apply these tie-breakers in order:

1. `decision-gated` wins whenever implementation requires a missing choice or
   authority.
2. Choose `migration` over `change-feature` only when consumers, formats,
   coexistence, or rollout require a sequence; one approved behavior change is
   `change-feature`.
3. Choose `change-feature` over `fix-bug` when current behavior is intentional
   and the approved contract changes; choose `fix-bug` when current behavior
   violates an existing promise.
4. Choose `implement-feature` only when no equivalent behavior exists; altering
   or replacing an existing behavior is `change-feature`.
5. Choose `change-feature` over `mechanical` when an exact transformation still
   intentionally changes observable runtime behavior or an existing contract.
6. Choose `mechanical` over `refactor` only for an exact transformation with a
   complete oracle; restructuring that requires judgment is `refactor`.
7. `refactor` is valid only when observable behavior remains unchanged.

Select risk from consequences, taking the highest applicable level:

- `routine`: localized, reversible, and limited blast radius;
- `elevated`: compatibility concerns, multiple consumers, persisted formats,
  or meaningful operational impact;
- `high`: security or authorization boundaries, destructive or irreversible
  state, privacy or safety, or broad blast radius.

Changing an existing promised output for inputs callers may already use is a
compatibility concern. When the request requires compatibility evidence for
that contract change, select at least `elevated` even if the edit is localized.

Reasoning difficulty never changes risk. A difficult diagnosis can be
`routine`; a simple security change is `high`.

Select independent code review separately from implementation discipline:

| Situation | Independent review selection |
| --- | --- |
| `routine` risk | do not select automatically |
| `elevated` risk | select when compatibility, caller impact, or counterexample analysis needs independent judgment |
| `high` risk | select by default |
| any risk | select when repository policy or the user requires it |

A persisted-format coexistence transition that coordinates a writer, a
dual-format reader, a migration utility, and multiple consumers needs
independent compatibility judgment; select review under the elevated-risk rule.

When review is selected, the goal contract requests an available environment
capability matching this intent: independently review the exact current code
change. Do not name or assume a plugin implementation, command, or output
format. Before repository mutation, confirm that the environment exposes a
capability matching that intent. An ad hoc prompt, generic subagent,
same-context judgment, or capability created during the run is not availability
evidence. Stop honestly when no matching capability exists. A matching
capability may use fresh readers internally; native delegation alone cannot
satisfy this gate. An availability stop returns the evidence gap together with
the mandatory human-readable report.
Represent the decision in the compiled contract with one unambiguous line
beginning `Independent review: selected —` or
`Independent review: omitted —`, followed by the reason. High risk MUST use
`selected` unless an explicit stronger user or repository rule makes
implementation stop before activation.

Classify reasoning demand independently from workflow and risk:

- `ordinary-localized`: the implementation is clear and localized;
- `scaled-coding`: straightforward work spans several files or components;
- `repo-wide-coding`: straightforward work requires repository-wide changes;
- `judgment`: the cause is unknown across multiple plausible layers or state
  transitions, or the task requires architecture, planning, or review
  judgment.

Select from the reasoning uncertainty established by the request and permitted
read-only preflight at activation time. An explicitly unresolved hard diagnosis
across multiple plausible layers or state transitions remains `judgment`; a
small eventual patch or a cause recognized after activation does not
retroactively downgrade it.

A sequenced transition spanning a producer or writer, compatibility reader,
migration utility, and multiple consumers is `scaled-coding`. Short individual
edits or a compact repository do not make that multi-component implementation
`ordinary-localized`.

Implementation size, reversibility, and consequence risk do not reduce a
`judgment` task to ordinary coding.

Compile feedback checks and final-tree checks separately in the goal contract.
Feedback checks are the smallest repository-supported commands that exercise
the changed seam, such as one test target, an affected-package typecheck, or a
narrow build or lint command. When the selected workflow adds acceptance or
regression evidence at a stable seam with an independent oracle, run that
evidence before the corresponding production change, confirm it fails for the
intended reason, and rerun it after each coherent slice. For
behavior-preserving work, start with passing focused evidence and keep it green
after each slice. Final-tree checks are the applicable scoped repository gate
plus the risk gate below; run them once after implementation and affected
callers or documentation appear complete, and rerun them only after later edits
invalidate that result. Do not use broad final-tree gates as routine
implementation feedback. Follow any different repository-mandated cadence, and
do not invent a seam, oracle, or command merely to imitate test-first work.

Compile this human-feedback rule into every activated contract. A material
decision known during preflight still selects `decision-gated` and prevents
launch. When a material decision first emerges after activation, pause
repository and external mutation and ask only the smallest concrete question.
A current-thread owner asks the user directly. A delegated owner sends the
question to its creator; the creator surfaces it to the user and relays the
explicit answer to that same still-active owner. Pending feedback is neither
completion nor blockage while that relay remains available: do not close the
owner, launch a replacement, or choose a default. Resume only the authorized
work after the exact answer arrives; it grants no authority beyond what it
states. When the originating request explicitly authorizes one named external
answer-acquisition command, run that exact command only after the owner returns
the material question, treat its successful output as the explicit user answer,
and relay it without asking the caller the same question again. Do not infer an
answer from the command name or run any broader command. If the host cannot
relay feedback, preserve the active or resumable
goal state and return the question honestly without further mutation. Every
pause response begins with the exact marker `- phase: human-feedback-request`,
states the complete smallest question, and may include the full Section 4
human-readable report as a truthful current snapshot. The report is optional
and never continuation authority; the active owner and objective preserve that
state. Never return a bare marker or question. Count each
distinct question presented for user decision once in
`evaluation_human_interruptions`, including a question resolved during the same
run. After the answer returns, the same owner performs any acknowledgement
command or handshake required by the repository or compiled contract, using
the exact relayed answer, and confirms it succeeds before resuming mutation.
The creator obtains and relays the answer but never acknowledges on the owner's
behalf. For each resolved question, the owner's terminal result states that the
exact answer was applied on one line as
`Applied relayed decision: <exact answer>`. The creator preserves each such
line in the caller-facing completion. An optional Markdown bullet, inline code
around the answer, or terminal period is presentation only.

Apply the selected proportional risk gate:

| Risk | Required verification |
| --- | --- |
| `routine` | focused acceptance or characterization evidence plus the scoped repository gate |
| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample |
| `high` | elevated gates plus an adversarial boundary or state-transition check and independent final-tree review |

For selected independent review, compile this continuation behavior into the
goal contract: invoke the matching capability after implementation and
applicable final-tree checks, supplying the exact final change, originating
objective or specification, repository standards, and current check evidence.
Treat a preexisting candidate described as review-ready as unverified: before
the initial comprehensive review, run every applicable exact-target check
required by the selected risk gate and supply that current evidence to the
review capability.
Its current content is the first review target. Do not edit it before that
review returns, even when a check fails or it already differs from the approved
final outcome; any authorized repair starts only from the review's closed
finding set.
Target preparation starts the review boundary. Finish only that capability
invocation and await its ordinary response before any other repository work;
do no repository work outside the capability invocation while it is pending.
Interpret the capability's ordinary response semantically. No blocking
findings in the initial comprehensive review satisfy the gate for that exact
content without adding authority. Otherwise that one comprehensive review
establishes the closed finding set for all rework and verification.

Make the caller-facing outcome explicit: report a clear initial result as the
standalone canonical sentence `Independent review: clear.` It may occupy its
own Markdown bullet, and balanced strong emphasis may surround the label or the
entire exact sentence, but it must otherwise be its own unquoted line; do not embed it in another
clause. Prose paraphrases, negated framing, quotations, and qualified or
ambiguous continuations are not outcomes. An initial blocking result that
cannot be repaired is `Independent review: blocking — <finding>` on its own
line. After repair, preserve
`Initial independent review: blocking — <finding>` and report the exact-target
result as the standalone sentence
`Fix verification: <clear|continue|no_progress|blocked|unavailable|inconclusive>.`
Do not rely on nearby
prose or a provider-specific serialization to imply these outcomes. Supporting
detail belongs on another line; the canonical outcome sentence has no suffix.
Preserve the verifier's returned outcome verbatim even when an explicit limit
converts the overall review gate to `blocked`. Do not rewrite `continue` as
`blocked`; report the overall stop in the separate review-gate sentence.
An initial `unavailable`, `inconclusive`, or otherwise terminal unsatisfied
review result does not replace the outer launch result. Before returning, append
the complete Section 4 human-readable report with the truthful blocked
review-gate state and counters.

First rework attempts every eligible finding together. Eligibility requires
existing repair authority, clear originating scope, low risk, no expansion of
requested behavior, and no material expansion of verification. Attempt every
eligible blocker and advisory. Record an ineligible blocker as blocked; retain
an ineligible advisory only as a non-gating residual risk.

One rework performs at most one authorized repair attempt per finding. After
that attempt, run the invalidated checks and request fix verification; never
self-iterate on the same finding before that response. A second attempt belongs
to a later rework and is available only when verification returns `continue`
and existing authority covers it.

After each rework, rerun invalidated checks and ask the same matching capability
to fix-verify only the attempted original findings and direct repair-caused
regressions. Supply the original findings and target, canonical finding order,
prior and current targets, prior target history, the prior scope manifest, the
immediately prior verification artifact with its checksum and carried
regressions when one exists, and current check evidence. The review capability
pins the prior-to-current repair delta mechanically against the prior scope's
same effective base; caller prose does not establish causality. Targeted verification cannot introduce an unrelated finding. It
reports `clear`, `continue`, `no_progress`, `blocked`, `unavailable`, or
`inconclusive`.

Check evidence established after the latest content edit and supplied to fix
verification remains final-tree evidence for that exact content. The review
response does not itself invalidate those checks. If that response reaches an
explicit limit or another terminal stop without authorizing a later edit, do
not rerun a check after the response. With selected review, run the last
final-tree check for an exact target before its review invocation. Never call a
post-review check final verification; it is forbidden after a terminal
response.

`clear` satisfies the exact-content gate. Continue only while an unresolved
blocker or repair-caused regression materially progresses. Later rework fixes
only unresolved blockers and repair-caused regressions. A direct regression
first detected by verification is progressing for one repair attempt; unchanged
evidence after that attempt is no progress. Advisories never keep the gate open.
When `continue` names an unresolved blocker or direct regression and existing
authority covers its concrete repair, perform that later rework, rerun the
invalidated checks, and request fix verification again. Do not treat
`continue`, the first appearance of a direct regression, or the mere existence
of an earlier repair round as a stop condition.
Repeated targets, unchanged failure evidence, or oscillation to an earlier
target is `no_progress`. `no_progress`, `blocked`, unavailable or inconclusive
evidence, exhausted authority, or an explicit review limit stops with the
unsatisfied gate and permits no further repair or publication.

Before every fix-verification invocation after the first, compare the
prospective current target fingerprint with the complete prior target history.
A verifier-requested later repair that would restore exact content already in
that history stops before editing the current target or rerunning its checks.
A repeated or earlier fingerprint stops as `no_progress` before invoking the
capability; never make the redundant verification call. Because that stop has
no new verifier response, preserve the latest returned standalone
`Fix verification: continue.` line and report the repeated-target or
oscillation `no_progress` stop separately. Never synthesize
`Fix verification: no_progress.` unless the capability actually returned that
outcome.

There is no default numeric review limit. If the originating request explicitly
supplies one, preserve it as a hard cap on all capability invocations including
the initial comprehensive review; reaching it stops even otherwise-progressing
convergence. It grants no authority and never permits completion without clear
exact-target evidence. A terminal stop caused by that limit reports the
standalone canonical sentence `Review gate: blocked — explicit limit reached.`
Any later content-changing edit invalidates the chain.

When the host persists native-goal status, settle every terminal unsatisfied
review stop as `blocked` before returning. If the host requires a repeated
blocker audit, do not count review invocations as goal turns. Any required
automatic continuation is status settlement only: preserve the same gate,
perform no repository inspection, edit, check, review, or publication, and
mark the goal `blocked` as soon as the host permits it.
<!-- intent-routing-end -->

Read the selected workflow document completely. The workflow document
determines the execution sequence. Do not combine workflows or substitute a
domain label for one. Small size alone is not mechanical.

Choose risk and profile independently. Risk reflects the cost of an incorrect
result and changes verification; profile reflects the kind and scale of
reasoning needed and changes the model route. Do not raise the profile only
because risk is `high`, and do not lower risk because implementation is simple:

- `routine` for `ordinary-localized`, including exact mechanical work and
  clear, fully specified changes regardless of consequence severity;
- `routine-plus` only when localized implementation itself needs additional
  reasoning, including an explicit request that boundary-sensitive first-pass
  correctness take priority over the cheapest routine route or repository
  evidence of materially competing implementations;
- `scaled` for `scaled-coding`;
- `repo-wide` for `repo-wide-coding`;
- `judgment` for `judgment` work.

Risk alone, a security boundary, and added verification work never justify
`routine-plus` when implementation behavior is clear and fully specified.

An explicit user model or effort wins. Resolve the concrete route:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop route --repo <absolute-repo> --host <codex|claude> \
  --profile <routine|routine-plus|scaled|repo-wide|judgment> \
  [--route 'harness|provider|model|effort']
```

Pass `--route` only when the engineering request explicitly pins it. The
classifier route, host defaults, and enclosing evaluator are metadata, not user
overrides. `inherit`, `current`, `default`, or an unresolved alias is not an
auditable model identifier.

The helper resolves policy from the active worktree root. The shared
`<repo>/.darrow/config.json` object may contain independent `routes` and
`reviewers` sections. When the file or its `routes` section is absent or empty,
goal routes come from bundled policy. Otherwise strict `routes` entries replace
matching bundled `(host, profile)` entries and other profiles inherit bundled
routes. Goal routing syntax-checks but does not interpret the sibling
`reviewers` section. A present repository configuration must be readable and
valid as a whole, and every owned route must validate against the bundled
host/profile catalog and host/harness relation; any failure is a stop, not a
fallback. `route_source` remains `policy` or `user` authority; for policy
routes, `policy_route_source` discloses `repository` or `bundled` provenance.

Write one complete goal contract containing the outcome, acceptance criteria,
scope and non-goals, preserved work, permissions, the selected workflow and its
sequence, risk gate, profile and concrete route, applicable feedback checks and
final-tree checks, whether independent review is selected and why, its portable
continuation clause when selected, any user-specified stopping budget including
an explicit review-round limit, the human-feedback rule above, the Section 4
human-readable completion-report rule, and this exact internal launch record.
Write each contract component once, before the internal record, using these
exact nonempty one-line labels: `Outcome:`, `Acceptance criteria:`, `Scope:`,
`Non-goals:`, `Preserved work:`, `Permissions:`, `Workflow sequence:`,
`Feedback checks:`, `Final-tree checks:`, `Independent review:`,
`Stopping budget:`, `Human feedback:`, and `Completion report:`. Reference
longer repository-owned details by path. Use an explicit `none` explanation
when an optional budget or permission is absent; never drop its label.
Target
at most 4,000 bytes by referencing repository facts, but never truncate, omit,
or rewrite a material requirement merely to fit the inline objective limit. A
filesystem-sharing launch boundary uses a verified file-backed objective when
the complete contract is larger:

```text
format\tdarrow-native-goal-preflight-v4
workflow\t<workflow>
risk\t<routine|elevated|high>
profile\t<routine|routine-plus|scaled|repo-wide|judgment>
selected_route\t<harness>\t<provider>\t<model>\t<effort>
effective_route\t<harness>\t<provider>\t<model>\t<effort>
route_applied_by\t<current-thread|host-api|native-subagent|nested-session|none>
route_verified\t<true|false>
launch_boundary\t<same_thread|host_api|native_subagent|nested_session|launch_required>
verification_gate\t<routine|elevated|high|not-applicable>
evaluation_child_invocations\t<integer>
evaluation_human_interruptions\t<integer>
```

Reference repository facts by path rather than copying them. Leave detailed
implementation choices to the host-native goal owner.

Include branch, commit, push, pull-request, or other publication effects only
when the originating request explicitly authorized each effect and host policy
still permits it. Preserve that authority in the contract; never derive it
from successful implementation or eventual goal completion.
When independent review is selected, perform no not-yet-completed publication
effect after blocking findings or an unavailable or inconclusive review, or
against content changed after review. A clear review grants no publication
authority.

## 3. Activate exactly one host-native goal owner

When an enclosing host API requests a preflight handoff, do not edit product
files, call `create_goal`, or launch a nested session in the classifier turn.
Return exactly one object and stop that turn:

```json
{
  "format": "darrow-native-goal-handoff-v3",
  "workflow": "<workflow>",
  "risk": "<routine|elevated|high>",
  "profile": "<routine|routine-plus|scaled|repo-wide|judgment>",
  "routeSource": "<policy|user>",
  "independentReview": {
    "selection": "<selected|omitted>",
    "reason": "<concise non-empty reason>"
  },
  "selectedRoute": {
    "harness": "<harness>",
    "provider": "<provider>",
    "model": "<concrete-model>",
    "effort": "<concrete-effort>"
  },
  "goalContract": "<complete contract without the review clause; target 4,000 bytes without dropping requirements>"
}
```

Leave the `Independent review:` line out of `goalContract` in this host-API
handoff. The enclosing launcher validates the structured decision and compiles
the canonical portable clause, replacing any redundant line if one is present;
high-risk handoffs that omit review are invalid. Add `roundLimit` as a positive
integer only when the originating request explicitly supplies that exact
review-round limit. Omit it for selected progress-bounded convergence and when
review is omitted. The launcher validates it against the originating request
and fails closed on a missing, mismatched, ambiguous, or unauthorized limit. It
compiles the review clause without dropping requirements and
uses the verified file-backed objective path when the complete contract exceeds
the native inline limit.

The enclosing launcher validates the selected route against the live host
catalog and policy profile, loads the exact selected workflow document,
materializes a bounded inline or file-backed native objective before its first
goal-set call, sets the native goal exactly once, and starts the execution turn
with that document plus the selected model and effort. It keeps any file-backed
contract readable until the goal terminates. Its accepted turn request is
route-application evidence; a workflow identifier, path, and content hash on
the same receiving turn is workflow-loading evidence. The handoff alone proves
neither.

For an interactive invocation, read exactly one host launch guide completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

Prefer the current thread only when host metadata proves its effective route
matches the selected route. Otherwise use a supported host API, then on Codex
use exactly one first-class native goal runner when `spawn_agent` can apply the
selected model and effort, without requiring a close control. Its initial task
message begins with the exact ownership marker
`- phase: adaptive-goal-runner`; generic delegation without that marker is not
the goal-owner boundary. The remaining task body binds either delegated runner
to the successful materialization: supply the exact complete inline objective
or, for file-backed materialization, the one exact
`- objective_file: <helper-returned-absolute-objective_file>` line. The owner
reads that bounded objective and verifies the attached complete contract; the
classifier does not read, hash, copy, or reproduce it. Add no digest, workflow
proof, explanation, or other task text. The bound objective file is the sole
task authority. Do not start the Agent before materialization succeeds. A
marker-only task is not a goal. A nested
compatibility process requires explicit user authorization and an enclosing
launcher; never select it automatically from an interactive skill. If no
boundary can apply the route, report `launch_required` honestly and stop.

If your current task begins with `- phase: adaptive-goal-runner`, the accepted
spawn already activated you as the sole goal owner. Execute the supplied goal
contract directly. Do not invoke this skill again, repeat preflight, spawn a
replacement owner, or return `launch_required` because `create_goal` is absent.
When native goal-state control is exposed, use it exactly once to persist the
goal; otherwise the accepted runner task remains the ownership boundary.

For a Codex native runner, the guard-attested accepted spawn with its concrete
model and effort is the route confirmation. The creator never runs
`confirm-route` or another shell confirmation around that boundary; after
activation it only waits, performs an authorized feedback relay, releases a
file-backed objective after terminal collection, and closes the owner when the
host exposes that control.

Activate exactly one goal owner. Darrow adds no planner, verifier, repair agent,
retry loop, or cross-vendor route. The native goal or allowed Claude Agent
runner owns implementation, verification, recovery, and completion.

## 4. Return host-native completion

Continue until the selected goal owner reaches a terminal state or pauses for
material human feedback. For a delegated owner, keep the same owner active,
relay its smallest question to the user, send the exact answer back, and then
continue collecting that owner's result. When feedback cannot be relayed in
the current run, preserve the active goal and its objective attachment, return
at least the canonical feedback marker and complete smallest question, and do
not claim completion or blockage. The terminal human-readable report is
optional on a nonterminal pause; if included, keep it truthful, but never treat
it as continuation authority. The host-preserved owner and objective are the
continuation state. A native goal runner may use host-native subagents for bounded work;
it remains the sole goal owner, and Darrow does not prescribe planner,
executor, verifier, or repair roles.
After a delegated owner returns terminally, only collect and render its result.
Do not inspect or edit the repository, rerun any focused or final-tree command,
or substitute parent-thread verification; that would violate sole ownership
and duplicate the compiled cadence. On Claude, the only post-return tool calls
are one required `claude-route-gate` invocation and the exact terminal
`release-objective` cleanup when an attachment exists; neither authorizes
repository inspection. The gate binds the completed Agent's host-reported id,
transcript observation, and confirmation atomically. Only its successful
confirmation of a matching observed route permits `route_verified: true`.
Do not return the delegated owner's prose unchanged when it omits or malforms
the mandatory report. Render the exact Section 4 report from the retained v4
launch values and observed route boundary, then preserve the owner's changed-file,
verification, review, and risk prose alongside it. This rendering is collection,
not authority to inspect or revalidate the repository.
Immediately before any terminal response, perform one response-only validation:
exactly one contiguous report block must begin with
`format: darrow-native-goal-report-v1` and contain every ordered field below. If
it is absent or malformed, repair that block from the retained values before
sending. Do not read repository state for this validation.
On Codex, every agent creator collects the child's terminal result. When the
host exposes a close control, close the subagent after its goal has been
fulfilled and its terminal result has been collected. The goal runner applies
the same guidance to descendants it creates. If an active child becomes
unnecessary, stop or interrupt it when the host exposes that control. Absence
or failure of a close control does not block launch or invalidate an otherwise
fulfilled goal; report any residual cleanup state without replacing the goal's
terminal result.
After the one goal-owner spawn is accepted, `spawn_agent` is forbidden for the
rest of the invocation, including tool discovery, waiting, retry, or cleanup.
Wait for, message, stop, or close only the accepted thread through the matching
host control; never create a helper or replacement while locating that control.
`decision-gated` is the terminal preflight exception to the general completion
template below. Copy the fixed report from Section 1 exactly. Because no route
or goal was activated, never replace its `none`, `false`, `launch_required`,
`not-applicable`, zero-child, or one-interruption values with selected-route or
ordinary launch values.
Every terminal final response must begin with the internal v4 launch values as
this exact human-readable report. Its `format:` line is the first
non-whitespace line; do not put prose, a heading, a bullet, or a Markdown code
fence before or around it. Use one `key: value` per line, combine the effective
provider and model with ` > `, and keep effort separate:

```text
format: darrow-native-goal-report-v1
workflow: <workflow>
risk: <routine|elevated|high>
profile: <routine|routine-plus|scaled|repo-wide|judgment|none>
harness: <harness|none>
model: <provider|none> > <model|none>
effort: <effort|none>
route_applied_by: <current-thread|host-api|native-subagent|nested-session|none>
route_verified: <true|false>
launch_boundary: <same_thread|host_api|native_subagent|nested_session|launch_required>
verification_gate: <routine|elevated|high|not-applicable>
evaluation_child_invocations: <integer>
evaluation_human_interruptions: <integer>
```

Copy the first line with its `format:` key and colon; a bare
`darrow-native-goal-report-v1` heading is not the report format. For a delegated
owner, attribute changed-file and verification evidence to the collected
terminal result. Do not claim that the parent inspected, reran, rechecked, or
independently verified repository work after the owner returned.

Do not reproduce the tab-separated v4 record in the final response. Never copy
the selected route into `harness`, `model`, or `effort` without effective-route
evidence. `harness` is the effective route harness (`codex` or `claude`), never
the `route_applied_by` value or `launch_boundary`. Count only sessions or subagents
created directly by Darrow: same-thread and host-API launches are zero; a
native goal runner or explicitly authorized nested session is one. Native
descendants remain host-visible but are not Darrow child invocations.
For a Claude native-subagent whose transcript route cannot be observed, report
`harness: claude`, `model: anthropic > unknown`, `effort: unknown`,
`route_verified: false`, and `launch_boundary: launch_required`. If
transcript evidence instead proves a mismatched route, record that observed
route. Failed verification never permits copying the selected model or effort
into the report. Route observability changes only those route facts; it does
not alter or invalidate the delegated owner's collected implementation,
verification, or independent-review result. Do not rerun or qualify that
result because route verification is unavailable. Keep any route caveat on a
separate line.
When an invoked capability terminates the goal with its own structured result,
preserve that result alongside the mandatory human-readable report rather than
replacing either contract.
Preserve terminal independent review evidence in the enclosing response by
using the standalone canonical outcome sentences from Section 3 and reporting
any blocking findings separately; do not require or reproduce the provider's
serialization. After a repaired failure, report the prior blocking findings
and the canonical fix-verification outcome against the changed content. Only a
clear initial review or clear exact-target verification chain satisfies the
gate; a prose claim by the author, stale evidence, or same-context self-review
does not. When the host persists native-goal status, a terminal review stop
also reports that the goal settled as `blocked`.

Before returning, render the applicable review outcome once. If the collected
initial review is clear, include exactly `Independent review: clear.` on its
own line even when route verification is unavailable. If it is blocking and no
repair occurs, include `Independent review: blocking — <finding>`. If repair
occurred, use the applicable canonical lines from Section 3 instead. Put
provenance, route caveats, and supporting detail on different lines so they
cannot qualify the outcome.

From the collected owner's terminal result, state changed files, final
verification, remaining risks, and every authorized publication effect
actually performed. If that result omitted a fact, report the omission instead
of inspecting the repository. Include this exact sentence: `Goal completion
grants no new or subsequent authority.` It does not itself authorize a commit,
push, pull request, merge, release, or deploy.
