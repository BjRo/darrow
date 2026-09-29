# Historical review-proof migration

The seven Codex and seven Claude reviewer-routing artifact tests now live under
`evals/domain/`. They invoke standalone historical validators through their CLI
instead of importing private runner modules. Each test copies only its Darrow
validator and, for Codex, the axis-name policy file into a temporary consumer
outside the source repository. That consumer contains no generic runner, Sevro
installation, or source Git metadata.

The validators live at `evals/sevro-extension/legacy-native-review-proof.ts` and
`evals/sevro-extension/legacy-claude-review-proof.ts`. Their CLI arguments,
absolute paths, original proof formats, atomic output, and rejection rules are
unchanged. The tests also assert stdout and exit behavior; rejected evidence
creates no proof file. See the [command contract](README.md#historical-reviewer-routing-artifacts).

## Preserved requirements

| Host   | Positive evidence                                                                                                                           | Retained rejection examples                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex  | Two distinct axis-bound native starts and acceptances before the first wait, matching route/application records and an exact retained batch | Missing native start; absent or ambiguous axis; extra spawn; start after acceptance; non-OpenAI provider                                        |
| Claude | Exact foreground tuple, two children, one assistant turn, bound native results and every child assistant turn, exact retained batch         | Split assistant turns; undashed axis marker; copied result ID outside a native result; result before call; interleaved result; extra Agent call |

The Codex session-prefix hash and Claude child-transcript hashes retain their
original interpretation. Reconstructing the original modules from the relocated
files and extracted matcher matches both recorded pre-migration SHA-256 digests.
The legacy Codex adapter now imports only the independent Darrow axis matcher.

These validators interpret the named historical Darrow study formats. They do
not implement Sevro host observation, replace current native-reader acceptance,
or promote synthetic fixtures to live evidence. The original research document
keeps its measurements and limitations; only tool paths change. Its historical
Claude artifact still fails the canonical-marker requirement. No product,
plugin, normative contract, or Sevro behavior changed. No TDD Red claim is made.

## Validation

The focused gate includes all fourteen migrated examples, two legacy Codex
adapter checks, and the existing public extension test for completed independent
readers:

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/historical-native-review-proof.test.ts evals/domain/historical-claude-review-proof.test.ts evals/runner/adapters/codex.test.ts evals/runner/parity/sevro-extension.test.ts --test-name-pattern 'historical (Codex|Claude) review proof CLI|retains current review task labels|merges bounded accepted-launch|completed independent readers'
```

All 17 tests and 142 assertions across four files passed in 4.39 seconds. The
public integration check uses the verified installed Sevro `0.1.0-dev.0` archive
from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
The historical commands themselves require no Sevro package. ESLint, typecheck,
formatting, and documentation checks pass. The full domain and parity suites
were not repeated, and no fresh live model run is claimed.

The runner inventory now contains 75 TypeScript files, including seven remaining
Darrow policy files. Nineteen test files have moved out; `evals/domain/` contains
twenty test files including the newly added fixture-state regression.
The exact published package pin, remaining benchmark decisions, default cutover,
generic runner removal, and focused native acceptance remain pending.

Milestone records and the gate log are retained under
`/Users/bjro/.darrow/issue95-historical-review-proof/`. The gate log SHA-256 is
`1149244d043b7f2ae20239ef914505253dbfc44ce9123d7e6d425a893ae06f81`.
The current ownership snapshot is
`/Users/bjro/.darrow/issue95-runner-ownership/historical-review-proof-inventory.json`.
