# Canonical benchmark assertion migration

Issue [#95](https://github.com/BjRo/darrow/issues/95) replaces private goal
contract assertions with task outcomes and independently observed native owner
model/effort comparisons. The user selected this migration. The public command
is `bun evals/sevro-extension/suite.ts`; no private runner implementation is
imported by the new domain tests.

## Preserved comparisons

All three suites now declare `harnesses: [codex]`. Their condition inputs and
parent route maps already describe Codex runs, and the supported native owner
acceptance receipt is Codex-specific. This declaration does not establish a
Claude owner-route comparison.

| Suite                                 | Comparison modes                          | Cases per mode | Prepared comparison cells |
| ------------------------------------- | ----------------------------------------- | -------------: | ------------------------: |
| `profile-impact-suite.yaml`           | `darrow-workflow`, `darrow-workflow-risk` |              7 |                        14 |
| `localized-routing-policy-suite.yaml` | `adaptive-policy`                         |              2 |                         2 |
| `promoted-routing-suite.yaml`         | `darrow-promoted-route`                   |              3 |                         3 |

The mode `effective_owner_routes` maps retain these independently specified
expectations. They remain separate from the parent candidate route.

| Case                                              | Profile impact         | Localized routing     | Promoted routing       |
| ------------------------------------------------- | ---------------------- | --------------------- | ---------------------- |
| `orchestration-oss-ajv-instance-path`             | `gpt-5.6-sol/high`     | —                     | —                      |
| `orchestration-oss-click-streams`                 | `gpt-5.6-sol/high`     | —                     | —                      |
| `orchestration-oss-express-links`                 | `gpt-5.6-luna/medium`  | —                     | `gpt-5.6-luna/medium`  |
| `orchestration-oss-go-git-insteadof`              | `gpt-5.6-sol/high`     | —                     | —                      |
| `orchestration-oss-requests-proxy`                | `gpt-5.6-sol/high`     | —                     | —                      |
| `orchestration-oss-commander-env`                 | `gpt-5.6-terra/medium` | —                     | `gpt-5.6-terra/medium` |
| `orchestration-oss-cobra-lifecycle`               | `gpt-5.6-terra/medium` | —                     | `gpt-5.6-terra/medium` |
| `orchestration-routing-localized-mechanical`      | —                      | `gpt-5.6-luna/medium` | —                      |
| `orchestration-routing-localized-quality-feature` | —                      | `gpt-5.6-luna/high`   | —                      |

Case membership, experiment and mode identifiers, benchmark condition files,
native control modes, existing parent `case_routes`, evaluation-record
requirements, sibling mounting, and enforced execution defaults are preserved.
The test uses the current canonical suite files with controlled case fixtures;
it does not rewrite their definitions or execute the real corpus tasks.

## Retired private assertions

The suites remove `goal_expectations` and `apply_expected_goal_routes`. Profile
impact now binds each owner model/effort expectation directly, rather than
requesting its application from private goal metadata. Localized and promoted
routing retire these private profile, workflow, and risk assertions:

| Suite     | Case                                              | Profile        | Workflow            | Risk       |
| --------- | ------------------------------------------------- | -------------- | ------------------- | ---------- |
| Localized | `orchestration-routing-localized-mechanical`      | `routine`      | `mechanical`        | `routine`  |
| Localized | `orchestration-routing-localized-quality-feature` | `routine-plus` | `implement-feature` | `routine`  |
| Promoted  | `orchestration-oss-express-links`                 | `routine`      | `fix-bug`           | `high`     |
| Promoted  | `orchestration-oss-commander-env`                 | `scaled`       | `implement-feature` | `elevated` |
| Promoted  | `orchestration-oss-cobra-lifecycle`               | `scaled`       | `refactor`          | `routine`  |

Selected-versus-effective private contract assertions are also retired. Mode
names and condition instructions remain historical labels and task inputs.
They cannot prove private contract selection. Parent model choices and final
response text cannot substitute for independently observed owner acceptance.
Custom suites using the retired fields remain explicitly unsupported on the
Sevro route.

Historical snapshots are unchanged and retain their original interpretation.
New extension configuration, instrumentation, and route identities do not make
their private assertions equivalent to these native comparisons. Missing
evidence remains unknown; dry preparation is unassessed.

## Observed test-first slices

Each slice uses the installed public command and the exact candidate below.
The original suite data remained unchanged for each recorded Red. Each minimal
suite migration followed its Red and passed the identical command before the
next test was added.

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'profile-impact canonical suite retains task and native owner-route comparisons'`: one failed test; `unsupported darrow-workflow mode fields: apply_expected_goal_routes` (exit 64).

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'profile-impact canonical suite retains task and native owner-route comparisons'`: one passed test, 116 assertions, 14.42 seconds.

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'localized-routing canonical suite retains task and native owner-route comparisons'`: one failed test; `unsupported suite fields: goal_expectations` (exit 64).

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'localized-routing canonical suite retains task and native owner-route comparisons'`: one passed test, 20 assertions, 2.74 seconds.

Red — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'promoted-routing canonical suite retains task and native owner-route comparisons'`: one failed test; `unsupported suite fields: goal_expectations` (exit 64).

Green — `env -u SEVRO_CHECKOUT SEVRO_PACKAGE_BIN='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer/node_modules/.bin/sevro' bun test evals/domain/benchmark-suite-policy.test.ts --test-name-pattern 'promoted-routing canonical suite retains task and native owner-route comparisons'`: one passed test, 28 assertions, 3.39 seconds.

The first profile test draft used a static adapter with native host route
options. Those inputs were incompatible and are not product Red evidence.
The corrected fixture uses the bundled Codex host, an inert controlled auth
file, and an executable that must not run under `--dry`. An incidental requested
route assertion was corrected to inspect the negotiated public candidate route.
The original profile suite was restored before the authoritative Red above.

Every successful cell retains condition `enforced`, its independent owner-route
expectation, and the parent route `benchmark-parent/low`. Public evidence records
execution `not_run`, grading `not_requested`, and task `not_assessed`. These
nineteen dry cells prove preparation and retained configuration, with no native
execution or enforcement claim.

## Installed candidate and gates

Sevro source commit: `9d1d8f1`. Candidate version: `0.1.0-rc.1`, unpublished.
License: `BUSL-1.1`, preserving Darrow's terms.

Archive:
`/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/release/sevro-0.1.0-rc.1.tgz`.
SHA-256:
`796fa0882b0354b63a2d2085d34fea59379f3b5929459ecba61e45ea6ae118d6`.

The tests use the separate installed consumer at
`/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/consumer`, with
`SEVRO_CHECKOUT` removed. Its package contains no source Git metadata.

The focused gate passed six tests with 223 assertions across three files in
26.39 seconds. It includes the three canonical suites, the native-acceptance
positive policy test with mismatch counterexamples, owner grading independent
of the parent, and invalid maps and unsupported hosts rejected before execution.
It does not include the separate full negative owner-receipt matrix.
Log: `/Users/bjro/.darrow/issue95-benchmark-migration/installed-focused-gate.log`.
ESLint for the new domain file and Darrow typecheck passed.

The full installed archive gate passed:

```sh
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN SEVRO_PACKAGE_TARBALL='/Users/bjro/.darrow/issue95-license-candidate/9d1d8f1/release/sevro-0.1.0-rc.1.tgz' bun run test:eval-runner-sevro-package
```

It passed all 513 tests with 4,733 assertions across 35 files in 1,028.55 seconds,
including the separate negative owner-receipt matrix. The consumer installed
the exact archive, removed the source override, checked package identity and
absence of Git metadata, and removed its temporary installation afterward.
All 78 recorded tested source inputs remained unchanged during the gate.
Log: `/Users/bjro/.darrow/issue95-benchmark-migration/installed-full-gate.log`.
Input digests:
`/Users/bjro/.darrow/issue95-benchmark-migration/full-gate-inputs.json`.

The documentation check passed for 247 Markdown pages and 16 plugins.

## Remaining cutover limits

Bundled hosts reject enforced execution explicitly. Dry preparation does not
make these suites runnable, and this migration does not change an enforced
request to passive execution. Removed preflight machinery stays removed.
Any separately named passive comparison mode needs its own explicit contract.

Publication, the exact registry dependency pin, default caller cutover, generic
runner removal, remaining historical policy reconciliation, and installed CI
acceptance remain part of issue #95. This milestone does not complete the issue.
