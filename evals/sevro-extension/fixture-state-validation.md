# Fixture-state preparation and public oracle migration

The Darrow extension now creates `.git/fixture-state` before canonical fixture
setup or tools run. The legacy builder provided this directory; fixture protocols
and acceptance checks rely on it. Sevro remains unaware of this domain convention.

## Public command regression

The regression uses the documented Darrow run command and installed Sevro CLI.
Its fixture comes from `failed-check-blocks-publication.yaml`. A setup prefix
exits `9` when the required state directory is absent. The independent shell
check then requires that same directory, with completed execution and grading.

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/fixture-state.test.ts --test-name-pattern 'Darrow prepares fixture state before canonical setup'`:
test exit `1`; public CLI exit `70`, with `fixture setup failed (9)`, execution
`not_run`, grading `not_requested`, and task `not_assessed`. The extension was
unchanged. Earlier test drafts did not stop setup at the failed directory probe
and treated an empty-case runner diagnostic as invalid output; both harness
issues were corrected before this recorded Red.

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/fixture-state.test.ts --test-name-pattern 'Darrow prepares fixture state before canonical setup'`:
exit `0`, one test and five assertions passed after adding the directory
preparation in the extension.

A second already-green regression uses the canonical clean-tree commit fixture,
which has no setup script. It requires state preparation without another history
commit. No additional Red is claimed for that coverage.

## Migrated fixture oracles

The thirteen failed-check fixture tests now live in `evals/domain/` and use the
public CLI and extension protocol. Their canonical fixture, protocol binaries,
setup, and acceptance checks remain unchanged. The transport constructs a
fixture-only experiment; its synthetic host returns a fixed complete response.
Controlled actions and the named oracle checks execute through Sevro's isolated
shell grader, in declaration order.

Nine usage tests retain `--help`, `-h`, and an invalid argument for the review,
commit, and publication protocols. They require the expected exit code and no
event, commit, pull-request, or remote-branch effects. Four further examples
exercise no prohibited action, review, commit, and local fixture publication.
They require the failing gate and preserved edit, prove each simulated action
was executable, and check exactly the corresponding acceptance failure.
Public task, execution, grading, and exit categories remain asserted separately.
Check identities come from the extension's public `resolve` response; the helper
does not reconstruct the extension's ID naming scheme.

`env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-failed-check-fixture.test.ts`:
13 tests and 85 assertions passed. These are fixture-oracle tests. They do not
claim native owner behavior, skill activation, or semantic grading success.

The package-install gate now runs both `evals/runner/parity` and `evals/domain`
through the separate installed consumer. Its exact archive remains Sevro
`0.1.0-dev.0` from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.

## Final gates and ordering

`env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/package/sevro-0.1.0-dev.0.tgz bun run test:eval-runner-sevro-package`:
302 tests and 3,295 assertions passed across 16 files in 400.99 seconds. The
archive was installed in a fresh consumer, with no package Git metadata.

That full gate ran before splitting the test transport helper to satisfy lint
limits and replacing its reconstructed check IDs with public resolution.
After that helper refactor,
`env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain`
passed all 40 tests and 146 assertions across four files in 29.84 seconds.
The extension implementation and package-install command were unchanged between
those gates. Final TypeScript lint, typecheck, formatting, and documentation
checks passed. No standalone Sevro or marketplace plugin source changed.

The literal regression trace and gate records are retained outside the
repository under `/Users/bjro/.darrow/issue95-fixture-state/`.
