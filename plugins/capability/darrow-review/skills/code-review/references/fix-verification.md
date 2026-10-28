# Bind a repair verification

Use this branch only for an explicitly requested repair verification. Keep the
main skill's repository binding, independent native readers, read-only behavior
and presentation. Verify attempted findings and their direct repair-caused
regressions; unrelated observations stay outside the closed finding set.

## Read the supplied evidence

Read each caller-supplied file through the bundled boundary before deciding
that evidence is missing. Relative paths resolve against the bound repository;
extensionless JSON is valid input.

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-result read-evidence \
  --repo "$repo" --input '<supplied path>'
```

Use the returned absolute path as `original_input` and inspect its complete
record. For a supplied directory, inspect that exact directory before choosing
its relevant files. Preserve actual path-specific read/validation errors; an
empty search result does not establish absence.

The authoritative input is one of:

- The original comprehensive `result.json` for the first follow-up, with its
  sibling `scope.json` as the prior manifest.
- The immediately previous `verification.json` for a later follow-up, with its
  sibling scope. Keep that checksum-bound assessment, its complete original
  findings, carried regressions and target history.
- A complete external handoff supplying the original target, complete immutable
  ordered findings, prior target/manifest, attempted set and any prior
  verification. The original comprehensive file is not additionally required.

Every original finding and carried regression needs its source, evidence,
advisory repair guidance and resolution evidence. A citation does not replace
the source material needed to judge it. Read necessary requirement or
maintenance documents separately. Missing fields or inconsistent history block;
do not reconstruct records from a prose report or invent guidance.

If the handoff supplies an exact prior target without a manifest path, locate
that exact target:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-scope locate \
  --repo "$repo" --target '<prior target>'
```

Use its unique validated manifest. Do not scan `.git`, guess a run or choose by
filename order. Prior and current manifests must identify the bound repository.

## Pin the repair

Use the main skill's scope table for the current target/layers. Derive the
effective base from the validated prior manifest by omitting `--base`:

```sh
uv run --quiet --no-project "$backend/scripts/run_locked.py" review-scope prepare \
  --repo "$repo" --target "$target" --allow-empty \
  --prior-manifest "$prior_scope_manifest" [working-tree flags]
```

Keep the returned manifest, current fingerprint and fixed repair-show command.
The prior/current comparison must share the same effective base. `HEAD` is not
a replacement base for a prior branch review. `--allow-empty` permits a repair
that restores the base; the prior-to-current delta still establishes causality.
Caller prose cannot establish that delta.

Return to **step 2 of the main skill**. Capture current applicable authorized
checks through `review-check`, including an unavailable command's actual blocked
capture. A failed capture is an evidence gap, not a claim the check ran.

Prepare only axes with attempted original findings or carried regressions.
Pass `--original "$original_input" --attempted-from-input` when the handoff
supplies the attempted set; the helper copies only its original keys for this
axis, leaving carried regression keys separate. For a caller-selected subset
without a handoff attempted list, use the context's explicit `attempted` list.
The helper copies the
closed original-axis evidence and validates scope/history. Do not copy original
rows or their keys into a new shortened handoff. An original blocker needs a
current state unless permitted prior resolved evidence is carried mechanically.
An ineligible advisory may remain unattempted.

Readers judge each attempted finding as resolved, unresolved or blocked.
Unresolved blockers progress only when concrete evidence narrows the failure;
unchanged evidence is no progress. A new direct regression names its causing
attempted original key and receives the verifier's own guidance. Resolution
depends on required behavior, including valid alternative repairs, rather than
adoption of the original suggestion. Advisories never keep the gate open.

In the main skill's **finalization phase**, pass raw fix-reader records and `--original "$original_input"`
to finalization. It preserves findings and checks, carries permitted prior
states, copies verifier evidence, assigns stable regression identities/order,
and saves `verification.json` plus `verification.md`. No coordinator-written
verification draft or regression bookkeeping is needed on this normal path.

The helper derives `clear` when all blockers/regressions resolve, `continue`
for material progress, `no_progress` for unchanged failure, repetition or
oscillation, and `blocked` for unavailable evidence. Explain that outcome and
remaining blockers/advisories inline under the main presentation rule.

## Assessment corrections and evidence gaps

A caller may request correction of a concrete assessment error at unchanged
code. Retain the immediately prior verification and same-candidate scope;
obtain fresh independent evidence for every original blocker and carried
regression. Use the [result protocol](result-protocol.md) draft path with a
nonempty `assessment_correction` describing the prior error and new evidence.
Preserve prior checksum/history and artifacts. This does not reset an owner's
repair allowance. An empty original set is valid for a retained blocked
assessment; never invent a finding to fill it.

Use that same exceptional protocol for missing original evidence, unavailable
readers or failed capture. Preserve the exact gap and any supported findings.
A correction marker cannot bypass failed checks or unresolved evidence, and
missing fix inputs never authorize a comprehensive rereview.
