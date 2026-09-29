# Composition fixture migration

The four tests from `evals/runner/composition-fixture.test.ts` now live under
`evals/domain/` and use the installed Sevro command. They import no legacy
runner implementation or types. Every original controlled command and assertion
remains represented. Product, plugin, and Sevro behavior are unchanged.

## Preserved observations

The publication example uses the actual Git plugin's frozen
`darrow-create-pr` entrypoint. Inspection creates no publication observation;
verification against the stale remote returns the expected exit `4` without
evidence; publishing and verifying the current commit succeed. The canonical UV
wrapper records exactly two successful observations for that intended commit,
and the GitHub stub permits no unauthorized forge effects. All pushes target a
local bare remote; no real pull request is created.

The explicit-options example still rejects a missing repair limit, an inferred
default, an unspecified limit, and a changed receipt. It accepts the caller's
exact limit of one. Both newline-policy examples still check the ticket's
statement, accept exact content with or without trailing newlines, and reject
the wrong value or extra content.

Each public run separately asserts execution, grading, task verdict, exit, and
every check status. Expected command rejections retain their original exit
expectations. The synthetic host returns a fixed complete response and performs
no actions; these tests do not claim native delegation or skill selection.

## Package preparation

`fixture-git-plugin.ts` stages the same public Git package source, metadata,
lock, entrypoint, and manifests previously staged by the real-commit tests.
Those tests now call the shared file-staging helper; their setup and assertions
are unchanged.

The publication example copies its explicitly declared recipe assets into the
temporary project and runs the canonical setup. A suffix moves the staged Git
package into `.git/eval-plugin`, prepares its frozen runtime, and binds the
canonical UV observer to a public UV forwarder. That forwarder supplies the
existing copied Python runtime and disables grading downloads. The canonical
observation wrapper and its success-only recording logic are unchanged. No
isolation rule is relaxed.

## Validation

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/composition-fixture.test.ts
```

All four tests and 20 assertions passed in 10.72 seconds against the verified
installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/goal-real-commit-fixture.test.ts
```

All twelve real-commit tests and 68 assertions passed in 31.44 seconds after
the file-staging extraction. ESLint, typecheck, formatting, and documentation
checks also pass; documentation checks cover 237 Markdown pages and 16 plugins.
These two gates cover both consumers of the extracted helper. The full parity
gate was not repeated because generic runner and extension behavior are unchanged.

Milestone records and the updated ownership inventory are retained under
`/Users/bjro/.darrow/issue95-composition-fixture/` and
`/Users/bjro/.darrow/issue95-runner-ownership/`.
