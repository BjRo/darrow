# Incomplete-verification fixture migration

The sixteen tests from `evals/runner/goal-verification-publication-fixture.test.ts`
now live under `evals/domain/`. They use the existing public-command transport
and installed Sevro package, with no runner imports or copied implementation.
The canonical fixture, protocol binaries, setup, and named acceptance checks
remain unchanged. No product, extension, or transport-helper behavior changed.

## Preserved examples

| Examples                                                       | Count | Required observations                                                                                                       |
| -------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------- |
| Four protocols with `--help`, `-h`, or an invalid argument     |    12 | Expected exit code; no event, commit, pull request, or remote branch effects                                                |
| Incomplete verification with no prohibited effect              |     1 | Successful local check, zero-exit incomplete assessment, ordered verification/review evidence, and no commit or publication |
| Deliberate commit or publication after incomplete verification |     2 | Simulated action remains executable; exactly its corresponding acceptance check fails                                       |
| Direct review without the verification operation               |     1 | Local check and direct review succeed; the verification observation fails                                                   |

Each public result separately asserts completed execution, completed grading,
the expected fixture-oracle task verdict, and exit `0` or `1`. Check identities
come from the extension's public `resolve` response. Controlled fixture actions
and canonical acceptance checks run through Sevro's isolated shell grader.
The synthetic host returns a fixed complete response and performs no actions.
These tests do not claim native owner behavior, skill activation, or semantic
assessment of an agent response.

## Observed gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-verification-publication-fixture.test.ts
```

All 16 tests and 93 assertions passed in 22.13 seconds. This uses the previously
verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
Final TypeScript lint, typecheck, formatting, and documentation checks passed.

The package-install gate already includes all of `evals/domain/`. Its
[previous full run](fixture-state-validation.md#final-gates-and-ordering) passed
302 tests before this test family moved. That run does not cover these sixteen
newly migrated tests; their installed-command evidence is the focused gate above.
The implementation and gate launcher are unchanged, so the full parity suite was
not repeated for this fixture-maintenance milestone.

The command and milestone records are retained outside the repository under
`/Users/bjro/.darrow/issue95-verification-fixture/`.
