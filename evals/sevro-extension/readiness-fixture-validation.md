# Readiness fixture migration

The nine tests from `evals/runner/goal-readiness-fixture.test.ts` now live under
`evals/domain/`. They use the public-command transport and installed Sevro
package, with no runner imports or copied implementation. The canonical fixture
protocols, backend, templates, and named acceptance checks remain unchanged.
No product, Sevro, or marketplace plugin behavior changed.

## Preserved examples

| Examples                                                           | Count | Required observations                                                                                                                                                       |
| ------------------------------------------------------------------ | ----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One ready, repeated ready, absent, and non-ready assessment traces |     4 | Only nonempty ready-only traces clear the canonical readiness check                                                                                                         |
| String-only normalization                                          |     1 | Original string acceptance passes while later undefined-input acceptance fails                                                                                              |
| Caller inspection                                                  |     1 | Readiness succeeds; inspection explicitly names `normalize(undefined)` and the empty-string outcome                                                                         |
| Reassessment before edit, omitted, or after edit                   |     3 | All controlled actions succeed and compatible normalization passes; only reassessment before mutation clears the readiness check; the parser and authority remain preserved |

Each public result separately asserts execution, grading, task verdict, and
exit. Check identities come from the extension's public `resolve` response.
Controlled actions and assertions execute in Sevro's isolated shell grader.
The synthetic host returns a fixed complete response and performs no actions.
These tests do not claim a native owner selected readiness or retained ownership.

## Asset and tool preparation

The transport copies an explicitly supplied domain plugin root into its temporary
project, excluding runtime environments, caches, tests, and Git metadata. It
requires the canonical case to belong to that root and binds `{{case_dir}}` to
the copied case directory through a safely quoted shell variable. This preserves
the fixture's backend and template relationships without writing to source
checkouts or copying generic runner code.

The post-launch test binds Node and UV through declared fixture tools, prepares
the copied backend's frozen environment during setup, and disables downloads
during grading. It locates an existing Python 3.13 installation without download,
then copies that public runtime into a disposable temporary directory outside
the project and developer home. Both setup and grading use this copy. Test
cleanup removes it after the fixture run. The sandbox's protected roots and
network denial remain unchanged.

The first translation failed because the public fixture format rejects `.git`
files in ordinary file declarations, and isolated checks do not inherit the
developer shell's tool paths. Synthetic traces now use a controlled shell action,
preserving their original bytes. Explicit Node and UV bindings fixed tool lookup.
UV then lacked compatible Python; binding the original home-directory interpreter
exposed the intended home protection. A temporary fixture-only diagnostic capture
identified that rejected path and was removed. The disposable public runtime
fixed the harness without relaxing isolation. These were fixture-maintenance
failures, not TDD Red evidence.

## Focused gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-readiness-fixture.test.ts
```

All 9 tests and 58 assertions passed in 23.54 seconds. This uses the previously
verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.

## Final domain gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain
```

All 93 tests and 461 assertions passed across 9 files in 113.76 seconds. This
includes the current helper and all migrated fixture families. Final TypeScript
lint, typecheck, formatting, and documentation checks passed.

The [previous full installed-package gate](capability-fixture-validation.md#final-installed-gate)
passed 346 tests before this test family moved and before asset preparation was
added to the transport. It does not cover these nine new tests; their current
installed-command evidence is above. Product and gate-launcher code are
unchanged, so full parity was not repeated for this fixture-maintenance milestone.

The command and milestone records are retained outside the repository under
`/Users/bjro/.darrow/issue95-readiness-fixture/`.
