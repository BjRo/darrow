# Seeded suite ordering validation

This issue-95 migration slice restores legacy `--seed` through Darrow's suite
command. Darrow shuffles selected host/mode blocks and expands each block into
sorted case IDs. Sevro still receives one public command per case. The seed
does not enter case identity or relax comparison eligibility.

## Test-first trace

Run from the issue-95 Darrow worktree. These literal commands were run before
and after their respective implementation slices:

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-suite.test.ts -t "suite seeded execution preserves legacy block order and replay"
```

- Red: the public suite command rejected `--seed` as an unknown option.
- Green: one test passed, with 22 assertions. Two runs with `order-95` retained
  the expected eight-cell plan; `order-96` changed the order. Both synthetic
  hosts executed all planned cells with consecutive indices. The expected
  order is a fixed legacy reference example, not a copied shuffle in the test.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-suite.test.ts -t "suite interruption cancels the active Sevro cell and stops selection"
```

- Red: after the first synthetic host signalled readiness, reading
  `suite-run.json` failed with `ENOENT`. The full plan was not retained yet.
- Green: one test passed, with 20 assertions. Before cancellation the manifest
  contained all four planned cells and no completed cells. SIGTERM retained
  the same plan and its one-cell cancelled prefix, exited `143`, and left task
  quality unmeasured.

The retained captures are `check-1.json`/`check-2.json` for replay and
`check-4.json`/`check-5.json` for cancellation under:

`/Users/bjro/.darrow/reviews-issue95-order/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.ar3moljb/`

The first cancellation fixture edit put its seed in another test. It was
corrected before the authoritative Red capture and before adding initial
manifest persistence. Existing order-sensitive fixtures now use the fixed seed
`existing-order-1`; their asserted routes and conditions stay unchanged. A
separate public test covers an omitted timestamp seed, an empty seed, and
selection of only `suite-beta` in passive mode.

## Gates and limits

The final candidate uses these deterministic gates:

```sh
bun run typecheck
bun run lint:ts evals/sevro-extension/suite.ts evals/runner/parity/sevro-suite.test.ts
bunx prettier --check docs/specs/skill-evaluation.md evals/sevro-extension/suite.ts evals/runner/parity/sevro-suite.test.ts evals/sevro-extension/README.md evals/sevro-extension/migration.md evals/sevro-extension/ordering-validation.md
bun run check:docs
SEVRO_PACKAGE_TARBALL=/absolute/path/to/sevro-0.1.0-dev.0.tgz bun run test:eval-runner-sevro-package
```

The package gate installs the candidate tarball into a separate consumer
directory and runs the full Darrow parity suite without `SEVRO_CHECKOUT` or
Sevro Git metadata. The candidate archive's SHA-256 is
`dedf9c6b37319b24d3a903476c1adb2c078cc3c339d342eca768be376600abb5`.
The initial package-gate invocation supplied an argument instead of the
required `SEVRO_PACKAGE_TARBALL` environment variable and was corrected; that
setup failure supplies no behavior evidence.

These checks use synthetic adapters and host executables. They establish
ordering, retention, and protocol parity, without measuring native task
quality or proving enforcement support. Published package pinning, normal
benchmark caller cutover, installed CI, and generic runner removal remain
pending.
