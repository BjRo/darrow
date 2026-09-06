# Fix-verification workflow

Use this workflow only after the main skill selects fix verification. The main
skill's presentation, read-only, and Native reader acceptance gates remain in
force throughout this branch.

## 1. Bind the closed finding set

Require all of these caller-owned inputs before reader calls:

- the exact original comprehensive-review target fingerprint;
- the validated original or immediately prior scope manifest for that target;
- every original finding with its original axis, severity, disposition,
  location, source, evidence, and one canonical cross-axis order;
- the immediately prior repair target plus every earlier repair target;
- every finding attempted by the current repair;
- the immediately prior validated verification artifact when an earlier fix
  verification exists, including all carried regression records; and
- current deterministic-check commands and evidence.

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

Resolve the same bundled `review-scope`, `review-result`, and `review-report`
tools as comprehensive mode. Validate the prior scope manifest and require its
target to equal the supplied prior target and its effective base to equal the
current scope's effective base. For the first verification, use the scope
manifest retained by the comprehensive run; a fresh invocation may locate it
only when exactly one validated artifact beneath the repository Git directory
has that target. For a later verification, validate the immediately prior
verification artifact and use its sibling scope manifest. Missing or ambiguous
prior artifacts block.

Prepare the exact current base/target scope with the ordinary scope table plus:

```sh
bash "$scope_tool" prepare --repo "$repo" --base "$base" --target "$target" \
  [working-tree flags] --allow-empty --prior-manifest "$prior_scope_manifest"
```

Treat its target fingerprint, absolute manifest, changed paths, fixed show
command, and `repair_show_command` as authoritative. The current target must
not be copied from caller prose. `--allow-empty` is fix-verification-only: it
permits an exact repair that restored the base while the pinned
prior-to-current repair delta still exposes what changed. Run the
`repair_show_command` and use only that mechanical delta—not caller-described
changes—to establish repair causality.

Run only applicable deterministic checks invalidated by the repair, recording
their literal command, applicability, status, and concise evidence. A check
failure belongs in the convergence set only as evidence for a direct
repair-caused regression tied to an attempted original finding. An unavailable
required check is an evidence gap and blocks verification.

**Complete when:** current content and checks are exact-target-bound and no
reader has been asked to inspect an unpinned or stale target.

## 3. Invoke isolated fix verifiers

Read [`axis-prompts.md`](axis-prompts.md) and
[`reader-routing.md`](reader-routing.md) completely. Resolve and retain the
concrete reviewer route beside the current scope manifest. Group attempted
findings by their original axis. Invoke the applicable Standards and Spec fix
verifiers through that exact route as fresh readers, issuing both invocations
before waiting when both groups exist. Do not invoke an axis with no attempted
finding and no regression evidence to verify.

Apply the main skill's Native reader acceptance gate immediately after each
launch. Write down the returned child ID before any wait. No child ID becomes
an `evidence_gap`; it never permits coordinator verification of an attempted
finding.

Each verifier receives only:

- its original-axis finding records and stable keys;
- active prior regression records for its axis, preserving stable keys and
  immutable causal fields;
- the original, prior, history, and current target fingerprints;
- the validated prior verification artifact or explicit first-verification
  marker;
- the authoritative prior/current manifests, fixed repair-delta show command,
  and changed paths relevant to those findings;
- current deterministic-check evidence; and
- its isolated fix-verifier schema.

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

Save each raw fix-axis record beneath the current scope artifact directory and
run the applicable commands:

```sh
bash "$result_tool" validate-fix-axis standards "$standards_fix_record"
bash "$result_tool" validate-fix-axis spec "$spec_fix_record"
```

An invalid record or missing or mismatched route-application evidence is an
evidence gap. Do not retry on another route.

**Complete when:** each attempted axis has one isolated fix-verifier record and
exact-route evidence, and no observation outside the closed repair scope has
entered aggregation.

## 4. Derive and return verification

Read [`result-protocol.md`](result-protocol.md) completely. Assemble
`verification.tsv` beneath the current scope artifact directory. Preserve every
original record and verifier state. Order direct regressions by causing
original finding order, then by their reader order, and derive their stable
regression keys mechanically. For a first verification write
`previous_verification none none`. For a later verification write the prior
artifact's Git blob checksum and absolute path, carry every prior regression
under the same key and immutable causal fields, and replace only its status,
progress, and evidence from `regression_attempt`. New regression orders follow
all carried orders.

Run:

```sh
bash "$result_tool" validate-verification "$verification_record"
```

The validator derives the outcome: `clear` when all blockers and regressions
are resolved; `continue` only for materially progressing blockers or
regressions; `no_progress` for repetition, oscillation, or unchanged failure
evidence; and `blocked` for evidence gaps or unavailable states. Advisory state
never keeps the gate open.

In default mode run:

```sh
verification_report="$(dirname "$verification_record")/verification.md"
bash "$report_tool" render-verification "$verification_record" >"$verification_report"
bash "$report_tool" render-verification "$verification_record"
```

Confirm that the report is a readable, nonempty regular file before the second
renderer invocation. Make that second invocation the last tool command and
copy its stdout verbatim as the entire final response. For an explicit
verification-v1, raw TSV, or machine request, return the validated TSV bytes
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
