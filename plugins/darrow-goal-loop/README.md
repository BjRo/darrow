# Darrow Goal Loop

This plugin compiles a bounded engineering request into a host-native goal or
single native-agent goal runner. It
prepares deterministic repository evidence before writing, selects a goal
workflow, risk gate, and proportionate model and effort, loads the selected
workflow playbook, and activates the narrowest goal boundary the host supports.
The selected host-native owner handles implementation, verification, recovery,
and completion.

The plugin is explicitly invoked. It is not a second orchestration loop, child
agent supervisor, workflow runtime, or publication capability.

## What it provides

### `adaptive-goal` — Adaptive Goal Loop

Performs a read-only prepared preflight, compiles a concise completion contract,
selects one of the `routine`, `routine-plus`, `scaled`, `repo-wide`, or
`judgment` profiles plus one bundled task
workflow and risk gate, and activates exactly one native goal owner. Selection,
workflow loading, and route application are separate: completion succeeds only
when host or launcher evidence proves the selected workflow was supplied and
provider, model, and effort are identical.

Launch boundaries are ordered by cost and fidelity:

1. current-thread native goal tool;
2. supported same-thread host API;
3. one first-class, host-visible Codex goal runner with the selected model and
   effort;
4. one foreground, host-visible Claude Agent runner with the selected model and
   effort;
5. one explicitly authorized nested host session from a supported enclosing
   launcher;
6. an honest `launch_required` stop.

Claude's Agent tool does not expose the session-scoped `/goal` API or accept a
full model ID per invocation. The Claude runner therefore owns the compiled
contract as its one foreground delegated task; it does not claim `/goal`
evaluator turns or persistence. Route-specific plugin agents pin both model and
effort for every bundled Claude route. Other repository or user route tuples
stop unless a supported same-thread or enclosing boundary can apply them.

Example: _“Use adaptive-goal to diagnose and fix the intermittent cache test.”_

### `bin/goal-loop`

A small portable Bash helper prepares repository state, instruction routes,
semantic profiles from bundled `config/routes.json` with optional active-worktree
overrides in `.darrow/config.json`, workflow playbooks from
`skills/adaptive-goal/references/workflows/`, plus canonical risk selection and
verification guidance from the parent skill; rejects selected/effective route
mismatches; and provides an injection-safe nested compatibility launcher. It
requires explicit `--allow-nested` authorization and does not implement or
supervise the goal.

Repository overrides use the same strict `{"routes":[...]}` object schema as
the bundled file. An override replaces only its matching `(host, profile)`
route; omitted routes keep bundled policy. A present override must be readable,
valid, unique, safe, catalog-known, and host/harness-consistent or the helper
stops without falling back. Prepared route rows identify `repository` or
`bundled` policy provenance separately from `policy` versus explicit-user route
authority.

### `bin/claude-agent-route`

Resolves an exact Claude model/effort tuple to its bundled route-specific
plugin agent. It refuses unsupported tuples and conflicting
`CLAUDE_CODE_SUBAGENT_MODEL` or `CLAUDE_CODE_EFFORT_LEVEL` overrides before an
Agent call can start.

## Design boundaries

- Preflight does not edit product files or call a separate routing model.
- One host-native goal owner owns the full adaptive run.
- The selected workflow is loaded from its own Markdown playbook; risk adds
  proportional verification without adding another template dimension.
- A selected route is not effective until the current host, an accepted API
  turn, an accepted native-agent spawn, or a completed launcher record proves
  exact application.
- Darrow creates no planner, verifier, repair, or cross-vendor role.
- A first-class Codex goal runner is visible in the host, owns the one native
  goal, and may use Codex's own visible subagents for bounded work. Each Codex
  agent creator closes its children after collecting their results, and the
  parent closes the goal runner before returning.
- A first-class Claude runner is visible in the host, runs in the foreground,
  and receives the full contract and workflow; the selected plugin-agent
  definition pins its concrete model and effort together.
- A nested process is disclosed and used only when a user explicitly authorizes
  the compatibility boundary and an enclosing launcher can prove its
  authentication.
- Goal completion authorizes no branch, commit, push, pull request, merge,
  release, deployment, or unrelated external mutation.
