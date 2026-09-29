# Review outcome fixture migration

The sixty tests from `evals/runner/review-outcome-eval-checks.test.ts` now live
under `evals/domain/` and use the installed Sevro command. They import no legacy
runner implementation or private types. Canonical plugin fixture setup and
acceptance check bodies are unchanged. No product or Sevro behavior changed.

## Preserved observations

| Examples                     | Count | Required observations                                                                                                   |
| ---------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------- |
| Package setup                |     8 | The prior manifest names the generated repository; the enclosing-goal example selects the copied owning backend         |
| Unavailable check evidence   |     8 | Captured and alternate actual diagnostics pass; invented evidence or missing capture fails                              |
| Resolved finding states      |     4 | All resolved states pass; an unresolved advisory fails despite misleading evidence prose                                |
| Complete report presentation |    40 | Canonical reports pass for five cases under both shell paths; matching summaries, empty reports, and stale records fail |

Each artifact oracle runs under both `bash` and `/bin/bash`. Controlled actions
write the original record bytes and render reports through the review package's
actual frozen entrypoint. The second-round example still places a prior artifact
after the current artifact in sort order and gives it no report. Its input binds
the exact prior path; the unchanged canonical check must select the current
record. Blank lines remain insignificant for presentation checks.

Every public result separately asserts process exit, execution, grading, task
verdict, and all action and oracle statuses. Negative examples retain the failed
canonical oracle, while their preparation and rendering actions must pass.
These are synthetic fixture and artifact tests; they do not establish native
reviewer delegation, model routes, or live semantic response quality.

## State and package preparation

The transport copies each explicitly declared owning plugin into temporary
assets. It normally excludes tests and caches. Setup cases explicitly include
the one packaged hidden oracle they require,
`backend/tests/evals/eval_routes.py`; canonical setup copies it into its reserved
grading directory. Explicit files must resolve inside their owner and their
destination must remain inside copied assets. The tests do not mount that oracle
as participant guidance.

The current review contract requires an absolute state root outside the
repository. The old test fixtures placed synthetic review artifacts under
`.git`; the migration puts them in a separate temporary root owned by the user,
created with restricted access. Setup binds that root, grading reads its exact
path from a fixture record, and test cleanup removes it. It also sits outside
the protected source project, so existing isolation rules remain intact.
Package setup still validates the same repository manifest or owning package;
the package-path assertion now names its explicitly copied counterpart.

Initial maintenance failures identified a shell-variable interpolation error,
the review command's absolute-path and outside-repository requirements, and an
attempt to put state under the protected source project. Corrected fixture
transport addresses those causes. Temporary setup diagnostics were removed.
No TDD Red or product regression claim is made.

The shared public Python runtime and explicit UV forwarder prepare frozen
environments during setup. Isolated grading stays offline. Source checkouts,
generic private state, and marketplace plugins are not modified.

## Validation

The seven focused setup and positive artifact examples pass, including the
second-round case under both shell paths (35 assertions, 20.66 seconds).
The final gate includes all sixty migrated tests plus the readiness and
composition consumers of shared asset preparation:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/review-outcome-eval-checks.test.ts evals/domain/goal-readiness-fixture.test.ts evals/domain/composition-fixture.test.ts
```

All 73 tests and 378 assertions across three files passed in 205.64 seconds.
The gate includes all sixty migrated tests and both other consumers of asset
preparation. It uses the verified installed Sevro `0.1.0-dev.0` archive from
`ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
ESLint, typecheck, formatting, and documentation checks pass; documentation
checks cover 238 Markdown pages and 16 plugins. The full parity gate was not
repeated because generic engine and extension behavior are unchanged.

Milestone records and the updated inventory are retained under
`/Users/bjro/.darrow/issue95-review-outcome/` and
`/Users/bjro/.darrow/issue95-runner-ownership/`.
