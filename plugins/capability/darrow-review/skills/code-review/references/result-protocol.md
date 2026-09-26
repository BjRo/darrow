# Review result protocol

Use the first protocol for comprehensive reviews and terminal scope failures.
Use the second additive protocol only for fix verification.

## Canonical artifact and output envelope

Write and validate every result as `darrow-review-result-v3` JSON at the fixed
`result.json` path directly beneath the scope artifact directory. It is the
canonical mechanical artifact. JSON string escaping preserves tabs and newlines
in fields. Do not select an arbitrary JSON: `scope.json` and axis records are
not aggregate results.

Default standalone and composed responses are a Markdown rendering of that
validated artifact. Materialize it as `review.md` beside `result.json`, confirm
that file is readable and nonempty, then use one dedicated final
`uv run --quiet --no-project "$backend/scripts/run_locked.py" review-report render "$result_record"` invocation and return its complete
stdout. The renderer preserves all fields, escapes hostile content, and does
not include raw JSON. Only an explicit request for raw JSON, v3, or machine
format returns the JSON bytes. The object has `"format": "darrow-review-result-v3"` and a required `next_action`. This applies
to `pass`, `fail`, `blocked`, invalid-base, ambiguous-base, and empty-diff
outcomes.

The human rendering presents the verdict or outcome and next action first,
then retains findings, checks, risks, scope, sources, and binding evidence in
later sections. This order changes no canonical JSON field or meaning.

For an explicit review clause inside a larger goal, return the selected normal
presentation rather than the enclosing goal's response envelope. The goal owner
interprets its findings and outcome, applies the enclosing continuation contract,
and may summarize the review in its own final response. Consumers do not need
to parse or reproduce the JSON serialization.

Use `next_action=return control to enclosing goal` for a composed pass,
`next_action=return findings to enclosing goal` for a composed fail, and
`next_action=return evidence gap to enclosing goal` for a composed blocked
result. These records transfer evidence, not authority. Repair, completion, and
publication remain outside this capability.

## Terminal scope failure

For `review-scope prepare` exit 2, 3, or 4, invoke no reviewer. Emit no
`changed_files` entry. Preserve the requested base/target identifier when no OID
was resolved. Set Standards to `blocked`; set Spec to `blocked` when a Spec was
available or `not_available` when genuinely absent. Add the literal failed
prepare command as one applicable blocked `check`, set verdict `blocked`, and
make `next_action` the exact remediation reported by the scope tool. Run
`review-scope allocate-terminal --repo <bound-repo>` and write `result.json`
directly beneath its returned `artifact_dir`; this command provides a private
review-state run and terminal manifest when scope preparation stopped early.

## Completed result schema

Create one valid JSON object with these named fields. Replace placeholders and repeat array entries as needed:

```json
{
  "format": "darrow-review-result-v3",
  "base": "resolved base OID",
  "target": "resolved target OID or WORKTREE fingerprint",
  "changed_files": ["absolute changed path; repeat as needed"],
  "standards": "pass|fail|blocked",
  "standards_sources": ["absolute path or heuristic:name; repeat as needed"],
  "spec": "pass|fail|blocked|not_available",
  "spec_source": "source identifier or not_available",
  "findings": [
    {
      "axis": "standards|spec",
      "severity": "critical|high|medium|low",
      "disposition": "blocking|advisory",
      "location": "changed path:line or command",
      "source": "violated source",
      "evidence": "failure and cause evidence",
      "repair_guidance": "advisory repair guidance",
      "resolution_evidence": "observable resolution behavior or regression test"
    }
  ],
  "checks": [
    {
      "command": "literal command or none",
      "applicability": "applicable|not_applicable",
      "status": "pass|fail|blocked|not_applicable",
      "evidence": "captured evidence"
    }
  ],
  "verdict": "pass|fail|blocked",
  "risks": ["concise residual risk or none observed"],
  "next_action": "one authorized next step, or none"
}
```

For a resolved scope, obtain the complete `base`, `target`, and `changed_files`
fields with `uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result scope-records "$manifest"`. Copy them into the aggregate; do not retype hashes or reconstruct the file list.
This command validates the pinned diff and refuses incomplete scope records.

Every applicable `checks` entry preserves the exact field values from a retained
`darrow-review-check-v3` artifact produced beneath this scope. Coordinator prose
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

The `repair_guidance` and `resolution_evidence` fields are optional as a pair:
validators and renderers also accept findings with neither field. A partial
pair, an empty field, or extra fields is invalid. New readers emit both; consumers preserve their
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
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-scope "$manifest" "$result_record"
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
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-report render "$result_record" >"$review_report"
test -r "$review_report" && test -s "$review_report"
```

If that succeeds, make a standalone
`uv run --quiet --no-project "$backend/scripts/run_locked.py" review-report render "$result_record"` the final tool call and copy its
complete stdout as the entire response. Do not handwrite, shorten, or reconstruct
it. In explicit machine mode, copy the validated file bytes verbatim. In
composed mode, return the selected review report to the goal owner and exit the
capability. Add no remediation, commit, publication, approval, merge, release,
or deploy action inside review.

## Fix-verification artifact

Write fix verification to `verification.json` directly beneath the current
scope artifact directory. Never overwrite or reinterpret an original
`result.json`. The additive format is `darrow-review-verification-v3`; the
initial `darrow-review-result-v3` records remain readable, including legacy
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

Create one valid JSON object with these named fields. Choose one previous-verification binding, omit absent optional arrays, and repeat array entries as needed:

```json
{
  "format": "darrow-review-verification-v3",
  "original_target": "original comprehensive-review target fingerprint",
  "prior_target": "immediately prior repair target fingerprint",
  "current_target": "current pinned target fingerprint",
  "history_targets": ["earlier repair target fingerprint; omit when none"],
  "previous_verification": {
    "checksum": "none or Git blob checksum",
    "path": "none or absolute prior verification artifact"
  },
  "original_findings": [
    {
      "key": "stable finding key",
      "axis": "standards|spec",
      "order": "canonical positive order",
      "severity": "critical|high|medium|low",
      "disposition": "blocking|advisory",
      "location": "location",
      "source": "source",
      "evidence": "original evidence",
      "repair_guidance": "original advisory guidance",
      "resolution_evidence": "original resolution evidence"
    }
  ],
  "attempts": [
    {
      "key": "original finding key",
      "status": "resolved|unresolved|blocked",
      "progress": "resolved|progressing|unchanged|unavailable",
      "evidence": "current evidence"
    }
  ],
  "regressions": [
    {
      "key": "stable regression key",
      "caused_by": "causing original finding key",
      "order": "canonical positive order",
      "axis": "standards|spec",
      "severity": "critical|high|medium|low",
      "status": "resolved|unresolved|blocked",
      "progress": "resolved|progressing|unchanged|unavailable",
      "location": "location",
      "source": "source",
      "evidence": "current evidence",
      "repair_guidance": "advisory repair guidance",
      "resolution_evidence": "observable resolution evidence"
    }
  ],
  "checks": [
    {
      "command": "literal command or none",
      "applicability": "applicable|not_applicable",
      "status": "pass|fail|blocked|not_applicable",
      "evidence": "captured evidence"
    }
  ],
  "evidence_gaps": ["missing or inconsistent required evidence"],
  "outcome": "clear|continue|no_progress|blocked",
  "next_action": "one authorized enclosing-goal action, or none"
}
```

Every applicable verification `checks` entry likewise preserves exact field values from its
retained `darrow-review-check-v3` artifact. The reader receives the same values, so
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
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-fix-axis standards "$standards_fix_record"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-fix-axis spec "$spec_fix_record"
```

The fix-axis schema declares supplied original keys in `originals`, active
carried regressions in `prior_regressions`, original states in `attempts`,
carried states in `regression_attempts`, newly detected direct regressions in
`regressions`, and missing evidence in `evidence_gaps`. Without an explicit
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
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-verification "$verification_record"
```

That command validates the record and prior-verification chain. The
fix-verification workflow also requires `validate-original` whenever the original
comprehensive result is retained. Obtain
the immutable objects with `original-findings`; do not retype their evidence or
assign a new finding order. An external handoff without that artifact still
requires complete immutable original records, preserved exactly as supplied;
missing original evidence requires a blocked gap.

In default mode render with:

```sh
verification_report="$(dirname "$verification_record")/verification.md"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-report render-verification "$verification_record" >"$verification_report"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-report render-verification "$verification_record"
```

After confirming `verification.md` is readable and nonempty, make the second
renderer invocation the last tool command and copy its stdout verbatim as the
entire response. A handwritten summary is incomplete. When the requester
explicitly asks for verification JSON or machine format, return only the
validated JSON bytes. A composed caller interprets `clear`, `continue`,
`no_progress`, or `blocked` semantically and retains all repair, stop,
goal-status, and publication authority outside this read-only capability.
