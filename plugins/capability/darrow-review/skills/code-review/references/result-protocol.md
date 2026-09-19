# Review result protocol

Use the first protocol for comprehensive reviews and terminal scope failures.
Use the second additive protocol only for fix verification.

## Canonical artifact and output envelope

Write and validate every result as `darrow-review-result-v1` TSV at the fixed
`result.tsv` path directly beneath the scope artifact directory. It is the
canonical mechanical artifact and every field is one line without tabs. Do not
select an arbitrary TSV: `scope.tsv` and axis records are not aggregate results.

Default standalone and composed responses are a Markdown rendering of that
validated artifact. Materialize it as `review.md` beside `result.tsv`, confirm
that file is readable and nonempty, then use one dedicated final
`uv run --quiet --frozen --no-dev --project "$backend" review-report render "$result_record"` invocation and return its complete
stdout. The renderer preserves all fields, escapes hostile content, and does
not include raw TSV. Only an explicit request for raw TSV, v1, or machine format
returns the TSV bytes, beginning with `format<TAB>darrow-review-result-v1`,
ending with the `next_action` record, and containing nothing else. This applies
to `pass`, `fail`, `blocked`, invalid-base, ambiguous-base, and empty-diff
outcomes.

The human rendering presents the verdict or outcome and next action first,
then retains findings, checks, risks, scope, sources, and binding evidence in
later sections. This order changes no canonical TSV field or meaning.

For an explicit review clause inside a larger goal, return the selected normal
presentation rather than the enclosing goal's response envelope. The goal owner
interprets its findings and outcome, applies the enclosing continuation contract,
and may summarize the review in its own final response. Consumers do not need
to parse or reproduce the TSV serialization.

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
finding<TAB>standards|spec<TAB>critical|high|medium|low<TAB>blocking|advisory<TAB>changed path:line or command<TAB>violated source<TAB>failure and cause evidence<TAB>repair guidance<TAB>resolution evidence  # repeat
check<TAB>literal command or none<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence  # repeat
verdict<TAB>pass|fail|blocked
risk<TAB>concise residual risk or none observed       # repeat
next_action<TAB>one authorized next step, or none
```

For a resolved scope, obtain the complete `base`, `target`, and `changed_file`
records with `uv run --quiet --frozen --no-dev --project "$backend" review-result scope-records "$manifest"`. Insert those
bytes into the aggregate; do not retype hashes or reconstruct the file list.
This command validates the pinned diff and refuses incomplete scope records.

Every applicable `check` row is copied byte-for-byte from a retained
`darrow-review-check-v1` artifact produced beneath this scope. Coordinator prose
must not replace the captured command, status, or evidence.

A failing axis has at least one blocking finding; advisory findings alone do
not fail it. Every blocking Spec finding cites an exact originating clause.

For every new finding, copy all three reasoning fields from its originating
reader unchanged. Evidence explains the failure and cause against the violated
source. Repair guidance is a bounded suggested approach with rationale and
important constraints, explicitly advisory rather than a required
implementation. When the reader lacks confidence in a repair, the guidance
states that limitation and its reason without inventing an approach or dropping
the finding. Resolution evidence describes observable behavior or a regression
test demonstrating the required outcome; it is a proposed verification method,
not a claim that a test has run or a new requirement.

The two trailing fields are an additive v1 extension: validators and renderers
also accept legacy findings with neither field. A partial pair, an empty field,
or extra fields is invalid. New readers emit both; consumers preserve their
presence or absence exactly. Human output labels repair guidance as advisory.
The originating requirement, not the suggestion, determines resolution.

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
uv run --quiet --frozen --no-dev --project "$backend" review-result validate-scope "$manifest" "$result_record"
```

This validates both the schema and the exact base, target, and complete
changed-file set against the pinned manifest. A mismatch is an assembly error;
recopy the authoritative scope records without changing reader judgment. For
a terminal scope failure with no resolved manifest, retain the blocked schema
and use `validate "$result_record"` instead. Standalone `validate` remains a
serialization check for external records, not proof of scope binding.

Correct serialization errors only. In default mode, first run:

```sh
review_report="$(dirname "$result_record")/review.md"
uv run --quiet --frozen --no-dev --project "$backend" review-report render "$result_record" >"$review_report"
test -r "$review_report" && test -s "$review_report"
```

If that succeeds, make a standalone
`uv run --quiet --frozen --no-dev --project "$backend" review-report render "$result_record"` the final tool call and copy its
complete stdout as the entire response. Do not handwrite, shorten, or reconstruct
it. In explicit machine mode, copy the validated file bytes verbatim. In
composed mode, return the selected review report to the goal owner and exit the
capability. Add no remediation, commit, publication, approval, merge, release,
or deploy action inside review.

## Fix-verification artifact

Write fix verification to `verification.tsv` directly beneath the current
scope artifact directory. Never overwrite or reinterpret an original
`result.tsv`. The additive format is `darrow-review-verification-v1`; the
initial `darrow-review-result-v1` records remain readable, including legacy
findings without guidance.

The caller must supply the original comprehensive review target, its complete
canonical finding order, the immediately prior repair target, the attempted
finding set, earlier repair target history, and current deterministic-check
evidence. It also supplies the validated prior scope manifest and, after the
first verification, the immediately prior verification artifact with every
carried regression. Missing or inconsistent binding evidence becomes an
`evidence_gap` and `blocked` outcome. It never authorizes a new comprehensive
review.

Pin the current fix scope with `--allow-empty --prior-manifest` and use the
manifest's `repair_show_command`. That command validates both pinned manifests,
requires their effective bases to match, and renders their prior-to-current
packet delta. Caller prose cannot establish
repair causality, and an empty base-to-current diff is valid only in this fix
mode when the repair delta shows restoration of the prior change.

Derive every original finding key as
`<axis>:<canonical-order>:<original-target>`. Derive every repair-caused
regression key as
`regression:<canonical-regression-order>:<causing-original-finding-key>`.
Regression order is independent of original-finding order: start at `1` when no
regression is carried, then assign new orders after the highest carried
regression order.

Create this tab-separated record in the shown order:

```text
format<TAB>darrow-review-verification-v1
original_target<TAB>original comprehensive-review target fingerprint
prior_target<TAB>immediately prior repair target fingerprint
current_target<TAB>current pinned target fingerprint
history_target<TAB>earlier repair target fingerprint                 # repeat
previous_verification<TAB>none<TAB>none                              # first verification
previous_verification<TAB>Git blob checksum<TAB>absolute prior verification artifact # later verification
original_finding<TAB>stable key<TAB>standards|spec<TAB>canonical positive order<TAB>critical|high|medium|low<TAB>blocking|advisory<TAB>location<TAB>source<TAB>original evidence<TAB>original repair guidance<TAB>original resolution evidence  # repeat
attempt<TAB>original finding key<TAB>resolved|unresolved|blocked<TAB>resolved|progressing|unchanged|unavailable<TAB>current evidence  # repeat
regression<TAB>stable regression key<TAB>causing original finding key<TAB>canonical positive order<TAB>standards|spec<TAB>critical|high|medium|low<TAB>resolved|unresolved|blocked<TAB>resolved|progressing|unchanged|unavailable<TAB>location<TAB>source<TAB>current evidence<TAB>repair guidance<TAB>resolution evidence  # repeat
check<TAB>literal command or none<TAB>applicable|not_applicable<TAB>pass|fail|blocked|not_applicable<TAB>evidence  # repeat
evidence_gap<TAB>missing or inconsistent required evidence           # repeat
outcome<TAB>clear|continue|no_progress|blocked
next_action<TAB>one authorized enclosing-goal action, or none
```

Every applicable verification `check` row likewise comes byte-for-byte from its
retained `darrow-review-check-v1` artifact. The reader receives the same row, so
aggregation cannot turn a failed command into a pass.

Every blocking original finding has exactly one attempt. An advisory may remain
unattempted when it was ineligible; advisories never determine the outcome. A
regression is in scope only when evidence directly ties it to one attempted
original finding in the pinned repair delta. Do not serialize an unrelated
observation. On a later verification, the validator checks the prior artifact
checksum and target link, preserves the original set, and requires every prior
regression to retain its stable key and immutable cause, order, axis, severity,
location, source, repair guidance, and resolution evidence. The two guidance
fields follow the same paired-extension rule as comprehensive findings;
preserve legacy absence. New regressions carry the fix reader's own reasoning,
with the same advisory and uncertainty rules. Original guidance is immutable
history, not an implementation acceptance condition.
The first verification binds `prior_target` to
`original_target` and has no `history_target`; every later artifact carries
exactly the prior artifact's history plus that artifact's `prior_target`.

Before aggregation validate each applicable reader record with:

```sh
uv run --quiet --frozen --no-dev --project "$backend" review-result validate-fix-axis standards "$standards_fix_record"
uv run --quiet --frozen --no-dev --project "$backend" review-result validate-fix-axis spec "$spec_fix_record"
```

The fix-axis schema declares supplied original keys with `original`, active
carried regressions with `prior_regression`, original states with `attempt`,
carried states with `regression_attempt`, newly detected direct regressions with
`regression`, and missing evidence with `evidence_gap`. Without an explicit
evidence gap, every supplied original and carried regression must have exactly
one corresponding state record.

Derive the outcome mechanically in this order:

1. `blocked` for an evidence gap, blocked applicable check, blocked original
   blocker, or blocked regression;
2. `no_progress` when the current target equals the original, prior, or any
   earlier target, or when any unresolved blocker or regression has unchanged
   evidence;
3. `continue` while any unresolved blocker or regression is materially
   progressing. A newly detected direct regression is progressing for its first
   verification; if its evidence remains after a repair attempt it is
   unchanged; and
4. `clear` when all original blockers and regressions are resolved. Unresolved
   advisories do not prevent `clear`.

A failed deterministic check must be represented by an unresolved or blocked
repair-caused regression, not by an unscoped new finding. Validate with:

```sh
uv run --quiet --frozen --no-dev --project "$backend" review-result validate-verification "$verification_record"
```

That command validates the record and prior-verification chain. The
fix-verification workflow also requires `validate-original` whenever the original
comprehensive result is retained. Obtain
the immutable rows with `original-findings`; do not retype their evidence or
assign a new finding order. An external handoff without that artifact still
requires complete immutable original records, preserved exactly as supplied;
missing original evidence requires a blocked gap.

In default mode render with:

```sh
verification_report="$(dirname "$verification_record")/verification.md"
uv run --quiet --frozen --no-dev --project "$backend" review-report render-verification "$verification_record" >"$verification_report"
uv run --quiet --frozen --no-dev --project "$backend" review-report render-verification "$verification_record"
```

After confirming `verification.md` is readable and nonempty, make the second
renderer invocation the last tool command and copy its stdout verbatim as the
entire response. A handwritten summary is incomplete. When the requester
explicitly asks for verification TSV or machine format, return only the
validated TSV bytes. A composed caller interprets `clear`, `continue`,
`no_progress`, or `blocked` semantically and retains all repair, stop,
goal-status, and publication authority outside this read-only capability.
