# Darrow Goal Loop

This plugin compiles a bounded engineering request into a host-native goal or
single native-agent goal runner. It
prepares deterministic repository evidence before writing, selects a goal
workflow, risk gate, and proportionate model and effort, loads the selected
workflow playbook, and activates the narrowest goal boundary the host supports.
The selected host-native owner handles implementation, verification, recovery,
and completion.

The plugin is directly invoked by the user or delegated one bounded request by
an orchestration entrypoint the user explicitly invoked. Ordinary engineering
intent never starts it. It is not a second orchestration loop, child-agent
supervisor, workflow runtime, or publication capability.

## What it provides

### `adaptive-goal` — Adaptive Goal Loop

Performs a read-only prepared preflight, compiles a concise completion contract,
selects one of the `routine`, `routine-plus`, `scaled`, `repo-wide`, or
`judgment` profiles plus one bundled task
workflow and risk gate, and activates exactly one native goal owner. Selection,
workflow loading, and route application are separate: completion succeeds only
when host or launcher evidence proves the selected workflow was supplied and
provider, model, and effort are identical.

For authoritative tickets, specifications, or plans that have not already been
assessed at the same scope, the contract can select an installed
implementation-readiness capability before mutation. A prior semantic
discussion counts as assessment, material scope changes may justify another
gate, and users may skip the default gate unless repository or delegating
orchestration policy requires it. The ledger records the selection and semantic
verdict; only `ready` unlocks implementation.

The goal owner returns its launch evidence as readable `key: value` lines. The
model field combines provider and model as `provider > model`, while effort is
reported separately.

A product decision known during preflight stops before launch. If one first
emerges during an active goal, mutation pauses while the current-thread owner
asks the user directly or a delegated owner relays the smallest question
through its parent. An available relay resumes the same owner with the explicit
answer; an unavailable relay preserves resumable state instead of guessing,
completing, or declaring the goal blocked.

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

Interactive activation uses a private `TMPDIR` step ledger and a separate
mode-0700 per-run staging directory. The helper
validates ordered preparation, catalog-backed route selection, objective
digests and releases, host-observed owner activation, independent-review
target history, readiness selection and verdict, closed review transitions and
limits, pre-activation launch stops, resumable blocker and continuation
transitions, and reporting. It persists and renders the canonical report,
review sentences, and outcome sentence from validated state. This ledger is
evidence protocol, not pipeline orchestration: it schedules no stages, assigns
no agent roles, and performs no retry or continuation on its own.

The portable helper is the sole protocol-evidence mechanism. The plugin does
not register Claude or Codex lifecycle hooks, so ordinary host turns run no
Darrow goal-loop code. Explicit adaptive-goal runs call the helper at their
documented transitions and reports use the fixed `enforcement: helper` value.
A rejected Claude route exits nonzero, while unavailable telemetry exits
successfully with explicit unverified evidence.

The compiled contract separates narrow feedback checks used after coherent
implementation slices from final-tree repository and risk gates. Workflows that
add acceptance or regression evidence run it before the corresponding behavior
change when a stable seam and independent oracle exist; repository-mandated
cadence always wins. Broad final-tree gates run after the tree appears complete,
not as routine implementation feedback.

The contract and the native goal objective are distinct at the host limit. A
complete contract at or below 4,000 bytes is submitted inline. A larger
contract is copied byte-for-byte to a private temporary attachment outside the
repository, hashed with SHA-256, and represented by a bounded objective that
requires the goal owner to read and verify it before work. Materialization
happens before the first goal-set call, so a size rejection never triggers
lossy recompaction or a second activation attempt. The attachment remains
available through active, paused, and blocked states. Completion, explicit
abandonment or supersession, and host-thread destruction release it through the
helper's validated cleanup operation; pre-activation rejection and
materialization failures release it without retrying activation. A failure
after an accepted goal creation retains it unless the launcher confirms one of
those lifecycle ends, and records the thread, attachment path, and digest
needed for later release. An unavailable or rejected goal-creation call can
instead record unavailable persistence and release the attachment before
`launch_required`.

A blocked owner retains the same objective and can consume one explicit answer,
qualified changed-conditions continue, authorized exact-operation retry, or
discretionary Darrow gate waiver. Ambiguous external publication is observed
before retry, unchanged deterministic evidence cannot be retried, and
repository policy, safety, authorization, and truthful completion are never
waivable. Each blocked snapshot lists only responses valid for its recorded
policies and can be rendered idempotently after a refused resume. The helper
records these transitions but has no timeout, scheduler, daemon, or automatic
retry.

The contract also selects independent code review proportionally: routine work
omits it by default, elevated work selects it when compatibility, caller, or
counterexample analysis needs independent judgment, high-risk work selects it
by default, and user or repository policy can require it at any risk. Selection
uses host-visible intent rather than a sibling plugin name, command, path, or
output format. A required but unavailable reviewer stops before product
mutation. Exact-target preparation starts an exclusive review boundary: the
goal owner finishes that capability invocation and awaits its ordinary response
before other repository work. One comprehensive review establishes the closed
finding set. Authorized first rework attempts all eligible findings together;
later invocations fix-verify only those attempts and direct repair-caused
regressions. Every verification receives the prior pinned scope, a mechanically
rendered repair delta, and the checksum-linked previous verification with its
carried regressions; descriptive caller prose cannot establish causality.
Convergence has no default numeric cap and continues only while blockers
materially progress. Advisories never gate. Clear exact-target verification
returns control; repetition, oscillation, no progress, unavailable evidence, or
an explicit user limit stops completion and publication.

Repository overrides live in a shared `.darrow/config.json` object with
independent `routes` and `reviewers` sections. The goal loop owns only
`routes`: an override replaces its matching `(host, profile)` route, while an
absent or empty `routes` section and omitted entries keep bundled policy. The helper
syntax-checks but otherwise ignores `reviewers`, so another installed plugin
can reuse the same file without creating a plugin dependency. A present config
must be readable and valid as a whole; owned routes must also be unique, safe,
catalog-known, and host/harness-consistent or the helper stops without falling
back. Prepared route rows identify `repository` or `bundled` policy provenance
separately from `policy` versus explicit-user route authority.

### `bin/claude-agent-route`

Resolves an exact Claude model/effort tuple to its bundled route-specific
plugin agent. It refuses unsupported tuples and conflicting
`CLAUDE_CODE_SUBAGENT_MODEL` or `CLAUDE_CODE_EFFORT_LEVEL` overrides before an
Agent call can start.

### `bin/claude-route-gate`

After the one foreground Claude runner returns, binds its host-reported Agent
id to transcript-derived model and effort evidence, then applies the existing
route confirmation check. It emits one bounded record: either an observed route
with an explicit confirmation result or an unavailable observation. The
launcher invokes it as one standalone command so route attribution cannot be
assembled from unrelated child or compound-command evidence.

## Design boundaries

- Preflight does not edit product files or call a separate routing model.
- One host-native goal owner owns the full adaptive run.
- The selected workflow is loaded from its own Markdown playbook; risk adds
  proportional verification without adding another template dimension.
- A selected route is not effective until the current host, an accepted API
  turn, an accepted native-agent spawn, or a completed launcher record proves
  exact application.
- Darrow creates no planner, verifier, repair, or cross-vendor role.
- Darrow does not implement review judgment or fresh-context fan-out inside the
  goal loop; it interprets the selected environment capability's ordinary
  response semantically.
- A first-class Codex goal runner is visible in the host, is the sole work
  owner, persists the compiled contract as a native goal in that same thread,
  and may use Codex's own visible subagents for bounded
  work. Its exact canonical `/root/...` `task_name` is retained as the agent
  reference for activation, lifecycle controls, cleanup, and evaluation
  evidence. The child-thread goal state is persistence for that owner, not a
  second owner boundary. If it cannot be confirmed, no mutation begins and the
  run reports that native launch is still required. Each Codex agent creator
  collects its children's terminal results and, when the host exposes a close
  control, closes each child after its goal has been fulfilled. Missing close
  support does not disable this launch boundary.
- A first-class Claude runner is visible in the host, runs in the foreground,
  and receives the full contract and workflow; the selected plugin-agent
  definition pins its concrete model and effort together.
- A nested process is disclosed and used only when a user explicitly authorizes
  the compatibility boundary and an enclosing launcher can prove its
  authentication.
- Goal completion authorizes no branch, commit, push, pull request, merge,
  release, deployment, or unrelated external mutation.

## License

Business Source License 1.1 — see [LICENSE](LICENSE). Converts to MPL-2.0
two years after each release. Part of the
[Darrow](https://github.com/BjRo/darrow) marketplace.
