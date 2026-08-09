---
name: adaptive-goal
description: Compile one bounded engineering request and activate it as a host-native goal with a proportionate workflow, risk gate, model, and effort. Use only when explicitly invoked; activation can consume meaningful model budget and edit the working tree.
disable-model-invocation: true
---

# Adaptive Goal Loop

Compile the request, activate one host-native goal owner, and let the host own
the loop.

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

Classify reasoning demand independently from workflow and risk:

- `ordinary-localized`: the implementation is clear and localized;
- `scaled-coding`: straightforward work spans several files or components;
- `repo-wide-coding`: straightforward work requires repository-wide changes;
- `judgment`: the cause is unknown across multiple plausible layers or state
  transitions, or the task requires architecture, planning, or review
  judgment.

Implementation size, reversibility, and consequence risk do not reduce a
`judgment` task to ordinary coding.

Apply the selected proportional risk gate:

| Risk | Required verification |
| --- | --- |
| `routine` | focused acceptance or characterization evidence plus the scoped repository gate |
| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample |
| `high` | elevated gates plus an adversarial boundary or state-transition check and broader final-tree review |
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

The helper resolves policy from the active worktree root: when
`<repo>/.darrow/config.json` is absent, routes come from bundled policy;
otherwise its strict `{"routes":[...]}` entries replace matching bundled
`(host, profile)` entries and other profiles inherit bundled routes. A present
repository configuration must validate completely against the bundled
host/profile catalog and host/harness relation; any unreadable or invalid file
is a stop, not a fallback. `route_source` remains `policy` or `user` authority;
for policy routes, `policy_route_source` discloses `repository` or `bundled`
provenance.

Write one goal contract of at most 4,000 bytes containing the outcome,
acceptance criteria, scope and non-goals, preserved work, permissions, the
selected workflow and its sequence, risk gate, profile and concrete route,
applicable final-tree checks, any user-specified stopping budget, and this exact
final record:

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
  "selectedRoute": {
    "harness": "<harness>",
    "provider": "<provider>",
    "model": "<concrete-model>",
    "effort": "<concrete-effort>"
  },
  "goalContract": "<compiled contract, at most 4,000 bytes>"
}
```

The enclosing launcher validates the selected route against the live host
catalog and policy profile, loads the exact selected workflow document, sets
the native goal, and starts the execution turn with that document plus the
selected model and effort. Its accepted turn request is route-application
evidence; a workflow identifier, path, and content hash on the same receiving
turn is workflow-loading evidence. The handoff alone proves neither.

For an interactive invocation, read exactly one host launch guide completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

Prefer the current thread only when host metadata proves its effective route
matches the selected route. Otherwise use a supported host API, then on Codex
use exactly one first-class native goal runner only when `spawn_agent` can apply
the selected model and effort and `close_agent` can close that runner after its
result is collected. A spawn-only surface is unavailable. A nested
compatibility process requires explicit user authorization and an enclosing
launcher; never select it automatically from an interactive skill. If no
boundary can apply the route and clean up its runner, report `launch_required`
honestly and stop.

Activate exactly one goal owner. Darrow adds no planner, verifier, repair agent,
retry loop, or cross-vendor route. The native goal or allowed Claude Agent
runner owns implementation, verification, recovery, and completion.

## 4. Return host-native completion

Continue until the selected goal owner reaches a terminal state. A native goal
runner may use host-native subagents for bounded work; it remains the sole goal
owner, and Darrow does not prescribe planner, executor, verifier, or repair
roles.
On Codex, every agent creator must collect the child's terminal result and
explicitly close that child as soon as no follow-up is needed. The goal runner
closes its descendants; the parent that launched `adaptive_goal_runner` closes
that runner before returning. If an active child becomes unnecessary, stop or
interrupt it, wait for a terminal state, then close it. A missing or failed
close is incomplete cleanup, not successful completion.
The final response must include the v4 launch record verbatim. Never copy the
selected route into
`effective_route` without host evidence. Count only sessions or subagents
created directly by Darrow: same-thread and host-API launches are zero; a
native goal runner or explicitly authorized nested session is one. Native
descendants remain host-visible but are not Darrow child invocations.

State changed files, final verification, remaining risks, and that completion
authorizes no commit, push, pull request, merge, release, or deploy.
