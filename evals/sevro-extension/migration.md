# Sevro migration

Normal `bun eval`, `bun run eval:orchestration`, and `evals/repository-guide.ts`
run Darrow cases through Sevro's public CLI and extension protocol. Darrow pins
published `@bjoernrochel/sevro@0.1.0-rc.1` as an exact development dependency.
Run `bun install --frozen-lockfile` before using these commands. Generic runner
implementation, private tests, and source-copy integration are removed from
Darrow; public integration tests and domain policy remain.
The [runner cutover inventory](runner-cutover-inventory.md) records the remaining
ownership groups, source dependencies, and domain tests already moved out.
The ownership boundary is recorded in
[ADR-0010](../../docs/decisions/ADR-0010-extract-the-evaluation-runner-into-sevro.md)
and the extension contract in
[ADR-0011](../../docs/decisions/ADR-0011-negotiate-evaluation-extensions-across-the-runner-boundary.md).

## Local and coordinated development

Normal execution needs no runner environment variable. For coordinated
development, select exactly one absolute runner override:

| Environment variable    | Purpose                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `SEVRO_CHECKOUT`        | Run the named Sevro source checkout and retain its revision and dirty-patch identity.               |
| `SEVRO_PACKAGE_BIN`     | Run an installed package's executable and retain package version and build identity.                |
| `SEVRO_PACKAGE_TARBALL` | Select a tarball for the package-install compatibility gate; this does not select a candidate host. |

With neither override, commands resolve the frozen dependency from Darrow's
tooling installation, independently of the candidate project or working
directory. Its public manifest must match the exact declared version. Missing
or mismatched installations fail explicitly. Empty, relative, or conflicting
overrides fail without fallback. There is no implicit checkout discovery.
Darrow's project revision and dirty state remain separate from runner identity.

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
| Direct `bun eval`                          | Uses the frozen Sevro dependency by default. Select cases with its existing filters; use the extension entrypoint's `--case-id` for one exact ID. See [direct caller](README.md#direct-evaluation-caller).                                   |
| `--harness codex\|claude`                  | Forward `--host codex\|claude`, explicit host binary, model, effort, and credentials.                                                                                                                                                        |
| Text-file `--condition`                    | Use Darrow `--benchmark-condition-file` and optional label before `--`. Forwarded Sevro `--condition` selects `passive` or `enforced`.                                                                                                       |
| `--skill`, `--plugin`, repeatable `--case` | Use the same filters before `--` on the migration run entrypoint. Exact ownership filters intersect; repeatable ID substrings narrow that set. Filtered runs retain a selection manifest and each public result.                             |
| `--jobs`                                   | Forward `--jobs <positive integer>` after `--`. Sevro defaults to three simultaneous trials within each case; `--jobs 1` is serial. Selected cases remain sequential. Normal callers use the installed package.                              |
| Suite execution                            | Set an explicit Sevro route on `bun run eval:orchestration` or `bun evals/runner/suite.ts`. The caller translates native model, semantic, and advisory options to the public suite route. See [README.md](README.md#benchmark-suite-caller). |
| `--output` result array                    | Retain public CLI JSON and per-run evidence under the explicit results root. Legacy output compatibility is not provided by the migration entrypoint.                                                                                        |
| Legacy suite manifest                      | New suites retain `suite-run.json`, each raw Sevro result, and separate task, activation, and ablation reports.                                                                                                                              |
| Repository-guide evaluation                | Set an explicit Sevro route on `bun evals/repository-guide.ts`. Existing selectors, dry runs, controls, and first-failure stopping remain; per-cell JSON uses the public Sevro format. Default cutover awaits the pin.                       |

Suite `--seed` remains before `--` and preserves the legacy host/mode block
shuffle. The manifest retains `orderSeed` and the full indexed `cellPlan`
before execution; completed and cancelled cells retain its executed prefix.
An omitted seed generates a retained timestamp, and an empty seed is valid.
See [ordering validation](ordering-validation.md). This covers execution order;
normal benchmark callers now use the installed package. Bundled hosts still
reject enforced requests explicitly.

The direct caller retains selectors, candidate and grader routes, text conditions,
skill controls, trials/jobs/threshold, and storage options. Relative paths resolve
from the invocation directory. `--output` now receives the selection manifest;
its containing directory is protected from isolated tools and checks. Stdout is
the same JSON rather than legacy terminal presentation. Individual public exit
categories stay in the manifest; the caller aggregates case failures as exit `1`,
rejects invalid invocation with `64`, and preserves cancellation exits.
`--corpus-manifest` selects an explicit pinned corpus with retained manifest
identity and source provenance. Its paths resolve from the invocation directory
on the direct command; the migration entrypoint requires an absolute path before
`--`. See [corpus validation](corpus-caller-validation.md).
The direct caller also accepts `--human-review-minutes` before `--`, retaining
minutes per trial as a user-supplied selection annotation. Missing values stay
unknown, zero is explicit, and empty, negative, or non-finite values fail before
execution. The annotation does not enter Sevro grading, identity, automated
measurements, or generic reports. See [manual-review validation](manual-review-validation.md)
and
[direct caller validation](direct-caller-validation.md).

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

### Fixture preparation

Fixture preparation now preserves the legacy `.git/fixture-state` directory
through the Darrow extension. Generic Sevro mechanics do not create this domain
state. The failed-check fixture's oracle tests have moved to `evals/domain/` and
the installed package gate includes that directory. See
[fixture-state validation](fixture-state-validation.md) for the regression,
preserved examples, and observed gates.
The incomplete-verification fixture's sixteen tests also use that transport;
see [verification fixture validation](verification-fixture-validation.md).
The authorized-publication fixture's eight tests preserve draft flags, help
state, and remote commit evidence through the same public command; see
[publication fixture validation](publication-fixture-validation.md).
The verification-cadence fixture's eleven synthetic trace examples also use the
public command; see [cadence fixture validation](cadence-fixture-validation.md).
Canonical Darrow setup now resolves ambient tools before fixture wrappers, as
the legacy setup did. Execution and shell grading still use declared fixture
tools. The capability-review fixture's eight examples use the public command;
see [capability fixture validation](capability-fixture-validation.md).
The readiness fixture's nine examples also use the public command, with copied
domain assets and explicitly prepared tools for isolated checks; see
[readiness fixture validation](readiness-fixture-validation.md).
The real commit fixture's twelve examples retain the actual Git plugin helper,
hook failure, guarded remediation, review evidence, and local publication
through the public command; see
[real commit fixture validation](real-commit-fixture-validation.md).
The discovery loophole tests preserve the canonical subject question and
semantic-check declarations; see
[discovery oracle validation](discovery-oracle-validation.md).
The feedback fixture's six tests retain scoped delivery, rejected approval, and
bounded diagnostics; see [feedback fixture validation](feedback-fixture-validation.md).
The four composition fixture tests retain actual publication observations,
explicit repair limits, and newline policy; see
[composition fixture validation](composition-fixture-validation.md).
The sixty review-outcome tests preserve package setup, captured check evidence,
finding states, and complete report presentation under both shell paths; see
[review outcome validation](review-outcome-validation.md).
The twenty-five goal-review tests preserve activation requirements, canonical
artifacts, and original-finding-bound repair proof through public protocol and
command requests; see [goal review validation](goal-review-fixture-validation.md).

### Activation and prompt policy

The twelve activation policy tests and five prompt tests now live under
`evals/domain/`. They exercise public resolve, prepare, and evaluate requests,
Darrow's separate activation gate, and prompt output from the installed command.
The legacy implementation files are removed after the published-package cutover.
See [activation and prompt validation](activation-prompt-validation.md).

Claude plugin tokens now use `/plugin:skill`, binding the installed manifest's
namespace. Explicit Claude repository prompts must begin with `/skill`; an inline
mention is rejected before execution. Codex repository tokens remain `$skill`
and may appear inline. The unused legacy `source_plugin` field is rejected;
the actual packaged plugin manifest supplies its namespace. These deliberate
migrations preserve native scope and make unsupported forms explicit.

The two owner-evidence policy tests now live under `evals/domain/` and consolidate
the existing public native-acceptance matrix. Model and effort mismatches, context
inheritance, and complete observations without a unique accepted child fail;
missing or malformed evidence remains unavailable. Native route evidence leaves
private contract selection unverified. See
[owner evidence validation](owner-evidence-validation.md).

The generic permission-locked cleanup test now belongs to Sevro's public CLI
regressions. Its fix passes independent installed-package checks. See
[fixture cleanup validation](fixture-cleanup-validation.md).

The exact local ticket round-trip example now lives under `evals/domain/` and
uses the installed public command. It retains committed scaffolding, case-asset
setup, exact ticket body bytes, the log alias, and ordered events. See
[ticket fixture validation](ticket-fixture-validation.md).

The three backend mounting examples now use public preparation requests under
`evals/domain/`. Migration exposed an omitted owning backend in implicit Codex
project discovery; the extension preserves `.agents/backend` with bounded,
Git-excluded artifacts and hidden-eval filtering. Native plugin packages retain
their own backend layout. See
[backend mounting validation](backend-mount-validation.md).

The remaining mounting policy is now reconciled through public preparation and
installed-command examples. Native packages retain filtered skill-local
mechanics, agents, hooks, and manifests; sibling selection and independent
composition stay covered. Git exclusions apply to declared artifacts, so
unrelated setup files under `.agents/` stay visible. The legacy merged
`source_plugin` identity is retired in favor of separately packaged providers.
The mixed fixture test file is removed; its canonical workspace assertion is
preserved by a new Sevro public CLI regression and engine fix. See
[mounting fixture validation](mounting-fixture-validation.md).

## Benchmark assertion migration

The user selected task outcomes and independently observed native owner
model/effort comparisons for the three canonical suites.
`profile-impact-suite.yaml` replaces its two `apply_expected_goal_routes`
declarations with exact `effective_owner_routes` maps.
`localized-routing-policy-suite.yaml` and `promoted-routing-suite.yaml`
replace their named `goal_expectations` sets with the same model/effort tuples
under their comparison modes. The files now declare Codex scope explicitly,
matching their conditions, parent route maps, and the supported native receipt.

Parent `case_routes` and native `effective_owner_routes` remain separate.
All case filters, condition files, experiment and mode identifiers, skill
overrides, record requirements, and enforced condition defaults are preserved.
The suites no longer assert private goal profiles, workflow/risk selection, or
selected-versus-effective goal contract application. Historical mode names and
condition instructions remain labels and task inputs; they do not establish
private dimensions. Original snapshots retain their original interpretation.
See [benchmark migration validation](benchmark-migration-validation.md).

The suites also expose explicit `-passive` variants for observational runs.
Each variant preserves its original benchmark inputs and route checks and sets
`owner_evaluation: passive`. Select those mode names explicitly; selecting all
modes also selects the original enforced variants. This installs no active
benchmark correction and leaves ordinary fixture isolation in place. See the
[passive commands and regression evidence](passive-benchmark-validation.md).

The deprecated `darrow-ticket-pipeline` baseline gains no special handling.
Its task checks and explicitly requested self-reported evaluation counts use the
same public grading as other benchmark modes. Legacy phase, iteration, stable
child ID, and required-skill reconciliation are retired; native acceptance does
not prove those bindings. This follows the user's choice to retain outcomes and
counts without building new phase evidence or active benchmark correction.
The baseline remains a historical reference, with no native phase-equivalence
claim. Existing enforced variants remain explicitly unsupported by bundled hosts.
See [orchestration-policy reconciliation](orchestration-policy-migration.md).

Custom suites using `goal_expectations` or `apply_expected_goal_routes`,
and the legacy `--expected-goal-routes`, `--assert-goal-routes`, and
`--assert-goal-dimensions` options still fail explicitly on the Sevro route.
The replacement requires an explicit native owner expectation; it does not
accept or infer a private contract from parent route or final-response text.

Bundled Sevro hosts support passive execution and refuse enforced conditions or
unsupported instrumentation. Generic adapters can negotiate instrumentation;
an enforced test using such an adapter does not prove enforcement by a bundled
host. Keep an enforced suite cell distinct from passive execution.
The retired legacy Codex guard conditionally used `bin/adaptive-delivery-preflight`;
the current adaptive-delivery plugin uses its contained Python backend and does
not ship that helper. Restoring removed runtime machinery from history is outside
this extraction. Enforced variants remain explicit unsupported requests; no
guard or active benchmark correction is added.

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

Per-trial private route applications and orchestration metrics are now retained
under trial `recorded` data, including exact selected/effective model and effort
tuples. Known metadata fields are archival claims; they do not establish current
native acceptance, populate `effectiveOwnerRoute`, or alter measured rates.
Absent values stay null and malformed provided values produce diagnostics.
The interpreter reads the already recorded metadata; it does not reparse a
private goal contract or execute its former runtime. See
[archival claims validation](historical-claims-validation.md).

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

The two historical reviewer-routing validators now live at
`evals/sevro-extension/legacy-native-review-proof.ts` and
`evals/sevro-extension/legacy-claude-review-proof.ts`. Their former
`evals/runner/` paths are retired. Arguments, absolute-path requirements, proof
formats, atomic output, and exit categories remain unchanged. All fourteen
artifact examples now exercise these standalone commands under `evals/domain/`,
without importing runner implementation or private types. The shared axis-name
matcher is Darrow policy; the legacy Codex adapter imports it independently of
the historical validator. No historical result is relabeled as Sevro evidence.
See the [command contract](README.md#historical-reviewer-routing-artifacts) and
[validation](historical-review-proof-validation.md).

## Release, update, and rollback

The npm package is `@bjoernrochel/sevro`. Its installed executable remains
`sevro`; package evidence retains the scoped name. Candidate tarballs use
`bjoernrochel-sevro-<version>.tgz`.

Sevro maintainers own its package version, public CLI and protocol compatibility,
runtime dependencies, packaged assets, and standalone CI. Darrow maintainers own
the extension, cases and policies, exact development dependency pin, integration
matrix, and marketplace boundaries. No marketplace plugin gains this runtime.

### Compatibility matrix

The current published exact pin uses Sevro `0.1.0-rc.1`, extension protocol
`sevro.extension.v1`, and Bun `1.3.13`. Each release must retain the exact package
digest, Darrow revision and patch identity, negotiated capabilities, host route,
and result paths for the applicable rows below.

| Boundary                               | Required check                                                                                                                    | Current evidence and limits                                                                                                                                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone package                     | Sevro typecheck, formatting, tests, and `test:package-install`                                                                    | Sevro's `Verify Sevro` workflow declares macOS, Node 24, and Bun 1.3.13. Local gates pass; no remote workflow run is claimed here.                                                                                                              |
| Installed Darrow integration           | Darrow `test:eval-runner-sevro-package` against the exact candidate tarball                                                       | The installer clears the checkout override and runs public CLI/protocol fixtures from a separate consumer. See [suite-validation.md](suite-validation.md) for the package digest and results.                                                   |
| Generic passive and enforced execution | Shared parity fixtures with adapters that declare the relevant capabilities                                                       | Covers condition identity, grading, interruption, ownership, and isolation. It does not establish enforced execution by bundled hosts.                                                                                                          |
| Bundled Codex and Claude               | Supported passive suite and extension fixtures with synthetic executables and complete or deliberately incomplete native receipts | Covers host-specific preparation, route binding, continuation, activation, and unavailable evidence. These deterministic checks make no live model claim.                                                                                       |
| Focused native behavior                | One understood trial at a time on the selected native host                                                                        | [live-validation.md](live-validation.md) records Codex negative activation, Claude repository dispatch/control checks, and standalone Claude continuation. Their models and routes are explicit; one trial is not a stability claim.            |
| Published Darrow pin                   | Frozen dependency installation and the installed integration gate against the exact release                                       | Publication, exact pinning, and frozen installation passed. The manual [installed candidate workflow](../../.github/workflows/sevro-integration.yml) is prepared; automatic frozen-pin verification is configured for pull requests and pushes. |

Native isolation checks require the relevant host's sandbox or macOS sandbox
support. A skipped platform or unavailable-host assertion is not evidence for
that boundary. Before claiming a new host or platform combination, add it to the
matrix and retain its corresponding public-interface evidence.

The `Installed Sevro integration` workflow accepts an exact published version
and the reviewed archive's SHA-256. It downloads that package from npm, verifies
its name, version, and digest before installation, and runs the existing installed
parity gate on macOS with Node 24 and Bun 1.3.13. Source-checkout and preselected
executable overrides are cleared. The workflow retains the downloaded archive,
npm metadata, verified candidate identity, Darrow revision, and parity log for
30 days, including failed runs. It does not publish a package or run live models.
There is no default candidate version. A first remote execution awaits a
published release; local workflow validation does not prove remote CI success.
See [installed CI validation](installed-ci-validation.md) for the local checks.
The exact development dependency is pinned. Its automatic job is configured for pull requests and all pushes. It runs
the frozen installed public-interface/domain gate with both runner overrides
cleared, retains package and lock identity with its logs, and declares the
native sandbox and fixture-tool prerequisites. Candidate archive testing remains
manual-only. See [frozen CI validation](frozen-ci-validation.md) for the complete
matrix, observed local mechanics, and remote-run limits.

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
