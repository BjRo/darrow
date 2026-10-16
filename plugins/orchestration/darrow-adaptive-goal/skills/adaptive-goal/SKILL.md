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

Complexity and duration do not authorize orchestration. A fresh conversation,
ambiguous answer, or multiple plausible owners supplies no continuation
authority. Delegation adds no permission, publication, or destructive authority.

Explicit invocation may request advice rather than engineering work. When the
user asks only for an explanation, comparison, or next-lifecycle-action answer,
answer directly without preflight helpers or a goal.

Without authority, make no helper call or mutation and return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Prepare read-only

Resolve the repository, then bind the bundled helper without searching:

- Claude: use `${CLAUDE_PLUGIN_ROOT}/backend`; Claude substitutes the active
  plugin's absolute root in skill content.
- Codex: for the activated file
  `<plugin-root>/skills/adaptive-goal/SKILL.md`, use `<plugin-root>/backend`.
  Starting at the directory containing `SKILL.md`, this is `../../backend`.

Require UV, Git, and readable `pyproject.toml` and `uv.lock` in that backend.
The frozen commands below let UV select compatible Python; system Python is
not a separate prerequisite. If the active plugin path or bundled helper is
unavailable, return `Status: launch_required` with the specific failure. Do not
search for another installation or mutate the repository.

The examples use Bash line continuations. On native Windows, enter each UV
command on one PowerShell line, omitting the trailing backslashes and passing
the same arguments. Helper execution does not require Bash on either host.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Use the returned repository, working-tree state, instruction, workflow, and
route records. Read applicable repository instructions and only the additional files
needed to understand scope, checks, authority, or a material decision.

During preflight do not edit product or test files or run a test, build, typecheck,
lint, review or implementation command. Retain those obligations for execution
after preflight. Preserve all existing work as user-owned.

Turn the request into observable acceptance criteria without choosing missing
product behavior. If a required product, security, destructive-scope,
publication, or permission decision is missing, ask the smallest concrete
question and do not launch.

When authoritative input is missing, invoke the necessary host-advertised
read-only capability before selecting readiness, acceptance, risk, workflow,
or route. For example, retrieve a referenced ticket through its matching read
skill. Check that the operation is read-only, preserve its complete evidence,
and stop dependent preflight if it refuses. Resolve the authoritative request
before launch. Input gathering grants no mutation authority.

## 3. Resolve readiness before launch

When authorized ticket delivery needs task-branch preparation, first preserve
the provider's exact opaque canonical token and discover all correlated local
branches through a compatible host-advertised Git capability's read-only token
operation. Require complete token-filtered evidence; a truncated general
listing is insufficient. If compatible discovery is unavailable or refuses,
stop dependent preparation without raw Git fallback.

Adaptive goal owns the choice:

- one match: bind that exact existing branch even if a proposed type or suffix
  differs; preserve its tip;
- multiple matches: ask for one explicit exact choice before mutation or
  launch, unless the caller already selected one of those existing branches;
- zero matches: bind one `<type>/<token>-<kebab-suffix>` name from the settled
  request, using a lowercase descriptive suffix, the unchanged token exactly
  once, and at most 60 characters. Preserve a valid exact caller-bound name.

A proposed new name is not a choice among existing matches. Missing ticket
identity asks the smallest question. Do not normalize tokens or infer provider
semantics from names. Compile the token, complete evidence, exact selection,
and this decision rule into the delivery context. Bind discovery refresh and
exact preparation to the compatible Git capability. The main thread refreshes
discovery immediately before preparation and reapplies this rule if candidates
changed; it asks through the same-goal feedback path when selection is needed.
Preparation remains goal-coordinated work and worktrees require explicit caller authority.
The delegating task recipe owns neither branch selection nor Git mechanics.
Fresh explicit delivery can reuse local state without automatic continuation
across conversations.

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

## 4. Select workflow, risk, profile, and verification

Select exactly one workflow and read its linked document completely:

- [`fix-bug`](references/workflows/fix-bug.md): repair behavior that violates an
  existing promise.
- [`implement-feature`](references/workflows/implement-feature.md): add behavior
  that does not exist.
- [`change-feature`](references/workflows/change-feature.md): intentionally
  change approved existing behavior.
- [`refactor`](references/workflows/refactor.md): preserve observable behavior.
- [`migration`](references/workflows/migration.md): sequence coexistence,
  consumer, or format transition.
- [`mechanical`](references/workflows/mechanical.md): perform an exact
  non-behavioral transformation with a complete oracle.
- `decision-gated`: a required choice or authority is missing; ask before launch.

Tie-break in this order: missing decision; migration over change only for a
sequence; change over bug when the approved contract changes; feature only when
equivalent behavior is absent; observable changes are not mechanical;
mechanical requires a complete oracle; refactor preserves behavior.

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

For `routine-plus`, identify the concrete implementation tradeoff or the user
or repository instruction that explicitly prioritizes first-pass boundary
correctness. A security boundary or high cost of a mistake determines risk;
it does not supply that priority. Fully specified localized work without an
additional basis stays `routine`. Preserve a brief basis for the selected
profile in the delivery context.

Selected verification and review providers perform their own assessment work.
Their presence alone does not raise the implementor's reasoning profile.

| Request | Risk | Profile | Independent review |
| --- | --- | --- | --- |
| Exact, fully specified security-policy change | high | routine | required |
| Localized validation with explicit first-pass correctness priority | routine when consequences are limited | routine-plus | selected by assurance policy |
| Unresolved diagnosis across plausible layers in a reversible internal utility | routine | judgment | selected by assurance policy |

Select assurance separately, preserving the independent-review policy:

- routine: omit by default;
- elevated: select when compatibility, caller impact, or counterexamples need
  independent judgment;
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

Read [`references/verification-lifecycle.md`](references/verification-lifecycle.md)
completely and compile its shared repair rules into the retained delivery context.
The main thread supplies current successful required checks before assessment. All
selected results return before one bounded repair assignment addresses their combined
eligible blockers. Default to two attempts total across verification, each
followed by fresh closed-set verification. Finite explicit overrides and the
strictest invocation, time, token and authority limits apply across providers.
Clear current-content evidence ends repair immediately; further attempts require
material progress and remaining budget. Only a complete clear combined conclusion
permits completion and remaining publication.

Never omit review for a high-risk change merely because its implementation is
clear or localized. A stronger user or repository rule may stop implementation
before launch, but it does not turn the required review into an omission.

Treat required-provider availability as a main-thread preflight gate. Missing or
incompatible verification or required review returns `Status: launch_required`
with each concrete capability gap before goal activation or mutation. Identify
missing independent review even if verification is also absent. Never delegate work to discover a known absence, bypass verification with direct review, or
substitute self-review or a generic-agent review. Additional assessments are
selected only by the goal; installation alone adds no requirement. A selected
unsupported QA or evidence operation is a gap, not permission to drop it.

An explicit user model and effort overrides the implementation route when the
host supports that concrete tuple. Implementation agents need only their bounded
assignment's capabilities; they do not need to own overall delivery. Otherwise
resolve the implementation policy route:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight route \
  --repo <absolute-repository> --host <codex|claude> --profile <profile> \
  [--route 'harness|provider|model|effort']
```

Pass `--route` only for an exact user override. Invalid or unreadable route
policy stops launch; do not fall back silently.

Compare the selected route with this thread's effective route:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-goal-preflight placement \
  --repo <absolute-repository> --host <codex|claude> \
  --selected-route 'harness|provider|model|effort' [--main-route 'harness|provider|model|effort']
```

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

Readiness and necessary read-only input gathering are invoked by the main thread
before launch. Preserve completed input evidence in the contract and bind any
needed refresh. The main thread coordinates implementation, verification and
publication assignments; each assignee invokes its relevant bindings when due.
Assessment-provider bindings travel through
verification with the same authority and response boundary. A direct shell, Git, forge,
tracker, or generic-subagent call is not a substitute for a bound skill. If the
skill refuses or becomes unavailable, stop that operation without expanding
authority.

Carry public references and relevant task facts through every bounded handoff.
A fresh assignment cannot rely on this thread's earlier reads. Instruct the
assignee to read and follow each relevant bound skill using available tools;
no dedicated tool named after the skill is needed. Read selected verification
and review instructions before mutation and retain those bindings. Invoke them
only when current checks and other prerequisites are met. Before declaring a
provider unavailable, attempt its supplied public instruction reference and
report the concrete failure. Missing skill-specific tooling is not absence;
do not reconstruct an installed path from a skill name.

Before an operation becomes due, check the bound skill's public prerequisites,
effects, returned evidence and stop conditions against the goal. Advertised
intent alone does not prove behavioral compatibility. Accept differently named
compatible skills; resolve a known mismatch before mutation. Return a refusal
to the coordinating thread for an authorized next action, never bypass it through raw tools.

Invoking a bound skill or receiving a zero exit status proves neither that its
substantive contract was satisfied nor that a dependent operation is due.
Before invoking each dependent capability, validate its prerequisite results
against both the bound skill and the goal contract. In particular, the main thread
must receive verification's complete current-content clear assessment, including
selected provider evidence and criterion coverage, before invoking a dependent
commit or publisher. A review-only result leaves this prerequisite unsatisfied,
even when the assessment call succeeded or its agent was named verification.
The commit or publisher's local readiness does not check this enclosing gate.

For authorized PR creation or reuse, require the publisher to return evidence
for the intended verified commit: exactly one open PR, repository, head/base,
draft state, and matching remote and forge head commit IDs. An existing URL
alone cannot prove unpublished local commits were delivered. Explicit reuse
and non-force push authority permits content publication, not metadata updates.

Do not invent bindings or assume sibling plugins exist. An operation without a
matching advertised skill remains ordinary bounded work unless the request,
repository, or selected gate requires that capability. Bind publication
operations only when each effect was explicitly authorized; completion never
adds commit, push, pull-request, merge, release, or deployment authority.

## 6. Retain the goal and delivery context

After read-only preflight, activate one native goal in this main thread or
continue its matching active goal using the host guide. Never replace an unrelated
goal. A queued proposal is not activation; wait for the native kickoff before
implementation or assessment.
Its objective is at most 4,000 Unicode characters: the bounded outcome, material
acceptance criteria, selected assurance, authority limits and completion criteria.
Set a token budget only when the user explicitly supplied one. Keep workflow,
coordination, routing and repair instructions here in the skill and retained
conversation; do not pack the full workflow into the goal or write a goal ledger.
Do not create a second goal or put the delivery goal in an implementation agent.

Retain acceptance, constraints and decisions; preserved work and authorized
effects; workflow and risk; implementation route, placement and their basis; readiness evidence;
focused and final checks; capability bindings; and the shared repair allowance.
Default maximum is two combined repair attempts, consumed zero unless there is
existing history. Only an explicit finite override changes that maximum.

You own workflow selection and ordering, assessment history, repair accounting
and completion. Before another assignment, after native continuation and before
a terminal response, reconcile issued work, returned evidence, outstanding
obligations and consumed attempts. Clarify missing task facts with the relevant
child; do not ask a delegated implementor to reconstruct delivery bookkeeping.

Translate the selected workflow into concrete work and evidence requirements.
When it requires a failing regression or acceptance check before an edit, obtain
that evidence yourself or explicitly assign the check before mutation. Require
failure for the intended missing or broken behavior. A passing check after the
edit does not establish the earlier failure. A delegated implementor needs the
concrete requirements, not a workflow identifier or responsibility for
sequencing delivery.

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

Placement never changes workflow, risk, assurance, bindings, checks or
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

Direct work follows the same workflow evidence, bound capabilities, checks,
authority limits and preserved user-owned changes as an assignment. Selected
verification and review stay separate capability assignments on their own
routes; direct implementation never permits self-assessment.

Choose repair placement the same way. One combined repair consumes one shared
attempt regardless of where it runs or how it is split. Switching placement,
reusing or replacing workers never resets or multiplies the allowance. Settle
all implementation work before candidate-bound checks and assessment.

### Delegated assignments

Launch a delegated implementor using the selected model and effort and the host
guide's native delegation controls. Retain its identity and reuse it for further
work on that assignment, including repairs, while delegation remains the chosen
placement. Supply the concrete changes, findings, changed constraints and checks;
it need not track whether this is the first implementation or a repair attempt.
Start a replacement only when the retained agent is unavailable or no longer
fits the required route or scope. State that reason and supply the
replacement's necessary context and prior work. Replacement never resets your
repair allowance.

Give the implementor the exact assignment, repository and
allowed files/effects, acceptance, relevant public skill paths, required checks,
preserved work and return evidence. It owns that assignment, not the delivery
goal. It must not invoke Adaptive Goal, create an overall goal, coordinate
independent assessment, or publish beyond the assignment's explicit authority.
Ask for changed files, actual check results, relevant evidence and unresolved
blockers. Keep workflow state, attempt counts and delivery decisions here. Wait for
the result before assigning conflicting work. A rejected route is a concrete
launch failure, not permission to silently choose another model.

Launch verification as a separate bounded capability assignment with the intent
to coordinate acceptance verification. Pin this coordinator to Codex
`gpt-6.1-sol/medium` or a stronger authorized route; on Claude use the scoped
`claude-opus-5-5/high` agent. Preserve review coordination separately: explicitly
pass Codex `gpt-6-luna/medium` or Claude `claude-sonnet-5-5/medium` as the review
coordinator route. This never overrides review's independent-reader route
(Codex `gpt-6.1-sol/xhigh`). Do not allow parent-model inheritance to change roles.
Supply the verification skill's exact installed instruction
path, compatible review binding, selected providers, originating acceptance,
scope/base/current candidate, successful checks, constraints and existing evidence.
Require its complete combined result and provider evidence. The capability owns
provider selection, its required internal delegation and reader model/effort.
Do not inherit the implementation route as a restriction on those readers, invoke
review directly in place of verification, or absorb assessment internals here.
Other selected capabilities similarly own their bounded operations and mechanics.

Evaluate returned evidence against acceptance and capability prerequisites.
An accepted assignment, zero exit code or review-only pass does not establish a
complete combined verification. Preserve complete reports and usable absolute
artifact references when supplied; do not invent mandatory saved artifacts for
a compatible capability whose complete public result is inline.

Await every selected result before one combined repair assignment. Consume one
shared attempt for that repair, refresh invalidated checks and arrange fresh
closed-set reassessment through verification. Carry unchanged original/prior
provider artifacts, original finding identities and provenance, prior/current
targets, repair history and direct-regression lineage. A summary cannot replace
authoritative records. Apply the shared lifecycle in references/verification-lifecycle.md:
clear ends repair; further attempts require material progress and remaining
budget; incomplete or unchanged evidence, exhausted limits or missing authority
blocks dependent work. An assessment restart cannot reset the allowance.

A concrete assessment error or newly available evidence may justify correcting
an assessment without changing code. Use the provider's public correction
contract, retain the previous report and full history, and obtain fresh judgments
and checks. Explain what error or gap the evidence corrects. Never relabel a
completed blocked assessment as aborted or omit it to obtain clearance.
Assessment correction neither consumes nor resets implementation repair attempts.

Before accepting a child's missing-helper or broken-provider diagnosis, require
its attempted command/path, observed diagnostic and comparison with the loaded
capability's public instructions. A failed lookup at a guessed path does not
prove an installation defect. Send a demonstrated invocation error back to the
same capability for bounded correction, preserving its prior result. Do not
execute assessment internals here or substitute another checkout's helper.
If the cause remains unverified, report that evidence gap without inventing a
fixture or installation diagnosis.

User feedback belongs to this main thread. Preserve every restriction, product
decision and implementation property; update affected acceptance and reassess
readiness when its assumptions change. Send relevant full feedback to any active
assignment before its next affected action. Retain a still-applicable assignment
for same-thread follow-up instead of launching a competing implementor. Where a
repository acknowledgement is required, pass the complete answer and require
success before mutation. Using an existing component means calling it, not
copying its algorithm. Status requests do not stop work; cancellation stops
further work and reports effects already performed.

An explicit instruction to wait for the user applies even when no product
question is pending. Retain which actions are withheld and what user message
releases them; include that restriction in affected assignments. Automatic
continuation, elapsed time and commands that change local readiness do not grant
authorization. Until the actual user message arrives, keep affected work
read-only and report that you are waiting. Never open a user-owned gate yourself.

Ask the smallest concrete question for a missing material decision. Stop affected
mutation, steering or interrupting active children as needed, and preserve this
same goal and its decisions, evidence and consumed attempts. Resume when the
required answer arrives. Use host controls truthfully: Codex literal pause
requires explicit user pause, complete requires achieved outcome, and blocked
requires the native tool's recurrence condition. Claude uses its supported goal
question and continuation controls. Never clear and recreate the goal to obtain
feedback or reset history.
Do not invent a custom retry or continuation loop. Report concrete host failures
and evidence gaps; never claim a replacement thread is the same goal.

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
