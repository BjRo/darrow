# Darrow extension for Sevro

`index.ts` speaks the versioned `sevro.extension.v1` process protocol without
importing Sevro internals. Darrow owns case discovery and translation; Sevro
owns fixture construction, host execution, built-in checks, isolation, and
retained results.
The npm package is `@bjoernrochel/sevro`; its installed command remains `sevro`.

See [migration.md](migration.md) for local development, command and evidence
changes, the compatibility matrix, and release update and rollback steps.
Normal direct, benchmark, and guide callers use published
`@bjoernrochel/sevro@0.1.0-rc.1` from Darrow's frozen development dependency.
Explicit package or checkout routes remain available for development.
The [scoped release validation](scoped-release-validation.md) records the current
archive identity, checks, and targeted benchmark expectation repair.
The [runner retirement record](runner-retirement-validation.md) records generic
implementation removal and the retained public integration boundary.
The [frozen CI matrix](frozen-ci-validation.md) records automatic installed-pin
verification, host prerequisites, and local evidence limits.

This migration slice resolves one selected skill-free experiment case or
plugin-local skill case, with optional candidate skill overrides. It accepts generated Git commits or a pinned corpus
repository, optional working-tree and staged files, committed scaffolding,
Git hooks, fixture stub binaries, local fixture tickets, fixture setup scripts,
hidden shell checks with exit-code and stdout assertions,
Git HEAD change and ancestry expectations,
combined final-message checks with skill-owned JSON Schemas, and semantic
propositions graded by Sevro's separate evaluator route.
Setup-only generated fixtures omit the commit list and begin with an empty Git
history. Their setup creates the initial snapshot without a placeholder commit.
The compatibility inventory also includes `.agents/skills/*/evals/*.yaml`.
Implicit repository-skill cases mount their owning skill under `.agents/skills/`
on Codex without a plugin wrapper. Explicit repository cases negotiate
`sevro.codex.repository-invocation` and use the native `$skill` token. Their
separate declaration binds repository scope in configuration and run identity.
Repository cases can compose supporting plugins or selected plugin skills while
keeping the owning skill outside their packages. Ordered activation validates
the combined set. Claude uses the required `.claude/skills/<name>` mirror and
native `/skill` invocation. Explicit activation requires a complete command
receipt; an ordinary Skill call cannot repair an unverified command. Supporting
plugins keep their own package directories on Claude too.
An explicit Claude repository prompt must begin with `{{skill_invocation}}` and
its arguments. An inline mention is rejected before execution. Plugin invocations
use their installed namespace: `$plugin:skill` on Codex and `/plugin:skill` on
Claude. See [activation and prompt validation](activation-prompt-validation.md)
for the legacy rendering migrations and public-interface tests.
Pass `--claude-project-settings` for either explicit or implicit repository
trials. Without it, preparation rejects the unavailable project-skill route.
The guide's legacy Claude disclosure check now uses the complete retained final
response through `darrow.evals.disclosure`. It preserves the declared patterns
and the Codex non-applicable result. Missing, partial, duplicate, or foreign
response evidence stays unavailable. Unmapped guide assertions that depend on
the legacy response file or harness variable fail resolution explicitly.

The guide's owner and goal-control exclusion uses `sevro.host.native-controls`
on both hosts. Darrow grades the native labels and explicit counts, rejects
contradictory older receipts when present, and cannot infer control absence
inside uninspected Codex submitted code. Claude's acceptance count remains
unknown. The assertion fails on launch or mutation attempts without requiring
agent acceptance.

For a plugin-local case, `prepare` mounts the selected skill's files under
`.agents/skills/` and excludes their exact paths from Git status. Unrelated setup content under
`.agents/` remains visible to Git; the directory is not excluded wholesale. Colocated
`evals/` files and generated caches stay out of the candidate fixture. Skill
bytes enter the fixture identity through their retained artifact digests.
Executable skill files keep owner execute permission in the fixture and retained
artifact copy. Project discovery also retains the owning plugin's contained
backend under `.agents/backend`, with the same filtering, Git exclusion, and
artifact limits. It does not install plugin hooks or agents into project settings.
Cases with `mount_plugin_skills: true` mount all sibling skills
from the owning plugin through the same project-discovery path, with a shared
artifact limit. Competition activation requires that sibling set.
Cases with `additional_plugins` package every named provider separately in
the isolated Codex marketplace, including its skills and contained mechanics.
Claude retains the same provider separation. Each provider keeps its own
manifest identity; the unsupported `source_plugin` merging field is rejected.
`additional_skills` packages only the named skills with their own provider's
manifests and mechanics. The shared mount is bounded to 256 files and 4 MiB.
The provider paths are repository-relative and cannot escape the project root;
activation membership is checked against the combined mounted skill set.
For a plugin-local case containing `{{skill_invocation}}`, resolution binds the
owning Codex plugin manifest and Sevro renders `$plugin:skill` once per trial.
Preparation packages
the selected skill, both plugin manifests, and the plugin's backend, agents,
bin, config, and hooks when present. It excludes colocated evals and caches,
then declares a local `darrow-eval` marketplace to Sevro. Sevro verifies the
Git-excluded artifacts and installs the package into its isolated Codex home
before the candidate turn. Such cases require Sevro's Codex plugin host.
Implicit positive, negative, and competition activation cases are supported
when they mount their owning skill. A case can require an observed skill
sequence, supporting skill membership, or exclusion; every named skill must be
in the mounted set. A complete host observation with `primarySkill` and ordered
`observedSkills` yields a separate `darrow.evals.activation` domain outcome.
The bundled Codex route supplies `sevro.codex.explicit-invocation` after a
completed turn receives exactly one runner-rendered token. It does not require
a visible skill-file read. Implicit cases use `sevro.codex.skill-reads` for completed direct
reads of a mounted skill body through direct `cat`, complete exact `sed` pages,
and exact `lean-ctx -c` wrappers around those reads. The same receipt covers
skill files in the exact installed plugin roots returned by Codex. Synthetic adapters can
supply `darrow.activation` for parity tests. Missing, partial, duplicate,
foreign, or inconsistent observations make activation unavailable without
changing the task verdict. Other Codex read patterns still need parity work.

The entrypoint verifies `fixture.source` against
`evals/corpus/orchestration/manifest.yaml` or an explicit `--corpus-manifest`
and a clean prepared checkout, then
passes that one source through Sevro's protected case-source map. Prepare the
source with `bun run eval:orchestration:prepare --source <id>` before running a
corpus case. The extension preserves the invariant, source path, and check
names in namespaced extension data. Fixture setup runs after Sevro builds each Git fixture
and before it mounts skill artifacts. The setup script is bound to the resolved
case by a digest and `{{case_dir}}` points to the case source directory. Setup
receives Sevro's bounded environment and two-minute timeout; scripts that need
ambient credentials or longer dependency installs need further migration work.
Schema files are read from the owning skill at resolution, bounded to that
skill's directory, and embedded in the selected case for Sevro grading.
Check metric labels are preserved in per-trial evidence: failed
`escaped_defect` and `false_positive` checks count as findings, while
`defect_detection` is the fraction of labeled checks that pass. Missing or
unavailable check evidence leaves that metric unmeasured (`null`).
Other case fields and fixture mechanics fail explicitly. The legacy
`{{repo_dir}}` prompt token maps to Sevro's per-trial
workspace token. Other prompt templates still fail explicitly.

## Historical result interpretation

Read legacy result arrays, `darrow-orchestration-suite-v1` manifests, or
`darrow-eval-trial-v1` checkpoints without executing an evaluator:

```sh
bun evals/sevro-extension/legacy-report.ts /absolute/path/to/suite-run.json
bun evals/sevro-extension/legacy-report.ts /absolute/path/to/results.json --json
bun evals/runner/report.ts /absolute/path/to/suite-run.json --json
bun evals/runner/report.ts /absolute/path/to/suite-run.json --output /absolute/path/to/report.md
```

The standalone command writes Markdown by default and `darrow-legacy-report-v1`
JSON with `--json`. Its local dependencies are `legacy-report.ts`,
`legacy-evidence.ts`, and `legacy-output.ts`; it needs Bun, but no Sevro installation, generic runner,
Git metadata, host credentials, or model calls. Relative cell result paths
resolve beside the input manifest. Both commands leave archive bytes unchanged.
The legacy command now uses this view for Markdown too, preserving adjacent
`report.md` and `--output` destinations. The standalone command writes Markdown
to stdout by default and accepts `--output` for a file. File output prints its
absolute path and replaces an existing report atomically. Input destinations,
including symbolic links and hard links, are refused.
`--json` always writes JSON to stdout; combining it with `--output` is invalid.
The old cross-cell rollup layout is retired. Recorded summaries and separate
outcomes remain in the historical table and retained evidence.

The view retains absolute input paths and SHA-256 digests, recorded summary
claims, named checks, candidate and grader routes, activation, advisory and
semantic evidence, and requested versus observed policy assistance. Missing
evaluator metadata stays unknown. It supplies no current Sevro identity or
comparison eligibility. Raw responses and transcripts remain in the original
input artifacts and are not copied into this view.

Each historical trial also retains known `routeApplication` and
`orchestrationMetrics` fields under `recorded`. These preserve the archived
selected/effective routes, private profile and workflow/risk labels, application
boundary, child usage, and orchestration counts as recorded claims. They do not
supply native owner acceptance or change measured outcomes. Missing fields stay
null; malformed provided metadata produces diagnostics. Unrelated private
payload fields are omitted. See
[archival claims validation](historical-claims-validation.md).

Measured task quality excludes only the two historical bookkeeping checks;
protocol rate retains the recorded trial verdict. Bookkeeping requires both
named checks. All rates require complete executed evidence and their relevant
facts. Dry, unknown, partial, unavailable, or contradictory evidence stays
unmeasured. Raw recorded rates remain visible as archival claims. A standalone
array without the planned run boundary stays incomplete or unknown, even when
execution is explicit. Checkpoints always stay partial.

Exit `0` means the supported archive was interpreted, including failed trials;
it does not mean the evaluated task passed. Exit `1` means malformed,
unreadable, contradictory, or unsupported inputs, with diagnostics and valid
peer inputs retained. Exit `64` means invalid invocation or refused/unwritable
output. Unsupported or unversioned suite manifests are diagnosed; their result
arrays can still be interpreted separately without inventing suite provenance.
Other comparison
formats remain preserved in their original files and are explicitly unsupported
by this reader. See [historical validation](history-validation.md) and
[report-command validation](legacy-report-command-validation.md).

Compare two legacy result arrays through the existing command or its standalone
entrypoint:

```sh
bun evals/runner/compare.ts /absolute/path/to/baseline.json /absolute/path/to/candidate.json
bun evals/sevro-extension/legacy-compare.ts /absolute/path/to/baseline.json /absolute/path/to/candidate.json
```

Both commands show recorded metric deltas, condition labels, and absolute input
paths. Their local dependencies are `legacy-compare.ts`,
`legacy-comparison.ts`, and `legacy-evidence.ts`. They need no generic runner, Sevro installation, Git
metadata, credentials, or model calls and leave input bytes unchanged.

An archival delta requires explicit matching invariant, evaluation digest,
threshold, host and version, candidate model and effort, and recorded trial
count. Different policy assistance, token accounting, grader routes, effective
owner routes, or named check instrumentation are incomparable. Missing grading
metadata stays unknown; matching recorded facts do not establish evaluator
equivalence. Dry, unknown, contradictory, malformed, duplicate, or empty inputs
exit `1`. Missing cases and asymmetric optional metrics also exit `1`.

Exit `0` means the recorded summaries were compared. It does not establish a
complete planned run, current evaluator equivalence, or live behavioral
stability. Comparison of suite manifests and checkpoints remains unsupported;
interpret those with the historical reader. See
[comparison validation](legacy-compare-validation.md).

Interpret a named skill ablation in a historical suite through its existing
command or the standalone entrypoint:

```sh
bun evals/runner/ablation.ts /absolute/path/to/suite-run.json
bun evals/sevro-extension/legacy-ablation.ts /absolute/path/to/suite-run.json --output /absolute/path/to/ablation.md
```

Both write adjacent `ablation.md` by default. `--output` selects another Markdown
destination. Their local dependencies are `legacy-ablation.ts`,
`legacy-comparison.ts`, `legacy-evidence.ts`, and `legacy-output.ts`. They need no
generic runner, Sevro installation, Git metadata, credentials, or model calls.
Relative result paths resolve beside the manifest. Input archives and their
symbolic or hard link aliases are refused as output; report replacement is atomic.

The input must be a `darrow-orchestration-suite-v1` manifest with named ablations,
a bound `modeDefinitions` snapshot, a positive planned trial count, and a valid pass threshold.
Only the mounted skill surface may differ between modes. The report checks case
identity, recorded conditions and grading instrumentation, host routes, mounted
skills, and the manifest's threshold. Executed cells need all planned, uniquely
numbered trials and a finished exit of `0` or `1`. Missing identity or completion
facts remain unknown and cannot establish eligibility. Invalid cases and named
comparisons retain diagnostics while other eligible comparisons remain visible.
Duplicates never produce a delta. Pass rate, time, token, and cost values remain
recorded archival summaries; absent token or cost values stay unknown. These
deltas do not establish current evaluator equivalence or live stability.

A consistent dry suite exits `0` as unmeasured preparation. An eligible executed
comparison also exits `0`, including regressions. Invalid or unreadable inputs
exit `1` with diagnostics and input paths and digests. Invalid invocation or
refused/unwritable output exits `64`. Unversioned manifests cannot establish
suite provenance; the historical reader can interpret their arrays separately.
The legacy suite producer keeps its `modes` name list and adds the definition
snapshot. Older manifests without it report unknown mode definitions and are
ineligible for ablation deltas. The interpreter does not read a mutable suite
file to invent the missing settings. Their input digests and diagnostics remain
available, and the historical reader still interprets their archived results.
The private runner formatter tests are replaced by tests of the public commands.
See [ablation validation](legacy-ablation-validation.md).

### Historical reviewer-routing artifacts

The standalone Darrow validators preserve the reviewer-routing studies' original
transcripts, TSV records, and proof formats. They require Bun and their local
policy file, with no generic runner, Sevro installation, or model call:

```sh
bun evals/sevro-extension/legacy-native-review-proof.ts \
  --session /absolute/path/to/session.jsonl \
  --scope /absolute/path/to/scope.tsv \
  --route-record /absolute/path/to/route.tsv \
  --standards-record /absolute/path/to/standards.tsv \
  --standards-call call-standards \
  --spec-record /absolute/path/to/spec.tsv \
  --spec-call call-spec \
  --output /absolute/path/to/codex-proof.json
bun evals/sevro-extension/legacy-claude-review-proof.ts \
  --parent /absolute/path/to/parent.jsonl \
  --artifact-dir /absolute/path/to/artifacts \
  --output /absolute/path/to/claude-proof.json
```

Input and output paths must be absolute. Successful validation atomically writes
the original `darrow-code-review-native-live-v1` or
`darrow-code-review-claude-live-v1` JSON format, prints the output path, and exits
`0`. Invalid invocation or evidence exits `1` with a diagnostic, without writing
a new proof. These tools interpret retained historical evidence; their format
names do not make synthetic fixtures live evidence or establish current Sevro
evaluator equivalence. The Claude validator continues to reject the recorded
undashed-marker study. See the [original study](../../docs/research/code-review-reviewer-routing-trials.md)
and [migration validation](historical-review-proof-validation.md).

## Direct evaluation caller

The existing direct command uses Darrow's exact installed Sevro dependency.
See [default package validation](default-package-validation.md) for all three
caller switches and their public-command regressions.

Example:

```sh
bun eval \
  --harness codex --owner-evaluation passive \
  --skill create-commit --case commit \
  --trials 1 --jobs 1 --threshold 1 \
  --results-root /absolute/path/to/results -- \
  --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json
```

`SEVRO_CHECKOUT` and `SEVRO_PACKAGE_BIN` select explicit development or candidate
overrides. Invalid explicit routes fail without fallback. Skill and plugin ownership filters
intersect; repeatable case substrings match any supplied value. With no filters,
all discovered cases are selected. Cases stay sorted and run sequentially;
`--jobs` bounds trials within each case and defaults to three.

The caller retains candidate model/effort options and per-case `--case-routes`
JSON overrides. It keeps the independent semantic and optional advisory routes.
Unlike the benchmark caller, direct evaluation requests no advisory judge until
`--judge-harness` is supplied. Codex defaults are shared with the legacy policy:
candidate `gpt-5.6-terra/medium`, semantic `gpt-5.6-luna/low`, advisory
`gpt-5.6-sol/low`. Claude candidate defaults remain `claude-sonnet-5/medium`;
requested Claude grader routes fail explicitly. Dry execution never grades an
observed response or establishes success, even when grader routes are retained.

`--owner-evaluation` maps to Sevro's condition and keeps the historical enforced
default. Bundled hosts currently refuse enforced execution; choose passive
explicitly for a native trial. The text-file `--condition` and optional
`--condition-label` remain separate benchmark prompt inputs. Skill overrides,
unmounted controls, plugin skill mounting, evaluation-record checks, and
effective-owner route assertions keep their existing option names.

Relative project, configuration, result, active storage, condition, skill, and
output paths resolve from the invocation directory. Result storage defaults to
the evaluated project's `evals/results`. Native host options follow `--`;
caller-owned roots, candidate/grader routes, conditions, and limits cannot be
overridden there. The same native host defaults as the benchmark caller apply,
including shell isolation and Claude project settings.

Stdout becomes the existing `darrow-sevro-selection-v1` manifest. Each selected
case retains its original public CLI JSON, evidence path, and exit category.
Optional `--output` writes the identical manifest atomically after the selection
finishes, including a cancelled prefix. Its containing directory is created and
protected from isolated candidate tools and shell checks; choose a separate
evidence directory. The whole requested results root receives the same
protection, including prior attempts and sibling cases without `--output`.
This deliberately replaces legacy result arrays and terminal
tables. Terminal presentation flags are accepted for the plain JSON output.
Selection exits `1` for any failed case, `64` for invalid invocation, and
preserves SIGINT `130` and SIGTERM `143`. Ordinary failures do not skip later
cases; cancellation stops before the next case.

The direct caller retains activation as a separate Darrow gate. Failed or
unavailable live activation also returns `1` at the requested threshold while
the raw public task verdict and exit code stay unchanged. Each run records
`activation` and `activationError` separately. Dry activation is `not_run`;
unmounted controls are `not_requested`. An activation-assessment error is
retained and fails the aggregate.

`--corpus-manifest` selects a manifest relative to the invocation directory on
the direct command. The migration entrypoint requires an absolute path before
`--`. The source cache resolves beside that manifest. Explicit unreadable or
invalid manifests fail before execution; source revision, license, and clean
checkout checks remain required. Each corpus run retains
`darrow-corpus-source-<sha256>.json` with the selected manifest path and SHA-256 plus
source provenance. The manifest, its containing directory, the source cache,
and related repository worktrees are protected from isolated checks and bundled
native tools. Repeated attempts keep the same corpus identity; changed manifest
bytes change it. Reusing a results root preserves the earlier provenance files.
See [corpus validation](corpus-caller-validation.md).

The direct command accepts `--human-review-minutes <number>` before `--`.
It records manually supplied minutes per trial in the selection manifest's
`humanReviewMinutes`, with `humanReviewMinutesSource: "user_supplied"`.
Omitting it records both fields as `null`; zero is an explicit value. Empty,
negative, or non-finite values fail before selection storage or execution.
The annotation applies to all selected cases and stays in the initial,
per-attempt, latest, optional output, failed, and interrupted manifests.
It does not assert that a review happened or enter Sevro's task grading,
evaluator identity, automated measurements, or generic reports. Dry execution
remains unassessed. The Darrow direct caller owns this option and refuses it
after `--`. See [manual-review validation](manual-review-validation.md).

Private goal assertions remain an explicit migration gap and are rejected. See
[direct caller validation](direct-caller-validation.md).

## Direct case selection

Use `--skill <exact-owning-directory>` or `--plugin <exact-plugin-directory>`
before `--` instead of `--case-id`. The two ownership filters intersect.
Repeat `--case <substring>` to keep IDs matching any supplied substring.
Owning-skill selection includes repository skills and excludes experiments;
plugin selection excludes both repository skills and experiments. Filtering
happens before `--skill-dir` overrides and `--without-skill` controls.

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/run.ts \
  --plugin darrow-git --skill create-commit --case commit \
  --results-root /absolute/path/to/results -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model <model> --effort medium --condition passive \
  --trials 1 --threshold 1 --shell-isolation
```

The entrypoint resolves all selected IDs before execution, rejects duplicates
and empty selections, and runs the sorted cases sequentially. Exact `--case-id`
still emits Sevro's public result. Filtered selection emits and retains
`selection-run.json` with format `darrow-sevro-selection-v1`. Each `runs` row
holds its case ID, raw process exit code, parsed Sevro result, raw result path,
diagnostics, and any result error. The manifest names its `attemptId` and absolute
`manifestPath` under `attempts/<attempt-id>/selection-run.json`. CLI files live
under that attempt's `cases/<case-id-sha256>/` directory;
their Sevro evidence paths preserve task, execution, grading, and domain outcomes.
Use those per-case CLI files as generic Sevro report inputs; the selection
manifest is a Darrow format.
Repeating a selection under the same results root preserves earlier attempts.
The root `selection-run.json` is an atomically updated current-result alias;
updates to each retained attempt manifest are also atomic.

Missing, unsupported, contradictory, or foreign public results remain unavailable
and cannot produce aggregate success. Ordinary case failures remain recorded
while later cases run; the aggregate exits `1`. SIGINT or SIGTERM cancels the
active command, retains its result, stops selection, and exits `130` or `143`
respectively. A fully successful selection, including dry unassessed runs,
exits `0`. Invalid selection exits `64` before any cases start.
Forward `--jobs <positive integer>` after `--` to bound simultaneous trials
within each case. Sevro defaults to three jobs; use `--jobs 1` for serial trials.
It retains the effective limit in configuration and evaluation identity, keeps
trial-number order in results and checkpoints, and drains active trials before
finalizing cancellation or persistence errors. Selected cases remain sequential.
Normal callers use the same installed public boundary by default.

Selection validates the complete public result with Ajv and the bundled
[`cli-result-v1.schema.json`](schemas/cli-result-v1.schema.json) contract snapshot.
It comes from Sevro commit `4a6482a`, with SHA-256
`34e8995c9065e198272f3ed300c98cfb95becc2baeb9e4e80ab635b4d143bf01`.
It includes nested case/trial fields and state consistency, without importing
engine internals. Additional Darrow checks bind the selected case, process exit,
and absolute evidence path. Refresh the snapshot from Sevro's public `schemas/`
contract when adopting a compatible release, update this provenance, and rerun
selection and installed-package parity checks. The schema participates in the
retained extension content digest.

## Separate configuration roots

Forward `--config-root /absolute/path/to/configuration` after `--` on the Darrow
run or suite entrypoint. Sevro defaults it to the evaluated project root and
imports only `agents.max_concurrent_threads_per_session` from
`.codex/config.toml` for configured Codex roles. Case discovery, supporting
plugins, schemas, and corpus assets remain under Darrow's `--project-root`.
The imported value enters retained configuration and comparison identity;
unrelated settings are ignored. Invalid or unreadable declared settings fail
before execution. Sevro protects the configuration repository and its linked
worktrees from bundled candidates and isolated shell checks.

## Claude follow-up turns

Cases with `follow_up_prompt` can resume the same native Claude session under
passive conditions. Sevro keeps the workspace, settings, credentials, model,
and effort unchanged across calls and requires both terminal results to name
the requested session. A failed or unbound result cannot produce a successful
assessment; an invalid initial result prevents resumption. The final turn's
response is graded. Separate initial and follow-up event artifacts remain
private alongside the bounded combined stream.

The sourced `sevro.claude.continuation` observation records the bound session
and whether visible worktree contents stayed unchanged before feedback.
Unmeasured fingerprints remain partial and unknown. Unbound native results
leave usage and cost unknown. Existing ownership and feedback assertions keep
their declared host and evidence requirements. Deterministic integration
coverage is in [suite-validation.md](suite-validation.md); one installed-build
live continuation is in [live-validation.md](live-validation.md).

## Benchmark condition files

Pass `--benchmark-condition-file /absolute/path/to/instructions.md` before
`--` on the Darrow run entrypoint. This replaces the legacy runner's text-file
`--condition` option; Sevro's forwarded `--condition` still selects `passive`
or `enforced` execution.

```sh
bun evals/sevro-extension/run.ts \
  --case-id selected-case \
  --results-root /absolute/path/to/results \
  --benchmark-condition-file /absolute/path/to/instructions.md \
  --benchmark-condition-label vanilla \
  -- --host codex --condition passive --trials 1 --threshold 1 --shell-isolation
```

The label defaults to the filename without its extension. The entrypoint accepts
regular UTF-8 files up to 64 KiB and retains their original content digest.
It prefixes only the initial prompt with trimmed instructions.
`{{harness}}`, `{{model}}`, and `{{effort}}` render from the actual candidate
adapter's negotiated route context in both turns. Unmounted controls keep the
same instructions. `{{repo_dir}}` retains its per-trial workspace meaning.
`{{skill_invocation}}` still requires an owning skill and verified native
dispatch; repository commands on Claude must lead the combined initial prompt.
Unknown templates and missing route context fail before candidate execution.
Corpus preflight reads the fixture declaration without rendering either prompt;
route rendering happens later through Sevro's selected adapter context.

The condition file joins the protected extension source inputs. Private and
redacted configuration files remain in the run's results root; the redacted
copy contains the condition label and digest, an optional unmounted control
flag, and any candidate mount settings. Sevro binds that copy into its configuration identity and retains
it in `configuration.redacted.extensionConfiguration`. The run entrypoint also
accepts `--benchmark-condition-sha256 <digest>` to require the file's original
bytes to match an earlier validated input. A mismatch exits `64` before Sevro
or the candidate starts. Suite condition selection is described below.

## Repository-guide caller

The existing guide command uses Darrow's exact installed Sevro dependency:

```sh
bun evals/repository-guide.ts \
  --only guide-negative --harness codex --dry
```

It preserves repeatable `--only`, inventory order, the default Codex-then-Claude
host order, one trial, one job, and threshold one. Live execution stops after
the first command, task, activation, or evidence failure. An unmounted
`--without-skill` control still requires a passed task and makes no activation
success claim. Dry results remain unassessed. Both interrupt signals stop later
cells and preserve the active command's retained evidence and exit category.

The default results path remains `evals/results/guide-v<inventory-version>/<timestamp>/`.
Each `<question>-<host>.json` now contains raw public Sevro JSON; it is not a
legacy result array. The adjacent `<question>-<host>/` directory contains the
run evidence. Schema validation, exact case selection, and agreement with that
evidence are required before continuing.
Invalid or incomplete output stays unchanged. The adjacent directory retains
`guide-result-error.json` with its raw-output path, process exit code, recorded
interruption, validation error, and `result: null`. The caller preserves nonzero
command and interruption exits; invalid output from a zero-exit command exits
one. This diagnostic is Darrow-owned evidence, not a fabricated Sevro result.

Use absolute `--project-root` and `--results-root` before `--` to select another
checkout and storage location. Forward supported Sevro options after it,
including host binaries and credentials, model and effort, semantic model and
effort, configuration and run-state roots, protected roots, and toolchain paths.
Candidate and semantic adapter modules are not accepted: this caller evaluates
native hosts and uses the Codex semantic judge. Host, case, condition, trial,
job, threshold, dry, and storage options are owned by the caller.

Candidate defaults are Codex `gpt-5.6-terra/medium` and Claude
`claude-sonnet-5/medium`. Semantic grading uses Codex `gpt-5.6-terra/medium`.
The caller resolves binaries from `PATH` and Codex authentication from
`<CODEX_HOME>/auth.json`, defaulting to `~/.codex/auth.json`. Claude uses its
native login unless an explicit credential file is forwarded, and repository
project skill settings are enabled. For example:

```sh
SEVRO_PACKAGE_BIN=/absolute/path/to/sevro bun evals/repository-guide.ts \
  --only guide-orientation --harness claude \
  --project-root /absolute/path/to/darrow \
  --results-root /absolute/path/to/results \
  -- --claude-bin /absolute/path/to/claude \
  --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json
```

Explicit `SEVRO_CHECKOUT` and `SEVRO_PACKAGE_BIN` overrides remain available.
See [guide validation](guide-validation.md)
for the test-first evidence and synthetic-host limits.

## Benchmark suite caller

The three canonical routing benchmarks provide explicit `-passive` modes for
observational comparisons. Their original enforced modes remain available and
unsupported by bundled hosts. Select passive mode names explicitly; see the
[commands and regression evidence](passive-benchmark-validation.md). The variants
preserve task and route checks and add no active benchmark correction.

The existing suite command uses Darrow's exact installed Sevro dependency.
For example, from the Darrow checkout:

```sh
bun run eval:orchestration \
  --suite evals/experiments/orchestration/adaptation-fidelity-suite.yaml \
  --mode preflight-terra --case orchestration-routing-localized-mechanical \
  --trials 1 --threshold 1 --seed diagnosis-1 --no-judge --dry \
  --output /absolute/path/to/evidence -- \
  --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json
```

`bun evals/runner/suite.ts` exposes the same caller. Remove `--dry` only for a
focused native trial whose preceding result is understood. Relative suite and
output paths resolve from the invocation directory. Optional `--project-root`
is absolute and defaults to this checkout. Default output remains
`<project-root>/evals/results/<experiment>/<timestamp>`. Ablations require an
external `--output` so their result files do not change project identity.

Existing `--harness`, `--mode`, `--case`, `--trials`, `--threshold`, `--seed`,
`--codex-model`, `--claude-model`, `--effort`, and grader options remain before
`--`. Candidate defaults are Codex `gpt-5.6-terra/medium` and Claude
`claude-sonnet-5/medium`; suite and case overrides retain their precedence.
Semantic grading defaults to Codex `gpt-5.6-luna/low`, while advisory grading
defaults to Codex `gpt-5.6-sol/low`. `--no-judge` disables only advisory grading;
dry execution requests no advisory judge. Claude grader routes remain explicitly
unsupported. Candidate mode overrides leave both graders unchanged.

Forward native binaries, credential files, Claude settings/cache, configuration
and run-state roots, protected roots, toolchain paths, and trial jobs after `--`.
Routing, condition, grading, and result-storage options are caller-owned. The
caller retains `caller-host-options.json`, then invokes the public suite route.
Stdout is its JSON summary; stderr prints `Suite evidence: <absolute-directory>`.
Separate quality, activation, and ablation reports retain their existing gates.
Cancellation forwards to the active suite and retains its cancelled prefix.

Neither caller changes enforced modes to passive or substitutes unavailable
private goal policies. The adaptation study's enforced cell and bundled-host
enforced execution still fail explicitly. The three revised canonical suites
now use explicit native owner-route maps; custom suites retaining private fields
remain unsupported. Dry preparation preserves enforced labels and stays
unassessed. See
[benchmark migration validation](benchmark-migration-validation.md).

Without a runner override, the caller uses the frozen installed dependency.
An invalid explicit route cannot fall back. See
[caller validation](benchmark-caller-validation.md).

## Candidate skill overrides

Pass `--skill-dir /absolute/project/path/to/skill` before `--` on the run
entrypoint to override the mounted candidate skill. `--mount-plugin-skills`
adds its plugin's sibling skills; without an override, it adds the colocated
owner's siblings. Existing case sibling declarations stay enabled.

Overrides must name a readable `plugins/<kind>/<plugin>/skills/<skill>` or
`.agents/skills/<skill>` directory inside the evaluated project. Missing bodies,
symbolic-link aliases, and paths outside that project fail before execution.
External skill snapshots need migration into one of those project locations.
Repository skills keep their existing Claude mirror and project-setting
requirements and cannot request plugin sibling mounts.

The override changes mounting, while case discovery, source, hidden checks,
schemas, and owning activation target remain tied to the original case.
Skill-free experiments stay without an activation grade. A colocated case still
requires its original activation target in the mounted set. The candidate's
native invocation uses its selected mount. Unmounted controls retain settings
but mount no skills. Redacted configuration records the project-relative
`skillDir` and optional `mountPluginSkills: true`; fixture artifact digests bind
the mounted bytes. Preparation rejects settings that contradict resolution.

## Benchmark evaluation records

Pass `--require-evaluation-records` before `--` on the run entrypoint, or
declare mode `require_evaluation_records: true` in a suite. Darrow adds two
checks to the existing task checks:

| Legacy check name                 | Sevro check ID                               |
| --------------------------------- | -------------------------------------------- |
| reported child invocation count   | `darrow.evals.benchmark.child-invocations`   |
| reported human intervention count | `darrow.evals.benchmark.human-interruptions` |

The complete final response must contain exactly one record for each count,
using a tab or `: ` followed by digits. Missing, malformed, or duplicate
records fail; incomplete, duplicate, or foreign response evidence remains
unavailable. These checks validate self-reported counts without asserting that
native observations confirm them. They add to task grading and preserve the
separate activation, semantic, and advisory outcomes. Dry runs remain unassessed.

The request is retained as `requireEvaluationRecords: true` in redacted
configuration. A suite validates its declaration before any cells start and
verifies it against retained configuration. Omitted or false suite declarations
leave the record policy inactive. Preserve the legacy applicability exception
for a selected adaptive-delivery mount: no standalone record checks are declared
for it. This exception does not establish ownership; the selected case's policy
or an explicit benchmark route check must supply that assertion.

## Benchmark owner routes

Pass `--assert-effective-owner-routes '{"case-id":{"model":"gpt-5.6-luna","effort":"high"}}'`
before `--` on the run entrypoint, or declare mode `effective_owner_routes` as
the same case-ID map in a suite. Only the selected case's expectation is applied;
focused runs keep their case selection when a map also names other cases.
The map is bounded to 64 KiB. Model identifiers use at most 128 letters,
digits, dots, underscores, or hyphens and begin with a letter or digit. Effort
must be `low`, `medium`, `high`, `xhigh`, `max`, or `ultra`.

The added `darrow.evals.benchmark.effective-owner-route` check preserves the
legacy name “native owner effective route matches expectation.” It requires
one complete Codex native observation correlating one accepted child's launch,
host start, and acceptance. That child must use `forkTurns: none` and the exact
expected model and effort. The check records the applied child route; its
private contract selection stays unverified. The parent candidate keeps its
own route, and the expectation changes no launch input or instrumentation.

An observed route mismatch or a complete observation without one unique
accepted child fails. Missing, partial, duplicate, foreign, malformed, or
route-incomplete receipts remain unavailable. Existing task checks continue
running. Unavailable evidence produces Sevro exit `4`, grading `unavailable`,
and task `not_assessed`; the suite retains that raw result and exits `1`.
Dry preparation stays unassessed. Redacted configuration retains the selected
`effectiveOwnerRoute`, and the suite verifies it against its request.

This legacy assertion is Codex-specific. A suite requesting it for a selected
Claude cell exits `64` before any cells start. Standalone preparation rejects
hosts missing Codex native-call evidence. Invalid maps also exit `64` before
candidate execution. Claude's existing selected-owner cases keep their separate
Claude policy; this option supplies no replacement for that policy.

To inventory case compatibility before switching a workflow, run:

```sh
bun run eval:sevro:compatibility -- --allow-unsupported
```

The command reports every case that cannot resolve through the current Darrow
extension. Omit `--allow-unsupported` to fail when any case remains unsupported;
use `--json` for the versioned machine-readable report. Missing or unreadable
case inputs fail the scan. This inventory tests resolution, not host execution
or grade parity.

The Claude non-ready readiness case uses ordered native `Skill` and `Agent`
calls to check that readiness ran once and no owner started. Its retired-ledger
check reads a digest-verified Claude event artifact. Missing or partial host
evidence leaves these checks unavailable.
The selected Claude owner case checks a single foreground Agent with the exact
owner marker, a nested independent-review Skill call from the outer stream or
completed native Agent graph, and a completed route
resolver result before launch. A digest-verified Claude event artifact also
checks that the parent makes no tool calls after the owner returns and that no
retired ledger appears. Missing or partial evidence remains unavailable.

Adaptive-delivery cases that declare `goal_route_checks: false` and the
forbidden goal-report policy now retain their ownership checks through the
Sevro extension. For Codex cases, a complete native-call observation is required. The
extension checks that no replacement owner launched, that later parent calls
only waited or addressed the accepted child, and that the final answer omitted
internal goal records. Missing or partial host evidence leaves those checks
unavailable. The [completion-policy reconciliation](completion-policy-validation.md)
preserves the legacy internal TSV and Markdown-wrapper examples through public
grading and identifies the retired fixed completion-report grammar.
Full goal-route reports and most transcript checks remain
unsupported. The exact no-agent assertion uses the complete Codex native-call
observation. A spawn attempt fails; missing or incomplete evidence stays
unavailable. Supported retired-ledger assertions check both the complete
native goal-control observation and the retained Codex event artifact. Each
case retains its declared text terms. The extension verifies the artifact digest
and does not copy its text into the
result. Selected nonactivation assertions also use complete Codex skill-read and
native-call observations. A forbidden mounted skill read, a `Skill` tool call,
or a prohibited owner spawn fails the corresponding check; missing or partial
evidence leaves it unavailable.
The Adaptive Delivery doctor cases also check that orchestration stayed
inactive. Their exact forbidden skill reads, preflight or doctor event markers,
and native `spawn_agent` or `Agent` calls are graded from complete skill-read
and native-call receipts plus a digest-verified Codex event artifact. Missing
required evidence makes the check unavailable.
The supported Codex route assertions compare the sole accepted owner's
bounded model and reasoning-effort receipt with the case's declared route.
Missing route fields leave that assertion unavailable; a different retained
route fails it. The bounded native-goal case also checks for a second accepted
owner or replacement attempt through complete native calls.
Verification cases use Sevro's accepted provider child and nested reader
receipts. Darrow interprets bounded task names for the `standards` and `spec`
axes, requires a fresh context and a completed returned reader turn, and leaves
truncated or missing sessions unavailable. The replacement case retains its
declared provider-name check against the digest-verified Codex event artifact.
Advice-only blocked retries and missing or ambiguous ticket cases use the same
verified events to reject forbidden delegation. The blocked retries also
require complete native-call evidence; ticket cases require complete skill-read
evidence.
The ordinary engineering case requires a complete skill-read receipt and
digest-verified events to reject adaptive-delivery selection, preflight, and
the declared owner markers without restricting unrelated delegation.
Ticket composition cases bind the publisher skill read to the sole accepted
child session and grade later parent work from ordered native calls. Ticket
delegation cases require a completed adaptive-delivery skill read and reject
the exact prohibited pre-run capability patterns using complete reads and
digest-verified events. Missing child, read, event, or call evidence remains
unavailable.
Unmapped transcript patterns are rejected during case resolution.
Same-owner follow-up checks compare a correlated native owner receipt with the
saved follow-up ordinal and a bounded feedback call. Cases that require a tool
response also check its unique response receipt. This proves an attempted
same-owner handoff; it does not prove the child acted on the message.
The cross-turn feedback case also requires an unchanged workspace before
feedback, an owner accepted before that boundary, and no replacement spawn,
goal creation, or preflight marker in the verified follow-up turn. The second
turn's Codex event artifact must pass its retained digest check.
Ordered readiness checks use Sevro's separate first-turn and follow-up-turn
skill-read receipts. A missing or partial turn receipt leaves the corresponding
check unavailable. The ticket recipe's follow-up check also compares native
`Skill` call ordinals with the saved follow-up boundary.
The readiness artifact case compares a verified parent skill-body completion
ordinal with the accepted owner's launch request. Missing or incomplete parent
read diagnostics leave the pre-owner assertion unavailable.
The non-ready Codex case uses those complete parent receipts to require one
readiness body completion, reject a repeated completion, and confirm that no
native owner launch or retired ledger marker occurred. Incomplete receipts
remain unavailable.
Ticket feedback checks also reject a second native owner and any observable
plaintext feedback that differs from the rendered follow-up prompt. Encrypted
or unreadable message content yields no equality claim; only the bounded
representation and comparison result enter retained evidence.

For local protocol and public CLI validation, run:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun test evals/runner/parity/sevro-extension.test.ts
```

Darrow fixture-oracle and repository-tooling tests live under `evals/domain/`.
The migrated fixture tests use the public CLI and protocol with an installed
package or explicit checkout route. The package-install gate runs this directory
alongside parity tests. For an installed command:

```sh
SEVRO_PACKAGE_BIN=/absolute/path/to/consumer/node_modules/.bin/sevro bun test evals/domain
```

The extension creates `.git/fixture-state` before case setup or tools run.
See [fixture-state validation](fixture-state-validation.md) for the public
regression and migrated failed-check oracle examples.

To run one supported case through the Darrow entrypoint, use the frozen installed
dependency. `SEVRO_PACKAGE_BIN` and `SEVRO_CHECKOUT` remain explicit overrides.
For example:

```sh
bun evals/sevro-extension/run.ts \
  --case-id orchestration-routing-localized-mechanical \
  --results-root /absolute/path/to/results -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model gpt-5.6-terra --effort medium \
  --condition passive --trials 1 --threshold 1 --shell-isolation
```

The entrypoint fixes the Darrow extension, project, case, results, and source
identity. `--without-skill` before `--` omits mounted skills for a baseline
run; explicit skill-invocation cases are rejected for this mode. Options after
`--` go to Sevro. The results directory holds the
extension command file at a stable path. The command emits Sevro's JSON result
and exit category. Unsupported case features still fail during resolution.

## Suites

For suites with passive or enforced modes, run the Darrow suite entrypoint with
an absolute suite path:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/suite.ts \
  --suite /absolute/path/to/suite.yaml \
  --results-root /absolute/path/to/results --trials 1 --threshold 1 \
  --seed comparison-1 -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model gpt-5.6-terra --effort medium --shell-isolation
```

Pass `--seed <value>` before `--` to replay the legacy host/mode block shuffle.
The base block list follows selected harness order, then selected mode order;
cases within each shuffled block keep sorted exact-ID order. An empty seed is
valid. Without `--seed`, the command generates and retains a timestamp seed.
The same seed and ordered selections reproduce the plan.

Before the first case command starts, `suite-run.json` records `orderSeed` and
the complete `cellPlan`, with one-based `index`, `harness`, `mode`, and `caseId`.
Completed or cancelled `cells` form its executed prefix with the same indices.
Selection lists describe the selected set, while the plan describes execution
order. The seed changes no evaluation or comparison-eligibility dimension.
See [ordering validation](ordering-validation.md) for replay and interruption
evidence. Each case still uses its own public Sevro command.

This suite route accepts a nonempty, unique `harnesses` list containing `codex`,
`claude`, or both; an omitted list defaults to `[claude, codex]`. Repeat
`--harness <host>` or `--mode <name>` before `--` to select supported hosts or
named modes. Repeatable `--case <substring>` filters replace the suite filters
for a focused run. Selection errors fail before any cells start. It accepts
`owner_evaluation`, `without_skill`, `model_by_harness`, `effort`, `condition`,
`condition_by_harness`, `skill_dir`, `mount_plugin_skills`,
`require_evaluation_records`, `effective_owner_routes`, and `apply_case_routes`
in each mode. Candidate model and effort overrides require Sevro's bundled hosts;
they replace the corresponding options in the host route and preserve the
semantic and advisory routes. The manifest records requested routes and
validates the actual model and effort against retained Sevro evidence.
Named ablations pair a
no-skill baseline with a mounted candidate under the same condition and compare
each harness separately. Ablation
results must be outside the evaluated project so result files cannot change its
digest between cells. It resolves `case_filter` substrings to exact
case IDs before starting, rejects duplicate IDs and unsupported suite fields,
then invokes the public Sevro CLI once per case and mode. `suite-run.json`
records the suite content digest, selected cells, Sevro result paths, evidence
paths, exit codes, and the runner, project, extension, model, and effort
provenance verified from each retained Sevro result. Failed cells remain in the manifest while later cells
run. SIGINT or SIGTERM cancels the active run, retains its cell, and stops the
suite. Each cell also records an independent `activation` gate with its
declared class, target skill, pass rate, threshold, and trial counts. Task
success does not imply activation success. Missing or incomplete activation
stays `unavailable` with a null pass rate; dry preparation is `not_run`, and
unmounted controls are `not_requested`. The command exits 1 if any cell,
live activation gate, or public report fails. Sevro's task verdict and cell
exit code remain unchanged by the activation gate. The suite
also invokes `sevro report` and writes its versioned `report.json` and Markdown
`report.md` beside the manifest. The manifest records their absolute paths and
any cells without a JSON result. The generic report preserves task, execution,
grading, routes, and unknown measurements. The separate
`quality-report.json` and `quality-report.md` use Darrow's
`darrow-sevro-quality-v1` format to distinguish task quality, bookkeeping, and
the public task pass rate. Quality excludes only the two benchmark record
checks from Darrow's benchmark grader. A correct answer with a missing record
can have quality 100%, bookkeeping 0%, and a failed public task; the suite still
fails. Other task checks remain required. Advisory scores and activation do
not enter this check rate.

The manifest's `qualityReport` names both absolute paths and any input error.
Per-cell `recordChecksRequested` retains the resolved policy, including the
adaptive-delivery exception. Each report row retains public execution, grading,
task, and exit states, input paths, provenance, and per-trial assessments.
`quality` and `records` retain trial counts, measured counts, and rates; absent
record policy is `not_requested`. Dry trials are `not_run`. Execution/grading
failures, unavailable checks, missing trials, and unknown execution leave rates
null. A selected custom task policy remains explicit and makes the default
quality metric unavailable. `protocolPassRate` uses public task verdicts,
including any selected task policy. Groups keep mode, harness, requested and
actual condition, and candidate route separate. An unavailable trial leaves its
group rate unknown. Invalid or inconsistent inputs retain a diagnostic and
fail the report and suite. The report validates both public schema snapshots,
including [`run-evidence-v1.schema.json`](schemas/run-evidence-v1.schema.json),
and rejects duplicate check IDs before measuring outcomes. Refresh the evidence
snapshot alongside the CLI schema when upgrading Sevro and rerun installed-package
parity. See [quality report validation](quality-validation.md)
for the public-command evidence and limits.

The separate
`activation-report.json` and `activation-report.md` report the separate
activation gates, all three classes, recall, and precision grouped by mode
and harness. Incomplete observations and empty metric denominators remain
unknown; unmounted controls supply no measurements. Named ablations write
`ablation-report.json` and `ablation-report.md` with per-case pass rate, time,
token, and cost deltas; missing measurements stay unknown. Missing cells or
mismatched identity dimensions invalidate the comparison. Other legacy
goal-route and dimension overrides still require migration.

Suite `case_routes` maps `codex` or `claude` to exact case IDs and complete
`{model, effort}` routes. Enable it in a mode with `apply_case_routes: true`.
The selected case route overrides that mode's parent candidate model and effort;
unmapped cases retain the mode or CLI defaults. An omitted or false flag keeps
the map inactive. Grader routes and effective owner-route assertions are
independent. Malformed maps and an enabled mode without a selected harness map
fail before any cells start. The manifest retains `caseRoutes`, each cell's
`requestedRoute`, and verified actual route evidence. Dry results remain
unassessed. For example:

```yaml
case_routes:
  codex:
    orchestration-routing-localized-mechanical:
      { model: gpt-5.6-luna, effort: medium }
modes:
  direct:
    owner_evaluation: passive
    apply_case_routes: true
```

Mode `skill_dir` selects a candidate override relative to the suite file.
`mount_plugin_skills: true` includes its sibling set. Selected override inputs
are validated before any cells start, and the manifest retains their normalized
project-relative paths. Each cell verifies those settings against Sevro's
retained redacted configuration; contradictions fail with `70` while leaving
the raw task result unchanged. A matched ablation declares the same override
and sibling selection in both modes, with `without_skill: true` only on its
baseline, so the selected case and prompt stay identical.

Mode `condition` names a shared benchmark instruction file. A
`condition_by_harness` entry overrides it for the named host; missing entries
use the shared file, or no prefix if none is declared. All paths resolve
relative to the suite file. For example:

```yaml
modes:
  vanilla:
    owner_evaluation: passive
    without_skill: true
    condition: conditions/vanilla.md
  candidate:
    owner_evaluation: passive
    condition: conditions/common.md
    condition_by_harness:
      codex: conditions/codex.md
```

The suite loads selected condition files before starting cells and validates
the combined templates for every selected mode, host, and case. Route variables
stay deferred until Sevro supplies the candidate adapter's context. Explicit
invocation introduced by a condition cannot run as an unmounted control.
Selected input errors exit `64` before cells start; unselected file routes are
not opened.

`suite-run.json` records `benchmarkConditions` by mode and host. Each cell's
`benchmarkCondition` contains its absolute path, mode label, and original
SHA-256 digest, or `null` when no file is selected. Suite labels use the mode
name; unmounted controls carry `withoutSkill: true` in redacted configuration
instead of a label suffix. The cell checks the file against the preflight digest
before launch. Sevro then protects the source file throughout execution.
The suite also verifies its requested label, digest, and control flag against
Sevro's retained redacted configuration. Missing or contradictory configuration
makes the cell fail with `70` while retaining Sevro's raw verdict and exit code.
Condition changes remain ineligible for matched ablation deltas.

For multiple harnesses, pass `--host-options-file /absolute/path/to/hosts.json`
before `--`. That file maps each selected harness to its Sevro candidate options.
It may also retain routes for supported harnesses omitted by `--harness`; all
entries are validated and the entire file digest is retained:

```json
{
  "codex": [
    "--host",
    "codex",
    "--model",
    "gpt-5.6-terra",
    "--effort",
    "medium"
  ],
  "claude": ["--host", "claude", "--model", "sonnet", "--effort", "medium"]
}
```

Add binary, credential-file, and project-setting options to the relevant list.
Repository skill cases need `--claude-project-settings` in the Claude list.
Shared options after `--` can select shell isolation or a semantic grader, but
cannot override candidate routes or duplicate a route option. The manifest
retains the file's digest and each cell's declared harness; foreign or missing
candidate route evidence makes the cell unsuccessful. A single-harness suite
can continue forwarding its candidate options after `--`.

The parity test also prepares the mounted skill through Sevro's bundled Codex
route with `--dry`, validating its protocol identity and retained artifacts
without starting a model turn. On macOS with Codex installed, it also drives a
controlled JSONL turn through the bundled host to verify complete and partial
native activation receipts end to end without a model call.
The first focused live run is recorded in [live-validation.md](live-validation.md).
Suite activation regressions and the focused native Claude suite are recorded
in [suite-validation.md](suite-validation.md).

The entrypoint supplies `index.ts`, `run.ts`, `benchmark-condition.ts`,
`benchmark-policy.ts`, `benchmark-owner.ts`, `skill-mount.ts`,
`sevro-command.ts`, the local
ticket command, the corpus
source validator, the repository `package.json`, and `bun.lock` as extension source files so the executable,
invocation, and YAML parser version are included in Sevro's source digest. Case
content enters the selected case, fixture, and check digests.

This development path uses an explicit Sevro checkout or local package tarball
until a release is pinned. It does not replace the existing eval command yet.
