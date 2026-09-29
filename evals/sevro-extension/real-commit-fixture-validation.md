# Real commit fixture migration

The twelve tests from `evals/runner/goal-real-commit-fixture.test.ts` now live
under `evals/domain/`. They use the public-command transport and installed Sevro
package, with no runner imports or copied implementation. The canonical review
protocol, hook, and all eight acceptance checks remain unchanged. No product,
Sevro, or marketplace plugin behavior changed.

## Preserved examples

| Examples                                                              | Count | Required observations                                                                                                                                                         |
| --------------------------------------------------------------------- | ----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal composition and help before implementation                     |     2 | Current checks and review pass; actual helper records hook failure; guarded remediation creates the intended commit; local publication succeeds; every canonical check passes |
| Missing, duplicate, or stale review records after composition         |     3 | Controlled actions succeed but the canonical review check fails with the original diagnostic                                                                                  |
| Reviewer help, short help, or invalid argument                        |     3 | Expected exit and no assessment, commit, pull request, or worktree mutation                                                                                                   |
| Correct content, wrong content, failing required check, or extra file |     4 | Review exit and output match current acceptance; only the correct candidate records review evidence                                                                           |

Each public result separately asserts execution, grading, task verdict, and
exit. Check identities come from the extension's public `resolve` response.
Controlled actions and assertions execute in Sevro's isolated shell grader.
The helper's first commit must return the original expected exit `4`; its
guarded remediation must return `0`. Negative review-evidence cases retain
the failed acceptance check. A second declaration runs its read-only body with
expected exit `1` and the original diagnostic regex, as in the capability-review
migration. The failing-check example changes initial committed fixture content,
preserving its independence from the extra-file scope counterexample.

## Package and runtime preparation

The test stages the Git plugin's public Python source, bundled entrypoint,
project metadata, lock, and both manifests as ordinary fixture files. Canonical
setup runs first; a harness suffix moves those files into `.git/eval-plugin`
and prepares their frozen runtime. The actual public `darrow-create-commit`
entrypoint operates on the generated fixture. Its implementation is not mocked.

`fixture-runtime.ts` now owns the public Python copy and UV tool preparation
previously local to the readiness tests. Readiness still requests Node alongside
UV; real commit cases request only UV. Setup and grading retain the same explicit
Python 3.13 binding outside the protected developer home, grading stays offline,
and test cleanup removes the temporary runtime. No isolation rule is relaxed.

The synthetic host returns a fixed complete response and performs no actions.
These tests do not claim native owner delegation or skill selection. Every Git
push targets the fixture's local bare remote, and its GitHub stub creates no
real pull request. Source checkouts are not mutated.

## Focused gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-real-commit-fixture.test.ts
```

All 12 tests and 68 assertions passed in 31.28 seconds. This uses the previously
verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.

The command and milestone records are retained outside the repository under
`/Users/bjro/.darrow/issue95-real-commit-fixture/`.

## Final domain gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain
```

All 105 tests and 529 assertions across ten files passed in 142.52 seconds.
This gate includes the readiness tests after the shared runtime extraction.
ESLint, typecheck, formatting, and documentation checks also pass; documentation
checks cover 234 Markdown pages and 16 plugins.

The previous full installed-package gate passed 346 tests and 3,552 assertions
before the readiness asset preparation and this migration. The focused and
domain gates above verify the current fixture helpers against that installed
archive. Product code and the package-gate launcher are unchanged in this
milestone.
