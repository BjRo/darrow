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
format\tdarrow-adaptive-goal-authority-stop-v1
status\tinvocation_required
reason\texplicit-orchestration-entrypoint-required
```

### Claude activation is mandatory

On Claude, this entire preflight and launch sequence is mandatory even for a
small or obvious task. Before any product write, run `prepare --host claude`,
select the dimensions, run `route --host claude`, read `claude-launch.md`, and
activate the first boundary that can apply that exact helper-selected route.
Do not implement directly in the classifier turn, replace the selected harness
with a boundary label such as `current-thread`, or report same-thread activation
without route-confirmation evidence. If any required step cannot run, stop as
`launch_required`; skipping the sequence is a failed skill execution.

## 1. Prepare without writing

Resolve the repository and bundled helper to absolute paths, then run:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" prepare --repo "$repo" --host <codex|claude>
```

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
format\tdarrow-native-goal-preflight-v4
workflow\tdecision-gated
risk\thigh
profile\tnone
selected_route\tnone\tnone\tnone\tnone
effective_route\tnone\tnone\tnone\tnone
route_applied_by\tnone
route_verified\tfalse
launch_boundary\tlaunch_required
verification_gate\tnot-applicable
evaluation_child_invocations\t0
evaluation_human_interruptions\t1
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
  deterministic transformation with a complete oracle.
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
5. Choose `mechanical` over `refactor` only for an exact transformation with a
   complete oracle; restructuring that requires judgment is `refactor`.
6. `refactor` is valid only when observable behavior remains unchanged.

Select risk from consequences, taking the highest applicable level:

- `routine`: localized, reversible, and limited blast radius;
- `elevated`: compatibility concerns, multiple consumers, persisted formats,
  or meaningful operational impact;
- `high`: security or authorization boundaries, destructive or irreversible
  state, privacy or safety, or broad blast radius.

Reasoning difficulty never changes risk. A difficult diagnosis can be
`routine`; a simple security change is `high`.

Select independent code review separately from implementation discipline:

| Situation | Independent review selection |
| --- | --- |
| `routine` risk | do not select automatically |
| `elevated` risk | select when compatibility, caller impact, or counterexample analysis needs independent judgment |
| `high` risk | select by default |
| any risk | select when repository policy or the user requires it |

When review is selected, the goal contract requests an available environment
capability matching this intent: independently review the exact current code
change. Do not name or assume a plugin implementation, command, or output
format. Before repository mutation, confirm that the environment exposes a
capability matching that intent. An ad hoc prompt, generic subagent,
same-context judgment, or capability created during the run is not availability
evidence. Stop honestly when no matching capability exists. A matching
capability may use fresh readers internally; native delegation alone cannot
satisfy this gate. An availability stop returns the evidence gap together with
the mandatory v4 launch record.
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
Target preparation starts the review boundary. Finish only that capability
invocation and await its ordinary response before any other repository work;
do no repository work outside the capability invocation while it is pending.
Interpret the capability's ordinary response semantically. No blocking
findings in the initial comprehensive review satisfy the gate for that exact
content without adding authority. Otherwise that one comprehensive review
establishes the closed finding set for all rework and verification.

First rework attempts every eligible finding together. Eligibility requires
existing repair authority, clear originating scope, low risk, no expansion of
requested behavior, and no material expansion of verification. Attempt every
eligible blocker and advisory. Record an ineligible blocker as blocked; retain
an ineligible advisory only as a non-gating residual risk.

After each rework, rerun invalidated checks and ask the same matching capability
to fix-verify only the attempted original findings and direct repair-caused
regressions. Supply the original findings and target, canonical finding order,
prior and current targets, prior target history, the prior scope manifest, the
immediately prior verification artifact with its checksum and carried
regressions when one exists, and current check evidence. The review capability
pins the prior-to-current repair delta mechanically against the prior scope's
same effective base; caller prose does not establish causality. Targeted verification cannot introduce an unrelated finding. It
reports `clear`, `continue`, `no_progress`, or `blocked`.

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

There is no default numeric review limit. If the originating request explicitly
supplies one, preserve it as a hard cap on all capability invocations including
the initial comprehensive review; reaching it stops even otherwise-progressing
convergence. It grants no authority and never permits completion without clear
exact-target evidence. Any later content-changing edit invalidates the chain.

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

- `routine` for `ordinary-localized`, including exact mechanical work and clear
  high-risk changes;
- `routine-plus` only when ordinary localized work specifically warrants its
  additional quality;
- `scaled` for `scaled-coding`;
- `repo-wide` for `repo-wide-coding`;
- `judgment` for `judgment` work.

An explicit user model or effort wins. Resolve the concrete route:

```sh
bash "$goal_loop" route --repo "$repo" --host <codex|claude> \
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
an explicit review-round limit, and this exact final record. Target
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
selected model and effort, without requiring a close control. A nested
compatibility process requires explicit user authorization and an enclosing
launcher; never select it automatically from an interactive skill. If no
boundary can apply the route, report `launch_required` honestly and stop.

Activate exactly one goal owner. Darrow adds no planner, verifier, repair agent,
retry loop, or cross-vendor route. The native goal or allowed Claude Agent
runner owns implementation, verification, recovery, and completion.

## 4. Return host-native completion

Continue until the selected goal owner reaches a terminal state. A native goal
runner may use host-native subagents for bounded work; it remains the sole goal
owner, and Darrow does not prescribe planner, executor, verifier, or repair
roles.
On Codex, every agent creator collects the child's terminal result. When the
host exposes a close control, close the subagent after its goal has been
fulfilled and its terminal result has been collected. The goal runner applies
the same guidance to descendants it creates. If an active child becomes
unnecessary, stop or interrupt it when the host exposes that control. Absence
or failure of a close control does not block launch or invalidate an otherwise
fulfilled goal; report any residual cleanup state without replacing the goal's
terminal result.
The final response must include the v4 launch record verbatim. Never copy the
selected route into
`effective_route` without host evidence. Count only sessions or subagents
created directly by Darrow: same-thread and host-API launches are zero; a
native goal runner or explicitly authorized nested session is one. Native
descendants remain host-visible but are not Darrow child invocations.
For a Claude native-subagent whose transcript route cannot be observed, record
`effective_route<TAB>claude<TAB>anthropic<TAB>unknown<TAB>unknown`,
`route_verified<TAB>false`, and `launch_boundary<TAB>launch_required`. If
transcript evidence instead proves a mismatched route, record that observed
tuple. Failed verification never permits copying the selected tuple into the
effective row.
When an invoked capability terminates the goal with its own structured result,
preserve that result alongside the mandatory v4 record rather than replacing
either contract.
Preserve the substance of terminal independent review evidence by reporting its
outcome and any blocking findings in the enclosing response; do not require or
reproduce the provider's serialization. After a repaired failure, report the
prior blocking findings and the fix-verification outcome against the changed
content. Only a clear initial review or clear exact-target verification chain
satisfies the gate; a prose claim by the author, stale evidence, or same-context
self-review does not. When the host persists native-goal status, a terminal
review stop also reports that the goal settled as `blocked`.

State changed files, final verification, remaining risks, and every authorized
publication effect actually performed. Include this exact sentence: `Goal
completion grants no new or subsequent authority.` It does not itself
authorize a commit, push, pull request, merge, release, or deploy.
