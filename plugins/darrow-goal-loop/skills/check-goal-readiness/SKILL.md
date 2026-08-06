---
name: check-goal-readiness
description: Report which adaptive goal-loop routes are ready, degraded, or blocked without model calls or setup changes. Use only when explicitly invoked by the user.
disable-model-invocation: true
---

# Check goal readiness

Describe usable goal-loop paths before any model budget is spent.

## Working model

- **Static evidence:** inspect executables, configuration presence, route
  declarations, and host capabilities. Never invoke a model for readiness.
- **Secret-safe status:** report whether credentials or exporter configuration
  exist, never their values.
- **Route-local degradation:** a missing optional adapter disables only the
  paths that require it. Preserve usable same-harness paths.
- **Host truth:** native child support and selection controls come from the
  current host surface, not from a same-named CLI executable.

## Workflow

### 1. Select the diagnostic

Resolve the bundled CLI relative to this file and use the actual host:

```sh
skill_dir=<absolute directory containing this SKILL.md>
goal_loop="$skill_dir/../../bin/goal-loop"
bash "$goal_loop" readiness --host <codex|claude> --telemetry-mode best_effort
```

Use `--telemetry-mode strict` only when diagnosing a user-requested strict run.
Add `--network` only when the user explicitly requests exporter reachability;
it performs a content-free authenticated OTLP request, not a model probe.

Keep the diagnostic read-only. Do not install a harness, authenticate a
provider, or edit repository or user-global configuration. A separately
requested live model probe is a different operation and is not part of this
readiness command.

**Complete when:** host, telemetry mode, and whether network reachability was
explicitly requested are fixed before the command runs.

### 2. Collect deterministic evidence

Run the selected command once. Treat its tab-separated records as facts about
declared profiles, installed adapters, execution boundaries, telemetry, and
supported or blocked paths. Preserve exact remediation text from degraded and
blocked records.

Do not print raw environment variables, endpoint credentials, or header
values. Do not mutate setup in response to a failed precondition.

**Complete when:** the output identifies the host; every planner, executor,
verifier, and repair profile; all adapters and boundaries; telemetry status;
and every emitted path status—or the exact diagnostic failure is known.

### 3. Reconcile host capabilities

Inspect capabilities exposed by the current host and answer separately:

- Can it create genuinely fresh native child agents?
- For planner, executor, verifier, and repair, can provider, model, and effort
  be pinned, or can each value be deliberately inherited?

Do not equate the presence of `codex` or `claude` on `PATH` with native child
support. For every semantic profile (`fast`, `standard`, `deep`), preserve the
CLI's role, harness, provider, model, effort, and declared fallback. Map an
unavailable foreign adapter to the exact cross-harness routes it disables.

**Complete when:** every `controller_must_confirm` item has an evidence-based
host answer, and no optional failure has been promoted to plugin-wide failure.

### 4. Report readiness

Report:

1. host harness and native fresh-child support;
2. each role/profile mapping with actual harness, provider, model, effort, and
   fallback;
3. each foreign adapter and execution boundary as ready or as the specific
   route it disables;
4. telemetry mode, configuration presence, exporter availability, and—only
   when requested—reachability, with credential values redacted;
5. same-harness and cross-harness paths grouped as supported, degraded, or
   blocked, with exact remediation for every failed precondition.

State that a user-pinned unavailable route will stop instead of silently
falling back. End with the smallest setup action that unlocks the requested
path, or `No remediation required` when every requested path is ready.

**Complete when:** each requested route has one unambiguous readiness state and
action, optional degradation is scoped, and no model call, secret disclosure,
or setup mutation occurred.
