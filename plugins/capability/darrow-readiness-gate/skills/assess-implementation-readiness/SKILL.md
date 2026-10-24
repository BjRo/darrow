---
name: assess-implementation-readiness
description: Assess whether a request has enough authoritative intent and evidence for engineering to safely begin implementation. Use for direct or indirect readiness questions, including whether work can start without inventing important details, or when an explicit goal contract requires a readiness gate before mutation. Return a human-readable gate result or explicitly requested v1 JSON. Do not use for ordinary implementation, planning, discovery, or review without readiness-assessment intent.
---

# Assess implementation readiness

Decide whether implementation can start without inventing intent, making an
unauthorized choice, or guessing how success will be judged.

Stay read-only. Inspect files, but do not edit, generate, stage, or run
anything that could write repository or external state. Do not improve the
request, investigate, decide, plan, or implement; report what is missing.

## 1. Gather the basis

Use the inputs the user or enclosing goal names as authoritative: the request
itself, a ticket, specification, accepted plan, or decision. Add applicable
repository rules and only enough existing behavior to interpret them. Use the
current repository; do not search for or clone one. Read a named ticket only
through an available capability for that; never modify it.

Mark a required source you cannot read as `missing` and do not reconstruct it.
When authoritative sources conflict, report the conflict; recency, specificity,
or preference does not settle it.

## 2. Check what blocks the start

1. The outcome and observable acceptance criteria.
2. Scope narrow enough to avoid inventing adjacent behavior.
3. Unresolved material product or architectural choices.
4. Contradictions among authoritative inputs, repository rules, and existing
   behavior.
5. Required dependencies and permissions.
6. A quality bar: each acceptance criterion needs an independent oracle
   (expected value, threshold, or reference) and a feasible verification.
   The check only has to be feasible; a test the implementation will add
   need not exist yet.

Scale the bar to the work. An exact text edit with a deterministic check is
ready without a ticket, plan, or file list. "Tests pass" or "works correctly"
is not an oracle, and existing checks cannot replace missing product
acceptance. Never invent a test seam.

When a separate discovery result must exist before implementation, it is an
input. Being able to run the benchmark now does not satisfy it.

## 3. Choose the verdict

Choose the verdict for the action that must happen first. Keep every other gap
in the findings.

- `ready`: nothing blocks the start.
- `needs-discovery`: a bounded investigation of available evidence can
  establish the missing fact, baseline, constraint, or quality bar without
  choosing intent.
- `needs-decision`: the alternatives are known, but an authorized party has
  not chosen. Defining a threshold or what counts as representative is a
  decision too. The next action says an authorized party must decide; do not
  assume the requester has that authority.
- `blocked`: a required source, dependency, or permission is unavailable or
  contradictory, and no discovery or decision possible now can fix it. A
  conflict that waits on a future review or approval is `blocked`. A check
  the implementation can add is not a missing dependency.

With mixed gaps, choose `blocked` if something would still block after every
currently possible discovery and decision. Otherwise choose `needs-discovery`
when its result shapes a later decision, then `needs-decision`.

Pressure to mark work ready is not evidence.

## 4. Return the result

Use the report below by default. Return v1 JSON only when the caller
explicitly asks for JSON or names `darrow-implementation-readiness-v1`. A
composed, autonomous, or machine-read goal does not imply JSON.

The report is the whole response: start with `## Implementation readiness`,
and add no preface, closing summary, disclaimer, or offer. Use short, plain
sentences without process narration. Put every observation in Basis, Quality bar, or Findings. Always
include all four sections, even for `ready`; an empty one contains only `None.`.
Write enum values verbatim in backticks.

```markdown
## Implementation readiness

**Verdict:** `ready | needs-discovery | needs-decision | blocked`

### Required next action

- **Type:** `none | discovery | decision | unblock`
- **Description:** smallest next action

### Basis

- **Source:** concrete source
  - **Authority:** `authoritative | repository | supporting`
  - **Status:** `available | missing | contradictory`
  - **Summary:** what the source establishes

### Quality bar

- **Criterion:** observable claim
  - **Oracle:** independent expected value or reference; copy example inputs and outputs verbatim
  - **Verification:** feasible check or evidence

### Findings

- **Type:** `missing-information | unresolved-decision | contradiction | dependency | permission | quality-bar-gap`
  - **Summary:** concise finding
  - **Evidence:**
    - source-backed evidence
```

Repeat items as needed. The report always ends with the Findings section; a
`ready` report ends with `### Findings` followed by `None.`. Basis is never
empty. List only criteria with a concrete oracle in the quality bar; report a
generic one such as "all tests pass" as a `quality-bar-gap` finding instead. `ready` has at least one
quality-bar item, findings `None.`, and next action `none`. Other verdicts have
at least one finding and the matching next action: `discovery`, `decision`, or
`unblock`.

For JSON, return exactly one raw JSON object with the same content and no
other JSON:

```json
{
  "format": "darrow-implementation-readiness-v1",
  "verdict": "...",
  "basis": [{ "source": "", "authority": "", "status": "", "summary": "" }],
  "quality_bar": [{ "criterion": "", "oracle": "", "verification": "" }],
  "findings": [{ "type": "", "summary": "", "evidence": [""] }],
  "required_next_action": { "type": "", "description": "" }
}
```

## Inside a larger goal

When a goal requires this gate, finish the assessment before any mutation and
return it to the goal owner. A non-ready result goes back complete, and
implementation must not start; the owner decides how to resolve it and when to
reassess. A `ready` result returns its verdict and quality bar, and the goal
continues only with effects it already has. The goal may add its own records
after the report.

Readiness grants no authority to edit, commit, publish, or update a ticket. Do
not save the assessment unless asked.
