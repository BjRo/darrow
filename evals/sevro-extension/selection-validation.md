# Direct selection validation

This milestone preserves Darrow's documented skill, plugin, and case selection
through the existing Sevro migration command. It does not switch normal callers
or add parallel jobs. Tests run the actual Darrow entrypoint and Sevro public CLI;
synthetic adapters replace only the candidate host. Invalid-result tests replace
the external CLI to exercise its malformed-reply boundary. No live model call
was made.

Working directory:
`/Users/bjro/Sources/darrow/.worktrees/feat/issue-95-darrow-extension`.

## Observed test-first slices

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selects a skill by owning directory before the Sevro run"'`:
   exit `64`, unknown `--skill`.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selects a skill by owning directory before the Sevro run"'`:
   one test passed with seven assertions. An unrelated case ID is selected from
   its owning skill; lookalike IDs in another skill and an experiment are excluded.
2. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow intersects exact plugin and skill owners with repeatable case filters"'`:
   exit `64`, unknown `--plugin`.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow intersects exact plugin and skill owners with repeatable case filters"'`:
   one test passed with seven assertions. Two IDs selected through intersected
   ownership and alternative substrings run in sorted order with separate results.
3. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection retains cancellation and never starts the next case"'`:
   SIGINT returned `130` but the manifest retained zero runs.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection retains cancellation and never starts the next case"'`:
   one test passed with seven assertions. It retains the active cancelled,
   unassessed run and starts no later case. The first green attempt exposed a
   test mistake: retained aggregate state is under `evidence.result`, not
   `evidence.trials[0].execution`. Correcting that artifact oracle did not alter
   the observed missing-retention red.
4. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection preserves the SIGTERM exit category"'`:
   returned `130`, expected documented `143`.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection preserves the SIGTERM exit category"'`:
   one test passed with seven assertions, retaining the same cancellation evidence
   and preserving SIGTERM separately from SIGINT.
5. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection refuses success without public CLI JSON"'`:
   unstructured stdout and process exit zero produced aggregate exit zero.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection refuses success without public CLI JSON"'`:
   one test passed with four assertions. Raw output and its zero process exit
   remain retained; structured result is unavailable and aggregate exit is `1`.
6. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection rejects incomplete or contradictory public result frames"'`:
   a frame containing only format and exit code produced aggregate exit zero.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection rejects incomplete or contradictory public result frames"'`:
   one test passed with 30 assertions. Missing fields, unsupported versions,
   contradictory outcomes or exit codes, foreign case IDs, absent cases, and
   relative evidence paths cannot produce aggregate success.

## Additional guards and final gates

The first independent review found malformed status coercion, incomplete nested
result validation, and overwritten retry artifacts. Repairs used these observed
test-first slices:

1. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection rejects array-valued outcome states"'`:
   an array-valued task verdict produced aggregate exit zero.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection rejects array-valued outcome states"'`:
   one test passed with 12 assertions, covering task, execution, and grading.
2. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection validates complete nested public frames"'`:
   a case containing only its ID produced aggregate exit zero.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection validates complete nested public frames"'`:
   one test passed with 42 assertions, covering required fields, nested trial
   consistency, checks, domain outcomes, diagnostics, and allowed exit categories.
   Invalid frames retain unchanged raw bytes and their actual process exit.
3. Red — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection preserves a successful attempt across a failed retry"'`:
   a failed retry replaced the first successful attempt's raw public result.
   Green — `SEVRO_CHECKOUT=/Users/bjro/Sources/sevro lean-ctx -c 'bun test evals/runner/parity/sevro-selection.test.ts -t "Darrow selection preserves a successful attempt across a failed retry"'`:
   one test passed with 10 assertions. Both manifests and raw replies remain
   inspectable at distinct retained paths; the current-result alias names the retry.

Three guards were added after implementation without a test-first claim. They
cover ownership selection without substrings, empty/blank/conflicting selectors,
duplicate IDs before result creation, and continuing after a failed assessment
while preserving completed execution and grading separately from task failure.

The applicable final gates are the complete selection test file, repository
typecheck, changed TypeScript ESLint, changed-file Prettier, documentation checks,
and `test:eval-runner-sevro-package` against the exact Sevro candidate tarball.
The required fresh-context review captures the final checks and retains its
canonical report outside the repository. A resolution inventory or a dry result
does not establish native behavioral success or stability.
