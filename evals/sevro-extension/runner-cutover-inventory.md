# Runner cutover inventory

Issue [#95](https://github.com/BjRo/darrow/issues/95) requires removing generic
runner implementation and unit tests from Darrow while preserving its cases,
policy, and product tests. The exact published dependency, benchmark migration
decisions, and focused native validation remain cutover gates.

## Ownership at this milestone

After moving two independent domain tests, `evals/runner/` contains 94 TypeScript
files. The groups below account for every remaining file. They describe ownership
and remaining work; they do not certify equivalent behavior or authorize restoring
removed runtime machinery.

| Group                                                        |  Files | Cutover disposition                                                                                                                                                                                                                                         |
| ------------------------------------------------------------ | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command entrypoints                                          |      5 | Keep `run.ts`, `suite.ts`, `report.ts`, `compare.ts`, and `ablation.ts` as thin Darrow callers. Remove generic execution from the first two after the exact release is pinned. The three historical commands already delegate to standalone Darrow readers. |
| Public integration tests under `parity/`                     |     12 | Keep Darrow integration coverage. Remove the legacy launcher and its runner imports from `sevro.test.ts` after recording the final comparison. Other tests exercise the public package, Darrow protocol, or standalone historical readers.                  |
| Legacy source-copy baseline under `compatibility/`           |      2 | Retire `baseline.test.ts` and `command.ts` after required command comparisons and deliberate migrations are recorded. They copy the generic runner and cannot remain the installed integration gate.                                                        |
| Darrow fixture and oracle tests                              |     12 | Preserve current product-oracle behavior through plugin-local checks or public CLI fixtures, then move tests to `evals/domain/`. Their current `buildFixture`, `runChecks`, activation, and type imports must be removed.                                   |
| Darrow policy, rendering, and proof helpers with their tests |     14 | Keep policy in the extension and bounded native observation mechanics in Sevro. Replace private helper tests with the appropriate owner’s coverage. Reconcile legacy report and private-contract assertions before deleting their implementation.           |
| Historical enforcement profile and tests                     |      3 | Resolve the explicit enforced-condition migration. Do not silently use passive execution or restore the removed preflight helper.                                                                                                                           |
| Engine, host mechanics, and associated tests                 |     46 | Remove generic implementation and unit tests after cutover. Preserve any embedded Darrow discovery, mounting, or grading policy in the extension and its public-interface tests.                                                                            |
| **Total remaining**                                          | **94** |                                                                                                                                                                                                                                                             |

The twelve fixture tests are `composition-fixture`, `feedback-fixture`,
`discovery-eval-checks`, `review-outcome-eval-checks`, and the eight
`goal-*-fixture` tests. Some expectations refer to historical contracts; compare
them with current authoritative cases before translating or retiring them.

The fourteen policy files are the implementation/test pairs for `activation`,
`prompt`, `owner-evidence`, `goal-report`, `orchestration-metrics`,
`native-review-proof`, and `claude-review-proof`. The three enforcement files are
`codex-spawn-guard.ts`, its test, and `owner-evaluation.test.ts`.
These are not generic engine code merely because they currently share its tree.

The engine group includes all `adapters/` files and the remaining execution,
grading, isolation, storage, schema, fixture, configuration, and console helpers
and tests. `schema.ts`, `fixture.ts`, and host adapters mix domain policy with
mechanics; deleting them requires checking the relevant extension behavior rather
than moving those mixed modules into Sevro unchanged.

## Source dependencies outside the tree

- `evals/repository-guide.ts` still imports the legacy `CaseResult` type and
  selects the legacy command when no explicit Sevro route is configured. Remove
  that branch and private type when its installed default is pinned.
- `scripts/test-sevro-package-install.ts` runs the parity directory through an
  executable installed in a separate consumer. Keep this public package gate;
  its test-directory path may change when integration tests move.
- `evals/runner/parity/sevro.test.ts` builds its legacy comparison launcher with
  imports of `adapters/codex.ts` and `run-control.ts`. Those imports are temporary
  comparison evidence, not an acceptable final integration boundary.
- Historical-reader tests copy Darrow's standalone interpretation files into a
  separate consumer to prove independence. They do not copy generic runner code.

## Independent domain tests moved now

`evals/domain/review-route-eval-checks.test.ts` runs the review plugin's public
Python oracle from its case-defined shell command. Its input type now describes
only named shell checks, with no runner import. The fixture supplies an explicit
review-state root and the current documented Codex default, `gpt-6-sol/xhigh`.
Positive tests and five identity/batch counterexamples run for both hosts and
both route profiles. The oracle and plugin are unchanged.

`evals/domain/bun-discovery.test.ts` verifies that repository test discovery skips
external corpus caches. It has no runner dependency.

Validation: `bun test evals/domain` passed all 25 tests with 51 assertions.
The initial run failed four positive review tests because the fixture omitted the
required review-state environment and used an older Codex default. The corrected
inputs match the current oracle and normative review contract; negative cases
were rerun with the valid fixture. This is fixture maintenance, not new native
behavior evidence.

The path and content-digest inventory is retained outside the repository at
`/Users/bjro/.darrow/issue95-runner-ownership/inventory.json`.
