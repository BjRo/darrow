# Discovery oracle migration

The three tests from `evals/runner/discovery-eval-checks.test.ts` now live under
`evals/domain/`. They retain every original response example and schema assertion.
The response oracle uses the installed Sevro command; the tests import no legacy
runner implementation or types. Product, plugin, Sevro, and fixture-helper code
are unchanged.

## Preserved observations

The subjectless grilling test still rejects all fourteen original responses,
including extra prose, extra questions, paraphrases, alternatives, and bullet
formatting. It accepts only `What subject would you like me to grill?`. Each
response is written through a controlled shell action, then checked by the
unchanged canonical `expect_exact` declaration. Rejected examples retain a
failed canonical check and failed task verdict. Each run separately asserts
execution, grading, task verdict, process exit, and both check statuses.

The two planning tests retain their assertions that prose judgment belongs in
semantic checks: the unresolved-timeout case has its original single shell
check and three semantic-check names, and the transfer case keeps missing-policy
authority in its semantic proposition. These are schema assertions. They do not
run a semantic grader or claim that a live response satisfies the propositions.

The synthetic host returns a fixed complete response and performs no actions.
The tests do not claim native skill selection or user-facing conversation
behavior. All mutations stay inside generated fixtures.

## Validation

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/discovery-eval-checks.test.ts
```

All three tests and 81 assertions passed in 19.40 seconds against the verified
installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
ESLint, typecheck, formatting, and documentation checks pass; documentation
checks cover 235 Markdown pages and 16 plugins.

The previous domain gate passed 105 tests and 529 assertions before adding this
file. The focused command above verifies the current migration. This milestone
does not change shared helpers or product code, so the full parity gate was not
repeated. Milestone records and the updated ownership inventory are retained
under `/Users/bjro/.darrow/issue95-discovery-oracle/` and
`/Users/bjro/.darrow/issue95-runner-ownership/`.
