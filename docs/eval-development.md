# Eval Development Guidance

This scoped guidance applies when creating, changing, diagnosing, or running
Darrow evals. The normative evidence model remains at the repository-root path
`docs/specs/skill-evaluation.md`; this file owns the repository-specific
constraints for producing and interpreting that evidence.

## Case contracts

- Keep independent Darrow oracle and repository-tooling tests under
  `evals/domain/`. Invoke the owning oracle directly or use Sevro's public CLI
  and protocol; do not import generic runner implementation or its private types.
- Keep installed public-interface checks under `evals/integration/` and
  standalone historical-reader tests under `evals/history/`. Sevro owns the
  scheduling, isolation, host, built-in grading and persistence test matrix.
- Check suite selection, route declarations, mode expansion, and seeded order
  through `planSuite` in `evals/sevro-extension/suite.ts`. It runs the same
  preflight and compiles the same commands as execution, without creating
  results. Plans describe requested behavior and never prove observed routes
  or task outcomes. Keep subprocess coverage for execution, cancellation,
  retained evidence, and the installed package. Test ablation calculations
  through `analyzeAblations`, which the report writer also uses.
- Prepare copied executable runtimes once per test file and clean them after
  the file completes. Keep Git workspaces and result directories case-local.
  Group variants that differ only in oracle input into one prepared fixture;
  reset each variant's input and retained evidence before checking its outcome.
  Keep separate fixtures when a variant changes setup, source, or host state.
- Run review-record validation and presentation checks through the owning
  frozen Python CLI. The domain helper prepares only its package and record
  files; canonical fixture-setup tests retain the installed Sevro connection.
- Goal-review oracle tests invoke `adaptive-goal-fixture proof` directly and
  reuse its unchanged package within one test file. Keep a fresh Git repository
  and review-provider installation for each repair scenario, including stale
  content and duplicate or conflicting providers. Group synthetic report
  variants that share the same repository and provider setup.
- Give every skill colocated eval cases that verify its public behavior and
  intent boundaries. Test deterministic scripts separately when present.
- Start with the exact normative invariant or public promise under test. An
  assertion must not require stronger behavior, removed design, fixed counts,
  lifecycle markers, exact vocabulary, or serialization that the contract does
  not require.
- Prefer observable repository state, external effects, and user-visible
  outcomes over prose. When free-form text is the only public seam, assert the
  smallest semantic decision rather than parsing a complete explanation.
- For a free-form saved document, use `semantic_artifact` to grade the artifact
  itself. Its repository-relative `path` may contain one `*` in the filename and
  must resolve to exactly one regular file. Keep deterministic checks for file
  presence, status, and structural validation; `semantic_output_checks` grade
  only the final response.
- Semantic graders receive the response or artifact and the propositions, not
  the participant prompt or fixture. Include input facts needed to judge the
  answer in the proposition. Do not require the answer to repeat established
  facts merely to supply the grader's missing context.
- Give one case one concrete state and one decision. When success would require
  recognizing several conditional branches in one free-form answer, split the
  branches into separate concrete-state cases.
- Treat regex as a bounded classifier, not a natural-language parser. Add only
  ordinary phrasing demonstrated by valid evidence and a small, bounded set of
  plausible counterexamples; do not pursue exhaustive paraphrase or
  contradiction handling.
- Assert sequence only when order is part of the public contract. Do not
  require one exact tool sequence when several safe implementations yield the
  same observable result.
- Keep participant prompts visible and pass criteria hidden.
- When a native host requires user authorization to run tests, explicitly
  request that verification in a participant prompt whose acceptance expects
  test execution. Repository guidance or a skill cannot supply host-required
  user authority. Preserve implicit selection by naming the permitted check
  rather than adding a skill invocation.
- When a case's expectation holds only on one host or candidate route, declare
  `harnesses` and `candidate_routes` in the case instead of a comment. Filtered
  and ownership runs then skip excluded hosts and apply the declared route.
- Keep represented host configuration beneath a named fixture subdirectory.
  Identify its project root, working directory, user-config path, and trust in
  the prompt. Sevro rejects a fixture's top-level `.codex` directory unless the runtime
  explicitly opts into `codexState`; a nested
  represented configuration diagnoses that input, not the eval host itself.
  Cases that require the real isolated host configuration must retain that
  distinction and remain unavailable if the host cannot expose it.
- Keep packaged Python oracles under `backend/tests/evals/` so participant mounts
  omit them. Copy them into `.git/eval-checks/` during fixture setup for hidden
  grading; agents cannot read or write that reserved subtree.
- Keep authoritative fixture input and its executable acceptance oracle aligned,
  including whether representation details such as trailing newlines matter.
  Fixture content digests must remain SHA-256 when replacing an unavailable
  host utility. Use Python's standard-library hashing when macOS `shasum` cannot
  load Perl inside the isolated runtime; update the producer and checker together.
  Size deterministic test timeouts for every isolated fixture preparation in a
  batched control. Increasing that budget does not relax the acceptance checks.
- Put candidate-written fixture receipts, mutable mock state, and test traces
  under the prepared, Git-excluded `.fixture-state/`. Sevro permits legitimate
  writes to trial Git metadata while protecting hidden grading assets.
  For an unchanged whole-workspace feedback-boundary assertion, use
  `evals/sevro-extension/runtime-feedback-receipts.json` instead: fixture tools
  write to `DARROW_FIXTURE_RECEIPTS_DIR`, and graders read the original files
  through `SEVRO_CANDIDATE_ARTIFACT_RECEIPTS`. Preserve the configured directory
  and retain source-preservation and exact acknowledgement checks.
  Keep immutable setup inputs and hidden grading assets in their protected
  locations. Fixture backends remain immutable; give their `uv` child a private
  project environment when it would otherwise create a `.venv` in Git metadata.
  Sevro appends prepared-artifact ignore rules after fixture setup. Setup receives
  their exact relative paths as the JSON array `DARROW_EVAL_MOUNT_EXCLUDES`.
  Bind an ignore-preservation baseline to that declared list; preserve the
  original user configuration and reject missing, repeated, or undeclared rules.
  Do not infer permitted additions from candidate files or exempt a whole directory.
- On Sevro rc.16, setup shares the candidate commands' private home; its
  temporary directory remains disposable. Initialize candidate-home state in
  setup instead of asking the candidate to prepare grading prerequisites.
  Go corpus launchers share `.fixture-state/go/` caches across setup, candidate
  commands, and grading instead of downloading into that discarded home.
- On Sevro rc.12, actual host-state cases select
  `evals/sevro-extension/runtime-codex-state.json`. Doctor diagnoses the absolute
  isolated CODEX_HOME config, preserving the seeded UV cache. User-skill absence
  checks require all four candidate-bound skill directory grants, excluding only
  the native CODEX_HOME/skills/.system tree; missing evidence stays unavailable.
  These two cases declare `harnesses: [codex]` because those actual-state grants
  are Codex-specific. They do not establish native Claude user-state coverage.
- Express and Requests socket corpus cases select
  `evals/sevro-extension/runtime-local-http.json` on rc.12. Local HTTP access
  remains an explicit per-run opt-in; retain the original tests and assertions.
- Review artifact cases select `evals/sevro-extension/runtime-review-artifacts.json`
  explicitly. With Sevro rc.8 or later, graders read the original candidate
  `~/.darrow/reviews` subtree through `SEVRO_CANDIDATE_ARTIFACT_REVIEWS`, then
  bind that path to the owning oracle's `DARROW_REVIEW_STATE_DIR`. Preserve
  configured runtime and dependency-cache paths. The participant prompt states
  that prerequisite because another valid private state root is outside the
  declared grant. Missing declared directories
  fail grading; Review fixture setup prepares real empty state before testing
  missing reports or absence. The grant is read-only and lasts only through grading.
  Its path and tree have already passed Sevro's canonical-path and alias checks.
  Use that bound root and `dirname` for artifact paths; `cd` followed by
  `pwd -P` may require access to private ancestors outside the read grant.
  Read existing canonical records from the grant. A current-worktree comparison
  creates its new scope only in separate private temporary state, then compares
  the owning backend's exact target fingerprint without changing the granted tree.
- Graders use declared host tools or portable system commands. Tools injected
  from a Codex credential directory are removed from the inherited runtime
  `PATH` and must not become an undeclared grading dependency.
  Review's independent route oracle uses only the Python standard library and
  runs directly with `python3`; it does not bootstrap the Review runtime.
  Canonical result validation still uses the owning frozen backend.
- Keep fixture skills inert in the source tree: never name an eval fixture
  `SKILL.md`. Use a non-discoverable template filename and materialize it as
  `SKILL.md` only inside the isolated eval repository during setup.
- Quote YAML prompts containing `#` and make fixture binaries succeed on valid
  empty state.

## Failure ownership

- During iterative live work, run cases sequentially and stop at the first
  failure. Never continue to another case while a failure is unexplained.
- Inspect the failed check together with the retained final output, observable
  repository or external state, and only the bounded transcript evidence
  relevant to activation, authority, or tool use.
- Classify the failure as product behavior, harness behavior, fixture defect,
  or invalid expectation before editing. Change product instructions only when
  the observed behavior violates the current contract; otherwise repair the
  harness, fixture, or expectation that owns the defect.
- For assertion-only changes, regrade retained outputs when available. Include
  a known-valid output and a plausible counterexample, then run fresh trials;
  regrading old output does not count as new behavior evidence.
- If the failure remains ambiguous, report that limitation and stop instead of
  converting a hypothesis into product policy.

## Activation probes

- Use `{{skill_invocation}}` only when the participant explicitly invokes the
  owning skill. The runner treats that placeholder as the source of truth for
  explicit versus implicit activation; do not duplicate the distinction in
  case metadata.
- On Codex, an explicit case uses the exact rendered host-native invocation
  token delivered once to a successfully completed turn. It does not require a
  transcript-visible `SKILL.md` load.
- A Codex case without the placeholder remains an implicit-discovery probe and
  requires complete prepared-body exposure in the unique
  `sevro.host.skill-activations` observation on Sevro rc.15. Do not use explicit
  dispatch to make implicit selection pass. The `tool_result_body_match`
  collector matches tool results independently of shell syntax and can combine
  exact pages within one session and turn. Identical copies can match; this
  proves body exposure to the tool caller, not which file was opened or whether
  Code Mode forwarded the result to the model. Changed, short, transformed, and
  unanchored text lies outside the prepared matching scope.
- Missing, repeated, malformed, partial, truncated, or ambiguous collection stays
  unknown, including in negative cases. Retain qualified host identities and
  normalize only declared plugin namespaces to Darrow's unique mounted skill
  names. Do not recover missing common collection from retired observations or
  native transcripts. Keep task and activation outcomes separate.
- A composed `activation_sequence` requires the primary owner first and a
  complete mounted body read for every supporting skill. Use
  `activation_includes` when supporting skills must be read but their order is
  not contractual; complete observations and mounted skills remain required.
  Use `activation_excludes` when a negative case must prove that a named skill was
  absent from the entire observed sequence rather than merely absent as the
  primary selection.
  Excluded skills must actually be available in the case's mounted skill set;
  that includes independently installed `additional_plugins` and explicitly
  selected `additional_skills`, not just siblings of the owning skill.
  Claude uses the common collector's `skill_tool_result` method: only successful
  structured Skill calls establish selection. Direct Read calls and explicit
  native command expansion do not add observed skills. Repository skill names
  remain unqualified; a foreign plugin with the same skill name cannot substitute.
- Explicit Codex probes retain the invoked owner first, then verified supporting
  activations from the common collector. The dispatch receipt contains only the
  invoked owner; it cannot establish supporting inclusion, exclusion, or order.
  Incomplete collection cannot establish an exclusion. Retired per-turn read
  observations remain unavailable for policies that still require that distinct
  evidence; a whole-run collector cannot silently acquire per-turn meaning.

- Recipe composition evidence must positively establish the accepted agent and
  the bound supporting capability. Absence of a prohibited action alone cannot
  prove a handoff. Codex native acceptance correlates one spawn, host start and
  accepted result; missing, duplicate, malformed or mismatched evidence stays
  unaccepted. When the host encrypts the launch message, the receipt leaves the
  agent's role unverified. Combine it with supporting capability activation,
  observed outcomes and absence of parent work after acceptance for composition
  evidence; it cannot establish a complete goal contract or selected/effective
  route equivalence. Retain only bounded identity/route facts and parent work
  observations, without private command or contract contents.
  Nested Codex reader evidence also binds its task/axis and a nonempty final
  assistant message to the same turn's subsequent native completion event.
  An available session or accepted unrelated child is insufficient. These
  metadata facts establish a returned reader turn, not the correctness of its
  assessment; combine them with the candidate-bound provider result and checks.

- Native Codex feedback receipts remain `delivery: unverified`; an output
  string can also be an error. The observer records whether a same-target
  message attempt followed the runner's actual feedback boundary. Continuation
  cases with a configured second turn also retain booleans stating whether the
  collaboration call's plaintext message exactly matched or contained that rendered
  second-turn prompt; neither message body is retained. Encrypted or unavailable
  native message fields retain null comparisons and their representation, never
  a false mismatch. These facts distinguish
  exact copying and intact wrapping from other relay forms, but do not grade
  semantic preservation or claim host delivery.
  Continuation cases combine those observations with an unchanged worktree at
  the boundary, fixture acknowledgement and effects, one accepted agent, and
  no parent work.
  These establish bounded task behavior, not independent proof of exact message
  delivery. Interrupts and pre-feedback messages cannot satisfy the attempt
  check.

## Retained results and interrupted runs

Codex evidence also retains bounded native goal-control observations. Direct
function calls are invocation attempts; references found in submitted `exec`
code remain execution-unverified, including conditional or deferred calls.
Comments and string literals are not call expressions. These observations do
not establish goal-creation success or adaptive-owner acceptance. They never
retain the submitted code, goal text, arguments, or tool output, and their
absence is not proof of non-use through aliases or other dynamic code.

Each attempt has a unique directory under `evals/results/attempts/`. Its
`run.json` records ownership, lifecycle status, and absolute per-trial artifact
paths. Each trial artifact contains the complete bounded `CaseResult` for that
trial, including response, checks, transcript, activation and grader evidence,
plus the configured trial count. It is persisted before fixture cleanup and
completion feedback. The normal result array is published atomically only after
the entire run finishes.

On error or interruption, inspect the printed diagnostic and evidence paths.
With Sevro rc.10 or later, forward `--retain-host-diagnostics` after `--` to
retain bounded native stage, error, and subprocess receipts, including failures
before a session exists. Resolve `sevro.host.diagnostics` through the trial's
artifact references. Keep these private files out of Git. The flag changes run
identity; a diagnostic rerun is not an exact repeat of a run without it.
Completed trials remain available even if another worker fails. If checkpoint
storage fails, the diagnostic's `unpersistedTrials` retains the full results
when the diagnostic destination is writable, and the error names the retained
fixture. Do not treat a partial attempt's single-trial summaries as a completed
threshold run. Raw evidence remains gitignored and bounded by the existing
transcript/privacy contract.

SIGINT and SIGTERM stop additional trial work and terminate tracked candidate
and grading process groups before finalizing interruption evidence. A retry
checks the recorded host, PID, and process start time, so a live runner still
blocks duplicates and an exited owner can be reclaimed without losing the old
attempt. Short ownership updates use Bun's built-in SQLite transaction lock;
the OS releases that lock after abrupt process death. No lock is held for the
duration of model execution.

A legacy active record without process identity, an unreadable record, or an
owner whose liveness cannot be verified is not automatically expired. Confirm
the previous runner has exited, archive the exact active-record path reported
by the error, and retry. Preserve the old evidence directory. SIGKILL cannot
finalize in-flight evidence; completed trial files remain inspectable and the
next attempt records the abandoned attempt as interrupted.

Result arrays carry `executionMode` on cases and trials. Dry cases have a null
`passRate`; their fixture checks are preparation diagnostics. Reports label dry
or unknown execution as unmeasured, and comparison commands refuse behavioral
deltas for those inputs. Historical suite manifests with an explicit `dry`
boolean supply missing provenance. Standalone historical results without such
provenance remain unknown; empty responses and zero timings do not establish
execution mode.

For read-only historical interpretation, run
`bun evals/sevro-extension/legacy-report.ts /absolute/path/to/input.json [--json]`.
The standalone reader handles legacy arrays, suite manifests, and trial
checkpoints without Sevro or the generic runner. It preserves archive bytes,
separates recorded claims from complete executed measurements, and keeps
unknown provenance and partial attempts unmeasured. The legacy report command
uses the same view for Markdown and `--json`. Its default remains adjacent
`report.md`; `--output` selects another Markdown destination. The standalone
reader defaults to stdout. Both refuse input archives and their aliases as
output. The human layout deliberately replaces the old rollups with the
historical view's recorded facts and explicit measurement boundaries. See the
[historical reader contract](../evals/sevro-extension/README.md#historical-result-interpretation)
and [validation](research/sevro-extraction.md#history-validation), plus
[report-command validation](research/sevro-extraction.md#legacy-report-command-validation).

Historical skill ablation uses
`bun evals/runner/ablation.ts /absolute/path/to/suite-run.json` or
`bun evals/sevro-extension/legacy-ablation.ts /absolute/path/to/suite-run.json`.
Both preserve adjacent `ablation.md` and `--output`, resolve relative result
paths beside the manifest, and run without the generic runner or Sevro.
Recorded deltas require matched mode definitions and complete executed cells;
unknown identity, unfinished cells, contradictory evidence, and changed
instrumentation are ineligible. Valid peer comparisons remain visible. A dry
suite is unmeasured preparation. Input digests and diagnostics remain in the
report, and no output may replace an archive or its alias. See the
[historical ablation contract](../evals/sevro-extension/README.md#historical-result-interpretation)
and [validation](research/sevro-extraction.md#legacy-ablation-validation).

Shell checks, including dry checks, use the same outer isolation mechanism as
candidate execution with a separate credential-free home and environment.
They retain fixture tool access while source worktrees, peer fixtures, global
harness configuration, copied harness credentials, and retained evidence are
protected. An unavailable isolation boundary fails explicitly; the existing
external-sandbox declaration is valid only inside equivalent external isolation.

Grading scratch cleanup handles read-only dependency caches such as Go modules.
If cleanup still fails, the runner prints the absolute retained scratch path
and the cleanup error. Grading outcomes and any original execution error remain
intact; the warning does not turn a completed behavioral check into a failure.

## Repository-skill cases

Repository skills use canonical cases at `.agents/skills/<name>/evals/*.yaml`.
Select them with `--skill <name>`. They have no owning plugin, so `--plugin`
excludes them. Codex mounts the canonical project skill; Claude mounts the
corresponding `.claude/skills/<name>` entrypoint and refuses a missing mirror.
Explicit tokens are `$<name>` and `/<name>`. Mirrors are not scanned twice.
`--skill-dir` overrides the candidate after selecting ownership;
`--without-skill` preserves the cases as an unmounted control.

Repository cases cannot request `source_plugin` or `mount_plugin_skills`.
Optional supporting capabilities use `additional_skills` or independent
`additional_plugins`. The same isolation and hidden-check boundaries apply.
Coverage includes canonical repository cases by default.

The guide's versioned inventory lives beside its cases. Run
`bun evals/repository-guide.ts` for sequential cross-host, single-trial
evaluation that stops at the first failure. `--only <question-id>` and
`--harness codex|claude` narrow diagnosis; `--dry` prepares fixtures and
`--without-skill` selects a matched unmounted control. Inspect each failure
before continuing. Fixtures snapshot current public documentation, manifests,
and relevant code while excluding inventory, hidden checks, and delivery
conclusions from the participant repository.
The guide driver pins semantic grading to Codex `gpt-6-luna` / high;
the shared runner uses the same gating grader default.

That same command uses Darrow's exact installed Sevro dependency and retains
separate task and activation outcomes. `SEVRO_CHECKOUT` or `SEVRO_PACKAGE_BIN`
selects an explicit development or candidate override. Its per-cell
JSON uses the Sevro format. Optional absolute project and results roots and
forwarded host options are documented in the
[guide caller migration](../evals/sevro-extension/README.md#repository-guide-caller).
Normal execution requires `bun install --frozen-lockfile`.

## Live-run controls

Use `--codex-entrypoint app-server` for Codex native main-thread goal trials
with `--owner-evaluation passive`. Sevro hosts the original participant thread,
observes its native continuation, and waits for the terminal response. It never
supplies synthetic continuation prompts or changes the participant's goal.
Only a declared follow-up starts another client-requested turn. Requested
transport contributes to run identity and the host retains its actual transport.
Historical separate-owner guards remain historical architecture measurements.

Use `--owner-evaluation passive` for observational native trials of the shipped
adaptive-goal skill. The default `--owner-evaluation enforced` preserves
the requested historical diagnostic condition, which bundled Sevro hosts
currently reject as unsupported. It never becomes passive implicitly.
Neither mode removes ordinary fixture/credential isolation. Suite modes can
set `owner_evaluation: passive|enforced` independently. Results retain requested
mode on the case and actual assistance on each harness result; historical
absence stays unknown. A dry run is not an observed passive trial.

The retired Codex guard used a strict structured contract template and could
reject valid presentation variants allowed by the shipped skill. Retained
results from that guard remain historical enforcement-profile measurements.
Passive native session evidence proves correlated acceptance and
same-target message attempts but leaves delivery and encrypted role/contract contents
unverified. Combine it with task and authority evidence; do not infer missing
contract or route-selection facts.

For a matched Codex comparison, pass `--assert-effective-owner-routes` with
a JSON object mapping case IDs to `{model, effort}`, or set the suite mode's
`effective_owner_routes` mapping. Missing, ambiguous, or wrong native route
evidence fails the assertion. The case retains the expected route and the
trial retains the independently observed effective route. Suite
`model_by_harness` overrides the candidate model for that condition, while a
top-level `harnesses: [codex]` restricts both default and explicit host selection.

Select all colocated cases for every skill in one plugin with
`--plugin <plugin-name>`, for example
`bun evals/runner/run.ts --plugin darrow-git --harness codex` from the repository
root. The plugin name matches its directory exactly across plugin kinds,
regardless of case IDs, and excludes skill-less experiments. Add `--skill` to
narrow the selection to one skill in that plugin, or repeatable `--case` filters
to narrow it to IDs matching any supplied substring.

Select all colocated cases for one skill with `--skill <skill-name>`, for
example `bun evals/runner/run.ts --skill create-commit --harness codex` from
the repository root. The skill name matches its directory exactly, regardless
of case IDs. Add repeatable `--case <substring>` options to narrow that skill's
cases to IDs matching any supplied substring. An unmatched selection fails
with `No cases matched.` The separate `--skill-dir <path>` option overrides
the mounted skill after selection; `--without-skill` disables mounting while
preserving the selected cases.

For a frozen plugin copy passed through `--skill-dir`, preserve the owning
plugin directory name: `<snapshot>/<plugin-name>/skills/<skill-name>`. The
current prompt renderer derives the Codex invocation namespace from the source
plugin path or that directory name, while installation uses the manifest name.
Verify that the rendered `$<plugin-name>:<skill-name>` token matches the
installed manifest before a live run. A copy renamed `candidate` or `plugin`
can produce a mismatched invocation; retain such runs separately from valid
explicit-invocation evidence.

Codex runs use independent defaults for each eval role:

- candidate: `gpt-6-luna` at `medium` effort;
- advisory quality judge: `gpt-5.6-sol` at `low` effort;
- gating semantic-output grader: `gpt-6-luna` at `high` effort.

Use `--model` and `--effort`, `--judge-model` and `--judge-effort`, or
`--semantic-check-model` and `--semantic-check-effort` to override the
corresponding role. Suite runs use `--codex-model` for the candidate and retain
the same role-specific judge and semantic-check options. The runner records the
resolved model and effort for every role in suite manifests, JSON result
evidence, and generated reports.

The direct runner uses color, status symbols, terminal hyperlinks, and an
updating progress bar when stdout is an interactive terminal. Use
`--no-color`, `--no-emoji`, or `--no-progress` to disable those dimensions
independently; `NO_COLOR` also disables color. Redirected output is stable and
unanimated. Every completed run prints the absolute raw-result path even when
terminal hyperlinks are unavailable. Use `--jobs <positive integer>` to bound
simultaneous trials within each case; the default is `--jobs 3`. Use `--jobs 1`
for serial diagnosis or rate-limit-sensitive runs. Runs with more than one job
use per-trial status lines instead of the single active-trial animation.

Codex processes import only `agents.max_concurrent_threads_per_session` from
this repository's `.codex/config.toml` into their isolated config. Other
repository settings and user settings remain excluded. The runner captures
the limit once per process and includes it in the evaluation digest for each
Codex role. Case and trial results retain `codexAgentConcurrencyLimit`; null
means the host default, while absent historical evidence remains unknown.
This limits subagents within one trial and is separate from `--jobs`, which
limits simultaneous trials. Missing configuration uses the host default;
unreadable configuration, invalid TOML, or a nonpositive/noninteger limit fails
explicitly.

## Installed Sevro verification

Install the exact published development dependency before running the public
integration and Darrow domain gate. Python fixture tools use a UV-managed Python
3.13 copy so both UV entrypoints and direct Python oracles use the same isolated
runtime. System and framework installations may depend on paths outside their
copied directory.

```sh
bun install --frozen-lockfile
uv python install 3.13
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun run test:evals
```

This command exercises Sevro's installed public CLI, versioned extension
protocol, Darrow callers, domain oracles, and standalone historical readers.
It uses controlled native executables and credentials for deterministic host
fixtures. Generic engine and host implementation tests belong to Sevro. No
integration fixture copies the former runner or imports private implementation
or types.

Integration commands allow 30 seconds per test for frozen backend startup and
isolated CLI fixtures. A test's explicit timeout still takes precedence.
Pass explicit `./evals/...` directory paths to Bun. Bare paths are substring
filters and can scan retained fixture trees outside the intended test scope.

The [test ownership guide](../evals/README.md) separates installed integration,
Darrow policy and historical readers. The source-copy launcher and comparison
against the retired runner are gone. Their evidence and deliberate command
changes are preserved in the [research record](research/sevro-extraction.md).

For coordinated development, use one explicit absolute route:

```sh
SEVRO_CHECKOUT=/absolute/path/to/sevro bun run test:eval-integration
```

A separate candidate archive can be installed and exercised without its source
checkout:

```sh
SEVRO_PACKAGE_TARBALL=/absolute/path/to/bjoernrochel-sevro-version.tgz bun run test:eval-package
```

The package gate installs the archive in a temporary consumer and runs the
integration, policy and historical-reader groups with its checkout override
cleared. Default-caller checks also verify Darrow's own frozen pin with both
overrides cleared. An explicit checkout retains its revision and patch identity;
it is development evidence. Upgrade and rollback instructions are in the
[development and release guide](../evals/sevro-extension/migration.md).

Normal direct, guide, and benchmark callers use the frozen installed pin. The
suite caller retains selectors, route options, seeded ordering, and
cancellation, with JSON summaries and separate reports. The direct caller
retains selection and route options and writes its selection manifest to stdout
and optional `--output`. Its `--human-review-minutes` annotation is supplied
by the user; omitted values stay unknown and dry runs stay unassessed.
See the [public caller contracts](../evals/sevro-extension/README.md).

The suite's Darrow-owned quality report stays separate from Sevro's generic
report. It distinguishes non-record task checks, bookkeeping completeness, and
the public task verdict. Dry or unavailable evidence keeps rates unknown.
See the [quality contract](../evals/sevro-extension/README.md#suites).

Bundled hosts explicitly reject enforced execution. Generic adapters can
negotiate that capability for deterministic identity checks; these checks do
not establish bundled-host enforcement. Native observational comparisons select
the named passive modes explicitly. Neither those modes nor this extraction
actively correct benchmark execution.

- Use one trial per invocation while diagnosing so stop-at-first-failure is
  real:

  ```sh
  cd evals && bun runner/run.ts --case <substring> \
    --harness <claude|codex> --trials 1 --jobs 1 [--dry]
  ```

  Repeat a single-trial invocation only after the preceding result is
  understood. Use a multi-trial threshold run after the case and checks are
  stable.

- Develop behavior-changing variants from comparative evidence. Run the
  candidate and relevant control against the same fixtures, prompts, checks,
  harness, model, effort, trial count, and threshold.
- Evaluate host-specific behavior on its native harness. Never use Claude as a
  proxy for Codex behavior or Codex as a proxy for Claude behavior. Run both
  harnesses only when the behavior or comparative claim is explicitly
  cross-host.
- Use one bounded fresh-context review after the candidate is stable. Address
  its material findings grounded in plausible behavior or ordinary wording,
  rerun affected checks, then report residual natural-language limitations.
  Do not start repeated assertion-hardening review rounds.
- Report the trial count, harness, model, effort, pass threshold, relevant
  metrics, and limitations. A convenient green run is not a stability claim.

## Adjacent gates

- Run relevant deterministic script tests with both `bash` and `/bin/bash`.
- When changing `darrow-review`'s externally visible independent-review or
  fix-verification outcome semantics, also run the affected review-composition
  evals under
  `plugins/orchestration/darrow-adaptive-goal/skills/adaptive-goal/evals/`.
- Keep activation, task outcome, invariant coverage, and matched ablation as
  separate evidence dimensions; one does not substitute for another.
