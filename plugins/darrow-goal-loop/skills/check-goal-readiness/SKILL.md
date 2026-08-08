---
name: check-goal-readiness
description: Report which native-goal preflight routes and launch boundaries are available without model calls or setup changes. Use only when explicitly invoked by the user.
disable-model-invocation: true
---

# Check native-goal readiness

Report whether this host can compile and activate each goal profile before any
paid goal begins.

## 1. Collect static evidence

Resolve the bundled helper relative to this file and run it for the actual host:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" readiness --host <codex|claude>
```

Keep the diagnostic read-only. Do not install tools, authenticate, modify
configuration, expose credential values, or launch a model.

**Complete when:** all bundled `routine`, `routine-plus`, `scaled`, `repo-wide`,
and `judgment` mappings plus the static host API and nested-session evidence
have been collected—or the exact configuration failure is known.

## 2. Reconcile current-host capabilities

Answer each `controller_must_confirm` item from capabilities exposed by the
current surface:

1. Can the current thread activate a native goal?
2. Does host metadata expose the current provider, model, and effort so an exact
   match can be confirmed?
3. Does an enclosing supported host API control the existing thread?
4. Is one nested host session available as a compatibility boundary?

A host executable proves only that the compatibility command is installed; it
does not prove credentials or recursion are available inside an active agent
session. For Codex, an installed app-server proves the API implementation
exists but not that this skill can control the enclosing thread. Preserve both
distinctions.

**Complete when:** every launch boundary has one evidence-backed state and no
CLI presence has been promoted into a same-thread capability claim.

## 3. Report route-local readiness

For each profile, report the mapped harness, provider, model, effort, declared
fallback, and the narrowest usable launch boundary. Mark a user-pinned
unavailable route as blocked; do not silently substitute it.

Do not call a profile ready on the current thread unless its mapped route
exactly matches the host-reported effective route. A goal tool without a route
override is insufficient evidence.

End with the smallest action that unlocks the requested route, or
`No remediation required` when it is ready. State explicitly that readiness
made no model call and changed no setup.

**Complete when:** every requested profile has an unambiguous ready, degraded,
or blocked state, an honest boundary, and exact remediation when needed.
