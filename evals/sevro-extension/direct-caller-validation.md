# Direct caller migration validation

The existing `bun eval` / `evals/runner/run.ts` command selects the public
Sevro route when a checkout or installed package route is explicit. Default
cutover and the published pin remain pending. No marketplace plugin changes.

## Test-first development

The tests exercise the existing public direct command. Only external host
executables are synthetic; selection, extension translation, Sevro's CLI,
configuration, persistence, and grading use real paths. Each slice's product
behavior was absent at Red and present at Green. Both observations used the
complete identical command retained below. Canonical check records live under:

`/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs`

### 1. CLI routing

Red — Legacy parsing rejected the forwarded `--codex-bin`. Recorded in `check-1.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller routes a filtered dry evaluation through Sevro' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-1.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-1.log'
exit "$direct_slice_exit"
```

Green — 1 pass, 10 assertions. Recorded in `check-2.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller routes a filtered dry evaluation through Sevro' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-1.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-1.log'
exit "$direct_slice_exit"
```

### 2. Candidate and grader routes

Red — `--model` was unknown before route mapping. Recorded in `check-3.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller preserves per-case candidate routes and independent graders' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-2.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-2.log'
exit "$direct_slice_exit"
```

Green — 1 pass, 13 assertions. Recorded in `check-4.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller preserves per-case candidate routes and independent graders' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-2.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-2.log'
exit "$direct_slice_exit"
```

### 3. Controls and output

Red — `--config-root` was unknown before roots and controls were mapped. Recorded in `check-5.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller preserves skill controls and writes the selection output' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-3.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-3.log'
exit "$direct_slice_exit"
```

Green — 1 pass, 8 assertions. Recorded in `check-6.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller preserves skill controls and writes the selection output' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-3.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-3.log'
exit "$direct_slice_exit"
```

### 4. Benchmark policy

Red — `--require-evaluation-records` was unknown before policy mapping. Recorded in `check-8.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller retains evaluation-record and effective-owner policy' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-4.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-4.log'
exit "$direct_slice_exit"
```

Green — 1 pass, 6 assertions. Recorded in `check-9.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller retains evaluation-record and effective-owner policy' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-4.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-4.log'
exit "$direct_slice_exit"
```

### 5. Invalid limits

Red — Zero trials returned case-failure exit `1` instead of rejecting invocation with `64`. Recorded in `check-10.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller rejects invalid limits before launching Sevro' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-5.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-5.log'
exit "$direct_slice_exit"
```

Green — 1 pass, 9 assertions. Recorded in `check-11.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller rejects invalid limits before launching Sevro' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-5.log' 2>&1
direct_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-5.log'
exit "$direct_slice_exit"
```

### 6. Output isolation and execution

Red — Both raw case exits were `2` while protecting a nonexistent output file. Recorded in `check-12.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller retains failed tasks and protects fresh output storage' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-6.log' 2>&1
direct_slice_exit=$?
tail -n 14 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-6.log'
exit "$direct_slice_exit"
```

Green — 1 pass, 9 assertions. Recorded in `check-15.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller retains failed tasks and protects fresh output storage' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-6.log' 2>&1
direct_slice_exit=$?
tail -n 14 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.8yf3tghs/slice-6.log'
exit "$direct_slice_exit"
```

The sixth slice corrected its isolation fixture after the product repair.
A fake host process cannot substitute for native tool isolation. The final
fixture checks the protected output directory through an actual isolated shell
grader. Its legacy check field is `expect_exit`; the initially mistyped field
was a fixture error, not Red evidence. The passing test retains raw exits
`[1, 0]`, a failed then passed task, continued selection, and identical
stdout/file output. It makes no native model-quality claim.

## Additional coverage and limitations

The direct and benchmark caller regression check passed 16 tests with 188
assertions. Additional direct command coverage checks unsupported forwarded
overrides and legacy policies, invalid explicit routes without fallback, the
unchanged enforced default without candidate execution, and both SIGINT and
SIGTERM. Cancellation retains the planned IDs and the cancelled first case.
Dry cases remain unassessed while retaining candidate/grader routes, conditions,
limits, and configuration-root evidence. Codex and Claude dry mappings are covered.
Native isolation checks require macOS and the Codex sandbox; a skipped test
does not prove that platform boundary.

Host-option mechanics are shared with the benchmark caller. Both consume the
existing Darrow-owned Codex role-default policy. The cross-runner fixture clears
Sevro route variables only for the legacy command so two implementations remain
under comparison. The benchmark's existing rejection diagnostic is preserved.

## Remaining cutover gates

Published pinning, installed CI, default cutover, generic runner removal, private
goal assertions, bundled-host enforcement, manually
supplied human-review minutes, and specialized historical comparisons remain
pending. Selection JSON is a documented output migration; legacy arrays remain
interpretable through the standalone historical reader.

Custom corpus manifests are now covered by [corpus validation](corpus-caller-validation.md),
including installed-package source-worktree isolation and retained provenance.

## Review repairs

The initial independent review found two blockers in storage protection and
activation gating. Both were repaired through the existing public direct command.
The first installed package check had two 5000 ms timeouts in unchanged tests;
its failed receipt remains in the initial review. An unchanged rerun passed
187 tests. Neither result establishes live native model quality.

### 7. Complete result storage

Red — Raw exits were `[1, 1]`: both isolated shell checks could read prior evidence, while native sandbox checks already denied access. Recorded in `/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/check-1.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller protects the whole external results root' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/storage-slice.log' 2>&1
repair_slice_exit=$?
tail -n 22 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/storage-slice.log'
exit "$repair_slice_exit"
```

Green — 1 pass, 15 assertions. With and without output, actual isolated shell checks and Codex sandbox commands cannot read or change sentinel/prior evidence; both selected cases and coordinator persistence pass. Recorded in `/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/check-2.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller protects the whole external results root' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/storage-slice.log' 2>&1
repair_slice_exit=$?
tail -n 22 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/storage-slice.log'
exit "$repair_slice_exit"
```

### 8. Independent activation gate

Red — Task and raw public exit passed, but aggregate exit was `0` instead of `1` when only one of two activation trials passed. Recorded in `/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/check-3.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller gates activation independently from task success' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/activation-slice.log' 2>&1
repair_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/activation-slice.log'
exit "$repair_slice_exit"
```

Green — 1 pass, 37 assertions. Failed, unavailable, passed, dry, and unmounted scenarios retain separate activation states and expected aggregate exits. Recorded in `/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/check-4.json`.

```sh
SEVRO_CHECKOUT=/Users/bjro/Sources/sevro bun test evals/runner/parity/sevro-direct-caller.test.ts -t 'direct caller gates activation independently from task success' > '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/activation-slice.log' 2>&1
repair_slice_exit=$?
tail -n 18 '/Users/bjro/.darrow/reviews-issue95-direct-caller/49d43ad1cd5361ca477f50a0b559e964a208a700084a5e210291d36a7be5abdd/darrow-review.9lpzpslb/activation-slice.log'
exit "$repair_slice_exit"
```
