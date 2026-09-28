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
unavailable. Full goal-route reports and most transcript checks remain
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
identity. `--without-skill` before `--` omits mounted skills for a baseline
run; explicit skill-invocation cases are rejected for this mode. Options after
`--` go to Sevro. The results directory holds the
extension command file at a stable path. The command emits Sevro's JSON result
and exit category. Unsupported case features still fail during resolution.

For suites with passive or enforced modes, run the Darrow suite entrypoint with
an absolute suite path:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun evals/sevro-extension/suite.ts \
  --suite /absolute/path/to/suite.yaml \
  --results-root /absolute/path/to/results --trials 1 --threshold 1 -- \
  --host codex --codex-bin /absolute/path/to/codex \
  --codex-auth-file /absolute/path/to/auth.json \
  --model gpt-5.6-terra --effort medium --shell-isolation
```

This suite route accepts a nonempty, unique `harnesses` list containing `codex`,
`claude`, or both; an omitted list defaults to `[claude, codex]`. Repeat
`--harness <host>` or `--mode <name>` before `--` to select supported hosts or
named modes. Repeatable `--case <substring>` filters replace the suite filters
for a focused run. Selection errors fail before any cells start. It accepts
`owner_evaluation`, `without_skill`, `model_by_harness`, and `effort` in each
mode. Candidate model and effort overrides require Sevro's bundled hosts;
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
`activation-report.json` and `activation-report.md` report the separate
activation gates, all three classes, recall, and precision grouped by mode
and harness. Incomplete observations and empty metric denominators remain
unknown; unmounted controls supply no measurements. Named ablations write
`ablation-report.json` and `ablation-report.md` with per-case pass rate, time,
token, and cost deltas; missing measurements stay unknown. Missing cells or
mismatched identity dimensions invalidate the comparison. Benchmark conditions,
owning skill overrides, and effective owner-route assertions still use the
legacy suite command.

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

The entrypoint supplies `index.ts`, `run.ts`, `sevro-command.ts`, the local
ticket command, the corpus
source validator, the repository `package.json`, and `bun.lock` as extension source files so the executable,
invocation, and YAML parser version are included in Sevro's source digest. Case
content enters the selected case, fixture, and check digests.

This development path uses an explicit Sevro checkout or local package tarball
until a release is pinned. It does not replace the existing eval command yet.
