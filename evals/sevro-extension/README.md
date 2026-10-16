# Darrow extension for Sevro

Darrow translates its cases and grades repository policy through
`sevro.extension.v1`. Sevro supplies execution, isolation, host observations,
built-in graders and retained results. This is repository development tooling;
marketplace plugins have no Sevro, Bun or TypeScript runtime dependency.

Normal callers use the exact `@bjoernrochel/sevro` pin in [package.json](../../package.json).
Install it with `bun install --frozen-lockfile`. The installed command is `sevro`.
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

## Runtime configuration

Sevro reads the repository's [`sevro.json`](../../sevro.json) for every case in
this project. It inherits `PATH` and `UV_PYTHON_INSTALL_DIR`, grants the
uv-managed Python installations read-only, seeds a private UV cache, enables
native goals, and exposes the trial's own native transcripts read-only. Sevro discovers Homebrew and Apple developer support folders from
the inherited `PATH`; the file names no machine-specific folders.

Darrow's callers prepare that environment before launching Sevro:

- They remove the repository's and Bun's injected `node_modules/.bin` and
  temporary folders from `PATH`, because Sevro refuses read grants inside the
  protected repository.
- They set `UV_PYTHON_INSTALL_DIR` from `uv python dir` when it is unset.
- They build the public seed cache at `~/.darrow/cache/sevro-uv-cache` from the
  registered Python packages' locks, and rebuild it only when a lock changes.

Repository-skill guide trials need `--claude-project-settings`, which conflicts
with native-goal hooks. The guide caller therefore selects
[`runtime-repository-skills.json`](runtime-repository-skills.json): the same
tools without hooks. An explicit `--runtime-config-file` replaces either default.
With a runtime file selected, direct and benchmark callers no longer add
`--claude-project-settings` automatically.

Native transcripts are enabled so Adaptive Goal's placement helper can read
the current session's model and effort, as it does outside Sevro.

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
See Sevro's [extension protocol](https://github.com/BjRo/sevro/blob/6387cca22609f3463e4558813b5e5e92c1c4f952/docs/extension-protocol-v1.md)
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

The semantic grader is Codex `gpt-6-luna/medium`. Optional host options follow
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
documented in [Sevro](https://github.com/BjRo/sevro/tree/6387cca22609f3463e4558813b5e5e92c1c4f952/docs).

## Historical result interpretation

These commands interpret retained archives without Sevro or its source checkout:

```sh
bun evals/runner/report.ts /absolute/path/to/results.json --json
bun evals/runner/compare.ts /absolute/path/to/baseline.json /absolute/path/to/candidate.json
bun evals/runner/ablation.ts /absolute/path/to/suite-run.json
```

Standalone readers also live in `legacy-report.ts`, `legacy-compare.ts` and
`legacy-ablation.ts`. Reports preserve input bytes, digests, valid peers and
diagnostics. Recorded rates and routes are archival claims. Measurements need
complete executed provenance and matching identity; missing, dry, partial or
contradictory evidence remains unmeasured.

Report and ablation commands preserve adjacent Markdown output and `--output`.
They refuse destinations that overwrite input archives or their aliases.
Interpretation success does not mean the evaluated task passed. The specification
defines supported formats and comparison eligibility.

### Historical reviewer-routing artifacts

The standalone validators preserve the original TSV proof formats:

```sh
bun evals/sevro-extension/legacy-native-review-proof.ts \
  --session /absolute/path/to/session.jsonl \
  --scope /absolute/path/to/scope.tsv \
  --route-record /absolute/path/to/route.tsv \
  --standards-record /absolute/path/to/standards.tsv --standards-call call-standards \
  --spec-record /absolute/path/to/spec.tsv --spec-call call-spec \
  --output /absolute/path/to/codex-proof.json
bun evals/sevro-extension/legacy-claude-review-proof.ts \
  --parent /absolute/path/to/parent.jsonl \
  --artifact-dir /absolute/path/to/artifacts \
  --output /absolute/path/to/claude-proof.json
```

All paths are absolute. Valid evidence atomically writes the original JSON proof
and exits zero; invalid invocation or evidence exits one without a new proof.
These readers do not establish current host behavior or evaluator equivalence.
