---
name: adaptive-delivery
description: Start only for explicit adaptive-delivery orchestration, preserved delegation from an invoked orchestration, or an unambiguous same-thread continuation of that orchestration. Then compile one bounded engineering request after any required readiness discussion and launch exactly one route-selected subagent owner with intent-matched capability bindings. Never select for ordinary engineering intent, regardless of complexity or duration.
---

# Adaptive Delivery

Prepare the goal, bind matching skills, launch one separate owner, and let that
owner do the work. Darrow maintains no lifecycle ledger.

The accepted subagent task is the goal boundary. Neither parent nor owner calls
`create_goal` or `update_goal` to mirror this contract into a second goal
lifecycle. Completion is the owner result relayed to the user.

## 1. Confirm authority and requested outcome

Proceed only when:

- the user explicitly invoked adaptive-delivery;
- an explicitly invoked orchestration entrypoint delegated one bounded request
  while preserving its scope and permissions; or
- unambiguous same-thread feedback targets the retained preflight or owner,
  including an answer, correction, added constraint, cancellation, or status request.

Complexity and duration do not authorize orchestration. A fresh conversation,
ambiguous answer, or multiple plausible owners supplies no continuation
authority. Delegation adds no permission, publication, or destructive authority.

Explicit invocation may request advice rather than engineering work. When the
user asks only for an explanation, comparison, or next-lifecycle-action answer,
answer directly without preflight helpers or an owner.

Without authority, make no helper call or mutation and return exactly:

```text
format: darrow-adaptive-delivery-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

## 2. Prepare read-only

Resolve the repository, then bind the bundled helper without searching:

- Claude: use `${CLAUDE_PLUGIN_ROOT}/backend`; Claude substitutes the active
  plugin's absolute root in skill content.
- Codex: for the activated file
  `<plugin-root>/skills/adaptive-delivery/SKILL.md`, use `<plugin-root>/backend`.
  Starting at the directory containing `SKILL.md`, this is `../../backend`.

Require readable `pyproject.toml` and `uv.lock` in that exact backend, plus UV,
Python 3.10–3.13, and Git. Use the frozen runtime-only entrypoints below on
Linux, macOS, or native Windows. Do not
scan the repository, plugin caches, home directory, `PATH`, or machine for an
alternative. If the host does not expose the active plugin path or the exact
helper is unavailable, return `Status: launch_required` and make no mutation.
Describe the unavailable launch boundary clearly, for example with
`Status: launch_required`.

Then run:

The examples use Bash line continuations. On native Windows, enter each UV
command on one PowerShell line, omitting the trailing backslashes and passing
the same arguments. Helper execution does not require Bash on either host.

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-delivery-preflight prepare \
  --repo <absolute-repository> --host <codex|claude>
```

Use the returned repository, working-tree state, instruction, workflow, and
route records. Read applicable repository instructions and only the additional files
needed to understand scope, checks, authority, or a material decision.

Until the owner is accepted, do not edit product or test files and do not run a
test, build, typecheck, lint, review, or implementation command. Compile those
commands for the owner. Preserve all existing work as user-owned.

Turn the request into observable acceptance criteria without choosing missing
product behavior. If a required product, security, destructive-scope,
publication, or permission decision is missing, ask the smallest concrete
question and do not launch.

When authoritative input is missing, invoke the necessary host-advertised
read-only capability before selecting readiness, acceptance, risk, workflow,
or route. For example, retrieve a referenced ticket through its matching read
skill. Check that the operation is read-only, preserve its complete evidence,
and stop dependent preflight if it refuses. Do not ask the owner to discover
the request after launch. Input gathering grants no mutation authority.

## 3. Resolve readiness before launch

When authorized ticket delivery needs task-branch preparation, first preserve
the provider's exact opaque canonical token and discover all correlated local
branches through a compatible host-advertised Git capability's read-only token
operation. Require complete token-filtered evidence; a truncated general
listing is insufficient. If compatible discovery is unavailable or refuses,
stop dependent preparation without raw Git fallback.

Adaptive delivery owns the choice:

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
and this decision rule into the owner contract. Bind discovery refresh and
exact preparation to the compatible Git capability. The owner refreshes
discovery immediately before preparation and reapplies this rule if candidates
changed; it asks through the same-owner feedback path when selection is needed.
Preparation remains owner work and worktrees require explicit caller authority.
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
  surface its smallest unresolved questions, and launch no owner.

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

Select consequence risk:

- `routine`: localized, reversible, limited blast radius;
- `elevated`: compatibility, several consumers, persisted formats, or meaningful
  operational impact;
- `high`: security or authorization, destructive or irreversible state,
  privacy, safety, or broad blast radius.

Select assurance separately, preserving the independent-review policy:

- routine: omit by default;
- elevated: select when compatibility, caller impact, or counterexamples need
  independent judgment;
- high: required;
- any risk: select when the user or repository requires it.

An independent-review request selects verification with review as its required
assessment, including when review is the only selected assessment. Compile two
distinct bindings: owner -> verification, verification -> independent review.
Never translate “review only” into a direct owner -> review invocation.

When selected, bind the exact host-advertised verification skill that coordinates
acceptance assurance and its compatible required independent code-review skill.
Read both public contracts during preflight. Verify prerequisites, authorized
effects, result evidence and stop conditions for initial and closed follow-up
assessment. Use compatible replacements by intent, never provider identity or
sibling files. The owner invokes verification with the review binding; verification
owns assessment coordination and review owns its independent judgments.

Read [`references/verification-lifecycle.md`](references/verification-lifecycle.md)
completely and compile its shared repair rules into the inline owner contract.
The owner supplies current successful required checks before assessment. All
selected results return before one owner repair attempt addresses their combined
eligible blockers. Default to two attempts total across verification, each
followed by fresh closed-set verification. Finite explicit overrides and the
strictest invocation, time, token and authority limits apply across providers.
Clear current-content evidence ends repair immediately; further attempts require
material progress and remaining budget. Only a complete clear combined conclusion
permits completion and remaining publication.

Never omit review for a high-risk change merely because its implementation is
clear or localized. A stronger user or repository rule may stop implementation
before launch, but it does not turn the required review into an omission.

Treat required-provider availability as a parent preflight gate. Missing or
incompatible verification or required review returns `Status: launch_required`
with each concrete capability gap before any owner launch or mutation. Identify
missing independent review even if verification is also absent. Never launch an
owner to discover the absence, bypass verification with direct review, or
substitute self-review or a generic-agent review. Additional assessments are
selected only by the goal; installation alone adds no requirement. A selected
unsupported QA or evidence operation is a gap, not permission to drop it.

Classify reasoning demand independently:

- `routine`: clear localized or exact mechanical work;
- `routine-plus`: localized work with materially competing implementations or
  an explicit first-pass boundary-correctness priority;
- `scaled`: straightforward multi-component work;
- `repo-wide`: straightforward repository-wide work;
- `judgment`: unresolved cause across plausible layers or architecture,
  planning, or review judgment.

An explicit user model and effort wins only when the model is eligible for
adaptive-delivery ownership. Codex `gpt-6-luna` can own routine and routine-plus
work and invoke bound capabilities through native subagents. A Codex
`gpt-5.6-luna` route is not owner-capable and must be rejected; that model
remains available for
explicit leaf work outside this orchestration. Otherwise resolve the policy route:

```sh
uv run --quiet --no-project "<absolute-plugin-backend>/scripts/run_locked.py" adaptive-delivery-preflight route \
  --repo <absolute-repository> --host <codex|claude> --profile <profile> \
  [--route 'harness|provider|model|effort']
```

Pass `--route` only for an exact user override. Invalid or unreadable route
policy stops launch; do not fall back silently.

## 5. Bind intent-matched skills

Enumerate the exact authorized operations in the goal. For each operation whose
intent matches a host-advertised skill, record the exact advertised skill name
as a required capability binding. Common examples include ticket reads and
updates, TDD, commits, pull requests, and verification with its required review.

Readiness and necessary read-only input gathering are invoked by the parent
before launch. Preserve completed input evidence in the contract and bind any
needed refresh. Implementation, verification, and publication bindings are
invoked by the owner when due; assessment-provider bindings travel through
verification with the same authority and response boundary. A direct shell, Git, forge,
tracker, or generic-subagent call is not a substitute for a bound skill. If the
skill refuses or becomes unavailable, stop that operation without expanding
authority.

Before an operation becomes due, check the bound skill's public prerequisites,
effects, returned evidence and stop conditions against the goal. Advertised
intent alone does not prove behavioral compatibility. Accept differently named
compatible skills; resolve a known mismatch before mutation. Return a refusal
to the owner for an authorized next action, never bypass it through raw tools.

Invoking a bound skill or receiving a zero exit status proves neither that its
substantive contract was satisfied nor that a dependent operation is due.
Before invoking each dependent capability, validate its prerequisite results
against both the bound skill and the goal contract. In particular, the owner
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
matching advertised skill remains ordinary owner work unless the request,
repository, or selected gate requires that capability. Bind publication
operations only when each effect was explicitly authorized; completion never
adds commit, push, pull-request, merge, release, or deployment authority.

## 6. Compile one inline contract

For an existing candidate with assessment-before-change intent, begin the
execution sequence with current checks and bound verification of that unchanged
candidate. Classifier inspection cannot supply its independent finding set or
authorize skipping that first assessment. Preserve this order even when the
needed edit is obvious; repairs following selected findings consume the shared
allowance and cannot be relabeled as free implementation.

Write a concise, self-contained contract containing:

- outcome and observable acceptance criteria;
- scope, non-goals, preserved work, permissions, and publication limits;
- the exact workflow identifier, its selected sequence, risk, profile, selected
  route, and any explicit budget;
- focused feedback checks and final-tree checks;
- readiness evidence or the reason it was omitted;
- verification selection, bound verification/review skills and selected assessments;
- the concrete shared repair maximum (2 unless explicitly overridden), its
  authority source, consumed attempts (0 unless already performed), remaining
  limits and closed history; finishing early never lowers the authorized maximum;
- every required capability binding and its prerequisite result evidence;
- the human-feedback and blocker rules below; and
- the completion evidence the owner must return.

Separate engineering intent from orchestration mechanics. Any request clause
that invokes adaptive-delivery, asks the parent to select a route, or asks it to
launch a separate owner is consumed by this preflight and launch. Do not copy
that clause into the engineering outcome, acceptance criteria, or workflow
sequence; the launched subagent must understand that it is already the owner.

Compile the remaining work from the caller-authorized entry point, preserving
explicit prerequisites and step ordering. Do not restart completed phases or
replace the caller's order with the selected workflow's default sequence.

Use these seven fields as a completeness template. Equivalent clear prose,
role wording, punctuation, and line wrapping are valid; this is not a shipped
host validator. Set `workflow` to exactly one
selected identifier: `fix-bug`, `implement-feature`, `change-feature`,
`refactor`, `migration`, or `mechanical`. Put the compact workflow steps in
`sequence`; keep the identifier distinct from the steps:

```text
Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-delivery or seek another owner.
Outcome: <bounded result>
Acceptance criteria: <observable outcomes and required implementation properties>
Scope and authority: included=<files and operations>; authorized=<local and external effects>; forbidden=<non-goals and excluded effects>; preserve=<user-owned state>
Execution: workflow=<exact workflow identifier>; sequence=<remaining workflow steps from the caller-authorized entry point, preserving explicit ordering and receipt of complete clear selected verification before any dependent commit/publication>; risk=<routine, elevated, or high>; profile=<selected profile>; route=<host|provider|model|effort>; capabilities=<operation -> exact advertised skill and prerequisite result evidence; or none>
Verification and gates: readiness=<evidence or omitted reason>; adaptation=<same owner reassesses material scope, acceptance, constraint, or authoritative-input changes; invalidated readiness assumptions require invoking readiness again and obtaining ready before affected implementation, even when feature scope stays the same; strengthen affected checks within authority>; verification=<bound verification skill, required review binding, selected assessments, or permitted omission>; repair=<maximum=2; source=default; consumed=0; substitute only an explicit finite override and its source or already-observed consumed attempts; apply strictest remaining invocation/time/token/authority limits; collect all selected results before combined repair; fresh closed follow-up after each attempt; clear ends repair; further attempts require material progress and budget; no reset>; focused=<feedback checks>; final=<final-tree checks>; feedback=<same owner receives complete user messages; required acknowledgement uses the complete answer and must succeed before mutation resumes; apply and verify every new constraint; when feedback requires using an existing component, call that component from the implementation; copying or inlining its algorithm does not reuse the component>; blockers=<semantic blocker and observe-before-retry rule>
Completion evidence: state whether complete, awaiting feedback, or blocked; include=<changed files, focused and final checks, readiness, combined verification conclusion and complete selected results, every material criterion's current evidence or gap, finding/target/repair history, consumed repair attempts and authorized maximum, publication effects, and remaining risks or blockers>
```

Feedback checks exercise the changed seam after coherent slices. Final-tree
checks are the applicable repository gate plus:

| Risk | Required final evidence |
| --- | --- |
| routine | focused evidence and scoped repository gate |
| elevated | routine evidence plus affected-caller or compatibility checks and one counterexample |
| high | elevated evidence plus an adversarial boundary or state-transition check and independent review |

Every required focused and final check must succeed against the applicable
current content before selected assessment and before any dependent commit or publication
effect. If one fails, repair within existing scope and authority and rerun the
invalidated checks. Otherwise stop before those dependent operations. Do not
consume a one-commit allowance with content whose required checks are failing.

Compile the verification handoff, not merely a link to its lifecycle reference:
candidate/repository/scope/base, originating criteria, constraints, successful
current checks and existing evidence; selected providers and complete results;
original findings with identities, provenance, severity and blocking/advisory
disposition, original/prior/current targets, attempted repairs, prior follow-ups
and carried direct regressions with their causing finding identities. The owner
waits for every selected result before repair and preserves this history in each
fresh follow-up, passing unchanged complete original and prior provider artifacts
by usable absolute reference instead of replacing them with summaries.
A provider pass cannot cover unassessed criteria. Stale, missing,
unchanged, oscillating, inconclusive or unavailable required evidence, exhausted
limits or missing authority stops completion and remaining publication. Advisories
remain visible and nonblocking. A new comprehensive assessment cannot reset the
budget or reopen the closed finding set beyond direct repair-caused regressions.

When a stable seam and independent oracle exist, behavior-changing workflows
add or update focused evidence before the production change and confirm the
expected failure. Repository-mandated cadence wins.

Compile this human-feedback rule: a material decision first discovered after
launch pauses repository and external mutation. The owner returns the smallest
complete question as its paused result; no lifecycle marker is required. The
parent relays the explicit answer verbatim to the same owner, with no lifecycle
marker or fixed display summary. The answer grants only explicitly supplied
authority. Preserve repository-specific acknowledgement prerequisites in the
owner contract. The owner must pass the complete received answer to that
acknowledgement without shortening it to a selected value, and require success
before any production edit, commit, or publication. A nonzero exit or rejection
keeps the gate closed: correct the invocation within authority or return the
blocker. Knowing the chosen behavior does not authorize bypassing the gate.
Never choose a default or launch a replacement owner.

Compile this blocker rule: when work cannot proceed without an external state
change, return `Status: blocked` with the specific blocker, current evidence,
and smallest next action. Before repeating an ambiguous external effect,
observe current state and never duplicate an effect that already completed. Do
not retry an unchanged deterministic failure without changed evidence or
conditions. There is no Darrow retry or waiver state machine.

Compile this adaptation rule: after a material scope, acceptance, constraint,
or authoritative-input change, the same owner pauses affected implementation
and reassesses affected assumptions and gates. It invokes bound readiness or
selects the necessary advertised readiness capability under the selection
rules above, even if initially omitted. Obtain required ready evidence before
resuming. Strengthen verification within existing authority; ask for missing
product decisions or expanded effects. A non-ready result returns to the same
owner, which may investigate within authority. The parent never repeats preflight.

Compile this steering rule: forward unambiguous corrections, constraints,
cancellation, and status requests to the retained owner even without a pending
question. Apply restrictions before the next affected action.
Add each correction or constraint to the remaining acceptance checks and verify
it before completion. An implementation constraint requires the specified
implementation property; equivalent output alone does not satisfy it.
When feedback requires using an existing component, call that component from
the implementation. Keep one source of behavior: copying or inlining its
algorithm does not reuse the component.
Cancellation stops further work and reports effects already performed; status alone does
not cancel. Report unavailable live delivery or stopping controls honestly.
Do not reinterpret a status request or restriction as new scope or publication
authority, and never launch a replacement owner to deliver feedback.

The owner result must clearly state whether the outcome is complete, awaiting
feedback, or blocked; `Status: complete` and `Status: blocked` are examples. It must
state changed files, focused and final checks, readiness and the combined
verification conclusion when selected, complete assessment evidence and criterion
coverage, consumed repair attempts and their authorized maximum, performed
publication effects, and remaining risks. The maximum must match the authorized
contract: one successful repair
under the default is 1 of 2, not a one-attempt allowance or an exhausted 1/1 budget.
Workflow, risk, profile, and route are already established at launch and need
not be echoed. No other canonical serialization is required.

The complete launch task begins with the exact owner marker, followed by an
explicit sole-owner role instruction. For example:

```text
- phase: adaptive-delivery-owner
Role: You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-delivery or seek another owner.
```

Put the complete contract inline after that marker. Do not use an objective
file, hash, lifecycle ledger, or nested goal. If the complete contract cannot
fit the host task input without dropping a requirement, return
`Status: launch_required` and explain that boundary.

## 7. Launch exactly one separate owner

Read exactly one host guide completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

On a continuation turn, apply that guide's feedback fast path before any other
action.

The separate route-selected subagent is the sole Darrow work owner. The
accepted Codex launch carries its concrete route. On Claude, the resolver
validates the scoped agent's model and effort frontmatter and rejects
higher-priority environment overrides; launch without a per-call model
override and explicitly include `run_in_background: false` in the Agent input,
even when foreground execution is the host default. Do not launch in the current thread, create another goal inside the
owner, inspect child work, start a nested host process, retry with another
route, or replace an accepted owner.

After acceptance, the parent performs no repository or external work. It may
only wait, relay user feedback or request status from the same owner, or stop that owner after
explicit abandonment or supersession.

When the foreground owner returns, apply section 8 before responding. Final
inspection and verification belong to the owner; even a read-only repository
confirmation of its report crosses this boundary. Obtain missing or
contradictory status evidence from the same owner through the host's continuation
control. If that control is unavailable, report the evidence gap without claiming
completion.

For every message-based relay after acceptance, preserve every instruction and
constraint from the current user message. Do not summarize or paraphrase in a
way that drops, weakens, broadens, or converts an implementation property into
equivalent output behavior. Keep the retained-owner target and transport
metadata separate from the feedback content.

If launch is unavailable or rejected, preserve the product tree and return:

```text
Status: launch_required
Reason: <specific unavailable boundary>
Selected route: <provider/model/effort>
```

## 8. Relay the owner result

Return the owner's result without reconstructing repository facts or running
checks in the parent. Preserve complete readiness and combined verification
results, selected assessment evidence, consumed repair attempts and their
authorized maximum, and every
authorized publication effect. A blocked or feedback-pending owner remains the
same owner for a later same-thread answer when the host supports continuation.

Before claiming completion, compare the returned repair maximum with the
maximum and authority source retained at launch, and require the consumed count.
For example, a default allowance remains two when the owner used one; a report
of a sole repair allowance or 1/1 contradicts that contract. Request corrected
accounting from the same owner and wait for its amended status before relaying
completion. This is a status correction using existing evidence: it authorizes
no further repair, assessment, check, or publication and never resets the budget.

Do not shorten away selected gate outcomes, repair accounting, or performed
effects. If the owner omits other required completion evidence, request that
missing status evidence from the same owner before claiming completion; do not
inspect the tree yourself or invent the missing outcome. This request adds no
work or publication authority.

Completion adds no authority. No fixed closing disclaimer is required.
