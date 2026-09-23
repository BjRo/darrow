---
name: setup-information-architecture
description: Create, set up, or reorganize a repository's agent-guidance graph, including repositories with existing instructions and adapters. Use for guidance reorganization, creating AGENTS.md or CLAUDE.md, splitting instructions, or building scoped routing for Claude Code and Codex. Do not select for requests only to audit, doctor, trim, or repair existing guidance.
---

# Set up agent guidance

Build a repository-specific instruction graph that keeps universal behavior
resident and makes every deferred rule reachable when it matters. Begin
read-only and preserve existing knowledge; never replace it with a generic
template.

Run structural inventory through the frozen UV package at
`<skill-dir>/../../backend`, where `<skill-dir>` contains this file. Requires
UV and Python 3.10–3.13 on Linux, macOS, or native Windows. The inspector
finds evidence; it does not decide placement or policy.

## Working model

- **Root:** universal constraints, bootstrap safety, unusual universal
  completion gates, cross-runtime contracts, and the smallest route index.
- **Scoped:** path- or edit-kind behavior at the narrowest reliably reachable
  scope.
- **Skill:** a repeatable ordered procedure that loads by task intent.
- **Derived:** a reliable, cheap fact already expressed by canonical
  configuration; it normally stays out of resident guidance.
- **Documentation:** explanatory material for humans, not agent behavior.
- **Settled:** a choice backed by the user, an accepted decision, policy, or
  existing canonical instruction. **Open:** competing live patterns with no
  such arbiter.

## Workflow

### 1. Inventory the repository

Run:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" ia-setup inspect [repository]
```

Use its compact inventory to locate instruction entrypoints, adapters,
manifests, hooks, CI, skills, decisions, architecture evidence, and likely
guidance directories. Read existing entrypoints completely, then inspect only
the canonical evidence needed to understand their rules and relationships. Do
not scan the entire repository. Unreadable required evidence blocks dependent
design choices.

When the request asks which implementation pattern new work should follow,
inspect representative implementations in that area and search for a prior
decision. The instruction inventory alone cannot answer this. Identify the
actual alternatives inside a shared directory; naming that parent directory
does not choose between them. If competing patterns have no arbiter, present
the open choice described below and stop before designing or changing files.

Target both Claude Code and Codex unless the user explicitly selects one.
Record any declared source-of-truth or generated/symlink adapter direction; it
overrides fresh-graph defaults. Read through an existing adapter and verify its
target before treating it as defective. Keep a working adapter in its existing
form; shared content reached through a symlink is not an independent duplicate.

**Complete when:** selected runtimes, existing guidance, repository-specific
constraints, canonical evidence, adapter direction, root budgets, and
unreadable blockers are known before graph design begins.

### 2. Classify and design

Assign each existing or proposed item one working-model category. Preserve
exact behavior-changing constraints, prohibitions, rationales, unusual
commands, and scopes. Do not broaden a database/frontend rule merely to simplify
placement or duplicate one shared invariant into several subtrees.
Infer scope from the rule's trigger, not merely the noun it mentions. A
repository-wide prohibition such as `Never run production migrations from a
coding-agent session` remains resident even though it mentions migrations. Do
not create scoped guidance or routes from a cheap directory inventory alone;
scope requires an evidenced behavior for that area.

Design routes as contracts, not mentions:

```text
Before changing <area>, read <session-root-relative-guidance-path>.
```

Every explicit route names both its trigger and target. Ordinary paths resolve
from the session root, including routes inside maps and nested entrypoints.
Rewrite containing-file-relative ordinary paths; preserve loader-native imports
and skill-relative resources under their own semantics. When fixing an
ordinary path defect, do not delete or rewrite a loader-native import merely
because its target appears empty, and do not relocate an existing skill bundle
merely because a neutral location seems preferable. A position-dependent path
defect alone authorizes rewriting that route in its existing file, not moving,
replacing, or deleting the guidance file. Preserve valid existing placement
unless separate scope/reachability evidence justifies relocation.

Apply runtime semantics independently:

- Codex chooses its `AGENTS.md` chain at session start; later entry into a
  subtree does not load nested guidance on demand, so root-anchored work needs
  an explicit route.
- Claude nested memory and native path-scoped rules load when their scope
  applies; do not invent root routes for valid Claude-only guidance.
- Keep enough routing resident to avoid opening every deferred file merely to
  discover which one applies. Keep active Codex root guidance below its project
  limit, or 32 KiB when no override exists.

For a new dual-runtime graph with no declared direction, make `AGENTS.md`
canonical and create a thin Claude adapter by symlink, native `@AGENTS.md`
import, explicit read route, or declared generated mirror. Existing evidence
that `CLAUDE.md` is canonical and `AGENTS.md` its adapter wins. For one-runtime
requests, create nothing for the unselected runtime. Put shared deferred
guidance in an existing neutral convention or a non-ignored location such as
`.agent-shared/` or `docs/agent-guidance/`, not a runtime-local mount unless the
guidance is intentionally native to that runtime.

Move an ordered procedure only to a repository-owned, non-ignored,
version-control-eligible `SKILL.md` with non-empty discovery metadata. Preserve
every ordered step and safety gate. Before extracting it, separate universal
prohibitions from workflow steps: the universal rules stay in the resident
root, while the ordered steps and their task-specific gates move to the skill.
A route to the skill does not replace a resident prohibition. Keep an explicit
intent route when native skill discovery is insufficient for any selected runtime.
That route names the exact session-root-relative `SKILL.md` path and says when
to read it. Confirm it appears in the inspector's `routes` records; a passing
structural status alone does not prove that a newly moved procedure is reachable.

Remove cheap manifest/config inventory rather than turning it into `use the
existing toolchain`. For a mixed statement such as `Runtime: Bun; never use npm
because it rewrites the lockfile`, retain exactly `Never use npm because it
rewrites the lockfile`; do not invent `Use Bun`. Omit manifest-derived stack
lists and directory tours such as `apps/api` / `apps/web` entirely when they
carry no separate behavior; do not preserve them as a “repository map.”

For every rule that selects among live patterns, identify the arbiter. Counts,
recency, directory names, apparent completeness, and recommendations are not
arbiters. Preserve settled choices. For an open choice, keep each full
repository option and its trade-offs in one sentence: `<option A> — benefit:
<specific benefit>, but cost/risk: <specific cost>`; repeat for option B. Then
write `Recommendation: <one full option> because <positive fit reason>` and
`Which option should <work> use?` Repeat each literal repository path in the
two option lines, recommendation, and question; shorthand labels such as `SQL`
or `ORM` are insufficient. Do not write policy or apply unrelated structural
cleanup first when the requested graph depends on the choice.

**Complete when:** every behavior has one correct owner and scope, every
deferred item has a valid route for each selected runtime, adapters have one
declared direction, and every policy choice is settled by evidence or explicit
as open.

### 3. Propose and establish authority

Present the file graph before mutation. Name each exact
`create|keep|move|rewrite|remove` action, its source and target, retained constraints, and the
root/native route that makes every deferred file reachable.

Interpret authorization precisely:

- A request to inspect, propose, recommend, or show the graph first is
  read-only. End with “Please confirm this proposal before I apply it,” then
  stop.
- An explicit request to apply/implement the proposed structural actions
  confirms decision-free file changes fitting that description after the graph
  is stated.
- Structural approval never selects an option for an open policy decision. Ask
  for the choice and stop before checked-in mutation when it affects the graph.

**Complete when:** the exact graph and file actions have applicable approval;
otherwise the repository remains unchanged and the response asks one compact
grouped question.

### 4. Apply and verify

For approved guidance-file replacements, read
[`../../references/file-updates.md`](../../references/file-updates.md) and use
the bundled atomic writer. Keep existing adapter direction and newline style.

Apply only confirmed actions. Edit a declared source of truth, then use the
repository's sync mechanism for generated/mirrored adapters. Preserve exact
constraints, rationales, unusual command spelling, skill procedures, and
decision status. Do not change tool permissions or implementations to make a
documented command work; report that mismatch separately. Do not commit or
push.

Verify the selected runtimes and declared mirrors:

```sh
uv run --quiet --no-project "<skill-dir>/../../backend/scripts/run_locked.py" ia-doctor verify --runtime both \
  [--mirror source=target]... [repository]
```

Use one runtime when explicitly selected. Supply `--mirror` only for a
relationship declared by repository evidence. Resolve critical findings before
claiming success, and describe the output as a compact structural gate rather
than full runtime-schema proof.

Compare the resulting guidance with the original rules as well: universal
prohibitions must still be resident, moved workflows must retain every step
and task-specific gate, and policy choices must still have their original
decision status. Structural verification cannot establish these semantic
properties. Repair a lost constraint or changed scope before reporting success.

**Complete when:** every selected runtime reaches the graph, verification has
no unresolved critical finding, existing knowledge is preserved, and no
unconfirmed action, commit, or push occurred.

## Boundaries

- Keep user-level runtime settings, permissions, installed plugins, global
  memory, and transcript frequency outside repository graph design.
- Keep full TOML, YAML, Markdown, and runtime-loader conformance outside this
  structural capability; use native validators where applicable.
