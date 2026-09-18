# Eval Development Guidance

This scoped guidance applies when creating, changing, diagnosing, or running
Darrow evals. The normative evidence model remains at the repository-root path
`docs/specs/skill-evaluation.md`; this file owns the repository-specific
constraints for producing and interpreting that evidence.

## Case contracts

- Give every skill colocated eval cases that verify its public behavior and
  intent boundaries. Test deterministic scripts separately when present.
- Start with the exact normative invariant or public promise under test. An
  assertion must not require stronger behavior, removed design, fixed counts,
  lifecycle markers, exact vocabulary, or serialization that the contract does
  not require.
- Prefer observable repository state, external effects, and user-visible
  outcomes over prose. When free-form text is the only public seam, assert the
  smallest semantic decision rather than parsing a complete explanation.
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
- Keep authoritative fixture input and its executable acceptance oracle aligned,
  including whether representation details such as trailing newlines matter.
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
  requires a completed mounted-skill body read. Do not use the explicit path to
  make implicit selection pass.
- Missing, repeated, malformed, or unverified observation evidence stays
  unknown. A failed compound shell command may still prove an earlier skill
  read only when the command names a mounted skill path and its output contains
  that mounted skill's frontmatter; a later clause's failure does not erase the
  completed read. Retain the source, primary skill, and ordered observed skills
  separately from the task outcome.
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
  Claude's reduced Skill events also retain a bounded exact invocation identifier
  separately from the normalized activation name. This distinguishes namespaced
  plugin dispatch from a same-named command without retaining skill arguments;
  an invocation identifier alone does not prove provider execution or compliance.
  Adaptive-delivery observations recover deeper Skill dispatch from the native
  session's completed Agent result graph when the outer stream omits it. Recovery
  binds session and child identities, preserves chronological skill order and
  retains only invocation metadata. Missing or inconsistent graph evidence
  leaves activation incomplete; unrelated transcript files are never evidence.
- Explicit Codex probes retain the invoked owner first, then verified supporting
  reads. Every supporting read must contain the complete mounted body, including
  the first supporting read. Consecutive pages from the same actor may establish
  that complete body when their accumulated output contains it exactly. The raw
  read probes and activation summary use the same completeness requirement.
  Overlapping exact source pages from that same actor also establish the read
  when their coverage includes the whole body; repeated pages cannot fill a
  gap, and altered or ambiguously located fragments do not prove coverage.
  For compound output, locate unique source anchors and extend only through
  byte-for-byte matching text; unrelated output contributes no source coverage.
  If the native session recovers a complete read missing from CLI output,
  recompute read completeness from that recovered evidence. Never retain a
  stale incomplete flag, and never let read recovery repair failed or ambiguous
  explicit dispatch. A partial read visible only natively remains incomplete.
  Insert recovered reads according to shared ordering anchors rather than
  appending an earlier skill after later ones. Conflicting source orders remain
  incomplete instead of silently selecting one sequence.
  Claude's explicit plugin commands may be expanded before the first assistant
  turn without a Skill event. The observer accepts only a native command bound
  to the mounted plugin namespace, exact arguments, and session, followed by
  the complete mounted body in that same session. This proves dispatch without
  requiring a redundant model-side Skill call; implicit discovery still needs
  its observed invocation.
  Do not infer cross-child read order from launch-list order: multiple children
  contributing unanchored new reads keep the observation incomplete.
  Truncated evidence cannot establish an exclusion;
  the observation stays unknown until a complete read verifies that skill.

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
The guide driver pins semantic grading to Codex `gpt-5.6-terra` / medium;
the shared runner's default lightweight grader remains unchanged. The route
was calibrated against retained correct and reversed-delegation diagrams.

## Live-run controls

Use `--owner-evaluation passive` for native trials of the shipped adaptive-delivery
skill. It omits the Codex spawn/parent guard (including its `fork_turns` rewrite)
and Claude's adaptive-delivery-specific scheduler exclusion. The default
`--owner-evaluation enforced` preserves the historical diagnostic condition.
Neither mode removes ordinary fixture/credential isolation. Suite modes can
set `owner_evaluation: passive|enforced` independently. Results retain requested
mode on the case and actual assistance on each harness result; historical
absence stays unknown. A dry run is not an observed passive trial.

The enforced Codex guard still consumes its strict structured contract
template. It may reject valid presentation variants allowed by the shipped
skill. Treat those as enforcement-profile results, never native product
failures. Passive native session evidence proves correlated acceptance and
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

Codex runs use independent defaults for each eval role:

- candidate: `gpt-5.6-terra` at `medium` effort;
- advisory quality judge: `gpt-5.6-sol` at `low` effort;
- gating semantic-output grader: `gpt-5.6-luna` at `low` effort.

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
  `plugins/orchestration/darrow-adaptive-delivery/skills/adaptive-delivery/evals/`.
- Keep activation, task outcome, invariant coverage, and matched ablation as
  separate evidence dimensions; one does not substitute for another.
