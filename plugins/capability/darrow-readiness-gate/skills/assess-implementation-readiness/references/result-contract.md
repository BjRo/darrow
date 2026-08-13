# Readiness result contract

Construct one semantic result with exactly these fields:

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

Finding `type` is one of `missing-information`, `unresolved-decision`,
`contradiction`, `dependency`, `permission`, or `quality-bar-gap`.
Next-action `type` is one of `none`, `discovery`, `decision`, or `unblock`.

Every string contains concrete content rather than a placeholder. `basis` is
never empty. A `ready` result has at least one quality-bar item, no findings,
and next-action type `none`. Every other verdict has at least one finding and
uses its corresponding next-action type: `discovery`, `decision`, or
`unblock`.

## Default human-readable presentation

Serialize every field using this structure. Preserve literal enum values
inside backticks:

```markdown
## Implementation readiness

**Verdict:** `ready | needs-discovery | needs-decision | blocked`

### Basis

- **Source:** concrete source
  - **Authority:** `authoritative | repository | supporting`
  - **Status:** `available | missing | contradictory`
  - **Summary:** what the source establishes

### Quality bar

- **Criterion:** observable claim
  - **Oracle:** independent expected value or reference
  - **Verification:** feasible check or evidence

### Findings

- **Type:** `missing-information | unresolved-decision | contradiction | dependency | permission | quality-bar-gap`
  - **Summary:** concise finding
  - **Evidence:**
    - source-backed evidence

### Required next action

- **Type:** `none | discovery | decision | unblock`
- **Description:** smallest next action
```

Keep the `Quality bar` and `Findings` headings when their arrays are empty and
write `None.` beneath the applicable heading. Repeat the item structure for
each value. Never collapse evidence needed to support the verdict into a prose
preface or trailing summary.

## Explicit v1 JSON presentation

Add `format` with the literal value
`darrow-implementation-readiness-v1` and serialize exactly one object with the
same field names, object members, arrays, and enum values defined above. The
JSON object has exactly these top-level fields: `format`, `verdict`, `basis`,
`quality_bar`, `findings`, and `required_next_action`.

Prefer raw JSON with no prose. A host may wrap the object in one `json` code
fence and add non-normative presentation text, but it must not emit another
JSON object. The single object remains the authoritative serialized result.
