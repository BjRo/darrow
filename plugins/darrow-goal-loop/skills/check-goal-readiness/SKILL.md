---
name: check-goal-readiness
description: Check which Darrow goal-loop paths, semantic model routes, foreign harness adapters, and OpenTelemetry export options are ready without editing configuration or spending model budget. Invoke only when the user explicitly names or selects check-goal-readiness; never trigger it implicitly.
disable-model-invocation: true
---

# Check goal readiness

Perform a read-only, secret-safe goal-loop readiness check. Do not invoke a model,
install a harness, authenticate a provider, or change repository or user-global
configuration unless the user separately requests that action.

Locate the bundled CLI relative to this file:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" readiness --host <codex|claude> --telemetry-mode best_effort
```

Use the actual host surface. Add `--network` only when the user asks for a
reachability check; it sends a content-free authenticated OTLP request and
never performs a paid model probe or prints credentials. Use
`--telemetry-mode strict` when diagnosing a requested strict run.

Combine the deterministic output with capabilities visible in the current
host. In particular, report whether the host exposes fresh native child agents
and whether provider, model, and effort can be pinned or deliberately inherited
for planner, executor, verifier, and repair. Do not infer native support from a
same-named CLI executable.

Report:

- the host harness and native fresh-child support;
- every semantic role/profile mapping, actual provider/model/effort, and
  declared fallback;
- each foreign adapter as ready or the specific route it disables;
- telemetry mode, configuration presence, exporter availability, and optional
  reachability without displaying endpoint credentials or header values;
- supported same-harness paths, degraded paths, and exact remediation for each
  failed precondition.

An optional missing integration does not fail the whole plugin. For example,
a missing foreign planner leaves a same-harness run available. If a
user-pinned route is unavailable, say that the requested route will stop
rather than silently fall back. End with the smallest setup action needed, or
state that no remediation is required.
