# Fix-verification workflow

Use this workflow only after the main skill selects fix verification. The main
skill's presentation and read-only gates, plus the reader-routing acceptance
rules, remain in force throughout this branch.

## 1. Bind the closed finding set

Require all of these caller-owned inputs before reader calls:

- the exact original comprehensive-review target fingerprint;
- the validated original or immediately prior scope manifest for that target;
- every original finding with its original axis, severity, disposition,
  location, source, evidence, nonempty repair guidance and resolution evidence,
  and one canonical cross-axis order;
- the immediately prior repair target plus every earlier repair target;
- every finding attempted by the current repair;
- the immediately prior validated verification artifact when an earlier fix
  verification exists, including all carried regression records; and
- current deterministic-check commands and evidence.

When the original comprehensive `result.json` is retained, bind its absolute
path as `original_result` and use its sibling scope manifest for the first
follow-up. Obtain canonical original records through the bundled helper before
passing them to readers:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result original-findings "$original_result"
```

Copy those returned rows unchanged into the handoff and final verification.
The order runs across both axes in the original result, not separately per
axis. Preserve the complete original source and evidence text, including
advisories and both guidance fields; a shorter paraphrase is a changed record.
Both guidance fields are required on every original finding and carried
regression. Bind the
authoritative file as `original_input`: the original comprehensive result for
a first follow-up, the immediately prior verification for a later follow-up,
or the caller's complete external handoff. Finalization copies its original
records directly; do not make another shortened finding document.
For an external handoff
without that artifact, preserve the caller's complete immutable finding records
and canonical order exactly as supplied. A validated prior verification also
retains those original rows. Missing or incomplete original evidence blocks
instead of permitting reconstruction from a rendered summary.
An external handoff does not require the original `result.json`. Its `source`
and `evidence` values are the immutable finding fields, not embedded full source
documents. Read needed source documents separately. Never synthesize missing
guidance to make an incomplete handoff valid.

Derive each original key as
`<axis>:<canonical-order>:<original-target>`. Reject duplicate orders or keys,
attempts outside the original set, a changed original record, or inconsistent
target history. Every original blocker must have one attempted state; if repair
was unavailable or unauthorized, that state is `blocked`. An ineligible
advisory may be omitted because advisories never gate.

Missing or inconsistent evidence does not authorize a comprehensive rereview.
Preserve the evidence gap, pin the current scope if possible, and produce a
validated `blocked` verification artifact as described in
[`result-protocol.md`](result-protocol.md).

**Complete when:** the immutable original set, stable keys, attempted subset,
prior/history targets, repair evidence, and current checks are mutually
consistent—or their exact evidence gaps are bound for a blocked result.

## 2. Pin the current repair target

Resolve the same bundled `review-scope`, `review-result`, `review-report`, and
`review-check` tools as comprehensive mode. Validate the prior scope manifest
and require its target to equal the supplied prior target and its effective base
to equal the current scope's effective base. For the first verification, use
the scope manifest retained by the comprehensive run. For a later verification,
validate the immediately prior verification artifact and use its sibling scope
manifest. If the caller has an exact prior target but no retained manifest path,
resolve it through the bundled helper:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-scope locate --repo "$repo" --target "$prior_target"
```

Use its one validated absolute manifest. A missing or ambiguous result blocks;
never scan `.git` or guess a run from filenames.

Choose the current target and working-tree layers from the main skill's table.
Keep the prior review's effective base: omit `--base` so the helper derives it
from the validated prior manifest. `HEAD` describes the uncommitted target's
parent, not a replacement review base. An explicitly supplied different base
is inconsistent evidence and blocks.

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-scope prepare --repo "$repo" --target "$target" \
  [working-tree flags] --allow-empty --prior-manifest "$prior_scope_manifest"
```

Treat its target fingerprint, absolute manifest, changed paths, fixed show
command, and `repair_show_command` as authoritative. The current target must
not be copied from caller prose. Require both prior and current manifests'
`repository` fields to equal the main skill's requester-bound `repo`; a plugin,
skill, or cache repository is an evidence gap. `--allow-empty` is
fix-verification-only: it permits an exact repair that restored the base while
the pinned prior-to-current repair delta still exposes what changed. Run the
`repair_show_command` and use only that mechanical delta—not caller-described
changes—to establish repair causality.

Run only applicable deterministic checks invalidated by the repair. For each
one, never execute the literal command directly. Use the main skill's resolved
`review-check` as its sole execution boundary:

```sh
check_record="$(dirname "$manifest")/check-1.json" # increment for later checks
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-check run --output "$check_record" --command "$literal_command"
```

Preserve the retained record's canonical `checks` entry values in reader
evidence and pass its absolute path to finalization; never reinterpret the
observed status. An unavailable command still runs through `review-check` and
produces its actual retained blocked capture; describing it is insufficient. A check
failure belongs in the convergence set only as evidence for a direct
repair-caused regression tied to an attempted original finding. An unavailable
required check or failed evidence capture is an evidence gap and blocks
verification.

**Complete when:** current content and canonical check records are
exact-target-bound and no reader has been asked to inspect an unpinned or stale
target.

## 3. Invoke isolated fix verifiers

Read [`reader-inputs.md`](reader-inputs.md) and
[`reader-routing.md`](reader-routing.md) completely. Resolve and retain the
concrete reviewer route beside the current scope manifest. Group attempted
findings by their original axis. Invoke the applicable Standards and Spec fix
verifiers through that exact route as fresh readers, issuing both invocations
before waiting when both groups exist. Do not invoke an axis with no attempted
finding and no regression evidence to verify.

Apply the reader-routing acceptance rules immediately after each launch. Write
down the returned child ID before any wait. No child ID becomes an
`evidence_gap`; it never permits coordinator verification of an attempted
finding.

Prepare one input per attempted axis using the current manifest, that axis's
context and attempted keys, retained checks, and the authoritative original or
prior verification evidence. The helper preserves original-axis findings,
carried regressions, prior/current scope, and history; its complete launch
message includes the isolated schema and validated input command. Pass that
message unchanged. Never manually copy finding history or individual source
paths into a verifier prompt.

Permit inspection only of the current target, cited original finding context,
the repair changes, and direct consequences. A reader must ignore an unrelated
potential defect rather than serialize it. It may mark an attempted finding
`resolved`, `unresolved`, or `blocked`; unresolved evidence is `progressing`
only when it materially narrows the remaining failure and otherwise is
`unchanged`. A newly detected direct repair-caused regression is `progressing`
for its first verification so the enclosing owner can attempt it; if the same
regression evidence remains after that attempt it is `unchanged`. A direct
regression must name the causing original key. An invalid or missing reader
record becomes an evidence gap; never repair its judgment or replace it with a
generic review.

Resolution depends on the original requirement and observable current behavior,
not adoption of the original suggested implementation. Accept an alternative
valid repair, and retain a defect even if the implementer followed the advice.
New direct regressions receive the verifier's own advisory guidance (or explicit
limitation), rationale, constraints, and resolution evidence. Copy those fields
unchanged; the coordinator does not fill them in.

Save each raw fix-axis record beneath the current scope artifact directory and
run the applicable commands:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-fix-axis standards "$standards_fix_record"
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-fix-axis spec "$spec_fix_record"
```

For an input-read error or invalid returned record, use `reader-inputs.md`'s
one diagnostic-only correction round with the same accepted verifier, retaining
the failed record and validating the corrected record. Missing or mismatched
route evidence, unavailable continuation, or a persistent error is an evidence
gap. Do not replace the verifier or repair its judgment. Input availability
does not create a repair-caused regression.

**Complete when:** each attempted axis has one isolated fix-verifier record and
exact-route evidence, and no observation outside the closed repair scope has
entered aggregation.

## 4. Derive and return verification

Read [`result-protocol.md`](result-protocol.md) completely. Write a draft beneath
the current scope artifact directory with the verification format, reader
attempts and regressions, evidence gaps, and authorized next action. Preserve every
original record and verifier state. Order direct regressions by causing
original finding order, then by their reader order, and derive their stable
regression keys mechanically. For a later verification, carry every prior regression
under the same key, immutable causal fields, and original guidance and resolution
evidence, and replace only its status,
progress, and evidence from `regression_attempt`. New regression orders follow
all carried regression orders. Regression order is its own sequence: when no
regression is carried, the first new regression has order `1`, regardless of
the causing original finding's order.

Finalize the draft from retained inputs:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result finalize \
  --manifest "$manifest" --draft "$draft_record" --original "$original_input" \
  --output "$verification_record" [--check "$check_record" ...]
```

Use `--output <current-artifact-dir>/verification.json` and repeat `--check`
for every captured command. Only when none applies, omit those arguments and
include an explicit `not_applicable` check in the draft. Omit original findings,
original/prior/current targets, outcome, and copied checks from the draft.
The helper reads the authoritative original input, binds targets from both
manifests, requires complete finding records, copies check receipts, validates
history, and materializes the complete `verification.md`. A prior verification
also supplies its checksum and target history mechanically. A complete external
handoff supplies its previous-verification marker and history when applicable.
Never substitute authored unavailable-check evidence for a retained receipt.

After finalization, when the original comprehensive artifact is retained, run:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result validate-original "$original_result" "$verification_record"
```

This also compares the completed ordered original set against that artifact.
Incomplete original evidence permits only a validated blocked record carrying
the actual evidence gap. If capture itself fails before a receipt exists,
preserve the failed capture command and its error through the blocked-result
validation path; do not claim that the original check executed.

The finalizer derives the outcome: `clear` when all blockers and regressions
are resolved; `continue` only for materially progressing blockers or
regressions; `no_progress` for repetition, oscillation, or unchanged failure
evidence; and `blocked` for evidence gaps or unavailable states. Advisory state
never keeps the gate open.

In default mode run:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-report render-verification "$verification_record"
```

Confirm the finalizer's report is a readable, nonempty regular file before this
renderer invocation. Make this invocation the last tool command and
copy its stdout verbatim as the entire final response. For an explicit
verification-v3, raw JSON, or machine request, return the validated JSON bytes
only. In composed use, return the selected presentation and exit this read-only
capability. The enclosing goal interprets the semantic outcome and owns every
repair, stop, goal-status, completion, and publication decision.

The `verification.md` bytes are the final response contract. Do not replace
them with a handwritten summary, even when the outcome and counts look
equivalent.

**Complete when:** the validated artifact binds original, prior, history, and
current targets; contains only original attempts and directly caused
regressions; preserves current checks; derives the honest mechanical outcome;
and is returned without changing the reviewed product content.
