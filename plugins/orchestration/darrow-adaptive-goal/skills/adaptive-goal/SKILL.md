---
name: adaptive-goal
description: Coordinate a bounded engineering request as a native main-thread goal. Start only on explicit adaptive-goal invocation, preserved orchestration delegation, or unambiguous same-thread continuation. Exclude ordinary engineering regardless of complexity or duration.
---

# Adaptive Goal

Own one native goal in this main thread: decisions, acceptance, coordination and
completion. Place implementation under section 7. Invoke bound capabilities
through their public workflows; each owns its internals and routing.

Before activation or delegation, read the active host guide:
[Codex](references/codex-launch.md) or [Claude](references/claude-launch.md).
Native goal support is required. Keep the current coordinator model. On Codex,
recommend GPT-6.1 Sol/medium with one nonblocking hint if the current model is
known to be weaker.

## 1. Confirm authority

Proceed for explicit adaptive-goal invocation, preserved delegation of a bounded
request from an explicitly invoked orchestration, or unambiguous same-thread
feedback to the retained preflight or goal. Complexity, duration, a fresh
conversation or ambiguous ownership supplies no authority. Delegation expands
neither scope nor permissions.

Keep user-withheld work read-only until the user's actual release message.
Native continuation, elapsed time and changed local state cannot release it or
justify completion. If repository acknowledgement is required, pass the complete
user reply unchanged as one argument and require success before affected work.
A rejected approval needs new user authority.

For an explicit question-only invocation, answer from the
[acceptance lifecycle](references/verification-lifecycle.md) without preflight,
helpers or activation. Otherwise, without authority, make no helper call or
mutation and return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Prepare read-only

Find capabilities in the host's skill catalog and read their exact supplied
`SKILL.md` paths. Expand aliases using the skill-root table, never a reconstructed
plugin path. Skills use ordinary host tools; an absent dedicated tool proves
nothing. Require an actual invocation failure before declaring a command missing.

Resolve the repository and bundled backend: `${CLAUDE_PLUGIN_ROOT}/backend` on
Claude; `<plugin-root>/backend` for the activated
`<plugin-root>/skills/adaptive-goal/SKILL.md` on Codex. Require UV and Git.
A missing helper returns `Status: launch_required` with the failure; do not
search other installations. On native Windows, use one PowerShell line per command.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Use its repository, working-tree, instruction and route records. Read applicable
repository guidance and task-relevant files. Preserve existing work. Preflight
permits reads only, including no tests, builds, lint, review or implementation.

Retrieve missing authoritative input before dependent preflight. Prefer the
advertised read capability, otherwise the established tracker's configured
native read operation. Preserve provider, project and canonical identity; no
Darrow response format is required. A refusal or unavailable source stops
dependent work.

Derive observable acceptance without inventing product behavior. Ask the smallest
question for a missing product, security, destructive-scope, publication or
permission decision; do not launch until settled.

If fresh ticket context could repay delegation overhead, read
[isolated ticket workers](references/isolated-ticket-workers.md). Select its
finite scope, worker effects and required final assurance during preflight.
Size or ticket count alone does not select it.

## 3. Resolve readiness

For ticket delivery needing a branch, refresh the Git capability's exact
`ticket-id` discovery immediately before preparation. Reuse one match. For
several, ask the user to choose among those exact branches before mutation.
For none, prepare the caller's exact name or let branch creation name it.

| Situation | Readiness |
| --- | --- |
| Unassessed authoritative ticket, specification or accepted plan | Select |
| Complete bounded conversational request | Omit by default |
| Same scope assessed, every finding resolved | Omit |
| Material scope, acceptance, constraint or authoritative-input change | Reassess |
| User asks to skip | Omit unless explicit policy requires it |
| User, repository or delegating orchestration requires it | Select |

Retain an applicable conversational assessment; no standalone artifact is needed.
Approval or source completeness alone is not an assessment and cannot turn a
specification into a conversational request.

When selected, invoke the exact advertised implementation-readiness skill during
read-only preflight. Preserve its complete result. Continue only on `ready`.
For `needs-discovery`, `needs-decision` or `blocked`, return the complete result
verbatim first, followed only by the smallest unresolved questions. After the
user resolves findings, reassess the same scope. Repeat only while concrete
findings materially change. Missing required readiness returns
`Status: launch_required`; launch nothing.

Record the table row permitting omission or preserve the `ready` result.
Every criterion must follow from retrieved input without mutation.

## 4. Select evidence, risk, profile and assurance

Select evidence before editing:

| Change | Required evidence |
| --- | --- |
| New, changed or broken behavior | A focused check at a stable public seam fails for the intended reason before the edit, then passes; update affected callers, examples and docs |
| Behavior-preserving restructuring | Passing public-seam baseline before and after |
| Sequenced consumer or format transition | Map every criterion, including record conversion, to original entrypoints/callers and transition order; check compatibility there, retaining a tested forwarding entrypoint when moved |
| Exact non-behavioral transformation | State a complete oracle, then pass it |

Choose consequence risk, reasoning profile and assurance separately. Risk sets
final evidence; implementation uncertainty sets model/effort. Assurance never
raises the profile. Retain a one-line basis for each decision.

| Risk | Consequence | Final evidence and independent Review |
| --- | --- | --- |
| `routine` | Localized, reversible, limited impact | Scoped repository checks; omit Review by default |
| `elevated` | Compatibility, several consumers, persisted formats or operational impact | Affected-caller evidence and a counterexample; select Review when independent judgment is needed, always for sequenced consumer/format transitions |
| `high` | Security, authorization, destructive/irreversible state, privacy, safety or broad impact | Adversarial boundary check and required Review |

User and repository requirements override assurance defaults and check cadence.
The isolated-ticket strategy always requires final acceptance accounting and
independent Review of the complete specification, bound before activation.

| Profile | Implementation demand |
| --- | --- |
| `routine` | Clear localized or exact mechanical work |
| `routine-plus` | Localized competing implementations or explicit first-pass boundary-correctness priority |
| `scaled` | Straightforward multi-component work |
| `repo-wide` | Straightforward repository-wide work |
| `judgment` | Unresolved cause across plausible layers, architecture, planning or review judgment |

Read the [acceptance lifecycle](references/verification-lifecycle.md) completely.
It owns assessment inputs, compatibility, criterion accounting, history, repairs
and stop conditions, including when Review is omitted. When selecting Review,
read the exact advertised public skill before launch and require its fresh
independent readers and applicable standards/acceptance judgments. Review owns
its placement and routes; pass no override and create no substitute readers.
Bind other assessments only when selected by the request or policy.
Missing/incompatible required assurance returns `Status: launch_required`
before activation; installation alone selects nothing.

Resolve the implementation policy route and its relation to this thread:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight route \
  --repo <absolute-repository> --host <codex|claude> --profile <profile> \
  [--route 'harness|provider|model|effort'] [--main-route 'harness|provider|model|effort']
```

Pass `--route` only for an exact supported user model/effort override, and
`--main-route` only for an explicitly host- or user-stated current route.
Otherwise the helper observes the session. Retain `route_relation`, including
`unknown`. Invalid or unreadable policy stops launch without fallback.

## 5. Bind capabilities

For each authorized operation matching an advertised skill's intent, bind its
exact name and public instruction reference. Codex file references must be
installed absolute `SKILL.md` paths. Read prerequisites, effects, evidence and
stop conditions before the operation is due. Compatible names are valid;
sibling installation cannot be assumed.

Each assignee invokes its bindings when due. Pass the exact references and task
facts to every fresh assignment. Shell, Git, forge, tracker or generic-agent calls
cannot replace a bound skill or bypass its refusal. Operations without a matching
skill remain ordinary bounded work unless the request, repository or selected
gate requires that capability.

Bind publication only for explicitly authorized effects. Completion adds no
commit, push, PR, merge, release or deployment authority. Before dependent final
commits/publication, require clear acceptance under the lifecycle reference.
Intermediate isolated-worker commits have only its focused-check exception and
still require the bound commit skill, message rules and respect for refusals.

Require the publisher's verified result to name the verified commit; an existing
PR URL proves no delivery. Reuse/non-force-push authority covers content, not
metadata updates.

Ordinary tracker operations preserve configured provider, project and exact
identity without configuration changes. ADR lifecycle/catalog work follows
repository and available domain-modeling guidance as ordinary document work.

## 6. Activate and retain context

After read-only preflight clears, activate or continue the matching native goal
using the host guide. Require observed activation before implementation or
assessment. Never replace an unrelated goal. Keep the objective within 4,000
Unicode characters: outcome, material acceptance, assurance, authority limits and
completion. Set a token budget only on explicit user request. Keep coordination
instructions here and overall goal ownership out of implementation agents.

Retain criteria, constraints, decisions, preserved work, authorized effects,
risk, readiness, route/placement and basis, bindings, focused/final checks,
assessment history and consumed repair attempts. Reconcile outstanding work and
evidence before assignments, after native continuation and before terminal
responses. Ask the relevant child for missing task facts, not reconstruction of
delivery bookkeeping.

Assign concrete evidence requirements. For existing behavior, name its original
public entrypoints/callers; testing only a parallel replacement proves nothing
about them. Obtain required pre-edit failure or baseline evidence before mutation.
A later passing check cannot establish an earlier failure. After edits, require successful focused and final-tree checks for current content.

## 7. Place and coordinate work

Placement preserves evidence, assurance, bindings, authority and user-owned work.
Record its basis and `route_relation`. If selected during preflight, use
[isolated ticket workers](references/isolated-ticket-workers.md); otherwise:

1. Run substantial independent parts concurrently on the selected route when
   time saved exceeds handoff cost. Require disjoint owned files, settled shared
   interfaces, separate focused checks and host capacity. Settle interfaces first
   under the sequential rule. Assign only listed files; return out-of-scope edits
   to the main thread. Keep coupled work sequential. Launch no competing whole-task
   implementations or other goal owner. Wait for all parts, resolve conflicts,
   integrate and run final-tree checks before proceeding.
2. Place sequential work by route:

| `route_relation` | Placement |
| --- | --- |
| `same` | Direct in this thread |
| `higher` or `unknown` | Delegate on the selected route |
| `lower` | Delegate when cheaper execution repays handoff, rereading, waiting and validation; otherwise direct |

Use the host guide's delegation controls with the selected model/effort. Retain
the accepted implementor identity. Each self-contained assignment includes the
repository, scope/owned files, allowed effects, acceptance, constraints,
preserved work, exact bound skill references, concrete evidence requirements and
checks. Require changed files, actual check results, evidence and blockers.
The implementor owns only its assignment, without Adaptive Goal invocation,
overall goal ownership, independent-assessment coordination or extra publication
authority. Route refusal stops the assignment without silent substitution.

Settle implementation before candidate-bound checks and assessments. Invoke each
selected provider's full public workflow in this main thread, then apply the
lifecycle reference. Direct implementation never permits self-assessment.

Send combined repairs to the producing implementor: this thread for direct work,
otherwise its retained host identity. Include findings, changed constraints and
checks to rerun. Replace it only if unavailable or no longer suited to the route
or scope; state why and carry its context/history. One combined repair consumes
one shared attempt regardless of splitting or replacement. Wait before assigning
conflicting work.

A missing-helper/provider claim requires the attempted path and observed error.
Compare it with the loaded contract and return a real invocation error to the
same capability; an unverified cause remains a gap.

## 8. Handle feedback and blockers

Keep feedback in this main thread. Preserve restrictions and implementation
requirements, update acceptance and reassess changed readiness assumptions.
Send complete relevant feedback to active assignments before their next affected
action; reuse still-applicable implementors. Using an existing component means
calling it. Apply section 1's acknowledgement and user-wait boundaries.

Ask the smallest question for a missing material decision and stop affected
mutation. Resume the same goal with its decisions, evidence and attempts when
answered. Status requests do not stop work. Cancellation stops further work and
reports observed effects. Use native goal controls truthfully, without clearing
and recreating the goal or custom retry loops.

Observe external state before repeating ambiguous effects; completed effects
must not be duplicated. Carry this rule in affected assignments. Retry an
unchanged deterministic failure only after evidence or conditions change.
Report its condition, evidence and next action. Native blocked-state recurrence
can retain that blocker without rerunning the failed command.

## 9. Complete from evidence

Complete the native goal only when the lifecycle's clear acceptance covers the
requested outcome, every current check and selected assessment, resolved blockers
and all authorized required effects. Missing/stale evidence blocks completion and
dependent final commit/publication, even after a review pass.

Return a self-contained result with completion or blockage; placement, basis and
`route_relation`; changed files, checks and readiness; selected assessment
conclusions, findings/repairs and supplied report links; criterion evidence/gaps;
performed publication and remaining risks. Preserve substantive provider evidence;
summarize completed assessments without treating their earlier next actions as
open work. Missing facts remain gaps.

Every terminal response, including later native continuations of a blocker,
states attempts used, authorized maximum and its source. Success does not reduce
the authorized maximum.
