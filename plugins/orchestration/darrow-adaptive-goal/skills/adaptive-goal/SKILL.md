---
name: adaptive-goal
description: Start only for explicit adaptive-goal orchestration, preserved delegation from an invoked orchestration, or an unambiguous same-thread continuation of that orchestration. Then retain one bounded native goal in the main thread after required readiness discussion, implement directly or delegate route-selected implementation assignments when the route, cost or concurrency requires it, and coordinate intent-matched capabilities. Never select for ordinary engineering intent, regardless of complexity or duration.
---

# Adaptive Goal

Keep the persistent native goal in this main thread on Codex and Claude. You own the request, decisions, acceptance and completion. Implement
directly, or delegate bounded assignments on the selected route when it is
stronger than this thread's route, this thread's route is unknown, or a cost or
concurrency benefit repays the handoff (section 7). Invoke verification
and other selected capabilities through bounded capability assignments; each
capability retains its own internals and routing. There is no separate delivery
owner, workflow runtime or lifecycle ledger.

Read the active host guide before goal activation or delegation:
[Codex](references/codex-launch.md) or [Claude](references/claude-launch.md).
Native goal support is required. The main thread's current model stays unchanged.
On Codex, recommend GPT-6.1 Sol/medium for coordination. If the current model is known
to be weaker, give one brief nonblocking reliability hint and continue within
its supported controls; do not silently switch models. Stronger routes are
permitted, but have not all been validated.

## 1. Confirm authority and requested outcome

Proceed only when:

- the user explicitly invoked adaptive-goal;
- an explicitly invoked orchestration entrypoint delegated one bounded request
  while preserving its scope and permissions; or
- unambiguous same-thread feedback targets the retained preflight or goal,
  including an answer, correction, added constraint, cancellation, or status request.

When a repository acknowledgement is required, pass the user's complete reply
unchanged as one argument and require it to succeed before affected work. A
rejected approval needs new user authority.

**A user-owned wait is an authority boundary.** Keep withheld work read-only
until the user's actual release message arrives. A host-generated "continue
working toward the goal" message, elapsed time or a changed local state does not
release it, and you never complete the goal while its work is still withheld.

Complexity and duration do not authorize orchestration. A fresh conversation,
ambiguous answer, or multiple plausible owners supplies no continuation
authority. Delegation adds no permission, publication, or destructive authority.

An explicit invocation that only asks a question gets a direct answer from the
[verification lifecycle](references/verification-lifecycle.md) (beside this
`SKILL.md`), with no preflight, helper call or goal.

Without authority, make no helper call or mutation. Your entire response is
exactly this block, with no explanation before or after it:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Prepare read-only

Discover capabilities in the host's **skill catalog** and read the exact
supplied `SKILL.md` path before declaring one unavailable. Skills are
instructions executed with ordinary host tools; they need no dedicated tool, so
searching the tool list (such as `ALL_TOOLS`) cannot prove a skill is missing. Expand an alias such as `r2/prepare-task-branch/SKILL.md`
with **r2's full root from the skill-root table**. Never rebuild an installed
path from a plugin name.

Resolve the repository, then bind the bundled helper without searching:

- Claude: use `${CLAUDE_PLUGIN_ROOT}/backend`; Claude substitutes the active
  plugin's absolute root in skill content.
- Codex: for the activated file
  `<plugin-root>/skills/adaptive-goal/SKILL.md`, use `<plugin-root>/backend`.
  Starting at the directory containing `SKILL.md`, this is `../../backend`.

Require UV and Git. If the bundled helper is unavailable, return
`Status: launch_required` with the specific failure; do not search for another
installation. On native Windows, enter each command on one PowerShell line.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Use the returned repository, working-tree state, instruction and route
records. Read applicable repository instructions and only the additional files
needed to understand scope, checks, authority, or a material decision.

Preflight is read-only: no edits and no test, build, lint, review or
implementation commands. Existing work stays user-owned.

Turn the request into observable acceptance criteria without choosing missing
product behavior. If a required product, security, destructive-scope,
publication, or permission decision is missing, ask the smallest concrete
question and do not launch.

When authoritative input is missing, such as a referenced ticket, retrieve it
through the matching read-only capability before deciding anything else, and
stop dependent preflight if it refuses.

## 3. Resolve readiness before launch

For ticket delivery that needs a task branch, find existing branches through the
Git capability's exact `ticket-id` discovery, refreshed right before preparing.
One match: reuse it. Several: ask the user to pick one before any mutation. None:
prepare the caller's exact name, else let the branch-creation capability name it.

Select readiness semantically:

| Situation | Selection |
| --- | --- |
| unassessed authoritative ticket, specification, or accepted plan | select |
| complete bounded conversational request | omit by default |
| same scope already assessed and every finding resolved | omit |
| material scope, acceptance, constraint, or authoritative-input change | select again |
| user asks to skip the default gate | omit unless explicit policy requires it |
| user, repository, or delegating orchestration requires it | select |

A readiness assessment preserved in this conversation counts for the exact
scope it assessed. An accepted or approved request is not itself a readiness
assessment: for an authoritative source, use the already-assessed branch only
when an applicable readiness result is actually available. Completeness alone
does not move a specification into the conversational-request omission. Do not
rerun an existing assessment merely because implementation is about to start or
because no standalone artifact was written.

When selected, identify the exact host-advertised skill matching implementation
readiness and invoke it now, while preflight remains read-only. Preserve its
complete human-readable result.

- `ready`: continue preflight and compile the settled result into the contract.
- `needs-discovery`, `needs-decision`, or `blocked`: return the complete result,
  surface its smallest unresolved questions, and start no implementation.

For a non-ready result, put the complete capability result at the start of the
response unchanged. Do not add a preamble, summarize it, or paraphrase any
section. Append only the smallest unresolved questions after the complete
result when clarification is still needed.

After the user resolves the findings, invoke readiness again for the same scope.
Repeat only while concrete findings materially change; never infer an answer or
launch on a non-ready result. If required readiness has no matching advertised
skill, return `Status: launch_required` with the missing capability and make no
mutation.

## 4. Select evidence, risk, profile, and verification

Decide the evidence the change needs. Several rows may apply:

| Change | Before the edit | After the edit |
| --- | --- | --- |
| New, changed or broken behavior | A focused check at a stable public seam fails for the intended reason | That check passes; update affected callers, examples and docs |
| Behavior-preserving restructuring | A passing baseline at stable public seams | The same baseline still passes |
| Sequenced transition of consumers or formats | Each criterion, including record conversion, is mapped to its existing entrypoint and callers, with the transition order | Compatibility checks pass through those original entrypoints, never only a new parallel implementation; a moved implementation keeps a tested forwarding entrypoint |
| Exact non-behavioral transformation | A complete oracle is stated | The oracle passes |

A missing decision or authority is not a change kind: ask before launch.

Keep these three decisions separate:

| Decision | Basis | Controls |
| --- | --- | --- |
| Consequence risk | Impact of an incorrect change | Required final checks and assurance |
| Reasoning profile | Implementation uncertainty, scope, and explicit correctness priority | Implementation model and effort |
| Assurance | Risk policy and user or repository requirements | Verification and independent-review bindings |

Select consequence risk:

- `routine`: localized, reversible, limited blast radius;
- `elevated`: compatibility, several consumers, persisted formats, or meaningful
  operational impact;
- `high`: security or authorization, destructive or irreversible state,
  privacy, safety, or broad blast radius.

Classify the reasoning demand of the implementor's engineering work:

- `routine`: clear localized or exact mechanical work;
- `routine-plus`: localized work with materially competing implementations or
  an explicit first-pass boundary-correctness priority;
- `scaled`: straightforward multi-component work;
- `repo-wide`: straightforward repository-wide work;
- `judgment`: unresolved cause across plausible layers or architecture,
  planning, or review judgment.

Risk and selected verification never raise the profile: an exact security-policy
change is high risk but `routine`, while an unresolved cause across plausible
layers is `judgment` even at routine risk. `routine-plus` needs a real
implementation tradeoff or an explicit first-pass correctness instruction. Keep
a one-line profile basis.

Select assurance separately, preserving the independent-review policy:

- routine: omit by default;
- elevated: select when compatibility, caller impact, or counterexamples need
  independent judgment; a sequenced consumer or persisted-format transition
  always does;
- high: required;
- any risk: select when the user or repository requires it.

An independent-review request selects verification with review as its required
assessment, including when review is the only selected assessment. Compile two
distinct bindings: main thread -> verification, verification -> independent review.
Never translate “review only” into a direct main thread -> review invocation.

When selected, bind the exact host-advertised verification skill that coordinates
acceptance assurance and its compatible required independent code-review skill.
Read both public contracts during preflight. Verify prerequisites, authorized
effects, result evidence and stop conditions for initial and closed follow-up
assessment. Use compatible replacements by intent, never provider identity or
sibling files. The main thread invokes verification with the review binding; verification
owns assessment coordination and review owns its independent judgments.

Bind a review skill only by its exact `SKILL.md` path, after reading it and
confirming it is an independent code-review provider. A bare name is not enough:
a host built-in such as Claude Code's own `code-review` can share a provider's
name. If you cannot confirm one, pass the review requirement and let
verification select the provider.

Bind only the route of the role you launch: the Verification coordinator runs
on `gpt-6.1-sol/medium` (Codex) or the `claude-sonnet-5-5/medium` scoped agent
(Claude). Verification owns the routes of everything it launches, including
review coordination, and review owns its readers; do not pass or restate those
routes. A verification skill's instruction to spawn a provider on its own route
applies **inside** Verification, not to Verification itself. Keep this main
thread's model unchanged. A stronger route requires existing explicit
authorization, never automatic escalation.

Read [`references/verification-lifecycle.md`](references/verification-lifecycle.md)
completely and retain its repair rules: two combined repair attempts by default,
clear ends repair, and no progress or exhausted limits stop it. Only a complete
clear combined conclusion permits completion and remaining publication.

High-risk review is never omitted because the implementation looks clear.
Missing or incompatible verification or required review returns
`Status: launch_required` naming each gap before goal activation; never
substitute self-review or a generic agent. Installation alone selects no
additional assessment.

An explicit user model and effort overrides the implementation route when the
host supports that concrete tuple. Implementation agents need only their bounded
assignment's capabilities; they do not need to own overall delivery. Otherwise
resolve the implementation policy route and compare it with this thread's
effective route in one call:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight route \
  --repo <absolute-repository> --host <codex|claude> --profile <profile> \
  [--route 'harness|provider|model|effort'] [--main-route 'harness|provider|model|effort']
```

Pass `--route` only for an exact user override. Invalid or unreadable route
policy stops launch; do not fall back silently.

The helper observes the active session's model and effort. Pass `--main-route`
only when the user or host states this thread's route explicitly. Retain the
returned `route_relation`; an unknown main route stays unknown.

## 5. Bind intent-matched skills

Enumerate the exact authorized operations in the goal. For each operation whose
intent matches a host-advertised skill, record its exact advertised name and
host-supplied public instruction reference as a required capability binding.
For a file-backed Codex skill, include its installed absolute `SKILL.md` path.
Common examples include ticket reads and
updates, TDD, commits, pull requests, and verification with its required review.

Each assignee invokes its bindings when due; assessment providers are bound
through verification. A direct shell, Git, forge, tracker or generic-agent call
is not a substitute for a bound skill, and a refusal stops that operation
without expanding authority. Pass the exact skill references and task facts in
every handoff, because a fresh assignment cannot rely on this thread's reads.

Check each bound skill's prerequisites, effects, evidence and stop conditions
against the goal before it is due; compatible skills with other names are fine.
A successful call or zero exit status does not prove its contract was met.
Before any dependent commit or publisher, require verification's complete
current-content clear assessment with criterion coverage; a review-only result
does not satisfy it.

For authorized publication, the publisher's own verified result establishes
what was published; check that it names the verified commit. An existing PR URL
alone does not prove delivery. Explicit reuse and non-force push authority
permits content publication, not metadata updates.

Do not invent bindings or assume sibling plugins exist. An operation without a
matching advertised skill remains ordinary bounded work unless the request,
repository, or selected gate requires that capability. Bind publication
operations only when each effect was explicitly authorized; completion never
adds commit, push, pull-request, merge, release, or deployment authority.

## 6. Retain the goal and delivery context

After read-only preflight, activate one native goal in this main thread, or
continue its matching active goal, using the host guide. Never replace an
unrelated goal; when no goal exists, create the first one here. A queued
proposal is not activation. The objective is at most 4,000 Unicode characters:
outcome, material acceptance, assurance, authority limits and completion
criteria. Set a token budget only when the user supplied one. Keep coordination
instructions in this skill, not in the goal, and never put the goal in an
implementation agent.

Retain acceptance, constraints and decisions; preserved work and authorized
effects; required evidence and risk; implementation route, placement and their basis; readiness evidence;
focused and final checks; capability bindings; and the shared repair allowance.
Default maximum is two combined repair attempts, consumed zero unless there is
existing history. Only an explicit finite override changes that maximum.

You own evidence selection and ordering, assessment order, repair accounting
and completion. Before another assignment, after native continuation and before
a terminal response, reconcile issued work, returned evidence, outstanding
obligations and consumed attempts. Clarify missing task facts with the relevant
child; do not ask a delegated implementor to reconstruct delivery bookkeeping.

Translate the required evidence into concrete work.
For behavior that already exists, bind each material criterion to its current
public entrypoint and carry those paths into assignments. Verify the original callers; moving a test's import to
a new parallel implementation cannot establish that those callers were fixed.
When it requires a failing regression or acceptance check before an edit, obtain
that evidence yourself or explicitly assign the check before mutation. Require
failure for the intended missing or broken behavior. A passing check after the
edit does not establish the earlier failure. A delegated implementor needs the
concrete requirements, not responsibility for sequencing delivery.

For an existing candidate with assessment-before-change intent, obtain current
successful checks and the selected assessment of that unchanged candidate before
authorizing repair. Obvious edits do not waive that assessment or its accounting.
After implementation or repair, require successful focused and final-tree checks
for current content. Routine risk needs scoped repository checks; elevated risk
also needs affected-caller evidence and a counterexample; high risk adds an
adversarial boundary check and independent review. Repository cadence wins.

## 7. Place work and coordinate its results

Use native host continuation and delegation. Choose the next assignment from
the request, current evidence and remaining obligations; there is no fixed phase
pipeline. You remain responsible for completion throughout.

### Place implementation

Placement never changes required evidence, risk, assurance, bindings, checks or
authority. Decide it in two steps and record a one-line basis.

**First, split or not.** Run independent parts of one candidate as concurrent
implementation assignments on the selected route, whatever the
`route_relation`, when each part is substantial enough that parallel progress
saves more time than its handoff costs. Parts qualify only with disjoint owned
files, settled shared interfaces and separately runnable focused checks. Settle shared
interfaces first, placing that preliminary work by the sequential rule below. Each assignment owns only its
listed files and returns any needed edit outside them instead of making it.
Stay within the host's child limit. Wait for every part, resolve conflicting
edits before further work, integrate, then run final-tree checks. Keep coupled
work, such as an interface change across its callers, sequential. Never launch
competing whole-task implementations or another goal owner.

**Otherwise, place the sequential work** from the retained `route_relation`:

| Relation | Placement |
| --- | --- |
| `same` | implement directly in this thread |
| `higher` or `unknown` | delegate on the selected route |
| `lower` | delegate only when the assignment is large enough that cheaper execution outweighs writing the handoff, the child rereading context, waiting and validating; otherwise implement directly |

Do not spawn an implementor merely to keep a coordinator/implementor split.
Never implement directly in place of a stronger selected route or with an
unknown main route.

Direct work follows the same required evidence, bound capabilities, checks,
authority limits and preserved user-owned changes as an assignment. Selected
verification and review stay separate capability assignments on their own
routes; direct implementation never permits self-assessment.

Decide placement once. **A repair goes back to the implementor that produced the
candidate**: this thread after direct work, otherwise the retained implementor.
One combined repair consumes one shared attempt however it is split; replacing a
worker never resets or multiplies the allowance. Settle all implementation work
before candidate-bound checks and assessment.

### Delegated assignments

Launch a delegated implementor using the selected model and effort and the host
guide's native delegation controls. Retain its identity. Send every later
request on that assignment, including each repair, to that same implementor
with the host guide's follow-up control: it already holds the task context, so
send the combined findings, changed constraints and checks to rerun. Do not
launch a new implementor for a repair. Replace it only when it is unavailable
or no longer fits the required route or scope; state that reason and supply the
replacement's necessary context and prior work. Replacement never resets your
repair allowance.

Give the implementor the exact assignment, repository and
allowed files/effects, acceptance, relevant public skill paths, required checks,
preserved work and return evidence. It owns that assignment, not the delivery
goal. It must not invoke Adaptive Goal, create an overall goal, coordinate
independent assessment, or publish beyond the assignment's explicit authority.
Ask for changed files, actual check results, relevant evidence and unresolved
blockers. Keep delivery state, attempt counts and delivery decisions here. Wait for
the result before assigning conflicting work. A rejected route is a concrete
launch failure, not permission to silently choose another model.

Launch verification as a separate bounded capability assignment with the intent
to coordinate acceptance verification, using the role bindings from section 4.
Supply the verification skill's exact installed instruction
path, compatible review binding, selected providers, originating acceptance,
scope/base/current candidate, successful checks, constraints and existing evidence.
Require its complete combined result and provider evidence.

On **Codex**, write that one bounded assignment as UTF-8 to a unique temporary
file outside product scope. Immediately before launch, use **Adaptive Goal's
backend bound in section 2** to prepare the native input:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight codex-verification-input \
  --task-name <unique_lowercase_name> --assignment-file <absolute-handoff-file>
```

Call native `spawn_agent` with the returned JSON object **unchanged**. The helper
copies your handoff and fixes Verification's `model`, `reasoning_effort` and
`fork_turns`; do not substitute a provider-child route from the verification
skill. It does not launch the agent for you. A rejected helper or native launch
stops that assignment without fallback. Only an already authorized explicit
stronger Verification route uses a caller-bound native invocation instead.
This temporary input holds one assignment, not the goal or its history.

On **Claude**, use the scoped `claude-sonnet-5-5/medium` agent. Neither parent-model
inheritance nor an implementation route changes Verification's internal routes.

The capability owns
provider selection, its required internal delegation and reader model/effort.
Do not inherit the implementation route as a restriction on those readers, invoke
review directly in place of verification, or absorb assessment internals here.
Other selected capabilities similarly own their bounded operations and mechanics.

Evaluate returned evidence against acceptance and capability prerequisites.
An accepted assignment, zero exit code or review-only pass does not establish a
complete combined verification. Preserve complete reports and usable absolute
artifact references when supplied; do not invent mandatory saved artifacts for
a compatible capability whose complete public result is inline.

Await every selected result before one combined repair. Send it to the
implementor that produced the candidate, consume one shared attempt, refresh
invalidated checks and request follow-up through verification, passing its
prior result references back unchanged. Verification owns finding history and
assessment correction. Apply the lifecycle reference for whether another repair
is allowed; an assessment restart cannot reset the allowance.

A child's "missing helper" or "broken provider" claim needs the attempted
path and observed error; a guessed path proves nothing. Send a real invocation
error back to the same capability, and report an unverified cause as an
evidence gap.

User feedback belongs to this main thread. Preserve every restriction, product
decision and implementation property; update affected acceptance and reassess
readiness when its assumptions change. Send relevant full feedback to any active
assignment before its next affected action. Retain a still-applicable assignment
for same-thread follow-up instead of launching a competing implementor. Where a
repository acknowledgement is required, apply the exact-copy rule in section 1.
Using an existing component means calling it, not
copying its algorithm. Status requests do not stop work; cancellation stops
further work and reports effects already performed.

Ask the smallest concrete question for a missing material decision, stop
affected mutation, and resume the same goal with its decisions, evidence and
consumed attempts when the answer arrives. Use host goal controls truthfully
(see the host guide); never clear and recreate the goal or build a custom retry
loop.

Before repeating an ambiguous external effect, observe its current state and
never duplicate an effect that already completed. Include this rule in affected
capability assignments. Do not retry an unchanged deterministic failure without
changed evidence or conditions; return the concrete blocker and next action.
Native blocked-state recurrence can use the retained blocker; it does not require
rerunning the unchanged failing command.

## 8. Complete from evidence

Mark the main-thread goal complete only when the requested outcome and every
required current-content check and selected assessment are supported, blockers
are resolved, and all authorized required effects are established. Incomplete
verification blocks completion and dependent commit/publication even if review
is clear. Goal completion creates no additional publication authority.

The self-contained user-facing result includes completion or blockage, implementation
placement and its basis, changed files, checks,
readiness, combined verification and complete selected results, material criterion
evidence or gaps, original findings and repair history, consumed attempts and the
authorized maximum, performed publication effects and remaining risks. A default
maximum remains two when one attempt succeeds. Preserve substantive provider
evidence; do not replace missing facts with implementation-agent assertions.
Include consumed attempts and the maximum in every terminal response, including
blocked responses and later native continuations of that same blocker.
