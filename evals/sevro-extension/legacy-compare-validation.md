# Historical comparison validation

This milestone removes the historical array comparison command's imports of
generic runner types and execution helpers. The documented
`evals/runner/compare.ts` command delegates to Darrow-owned standalone tooling.
The comparison reports recorded claims, with explicit limitations on run
completeness and evaluator equivalence. It does not supply Sevro run identity.

## Public red/green slices

All four slices used a real CLI subprocess with only PATH in its environment.
The first, third, and fourth exercise the existing comparison command. The
second compares its output with a copied standalone entrypoint and evidence
reader in a temporary directory without generic runner files, Sevro, Git, or
credentials.

| Slice                   | Observed Red                                           | Green                                                                                                 |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Missing identity        | Two absent invariants produced a successful pass delta | Each required missing identity field is incomparable                                                  |
| Standalone command      | The standalone entrypoint was absent                   | Copied Darrow files and the existing command produce the same deltas and limitations                  |
| Invalid arrays          | Empty arrays exited successfully                       | Empty, duplicate, invalid identity, invalid quantitative, and empty-trial inputs fail before deltas   |
| Changed instrumentation | Passive and enforced records compared successfully     | Changed requested/observed policy, token accounting, graders, or effective owner routes refuse deltas |

Each slice ran the same literal command for Red and Green. The complete first
Red logs were retained before their command's Green run. Canonical checks
1–8 and those logs are retained at:

`/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b`

The commands, including capture and exit propagation, were:

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison refuses matching missing identity' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/identity.log' 2>&1
compare_slice_exit=$?
tail -n 14 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/identity.log'
exit "$compare_slice_exit"
```

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison works without the generic runner' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/standalone.log' 2>&1
compare_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/standalone.log'
exit "$compare_slice_exit"
```

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison rejects invalid archival arrays' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/invalid.log' 2>&1
compare_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/invalid.log'
exit "$compare_slice_exit"
```

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison refuses changed grading and instrumentation' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/instrumentation.log' 2>&1
compare_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/instrumentation.log'
exit "$compare_slice_exit"
```

## Regression coverage and limits

The parity file also preserves dry/unknown refusal, metric improvement
directions, unknown optional quantities, and contradiction handling. The old
comparison test's two provenance cases moved into this Darrow-owned integration
coverage and no longer import the generic result type.

Fixtures are synthetic archival records. This is deterministic command and
interpretation evidence; it does not establish live model quality, evaluator
equivalence, or complete historical run boundaries. No archive is rewritten.
The existing two-positional command remains available; no JSON comparison
protocol or comparison of suite manifests/checkpoints is introduced.

## Review repair

The initial independent review found one Standards blocker: coercing a metric
value with `String(...)` admitted arrays such as `["escaped_defect"]`, which
strict metric calculations then omitted. The initial Spec reader could not
start because the host returned `agent thread limit reached`. The full
canonical FAIL report preserves both facts:

`/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.gnk63jmb/review.md`

A fifth public red/green slice reproduced the malformed metric's successful
comparison, then required primitive string metric labels. The same literal
command produced Red (`check-9.json`) and Green (`check-10.json`), with its first
complete log preserved as `metric-shape-red.log` beside the earlier slices.
The regression rejects arrays for each of the three metric names, preserves
input bytes, and emits no pass delta. Existing valid scalar metric coverage
remains applicable.

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison refuses array-valued metric labels' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/metric-shape.log' 2>&1
compare_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/metric-shape.log'
exit "$compare_slice_exit"
```

The next independent Standards review found a second blocker: serializing
instrumentation as JSON made equivalent owner routes differ when their property
order changed. Its Spec reader again could not start because of the host thread
limit. The second canonical FAIL report remains preserved:

`/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.gzx5_hpy/review.md`

A sixth public red/green slice exercises both documented entrypoints. Red
rejected identical owner-route values in different property orders. Green uses
structural comparison, retains their recorded deltas, and still rejects an
actual route-value change. Both cases preserve the input bytes. The same command
produced Red (`check-11.json`) and Green (`check-12.json`); its complete first Red
log is retained as `owner-route-order-red.log` beside the earlier slices.

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison compares owner route values regardless of property order' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/owner-route-order.log' 2>&1
compare_slice_exit=$?
tail -n 24 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/owner-route-order.log'
exit "$compare_slice_exit"
```

These records supply implemented repairs and deterministic evidence. They make
no independent fix-verification or Spec PASS claim.

The next complete independent review passed Spec and found one Standards
blocker: a case's recorded pass rate could contradict its failed trial outcomes.
The canonical FAIL report remains preserved:

`/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.v3m4hnvq/review.md`

A seventh public red/green slice reproduced the false improvement through both
entrypoints. Green rejects a rate outside the range allowed by recorded boolean
trial outcomes; missing outcomes remain unknown. It does not infer a planned
trial total. The control retains a valid recorded failure rate of zero, and both
cases preserve input bytes. The same command produced Red (`check-13.json`) and
Green (`check-14.json`); `rate-consistency-red.log` preserves the complete first
Red beside the earlier slices.

```sh
bun test evals/runner/parity/sevro-legacy-compare.test.ts -t 'historical comparison refuses rates that contradict recorded trials' > '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/rate-consistency.log' 2>&1
compare_slice_exit=$?
tail -n 24 '/Users/bjro/.darrow/reviews-issue95-legacy-compare/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.terd7_0b/rate-consistency.log'
exit "$compare_slice_exit"
```
