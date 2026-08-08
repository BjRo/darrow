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
record with `launch_required`, zero children, and one human interruption, then
stop.

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

The final route record names the effective model identifier and effort.
`inherit`, `current`, `default`, or an alias for an unknown route is not an
auditable model value; resolve inheritance from host metadata before launch.

Write one goal contract of at most 4,000 bytes containing:

1. the outcome and observable acceptance criteria;
2. scope, non-goals, preserved local work, and permission boundaries;
3. applicable verification commands and final-tree evidence required;
4. template, profile, selected route, and any stopping budget;
5. the exact final launch record below.

```text
format\tdarrow-native-goal-preflight-v1
template\t<template>
profile\t<profile>
route\t<harness>\t<provider>\t<model>\t<effort>
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

Use the actual host, then read exactly one branch completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

Prefer a same-thread native goal whose effective model and effort exactly match
the selected route. Use a
supported same-thread host API next. Use one nested host session only when an
enclosing launcher owns it or the host proves recursion and authentication are
supported. If no boundary is available, emit `launch_required` with the exact
missing capability and stop.

Activate exactly one goal. Darrow adds no planner, verifier, repair agent,
retry loop, telemetry session, or cross-vendor route. Native goal mode owns
implementation, verification, recovery, persistence, and completion.

**Complete when:** the contract is active in one native goal with an honest
launch boundary, or one exact launch capability is known to be missing.

## 4. Return native completion

For a same-thread goal, continue under the active goal until its native terminal
state. For a nested compatibility session, wait for that one session and return
its result. Do not wrap completion in another review or repair phase.

The final response must include the launch record verbatim. Count only sessions
or subagents created by Darrow: `same_thread` and `host_api` are zero;
`nested_session` is one. Count a human interruption only for an actual stop
requiring a person's decision or authority.

State changed files, final verification evidence, remaining risks, and that
completion authorizes no commit, push, pull request, merge, release, or deploy.

**Complete when:** the native terminal result and launch record agree with the
final tree, route, boundary, child count, human interruptions, and publication
authority.
