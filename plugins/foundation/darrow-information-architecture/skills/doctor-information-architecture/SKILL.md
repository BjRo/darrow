---
name: doctor-information-architecture
description: Audit repository agent guidance and repair diagnosed problems across entrypoints, scoped rules, and skills. Use for explicit doctor requests, instruction audits, trimming, deduplication, stale-route repair, or reachability checks. Requests to create, set up, or reorganize the guidance graph belong to setup unless the user explicitly asks for doctoring.
---

# Doctor agent guidance

Return a smaller, correctly routed instruction graph without deleting behavioral
knowledge or turning repository patterns into policy. Begin read-only.

Run structural operations through the frozen UV package at
`<skill-dir>/../../backend`, where `<skill-dir>` contains this file. Requires
UV and Python 3.10–3.13 on Linux, macOS, or native Windows. Its findings
establish structure, not edit decisions.

## Working model

- **Resident:** universal constraints, bootstrap safety, unusual universal
  completion gates, cross-project contracts, and routes needed before deferred
  guidance can load.
- **Scoped:** path- or intent-specific behavior at the narrowest reliably
  reachable scope.
- **Procedural:** a repeatable ordered task that can load by intent as a skill.
- **Derived:** a reliable, cheap fact recoverable from a canonical source in a
  few reads; it normally does not consume resident context.
- **Settled:** a choice backed by the user, an accepted decision, policy, or an
  existing canonical instruction. **Open:** competing live patterns with no
  such arbiter.

## Workflow

### 1. Inventory structure

Use both runtimes unless the user explicitly selected one:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" ia-doctor inspect --runtime both [repository]
```

Pass `--mirror source=target` only for adapter relationships declared by
repository evidence. Record each selected runtime's root bytes and approximate
tokens before any edit. Read every reported entrypoint, then only the routed
guidance and canonical evidence needed to adjudicate a specific finding. An
unreadable instruction, relevant configuration, skill, or declared adapter
source blocks conclusions that depend on it.

Do not scan transcripts, global settings, or the whole codebase. Missing usage
is never deletion evidence: short windows, failed routing, evals, and rare
safety paths make it incomplete.

**Complete when:** selected runtimes, entrypoints, declared adapters, metrics,
routes, and structural findings are known, and each judgment has the smallest
necessary evidence set.

### 2. Classify findings

Assign each candidate exactly one action:

| Action | Positive test |
| --- | --- |
| `keep` | Preserve behavior-changing constraints, prohibitions, safety rules, exact unusual commands or completion gates, non-obvious rationale, cross-project contracts, bootstrap guidance, and efficient route indexes at their valid scope. |
| `move` | Place narrow guidance at a narrower reachable scope, or move an ordered procedure to a discoverable skill without losing any invariant or gate. |
| `rewrite` | Repair an ambiguous/broken route, duplicated summary, stale path, or mixed statement by retaining its non-derivable constraint and removing only its derived fragment. |
| `remove` | Delete only a fact that is reliable and cheap to recover from a named canonical source; never rephrase a derived inventory as an imperative merely to keep it. |

Treat a repeatable ordered workflow in resident guidance as procedural even
when the structural graph passes verification. When safe reorganization is
approved and a reachable skill destination exists, classify it as `move`; do
not call the resident procedure minimal merely because its routes are valid.
Keep only its universal safety invariant and the intent route resident.

Optimize total retrieval cost, not root line count. A routed rare safety rule
usually stays deferred; promoting it to root increases every task's cost.
Preserve the spelling of an unusual command; incidental executable bits or a
locally convenient wrapper do not authorize rewriting its contract.
For a mixed statement such as `Runtime: Bun; never use npm because it rewrites
the lockfile`, remove the derived runtime fragment and retain exactly `Never use
npm because it rewrites the lockfile`; do not invent `Use Bun` or another
positive stack rule. Report a tool permission/implementation mismatch
separately—do not edit the tool during an instruction audit.

Apply runtime semantics independently:

- Codex chooses its `AGENTS.md` chain at session start; later entry into a
  subtree does not make a nested file load on demand, so required nested
  guidance needs a root route.
- Claude nested memory and path-scoped rules load natively when their scope
  applies; do not invent a root route for valid Claude-only guidance.
- A mention is not a route unless it states when to read the target. Ordinary
  routes resolve from the session root. Preserve native loader imports and
  skill-relative resource paths under their own semantics.
- Treat symlinks and declared generated mirrors as adapters. Edit their source
  of truth, not the generated target.
- Move a procedure only to a repository-owned, non-ignored,
  version-control-eligible `SKILL.md` with valid discovery metadata and runtime
  reachability. Preserve an explicit intent route when native discovery is not
  sufficient for every selected runtime.
  Such a route names the exact session-root-relative `SKILL.md` path and says
  when to read it. A skill-name mention alone is insufficient. Confirm that
  the route appears in the inspector's `routes` records; a passing structural
  status alone does not prove that a newly moved procedure is reachable.

For every rule that chooses among live implementation patterns, identify the
arbiter. Counts, recency, directory names, apparent completeness, and your
recommendation prove neither settled status nor abandonment. Preserve a
settled choice. For an open choice, use the full repository identifier on each
line and keep its trade-offs in that same sentence: `<option A> — benefit:
<specific benefit>, but cost/risk: <specific cost>`; `<option B> — benefit:
<specific benefit>, but cost/risk: <specific cost>`. Follow with
`Recommendation: <one full option> because <positive fit reason>` and `Which
option should <work> use?` Do not write policy or apply unrelated cleanup first
when the outcome depends on it.

**Complete when:** every finding has an evidenced action and scope, every move
has a reachable destination, and every policy choice is either settled by a
named arbiter or explicitly open.

### 3. Propose and establish authority

Present a compact file-level proposal before mutation. Name every file and
`keep|move|rewrite|remove` action, explain each removal's canonical source and
each move's reachability, and estimate the resident-byte effect for each
selected runtime.

Interpret authorization precisely:

- A request to inspect, audit, recommend, or show the proposal before changes
  is read-only. End with an explicit question such as “Please confirm this
  proposal before I apply it,” then stop.
- An explicit request to apply safe fixes or reorganization confirms
  decision-free actions fitting that description after you state the proposal.
- Broad cleanup approval never selects an option for an open decision. Ask for
  that choice and stop before checked-in mutation when it affects the outcome.

**Complete when:** the user has seen the exact proposal and every action has
applicable confirmation; otherwise the repository remains unchanged and the
response asks one compact grouped question.

### 4. Apply and verify

For approved guidance-file replacements, read
[`../../references/file-updates.md`](../../references/file-updates.md) and use
the bundled atomic writer. Keep existing adapter direction and newline style.

Apply only confirmed actions. Preserve each settled decision, behavioral
constraint, gate, scope, and route. Use the repository's declared sync
mechanism after editing a source of truth. Do not commit or push.

Verify the same runtimes and declared mirrors used for inspection:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" ia-doctor verify --runtime both \
  [--mirror source=target]... [repository]
```

Report remaining findings and separate before/after root bytes and approximate
tokens for every selected runtime. Use two explicit lines per runtime: `Codex
bytes: before N bytes; after N bytes` and `Codex tokens: before N ~tokens; after
N ~tokens` (and the same two lines for Claude). Repeat unchanged values rather
than abbreviating them as “unchanged.” Describe them as compact structural
metrics, not an exact simulation of runtime context assembly.

**Complete when:** verification passes or remaining critical findings are
explicit; metrics are reconciled; and no unconfirmed action, commit, or push
occurred.

## Boundaries

- Keep runtime installation, versions, permissions, auto-mode settings, global
  memory, MCP servers, and installed plugins outside this repository audit.
- Keep general code/doc cleanup and full TOML, YAML, Markdown, or runtime-loader
  conformance outside this structural capability.
