# Review result protocol

Use this protocol for both completed reviews and terminal scope failures.

## Output envelope

A standalone final response begins with
`format<TAB>darrow-review-result-v1`, ends with the `next_action` record, and
contains nothing else. This applies to `pass`, `fail`, `blocked`, invalid-base,
ambiguous-base, and empty-diff outcomes. Every field is one line without tabs.

For an explicit review clause inside a larger goal, the same exact validated
record is the capability return value rather than the enclosing goal's response
envelope. The goal owner interprets its findings and outcome, applies the
enclosing continuation contract, and may summarize the review in its own final
response. Consumers do not need to parse or reproduce this serialization.

Use `next_action=return control to enclosing goal` for a composed pass,
`next_action=return findings to enclosing goal` for a composed fail, and
`next_action=return evidence gap to enclosing goal` for a composed blocked
result. These records transfer evidence, not authority. Repair, completion, and
publication remain outside this capability.

## Terminal scope failure

For `review-scope prepare` exit 2, 3, or 4, invoke no reviewer. Emit no
`changed_file` record. Preserve the requested base/target identifier when no OID
was resolved. Set Standards to `blocked`; set Spec to `blocked` when a Spec was
available or `not_available` when genuinely absent. Add the literal failed
prepare command as one applicable blocked `check`, set verdict `blocked`, and
make `next_action` the exact remediation reported by the scope tool.

## Completed result schema

Create exactly this tab-separated record; repeat only marked collections:

```text
format<TAB>darrow-review-result-v1
base<TAB>resolved base OID
target<TAB>resolved target OID or WORKTREE fingerprint
changed_file<TAB>absolute path                         # repeat
standards<TAB>pass|fail|blocked
standards_source<TAB>absolute path or heuristic:name  # repeat
spec<TAB>pass|fail|blocked|not_available
spec_source<TAB>source identifier or not_available
finding<TAB>standards|spec<TAB>critical|high|medium|low<TAB>blocking|advisory<TAB>changed path:line or command<TAB>violated source<TAB>concrete evidence  # repeat
check<TAB>literal command or none<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence  # repeat
verdict<TAB>pass|fail|blocked
risk<TAB>concise residual risk or none observed       # repeat
next_action<TAB>one authorized next step, or none
```

A failing axis has at least one blocking finding; advisory findings alone do
not fail it. Every blocking Spec finding cites an exact originating clause.

Derive verdict mechanically:

- `fail` when either axis fails or an applicable check fails;
- otherwise `blocked` when an available axis or applicable check is blocked;
- otherwise `pass`; `spec=not_available` does not block.

Do not move findings between axes or create findings absent from reader
records. If validation reveals missing evidence, change the affected state to
`blocked`; never fill the gap with coordinator judgment.

## Validate and return

Write the draft only beneath the scope artifact directory and run:

```sh
bash "$result_tool" validate "$result_record"
```

Correct serialization errors only. In standalone mode, copy the validated file
bytes verbatim as the full response. In composed mode, return the review report
to the goal owner and exit the capability. Add no remediation, commit,
publication, approval, merge, release, or deploy action inside review.
