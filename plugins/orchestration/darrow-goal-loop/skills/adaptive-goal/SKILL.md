---
name: adaptive-goal
description: Compile one bounded engineering request and activate it as a host-native goal with a proportionate workflow, risk gate, model, and effort. Use when the user explicitly requests adaptive goal orchestration or an already explicitly invoked orchestration delegates one bounded request; do not select merely because ordinary work is complex or long-running.
---

# Adaptive Goal Loop

Compile the request, activate one host-native goal owner, and let the host own
the loop.

## Confirm invocation authority

Start only when the context establishes either entry condition:

- the user explicitly invoked adaptive goal orchestration; or
- an orchestration entrypoint the user explicitly invoked delegates one bounded
  request and preserves the originating request and permissions.

Delegation adds no authority; preserve the originating scope, permissions,
publication, and safety boundaries. Complexity, duration, and ordinary
engineering intent do not authorize orchestration. Without either condition,
run no helper and leave the worktree unchanged. Return exactly:

```text
format: darrow-adaptive-goal-authority-stop-v1
status: invocation_required
reason: explicit-orchestration-entrypoint-required
```

### Enforce read-only preflight

Keep preflight read-only until exactly one goal owner is active on a verified
route. Inspection may identify applicable checks but MUST NOT execute a test,
build, typecheck, lint, review, or verification command. Compile imperative
implementation and check requests for the owner; they do not authorize work in
the classifier turn.

Use one `goal-loop step` ledger for every interactive run, including small
tasks. Record preparation, route selection, materialization, activation,
selected readiness and review evidence, cleanup, and terminal reporting in its
required order. Before activation, prove every selected readiness or review
capability is host-advertised and matches its intent; generic delegation is not
capability evidence. On an unavailable capability or boundary, or any rejected
ledger transition, preserve the product tree and follow the host guide's
`launch_required` stop. The ledger validates evidence without scheduling work;
the host guide owns literal mechanics.

## 1. Prepare without writing

Resolve the repository and bundled helper to absolute paths, substitute them
literally, then start one run:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step start --repo <absolute-repo> --host <codex|claude>
```

Retain the exact absolute `ledger` and `staging_dir` returned by that command.
Prepare through the ledger:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step prepare --ledger <absolute-ledger>
```

Use the prepared repository state, instruction routes, profile mappings,
workflow paths, and risk gates as evidence. Inspect additional repository files
only when a material decision, unsafe overlap, or verification command remains
unknown. Keep product files unchanged and treat recorded local changes as
user-owned.

Turn the request into observable completion criteria without choosing missing
product behavior. If behavior, authority, destructive scope, or a safety policy
is materially missing, select `decision-gated`, read its workflow document,
record it, and render the stop through the helper:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step route --ledger <absolute-ledger> \
  --workflow decision-gated --risk high --profile none \
  --verification-gate not-applicable --readiness omitted --review omitted
/bin/bash <absolute-plugin-bin>/goal-loop step report --ledger <absolute-ledger> \
  --status launch-required --human-interruptions 1
```

Name the smallest missing decision and do not activate implementation work.

## 2. Compile workflow, risk, and route

<!-- intent-routing-begin -->
### Select exactly one workflow and one risk

- [`fix-bug`](references/workflows/fix-bug.md): existing promised behavior is
  incorrect.
- [`implement-feature`](references/workflows/implement-feature.md): new
  observable behavior does not exist.
- [`change-feature`](references/workflows/change-feature.md): approved existing
  behavior intentionally changes.
- [`refactor`](references/workflows/refactor.md): observable behavior must
  remain unchanged.
- [`migration`](references/workflows/migration.md): consumers or formats require
  a sequenced transition.
- [`mechanical`](references/workflows/mechanical.md): the request is an exact
  deterministic non-behavioral transformation with a complete oracle.
- [`decision-gated`](references/workflows/decision-gated.md): a required product
  choice or authority is missing.

Apply these tie-breakers in order:

1. `decision-gated` wins whenever implementation requires a missing choice or
   authority.
2. Choose `migration` over `change-feature` only when consumers, formats,
   coexistence, or rollout require a sequence; one approved behavior change is
   `change-feature`.
3. Choose `change-feature` over `fix-bug` when current behavior is intentional
   and the approved contract changes; choose `fix-bug` when current behavior
   violates an existing promise.
4. Choose `implement-feature` only when no equivalent behavior exists; altering
   or replacing an existing behavior is `change-feature`.
5. Choose `change-feature` over `mechanical` when an exact transformation still
   intentionally changes observable runtime behavior or an existing contract.
6. Choose `mechanical` over `refactor` only for an exact transformation with a
   complete oracle; restructuring that requires judgment is `refactor`.
7. `refactor` is valid only when observable behavior remains unchanged.

Select risk from consequences, taking the highest applicable level:

- `routine`: localized, reversible, and limited blast radius;
- `elevated`: compatibility concerns, multiple consumers, persisted formats,
  or meaningful operational impact;
- `high`: security or authorization boundaries, destructive or irreversible
  state, privacy or safety, or broad blast radius.

Changing an existing promised output for inputs callers may already use is a
compatibility concern. When the request requires compatibility evidence for
that contract change, select at least `elevated` even if the edit is localized.

Reasoning difficulty never changes risk. A difficult diagnosis can be
`routine`; a simple security change is `high`.

Select implementation readiness separately from workflow, risk, and review:

| Situation | Readiness selection |
| --- | --- |
| authoritative ticket, specification, plan, or accepted conversational plan not yet assessed for this exact scope | select |
| bounded request fully stated in the preserved conversation | omit by default |
| same scope already assessed semantically and every finding resolved | omit |
| material scope, acceptance, or constraint change where reassessment adds value | select again |
| explicit user request to skip the default gate | omit unless repository or delegating-orchestration policy requires it |
| explicit user, repository, or delegating-orchestration requirement | select |

“Already assessed” is semantic, not document-shaped. A preserved conversation
that walked every readiness finding and resolved it counts even if no formal
gate block was rendered. An accepted conversational plan is authoritative, but
the shaping discussion that produced and settled it normally also establishes
the prior same-scope assessment. Mere availability of a readiness capability
does not select it. Re-run only after a material scope, acceptance, or
constraint change and only when another assessment adds actual value. A user
may skip the default gate, but cannot override a repository or explicitly
delegated orchestration requirement.

The prepared classifier may know that an authoritative artifact exists without
opening its contents. That absence from prepared evidence is not itself a known
missing decision or authority. Select the task-level workflow from the stated
implementation intent and let a selected readiness capability assess the
artifact's completeness before mutation. Use `decision-gated` only when the
preserved request or prepared evidence actually establishes the missing choice
or authority.

Represent the decision with one unambiguous `Readiness gate: selected —` or
`Readiness gate: omitted —` line and a concise reason. When selected, name only
the capability intent—not a plugin implementation—and include the concrete
absolute bundled `goal-loop` executable solely for the required readiness
ledger transition. The owner invokes the available implementation-readiness
capability before repository or external mutation, requests its complete
human-readable result without requiring JSON, interprets the verdict
semantically as `ready`, `needs-discovery`, `needs-decision`, or `blocked`, and
records only that verdict:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step readiness \
  --ledger <absolute-ledger> \
  --verdict <ready|needs-discovery|needs-decision|blocked>
```

Only `ready` unlocks mutation. Every other verdict stops the goal without
mutation, preserves the complete readiness result and its smallest useful next
action, settles the native goal as blocked, and places the outer adaptive-goal
report after that result. The protocol ledger stores selection and verdict,
never the capability's complete result.

Select independent code review separately from implementation discipline:

| Situation | Independent review selection |
| --- | --- |
| `routine` risk | do not select automatically |
| `elevated` risk | select when compatibility, caller impact, or counterexample analysis needs independent judgment |
| `high` risk | select by default |
| any risk | select when repository policy or the user requires it |

A persisted-format coexistence transition that coordinates a writer, a
dual-format reader, a migration utility, and multiple consumers needs
independent compatibility judgment; select review under the elevated-risk rule.

When review is selected, the goal contract requests an available environment
capability matching this intent: independently review the exact current code
change. Do not name or assume a plugin implementation, command, or output
format. Before repository mutation, confirm that the environment exposes a
capability matching that intent. An ad hoc prompt, generic subagent,
same-context judgment, or capability created during the run is not availability
evidence. Stop honestly when no matching capability exists. A matching
capability may use fresh readers internally; native delegation alone cannot
satisfy this gate. An availability stop returns the evidence gap together with
the mandatory human-readable report.
Represent the decision in the compiled contract with one unambiguous line
beginning `Independent review: selected —` or
`Independent review: omitted —`, followed by the reason. High risk MUST use
`selected` unless an explicit stronger user or repository rule makes
implementation stop before activation.
For a filesystem-sharing delegated owner, include the concrete absolute
bundled `goal-loop` executable in that selected clause solely for the required
`step review` evidence calls against `Protocol ledger:`. Do not use that helper
reference to name or constrain the independent-review capability.

Classify reasoning demand independently from workflow and risk:

- `ordinary-localized`: the implementation is clear and localized;
- `scaled-coding`: straightforward work spans several files or components;
- `repo-wide-coding`: straightforward work requires repository-wide changes;
- `judgment`: the cause is unknown across multiple plausible layers or state
  transitions, or the task requires architecture, planning, or review
  judgment.

Select from the reasoning uncertainty established by the request and permitted
read-only preflight at activation time. An explicitly unresolved hard diagnosis
across multiple plausible layers or state transitions remains `judgment`; a
small eventual patch or a cause recognized after activation does not
retroactively downgrade it.

A sequenced transition spanning a producer or writer, compatibility reader,
migration utility, and multiple consumers is `scaled-coding`. Short individual
edits or a compact repository do not make that multi-component implementation
`ordinary-localized`.

Implementation size, reversibility, and consequence risk do not reduce a
`judgment` task to ordinary coding.

Compile feedback checks and final-tree checks separately in the goal contract.
Feedback checks are the smallest repository-supported commands that exercise
the changed seam, such as one test target, an affected-package typecheck, or a
narrow build or lint command. When the selected workflow adds acceptance or
regression evidence at a stable seam with an independent oracle, run that
evidence before the corresponding production change, confirm it fails for the
intended reason, and rerun it after each coherent slice. For
behavior-preserving work, start with passing focused evidence and keep it green
after each slice. Final-tree checks are the applicable scoped repository gate
plus the risk gate below; run them once after implementation and affected
callers or documentation appear complete, and rerun them only after later edits
invalidate that result. Do not use broad final-tree gates as routine
implementation feedback. Follow any different repository-mandated cadence, and
do not invent a seam, oracle, or command merely to imitate test-first work.
When the originating request explicitly says to add or update focused evidence,
include the applicable evidence file in `Scope:` and do not exclude it in
`Non-goals:`. Updating an existing expectation from the old behavior to the
explicitly requested new behavior is already authorized evidence work, not a
new material product decision.

Compile this human-feedback rule into every activated contract. A material
decision known during preflight still selects `decision-gated` and prevents
launch. When a material decision first emerges after activation, pause
repository and external mutation and ask only the smallest concrete question.
A current-thread owner asks the user directly. A delegated owner sends the
question to its creator; the creator surfaces it to the user and relays the
explicit answer to that same still-active owner. Pending feedback is neither
completion nor blockage while that relay remains available: do not close the
owner, launch a replacement, or choose a default. Resume only the authorized
work after the exact answer arrives; it grants no authority beyond what it
states. When the originating request explicitly authorizes one named external
answer-acquisition command, run that exact command only after the owner returns
the material question, treat its successful output as the explicit user answer,
and relay it without asking the caller the same question again. Do not infer an
answer from the command name or run any broader command. If the host cannot
relay feedback, preserve the active or resumable
goal state and return the question honestly without further mutation. Every
pause response begins with the exact marker `- phase: human-feedback-request`,
states the complete smallest question, and may include the full Section 4
human-readable report as a truthful current snapshot. The report is optional
and never continuation authority; the active owner and objective preserve that
state. Never return a bare marker or question. Count each
distinct question presented for user decision once in
`evaluation_human_interruptions`, including a question resolved during the same
run. After the answer returns, the same owner performs any acknowledgement
command or handshake required by the repository or compiled contract, using
the exact relayed answer, and confirms it succeeds before resuming mutation.
The creator obtains and relays the answer but never acknowledges on the owner's
behalf. For each resolved question, the owner's terminal result states that the
exact answer was applied on one line as
`Applied relayed decision: <exact answer>`. The creator preserves each such
line in the caller-facing completion. An optional Markdown bullet, inline code
around the answer, or terminal period is presentation only.

Apply the selected proportional risk gate:

| Risk | Required verification |
| --- | --- |
| `routine` | focused acceptance or characterization evidence plus the scoped repository gate |
| `elevated` | routine gates plus affected-caller or compatibility checks and one plausible counterexample |
| `high` | elevated gates plus an adversarial boundary or state-transition check and independent final-tree review |

For selected independent review, compile this continuation behavior into the
goal contract: invoke the matching capability after implementation and
applicable final-tree checks, supplying the exact final change, originating
objective or specification, repository standards, and current check evidence.
Treat a preexisting candidate described as review-ready as unverified: before
the initial comprehensive review, run every applicable exact-target check
required by the selected risk gate and supply that current evidence to the
review capability.
Its current content is the first review target. Do not edit it before that
review returns, even when a check fails or it already differs from the approved
final outcome; any authorized repair starts only from the review's closed
finding set.
Target preparation starts the review boundary. Finish only that capability
invocation and await its ordinary response before any other repository work;
do no repository work outside the capability invocation while it is pending.
Interpret the capability's ordinary response semantically. No blocking
findings in the initial comprehensive review satisfy the gate for that exact
content without adding authority. Otherwise that one comprehensive review
establishes the closed finding set for all rework and verification.

After each review capability returns, record its semantic result against the
exact target fingerprint:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step review --ledger <absolute-ledger> \
  --mode <comprehensive|verify> \
  <--target-fingerprint <literal-reviewer-target>|--target-sha256 <target-sha256>> \
  --outcome <semantic-outcome> [--finding <bounded-finding>]
```

Prefer `--target-fingerprint` when the review capability returns an exact
non-SHA target identifier; the helper derives the ledger SHA-256 internally.
Never reconstruct that hash with a shell variable, assignment, substitution,
command list, redirect, or pipeline.
The helper permits one comprehensive review, rejects verification before that
review, and rejects every repeated target fingerprint. These checks validate
protocol evidence only; they do not choose findings, repairs, or whether
material progress exists.

Make the caller-facing outcome explicit: report a clear initial result as the
standalone canonical sentence `Independent review: clear.` It may occupy its
own Markdown bullet, and balanced strong emphasis may surround the label or the
entire exact sentence, but it must otherwise be its own unquoted line; do not embed it in another
clause. Prose paraphrases, negated framing, quotations, and qualified or
ambiguous continuations are not outcomes. An initial blocking result that
cannot be repaired is `Independent review: blocking — <finding>` on its own
line. After repair, preserve
`Initial independent review: blocking — <finding>` and report the exact-target
result as the standalone sentence
`Fix verification: <clear|continue|no_progress|blocked|unavailable|inconclusive>.`
Do not rely on nearby
prose or a provider-specific serialization to imply these outcomes. Supporting
detail belongs on another line; the canonical outcome sentence has no suffix.
Preserve the verifier's returned outcome verbatim even when an explicit limit
converts the overall review gate to `blocked`. Do not rewrite `continue` as
`blocked`; report the overall stop in the separate review-gate sentence.
An initial `unavailable`, `inconclusive`, or otherwise terminal unsatisfied
review result does not replace the outer launch result. Before returning, append
the complete Section 4 human-readable report with the truthful blocked
review-gate state and counters.

First rework attempts every eligible finding together. Eligibility requires
existing repair authority, clear originating scope, low risk, no expansion of
requested behavior, and no material expansion of verification. Attempt every
eligible blocker and advisory. Record an ineligible blocker as blocked; retain
an ineligible advisory only as a non-gating residual risk.

One rework performs at most one authorized repair attempt per finding. After
that attempt, run the invalidated checks and request fix verification; never
self-iterate on the same finding before that response. A second attempt belongs
to a later rework and is available only when verification returns `continue`
and existing authority covers it.

After each rework, rerun invalidated checks and ask the same matching capability
to fix-verify only the attempted original findings and direct repair-caused
regressions. Supply the original findings and target, canonical finding order,
prior and current targets, prior target history, the prior scope manifest, the
immediately prior verification artifact with its checksum and carried
regressions when one exists, and current check evidence. The review capability
pins the prior-to-current repair delta mechanically against the prior scope's
same effective base; caller prose does not establish causality. Targeted verification cannot introduce an unrelated finding. It
reports `clear`, `continue`, `no_progress`, `blocked`, `unavailable`, or
`inconclusive`.

Check evidence established after the latest content edit and supplied to fix
verification remains final-tree evidence for that exact content. The review
response does not itself invalidate those checks. If that response reaches an
explicit limit or another terminal stop without authorizing a later edit, do
not rerun a check after the response. With selected review, run the last
final-tree check for an exact target before its review invocation. Never call a
post-review check final verification; it is forbidden after a terminal
response.

`clear` satisfies the exact-content gate. Continue only while an unresolved
blocker or repair-caused regression materially progresses. Later rework fixes
only unresolved blockers and repair-caused regressions. A direct regression
first detected by verification is progressing for one repair attempt; unchanged
evidence after that attempt is no progress. Advisories never keep the gate open.
When `continue` names an unresolved blocker or direct regression and existing
authority covers its concrete repair, perform that later rework, rerun the
invalidated checks, and request fix verification again. Do not treat
`continue`, the first appearance of a direct regression, or the mere existence
of an earlier repair round as a stop condition.
Repeated targets, unchanged failure evidence, or oscillation to an earlier
target is `no_progress`. `no_progress`, `blocked`, unavailable or inconclusive
evidence, exhausted authority, or an explicit review limit stops with the
unsatisfied gate and permits no further repair or publication.

Before every fix-verification invocation after the first, compare the
prospective current target fingerprint with the complete prior target history.
A verifier-requested later repair that would restore exact content already in
that history stops before editing the current target or rerunning its checks.
A repeated or earlier fingerprint stops as `no_progress` before invoking the
capability; never make the redundant verification call. Because that stop has
no new verifier response, preserve the latest returned standalone
`Fix verification: continue.` line and report the repeated-target or
oscillation `no_progress` stop separately. Never synthesize
`Fix verification: no_progress.` unless the capability actually returned that
outcome.

There is no default numeric review limit. If the originating request explicitly
supplies one, preserve it as a hard cap on all capability invocations including
the initial comprehensive review; reaching it stops even otherwise-progressing
convergence. It grants no authority and never permits completion without clear
exact-target evidence. A terminal stop caused by that limit reports the
standalone canonical sentence `Review gate: blocked — explicit limit reached.`
Any later content-changing edit invalidates the chain.

When the host persists native-goal status, settle every terminal unsatisfied
review stop as `blocked` before returning. If the host requires a repeated
blocker audit, do not count review invocations as goal turns. Any required
automatic continuation is status settlement only: preserve the same gate,
perform no repository inspection, edit, check, review, or publication, and
mark the goal `blocked` as soon as the host permits it.
<!-- intent-routing-end -->

Read the selected workflow document completely and use only its sequence; small
size does not make work mechanical. Map reasoning demand to profile
independently of risk:

| Demand | Profile |
| --- | --- |
| clear localized or exact mechanical work | `routine` |
| localized work with materially competing implementations or an explicit first-pass boundary-correctness priority | `routine-plus` |
| `scaled-coding` | `scaled` |
| `repo-wide-coding` | `repo-wide` |
| `judgment` | `judgment` |

Risk and added verification never justify `routine-plus` by themselves.

An explicit user model or effort wins. Resolve the concrete route:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step route --ledger <absolute-ledger> \
  --workflow <workflow> --risk <routine|elevated|high> \
  --profile <routine|routine-plus|scaled|repo-wide|judgment> \
  --verification-gate <routine|elevated|high> \
  --readiness <selected|omitted> \
  --review <selected|omitted> \
  [--review-round-limit <positive-integer>] \
  [--route 'harness|provider|model|effort']
```

Pass `--route` and `--review-round-limit` only for exact originating user
overrides. The helper validates the risk gate, readiness selection, high-risk
review, decision-gated tuple, and live catalog membership; metadata values and
aliases such as `inherit`, `current`, or `default` are not overrides.

Resolve policy from the active worktree's `.darrow/config.json`. Missing or
empty `routes` uses bundled policy; valid repository entries replace matching
host/profile routes and other profiles remain bundled. Validate the whole file
and every owned route, ignore the sibling `reviewers` semantics, and stop on an
error. Preserve `policy|user` authority and `repository|bundled` provenance.

Write every contract component once with these exact nonempty one-line labels,
in order: `Outcome:`, `Acceptance criteria:`, `Scope:`, `Non-goals:`,
`Preserved work:`, `Permissions:`, `Workflow sequence:`, `Feedback checks:`,
`Final-tree checks:`, `Readiness gate:`, `Independent review:`, `Stopping
budget:`, `Human feedback:`, and `Completion report:`. End with `Protocol
ledger: <absolute-ledger>`. Include the selected dimensions and route, workflow
sequence, risk gate, feedback/final checks, portable readiness and review
clauses, explicit budgets, the marked human-feedback rule, reporting rule, and
preserved authority. Use `none` with a reason for absent optional values.

For filesystem-sharing delegated owners, selected readiness and review clauses
name the absolute `goal-loop` executable only for their ledger evidence calls,
never as the capability implementation. Put boundary-specific ownership rules
from the selected host guide into the contract before materialization. Refer to
repository facts by path and target 4,000 bytes without dropping requirements;
use a verified file-backed objective when larger.

Include publication effects only when each was explicitly authorized and host
policy still permits it. Selected review blocks remaining publication after a
non-clear result or later content change; clear review adds no authority.

## 3. Activate exactly one host-native goal owner

When an enclosing host API requests a preflight handoff, do not edit product
files, call `create_goal`, or launch a nested session in the classifier turn.
Read [`references/handoff.md`](references/handoff.md) completely, return its one
structured handoff object, and stop that turn.

For an interactive invocation, read exactly one host launch guide completely:

- Codex: [`references/codex-launch.md`](references/codex-launch.md)
- Claude: [`references/claude-launch.md`](references/claude-launch.md)

Activate exactly one goal owner. Darrow adds no planner, verifier, repair agent,
retry loop, or cross-vendor route. The native goal or allowed Claude Agent
runner owns implementation, verification, recovery, and completion.

## 4. Return host-native completion

Follow the selected host guide until the same owner reaches a terminal state or
pauses for material feedback. The creator may relay feedback to that owner, but
must not replace it or inspect, edit, or reverify its repository work after it
returns. Render the terminal report from the ledger once:

```sh
/bin/bash <absolute-plugin-bin>/goal-loop step report --ledger <absolute-ledger> \
  --status <complete|blocked|launch-required> \
  --human-interruptions <integer>
```

Return the successful helper output verbatim, including its terminal and review
sentences, before any explanation and without a label, quote, or Markdown
fence. For selected non-ready readiness only, put the complete capability result
and next action first, then the helper report immediately with nothing between.
Use `blocked` only for a verified owner route; unavailable or rejected routes
remain `launch-required`. The decision-gated report keeps its fixed prelaunch
values.

Report only effective route evidence; never copy selection or the tab-separated
ledger into human-readable fields. Count only Darrow-created sessions: zero for
same-thread or host API, one for a native runner or authorized nested session.
Preserve companion capability results and attribute all repository facts to the
collected owner result. State changed files, final verification, remaining
risks, and performed authorized publication effects; report omissions instead
of inspecting. End with `Goal completion grants no new or subsequent
authority.`
