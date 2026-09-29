# Explicit passive benchmark variants

The user selected observational benchmark execution and requested no capability
that actively corrects a benchmark. The three canonical suites now expose six
explicit `-passive` variants. Each declares `owner_evaluation: passive` while
preserving its original cases, condition instructions, mounts, task and record
checks, parent route rules, and independent native owner-route expectations.
The original modes remain enforced. This adds no guard or launch rewriting.

## Select the observational modes

Configure the installed Sevro executable with `SEVRO_PACKAGE_BIN` as described
in [local development](migration.md). Run these commands from the Darrow root:

```sh
bun evals/sevro-extension/suite.ts --suite evals/experiments/orchestration/profile-impact-suite.yaml --mode native-goal-passive --mode darrow-workflow-passive --mode darrow-workflow-risk-passive --harness codex
bun evals/sevro-extension/suite.ts --suite evals/experiments/orchestration/localized-routing-policy-suite.yaml --mode adaptive-policy-passive --harness codex
bun evals/sevro-extension/suite.ts --suite evals/experiments/orchestration/promoted-routing-suite.yaml --mode native-promoted-route-passive --mode darrow-promoted-route-passive --harness codex
```

Append `-- --dry` for preparation only. Selecting no modes selects all modes,
including the original enforced variants, whose live execution remains
unsupported by Sevro's bundled hosts. No unsupported enforced request becomes
passive automatically. Ordinary fixture and credential isolation remains active
for passive runs. Private profile/workflow/risk assertions remain retired.

## Public regression coverage

The three successive slices use the documented suite CLI with an independently
installed exact Sevro archive, synthetic cases, canonical condition files, and
an inert Codex binary. They make no live model calls. They prepare each passive
variant alongside its enforced peer: 42 profile-impact, four localized-routing,
and twelve promoted-routing cells. They check case sets, parent and owner routes,
retained conditions, separate evaluation identities, and unassessed dry states.
Each slice reached green before the next test or suite change began.

### Profile impact

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'profile-impact exposes passive comparisons alongside enforced modes'`: exit 1; `unknown suite mode: native-goal-passive` before product changes.

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'profile-impact exposes passive comparisons alongside enforced modes'`: one test passed, 340 assertions, 61.74 seconds.

### Localized routing

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'localized-routing exposes passive comparisons alongside enforced modes'`: exit 1; `unknown suite mode: adaptive-policy-passive` before product changes.

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'localized-routing exposes passive comparisons alongside enforced modes'`: one test passed, 36 assertions, 5.15 seconds.

### Promoted routing

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'promoted-routing exposes passive comparisons alongside enforced modes'`: exit 1; `unknown suite mode: native-promoted-route-passive` before product changes.

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'promoted-routing exposes passive comparisons alongside enforced modes'`: one test passed, 100 assertions, 12.16 seconds.

These tests prove deterministic preparation and retained configuration. They do
not prove live task success, actual native owner acceptance, enforced execution,
or equivalence to historical snapshots. The Sevro archive is unchanged at
`0.1.0-rc.1`, source commit `9d1d8f1`, SHA-256
`796fa0882b0354b63a2d2085d34fea59379f3b5929459ecba61e45ea6ae118d6`.

## Final affected gate

```sh
env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts
```

Passed six tests and 640 assertions in 88.44 seconds, preparing 77 cells across
the original checks and the three new peer comparisons. ESLint, typecheck,
formatting, and documentation links passed; the documentation check covered 250
Markdown pages and 16 plugins. The retained log is
`/Users/bjro/.darrow/issue95-passive-benchmarks/benchmark-gate.log`.
