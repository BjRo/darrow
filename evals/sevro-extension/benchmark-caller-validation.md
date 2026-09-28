# Benchmark suite caller validation

The existing `bun run eval:orchestration` and `evals/runner/suite.ts` caller now
selects Sevro through an explicit package or checkout route. The default
backend remains legacy until release pinning. Darrow owns the argument mapping;
execution, result retention, and reports use the existing public suite route.

## Test-first trace

Run from the issue-95 Darrow worktree. The complete literal commands below were
run for the corresponding Red and Green captures:

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-benchmark-caller.test.ts -t "benchmark caller routes a filtered dry suite through Sevro" > '/Users/bjro/.darrow/reviews-issue95-benchmark-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.e5wktvlr/slice-1.log' 2>&1
caller_slice_exit=$?
tail -n 16 '/Users/bjro/.darrow/reviews-issue95-benchmark-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.e5wktvlr/slice-1.log'
exit "$caller_slice_exit"
```

- Red (`check-2.json`): the unchanged caller rejected `--project-root`.
- Green (`check-5.json`): one test passed with 25 assertions. Two native host
  routes and two modes retained the filtered case, evidence limits, fixed seed,
  candidate overrides, and separate semantic route. Dry task verdicts stayed
  unassessed. The external host executable is synthetic.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-benchmark-caller.test.ts -t "benchmark caller keeps grader routes separate and continues after task failure" > '/Users/bjro/.darrow/reviews-issue95-benchmark-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.e5wktvlr/slice-2.log' 2>&1
caller_slice_exit=$?
tail -n 16 '/Users/bjro/.darrow/reviews-issue95-benchmark-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.e5wktvlr/slice-2.log'
exit "$caller_slice_exit"
```

- Red (`check-6.json`): the migration caller rejected `--semantic-check-model`.
- Green (`check-12.json`): one test passed with 16 assertions. A synthetic Codex
  task failed in the baseline and passed in the next mode. Semantic and advisory
  routes stayed fixed while the candidate changed. An advisory failure did not
  change the passing task verdict.

Captures are retained under:

`/Users/bjro/.darrow/reviews-issue95-benchmark-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.e5wktvlr/`

Intermediate failures corrected fixture assumptions: macOS canonical temporary
paths, declaring semantic checks before expecting their retained route, keeping
host executables outside the protected project, Codex's native `-m` argument,
and reading advisory detail from the public trial artifact instead of the
concise CLI result. These fixture failures supply no product-behavior Red.
The full focused suite then passed six tests with 77 assertions, covering
default storage, owned-option refusal, invalid explicit routes, unsupported
enforcement without candidate launch, and SIGTERM's cancelled prefix.

## Final gates and limits

The final candidate runs typecheck, focused ESLint and Prettier, documentation
validation, and installed-package parity. The package gate uses Sevro
`0.1.0-dev.0` with archive SHA-256
`dedf9c6b37319b24d3a903476c1adb2c078cc3c339d342eca768be376600abb5`, installs it
into a separate consumer, and clears `SEVRO_CHECKOUT` for the full parity suite.
A dry caller invocation also prepares the real adaptation study's selected
`preflight-terra` mechanical cell. This confirms caller mapping and preparation;
it is not a measured task result.

The command deliberately replaces legacy console tables and per-host arrays
with the Sevro suite's JSON summary, raw public results, and separate reports.
Ablation outputs require external storage. Native Claude graders, retired private
goal policies, and bundled-host enforced execution remain explicit unsupported
requests. No condition is downgraded, and no historical measurement becomes a
new Sevro measurement. Published pinning, default cutover, installed CI, and
generic runner removal remain pending.
