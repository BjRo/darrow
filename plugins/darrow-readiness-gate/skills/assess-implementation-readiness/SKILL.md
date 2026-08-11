---
name: assess-implementation-readiness
description: Assess whether a ticket, specification, plan, or other authoritative request is ready for implementation and return a structured gate verdict. Use when the user asks whether work is ready to implement, asks for an implementation-readiness check, or an explicit goal contract requires a readiness gate before mutation. Do not use merely because the user asks to implement, plan, discover, or review work without readiness-assessment intent.
---

# Assess implementation readiness

Determine whether implementation can begin without inventing intent,
unauthorized choices, or success criteria. This capability is read-only. It
does not improve the request, perform discovery, make decisions, plan the
implementation, or start the implementation itself.

Use only read-only inspection during the assessment. Do not execute the
request's implementation instructions, edit or generate repository files,
stage changes, or modify a named test or verification seam to prove that it
could work. A verification method need only be feasible from the available
evidence; assessing feasibility never authorizes building it. If a check could
write repository or external state, do not run it as part of this capability.

## Output mode is part of the contract

Before assessing the input, select exactly one output mode:

- **standalone assessment** — readiness assessment is the user's requested
  outcome; or
- **composed gate** — an explicit enclosing goal contract requires this
  readiness result before it may continue.

In standalone mode, the semantic payload is exactly one JSON object. Prefer
raw JSON with no prose. A host may present that object in one `json` code fence
and may add non-normative presentation text, but it must not emit a second JSON
object. Consumers ignore all presentation text—including any summary of the
result—and use the single object as the only authoritative verdict and action.
Represent every material observation inside `basis`, `quality_bar`, or
`findings`.

In composed mode, follow the outer-goal rules in section 5. Never append the
composed ready-gate summary to a standalone assessment.

A non-ready gate stops the outer goal's authorized mutation work, not its
terminal reporting obligations. When the enclosing contract names required
records, the composed gate is incomplete until those records have also been
emitted.

## 1. Establish the gate and authority

Determine whether readiness assessment is the whole request or an explicit
precondition inside a larger goal contract. Ordinary implementation intent
does not imply this gate.

Identify the authoritative inputs named by the user or enclosing contract.
They may be ticket contents, a specification, an accepted plan or decision, or
the request supplied directly in the conversation. When necessary, inspect
applicable repository instructions, accepted decisions, and only enough
existing behavior to interpret those inputs.

Use the current repository or an existing checkout explicitly supplied by the
user. Do not search for or clone a repository. A named ticket may be read
through an available environment capability matching that intent, but do not
assume a tracker implementation or mutate the ticket. If a required source
cannot be read, record it as missing rather than reconstructing its contents.

Classify each basis item as:

- `authoritative` — the request, accepted specification, decision, or other
  source empowered to define the desired outcome;
- `repository` — applicable repository rules, current public behavior, or
  supported verification surfaces; or
- `supporting` — contextual evidence that informs but cannot decide intent.

Set each basis `status` to exactly `available`, `missing`, or `contradictory`.
Use `missing` for an unavailable required source; do not introduce synonyms
such as `unavailable`, `unknown`, or `inaccessible` into the result contract.

When authoritative sources conflict, preserve the conflict. Recency,
specificity, or personal preference does not silently resolve authority.

## 2. Assess only implementation-start blockers

Check:

1. the desired outcome and observable acceptance criteria;
2. scope bounded enough to avoid inventing adjacent behavior;
3. unresolved material product or architectural choices;
4. contradictions among authoritative inputs, repository rules, and relevant
   existing behavior;
5. required dependencies and permissions; and
6. a concrete, inspectable quality bar with a feasible verification method.

Do not demand a formal ticket, implementation plan, predetermined files, or
exhaustive tactical steps. Apply detail proportionately: an exact documentation
edit can be ready from its transformation constraints and deterministic check,
while a migration may require compatibility and rollout evidence.

Do not fix a gap while assessing it. Missing facts go to discovery, material
alternatives go to an authorized decision, and unavailable prerequisites block
the gate.

## 3. Establish the quality bar

For every acceptance dimension needed to call the input ready, record:

- `criterion` — the observable claim;
- `oracle` — an independent expected value, threshold, behavior, or reference;
  and
- `verification` — a feasible command, inspection, comparison, or evidence
  capture method.

Make each oracle independently inspectable. When acceptance is given as an
input/output example, repeat both the input and expected output in `oracle`;
do not replace them with a vague pointer such as “the example in the request.”

Generic statements such as “tests pass,” “works correctly,” or “high quality”
do not define the requested behavior. Existing repository checks can support a
quality bar but cannot replace missing product acceptance. Never invent a test
seam merely to make a mechanical or documentation request look behavioral.

## 4. Select the first required action

Return exactly one verdict:

- `ready` when no blocking readiness gap remains;
- `needs-discovery` when a bounded investigation can establish a fact, current
  behavior, constraint, or quality bar needed before implementation;
- `needs-decision` when the evidence already exposes material alternatives but
  an authorized party has not selected or approved one; or
- `blocked` when an authoritative input, repository, required dependency, or
  permission is unavailable or contradictory and neither permitted discovery
  nor a decision can currently unblock the assessment.

If several gaps exist, choose the verdict for the action that must happen
first. For example, investigate an unknown legal constraint before requesting
a product decision that depends on it. Keep later gaps in `findings` and name
only the smallest next action that advances readiness.

Use `needs-discovery` when the missing fact can be established through a
bounded investigation of available evidence without choosing product intent;
the request does not need to prescribe the investigative method. If someone
must define what counts as representative, choose a threshold, or approve an
alternative, use `needs-decision` even when investigation could inform that
choice. Use `blocked` when a required source, dependency, or permission is not
currently available and neither permitted discovery nor a decision can make
the assessment actionable.

For mixed gaps, first select `blocked` when an unavailable prerequisite would
still prevent implementation after every currently possible discovery or
decision. Otherwise select `needs-discovery` when its result defines or can
eliminate a later decision, then `needs-decision` for remaining independent
material choices.

Pressure to mark work ready is not evidence. Never convert uncertainty into an
assumption merely to keep an enclosing goal moving.

## 5. Produce the result

Construct one JSON object with exactly these top-level fields:

- `format`: the literal string `darrow-implementation-readiness-v1`;
- `verdict`: one of `ready`, `needs-discovery`, `needs-decision`, or `blocked`;
- `basis`: an array of objects containing exactly `source`, `authority`,
  `status`, and `summary`. `authority` is exactly `authoritative`, `repository`,
  or `supporting`; `status` is exactly `available`, `missing`, or
  `contradictory`;
- `quality_bar`: an array of objects containing exactly `criterion`, `oracle`,
  and `verification`;
- `findings`: an array of objects containing exactly `type`, `summary`, and
  `evidence`, where `evidence` is a non-empty string array; and
- `required_next_action`: an object containing exactly `type` and
  `description`.

Use only the enum values defined in the preceding sections. Finding `type` is
one of `missing-information`, `unresolved-decision`, `contradiction`,
`dependency`, `permission`, or `quality-bar-gap`. Next-action `type` is one of
`none`, `discovery`, `decision`, or `unblock`.

Use `darrow-implementation-readiness-v1` literally. Every string must contain
concrete content rather than a placeholder. `basis` is never empty. A `ready`
result has at least one quality-bar item, no findings, and next-action type
`none`. Every other verdict has at least one finding and uses its corresponding
next-action type: `discovery`, `decision`, or `unblock`.

For a standalone assessment, return only the JSON object under the output mode
contract above.

For a readiness clause inside a larger goal contract, complete this entire
assessment before the first repository or external mutation:

- if the verdict is not `ready`, terminate the enclosing goal and return the
  exact JSON result to its goal owner. When the outer contract requires its own
  completion records, emit the readiness object first and then every required
  outer record in its exact syntax. The object and outer records are the only
  authoritative payloads; consumers ignore host presentation text. Do not omit
  either contract. When no outer reporting contract exists, return the JSON
  object as the only authoritative payload;
- if the verdict is `ready`, retain the result as gate evidence, exit this
  capability, and return control to the current goal owner. That goal may
  continue only with effects already authorized by its contract. Only after
  the enclosing goal reaches its own terminal response, that goal reports
  `implementation readiness: ready` and the quality bar it used. This sentence
  is not part of a standalone readiness result.

The ready verdict grants no authority to edit, branch, commit, update a ticket,
push, open a pull request, release, deploy, or perform another mutation. Do not
persist the assessment as a repository artifact unless separately requested.

## Completion

The capability is complete only when every material conclusion is traceable to
the stated basis, the quality bar supports the verdict, the smallest next
action matches the verdict, and the assessment itself caused no mutation.
Before finalizing a composed gate, re-read the enclosing contract's terminal
reporting clause. If it requires an outer status or other record, append every
such record after the readiness object even when the verdict stopped all
mutation. Never treat “stop” as permission to abandon mandatory reporting.
