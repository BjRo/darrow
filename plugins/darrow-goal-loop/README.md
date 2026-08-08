# Darrow Goal Loop

This plugin compiles a bounded engineering request into a host-native goal. It
inspects the task and repository before writing, selects a goal template plus a
proportionate model and effort, and activates the narrowest goal boundary the
host supports. Native goal mode owns implementation, persistence, verification,
recovery, and completion.

The plugin is explicitly invoked. It is not a second orchestration loop, child
agent supervisor, workflow runtime, or publication capability.

## What it provides

### `pursue-goal`

Performs a read-only preflight, compiles a concise completion contract, selects
one of the `fast`, `standard`, or `deep` profiles, and activates exactly one
native goal. Selection and application are separate: completion records both
the selected and effective routes, and succeeds only when host or launcher
evidence proves their provider, model, and effort are identical.

Launch boundaries are ordered by cost and fidelity:

1. current-thread native goal tool;
2. supported same-thread host API;
3. one disclosed nested host session from a supported enclosing launcher when
   in-place activation cannot honor the selected route;
4. an honest `launch_required` stop.

Example: _“Use pursue-goal to diagnose and fix the intermittent cache test.”_

### `check-goal-readiness`

Reports configured routes and distinguishes same-thread goal control,
same-thread model/effort override, host API availability, and nested-session
compatibility without making a model call or changing setup.

Example: _“Check native-goal readiness for Codex.”_

### `bin/goal-loop`

A small portable Bash helper records repository preflight evidence, resolves
semantic profiles from `config/routes.tsv`, rejects selected/effective route
mismatches, diagnoses launch boundaries, and provides an injection-safe nested
compatibility launcher that applies provider, model, and effort explicitly. It
does not implement or supervise the goal.

## Design boundaries

- Preflight does not edit product files or call a separate routing model.
- One native goal owns the full adaptive run.
- A selected route is not effective until the current host, an accepted API
  turn, or a completed launcher record proves exact application.
- Darrow creates no planner, verifier, repair, or cross-vendor role.
- A nested session is disclosed and used only when same-thread activation
  cannot honor an explicit route and an enclosing launcher can prove the
  session's authentication and boundary.
- Goal completion authorizes no branch, commit, push, pull request, merge,
  release, deployment, or unrelated external mutation.
