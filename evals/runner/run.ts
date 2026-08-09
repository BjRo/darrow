import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parse as parseYaml } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import { resolveCorpusSource } from "./corpus";
import { runQualityJudge } from "./judge";
import { runChecks, runOutputChecks } from "./checks";
import { claudeAdapter } from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { codexGoalAdapter } from "./adapters/codex-goal";
import {
  extractOrchestrationMetrics,
  hasUnreconciledOrchestrationUsage,
  observeCodexGoalRouteApplication,
  observeCodexTicketPipelineRoutes,
  reconcileObservedGoalRouteApplication,
  reconcileObservedTicketPipelineRoutes,
} from "./orchestration-metrics";
import type {
  CaseResult,
  CheckResult,
  EvalCase,
  GoalRouteApplication,
  HarnessAdapter,
  HarnessResult,
  TrialResult,
} from "./types";

interface GoalRouteExpectation {
  model: string;
  effort: string;
}

interface GoalDimensionsExpectation {
  profile: string;
  workflow: string;
  risk: "routine" | "elevated" | "high";
}

interface JudgeConfig {
  adapter: HarnessAdapter;
  model: string;
  effort: string;
}

interface RunCaseOptions {
  evalCase: EvalCase;
  adapter: HarnessAdapter;
  model: string;
  effort: string;
  trials: number;
  dry: boolean;
  condition?: { label: string; text: string };
  withoutSkill?: boolean;
  humanReviewMinutes?: number;
  requireEvaluationRecords?: boolean;
  judge?: JudgeConfig;
  /** Route the harness is told to apply. */
  expectedGoalRoute?: GoalRouteExpectation;
  /** Route the case asserts the harness actually applied. */
  assertedGoalRoute?: GoalRouteExpectation;
  assertedGoalDimensions?: GoalDimensionsExpectation;
}

/** One trial's inputs, shared by the check builder and the trial evaluator. */
interface TrialContext {
  trial: number;
  repoDir: string;
  baseRevision: string;
  harness: HarnessResult;
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function isRouteRecord(value: unknown): value is GoalRouteExpectation {
  if (!value || typeof value !== "object") return false;
  const route = value as Record<string, unknown>;
  return typeof route.model === "string" && typeof route.effort === "string";
}

function isNonEmptyRouteRecord(value: unknown): boolean {
  return isRouteRecord(value) && !!value.model && !!value.effort;
}

const ADAPTERS: Record<string, HarnessAdapter> = {
  claude: claudeAdapter,
  codex: codexAdapter,
};

const ROOT = resolve(import.meta.dir, "..", "..");
const RESULTS_ROOT = join(ROOT, "evals", "results");
const DEFAULT_CORPUS_MANIFEST = join(
  ROOT,
  "evals",
  "corpus",
  "orchestration",
  "manifest.yaml",
);

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ??
    0
  );
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

async function repositoryHead(repoDir: string): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
    cwd: repoDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`cannot read fixture HEAD: ${stderr.trim()}`);
  return stdout.trim();
}

/** Cases live next to the skill they test (plugins/<name>/skills/<skill>/evals/*.yaml)
 *  or in skill-less experiments (evals/experiments/<name>/cases/*.yaml). */
async function scanCases(
  pattern: string,
  skillDirOf: (casePath: string) => string,
): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  for await (const rel of new Bun.Glob(pattern).scan(ROOT)) {
    const path = join(ROOT, rel);
    const evalCase: EvalCase = parseYaml(await readFile(path, "utf8"));
    evalCase.skillDir = skillDirOf(path);
    evalCase.caseDir = dirname(path);
    cases.push(evalCase);
  }
  return cases;
}

/** Point every `fixture.source` case at its prepared corpus checkout. */
async function resolveCorpusFixtures(
  cases: EvalCase[],
  corpusManifest: string,
): Promise<void> {
  for (const evalCase of cases) {
    if (!evalCase.fixture.source) continue;
    if (evalCase.fixture.repo || evalCase.fixture.commits?.length) {
      throw new Error(
        `${evalCase.id}: fixture.source, repo, and commits are mutually exclusive`,
      );
    }
    evalCase.fixture.repo = (
      await resolveCorpusSource(evalCase.fixture.source, corpusManifest)
    ).path;
  }
}

async function loadCases(
  filter?: string[],
  corpusManifest = DEFAULT_CORPUS_MANIFEST,
): Promise<EvalCase[]> {
  const cases = [
    ...(await scanCases("plugins/*/skills/*/evals/*.yaml", (path) =>
      dirname(dirname(path)),
    )),
    // Skill-less experiments mount nothing.
    ...(await scanCases("evals/experiments/*/cases/*.yaml", () => "")),
  ];
  cases.sort((a, b) => a.id.localeCompare(b.id));
  const selected = filter?.length
    ? cases.filter((c) => filter.some((value) => c.id.includes(value)))
    : cases;
  await resolveCorpusFixtures(selected, corpusManifest);
  return selected;
}

function trialPrompt(options: RunCaseOptions, repoDir: string): string {
  const { evalCase, adapter, model, effort, condition } = options;
  const template = condition?.text.trim()
    ? `${condition.text.trim()}\n\n${evalCase.prompt}`
    : evalCase.prompt;
  return template
    .replaceAll("{{repo_dir}}", repoDir)
    .replaceAll("{{harness}}", adapter.name)
    .replaceAll("{{model}}", model)
    .replaceAll("{{effort}}", effort);
}

function goalRouteControl(
  expectedGoalRoute: GoalRouteExpectation | undefined,
): Parameters<HarnessAdapter["run"]>[4] {
  if (!expectedGoalRoute) return undefined;
  return {
    expectedGoalRoute: {
      harness: "codex",
      provider: "openai",
      model: expectedGoalRoute.model,
      effort: expectedGoalRoute.effort,
    },
  };
}

function dryTrialResult(trial: number, checks: CheckResult[]): TrialResult {
  return {
    trial,
    passed: false,
    checks,
    harness: {
      ok: true,
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      resultText: "",
      raw: "",
    },
  };
}

function goalRouteAssertionCheck(
  observed: GoalRouteApplication | undefined,
  asserted: GoalRouteExpectation,
): CheckResult {
  return {
    name: "hidden goal route selection matches expectation",
    passed:
      observed?.selected.model === asserted.model &&
      observed.selected.effort === asserted.effort &&
      observed.effective.model === asserted.model &&
      observed.effective.effort === asserted.effort,
    detail: `expected selected and effective ${asserted.model}/${asserted.effort}`,
  };
}

function goalDimensionsAssertionCheck(
  observed: GoalRouteApplication | undefined,
  asserted: GoalDimensionsExpectation,
): CheckResult {
  return {
    name: "hidden goal dimensions match expectation",
    passed:
      observed?.profile === asserted.profile &&
      observed.workflow === asserted.workflow &&
      observed.risk === asserted.risk,
    detail: `expected ${asserted.workflow}/${asserted.risk}/${asserted.profile}`,
  };
}

/** Checks derived purely from the transcript: what the harness reported about
 * its own routing, versus what this run asked for and the case asserts. */
function routeChecks(
  options: RunCaseOptions,
  harness: HarnessResult,
  observed: GoalRouteApplication | undefined,
): CheckResult[] {
  const {
    evalCase,
    adapter,
    model,
    effort,
    requireEvaluationRecords = false,
    assertedGoalRoute,
    assertedGoalDimensions,
  } = options;
  const observedGoalRouteCheck =
    adapter.name === "codex"
      ? reconcileObservedGoalRouteApplication(harness.resultText, harness.raw, {
          harness: adapter.name,
          model,
          effort,
        })
      : undefined;
  const observedTicketPipelineCheck = reconcileObservedTicketPipelineRoutes(
    harness.resultText,
    harness.raw,
  );
  return [
    ...(observedTicketPipelineCheck ? [observedTicketPipelineCheck] : []),
    ...(observedGoalRouteCheck ? [observedGoalRouteCheck] : []),
    ...(assertedGoalRoute
      ? [goalRouteAssertionCheck(observed, assertedGoalRoute)]
      : []),
    ...(assertedGoalDimensions
      ? [goalDimensionsAssertionCheck(observed, assertedGoalDimensions)]
      : []),
    ...(requireEvaluationRecords
      ? evaluationRecordChecks(
          harness.resultText,
          evalCase.skillDir.endsWith("/adaptive-goal"),
        )
      : []),
  ];
}

async function trialChecks(
  options: RunCaseOptions,
  context: TrialContext,
  observedGoalRouteApplication: GoalRouteApplication | undefined,
): Promise<CheckResult[]> {
  const { evalCase, withoutSkill = false } = options;
  const { repoDir, baseRevision, harness } = context;
  return [
    ...(await runChecks(repoDir, evalCase.checks)),
    {
      name: "base revision remains unchanged",
      passed: (await repositoryHead(repoDir)) === baseRevision,
      detail: "candidate created or switched to a different commit",
    },
    // A no-skill baseline is judged on the same repository outcomes, not
    // on the orchestration-specific reporting contract it cannot know about.
    ...(withoutSkill
      ? []
      : await runOutputChecks(
          harness.resultText,
          evalCase.output_checks ?? [],
          evalCase.skillDir,
        )),
    ...routeChecks(options, harness, observedGoalRouteApplication),
  ];
}

async function evaluateTrial(
  options: RunCaseOptions,
  context: TrialContext,
): Promise<TrialResult> {
  const { evalCase, adapter, judge } = options;
  const { harness, repoDir } = context;
  const observedGoalRouteApplication =
    adapter.name === "codex"
      ? observeCodexGoalRouteApplication(harness.resultText, harness.raw)
      : undefined;
  const observedTicketPipelineRoutes =
    /^format\tdarrow-ticket-pipeline-result-v1$/m.test(harness.resultText)
      ? observeCodexTicketPipelineRoutes(harness.raw)
      : undefined;
  const checks = await trialChecks(
    options,
    context,
    observedGoalRouteApplication,
  );
  return {
    trial: context.trial,
    passed: harness.ok && checks.every((c) => c.passed),
    checks,
    harness,
    routeApplication: observedGoalRouteApplication,
    orchestrationMetrics: extractOrchestrationMetrics(
      harness.resultText,
      checks,
      observedGoalRouteApplication?.childInvocationCount ??
        observedTicketPipelineRoutes?.length,
    ),
    judge: judge
      ? await runQualityJudge({
          adapter: judge.adapter,
          repoDir,
          task: evalCase.prompt,
          checks,
          model: judge.model,
          effort: judge.effort,
        })
      : undefined,
  };
}

function reportTrial(options: RunCaseOptions, result: TrialResult): void {
  const { evalCase, trials } = options;
  const { harness } = result;
  const failed = result.checks.filter((c) => !c.passed);
  console.log(
    `  ${result.passed ? "PASS" : "FAIL"} ${evalCase.id} trial ${result.trial}/${trials} ` +
      `(${(harness.durationMs / 1000).toFixed(1)}s, ${harness.inputTokens + harness.outputTokens} tok)` +
      (failed.length ? ` — ${failed.map((c) => c.name).join(", ")}` : ""),
  );
  for (const c of failed) console.log(`      ${c.name}: ${c.detail}`);
  const judgeResult = result.judge;
  if (judgeResult) {
    console.log(
      `      judge: ${judgeResult.assessment ? `${judgeResult.assessment.verdict} ${judgeResult.assessment.overallScore}/5` : `invalid (${judgeResult.parseError})`}`,
    );
  }
}

async function runTrial(
  options: RunCaseOptions,
  trial: number,
): Promise<TrialResult> {
  const {
    evalCase,
    adapter,
    model,
    effort,
    dry,
    withoutSkill = false,
  } = options;
  const repoDir = await buildFixture({
    fixture: evalCase.fixture,
    skillDir: withoutSkill ? "" : evalCase.skillDir,
    skillMounts: adapter.skillMounts,
    mountPluginSkills: evalCase.mount_plugin_skills ?? false,
    caseDir: evalCase.caseDir,
  });
  try {
    const baseRevision = await repositoryHead(repoDir);
    const prompt = trialPrompt(options, repoDir);
    if (dry) {
      console.log(
        `  [dry] ${evalCase.id} trial ${trial}: fixture at ${repoDir}`,
      );
      return dryTrialResult(trial, await runChecks(repoDir, evalCase.checks));
    }
    const harness: HarnessResult = await adapter.run(
      repoDir,
      prompt,
      model,
      effort,
      goalRouteControl(options.expectedGoalRoute),
    );
    const result = await evaluateTrial(options, {
      trial,
      repoDir,
      baseRevision,
      harness,
    });
    reportTrial(options, result);
    return result;
  } finally {
    await destroyFixture(repoDir);
  }
}

/** Total tokens for one trial, or null when orchestration usage is unaccounted. */
function trialTokenTotal(
  trial: TrialResult,
  harnessName: string,
): number | null {
  const routeApplication = trial.routeApplication;
  if (
    hasUnreconciledOrchestrationUsage(trial.harness.resultText, harnessName) &&
    routeApplication?.launchBoundary !== "nested_session"
  )
    return null;
  return (
    trial.harness.inputTokens +
    trial.harness.outputTokens +
    (routeApplication?.childInputTokens ?? 0) +
    (routeApplication?.childOutputTokens ?? 0)
  );
}

function totalCostUsd(
  trialResults: TrialResult[],
  harnessName: string,
): number | null {
  const accounted = trialResults.every(
    (trial) =>
      trial.harness.costUsd !== null &&
      !hasUnreconciledOrchestrationUsage(trial.harness.resultText, harnessName),
  );
  if (!accounted) return null;
  return trialResults.reduce(
    (total, trial) => total + (trial.harness.costUsd ?? 0),
    0,
  );
}

function phaseAverages(
  trialResults: TrialResult[],
): Pick<
  CaseResult,
  | "meanPreparationDurationMs"
  | "meanClassifierDurationMs"
  | "meanClassifierTokens"
  | "meanClassifierModelCalls"
  | "meanExecutionDurationMs"
  | "meanExecutionTokens"
> {
  const phaseMetrics = trialResults
    .map((trial) => trial.harness.phaseMetrics)
    .filter(defined);
  const preparation = phaseMetrics.map((m) => m.preparation).filter(defined);
  const classifier = phaseMetrics.map((m) => m.classifier).filter(defined);
  const execution = phaseMetrics.map((m) => m.execution).filter(defined);
  const meanOf = <T>(
    phases: T[],
    pick: (phase: T) => number,
  ): number | undefined => (phases.length ? mean(phases.map(pick)) : undefined);
  return {
    meanPreparationDurationMs: meanOf(preparation, (p) => p.durationMs),
    meanClassifierDurationMs: meanOf(classifier, (p) => p.durationMs),
    meanClassifierTokens: meanOf(
      classifier,
      (p) => p.inputTokens + p.outputTokens,
    ),
    meanClassifierModelCalls: meanOf(classifier, (p) => p.modelCalls),
    meanExecutionDurationMs: meanOf(execution, (p) => p.durationMs),
    meanExecutionTokens: meanOf(
      execution,
      (p) => p.inputTokens + p.outputTokens,
    ),
  };
}

/** Where the reported child-invocation count came from: the condition's own
 * report, the harness transcript, or the controller's result record. */
function childInvocationCountSource(
  options: RunCaseOptions,
  trialResults: TrialResult[],
): CaseResult["childInvocationCountSource"] {
  const { withoutSkill = false, evalCase } = options;
  const reportedByCondition =
    withoutSkill ||
    !evalCase.skillDir ||
    trialResults.some((trial) =>
      /^format\tdarrow-native-goal-preflight-v1$/m.test(
        trial.harness.resultText,
      ),
    );
  if (reportedByCondition) return "condition_report";
  if (trialResults.some((trial) => trial.routeApplication !== undefined))
    return "harness_observed";
  const observedPipeline = trialResults.some(
    (trial) =>
      /^format\tdarrow-ticket-pipeline-result-v1$/m.test(
        trial.harness.resultText,
      ) && observeCodexTicketPipelineRoutes(trial.harness.raw) !== undefined,
  );
  return observedPipeline ? "harness_observed" : "controller_result";
}

function orchestrationSummary(
  options: RunCaseOptions,
  trialResults: TrialResult[],
): Pick<
  CaseResult,
  | "meanChildInvocationCount"
  | "childInvocationCountSource"
  | "totalHumanInterruptions"
  | "escapedDefects"
  | "falsePositiveVerifierFindings"
> {
  const measured = trialResults
    .map((trial) => trial.orchestrationMetrics)
    .filter(defined);
  if (!measured.length) return {};
  const total = (pick: (metric: (typeof measured)[number]) => number): number =>
    measured.reduce((sum, metric) => sum + pick(metric), 0);
  return {
    meanChildInvocationCount: mean(
      measured.map((metric) => metric.childInvocationCount),
    ),
    childInvocationCountSource: childInvocationCountSource(
      options,
      trialResults,
    ),
    totalHumanInterruptions: total((metric) => metric.humanInterruptions),
    escapedDefects: total((metric) => metric.escapedDefects),
    falsePositiveVerifierFindings: total(
      (metric) => metric.falsePositiveVerifierFindings,
    ),
  };
}

function judgeSummary(
  trialResults: TrialResult[],
): Pick<CaseResult, "meanJudgeScore" | "judgePassRate"> {
  const assessments = trialResults
    .map((trial) => (trial.judge?.ok ? trial.judge.assessment : undefined))
    .filter(defined);
  if (!assessments.length) return {};
  return {
    meanJudgeScore: mean(
      assessments.map((assessment) => assessment.overallScore),
    ),
    judgePassRate:
      assessments.filter((assessment) => assessment.verdict === "pass").length /
      assessments.length,
  };
}

function summarizeCase(
  options: RunCaseOptions,
  trialResults: TrialResult[],
): CaseResult {
  const {
    evalCase,
    adapter,
    model,
    effort,
    condition,
    dry,
    humanReviewMinutes,
  } = options;
  const durations = trialResults.map((t) => t.harness.durationMs);
  const tokenTotals = trialResults.map((trial) =>
    trialTokenTotal(trial, adapter.name),
  );
  return {
    caseId: evalCase.id,
    invariant: evalCase.invariant,
    harness: adapter.name,
    model,
    effort,
    condition: condition?.label,
    trials: trialResults,
    passRate:
      trialResults.filter((t) => t.passed).length /
      Math.max(1, trialResults.length),
    meanDurationMs: mean(durations),
    p95DurationMs: p95(durations),
    ...phaseAverages(trialResults),
    meanTokens:
      !dry && tokenTotals.every((value) => value !== null)
        ? mean(tokenTotals as number[])
        : null,
    totalCostUsd: totalCostUsd(trialResults, adapter.name),
    humanReviewMinutes: humanReviewMinutes ?? null,
    ...orchestrationSummary(options, trialResults),
    ...judgeSummary(trialResults),
  };
}

async function runCase(options: RunCaseOptions): Promise<CaseResult> {
  const trialResults: TrialResult[] = [];
  for (let trial = 1; trial <= options.trials; trial++) {
    trialResults.push(await runTrial(options, trial));
  }
  return summarizeCase(options, trialResults);
}

/** The `darrow-native-goal-preflight-v4` records an adaptive-goal run must report. */
function goalRouteRecordChecks(resultText: string): CheckResult[] {
  return [
    {
      name: "goal route application record uses v4",
      passed: /^format\tdarrow-native-goal-preflight-v4$/m.test(resultText),
      detail: "expected darrow-native-goal-preflight-v4",
    },
    {
      name: "workflow and risk gate are reported",
      passed:
        /^workflow\t(?:fix-bug|implement-feature|change-feature|refactor|migration|mechanical|decision-gated)$/m.test(
          resultText,
        ) &&
        /^risk\t(?:routine|elevated|high)$/m.test(resultText) &&
        /^verification_gate\t(?:routine|elevated|high|not-applicable)$/m.test(
          resultText,
        ),
      detail: "expected workflow, risk, and verification_gate records",
    },
    {
      name: "selected and effective goal routes are reported",
      passed:
        /^selected_route\t[^\t\n]+\t[^\t\n]+\t[^\t\n]+\t[^\t\n]+$/m.test(
          resultText,
        ) &&
        /^effective_route\t[^\t\n]+\t[^\t\n]+\t[^\t\n]+\t[^\t\n]+$/m.test(
          resultText,
        ),
      detail: "expected selected_route and effective_route records",
    },
    {
      name: "route application and verification are reported",
      passed:
        /^route_applied_by\t(?:current-thread|host-api|native-subagent|nested-session|none)$/m.test(
          resultText,
        ) && /^route_verified\t(?:true|false)$/m.test(resultText),
      detail: "expected route_applied_by and route_verified records",
    },
  ];
}

function evaluationRecordChecks(
  resultText: string,
  requireGoalRouteApplication = false,
): CheckResult[] {
  return [
    {
      name: "reported child invocation count",
      passed: /^evaluation_child_invocations\t\d+$/m.test(resultText),
      detail: "expected evaluation_child_invocations<TAB><integer>",
    },
    {
      name: "reported human intervention count",
      passed: /^evaluation_human_interruptions\t\d+$/m.test(resultText),
      detail: "expected evaluation_human_interruptions<TAB><integer>",
    },
    ...(requireGoalRouteApplication ? goalRouteRecordChecks(resultText) : []),
  ];
}

const { values } = parseArgs({
  options: {
    harness: { type: "string", default: "claude" },
    model: { type: "string" },
    effort: { type: "string", default: "medium" },
    trials: { type: "string", default: "5" },
    case: { type: "string", multiple: true },
    threshold: { type: "string", default: "0.8" },
    dry: { type: "boolean", default: false },
    condition: { type: "string" },
    "without-skill": { type: "boolean", default: false },
    "human-review-minutes": { type: "string" },
    "corpus-manifest": { type: "string" },
    "skill-dir": { type: "string" },
    "mount-plugin-skills": { type: "boolean", default: false },
    "condition-label": { type: "string" },
    "require-evaluation-records": { type: "boolean", default: false },
    "apply-goal-route": { type: "boolean", default: false },
    "case-routes": { type: "string" },
    "expected-goal-routes": { type: "string" },
    "assert-goal-routes": { type: "string" },
    "assert-goal-dimensions": { type: "string" },
    output: { type: "string" },
    "judge-harness": { type: "string" },
    "judge-model": { type: "string" },
    "judge-effort": { type: "string", default: "low" },
  },
});

const baseAdapter = ADAPTERS[values.harness!];
if (!baseAdapter) {
  console.error(
    `Unknown harness '${values.harness}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}
if (values["apply-goal-route"] && values.harness !== "codex") {
  console.error("--apply-goal-route currently requires --harness codex");
  process.exit(1);
}
const adapter = values["apply-goal-route"] ? codexGoalAdapter : baseAdapter;
const judgeAdapter = values["judge-harness"]
  ? ADAPTERS[values["judge-harness"]]
  : undefined;
if (values["judge-harness"] && !judgeAdapter) {
  console.error(
    `Unknown judge harness '${values["judge-harness"]}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}

const model = values.model ?? adapter.defaultModel;
let caseRoutes: Record<string, { model: string; effort: string }> = {};
if (values["case-routes"]) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(values["case-routes"]);
  } catch {
    console.error("--case-routes must be one JSON object");
    process.exit(1);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Object.values(parsed).every(isNonEmptyRouteRecord)
  ) {
    console.error("--case-routes values must provide model and effort");
    process.exit(1);
  }
  caseRoutes = parsed as Record<string, { model: string; effort: string }>;
}
let expectedGoalRoutes: Record<string, { model: string; effort: string }> = {};
if (values["expected-goal-routes"]) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(values["expected-goal-routes"]);
  } catch {
    console.error("--expected-goal-routes must be one JSON object");
    process.exit(2);
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every(isRouteRecord)
  ) {
    console.error(
      "--expected-goal-routes values must provide model and effort",
    );
    process.exit(2);
  }
  expectedGoalRoutes = parsed as Record<
    string,
    { model: string; effort: string }
  >;
}
let assertedGoalRoutes: Record<string, { model: string; effort: string }> = {};
if (values["assert-goal-routes"]) {
  try {
    assertedGoalRoutes = JSON.parse(values["assert-goal-routes"]);
  } catch {
    console.error("--assert-goal-routes must be one JSON object");
    process.exit(2);
  }
}
let assertedGoalDimensions: Record<
  string,
  {
    profile: string;
    workflow: string;
    risk: "routine" | "elevated" | "high";
  }
> = {};
if (values["assert-goal-dimensions"]) {
  try {
    assertedGoalDimensions = JSON.parse(values["assert-goal-dimensions"]);
  } catch {
    console.error("--assert-goal-dimensions must be one JSON object");
    process.exit(2);
  }
}
let condition: { label: string; text: string } | undefined;
if (values.condition) {
  const condPath = resolve(process.cwd(), values.condition);
  condition = {
    label:
      values["condition-label"] ??
      condPath
        .split("/")
        .pop()!
        .replace(/\.[^.]+$/, ""),
    text: await readFile(condPath, "utf8"),
  };
}
if (values["without-skill"]) {
  condition = {
    label: condition ? `${condition.label}-without-skill` : "without-skill",
    text: condition?.text ?? "",
  };
}
const cases = await loadCases(
  values.case,
  values["corpus-manifest"]
    ? resolve(process.cwd(), values["corpus-manifest"])
    : DEFAULT_CORPUS_MANIFEST,
);
if (values["skill-dir"]) {
  const skillDir = resolve(process.cwd(), values["skill-dir"]);
  for (const evalCase of cases) {
    evalCase.skillDir = skillDir;
    evalCase.mount_plugin_skills = values["mount-plugin-skills"];
  }
}
if (!cases.length) {
  console.error("No cases matched.");
  process.exit(1);
}

const trials = Number(values.trials);
const threshold = Number(values.threshold);
const humanReviewMinutes =
  values["human-review-minutes"] === undefined
    ? undefined
    : Number(values["human-review-minutes"]);
if (
  humanReviewMinutes !== undefined &&
  (!Number.isFinite(humanReviewMinutes) || humanReviewMinutes < 0)
) {
  console.error("--human-review-minutes must be a non-negative number");
  process.exit(1);
}
const harnessVersion = values.dry ? "" : await adapter.version();
console.log(
  `Running ${cases.length} case(s) × ${trials} trial(s) on ${adapter.name}/${model}@${values.effort}` +
    (harnessVersion ? ` (${harnessVersion})` : "") +
    (condition ? ` [condition: ${condition.label}]` : "") +
    (values.dry ? " [dry run — no harness calls]" : ""),
);

const results: CaseResult[] = [];
for (const evalCase of cases) {
  const caseRoute = caseRoutes[evalCase.id];
  const caseModel = caseRoute?.model ?? model;
  const caseEffort = caseRoute?.effort ?? values.effort!;
  console.log(`\n${evalCase.id} (${evalCase.invariant})`);
  const result = await runCase({
    evalCase,
    adapter,
    model: caseModel,
    effort: caseEffort,
    trials,
    dry: values.dry!,
    condition,
    withoutSkill: values["without-skill"],
    humanReviewMinutes,
    requireEvaluationRecords: values["require-evaluation-records"],
    judge: judgeAdapter
      ? {
          adapter: judgeAdapter,
          model: values["judge-model"] ?? judgeAdapter.defaultModel,
          effort: values["judge-effort"]!,
        }
      : undefined,
    expectedGoalRoute: expectedGoalRoutes[evalCase.id],
    assertedGoalRoute: assertedGoalRoutes[evalCase.id],
    assertedGoalDimensions: assertedGoalDimensions[evalCase.id],
  });
  result.harnessVersion = harnessVersion || undefined;
  results.push(result);
}

console.log("\n── Summary ──");
let failed = 0;
for (const r of results) {
  const ok = r.passRate >= threshold;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${r.caseId} [${r.invariant}] pass ${(r.passRate * 100).toFixed(0)}% ` +
      `| ${(r.meanDurationMs / 1000).toFixed(1)}s mean, ${(r.p95DurationMs / 1000).toFixed(1)}s p95 ` +
      `| ${r.meanTokens === null ? "tokens unknown" : `${Math.round(r.meanTokens)} tok mean`} | ${r.totalCostUsd === null ? "cost unknown" : `$${r.totalCostUsd.toFixed(4)}`}`,
  );
  if (r.meanChildInvocationCount !== undefined) {
    console.log(
      `  orchestration: ${r.meanChildInvocationCount.toFixed(1)} reported children mean | ` +
        `${r.totalHumanInterruptions} interruptions | ${r.escapedDefects} escaped defects | ` +
        `${r.falsePositiveVerifierFindings} false-positive findings`,
    );
  }
}

await mkdir(RESULTS_ROOT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const condSuffix = condition ? `-${condition.label}` : "";
const outPath = values.output
  ? resolve(process.cwd(), values.output)
  : join(
      RESULTS_ROOT,
      `${stamp}-${adapter.name}-${model}-${values.effort}${condSuffix}.json`,
    );
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(results, null, 2));
console.log(`\nResults: ${outPath}`);

process.exit(values.dry ? 0 : failed ? 1 : 0);
