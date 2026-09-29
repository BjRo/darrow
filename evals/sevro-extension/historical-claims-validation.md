# Historical owner-route and orchestration claims

Issue [#95](https://github.com/BjRo/darrow/issues/95) requires preserving exact
model/effort routes and historical interpretation. The old runner persisted
`routeApplication` and `orchestrationMetrics` on trials. The standalone historical
reader retained their case summaries but dropped these per-trial fields.

The existing `evals/runner/report.ts` and standalone
`evals/sevro-extension/legacy-report.ts` commands now retain that known metadata
under each trial's `recorded` object in `darrow-legacy-report-v1`. Markdown's
retained-evidence section uses the same view. Original archive bytes remain
unchanged.

## Retained meaning

| Archived field         | Retained claims                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `routeApplication`     | Selected and effective harness/provider/model/effort routes; profile, workflow, risk, workflow file/digest, dimension stage, verification gate, application and launch boundaries, child count and token usage |
| `orchestrationMetrics` | Child invocation count, human interruptions, escaped defects, and false-positive verifier findings                                                                                                             |

Only the known fields are exposed. Unrelated contract and raw payload fields
are omitted. Missing objects and scalar values stay null. Explicit zero counts
remain zero; provided counters must be nonnegative safe integers. Malformed
objects and counters produce archive diagnostics and report exit 1, with valid
peer inputs and their digests retained. Invocation and output errors keep their
existing exit 64 contract.

These values are recorded claims. They do not supply independent native owner
acceptance, populate `effectiveOwnerRoute`, change execution or measured task
outcomes, or establish current evaluator equivalence. The interpreter reads
stored metadata and does not reconstruct private contracts or their removed
runtime machinery. Original snapshots keep their original interpretation.

The first test retains different selected and effective owner routes beside the
separate parent candidate route, while a failed task stays measured as failed.
It also checks missing route metadata and omitted private payloads. The second
preserves complete, partial, and missing counters, including explicit zero and
unknown values. Six malformed peer inputs cover wrong object shape, negative,
fractional, string, and unsafe integer counts, and a malformed selected route.
Both command entrypoints retain those diagnostics and leave inputs unchanged.

## Observed test-first slices

The public commands are the stable seam. Fixtures contain controlled archival
records, and assertions use independently specified route and count values.
Tests import no generic runner implementation or private types.

Red — `bun test evals/runner/parity/sevro-history.test.ts --test-name-pattern 'historical reports retain owner-route applications as archival claims'`: one failed test; recorded route application was undefined.

Green — `bun test evals/runner/parity/sevro-history.test.ts --test-name-pattern 'historical reports retain owner-route applications as archival claims'`: one passed test, 20 assertions, 92 milliseconds.

Red — `bun test evals/runner/parity/sevro-history.test.ts --test-name-pattern 'historical reports retain orchestration counts and reject malformed archival claims'`: one failed test; recorded orchestration metrics were undefined.

Green — `bun test evals/runner/parity/sevro-history.test.ts --test-name-pattern 'historical reports retain orchestration counts and reject malformed archival claims'`: one passed test, 58 assertions, 158 milliseconds.

The route slice passed before the metric test or implementation was added.
Formatting followed both Green results. The subsequent affected gate reran
both slices alongside the historical report, comparison, and ablation coverage.

## Gates and remaining scope

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/runner/parity/sevro-history.test.ts evals/runner/parity/sevro-legacy-compare.test.ts evals/runner/parity/sevro-ablation.test.ts
```

The affected gate passed 88 tests with 655 assertions across three files in
5.90 seconds. This includes standalone use without the generic runner, protected
archive outputs, historical comparison eligibility, and unmeasured dry ablation.
The commands interpreting archives require no Sevro package, Git metadata,
credentials, or model calls. The installed command variable identifies the same
reviewed rc for any package-dependent path in the gate.

ESLint for the two changed TypeScript files and Darrow typecheck passed.
Raw traces and the gate log are retained under
`/Users/bjro/.darrow/issue95-historical-claims/`.

The Sevro archive is unchanged. Its prior 513-test full installed gate and live
Claude guide result keep their earlier Darrow source identities; this milestone
claims the new affected gate, rather than relabeling those earlier results.

The remaining old report/readiness parsing and mixed ticket-pipeline/usage policy
must still be reconciled before their implementations are retired. Publication,
the exact registry pin, default caller cutover, generic runner removal, and
automatic installed CI acceptance remain part of issue #95.
