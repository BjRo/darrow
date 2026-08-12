# Capability: Implementation Readiness Gate

Darrow should provide a read-only, model-invoked capability that determines
whether authoritative inputs are sufficient for implementation to begin
without inventing product intent, making an unauthorized architectural choice,
or guessing how success will be judged.

Plugin: `darrow-readiness-gate`  
Skill: `assess-implementation-readiness`

## Why

Tickets, specifications, plans, and conversational requests vary greatly in
format and detail. Formatting quality is not the useful gate: a short request
can be ready, while a detailed ticket can still conceal an unresolved product
decision or an unobservable definition of success.

A shared readiness contract lets humans, discovery and planning capabilities,
and explicitly invoked orchestration use the same boundary without placing
planning inside `adaptive-goal` or hard-coding a tracker or sibling plugin.

## Intent

Use the capability when the user asks whether a ticket, specification, plan,
or other authoritative request is ready for implementation, or when an
explicit larger goal contract requires an implementation-readiness gate before
mutation.

Do not select it merely because the user asks to implement a change. Ordinary
implementation intent remains implementation unless the user, an accepted
workflow, or an enclosing goal contract explicitly requests the gate.

## Readiness definition

An input is `ready` when an implementation agent can proceed without:

- inventing product behavior or scope;
- selecting among material product or architectural alternatives without
  authority;
- guessing which observable evidence would demonstrate success; or
- relying on an unavailable required dependency, permission, or source.

Readiness does not require a formal ticket, a written implementation plan,
predetermined files, exhaustive tactical steps, or identical detail for a
mechanical documentation edit and a cross-component migration.

## Inputs

The assessment may use:

- the authoritative request supplied in the conversation;
- a ticket, specification, plan, or decision record identified by the user;
- applicable repository instructions and accepted decisions;
- focused existing behavior or test surfaces needed to interpret the request;
  and
- known dependency and permission evidence relevant to feasibility.

The capability does not locate or clone repositories, assume a particular
ticket provider, or treat an unverified summary as authoritative. When several
sources disagree, it reports the contradiction instead of silently choosing
one.

## Assessment

Assess only the dimensions that could prevent implementation from starting:

1. the desired outcome and its observable acceptance criteria;
2. scope bounded enough to avoid inventing adjacent behavior;
3. unresolved product or architectural choices;
4. contradictions among authoritative inputs, repository rules, and relevant
   existing behavior;
5. required external dependencies and permissions; and
6. a concrete, inspectable quality bar with a feasible verification method.

A quality bar names the claim, an independent oracle or reference, and how the
implementation can be checked. Applicable repository checks may contribute to
the bar but generic statements such as “tests pass” or “high quality” do not
replace observable acceptance evidence. Mechanical and documentation work may
use exact transformation constraints and deterministic checks without
inventing a behavioral test.

## Verdicts

Return exactly one primary verdict based on the next action that must occur
before implementation:

- `ready` — no blocking readiness gap remains;
- `needs-discovery` — a bounded investigation can establish a missing fact,
  current behavior, constraint, or quality bar;
- `needs-decision` — the relevant evidence is available, but an authorized
  party must select among material alternatives or approve a consequential
  choice; or
- `blocked` — an authoritative input, repository, required dependency, or
  permission is unavailable or contradictory and no permitted discovery or
  decision can currently unblock the assessment.

When several findings exist, choose the verdict for the action that must occur
first and preserve the remaining gaps in `findings`. Request only the smallest
next action needed to make progress.

For mixed gaps, `blocked` comes first when an unavailable prerequisite would
still prevent implementation after every currently possible discovery or
decision. Otherwise `needs-discovery` comes first when its result defines or
can eliminate a later choice, followed by `needs-decision` for remaining
independent material alternatives.

## Result contract

Produce one semantic readiness result with these fields:

- `verdict`;
- `basis`;
- `quality_bar`;
- `findings`; and
- `required_next_action`.

The result contract is serialization-neutral. Every presentation identifies
the same field meanings and enum values. The default standalone presentation
is concise human-readable Markdown with an explicit verdict, basis, quality
bar, findings, and required next action. Every material observation belongs in
one of those sections. A consumer applies the field semantics rather than
depending on punctuation, heading depth, or another provider-specific
serialization detail.

When the caller explicitly requests JSON for an automated consumer, or an
enclosing contract explicitly requires the versioned JSON representation,
serialize the result as one object conforming to
`darrow-implementation-readiness-v1`:

```json
{
  "format": "darrow-implementation-readiness-v1",
  "verdict": "ready | needs-discovery | needs-decision | blocked",
  "basis": [
    {
      "source": "authoritative source or repository evidence",
      "authority": "authoritative | repository | supporting",
      "status": "available | missing | contradictory",
      "summary": "what this source establishes"
    }
  ],
  "quality_bar": [
    {
      "criterion": "observable claim",
      "oracle": "independent expected value or reference",
      "verification": "feasible check or evidence"
    }
  ],
  "findings": [
    {
      "type": "missing-information | unresolved-decision | contradiction | dependency | permission | quality-bar-gap",
      "summary": "concise readiness finding",
      "evidence": ["source-backed evidence"]
    }
  ],
  "required_next_action": {
    "type": "none | discovery | decision | unblock",
    "description": "smallest next action"
  }
}
```

`ready` requires at least one concrete quality-bar item, no readiness findings,
and `required_next_action.type` equal to `none`. Every other verdict requires
at least one finding and the corresponding non-`none` next-action type.

The v1 JSON representation uses exactly the fields shown above, including the
literal `format` value. In standalone JSON mode, the semantic payload is
exactly one object. A host may present it as raw JSON or within one `json` code
fence and may add non-normative presentation text, but it must not emit another
JSON object. Consumers ignore presentation text and extract the single object
as the authoritative serialized result. An automated caller that requires a
raw typed value rather than extractable JSON must enforce the schema at its
host launcher or API boundary; skill instructions alone do not create that
typed channel.

Composition alone does not select JSON mode. Do not infer a machine consumer
from an explicit readiness clause, an autonomous goal, or the possibility that
another model will read the result. Without an explicit JSON requirement, use
the default human-readable presentation and preserve its complete semantic
content.

## Goal-contract composition

An explicitly invoked orchestration recipe may place this gate inside its goal
contract. The goal owner applies the capability before any repository or
external mutation:

```text
Before mutation, assess implementation readiness through an available
capability matching that intent. Continue only on `ready`. Otherwise stop and
preserve the complete readiness result and smallest next action in the final
response.
```

A non-ready verdict terminates the enclosing implementation goal before
mutation. The goal owner preserves the complete readiness result in the
selected presentation and may append records its own contract requires. A
ready verdict returns the `ready` verdict and concrete `quality_bar` to that
goal owner as gate evidence before returning control, after which the goal's
separately authorized effects may continue. The enclosing goal, not the
readiness capability, owns any terminal reporting after continuation.
Readiness grants no implementation, publication, ticket-update, or other
mutation authority.

Neither `adaptive-goal` nor another consumer needs built-in knowledge of this
plugin. Consumers compose it through host-visible intent and the public result
contract, and must stop honestly when the required compatible capability is
unavailable.

## Invariants

1. **IRG-C1 — Explicit gate intent.** The skill is selected for explicit
   readiness-assessment intent or an explicit readiness clause in a larger
   goal contract, not for ordinary implementation intent alone.
2. **IRG-C2 — Source authority.** The assessment identifies its basis, does not
   assume a tracker, and never silently resolves contradictory authoritative
   inputs.
3. **IRG-C3 — Concrete quality bar.** `ready` requires an inspectable claim,
   independent oracle or reference, and feasible verification method.
4. **IRG-C4 — Actionable verdict.** The four verdicts retain their defined
   meaning, and the primary verdict follows the first action required before
   implementation.
5. **IRG-C5 — Smallest next action.** A non-ready result names the smallest
   discovery, decision, or unblock action rather than manufacturing intent or
   expanding into a plan.
6. **IRG-C6 — Proportional detail.** The gate does not require formal plans,
   predetermined files, or migration-level detail for a bounded mechanical
   change.
7. **IRG-C7 — Read-only authority.** Assessment does not edit files, create a
   branch, update a ticket, implement, commit, push, open a pull request,
   release, deploy, or perform unrelated external mutation.
8. **IRG-C8 — Composable stop.** Inside an enclosing goal, a non-ready verdict
   stops before mutation; a ready verdict returns control without adding
   authority.
9. **IRG-C9 — Explicit output negotiation.** The default result is
   human-readable and preserves every semantic field. The v1 JSON
   representation is used only when the caller or enclosing contract
   explicitly requires JSON; composition alone never selects it.

## Packaging and portability

1. **IRG-P1 — Independent plugin.** `darrow-readiness-gate` is independently
   installable and does not reference or require a sibling plugin.
2. **IRG-P2 — Model invocation.** Discovery metadata distinguishes readiness
   assessment from implementation, planning, discovery, ticket maintenance,
   and code review.
3. **IRG-P3 — Host-portable result.** Claude Code and Codex receive the same
   field meanings and verdict semantics in the default human-readable result;
   both may produce the same versioned JSON representation when it is
   explicitly requested.
4. **IRG-P4 — Judgment stays contextual.** The capability uses model judgment
   for authority, ambiguity, scope, and quality bars; it does not reduce the
   assessment to keyword or field-presence checks.

## Evaluation requirements

1. **IRG-E1 — Intent boundaries.** Direct and indirect readiness requests and
   explicit goal-contract gates select the skill; ordinary implementation
   requests do not.
2. **IRG-E2 — Verdict discrimination.** Fixtures independently exercise all
   four verdicts and mixtures where the first required action determines the
   primary verdict.
3. **IRG-E3 — Quality-bar strength.** A detailed request with only generic
   “tests pass” language is not ready, while a concise request with concrete
   observable acceptance and verification can be ready.
4. **IRG-E4 — Proportionality.** A clear mechanical change is not rejected for
   lacking a formal ticket, plan, or predetermined file list.
5. **IRG-E5 — Read-only safety.** Standalone assessment and every non-ready
   composed goal leave repository and external state unchanged, including
   under pressure to rubber-stamp readiness.
6. **IRG-E6 — Composition.** A ready composed goal may continue under its
   existing authority, while a non-ready composed goal stops before mutation.
7. **IRG-E7 — Cross-harness behavior.** Fresh Claude Code and Codex contexts
   produce compatible verdict and result semantics.
8. **IRG-E8 — Comparative value.** Matched no-skill and candidate trials record
   verdict accuracy, false-ready rate, false-not-ready rate, tokens, and wall
   time without claiming advantage from an unmatched run.
9. **IRG-E9 — Output negotiation.** Default standalone results and non-ready
   composed terminal results return the complete human-readable semantic
   result without a v1 JSON object. A ready composed gate returns its `ready`
   verdict and concrete `quality_bar` to its goal owner before continuation;
   later terminal reporting belongs to the enclosing goal's contract. Distinct
   explicit-machine requests exercise ready and non-ready schema-valid v1
   objects without changing verdict semantics.

## Non-goals

- Improving ticket prose, enforcing a ticket template, or managing a tracker.
- Performing product discovery, architecture decisions, or implementation
  planning.
- Implementing, reviewing, committing, publishing, releasing, or deploying a
  change.
- Requiring adaptive-goal or embedding readiness policy inside it.
- Persisting workflow state or creating `.darrow` artifacts.
