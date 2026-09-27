# Darrow extension for Sevro

`index.ts` speaks the versioned `sevro.extension.v1` process protocol without
importing Sevro internals. Darrow owns case discovery and translation; Sevro
owns fixture construction, host execution, built-in checks, isolation, and
retained results.

This migration slice resolves one selected skill-free experiment case or
plugin-local skill case. It accepts generated Git commits or a pinned corpus
repository, optional working-tree and staged files, committed scaffolding,
Git hooks, fixture stub binaries, local fixture tickets, fixture setup scripts,
hidden shell checks with exit-code and stdout assertions,
Git HEAD change and ancestry expectations,
combined final-message checks with skill-owned JSON Schemas, and semantic
propositions graded by Sevro's separate evaluator route.
For a plugin-local case, `prepare` mounts the selected skill's files under
`.agents/skills/` and excludes their exact paths from Git status. Colocated
`evals/` files and generated caches stay out of the candidate fixture. Skill
bytes enter the fixture identity through their retained artifact digests.
Executable skill files keep owner execute permission in the fixture and retained
artifact copy. Cases with `mount_plugin_skills: true` mount all sibling skills
from the owning plugin through the same project-discovery path, with a shared
artifact limit. Competition activation requires that sibling set.
Cases with `additional_plugins` package every named provider separately in
the isolated Codex marketplace, including its skills and contained mechanics.
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
`evals/corpus/orchestration/manifest.yaml` and a clean prepared checkout, then
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

Adaptive-delivery cases that declare `goal_route_checks: false` and the
forbidden goal-report policy now retain their ownership checks through the
Sevro extension. A complete Codex native-call observation is required. The
extension checks that no replacement owner launched, that later parent calls
only waited or addressed the accepted child, and that the final answer omitted
internal goal records. Missing or partial host evidence leaves those checks
unavailable. Cases with transcript checks or full goal-route reports remain
unsupported until their distinct evidence can be translated.

For local protocol and public CLI validation, run:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun test evals/runner/parity/sevro-extension.test.ts
```

To run one supported case through the Darrow entrypoint, select an installed
Sevro command with `SEVRO_PACKAGE_BIN` or a local development checkout with
`SEVRO_CHECKOUT`. For example:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/run.ts \
  --case-id orchestration-routing-localized-mechanical \
  --results-root /absolute/path/to/results -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model gpt-5.6-terra --effort medium \
  --condition passive --trials 1 --threshold 1 --shell-isolation
```

The entrypoint fixes the Darrow extension, project, case, results, and source
identity. Options after `--` go to Sevro. The results directory holds the
extension command file at a stable path. The command emits Sevro's JSON result
and exit category. Unsupported case features still fail during resolution.

For suites containing only Codex cells and passive or enforced modes, run the
Darrow suite entrypoint with an absolute suite path:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/suite.ts \
  --suite /absolute/path/to/suite.yaml \
  --results-root /absolute/path/to/results --trials 1 --threshold 1 -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model gpt-5.6-terra --effort medium --shell-isolation
```

This initial suite route requires `harnesses: [codex]` and accepts only
`owner_evaluation` in each mode. It resolves `case_filter` substrings to exact
case IDs before starting, rejects duplicate IDs and unsupported suite fields,
then invokes the public Sevro CLI once per case and mode. `suite-run.json`
records the suite content digest, selected cells, Sevro result paths, evidence
paths, and exit codes. Failed cells remain in the manifest while later cells
run. The command exits 1 if any cell fails. Ablations, route overrides, and
report generation still use the legacy suite command.

The parity test also prepares the mounted skill through Sevro's bundled Codex
route with `--dry`, validating its protocol identity and retained artifacts
without starting a model turn. On macOS with Codex installed, it also drives a
controlled JSONL turn through the bundled host to verify complete and partial
native activation receipts end to end without a model call.
The first focused live run is recorded in [live-validation.md](live-validation.md).

The entrypoint supplies `index.ts`, `run.ts`, `sevro-command.ts`, the local
ticket command, the corpus
source validator, the repository `package.json`, and `bun.lock` as extension source files so the executable,
invocation, and YAML parser version are included in Sevro's source digest. Case
content enters the selected case, fixture, and check digests.

This development path uses an explicit Sevro checkout or local package tarball
until a release is pinned. It does not replace the existing eval command yet.
