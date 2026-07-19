# Product-value evaluation

Defines the controlled product experiment that gates full OpenTelemetry work
and M3 investment. The preregistration and executable configuration live under
`evals/product-value/`.

## Gate and treatments

- **PV-1 — Mandatory product gate.** After the current workflow runtime work and
  before full OpenTelemetry integration or M3, one frozen confirmatory analysis
  produces exactly one decision: `continue`, `narrow`, `redesign`, or `stop`.
- **PV-2 — Three controlled treatments.** For each harness, the experiment
  compares (a) the native harness with no Darrow plugins, (b) the native harness
  with the same Darrow plugins mounted directly, and (c) those plugins invoked
  through the Darrow CLI. Native versus direct estimates plugin value; direct
  versus CLI estimates incremental orchestration value.
- **PV-3 — Common harness routes.** Within one harness block, model, effort,
  executable, permission policy, environment allowlist, requested change, and
  minimal Red/Green delivery policy are fixed across treatments. Direct native
  and plugin cells receive the policy in their task prompt; the CLI cell
  receives the identical policy once through the invoked implementation skill.
  Harness state and workspaces are isolated per run.
  The evaluator applies one treatment-independent native launcher policy,
  including the same available-tool set, to direct and CLI invocations.
  Repository setup completes before measured agent execution, and every
  treatment operates in that same prepared disposable checkout. The CLI
  treatment explicitly attaches the checkout instead of allocating a second
  worktree that would omit ignored setup outputs such as installed dependencies.
  Versions and configuration digests are recorded. The evaluator owns the
  single operating-system sandbox boundary: it denies writes outside the
  disposable run root and hides source and evaluator inputs. A harness may
  disable its nested sandbox only inside that boundary. When a bounded
  invocation ends or times out, the evaluator terminates its attached
  descendants and any evaluator-started Darrow worker or Temporal service
  recorded in that disposable workspace; diagnostic state remains retained.

## Corpus integrity

- **PV-4 — Real, pinned source.** Tasks come from pinned revisions of `mynab`
  and `credfolio2`. A task names a base revision and an oracle revision, and the
  runner verifies their parent relationship before use.
- **PV-5 — History-free sanitized copies.** Each run is prepared from a Git
  archive, initialized as a new repository without remotes, and stripped of
  agent instructions, agent state, installed skills, model configuration,
  issue-agent state, demos, and local secret files. The sanitizer emits a
  manifest and refuses residual prohibited paths or escaping symlinks.
- **PV-6 — Hidden verification.** Oracle test files are read from the pinned
  source only after agent execution. Before deterministic verification, the
  runner restores base tests and test-runner manifests, then overwrites
  same-named participant tests with the oracle versions. The trial workspace
  contains neither source history nor evaluator criteria during execution.
- **PV-7 — Strata and holdout.** Both repositories contribute simple overhead
  controls and representative multi-step changes. Pilot tasks calibrate the
  procedure. Confirmatory holdout tasks cannot be used to change hypotheses,
  thresholds, rubrics, exclusions, or analysis code.

## Assignment and inference

- **PV-8 — Paired counterbalanced trials.** Every included task is evaluated in
  all three treatments for both Claude Code and Codex. A frozen seed assigns a
  balanced treatment order within task, harness, and repeat blocks. Interrupted
  blocks resume from durable records instead of being silently replaced.
- **PV-9 — Tasks generalize.** Repeats are measurement replicates, not
  independent evidence. Primary estimates average repeats within task and
  harness, then use distinct tasks as the resampling and randomization unit.
- **PV-10 — Powered confirmatory sample.** The preregistration records the
  minimum practically meaningful effect, assumed paired task-level variance,
  alpha, power, fixed distinct-task sample, and operational stopping rules.
  Subgroup results are descriptive unless separately powered.
- **PV-11 — Effect reporting.** Results include paired effect sizes,
  task-bootstrap confidence intervals, task-level randomization p-values, and
  raw distributions. Statistical confidence is reported separately from the
  preregistered practical and economic thresholds.

## Outcomes and grading

- **PV-12 — Complete measurement.** Each trial records verified quality, input
  and output tokens, provider-reported cost, wall time, human-attention minutes,
  interventions, failures, retries, recovery, rework, run-to-run variance, and
  setup or operational failure categories. Missing values remain explicit.
  Preflight performs minimal real inference and exercises pinned-runtime access
  through the same isolated environment used by trials, refusing before the
  phase if either is unavailable. Headless Claude evaluation uses a dedicated
  setup token or API key; disposable copies of rotating login credentials are
  forbidden.
- **PV-13 — Outcome-first grading.** Deterministic hidden checks supply the
  primary quality evidence wherever possible. Qualitative grading uses a frozen
  rubric, opaque sample IDs, randomized presentation, and graders blinded to
  treatment. Calibration examples are separate from the holdout. The evaluator
  retains deterministic verifier output after agent execution and records a
  typed failure category so runtime mismatch, missing dependency, timeout, and
  behavioral test failure are distinguishable.
- **PV-14 — Lightweight instrumentation.** The experiment writes append-only
  JSON Lines observations, sanitization manifests, harness output, patches, and
  Darrow run references. Before a disposable CLI workspace is removed, the
  evaluator also writes a compact trace summary containing runtime/model spans,
  model event counts, token accounting, plus command counts grouped into fixed
  non-content categories and nonzero status counts. Trace schema `1.2.0` retains
  TDD phase timestamps and inter-phase latency only for legacy treatments that
  emit them; portable instruction-only treatments leave `phases` empty and
  `timeline` null rather than fabricating phase attribution. It retains no tool
  commands, model text, paths, or tool output. It does not require or introduce
  full OpenTelemetry.

## Decision

- **PV-15 — Preregistered decision rule.** The frozen protocol defines quality
  non-inferiority, useful quality or human-attention effects, cost and wall-time
  ceilings, operational reliability, and the mapping to `continue`, `narrow`,
  `redesign`, or `stop`. The report applies that rule mechanically before adding
  interpretation.
- **PV-16 — Reproducible report.** The final report identifies source, runner,
  harness, model, configuration, and plugin revisions and reports all three
  treatments overall, by harness, repository, and task stratum. Exclusions and
  deviations are listed with reasons.

## Operational qualification

- **PV-17 — Bounded operational qualification.** Before pilot calibration, the
  evaluator runs exactly one pilot task once in all six harness/treatment cells
  at medium reasoning with a 15-minute per-observation deadline. Smoke results
  qualify evaluator isolation, authentication, routing, artifact capture, and
  resource assumptions only; they are stored under a distinct phase and are
  excluded from pilot calibration and confirmatory inference. The pilot uses
  one repeat per cell initially and proceeds only after operators inspect smoke
  completion, time, token, and cost measurements.
- **PV-18 — No-policy diagnostic.** The evaluator may run one Codex-only
  auxiliary pair on the smoke task: `native-no-tdd` and `plugins-no-tdd`. These
  evaluator-only labels omit the shared Red/Green policy while retaining the
  corresponding direct harness and plugin setup. Fresh core `native` and
  `plugins` cells run beside them. The auxiliary cells remain outside the
  three-treatment schedule and all product inference. Their purpose is to
  estimate the cost of the shared delivery policy before pilot work. A failed
  auxiliary cell is not a valid overhead baseline.
