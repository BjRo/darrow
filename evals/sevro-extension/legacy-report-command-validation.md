# Historical report command validation

This milestone routes both formats of `evals/runner/report.ts` through the
Darrow-owned archival interpreter. The default still writes adjacent `report.md`,
and `--output` still selects a Markdown file. JSON stays on stdout. The human
format deliberately changes to `darrow-legacy-report-v1`'s recorded facts,
completeness, measured rates, diagnostics, input digests, and retained evidence.
The old formatter and its private function tests are removed; the remaining
legacy ablation code now owns its cell type without importing the report.

## Public red/green slices

| Slice            | Observed Red                                                            | Green                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Default Markdown | The real legacy command wrote the old rollup layout                     | The same command writes the archival view to adjacent `report.md`, preserving both input files                                           |
| Protected output | Both commands accepted an input manifest as output and returned success | Both refuse input manifests, results, symbolic links, hard links, and directory aliases; an ordinary existing report remains replaceable |

The focused tests execute real CLI subprocesses. They make no model calls or
require Sevro. The first Red logs were saved before product edits and Green
runs. Canonical checks `1–4` and those logs remain at:

`/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki`

The literal commands used for each Red and Green were:

```sh
bun test evals/runner/parity/sevro-history.test.ts -t 'default historical report writes the standalone archival view' > '/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki/default-report.log' 2>&1
report_slice_exit=$?
tail -n 24 '/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki/default-report.log'
exit "$report_slice_exit"
```

```sh
bun test evals/runner/parity/sevro-history.test.ts -t 'historical report output cannot replace archive inputs' > '/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki/protected-output.log' 2>&1
report_slice_exit=$?
tail -n 24 '/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki/protected-output.log'
exit "$report_slice_exit"
```

The first slice passed with seven assertions. The second passed through both
entrypoints with 38 assertions. The hard-link variant was added before the guard
implementation; the observed Red demonstrates direct input replacement, not an
independent Red observation for every alias variant.

## Review repair: unreadable child paths

Independent review found that a result path beneath a regular file produced an
`ENOTDIR` read diagnostic, but the output-protection check raised that same error
again and prevented the diagnostic report from being written. The original
failed review remains at:

`/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.17ak3vr4/review.md`

A new public regression reproduced exit `64` through both the legacy command's
default destination and the standalone command's explicit `--output`. Treating
`ENOTDIR` as a nonexistent file identity preserves the original read diagnostic
and permits the report. Both commands now return `1`, retain the valid peer row
and absolute diagnostic path, and preserve input bytes. A genuinely invalid
output beneath the regular file still returns `64`.

Canonical checks `5–6`, the untouched first Red log `unreadable-child-red.log`,
and the Green log remain beside the earlier slices. The same literal command
ran for Red and Green; Green passed two cases with 16 assertions:

```sh
bun test evals/runner/parity/sevro-history.test.ts -t 'historical file reports retain unreadable child diagnostics and valid peers' > '/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki/unreadable-child.log' 2>&1
report_slice_exit=$?
tail -n 32 '/Users/bjro/.darrow/reviews-issue95-legacy-report-command/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.qkjtyzki/unreadable-child.log'
exit "$report_slice_exit"
```

## Interpretation and migration limits

The historical interpreter's existing public integration cases remain in
`evals/runner/parity/sevro-history.test.ts`. They cover execution declarations,
completeness, unavailable evidence, named checks, separate quality/protocol/
bookkeeping, exact grader routes, activation and advisory outcomes, contradiction
and structure diagnostics, partial checkpoints, and valid peers.

Old formatter tests asserted a retired layout through a private function. Its
cross-cell efficiency, judge-overhead, and activation rollups are no longer
synthesized for archives. Recorded summary values and distinct outcomes remain
facts; raw responses and transcripts stay in the original input artifacts.
Unversioned or unsupported suite manifests are diagnosed. Their result arrays
remain readable separately without inventing a complete suite boundary.

File destinations are checked against input paths and file identities, including
aliases. Reports replace ordinary destinations atomically. These commands do not
execute an evaluator, establish evaluator equivalence, or claim live behavioral
stability. Release/pin, CI, remaining specialized comparisons, complete caller
cutover, and generic runner removal remain separate extraction work.
