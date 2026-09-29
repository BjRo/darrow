# Feedback fixture migration

The six tests from `evals/runner/feedback-fixture.test.ts` now live under
`evals/domain/` and use the installed Sevro command. They import no legacy
runner implementation or types. Canonical fixture commands and acceptance
check bodies are unchanged. Product, plugin, Sevro, and shared helper code
are unchanged.

## Preserved observations

The four delivery examples still accept implementation with focused tests and
reject unrelated paths, test-only delivery, and an extra commit. All five
canonical delivery checks execute. Negative cases retain their failed checks.
Read-only diagnostic declarations separately prove the original unrelated path
or history-count message through expected exit and output regex.

The approval-stop example exercises actual discovery and rejected
acknowledgement, then runs all canonical stop checks. A controlled mutation in
the same generated fixture makes only the tracked-content check fail. Check
names distinguish the stopped and continued phases; their bodies are unchanged.
The original changed-path diagnostic is also checked.

The trace test retains its four counterexamples: missing rejection, abbreviated
answer, changed content fingerprint, and duplicate rejection. Each fails the
canonical oracle. A second read-only declaration captures the expected failure,
checks the bounded cause flag, and rejects output containing either the complete
answer or approval reference. The original valid trace still passes. Each run
asserts execution, grading, task verdict, process exit, and check status.

The first migration run passed five tests but exposed a diagnostic-wrapper
mistake: Sevro runs shell checks with exit-on-error, so an unguarded expected
failure stopped before the privacy assertions. Guarding that capture corrected
the test translation. This was fixture maintenance, not a product regression
or a TDD Red claim.

The synthetic host performs no actions. These examples do not claim native
owner resumption, feedback relay, skill selection, or semantic response quality.
All Git state and mutations remain inside generated fixtures; no real
publication occurs.

## Validation

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN=/Users/bjro/.darrow/issue95-corpus-sources/ed60be6/consumer/node_modules/.bin/sevro bun test evals/domain/feedback-fixture.test.ts
```

All six tests and 55 assertions passed in 15.02 seconds against the verified
installed Sevro `0.1.0-dev.0` archive from `ed60be6`, SHA-256
`480a3db244cee40451f63ff3b4cf9481593e2cc6c5997ff8fb85b3016af9bb65`.
ESLint, typecheck, formatting, and documentation checks pass; documentation
checks cover 236 Markdown pages and 16 plugins.

The previous 105-test domain gate predates the discovery and feedback migrations.
Their focused gates verify the added files; shared helpers and product code are
unchanged, so the full parity gate was not repeated. Milestone records and the
updated ownership inventory are retained under
`/Users/bjro/.darrow/issue95-feedback-fixture/` and
`/Users/bjro/.darrow/issue95-runner-ownership/`.
