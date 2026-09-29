# Verification-cadence fixture migration

The eleven tests from `evals/runner/goal-cadence-fixture.test.ts` now live under
`evals/domain/`. They use the existing public-command transport and installed
Sevro package, with no runner imports or copied implementation. The canonical
cadence acceptance check is unchanged. No product, extension, or transport-helper
behavior changed.

## Preserved examples

| Trace examples                                                                                                     | Count | Required observations                                          |
| ------------------------------------------------------------------------------------------------------------------ | ----: | -------------------------------------------------------------- |
| Red, green, final; repeated final; repaired final; baseline then red, green, final; redundant focused confirmation |     5 | Canonical cadence check passes                                 |
| Missing red; missing green; baseline without final; last final failed; later focused failure; no evidence          |     6 | Trace recording succeeds but the canonical cadence check fails |

The migrated tests retain the original trace text, including the blank line for
no evidence. They write it into the canonical fixture through a controlled shell
check, then run the unchanged named acceptance check. Both checks execute in
Sevro's isolated shell grader. Each public result separately asserts completed
execution, completed grading, the expected task verdict, and exit `0` or `1`.
Check identities come from the extension's public `resolve` response.

These are synthetic oracle traces. The host returns a fixed complete response
and performs no actions. This migration does not claim a native owner followed
TDD, ran a verification command, or selected a skill.

## Observed gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-cadence-fixture.test.ts
```

All 11 tests and 66 assertions passed in 13.71 seconds. This uses the previously
verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
Final TypeScript lint, typecheck, formatting, and documentation checks passed.

The package-install gate already includes all of `evals/domain/`. Its
[previous full run](fixture-state-validation.md#final-gates-and-ordering) passed
302 tests before this test family moved. That run does not cover these eleven
newly migrated tests; their installed-command evidence is the focused gate above.
The implementation and gate launcher are unchanged, so the full parity suite was
not repeated for this fixture-maintenance milestone.

The command and milestone records are retained outside the repository under
`/Users/bjro/.darrow/issue95-cadence-fixture/`.
