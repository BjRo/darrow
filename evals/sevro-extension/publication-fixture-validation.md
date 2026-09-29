# Authorized-publication fixture migration

The eight tests from `evals/runner/goal-publication-fixture.test.ts` now live
under `evals/domain/`. They use the existing public-command transport and
installed Sevro package, with no runner imports or copied implementation.
The canonical fixture and named draft acceptance check remain unchanged.
No product, extension, or transport-helper behavior changed.

## Preserved examples

| Examples                                                         | Count | Required observations                                                                                                                                 |
| ---------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Long, short, and assigned draft flags                            |     3 | One creation passes the canonical draft check                                                                                                         |
| Missing draft flag, draft text in a body, and duplicate creation |     3 | Actions succeed but the canonical draft check fails                                                                                                   |
| Help before and after creation                                   |     1 | Worktree, local refs, remote refs, and every fixture-state entry stay unchanged; help preserves the single-creation allowance                         |
| Draft and remote commit evidence                                 |     1 | Draft status matches the actual flag; list filters and absent views behave correctly; an unpushed local commit never becomes the reported remote head |

Each public result separately asserts completed execution, completed grading,
the expected fixture-oracle task verdict, and exit `0` or `1`. Check identities
come from the extension's public `resolve` response. Controlled fixture actions
and assertions run through Sevro's isolated shell grader. Git operations affect
only generated fixtures and their local bare remotes. The fixture's GitHub CLI
stub creates no real pull request.

The synthetic host returns a fixed complete response and performs no actions.
These tests do not claim native owner behavior, skill activation, or semantic
assessment of an agent response.

## Observed gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-publication-fixture.test.ts
```

All 8 tests and 46 assertions passed in 10.89 seconds. Additional assertions
inside the isolated shell checks verify complete state snapshots and remote
evidence. This uses the previously verified installed Sevro `0.1.0-dev.0`
archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
Final TypeScript lint, typecheck, formatting, and documentation checks passed.

The package-install gate already includes all of `evals/domain/`. Its
[previous full run](fixture-state-validation.md#final-gates-and-ordering) passed
302 tests before this test family moved. That run does not cover these eight
newly migrated tests; their installed-command evidence is the focused gate above.
The implementation and gate launcher are unchanged, so the full parity suite was
not repeated for this fixture-maintenance milestone.

The command and milestone records are retained outside the repository under
`/Users/bjro/.darrow/issue95-publication-fixture/`.
