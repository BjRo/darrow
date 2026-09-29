# Owner evidence policy migration

The two tests from `evals/runner/owner-evidence.test.ts` now live under
`evals/domain/owner-evidence-policy.test.ts`. They use public extension requests,
with no legacy runner implementation or private type imports. The existing
public acceptance matrix from `parity/sevro-extension.test.ts` is consolidated
in this domain file. Its legacy implementation remains until the published
package cutover.

## Preserved evidence requirements

Two model/effort bindings retain the original legacy and public-protocol fixture
routes. Exactly one sourced, complete, correlated native acceptance with
`forkTurns: none` passes. Model or effort mismatches fail. Changing private role,
profile, workflow, or risk labels does not change the route check or its explicit
statement that contract selection remains unverified.

The negative test covers 23 scenarios:

| Evidence                                                                                    | Required result |
| ------------------------------------------------------------------------------------------- | --------------- |
| Missing, duplicate, partial, or foreign receipt                                             | Unavailable     |
| Malformed, null, array, or legacy-annotation payload                                        | Unavailable     |
| Missing or invalid fork, model, or effort                                                   | Unavailable     |
| Missing start, reversed acceptance, unmatched launch, or direct/native disagreement         | Unavailable     |
| Complete observation with no accepted child, an unaccepted launch, or two accepted children | Failed          |
| All or bounded context inheritance                                                          | Failed          |

The legacy Boolean rejection becomes the public distinction between `failed`
and `unavailable`; neither passes. The legacy parser's raw annotation format is
not accepted as normalized native evidence. The migrated check requires the
public host source, method, and launch/start/acceptance correlation. Raw host
decoding belongs to Sevro. Historical-result interpretation remains in Darrow's
standalone historical readers.

The old helper manufactured a harness/provider route object from its annotation
name. This policy check retains the sourced Codex receipt and expected model and
effort, without inventing a provider or private contract claim. Actual host and
provider provenance remains in the independently retained runner evidence.

Every request asserts exactly one named route check. Positive examples assert
its full public result and evidence reference. Negative examples retain the
unverified-contract statement. These are controlled protocol policy fixtures;
they do not prove a live native launch. The pending private benchmark-dimension
decision is unchanged. No product, plugin, Sevro, or normative behavior changed.
No TDD Red claim is made.

## Validation

The two migrated tests pass with 116 assertions in 1.481 seconds. The final
installed-command and protocol gate adds direct-caller and suite coverage for
owner-map validation, independent parent routes, dry unassessed states,
unavailable evidence, and the native owner-route assertion:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/owner-evidence-policy.test.ts evals/runner/parity/sevro-suite.test.ts evals/runner/parity/sevro-direct-caller.test.ts evals/runner/parity/sevro-extension.test.ts --test-name-pattern 'owner routes|owner-route|effective-owner policy|effective route through the public protocol|inherited routes never pass|selected Codex owner route'
```

All 8 tests and 220 assertions across four files passed in 12.99 seconds. The
gate uses the verified installed Sevro `0.1.0-dev.0` archive from `ed60be6`,
SHA-256 `480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
This is a focused owner-evidence gate; the full domain and parity suites were
not repeated.
ESLint, typecheck, and formatting pass. Documentation checks cover 241 Markdown
pages and 16 plugins.

Milestone records and the gate log are retained under
`/Users/bjro/.darrow/issue95-owner-evidence-policy/`. The current inventory is
`/Users/bjro/.darrow/issue95-runner-ownership/owner-evidence-inventory.json`.
