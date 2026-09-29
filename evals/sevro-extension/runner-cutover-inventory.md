# Runner cutover inventory

Issue [#95](https://github.com/BjRo/darrow/issues/95) requires removing generic
runner implementation and unit tests from Darrow while preserving its cases,
policy, and product tests. The exact published dependency, benchmark migration
decisions, and focused native validation remain cutover gates.

## Ownership at this milestone

After moving nineteen domain test files, `evals/runner/` contains 75 TypeScript
files. The groups below account for every remaining file. They describe ownership
and remaining work; they do not certify equivalent behavior or authorize restoring
removed runtime machinery.

| Group                                                        |  Files | Cutover disposition                                                                                                                                                                                                                                               |
| ------------------------------------------------------------ | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Command entrypoints                                          |      5 | Keep `run.ts`, `suite.ts`, `report.ts`, `compare.ts`, and `ablation.ts` as thin Darrow callers. Remove generic execution from the first two after the exact release is pinned. The three historical commands already delegate to standalone Darrow readers.       |
| Public integration tests under `parity/`                     |     12 | Keep Darrow integration coverage. Remove the legacy launcher and its runner imports from `sevro.test.ts` after recording the final comparison. Other tests exercise the public package, Darrow protocol, or standalone historical readers.                        |
| Legacy source-copy baseline under `compatibility/`           |      2 | Retire `baseline.test.ts` and `command.ts` after required command comparisons and deliberate migrations are recorded. They copy the generic runner and cannot remain the installed integration gate.                                                              |
| Darrow fixture and oracle tests                              |      0 | The fixture and oracle migration is complete. Tests live under evals/domain/ and use public commands, protocol requests, or plugin-owned oracles, with no legacy runner implementation or private types.                                                          |
| Darrow policy, rendering, and proof helpers with their tests |      7 | Activation, prompt, and owner-evidence tests use public interfaces under evals/domain/. Keep their legacy implementations until cutover. Historical review-proof commands are independent; remaining report and metrics expectations need the benchmark decision. |
| Historical enforcement profile and tests                     |      3 | Resolve the explicit enforced-condition migration. Do not silently use passive execution or restore the removed preflight helper.                                                                                                                                 |
| Engine, host mechanics, and associated tests                 |     46 | Remove generic implementation and unit tests after cutover. Preserve any embedded Darrow discovery, mounting, or grading policy in the extension and its public-interface tests.                                                                                  |
| **Total remaining**                                          | **75** |                                                                                                                                                                                                                                                                   |

No domain fixture test remains in the runner tree. The remaining policy and
enforcement expectations still require comparison with current authoritative
contracts before translating or retiring them.

The seven remaining policy files are the legacy `activation`, `prompt`, and
`owner-evidence` implementations and the implementation/test pairs for
`goal-report` and `orchestration-metrics`. The three enforcement files are
`codex-spawn-guard.ts`, its test, and `owner-evaluation.test.ts`.
These are not generic engine code merely because they currently share its tree.

The engine group includes all `adapters/` files and the remaining execution,
grading, isolation, storage, schema, fixture, configuration, and console helpers
and tests. `schema.ts`, `fixture.ts`, and host adapters mix domain policy with
mechanics; deleting them requires checking the relevant extension behavior rather
than moving those mixed modules into Sevro unchanged.

## Source dependencies outside the tree

- `evals/repository-guide.ts` selects the legacy command when no explicit Sevro
  route is configured. Its four consumed legacy artifact fields are now local
  to the caller; it imports no private runner type. Remove the legacy branch
  when its installed default is pinned.
- `scripts/test-sevro-package-install.ts` runs parity and domain tests through an
  executable installed in a separate consumer. Keep this public package gate;
  its test-directory path may change when integration tests move.
- `evals/runner/parity/sevro.test.ts` builds its legacy comparison launcher with
  imports of `adapters/codex.ts` and `run-control.ts`. Those imports are temporary
  comparison evidence, not an acceptable final integration boundary.
- Historical-reader tests copy Darrow's standalone interpretation files into a
  separate consumer to prove independence. They do not copy generic runner code.
- The temporary legacy selection and compatibility fixtures also copy exactly
  `fixture-ticket.ts`, `sevro-extension/model-defaults.ts`, and
  `sevro-extension/review-axis.ts`, because the legacy runner imports those
  Darrow files. These copies remain part of the legacy comparison only; retire
  them with that baseline. See the
  [fixture repair](historical-review-proof-validation.md#legacy-comparison-fixture-follow-up).

## Domain tests moved out

`evals/domain/review-route-eval-checks.test.ts` runs the review plugin's public
Python oracle from its case-defined shell command. Its input type now describes
only named shell checks, with no runner import. The fixture supplies an explicit
review-state root and the current documented Codex default, `gpt-6-sol/xhigh`.
Positive tests and five identity/batch counterexamples run for both hosts and
both route profiles. The oracle and plugin are unchanged.

`evals/domain/bun-discovery.test.ts` verifies that repository test discovery skips
external corpus caches. It has no runner dependency.

`evals/domain/goal-failed-check-fixture.test.ts` preserves its thirteen protocol
usage and prohibited-effect examples through the installed public CLI. The
transport helper reads the canonical fixture and named checks, constructs a
fixture-only experiment, and reads public result JSON. Sevro builds and cleans
the fixture and executes isolated shell checks. There are no runner imports or
copied engine files. The package-install gate now includes `evals/domain/`.
See [fixture-state validation](fixture-state-validation.md) for the directory
preparation bug found during migration and the current gates.

`evals/domain/goal-verification-publication-fixture.test.ts` preserves its sixteen
incomplete-verification oracle examples through the same public command
transport. It retains protocol usage, event ordering, forbidden publication,
and the distinction between direct review and verification. See
[incomplete-verification validation](verification-fixture-validation.md).

`evals/domain/goal-publication-fixture.test.ts` preserves all eight authorized
publication examples through the same public command. It retains draft flag
parsing, the single-creation allowance, complete help-state snapshots, and
remote commit evidence. See
[publication fixture validation](publication-fixture-validation.md).

`evals/domain/goal-cadence-fixture.test.ts` preserves all eleven verification
trace examples through the public command. It retains required feedback order,
baseline versus final verification, failure invalidation, and allowed repeated
confirmations. See [cadence fixture validation](cadence-fixture-validation.md).

`evals/domain/goal-capability-review-fixture.test.ts` preserves eight current
review and publication-evidence examples through the public command. The
transport accepts an explicit fixture snapshot so a failing initial check stays
part of committed fixture history. See
[capability fixture validation](capability-fixture-validation.md) for the setup
tool lookup regression and preserved diagnostic assertions.

`evals/domain/goal-readiness-fixture.test.ts` preserves nine readiness-trace and
post-launch reassessment examples through the public command. The transport
copies explicitly declared domain assets into its temporary project. The test
prepares a public Python runtime outside the protected developer home and binds
the required tools without weakening isolation. See
[readiness fixture validation](readiness-fixture-validation.md).

`evals/domain/goal-real-commit-fixture.test.ts` preserves twelve real commit
composition and review examples through the public command. It stages the Git
plugin's public package files inside the generated fixture and exercises its
frozen entrypoint, hook failure, guarded remediation, and local publication.
Readiness and real commit tests share the public UV runtime preparation. See
[real commit fixture validation](real-commit-fixture-validation.md).

`evals/domain/discovery-eval-checks.test.ts` preserves fourteen rejected responses
and the exact canonical subject question through the public command. Its two
planning-case schema tests preserve the semantic-check declarations without
executing a semantic grader. See
[discovery oracle validation](discovery-oracle-validation.md).

`evals/domain/feedback-fixture.test.ts` preserves the six feedback fixture tests
through the public command. It checks scoped delivery, rejected approval before
and after mutation, and bounded failure diagnostics that omit the answer and
approval reference. See [feedback fixture validation](feedback-fixture-validation.md).

`evals/domain/composition-fixture.test.ts` preserves four publication,
explicit-option, and newline-policy examples through the public command. Its
publication test stages the actual Git plugin package and retains the canonical
UV observation wrapper. The package-file staging helper is shared with real
commit tests. See [composition fixture validation](composition-fixture-validation.md).

`evals/domain/review-outcome-eval-checks.test.ts` preserves sixty setup and review
artifact examples through the public command, including both shell paths. The
fixture transport stages an explicitly named hidden oracle and gives each review
fixture an absolute temporary state root outside its repository and protected
source project. See [review outcome validation](review-outcome-validation.md).

`evals/domain/goal-review-fixture.test.ts` preserves twenty-five activation,
canonical-artifact, and linked repair examples. Activation uses the public
extension protocol. Artifact and completion checks run actual plugin packages
through the installed command, including current-content invalidation and
conflicting installed copies. See
[goal review validation](goal-review-fixture-validation.md).

`evals/domain/activation-policy.test.ts` preserves twelve validation, observed
selection, owner-policy, and threshold examples through public requests and the
standalone Darrow activation gate. `evals/domain/prompt-policy.test.ts` preserves
five rendering examples through the installed command, including native Claude
namespace and command-placement migrations. Their source-project helper writes
only controlled fixture files and submits public requests; it contains no engine
implementation. See
[activation and prompt validation](activation-prompt-validation.md).

`evals/domain/owner-evidence-policy.test.ts` preserves both effective-route
examples through the public extension protocol and consolidates the existing
native-acceptance matrix from the integration file. It adds invalid effort,
malformed payload, and private-metadata counterexamples without claiming native
delegation or private contract selection. See
[owner evidence validation](owner-evidence-validation.md).

`evals/domain/historical-native-review-proof.test.ts` and
`evals/domain/historical-claude-review-proof.test.ts` preserve all fourteen
historical artifact examples through standalone command execution. Their
Darrow-specific TSV bindings, exact reader batches, prefix or child transcript
digests, and original proof formats remain in the historical validators under
`evals/sevro-extension/`. They do not provide Sevro host mechanics or claim new
live evidence. The legacy Codex adapter uses only the independently extracted
Darrow axis-name matcher. See
[historical review-proof validation](historical-review-proof-validation.md).

At the first relocation milestone, `bun test evals/domain` passed all 25 tests with 51 assertions.
The initial run failed four positive review tests because the fixture omitted the
required review-state environment and used an older Codex default. The corrected
inputs match the current oracle and normative review contract; negative cases
were rerun with the valid fixture. This is fixture maintenance, not new native
behavior evidence.

Path and content-digest inventory snapshots are retained outside the repository
under `/Users/bjro/.darrow/issue95-runner-ownership/`; the latest snapshot is
`historical-review-proof-inventory.json`.
