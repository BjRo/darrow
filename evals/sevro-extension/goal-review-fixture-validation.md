# Goal review fixture migration

The twenty-five tests from `evals/runner/goal-review-fixture.test.ts` now live
under `evals/domain/`. They use the installed Sevro command and the public
extension protocol, with no legacy runner implementation or private type imports.
This completes the fixture-test relocations; generic runner removal remains
pending.

## Preserved observations

| Examples                         | Count | Required observations                                                                                                                                                                 |
| -------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supporting capability activation |     1 | Both verification/review orders pass; omitting either or both fails                                                                                                                   |
| Comprehensive artifacts          |     8 | Canonical human reports, clear records, and advisory findings pass; altered reports, blocking findings, blocked checks, and invalid axes fail                                         |
| Linked repair completion         |    16 | Exact current targets and original findings are required; guidance, resolution evidence, advisories, duplicate providers, and subsequent content mutation retain their original gates |

Activation resolves the canonical case and submits five explicit-invocation
receipts to the public `sevro.extension.v1` evaluate method. These are controlled
policy inputs; they do not prove live native invocation or reviewer delegation.

Artifact checks run the canonical clear-review oracle. Completion checks invoke
the actual Adaptive Delivery proof helper, require the completion marker only
for successful gates, then independently validate retained artifact and target
evidence. A subsequent content mutation must invalidate current proof. Every
negative repair example first passes the review package's verification syntax
validator, so rejection cannot be attributed to malformed input. Identical
provider copies pass; a conflicting scope implementation fails.

Every public command result separately asserts exit, execution, grading, task
verdict, and all action and oracle statuses. Synthetic fixture records retain
the Adaptive Delivery fixture contract's Git metadata location. Actual review
scope packets use an absolute temporary review-state root outside the fixture
repository and protected source project. Native composition with externally
stored provider artifacts still needs separate acceptance evidence.

## Package preparation

The fixture stages actual proof and review package sources and frozen locks.
The review payload also includes its public launcher and matching manifests.
Payloads move into Git metadata during setup, keeping package code out of the
committed product snapshot.

An initial positive failure exposed a missing offline `hatchling` build
dependency: the review provider uses its public launcher and a keyed environment,
distinct from the normal project environment. Setup now prepares that actual
launcher for each staged provider, with an absolute fixture-owned cache and the
same explicit Python binding used during grading. The conflicting-provider
fixture prepares the package without importing its deliberately invalid scope
module. Offline grading still invokes the actual provider launcher. No isolation
rule, plugin source, or Sevro implementation changed. Temporary diagnostics were
removed. This is fixture maintenance; no TDD Red claim is made.

## Validation

The three focused activation, clear-artifact, and linked-repair examples pass
(18 assertions, 11.64 seconds). The final gate runs all domain tests through the
verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain
```

All 203 tests and 1,113 assertions across fifteen files passed in 474.62 seconds.
This includes all twenty-five migrated examples and every existing consumer of
the shared fixture transport after extracting its public protocol request helper.
ESLint, typecheck, and formatting pass. Documentation checks cover 239 Markdown
pages and 16 plugins. The full parity gate was not repeated; engine and extension
product behavior are unchanged, and the installed default cutover is pending.

Milestone records and the final gate log are retained under
`/Users/bjro/.darrow/issue95-goal-review-fixture/`. The updated ownership inventory
is `/Users/bjro/.darrow/issue95-runner-ownership/goal-review-inventory.json`.
