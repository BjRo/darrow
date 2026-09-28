# Repository-guide caller validation

This milestone prepares the existing guide caller to use an explicitly selected
Sevro package or checkout. It keeps the default legacy backend until an exact
published release is pinned. Tests exercise the real guide command, Darrow's
extension, and Sevro's public CLI. Synthetic native host executables replace
model calls; this evidence does not establish live model stability.

## Observed test-first slices

### Public dry evidence

Red — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration retains a public unassessed dry result"'`:
the existing command ignored the Sevro route and wrote a legacy array, so the
expected `sevro.cli-result.v1` format was absent.

Green — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration retains a public unassessed dry result"'`:
one test passed with ten assertions. The public result remained not run and
unassessed, agreed with retained evidence, and recorded one job and exact
candidate and semantic routes. The first implementation run exposed an oracle
mistake: native host IDs are namespaced (`sevro.host.codex`). Correcting that
expected ID was a test repair, not another product red.

### Separate roots and explicit routes

Red — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration uses separate roots and explicit routes on both hosts"'`:
the command rejected `--project-root` before execution.

Green — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration uses separate roots and explicit routes on both hosts"'`:
one test passed with ten assertions. Both native dry routes used the separate
inventory and output root, exact question selector, candidate override, and
semantic override. An intermediate fixture lacked a semantic check, so Sevro
correctly omitted its unused judge route. The fixture gained the declared
semantic criterion before the passing observation.

### Separate activation gate

Red — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration stops after failed activation despite a passed task"'`:
the first task and grading passed, activation failed, and the caller incorrectly
continued to the second question and exited zero instead of one.

Green — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration stops after failed activation despite a passed task"'`:
one test passed with seven assertions. It retained the passed task and failed
activation separately, started one candidate, and stopped before the next
question. The first fixture placed its synthetic executable inside the protected
project and produced an execution failure. Moving that external executable
outside the project corrected the fixture before the valid red above.

### Invalid output and interruption exits

Red — `lean-ctx -c 'SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-guide.test.ts -t "guide migration retains invalid output and process exit|guide migration retains partial startup output"'`:
five cases failed. Invalid output with command exits two and 64 instead exited
one; interrupted partial output also exited one instead of 130 or 143. The
zero-exit unsupported-format case failed because no validation diagnostic was
retained. These regressions reproduce both independent review findings.

Green — the same command passed five cases with 45 assertions. Raw bytes remain
unchanged, companion diagnostics retain command and interruption exits with an
unavailable structured result, and no later cell starts. The partial-output
fixture replaces the external Sevro executable during initialization, before
it emits complete public JSON. It exercises signal forwarding through the real
guide and command wrapper; it does not establish live host behavior.

## Additional guards

The same public-command fixture checks ordered unmounted controls, first task
failure, SIGINT and SIGTERM with retained interrupted evidence, unsupported
public JSON with raw output retained, and refusal of caller-owned overrides.
These guards make no test-first red claim. The installed-package parity gate
also runs this file with `SEVRO_CHECKOUT` cleared and the installed executable
selected. Dry runs and synthetic hosts do not unlock repository-guide prose
removal or prove native-host success on real questions.
