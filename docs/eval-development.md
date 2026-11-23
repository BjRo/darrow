# Eval development guidance

Find [case contracts](#case-contracts), [activation probes](#activation-probes),
[retained results](#retained-results-and-interrupted-runs), [live-run controls](#live-run-controls),
and [installed Sevro verification](#installed-sevro-verification).

This guidance owns Darrow's evaluation authoring and evidence rules. The
[Sevro extension reference](../evals/sevro-extension/README.md) owns current
caller options, runtime profiles and protocol integration.

## Evidence interpretation

Keep task outcomes, skill activation, workflow diagnostics and matched comparisons
separate. A passing task does not prove activation or added value. An activation
receipt does not prove provider execution, publication or correct code. Dry runs
establish preparation only. Missing, incomplete, duplicated or malformed required
evidence remains unavailable; an observed violation fails. Do not convert either
to a pass or missing measurements to zero. Retain original results when regrading
and label a new assessment as a regrade rather than fresh execution.

Activation classes are `positive`, `negative` and `competition`. Positive requires
the owning skill as primary; negative excludes it as primary. Competition mounts
all sibling skills before testing primary selection. Skill-less experiment and
no-skill control modes have no target activation grade. Observable checks and
semantic propositions define pass criteria.

Implicit activation uses the unique complete `sevro.host.skill-activations`
collection. Codex reports prepared-body exposure through `tool_result_body_match`;
Claude reports successful Skill calls through `skill_tool_result`. Exposure does
not prove that a tool result reached the model or identify which identical copy
was opened. Normalize only mounted namespaces. Final-answer resemblance and
retired read diagnostics do not establish activation.

A unique complete Codex `sevro.host.skill-activation-claims` receipt can establish
a known primary and positively observed supporting membership while the paired
common collection is partial only for the exact `pending_tool_calls` gap. Missing,
duplicate, foreign, malformed or contradictory receipts remain unavailable.
An explicitly unknown primary stays unknown even with a complete collection.
Missing positive membership does not establish absence. Negative membership,
exclusion and sequence require the complete common collection. Explicit dispatch
retains its own receipt requirements and does not prove supporting activation.

Explicit Codex probes require the exact rendered invocation token once in a
successfully completed turn. Claude may expand an explicit command before its
first assistant turn; accept that path only when namespace, skill, arguments and
session match the mounted command and its complete body follows in that session.
Partial, duplicate or foreign expansion is unavailable. Retain the bounded
receipt rather than command or skill text.

Native-goal declarations are `required`, `complete`, `forbidden` or `optional`.
Bind observations to the original thread or session. `complete` requires observed
terminal completion; activation alone is insufficient. `optional` accepts valid
presence or valid observed absence, never failed observation. Codex goal objectives
must fit the native 4,000-character boundary. Claude headless activation uses the
native user-visible `/goal` entry, not synthetic continuation or a replacement owner.

Ticket-to-PR task verdicts use observable output, repository effects and acceptance
checks. Its native-goal and transcript assertions are separate workflow
domain outcomes. Missing diagnostics stay unavailable without rewriting a proven
task outcome. Adaptive Goal also treats auxiliary transcripts as diagnostics;
native-goal requirements, explicitly tested implementation routes and no mutation
before required user feedback remain task gates. Other plugins retain their
declared task gates. Positive route checks consume accepted-child facts from the
owning host. Absence checks still require complete control observations.

Matched comparisons hold prompts, fixtures, checks, harness versions, models,
effort, trial counts and thresholds constant. A skill-only ablation changes only
the mounted skill. Complete-workflow comparisons include differences in assurance
and coordination cost; they cannot isolate those costs or establish equal review
quality from equal task pass rates. Record limits, unknowns and per-task regressions.

## Case contracts

- Keep independent Darrow oracle and repository-tooling tests under
  `evals/domain/`. Invoke the owning oracle directly or use Sevro's public CLI
  and protocol; do not import generic runner implementation or its private types.
- Keep installed public-interface checks under `evals/integration/`. Sevro owns the
  scheduling, isolation, host, built-in grading and persistence test matrix.
- Check suite selection, route declarations, mode expansion, and seeded order
  through `planSuite` in `evals/sevro-extension/suite.ts`. It runs the same
  preflight and compiles the same commands as execution, without creating
  results. Plans describe requested behavior and never prove observed routes
  or task outcomes. Keep subprocess coverage for execution, cancellation,
  retained evidence, and the installed package. Test ablation calculations
  through `analyzeAblations`, which the report writer also uses.
  Check model and effort mismatch permutations with `candidateRouteMatches`
  against retained public-command routes. One contradictory suite can exercise
  a model mismatch on Codex and an effort mismatch on Claude while retaining
  unaffected control cells and the separate ablation rejection run.
- Prepare copied executable runtimes once per test file and clean them after
  the file completes. Keep Git workspaces and result directories case-local.
  Group variants that differ only in oracle input into one prepared fixture;
  reset each variant's input and retained evidence before checking its outcome.
  Keep separate fixtures when a variant changes setup, source, or host state.
- When case declarations share identical fixtures and oracles, bind them with
  equality assertions and run one behavioral matrix. Keep distinct successor
  selection, real-provider, cold-cache, and lifecycle coverage. Batch read-only
  protocol usage in one fixture, checking exit status and absence of effects
  after each invocation. Test response-only examples against their canonical
  output declarations, with passing and failing installed CLI checks.
- Run review-record validation and presentation checks through the owning
  frozen Python CLI. The domain helper prepares only its package and record
  files; canonical fixture-setup tests retain the installed Sevro connection.
  Reuse its copied package, frozen environment, and UV dependency cache within
  the file. Each invocation gets a private home, scratch directory, and artifact
  root, with a link to the unchanged package at the canonical fixture path.
- Goal-review oracle tests invoke `adaptive-goal-fixture proof` directly and
  reuse its unchanged package within one test file. Keep a fresh Git repository
  and review-provider installation for each repair scenario, including stale
  content and duplicate or conflicting providers. Group synthetic report
  variants that share the same repository and provider setup.
- Give Darrow-maintained behavior colocated eval cases that verify its public
  outcomes and intent boundaries. For curated upstream skills, check import
  closure/notices and native entrypoints, focusing behavioral cases on material
  Darrow adaptations. Trust upstream maintenance for unchanged behavior rather
  than adding a per-skill behavioral suite. Test deterministic scripts separately.
- Start with the exact normative invariant or public promise under test. An
  assertion must not require stronger behavior, removed design, fixed counts,
  lifecycle markers, exact vocabulary, or serialization that the contract does
  not require.
- Prefer observable repository state, external effects, and user-visible
  outcomes over prose. When free-form text is the only public seam, assert the
  smallest semantic decision rather than parsing a complete explanation.
- Grade final responses with `output_checks` or `semantic_output_checks`.
  Shell checks inspect fixture state, not the retired `.git/last-message.md`
  response file. Do not recreate that file as a compatibility adapter.
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
  `goal-failed-check-blocks-publication` uses the same profile for check and
  dependent-effect receipts, so cleanup of generated workspace files cannot
  erase evidence that the required check ran.
  Keep immutable setup inputs and hidden grading assets in their protected
  locations. Fixture backends remain immutable; give their `uv` child a private
  project environment when it would otherwise create a `.venv` in Git metadata.
  Sevro appends prepared-artifact ignore rules after fixture setup. Setup receives
  their exact relative paths as the JSON array `DARROW_EVAL_MOUNT_EXCLUDES`.
  Bind an ignore-preservation baseline to that declared list; preserve the
  original user configuration and reject missing, repeated, or undeclared rules.
  Do not infer permitted additions from candidate files or exempt a whole directory.
- Before changing runtime profiles or shared-cache setup, read `evals/sevro-extension/README.md`.
  Its runtime-configuration section owns role grants, cache warming, offline
  dependencies, and cleanup. Preserve shared sources and retained evidence;
  prune only between evaluations. Use fingerprinted private seeds when
  dependency independence is contractual.

- Setup shares the candidate commands' private home; its
  temporary directory remains disposable. Initialize candidate-home state in
  setup instead of asking the candidate to prepare grading prerequisites.
  Review repair fixtures invoke their bundled frozen launcher during setup;
  direct `uv run --project` against the source plugin would share its `.venv`
  across workers with different temporary homes and interpreter installations.
  Go corpus launchers share `.fixture-state/go/` caches across setup, candidate
  commands, and grading instead of downloading into that discarded home.
- Actual host-state cases select
  `evals/sevro-extension/runtime-codex-state.json`. Doctor diagnoses the absolute
  isolated CODEX_HOME config, preserving the seeded UV cache. User-skill absence
  checks require all four candidate-bound skill directory grants, excluding only
  the native CODEX_HOME/skills/.system tree; missing evidence stays unavailable.
  These two cases declare `harnesses: [codex]` because those actual-state grants
  are Codex-specific. They do not establish native Claude user-state coverage.
- Express and Requests socket corpus cases select
  `evals/sevro-extension/runtime-local-http.json`. Local HTTP access
  remains an explicit per-run opt-in; retain the original tests and assertions.
- Review artifact cases select `evals/sevro-extension/runtime-review-artifacts.json`
  explicitly. Current code-review and real-provider composition cases declare
  `required_plugin_hook: darrow-review`; the profile allowlists that plugin's
  hooks. Codex installs the complete package even for implicit requests, without
  inserting a skill token. Require a successful public hook execution receipt
  and check reminder delivery in the native candidate context before launching
  a threshold run. Hook execution and skill activation remain separate, and
  negative selection cases retain the same installed hook. Preserve earlier
  hook-disabled cohorts. The retired standalone TDD hook and its runtime profile
  are not prerequisites for the selected Matt TDD workflow.
  Graders read the original candidate
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
- Shell check declarations run under `/bin/sh`; use portable syntax or invoke
  an explicitly required shell. macOS `/bin/sh` accepting Bash syntax does not
  establish Ubuntu compatibility.
- Graders use declared host tools or portable system commands. Tools injected
  from a Codex credential directory are removed from the inherited runtime
  `PATH` and must not become an undeclared grading dependency.
  Review's independent route oracle uses only the Python standard library and
  runs directly with `python3`; it does not bootstrap the Review runtime.
  Canonical result validation still uses the owning frozen backend.
- Keep fixture skills inert in source with a non-discoverable template filename.
  Materialize the native SKILL.md entrypoint only inside the isolated eval
  repository during setup.
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
- Apply [evidence interpretation](#evidence-interpretation) to dispatch,
  implicit activation and partial collections. Keep exposure, primary selection,
  supporting membership, order, collection health and task outcomes separate.
- Claude's `skill_tool_result` counts successful structured Skill calls. Direct
  reads and native command expansion do not add supporting skill membership.
  Explicit command expansion can separately establish primary activation only
  under the conditions in evidence interpretation.
- Keep repository skill names unqualified and normalize only mounted plugin
  namespaces. Another plugin's same-named skill cannot substitute.

- Recipe composition evidence must positively establish the accepted agent and
  the bound supporting capability. Absence of a prohibited action alone cannot
  prove a handoff. Codex native acceptance correlates one spawn, host start and
  accepted result; missing, duplicate, malformed or mismatched evidence stays
  unaccepted. When the host encrypts the launch message, the receipt leaves the
  agent's role unverified. Combine it with supporting capability activation,
  observed outcomes for composition
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
  the boundary, fixture acknowledgement and effects, and any declared accepted-child facts.
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

Each attempt retains ownership, lifecycle status, and absolute per-trial paths
in `evals/results/attempts/<attempt>/run.json`. Complete bounded `CaseResult`
artifacts, including the configured trial count, persist before fixture cleanup
and completion feedback. The normal result array is published atomically only
after the entire run finishes.

On error or interruption, inspect the printed diagnostic and evidence paths.
Forward `--retain-host-diagnostics` after `--` to
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
attempt. Ownership storage and lock mechanics belong to the public runner;
do not infer a live process from an ownership record alone.

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

Use Sevro's public report command for current retained results:

```sh
bunx --no-install sevro report --json --result-file /absolute/path/to/sevro-result.json
```

The [caller reference](../evals/sevro-extension/README.md#result-reporting) owns
the separate Darrow reports.

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
That mirror may be a directory or a symlink to the matching canonical skill
inside the project. Links to another skill or outside the project are refused.
Explicit tokens are `$<name>` and `/<name>`. Mirrors are not scanned twice.
`--skill-dir` overrides the candidate after selecting ownership;
`--without-skill` preserves the cases as an unmounted control.

Repository cases cannot request `source_plugin` or `mount_plugin_skills`.
Optional supporting capabilities use `additional_skills` or independent
`additional_plugins`. The same isolation and hidden-check boundaries apply.
Coverage includes canonical repository cases by default.

The guide's versioned inventory lives beside its cases. Run
`bun evals/repository-guide.ts` for sequential cross-host, single-trial
evaluation that stops at the first failure. Inspect each failure before
continuing. Fixtures exclude inventory, hidden checks, and delivery conclusions.

The [guide caller reference](../evals/sevro-extension/README.md#repository-guide-caller)
owns selectors, controls, host options, grading routes, and retained outputs.
Use the exact installed dependency unless an explicit `SEVRO_CHECKOUT` or
`SEVRO_PACKAGE_BIN` override is part of the intended condition.

## Live-run controls

Use `--codex-entrypoint app-server` for Codex native main-thread goal trials
with `--owner-evaluation passive`. Sevro hosts the original participant thread,
observes its native continuation, and waits for the terminal response. It never
supplies synthetic continuation prompts or changes the participant's goal.
Only a declared follow-up starts another client-requested turn. Requested
transport contributes to run identity and the host retains its actual transport.
Historical separate-owner guards remain historical architecture measurements.

Direct evaluations and suite modes default to passive observation. Bundled Sevro
hosts reject an explicit enforced request without silently changing its condition.
Passive trials retain fixture and credential isolation. Results distinguish the
requested condition from the observed condition. Dry runs establish preparation
only.

Before changing caller selection, mounting, or route handling, read `evals/sevro-extension/README.md`.
The [caller reference](../evals/sevro-extension/README.md) owns plugin/skill
selectors, case filters, skill overrides, independent role routes, and
`--assert-effective-owner-routes`.

For a frozen plugin copy passed through `--skill-dir`, preserve the owning
plugin directory name: `<snapshot>/<plugin-name>/skills/<skill-name>`. The
current prompt renderer derives the Codex invocation namespace from the source
plugin path or that directory name, while installation uses the manifest name.
Verify that the rendered `$<plugin-name>:<skill-name>` token matches the
installed manifest before a live run. A copy renamed `candidate` or `plugin`
can produce a mismatched invocation; retain such runs separately from valid
explicit-invocation evidence.

Current role defaults live in `evals/sevro-extension/model-defaults.ts`.
Keep candidate, semantic-grader, and advisory-grader routes independent;
retain each role's resolved model and effort in comparison evidence.

Use `--no-color`, `--no-emoji`, or `--no-progress` to disable terminal features
independently. `NO_COLOR` also disables color; redirected output stays stable
and unanimated. Every completed run prints the absolute raw-result path.
Use `--jobs <positive integer>` to bound simultaneous trials within a case
(default three); `--jobs 1` gives serial diagnosis. Parallel runs use per-trial
status lines instead of one active-trial animation.

Only `agents.max_concurrent_threads_per_session` from the selected repository's
`.codex/config.toml` is imported into isolated Codex configuration. Other project
and user settings remain excluded. Capture the limit once per process and
retain it in role identity and results as `codexAgentConcurrencyLimit`.
Missing configuration and null use the host default; absent historical evidence
stays unknown. This limits subagents within one trial; `--jobs` controls trials.
Unreadable config, invalid TOML, or a nonpositive or noninteger limit fails explicitly.

## Installed Sevro verification

Use the exact installed Sevro dependency and runtime prerequisites documented in
the [test ownership guide](../evals/README.md) and repository manifests.
Python fixture tools use a UV-managed Python
3.13 copy so both UV entrypoints and direct Python oracles use the same isolated
runtime. System and framework installations may depend on paths outside their
copied directory.

On disposable Linux CI, `bash scripts/setup-sevro-linux` installs and probes
native prerequisites and isolation; it requires sudo. Its implementation owns
the tool and path inventory. Native caller, corpus-protection, and plugin
installation fixtures also run on macOS. Missing prerequisites on a supported
host must fail rather than skip native checks. These deterministic fixtures
do not establish authenticated model success.

Set a local fixture Git identity before preparing oracle repositories so commit
checks do not depend on the runner's account or hostname.

```sh
bun install --frozen-lockfile
uv python install 3.13
env -u SEVRO_CHECKOUT -u SEVRO_PACKAGE_BIN bun run test:evals
```

The command exercises the installed public CLI, extension protocol, Darrow
callers, and domain oracles. Keep mutable state private to each case and reuse
only unchanged prepared packages within a file. Shared runtime preparation
must work from a fresh home without depending on another test file.

For serial diagnosis, invoke
`bun test --timeout 30000 ./evals/integration ./evals/domain` directly.
Tests use controlled native tools and credentials. Claude fixtures keep a
synthetic saved OAuth login in the parent and pass only its access token to the trial.
Generic engine and host tests belong to Sevro; do not copy the retired runner
or import private implementation or types.

Size explicit test timeouts for frozen backend startup and isolated fixtures.
Pass explicit `./evals/...` directory paths to Bun: bare paths are substring
filters and can scan retained fixture trees outside the intended scope.

The [test ownership guide](../evals/README.md) separates installed integration
from Darrow policy.

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
integration and policy groups with its checkout override
cleared. Default-caller checks also verify Darrow's own frozen pin with both
overrides cleared. An explicit checkout retains its revision and patch identity;
it is development evidence. Upgrade and rollback instructions are in the
[development and release guide](../evals/sevro-extension/migration.md).

Normal callers use the frozen installed pin. An override is candidate or
development evidence; preserve its revision and patch identity and keep it
separate from the default-pin checks. The [caller contracts](../evals/sevro-extension/README.md)
own selection manifests, reports, user-supplied annotations, and unknowns.

## Iterative development

- Use one trial per invocation while diagnosing:

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
- Keep activation, task outcome, workflow diagnostics and matched ablation
  separate; one does not substitute for another.
