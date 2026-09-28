# Sevro migration

The migration entrypoints already run Darrow cases through Sevro's public CLI
and extension protocol. Normal `bun eval`, `bun run eval:orchestration`, and
`evals/repository-guide.ts` use the legacy runner by default and select Sevro
when an explicit package or checkout route is set.
The exact published
release pin, normal command cutover, and generic runner removal remain pending.
The ownership boundary is recorded in
[ADR-0010](../../docs/decisions/ADR-0010-extract-the-evaluation-runner-into-sevro.md)
and the extension contract in
[ADR-0011](../../docs/decisions/ADR-0011-negotiate-evaluation-extensions-across-the-runner-boundary.md).

## Local and coordinated development

Select exactly one absolute runner location:

| Environment variable    | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `SEVRO_CHECKOUT`        | Run the named Sevro source checkout and retain its revision and dirty-patch identity.               |
| `SEVRO_PACKAGE_BIN`     | Run an installed package's executable and retain package version and build identity.                |
| `SEVRO_PACKAGE_TARBALL` | Select a tarball for the package-install compatibility gate; this does not select a candidate host. |

The migration commands require either the checkout or installed executable;
there is no implicit checkout discovery or published dependency yet. Darrow's
project revision and dirty state remain separate from runner identity.

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/run.ts \
  --case-id selected-case \
  --project-root /absolute/path/to/darrow \
  --results-root /absolute/path/to/results \
  -- --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --config-root /absolute/path/to/configuration \
  --model <model> --effort medium \
  --condition passive --trials 1 --threshold 1 --shell-isolation
```

All Sevro root arguments are absolute. The configuration root defaults to the
project root and imports only the explicit Codex session concurrency limit.
Cases, supporting skills, schemas, and corpus assets resolve from the evaluated
project. Darrow selects `--results-root` before the separator; forward
`--run-state-root` after it to select active ownership storage independently.
The package installation directory is not run storage.

## Command and evidence changes

| Legacy workflow                            | Migration entrypoint or current gap                                                                                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct `bun eval`                          | Set an explicit Sevro route on the existing command. Select cases with its existing filters; use the migration entrypoint's `--case-id` for one exact ID. See [direct caller](README.md#direct-evaluation-caller).                           |
| `--harness codex\|claude`                  | Forward `--host codex\|claude`, explicit host binary, model, effort, and credentials.                                                                                                                                                        |
| Text-file `--condition`                    | Use Darrow `--benchmark-condition-file` and optional label before `--`. Forwarded Sevro `--condition` selects `passive` or `enforced`.                                                                                                       |
| `--skill`, `--plugin`, repeatable `--case` | Use the same filters before `--` on the migration run entrypoint. Exact ownership filters intersect; repeatable ID substrings narrow that set. Filtered runs retain a selection manifest and each public result.                             |
| `--jobs`                                   | Forward `--jobs <positive integer>` after `--`. Sevro defaults to three simultaneous trials within each case; `--jobs 1` is serial. Selected cases remain sequential. Normal command cutover remains pending.                                |
| Suite execution                            | Set an explicit Sevro route on `bun run eval:orchestration` or `bun evals/runner/suite.ts`. The caller translates native model, semantic, and advisory options to the public suite route. See [README.md](README.md#benchmark-suite-caller). |
| `--output` result array                    | Retain public CLI JSON and per-run evidence under the explicit results root. Legacy output compatibility is not provided by the migration entrypoint.                                                                                        |
| Legacy suite manifest                      | New suites retain `suite-run.json`, each raw Sevro result, and separate task, activation, and ablation reports.                                                                                                                              |
| Repository-guide evaluation                | Set an explicit Sevro route on `bun evals/repository-guide.ts`. Existing selectors, dry runs, controls, and first-failure stopping remain; per-cell JSON uses the public Sevro format. Default cutover awaits the pin.                       |

Suite `--seed` remains before `--` and preserves the legacy host/mode block
shuffle. The manifest retains `orderSeed` and the full indexed `cellPlan`
before execution; completed and cancelled cells retain its executed prefix.
An omitted seed generates a retained timestamp, and an empty seed is valid.
See [ordering validation](ordering-validation.md). This covers execution order;
normal benchmark caller cutover and unsupported enforcement policies remain pending.

The direct caller retains selectors, candidate and grader routes, text conditions,
skill controls, trials/jobs/threshold, and storage options. Relative paths resolve
from the invocation directory. `--output` now receives the selection manifest;
its containing directory is protected from isolated tools and checks. Stdout is
the same JSON rather than legacy terminal presentation. Individual public exit
categories stay in the manifest; the caller aggregates case failures as exit `1`,
rejects invalid invocation with `64`, and preserves cancellation exits. Custom
corpus-manifest paths and manually supplied human-review minutes remain explicit
migration gaps. See [direct caller validation](direct-caller-validation.md).

The suite caller preserves relative `--suite` and `--output`, default storage,
selectors, evidence limits, seeds, dry execution, and supported native routes.
Stdout deliberately changes to the new suite's JSON summary; the absolute
evidence directory prints on stderr. Results and separate reports use the new
formats, rather than legacy per-host arrays and console tables. Ablation results
must be outside the evaluated project; use an explicit external `--output`.
The default advisory route is Codex `gpt-5.6-sol/low`; `--no-judge` disables it,
while the independent semantic route remains Codex `gpt-5.6-luna/low`.
Sevro does not yet supply native Claude grader routes. Requested Claude semantic
or active advisory grading fails explicitly instead of substituting Codex.
See [caller validation](benchmark-caller-validation.md).

Sevro's task, execution, and grading states remain separate. Activation,
semantic gates, and advisory assessments retain their own evidence. The direct
CLI exits `0` for passed or unassessed execution, `1` for a failed task assessment,
`2` for execution failure, `3` for grading error, `4` for unavailable required
evidence, `64` for invalid invocation, `70` for runner failure, and `130` for
SIGINT, and `143` for SIGTERM. Filtered direct selection retains each raw category
and exits `1` for a case failure or invalid public result; cancellation preserves
the signal's category. The suite retains each raw category and exits `1` when a cell or
its separate activation or comparison gate fails. Dry execution is unassessed.

### Darrow cache environment

Sevro no longer sets `DARROW_CACHE_DIR` in its Claude adapter or shell grader.
Darrow's locked plugin launchers use their documented `$HOME/.darrow/cache`
default. With `--claude-uv-cache-dir`, the candidate's home is beneath the
trial's Git-private runtime directory, and isolated shell checks have a separate
home there. Neither inherits the caller's cache override. Their Darrow caches
are separate, while the copied UV cache remains shared within one trial.
Runtime state is removed with the fixture.

This is a deliberate environment migration from the legacy shared Darrow cache.
Checks must use the launcher or its documented default rather than assume a
Sevro-provided Darrow variable or reuse the candidate's launcher cache. No
marketplace plugin changes or new extension capability are needed.

Legacy reports distinguish task quality from requested evaluation-record
bookkeeping. Sevro's default task verdict includes every active required check.
Darrow's suite now retains that distinction in separate
`quality-report.json` and `quality-report.md` artifacts. Their quality metric
excludes only the two bookkeeping checks, while the public task rate and verdict
retain all required checks and any selected task policy. Invalid inputs fail
the report. Dry or unavailable evidence stays unmeasured, and custom task
policies do not acquire a default quality rate. This explicit treatment of
unavailable evidence is not a claim of numeric equivalence to historical legacy
quality rates. See [quality report validation](quality-validation.md).

## Remaining benchmark contracts

Parent `case_routes` and native `effective_owner_routes` are separate inputs.
An accepted native child route does not establish private goal-contract
selection, profile, workflow, or risk dimensions. Legacy `goal_expectations`,
`apply_expected_goal_routes`, `--expected-goal-routes`, `--assert-goal-routes`,
and `--assert-goal-dimensions` do not have migration equivalents. They must keep
an explicit unsupported result until a deliberate replacement or retirement is
documented for the affected workflow.

Bundled Sevro hosts support passive execution and refuse enforced conditions or
unsupported instrumentation. Generic adapters can negotiate instrumentation;
an enforced test using such an adapter does not prove enforcement by a bundled
host. Keep an enforced suite cell distinct from passive execution.
The legacy Codex guard conditionally uses `bin/adaptive-delivery-preflight`;
the current adaptive-delivery plugin uses its contained Python backend and does
not ship that helper. Restoring removed runtime machinery from history is outside
this extraction. The intended enforcement migration remains a cutover gate.

## Historical results

Preserve original legacy arrays, manifests, transcripts, and comparison inputs.
The Sevro report command consumes its versioned CLI and evidence formats; it
does not directly interpret legacy arrays. Darrow's standalone
`evals/sevro-extension/legacy-report.ts` now reads legacy result arrays,
`darrow-orchestration-suite-v1` manifests, and `darrow-eval-trial-v1` checkpoints.
It writes Markdown or `--json` to standard output, needs no Sevro installation
or generic runner, and preserves the original files. The existing legacy
report command now uses this view for both Markdown and `--json`. See the
[historical reader contract](README.md#historical-result-interpretation) and
[validation](history-validation.md).
Missing execution mode, evaluator identity, or completeness stays unknown.
Never infer execution from an empty response or zero timing, manufacture a
current Sevro identity, or silently make different grading and instrumentation
eligible for comparison.

Recorded summaries remain archival claims. Measured quality, protocol, and
bookkeeping require a complete executed suite boundary and available facts;
checkpoints remain partial. Invalid inputs fail interpretation while valid peers
remain visible. Other historical comparison snapshots retain their original
formats; this reader does not convert them into Sevro comparison inputs or
replace every specialized comparison command. Those workflows still need an
explicit migration or retirement before their implementation can be removed.

The legacy report command preserves adjacent `report.md` and explicit `--output`
destinations. Its human format deliberately changes to the historical view,
including input digests, completeness, diagnostics, and retained evidence.
The old cross-cell efficiency, judge-overhead, and activation rollup tables
are retired; recorded summary values and distinct trial outcomes remain archival
facts. The standalone reader still defaults to stdout and now accepts Markdown
`--output`. Neither command accepts an input archive or its aliases as output.
JSON remains stdout-only. Invalid arguments or refused/unwritable output exit
`64`; invalid archive input exits `1` with a diagnostic report. Valid interpreted
archives exit `0` even when trials failed or measured rates are unavailable.
Unversioned suite manifests are now diagnosed by the default route too; pass
their result arrays separately to retain unknown suite provenance. The old
formatter and its private function tests are removed. See
[report-command validation](legacy-report-command-validation.md).

The documented `evals/runner/compare.ts <baseline.json> <candidate.json>` command
now delegates legacy array comparison to `evals/sevro-extension/legacy-compare.ts`.
It retains condition labels and recorded metric deltas without generic runner
imports. Missing required identity, different recorded grading or
instrumentation, and invalid, dry, or unknown evidence are incomparable and
exit `1`. Input bytes stay intact, and paths in output are absolute.
The output explicitly limits these deltas to archival claims: they do not
establish complete planned runs or current evaluator equivalence. Missing
grading metadata remains unknown. See the
[command contract](README.md#historical-result-interpretation) and
[comparison validation](legacy-compare-validation.md). Other specialized
comparison formats retain their migration gates.

## Release, update, and rollback

Sevro maintainers own its package version, public CLI and protocol compatibility,
runtime dependencies, packaged assets, and standalone CI. Darrow maintainers own
the extension, cases and policies, exact development dependency pin, integration
matrix, and marketplace boundaries. No marketplace plugin gains this runtime.

### Compatibility matrix

The current local candidate uses Sevro `0.1.0-dev.0`, extension protocol
`sevro.extension.v1`, and Bun `1.3.13`. Each release must retain the exact package
digest, Darrow revision and patch identity, negotiated capabilities, host route,
and result paths for the applicable rows below.

| Boundary                               | Required check                                                                                                                    | Current evidence and limits                                                                                                                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Standalone package                     | Sevro typecheck, formatting, tests, and `test:package-install`                                                                    | Sevro's `Verify Sevro` workflow declares macOS, Node 24, and Bun 1.3.13. Local gates pass; no remote workflow run is claimed here.                                                                                                   |
| Installed Darrow integration           | Darrow `test:eval-runner-sevro-package` against the exact candidate tarball                                                       | The installer clears the checkout override and runs public CLI/protocol fixtures from a separate consumer. See [suite-validation.md](suite-validation.md) for the package digest and results.                                        |
| Generic passive and enforced execution | Shared parity fixtures with adapters that declare the relevant capabilities                                                       | Covers condition identity, grading, interruption, ownership, and isolation. It does not establish enforced execution by bundled hosts.                                                                                               |
| Bundled Codex and Claude               | Supported passive suite and extension fixtures with synthetic executables and complete or deliberately incomplete native receipts | Covers host-specific preparation, route binding, continuation, activation, and unavailable evidence. These deterministic checks make no live model claim.                                                                            |
| Focused native behavior                | One understood trial at a time on the selected native host                                                                        | [live-validation.md](live-validation.md) records Codex negative activation, Claude repository dispatch/control checks, and standalone Claude continuation. Their models and routes are explicit; one trial is not a stability claim. |
| Published Darrow pin                   | Frozen dependency installation and the installed integration gate against the exact release                                       | Pending publication and pinning. Darrow's current documentation CI does not run this gate.                                                                                                                                           |

Native isolation checks require the relevant host's sandbox or macOS sandbox
support. A skipped platform or unavailable-host assertion is not evidence for
that boundary. Before claiming a new host or platform combination, add it to the
matrix and retain its corresponding public-interface evidence.

Before cutover:

1. Prepare a versioned Sevro release candidate and run its tests, typecheck,
   formatting, and installation without source Git metadata.
2. Run Darrow's public-interface compatibility gate against that exact tarball:
   `SEVRO_PACKAGE_TARBALL=/absolute/path/to/sevro.tgz bun run test:eval-runner-sevro-package`.
   Resolution inventory alone is insufficient. Record intentional command,
   output, condition, and comparison changes alongside focused live evidence.
3. Publish the reviewed release under the separately authorized release process.
   Pin its exact version in Darrow's development dependencies and lockfile.
4. Add Darrow CI against that installed pin, migrate normal callers, and remove
   generic implementation and unit tests only after their required workflows
   have proved compatibility or have documented deliberate migrations.

For an update, test the proposed exact version and supported host/extension
matrix before changing the pin. Keep evidence from both versions. To roll back,
restore the last proven exact dependency and lockfile through a new commit and
rerun its installed compatibility gate. Preserve failed-version evidence and
identify its evaluator settings explicitly; do not relabel it as a run from the
restored version. A local checkout override remains development evidence.
