---
name: pursue-goal
description: Compile one bounded engineering request and activate it as a host-native goal with a proportionate model and effort. Use only when explicitly invoked; activation can consume meaningful model budget and edit the working tree.
disable-model-invocation: true
---

# Pursue a native goal

Compile the request, activate one native goal, and let the host own the loop.

## 1. Ground the request

Resolve the repository and bundled helper to absolute paths, then run:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" preflight --repo "$repo"
```

Inspect only the evidence needed to launch safely: applicable instructions and
accepted decisions, pre-existing work, relevant manifests or CI, the requested
scope, and focused verification commands. Keep product files unchanged during
preflight. Treat recorded local changes as user-owned.

Turn the request into observable completion criteria without choosing missing
product behavior. If behavior, authority, or a safety policy is materially
missing, select `decision-gated`, report the smallest decision, emit the launch
record with both routes set to `none|none|none|none`, `route_applied_by\tnone`,
`route_verified\tfalse`, `launch_required`, zero children, and one human
interruption, then stop.

**Complete when:** the outcome, constraints, local work, and every applicable
or explicitly inapplicable verification gate are known—or one precise human
decision is known to be missing.

## 2. Compile the goal

Select exactly one template and profile:

| Evidence | Template | Profile |
| --- | --- | --- |
| Exact deterministic transformation with a complete oracle | `mechanical` | `fast` |
| Clear bounded behavior, code, configuration, test, or documentation change | `bounded-change` | `standard` |
| Reproducible defect or failing check | `diagnose-fix` | `standard` |
| Approved public-contract, schema, dependency, security-sensitive, or cross-boundary change | `migration` | `deep` |
| Missing product behavior, authority, or safety policy | `decision-gated` | no launch |

An explicit user template, model, or effort wins. Ordinary implementation is
`standard`; a small code diff is not mechanical. Resolve the concrete route:

```sh
bash "$goal_loop" route --host <codex|claude> --profile <fast|standard|deep> \
  [--route 'harness|provider|model|effort']
```

Pass `--route` only when the user's engineering request explicitly pins that
route. The active classifier route, host defaults, enclosing-evaluator route,
and inherited route are application metadata, not user overrides; never feed
them back into route selection.

The final route record names the effective model identifier and effort.
`inherit`, `current`, `default`, or an alias for an unknown route is not an
auditable model value; resolve inheritance from host metadata before launch.
The helper's `selected_route` is a request, not evidence that the route is
active.

Write one goal contract of at most 4,000 bytes containing:

1. the outcome and observable acceptance criteria;
2. scope, non-goals, preserved local work, and permission boundaries;
3. applicable verification commands and final-tree evidence required;
4. template, profile, selected route, and any stopping budget;
5. an instruction to activate this contract with `create_goal` before doing
   product work when a nested session receives it; omit that instruction from
   an enclosing host-API handoff because the launcher sets the goal itself;
6. the exact final launch record below.

```text
format\tdarrow-native-goal-preflight-v2
template\t<template>
profile\t<profile>
selected_route\t<harness>\t<provider>\t<model>\t<effort>
effective_route\t<harness>\t<provider>\t<model>\t<effort>
route_applied_by\t<current-thread|host-api|nested-session|none>
route_verified\t<true|false>
launch_boundary\t<same_thread|host_api|nested_session|launch_required>
evaluation_child_invocations\t<integer>
evaluation_human_interruptions\t<integer>
```

Reference repository facts already available in the thread or named files;
do not cache their contents in the contract. Describe what done means, leaving
the implementation sequence to native goal mode.

**Complete when:** one concise contract accounts for every criterion, gate,
boundary, selected route, and final record without inventing intent.

## 3. Activate the native goal

When an enclosing host API explicitly requests a preflight handoff, it owns
this section. Do not edit product files, call `create_goal`, or launch a nested
session in the preflight turn. Return exactly one object for the enclosing
launcher and end that turn:

```json
{
  "format": "darrow-native-goal-handoff-v1",
  "template": "<template>",
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

Use `routeSource: "user"` only for an explicit route pinned by the engineering
request; otherwise use `policy`. The enclosing launcher must validate the
concrete route against both the live host catalog and the named policy profile,
set the native goal, and start the execution turn with that exact model and
effort. Its accepted turn request is route-application evidence; the preflight
handoff is not. This handoff is neither `launch_required` nor the final v2
completion record.

Use the actual host, then read exactly one branch completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

Treat the active route as confirmation evidence only. Treat the selected route
as unapplied until the host boundary proves the effective provider, model, and
effort. Prefer a same-thread native goal only
when host metadata names that exact effective route and `confirm-route`
accepts it. Use a supported host API next; its accepted turn request must set
the selected model and effort. Use one nested host session when the current
thread cannot switch and the host proves recursion and authentication are
supported. A successful nested helper emits the effective route only after the
selected provider, model, and effort complete one session. If no boundary can
apply the route, emit `launch_required`, `route_applied_by\tnone`, and
`route_verified\tfalse`, then stop.

Run a nested launcher as one foreground tool call. If the host yields while it
is running, wait on that exact process or command session. Do not issue another
tool call, inspect its partial edits, delete the contract, or compose the final
response until the launch call itself completes with exit zero and emits its
route-application record.

Use literal absolute repository and goal-file paths in the launch call. Shell
variables, working directories, and environment assignments from an earlier
tool call are not persistent launch evidence.

Activate exactly one goal. Darrow adds no planner, verifier, repair agent,
retry loop, telemetry session, or cross-vendor route. Native goal mode owns
implementation, verification, recovery, persistence, and completion.

**Complete when:** the contract is active in one native goal and deterministic
or harness evidence proves selected route equals effective route, or one exact
launch capability is known to be missing.

## 4. Return native completion

For a same-thread goal, continue under the active goal until its native terminal
state. For a nested compatibility session, wait for that one foreground launch
call to finish and return its delimited result. Partial file changes, a child
final-message file, or process inspection are not terminal evidence. Do not wrap
completion in another review or repair phase.

The final response must include the v2 launch record verbatim. Never copy the
selected route into `effective_route` without route-application evidence. Count
only sessions
or subagents created by Darrow: `same_thread` and `host_api` are zero;
`nested_session` is one. Count a human interruption only for an actual stop
requiring a person's decision or authority.

State changed files, final verification evidence, remaining risks, and that
completion authorizes no commit, push, pull request, merge, release, or deploy.

**Complete when:** the native terminal result and launch record agree with the
final tree, route, boundary, child count, human interruptions, and publication
authority.
