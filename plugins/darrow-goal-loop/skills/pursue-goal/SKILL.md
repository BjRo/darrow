---
name: pursue-goal
description: Compile one bounded engineering request and activate it as a host-native goal with a proportionate workflow, risk gate, model, and effort. Use only when explicitly invoked; activation can consume meaningful model budget and edit the working tree.
disable-model-invocation: true
---

# Pursue a native goal

Compile the request, activate one native goal, and let the host own the loop.

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

Select exactly one workflow, then read its Markdown document completely:

- [`fix-bug`](references/workflows/fix-bug.md)
- [`implement-feature`](references/workflows/implement-feature.md)
- [`change-feature`](references/workflows/change-feature.md)
- [`refactor`](references/workflows/refactor.md)
- [`migration`](references/workflows/migration.md)
- [`mechanical`](references/workflows/mechanical.md)
- [`decision-gated`](references/workflows/decision-gated.md)

The workflow document determines the execution sequence. Do not combine
workflows or substitute a domain label for one. Small size alone is not
mechanical.

Select one proportional risk gate:

| Risk | Required verification |
| --- | --- |
| `routine` | focused acceptance or characterization evidence plus the scoped repository gate |
| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample |
| `high` | elevated gates plus an adversarial boundary or state-transition check and broader final-tree review |

Choose the semantic profile from the combined evidence:

- `fast` only for `mechanical` + `routine` with a complete oracle;
- `standard` for ordinary bounded work;
- `deep` for `high` risk, migrations, security-sensitive or cross-boundary
  work, or material ambiguity that is nevertheless approved.

An explicit user model or effort wins. Resolve the concrete route:

```sh
bash "$goal_loop" route --host <codex|claude> --profile <fast|standard|deep> \
  [--route 'harness|provider|model|effort']
```

Pass `--route` only when the engineering request explicitly pins it. The
classifier route, host defaults, and enclosing evaluator are metadata, not user
overrides. `inherit`, `current`, `default`, or an unresolved alias is not an
auditable model identifier.

Write one goal contract of at most 4,000 bytes containing the outcome,
acceptance criteria, scope and non-goals, preserved work, permissions, the
selected workflow and its sequence, risk gate, profile and concrete route,
applicable final-tree checks, and this exact final record:

```text
format\tdarrow-native-goal-preflight-v4
workflow\t<workflow>
risk\t<routine|elevated|high>
profile\t<fast|standard|deep>
selected_route\t<harness>\t<provider>\t<model>\t<effort>
effective_route\t<harness>\t<provider>\t<model>\t<effort>
route_applied_by\t<current-thread|host-api|nested-session|none>
route_verified\t<true|false>
launch_boundary\t<same_thread|host_api|nested_session|launch_required>
verification_gate\t<routine|elevated|high|not-applicable>
evaluation_child_invocations\t<integer>
evaluation_human_interruptions\t<integer>
```

Reference repository facts by path rather than copying them. Leave detailed
implementation choices to native goal mode.

## 3. Activate exactly one native goal

When an enclosing host API requests a preflight handoff, do not edit product
files, call `create_goal`, or launch a nested session in the classifier turn.
Return exactly one object and stop that turn:

```json
{
  "format": "darrow-native-goal-handoff-v3",
  "workflow": "<workflow>",
  "risk": "<routine|elevated|high>",
  "profile": "<fast|standard|deep>",
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
matches the selected route. Otherwise use a supported host API, then at most
one supported nested compatibility session. If no boundary can apply the
route, report `launch_required` honestly and stop.

Activate exactly one goal. Darrow adds no planner, verifier, repair agent,
retry loop, or cross-vendor route. Native goal mode owns implementation,
verification, recovery, persistence, and completion.

## 4. Return native completion

Continue until the native goal reaches a terminal state. The final response
must include the v4 launch record verbatim. Never copy the selected route into
`effective_route` without host evidence. Count only sessions or subagents
created by Darrow: same-thread and host-API launches are zero; a nested session
is one.

State changed files, final verification, remaining risks, and that completion
authorizes no commit, push, pull request, merge, release, or deploy.
