# Historical ablation migration validation

## Scope

The legacy ablation command delegates to Darrow-owned archival tooling. It keeps adjacent `ablation.md`, `--output`, task-level deltas, unknown token/cost values, and unmeasured dry preparation. Relative archive paths resolve beside the manifest. Output cannot replace archives or their aliases.

The legacy suite producer now records `modeDefinitions` beside its existing mode-name list. Older manifests without the snapshot retain unknown settings and cannot establish an eligible ablation; their raw results remain readable through the historical reader. Current mutable suite files are not a substitute for recorded settings.

Shared archival comparison validation and protected atomic Markdown output now live in Darrow-owned helper modules. The public historical comparison and report gates run again against those helpers. The private ablation formatter tests are retired in favor of public command tests.

## Observed test-first slices

The seam is the documented `bun evals/runner/ablation.ts` command. Every following Red was observed with the new test present and the relevant product behavior unchanged. Its Green used the identical literal command. Fixture metadata subsequently adopted the actual suite producer's `modes` name list and `modeDefinitions` snapshot; final gates rerun the resulting tests.

### Slice 1

Relative paths were opened from the process directory (ENOENT for baseline.json).

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'historical ablation resolves relative archives beside its manifest': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'historical ablation resolves relative archives beside its manifest': exit 0; 1 test, 8 assertions passed.
```

### Slice 2

Nine cases accepted unfinished/unknown boundaries, missing identity, contradictory pass rates, or changed instrumentation/conditions/mounts as valid.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'ineligible archive rows retain valid peer comparisons': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'ineligible archive rows retain valid peer comparisons': exit 0; 9 tests, 54 assertions passed.
```

### Slice 3

All four archive destinations were overwritten and returned 0.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'historical ablation refuses archive output destinations': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'historical ablation refuses archive output destinations': exit 0; 4 tests, 16 assertions passed.
```

### Slice 4

Six cases returned the wrong exit category or accepted missing settings, changed owner policy/routes, or duplicate dry evidence.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'historical ablation diagnoses invalid suite inputs': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'historical ablation diagnoses invalid suite inputs': exit 0; 7 tests, 49 assertions passed.
```

### Slice 5

Invalid metadata allowed a referenced archive to be replaced and returned 1 rather than refusing output.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'invalid suite metadata still protects referenced archives': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'invalid suite metadata still protects referenced archives': exit 0; 1 test, 3 assertions passed.
```

### Slice 6

Both duplicate case identities still produced numeric deltas.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'duplicate case identities cannot produce an ablation delta': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'duplicate case identities cannot produce an ablation delta': exit 0; 2 tests, 8 assertions passed.
```

### Slice 7

An invalid named declaration hid a separate eligible comparison.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'invalid named ablations retain other eligible comparisons': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'invalid named ablations retain other eligible comparisons': exit 0; 1 test, 4 assertions passed.
```

### Slice 8

A result threshold outside the manifest still produced a numeric delta.

```text
Red — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'manifest threshold controls historical ablation eligibility': exit 1; missing behavior observed.
Green — bun test evals/runner/parity/sevro-ablation.test.ts --test-name-pattern 'manifest threshold controls historical ablation eligibility': exit 0; 1 test, 4 assertions passed.
```

## Integration diagnosis

The existing dry-suite integration gate initially failed because the producer stored mode names without their settings. After the producer added `modeDefinitions`, the same command passed (1 test, 9 assertions):

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/suite.test.ts --test-name-pattern 'runs a declared no-skill baseline and writes a matched report'
```

## Final gates

### Archival public commands

`bun test evals/runner/parity/sevro-ablation.test.ts evals/runner/parity/sevro-history.test.ts evals/runner/parity/sevro-legacy-compare.test.ts`

PASS: 86 tests, 577 assertions.

### Legacy dry suite

`env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun test evals/runner/suite.test.ts --test-name-pattern 'runs a declared no-skill baseline and writes a matched report'`

PASS: 1 test, 9 assertions.

### Typecheck

`bun run typecheck`

PASS.

### ESLint

`bun run lint:ts 'evals/sevro-extension/legacy-ablation.ts' 'evals/sevro-extension/legacy-comparison.ts' 'evals/sevro-extension/legacy-output.ts' 'evals/sevro-extension/legacy-compare.ts' 'evals/sevro-extension/legacy-report.ts' 'evals/runner/ablation.ts' 'evals/runner/suite.ts' 'evals/runner/suite.test.ts' 'evals/runner/parity/sevro-ablation.test.ts' 'evals/runner/parity/sevro-history.test.ts' 'evals/runner/parity/sevro-legacy-compare.test.ts'`

PASS.

### Formatting

`bunx prettier --check 'docs/eval-development.md' 'docs/specs/skill-evaluation.md' 'evals/sevro-extension/README.md' 'evals/sevro-extension/legacy-ablation.ts' 'evals/sevro-extension/legacy-ablation-validation.md' 'evals/sevro-extension/legacy-comparison.ts' 'evals/sevro-extension/legacy-output.ts' 'evals/sevro-extension/legacy-compare.ts' 'evals/sevro-extension/legacy-report.ts' 'evals/runner/ablation.ts' 'evals/runner/suite.ts' 'evals/runner/suite.test.ts' 'evals/runner/parity/sevro-ablation.test.ts' 'evals/runner/parity/sevro-history.test.ts' 'evals/runner/parity/sevro-legacy-compare.test.ts'`

PASS.

### Documentation

`bun run check:docs`

PASS: 223 Markdown pages and 16 plugins.

## Limits

These tests use local archives and dry preparation. They do not establish live host stability, a published Sevro release, or completion of issue #95. Archive deltas retain their historical evaluator context and do not acquire current Sevro identity.
