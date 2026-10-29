# Darrow extension for Sevro

Darrow translates its cases and grades repository policy through
`sevro.extension.v1`. Sevro supplies execution, isolation, host observations,
built-in graders and retained results. This is repository development tooling;
marketplace plugins have no Sevro, Bun or TypeScript runtime dependency.

Normal callers use the exact `@bjoernrochel/sevro@1.1.1` pin in [package.json](../../package.json).
Install it with `bun install --frozen-lockfile`. The installed command is `sevro`.
It requires Node.js 24.13.0 or newer on `PATH`; Darrow tooling uses Bun 1.3.13.
See [development and release](migration.md), [test ownership](../README.md),
the [evidence specification](../../docs/specs/skill-evaluation.md), and
[historical extraction evidence](../../docs/research/sevro-extraction.md).

## Direct evaluation caller

Run one focused case before attempting a wider live evaluation:

```sh
bun eval --harness codex --owner-evaluation passive \
  --skill create-commit --case create-commit-conventional-format \
  --trials 1 --jobs 1 --threshold 1 \
  --results-root /absolute/path/to/results
```

Use `--dry` for preparation without a model turn. Dry results stay unassessed.
Candidate model/effort, semantic grading and optional advisory grading have
independent routes. Direct evaluation enables advisory grading only when
`--judge-harness` is supplied. Defaults live in [model-defaults.ts](model-defaults.ts);
the guide has its own semantic route.

Darrow options precede `--`; additional native host options follow it. Forwarded
options cannot replace caller-owned identity, roots, routes, conditions or limits.
The caller writes a `darrow-sevro-selection-v1` JSON manifest to stdout.
`--output` atomically writes the same manifest. Task results and activation
remain separate. Ordinary failures retain their evidence and allow later selected
cases; cancellation stops selection. Aggregate failure exits `1`, invalid
invocation `64`, SIGINT `130` and SIGTERM `143`.

`--human-review-minutes` records a user-supplied annotation. Omission stays
unknown; the value does not establish that review occurred or change grading.

## Direct case selection

`--plugin` and `--skill` select exact owning directories and intersect.
Repeatable `--case` substring filters match any supplied value. With no selectors,
all canonical repository-skill, plugin-skill and experiment cases are selected.
Cases are sorted and run sequentially; `--jobs` controls trials within a case.

`--case-routes` supplies per-case candidate model/effort mappings independently
of grader routes. `--corpus-manifest` selects a corpus manifest; prepare its
pinned source with `bun run eval:orchestration:prepare --source <id>`.
Each run retains the manifest digest, source revision, license and checkout
identity. Unsupported or ambiguous cases fail explicitly.

`bun test evals/domain/case-resolution.test.ts` verifies all canonical cases
resolve. That check establishes neither host execution nor task success.

An `output_checks` entry with `reported_head: true` compares the commit named
in the actual final response with Sevro's captured final Git revision. It
accepts full IDs or prefixes of at least seven hexadecimal characters and
requires `expect_head_change` so Git evidence is captured. Missing, partial,
duplicate or malformed observations remain unavailable. Remote publication and
CI state need their own fixture checks; no response-file adapter is created.

## Runtime configuration

Sevro reads the repository's [`sevro.json`](../../sevro.json) for every case in
this project. It inherits `PATH` and `UV_PYTHON_INSTALL_DIR`, grants the
uv-managed Python installations read-only, shares a prepared public UV cache, enables
native goals, and exposes the trial's own native transcripts read-only. Sevro discovers Homebrew and Apple developer support folders from
the inherited `PATH`; the file names no machine-specific folders.

Darrow's callers prepare that environment before launching Sevro:

- They remove the repository's and Bun's injected `node_modules/.bin` and
  temporary folders from `PATH`, because Sevro refuses read grants inside the
  protected repository.
- They set `UV_PYTHON_INSTALL_DIR` from `uv python dir` when it is unset.
- They warm the public UV cache at `~/.darrow/cache/sevro-uv-cache` from the
  registered Python packages' locks, and warm it again only when inputs change.
  Warm-up preserves existing entries and the directory while other runs use it.
- All repository runtime profiles use
  `runtime.sharedCacheDirectories` with `roles: ["candidate", "checks"]`.
  The Tickets profile also selects `hooks` for its Claude SessionStart handler,
  which invokes the frozen Python backend and needs cached build dependencies.
  Candidates and UV shell graders use the same persistent cache without per-role
  cache copies. Other current hooks and semantic/advisory graders need no UV grant.
  `UV_PYTHON_DOWNLOADS=never` requires the declared Python installation;
  Sevro keeps dependency installation offline during trials.
- Shared cache contents are mutable across evaluations and excluded from content
  identity. Use public dependencies only; use isolated seeds for comparisons that
  require independent dependency contents. Manage cache size between evaluations
  with `uv cache prune --cache-dir ~/.darrow/cache/sevro-uv-cache`.
  After manual pruning or clearing, remove `.darrow-seed-digest` from that cache
  so the next caller warms the registered dependencies again.
  Sevro removes disposable checker state after grading, including failed retained
  fixtures, while keeping the shared source and evidence. This does not clean old
  result directories created by earlier releases.
- With this repository's default goal-enabled policy, they select Codex's
  app-server entrypoint unless an entrypoint or replacement runtime file is
  supplied. The compiled command records that selection.

Repository-skill guide trials need `--claude-project-settings`, which conflicts
with native-goal hooks. The guide caller therefore selects
[`runtime-repository-skills.json`](runtime-repository-skills.json): the same
tools and native transcripts without hooks. An explicit `--runtime-config-file` replaces either default.
With a runtime file selected, direct and benchmark callers no longer add
`--claude-project-settings` automatically.

Native transcripts are enabled so Adaptive Goal's placement helper can read
the current session's model and effort, as it does outside Sevro. Hook-free
guide trials retain them for native control observations.

Review artifact cases require the explicit
[`runtime-review-artifacts.json`](runtime-review-artifacts.json) profile. It retains
the candidate's actual `~/.darrow/reviews` directory through grading and grants
only read access to it. Shell checks bind `DARROW_REVIEW_STATE_DIR` to the
candidate-bound `SEVRO_CANDIDATE_ARTIFACT_REVIEWS` path; the grader's own `HOME`
does not locate candidate evidence. The profile also configures the candidate's
Review state and cache paths outside its repository. For example:

```sh
bun eval --harness codex --owner-evaluation passive --codex-entrypoint app-server \
  --skill code-review --case code-review-fix-verification-resolved \
  --trials 1 --jobs 1 --threshold 1 -- \
  --runtime-config-file "$PWD/evals/sevro-extension/runtime-review-artifacts.json"
```

Use this profile for the `code-review` cases, `verification-existing-review`,
`goal-verification-existing-review`, and `goal-preflight-high-risk-routine`.
These cases declare `required_plugin_hook: darrow-review`. The profile allows
that plugin's SessionStart hook, and implicit Codex cases install its complete
native package without adding an invocation token. The task includes a hook
execution check using Sevro's public `sevro.host.hooks` receipt. A packaged or
configured hook without a successful execution cannot pass; incomplete evidence
remains unavailable. Native reminder delivery is checked separately before live
threshold runs. Keep earlier hook-disabled results as their own condition.
Hook-free or without-skill controls need a corresponding hook-free runtime
profile; do not allowlist a plugin absent from that control.
Review fixture setup prepares an empty candidate state directory, so missing
reports fail task checks and negative cases inspect real
accessible state. A missing or unsafe declared directory is a grading error, never evidence
of absence. Artifacts remain temporary and are removed after grading; the grant
does not persist their contents in the run archive. Do not select this profile
for cases that do not create the declared directory.

Feedback cases that assert an unchanged whole-workspace boundary select
[`runtime-feedback-receipts.json`](runtime-feedback-receipts.json) with Codex's
app-server entrypoint. Use it for `goal-cross-turn-feedback-answer`,
`goal-steering-without-question`, and `diagnostic-direct-owner-parser-presented`.
Their fixture tools write authentic bookkeeping to `DARROW_FIXTURE_RECEIPTS_DIR`
outside the repository. Graders read those original files through the read-only
`SEVRO_CANDIDATE_ARTIFACT_RECEIPTS` grant. The source-preservation, exact answer,
receipt ordering, and actual continuation-boundary checks still apply.
`goal-failed-check-blocks-publication` also uses this profile to retain check and
dependent-effect receipts independently of generated workspace-output cleanup.

For startup diagnosis, add `--retain-host-diagnostics`
after the caller's `--` separator. The flag applies to selected native roles
and retains `sevro.host.diagnostics` even when no session starts. Its private
artifact contains bounded stage, error, and subprocess evidence. Keep it out of
Git; enabling retention changes configuration identity and preserves failure
outcomes.

Fixture setup prepares `.fixture-state/` and excludes it from Git. Candidate
fixture tools keep mutable tracker state, receipts, and test traces there.
Immutable fixture inputs and hidden graders remain in Git metadata. Graders
use declared host tools or portable system commands; a tool inside a protected
Codex installation does not become available through inherited `PATH`.

## Separate configuration roots

`--project-root` supplies cases and supporting assets. `--config-root` defaults
to that project and imports only the documented Codex session concurrency limit.
`--results-root` selects retained evidence; `--run-state-root` selects active-run
storage. Storage never defaults to the package installation directory.

The direct caller resolves relative paths from the invocation directory.
The exact-case extension command and guide require absolute project/results roots.
Results default to the evaluated project's `evals/results`. For matched
comparisons, store results outside the evaluated project so they cannot alter
its identity between cells.

## Claude follow-up turns

Darrow translates `follow_up_prompt`; Sevro owns continuation on the original
Claude session. The extension grades declared feedback boundaries from complete,
bound observations. Missing or contradictory evidence remains unavailable.
See Sevro's [extension protocol](https://github.com/BjRo/sevro/blob/v1.1.1/docs/extension-protocol-v1.md)
for the host capability contract.

Repository-skill trials require the `.claude/skills/<name>` mirror and
`--claude-project-settings`. Explicit repository invocations must lead the
combined prompt with the native command. Supporting providers retain independent
plugin packages.

## Benchmark condition files

On the direct caller, `--condition` selects a text instruction file;
`--owner-evaluation passive|enforced` selects execution conditions.
On `run.ts`, use `--benchmark-condition-file` and
`--benchmark-condition-label` before `--`; Sevro's execution `--condition`
follows the separator.

Instruction files are bounded to 64 KiB and retain their content digest.
`{{harness}}`, `{{model}}` and `{{effort}}` use the actual candidate route.
`{{repo_dir}}` refers to the trial workspace. Unknown templates fail before
execution. Conditions do not change the participant's task or repair its answer.

## Repository-guide caller

```sh
bun evals/repository-guide.ts --only guide-orientation --harness claude \
  --results-root /absolute/path/to/results
```

The guide runs inventory questions sequentially with one trial, one job and a
threshold of one. It stops at the first task, activation, execution or grading
failure. `--dry` prepares fixtures; `--without-skill` supplies an unmounted
control. Repeat `--only` to select questions. The default runs both hosts.

The semantic grader is Codex `gpt-6-luna/high`. Optional host options follow
`--`. Public result JSON, raw evidence and activation outcomes are retained
separately. A single passing trial is not a reliability claim.

## Benchmark suite caller

```sh
bun run eval:orchestration \
  --suite evals/experiments/orchestration/localized-routing-policy-suite.yaml \
  --harness codex --mode adaptive-policy-passive \
  --trials 1 --threshold 1 --no-judge \
  --output /absolute/path/to/results
```

Use `--case`, `--harness` and `--mode` to focus a suite. Supported passive
modes must be selected explicitly. Bundled hosts reject enforced execution;
an enforced request never silently becomes passive. Native goal cases on Codex
use `--codex-entrypoint app-server`.

Parent candidate routes, semantic/advisory routes and effective child-route
expectations remain independent. Private profile, workflow, risk and deprecated
ticket-pipeline phase assertions are retired. No special phase instrumentation
or active benchmark correction is supplied.

## Candidate skill overrides

`--skill-dir` replaces the candidate skill without changing case selection.
`--mount-plugin-skills` includes its sibling set. `--without-skill` supplies
an unmounted control; explicit invocation cases cannot use that control.
Suite modes use `skill_dir`, `mount_plugin_skills` and `without_skill`.

Preparation retains contained plugin resources while excluding evals and caches.
Unsafe links, escaping paths, duplicate skill identities and unavailable host
mounting capabilities are rejected.

## Benchmark evaluation records

`--require-evaluation-records` requests the benchmark's child-invocation and
human-interruption records. Suite modes use `require_evaluation_records`.
The supported Adaptive Goal exception follows canonical case metadata.
Missing or malformed required records fail their checks independently of other
task checks; dry preparation cannot supply observed counts.

## Benchmark owner routes

`--assert-effective-owner-routes` accepts a case-ID map of `{model, effort}`.
Suite modes use `effective_owner_routes`. The check compares independently
observed accepted Codex child routes; it does not choose the child's route or
prove private contract selection. A mismatch fails. Missing, incomplete,
ambiguous or malformed evidence remains unavailable. This assertion is
Codex-specific and unsupported Claude cells are rejected before execution.

## Suites

`suite.ts` resolves the selected modes and cases before starting cells. It
retains the suite digest, seed, complete cell plan, executed prefix, routes,
conditions, source identities and public result paths in `suite-run.json`.
Persisted cell result paths are canonical absolute paths, so Sevro's report
inputs and matched-ablation rows retain the same file identity through aliases.
`--seed` replays the selected host/mode block ordering.

Mode options include `owner_evaluation`, `model_by_harness`, `effort`,
`condition`, `condition_by_harness`, `skill_dir`, `mount_plugin_skills`,
`without_skill`, `require_evaluation_records`, `effective_owner_routes`
and `apply_case_routes`. For both hosts, `--host-options-file` supplies a
JSON map of host option arrays. Requested routes are verified against retained
public evidence.

Failed cells remain recorded while later cells run. Interruption retains the
active cell and stops the suite. Each cell's activation gate remains separate
from its raw task result. Unavailable activation is not averaged away.

The suite writes Sevro's generic report plus separate Darrow activation,
quality and matched-ablation reports. Quality distinguishes non-record task
checks, bookkeeping completeness and the public task verdict. Unknown, failed
execution, unavailable grading and dry evidence leave measurements unknown.
A custom task policy remains explicit. Matched ablations require equivalent
prompt, fixture, host, routes, checks and instrumentation.

Callers validate results against public schemas shipped by the pinned Sevro
package. They bind the selected case, process exit and evidence path before
applying Darrow policy. Public protocol, result and identity mechanics are
documented in [Sevro](https://github.com/BjRo/sevro/tree/v1.1.1/docs).

## Result reporting

Use Sevro's public report command for current results:

```sh
bunx --no-install sevro report --json --result-file /absolute/path/to/sevro-result.json
```

The suite caller writes separate Darrow activation, quality, and ablation reports.
Pre-Sevro result readers, comparison commands, reviewer-routing proof validators,
and their tests have been removed. Retained research preserves its original
formats and provenance; it does not establish current evaluator equivalence.

## Host-state and local HTTP profiles

Use [`runtime-codex-state.json`](runtime-codex-state.json) for
`doctor-adaptive-goal-direct-codex` and
`create-agent-skill-refuse-undefined-skill`. The profile exposes the actual isolated
configuration and grants graders read-only access to all four original candidate
user-skill roots. Preserve the seeded UV cache. Fixture config is represented
input, not the effective host config.

Use [`runtime-local-http.json`](runtime-local-http.json) for
`orchestration-oss-express-links` and `orchestration-oss-requests-proxy`. It opts
candidate and shell grading into local HTTP socket access. Other runs keep the
default network policy. Pass either profile after `--` with
`--runtime-config-file "$PWD/evals/sevro-extension/<profile>.json"` and select
Codex's app-server entrypoint before `--`.
