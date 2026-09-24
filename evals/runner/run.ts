import { readFile, mkdir, writeFile } from "node:fs/promises";
import { atomicWriteJson } from "./artifacts";
import { codexAgentConcurrencyEvidence } from "./codex-config";
import {
  checkpointActiveRun,
  finalizeActiveRun,
  startActiveRun,
} from "./run-state";
import {
  installRunSignals,
  interruptionExitCode,
  settleInterruption,
  throwIfInterrupted,
} from "./run-control";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { parseArgs } from "node:util";
import {
  effectiveOwnerRouteCheck,
  effectiveNativeOwnerRoute,
} from "./owner-evidence";
import { parse as parseYaml } from "yaml";
import { buildFixture, destroyFixture } from "./fixture";
import { trialReviewStateDir } from "./environment";
import { resolveCorpusSource } from "./corpus";
import { runQualityJudge } from "./judge";
import {
  applySemanticOutputGate,
  validateSemanticOutputChecks,
} from "./semantic-output";
import {
  runSemanticArtifactChecks,
  validateSemanticArtifact,
} from "./semantic-artifact";
import { renderParticipantPrompt } from "./prompt";
import {
  runChecks,
  runOutputChecks,
  runTranscriptChecks,
  validateRegexChecks,
} from "./checks";
import {
  claudeAdapter,
  claudeGoalRouteEvidence,
  claudeGoalRouteEvidenceSummary,
  claudeGoalRouteMatchesSelection,
  claudeGoalRouteReportMatches,
  claudeParentLifecycleOperations,
  hasClaudeGoalAgentEvidence,
} from "./adapters/claude";
import { codexAdapter } from "./adapters/codex";
import { CODEX_EVAL_ROLE_DEFAULTS, resolveEvalRoute } from "./model-defaults";
import { EvalCliUi, resolvePresentation, type TrialLine } from "./cli-ui";
import { mapWithConcurrency } from "./concurrency";
import {
  exposesInternalGoalRecord,
  parsePausedGoalReport,
  parseTerminalGoalReport,
  type GoalReport,
  validGoalReportValues,
} from "./goal-report";
import {
  activationProbeForCase,
  activationPassRate,
  activationPassesThreshold,
  activationTargetSkill,
  expectsAdaptiveDeliveryOwner,
  gradeActivation,
  validateActivationCase,
  validateMountedActivationTarget,
} from "./activation";
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
  HarnessRunRequest,
  HarnessResult,
  SkillActivationProbe,
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

interface SemanticOutputConfig {
  adapter: HarnessAdapter;
  model: string;
  effort: string;
}

interface RunCaseOptions {
  assertedEffectiveOwnerRoute?: { model: string; effort: string };
  ownerEvaluationMode: "passive" | "enforced";
  evalCase: EvalCase;
  adapter: HarnessAdapter;
  model: string;
  effort: string;
  trials: number;
  jobs: number;
  threshold: number;
  dry: boolean;
  condition?: { label: string; text: string };
  withoutSkill?: boolean;
  humanReviewMinutes?: number;
  requireEvaluationRecords?: boolean;
  semanticOutput: SemanticOutputConfig;
  judge?: JudgeConfig;
  /** Route the harness is told to apply. */
  expectedGoalRoute?: GoalRouteExpectation;
  /** Route the case asserts the harness actually applied. */
  assertedGoalRoute?: GoalRouteExpectation;
  assertedGoalDimensions?: GoalDimensionsExpectation;
  /** Persisted immediately after each completed trial. */
  checkpoint?: (trial: TrialResult) => Promise<void>;
  ui?: EvalCliUi;
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

async function repositoryHasAncestor(
  repoDir: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const proc = Bun.spawn(
    ["git", "merge-base", "--is-ancestor", ancestor, descendant],
    { cwd: repoDir, stdout: "pipe", stderr: "pipe" },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code === 0) return true;
  if (code === 1) return false;
  throw new Error(
    `cannot compare fixture revisions: ${(stderr || stdout).trim()}`,
  );
}

/** Canonical plugin and repository skill cases, plus skill-less experiments. */
async function scanCases(
  pattern: string,
  skillDirOf: (casePath: string) => string,
  skillScope?: "repository" | "plugin",
): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  for await (const rel of new Bun.Glob(pattern).scan({
    cwd: ROOT,
    dot: true,
  })) {
    const path = join(ROOT, rel);
    const evalCase: EvalCase = parseYaml(await readFile(path, "utf8"));
    evalCase.skillDir = skillDirOf(path);
    evalCase.owningSkillName = evalCase.skillDir
      ? basename(evalCase.skillDir)
      : undefined;
    evalCase.skillScope = skillScope;
    evalCase.owningPluginName =
      skillScope === "plugin"
        ? basename(dirname(dirname(evalCase.skillDir)))
        : undefined;
    evalCase.caseDir = dirname(path);
    cases.push(evalCase);
  }
  return cases;
}

function validateOptionalBoolean(
  evalCase: EvalCase,
  field:
    | "goal_route_checks"
    | "expect_head_change"
    | "adaptive_delivery_composition",
): void {
  const value = evalCase[field];
  if (value !== undefined && value !== null && typeof value !== "boolean")
    throw new Error(`${evalCase.id}: ${field} must be a boolean`);
}

function validateFollowUpPrompt(evalCase: EvalCase): void {
  if (
    evalCase.follow_up_prompt !== undefined &&
    (typeof evalCase.follow_up_prompt !== "string" ||
      !evalCase.follow_up_prompt.trim())
  ) {
    throw new Error(
      `${evalCase.id}: follow_up_prompt must be a non-empty string`,
    );
  }
}

function validateCompositionPaths(evalCase: EvalCase): void {
  for (const [field, paths] of [
    ["source_plugin", evalCase.source_plugin ? [evalCase.source_plugin] : []],
    ["additional_skills", evalCase.additional_skills ?? []],
    ["additional_plugins", evalCase.additional_plugins ?? []],
  ] as const) {
    for (const path of paths) {
      if (
        typeof path !== "string" ||
        !path.trim() ||
        isAbsolute(path) ||
        relative(ROOT, resolve(ROOT, path)).startsWith("..")
      ) {
        throw new Error(
          `${evalCase.id}: ${field} entries must be non-empty repository-relative paths`,
        );
      }
    }
  }
}

function validateCaseConfiguration(evalCase: EvalCase): void {
  validateOptionalBoolean(evalCase, "goal_route_checks");
  validateOptionalBoolean(evalCase, "expect_head_change");
  validateOptionalBoolean(evalCase, "adaptive_delivery_composition");
  validateFollowUpPrompt(evalCase);
  validateCompositionPaths(evalCase);
  const activationErrors = validateActivationCase(evalCase);
  if (activationErrors.length) throw new Error(activationErrors.join("; "));
  const regexErrors = [
    ...validateRegexChecks(evalCase.checks, `${evalCase.id} checks`),
    ...validateRegexChecks(
      evalCase.output_checks ?? [],
      `${evalCase.id} output_checks`,
    ),
    ...validateRegexChecks(
      evalCase.transcript_checks ?? [],
      `${evalCase.id} transcript_checks`,
    ),
  ];
  const semanticErrors = validateSemanticOutputChecks(
    evalCase.semantic_output_checks ?? [],
    `${evalCase.id} semantic_output_checks`,
  );
  const artifactErrors = validateSemanticArtifact(
    evalCase.semantic_artifact,
    `${evalCase.id} semantic_artifact`,
  );
  const errors = [...regexErrors, ...semanticErrors, ...artifactErrors];
  if (errors.length) throw new Error(errors.join("; "));
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
  skill?: string,
  plugin?: string,
): Promise<EvalCase[]> {
  const cases = [
    ...(await scanCases(
      "plugins/*/*/skills/*/evals/*.yaml",
      (path) => dirname(dirname(path)),
      "plugin",
    )),
    ...(await scanCases(
      ".agents/skills/*/evals/*.yaml",
      (path) => dirname(dirname(path)),
      "repository",
    )),
    // Skill-less experiments mount nothing.
    ...(await scanCases("evals/experiments/*/cases/*.yaml", () => "")),
  ];
  cases.sort((a, b) => a.id.localeCompare(b.id));
  const selected = cases.filter(
    (evalCase) =>
      (plugin === undefined || evalCase.owningPluginName === plugin) &&
      (skill === undefined || evalCase.owningSkillName === skill) &&
      (!filter?.length || filter.some((value) => evalCase.id.includes(value))),
  );
  for (const evalCase of selected) validateCaseConfiguration(evalCase);
  await resolveCorpusFixtures(selected, corpusManifest);
  return selected;
}

function trialPrompt(options: RunCaseOptions, repoDir: string): string {
  const { evalCase, adapter, model, effort, condition } = options;
  const template = condition?.text.trim()
    ? `${condition.text.trim()}\n\n${evalCase.prompt}`
    : evalCase.prompt;
  return renderParticipantPrompt(template, adapter.name, evalCase)
    .replaceAll("{{repo_dir}}", repoDir)
    .replaceAll("{{harness}}", adapter.name)
    .replaceAll("{{model}}", model)
    .replaceAll("{{effort}}", effort);
}

function trialFollowUpPrompt(
  options: RunCaseOptions,
  repoDir: string,
): string | undefined {
  const template = options.evalCase.follow_up_prompt;
  if (!template) return undefined;
  return renderParticipantPrompt(
    template,
    options.adapter.name,
    options.evalCase,
  )
    .replaceAll("{{repo_dir}}", repoDir)
    .replaceAll("{{harness}}", options.adapter.name)
    .replaceAll("{{model}}", options.model)
    .replaceAll("{{effort}}", options.effort);
}

function trialCheckEnvironment(
  options: RunCaseOptions,
  repoDir: string,
): Record<string, string> {
  return {
    DARROW_EVAL_HARNESS: options.adapter.name,
    DARROW_EVAL_MODEL: options.model,
    DARROW_EVAL_EFFORT: options.effort,
    DARROW_REVIEW_STATE_DIR: trialReviewStateDir(repoDir),
  };
}

function stableEvidence(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((child) => stableEvidence(child)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableEvidence(child)}`)
      .join(",")}}`;
  }
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function judgeEvidence(judge: JudgeConfig | undefined) {
  return judge
    ? {
        harness: judge.adapter.name,
        model: judge.model,
        effort: judge.effort,
        ...codexAgentConcurrencyEvidence(judge.adapter.name),
      }
    : null;
}

function semanticOutputEvidence(options: RunCaseOptions) {
  if (!options.evalCase.semantic_output_checks?.length) return null;
  return {
    harness: options.semanticOutput.adapter.name,
    model: options.semanticOutput.model,
    effort: options.semanticOutput.effort,
    ...codexAgentConcurrencyEvidence(options.semanticOutput.adapter.name),
  };
}

function activationEvidence(evalCase: EvalCase) {
  return evalCase.activation
    ? {
        class: evalCase.activation,
        target: activationTargetSkill(evalCase),
        sequence: evalCase.activation_sequence ?? null,
        includes: evalCase.activation_includes ?? null,
        excludes: evalCase.activation_excludes ?? null,
      }
    : null;
}

function goalReportEvidence(evalCase: EvalCase) {
  if (!evalCase.skillDir.endsWith("/adaptive-delivery")) return null;
  return evalCase.goal_report ?? "forbidden";
}

function standaloneEvaluationRecordEvidence(options: RunCaseOptions) {
  if (goalReportEvidence(options.evalCase) !== null) return null;
  return options.requireEvaluationRecords ?? false;
}

function requiresStandaloneEvaluationRecords(options: RunCaseOptions) {
  return standaloneEvaluationRecordEvidence(options) === true;
}

// The digest deliberately includes every optional case-control dimension.
// eslint-disable-next-line complexity
function evaluationDigest(options: RunCaseOptions): string {
  const { evalCase, adapter, condition, judge } = options;
  const {
    follow_up_prompt: followUpPrompt = null,
    source_plugin: sourcePlugin = null,
    additional_skills: additionalSkills = [],
    additional_plugins: additionalPlugins = [],
    adaptive_delivery_composition: adaptiveDeliveryComposition = false,
    output_checks: outputChecks = [],
    semantic_output_checks: semanticOutputChecks = [],
    transcript_checks: transcriptChecks = [],
    goal_route_checks: goalRouteChecks = true,
    expect_head_change: expectHeadChange = null,
  } = evalCase;
  const participantPrompt = renderParticipantPrompt(
    condition?.text.trim()
      ? `${condition.text.trim()}\n\n${evalCase.prompt}`
      : evalCase.prompt,
    adapter.name,
    evalCase,
  );
  const evidence = stableEvidence({
    ownerEvaluationMode: options.ownerEvaluationMode,
    ...codexAgentConcurrencyEvidence(adapter.name),
    participantPrompt,
    followUpPrompt,
    sourcePlugin,
    additionalSkills,
    additionalPlugins,
    adaptiveDeliveryComposition,
    fixture: evalCase.fixture,
    repositorySkill: evalCase.skillScope === "repository",
    checks: evalCase.checks,
    outputChecks,
    semanticOutputChecks,
    transcriptChecks,
    activation: activationEvidence(evalCase),
    goalReport: goalReportEvidence(evalCase),
    goalRouteChecks,
    expectHeadChange,
    requireEvaluationRecords: standaloneEvaluationRecordEvidence(options),
    expectedGoalRoute: options.expectedGoalRoute ?? null,
    assertedGoalRoute: options.assertedGoalRoute ?? null,
    assertedEffectiveOwnerRoute: options.assertedEffectiveOwnerRoute ?? null,
    assertedGoalDimensions: options.assertedGoalDimensions ?? null,
    semanticOutput: semanticOutputEvidence(options),
    judge: judgeEvidence(judge),
  });
  return new Bun.CryptoHasher("sha256").update(evidence).digest("hex");
}

function goalRouteControl(
  expectedGoalRoute: GoalRouteExpectation | undefined,
  followUpPrompt: string | undefined,
  expectGoalOwner = false,
  activationProbe?: SkillActivationProbe,
): HarnessRunRequest["control"] {
  if (
    !expectedGoalRoute &&
    !followUpPrompt &&
    !expectGoalOwner &&
    !activationProbe
  )
    return undefined;
  return {
    ...(expectedGoalRoute
      ? {
          expectedGoalRoute: {
            harness: "codex",
            provider: "openai",
            model: expectedGoalRoute.model,
            effort: expectedGoalRoute.effort,
          },
        }
      : {}),
    ...(followUpPrompt ? { followUpPrompt } : {}),
    ...(expectGoalOwner ? { expectGoalOwner: true } : {}),
    ...(activationProbe ? { activationProbe } : {}),
  };
}

function dryTrialResult(trial: number, checks: CheckResult[]): TrialResult {
  return {
    executionMode: "dry",
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
  const { adapter, model, effort, assertedGoalRoute, assertedGoalDimensions } =
    options;
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
    ...(options.assertedEffectiveOwnerRoute
      ? [
          effectiveOwnerRouteCheck(
            harness.raw,
            options.assertedEffectiveOwnerRoute,
          ),
        ]
      : []),
    ...(observedGoalRouteCheck ? [observedGoalRouteCheck] : []),
    ...(assertedGoalRoute
      ? [goalRouteAssertionCheck(observed, assertedGoalRoute)]
      : []),
    ...(assertedGoalDimensions
      ? [goalDimensionsAssertionCheck(observed, assertedGoalDimensions)]
      : []),
    ...(requiresStandaloneEvaluationRecords(options)
      ? evaluationRecordChecks(harness.resultText)
      : []),
  ];
}

// Head, output, and orchestration evidence are intentionally assembled together.
// eslint-disable-next-line max-lines-per-function
async function trialChecks(
  options: RunCaseOptions,
  context: TrialContext,
  observedGoalRouteApplication: GoalRouteApplication | undefined,
): Promise<CheckResult[]> {
  const { evalCase } = options;
  const { repoDir, baseRevision, harness } = context;
  const currentRevision = await repositoryHead(repoDir);
  const headChecks: CheckResult[] =
    evalCase.expect_head_change === null
      ? []
      : evalCase.expect_head_change
        ? [
            {
              name: "head advanced from the base revision",
              passed: currentRevision !== baseRevision,
              detail: "candidate did not create the expected commit",
            },
            {
              name: "base revision remains in the published lineage",
              passed: await repositoryHasAncestor(
                repoDir,
                baseRevision,
                currentRevision,
              ),
              detail: "candidate replaced or diverged from the fixture history",
            },
          ]
        : [
            {
              name: "base revision remains unchanged",
              passed: currentRevision === baseRevision,
              detail: "candidate created or switched to a different commit",
            },
          ];
  const orchestrationChecks = await orchestrationContractChecks(
    evalCase,
    harness,
    options.adapter.name,
  );
  return [
    ...(await runChecks(
      repoDir,
      evalCase.checks,
      trialCheckEnvironment(options, repoDir),
    )),
    ...headChecks,
    ...orchestrationChecks,
    ...routeChecks(options, harness, observedGoalRouteApplication),
  ];
}

async function orchestrationContractChecks(
  evalCase: EvalCase,
  harness: HarnessResult,
  adapterName: string,
): Promise<CheckResult[]> {
  return [
    ...(await runOutputChecks(
      harness.resultText,
      evalCase.output_checks ?? [],
      evalCase.skillDir,
    )),
    ...(await runTranscriptChecks(
      harness.raw,
      evalCase.transcript_checks ?? [],
    )),
    ...adaptiveDeliveryReportChecks(evalCase, harness, adapterName),
  ];
}

function adaptiveDeliveryReportChecks(
  evalCase: EvalCase,
  harness: HarnessResult,
  adapterName: string,
): CheckResult[] {
  const ownsAdaptiveDelivery = evalCase.skillDir.endsWith("/adaptive-delivery");
  const ownershipChecks = adaptiveDeliveryOwnershipChecks(harness.raw);
  const nativeClaudeRouteChecks = nativeClaudeRouteChecksFor(
    adapterName,
    harness.raw,
  );
  if (!ownsAdaptiveDelivery)
    return evalCase.adaptive_delivery_composition
      ? [...ownershipChecks, ...nativeClaudeRouteChecks]
      : [];
  if (evalCase.goal_route_checks === false)
    return [
      ...ownershipChecks,
      internalGoalRecordCheck(harness.resultText),
      ...nativeClaudeRouteChecks,
    ];
  const reportPolicy = evalCase.goal_report ?? "forbidden";
  const hasReport = hasCanonicalGoalReport(harness.resultText);
  if (reportPolicy === "optional" && !hasReport)
    return [
      ...ownershipChecks,
      internalGoalRecordCheck(harness.resultText),
      ...nativeClaudeRouteChecks,
    ];
  if (reportPolicy !== "forbidden") {
    const report =
      reportPolicy === "optional"
        ? parsePausedGoalReport(harness.resultText)
        : parseTerminalGoalReport(harness.resultText);
    return [
      ...ownershipChecks,
      ...goalRouteRecordChecks(harness.resultText, report),
      ...claudeNativeSubagentRouteChecks(report, harness.raw),
    ];
  }
  return [
    ...ownershipChecks,
    ...nativeClaudeRouteChecks,
    removedCanonicalGoalReportCheck(hasReport),
  ];
}

function removedCanonicalGoalReportCheck(hasReport: boolean): CheckResult {
  return {
    name: "removed canonical goal report is absent",
    passed: !hasReport,
    detail:
      "adaptive-delivery output must not contain the removed canonical report",
  };
}

function adaptiveDeliveryOwnershipChecks(raw: string): CheckResult[] {
  return [
    adaptiveDeliverySingleOwnerCheck(raw),
    adaptiveDeliveryParentWorkCheck(raw),
  ];
}

function nativeClaudeRouteChecksFor(
  adapterName: string,
  raw: string,
): CheckResult[] {
  return adapterName === "claude"
    ? claudeNativeSubagentRouteChecks(undefined, raw, false)
    : [];
}

function hasCanonicalGoalReport(resultText: string): boolean {
  return /^[ \t]*format: darrow-native-goal-report-v1[ \t]*\r?$/m.test(
    resultText,
  );
}

function adaptiveDeliverySingleOwnerCheck(raw: string): CheckResult {
  return {
    name: "no parent replacement owner is spawned after acceptance",
    passed:
      !raw.includes('"type":"darrow.parent_spawn_after_goal"') &&
      raw
        .split("\n")
        .filter((line) =>
          line.startsWith('{"type":"darrow.codex_native_spawn"'),
        ).length <= 1,
    detail:
      "the parent must retain the accepted owner instead of spawning another agent",
  };
}

function adaptiveDeliveryParentWorkCheck(raw: string): CheckResult {
  const parentWork = raw
    .split("\n")
    .some(
      (line) =>
        line.includes('"type":"darrow.codex_native_parent_tool_after_agent"') ||
        (line.includes('"type":"darrow.parent_tool_after_goal"') &&
          !line.includes('"operation":"error"')) ||
        (line.includes('"type":"darrow.parent_repository_tool_after_goal"') &&
          !line.includes('"tool":"Agent"')),
    );
  return {
    name: "no parent repository or external work occurs after owner acceptance",
    passed: !parentWork,
    detail:
      "after acceptance the parent may only wait, relay feedback, or stop the owner",
  };
}

const CLAUDE_GOAL_RUNNERS: Record<string, { model: string; effort: string }> = {
  "darrow-adaptive-delivery:adaptive-delivery-sonnet-5-low": {
    model: "claude-sonnet-5",
    effort: "low",
  },
  "darrow-adaptive-delivery:adaptive-delivery-sonnet-5-medium": {
    model: "claude-sonnet-5",
    effort: "medium",
  },
  "darrow-adaptive-delivery:adaptive-delivery-opus-5-high": {
    model: "claude-opus-5",
    effort: "high",
  },
};

function claudeNativeSubagentRouteChecks(
  report: GoalReport | undefined,
  raw: string,
  reconcileReport = true,
  requireOwner = false,
): CheckResult[] {
  const evidence = claudeGoalRouteEvidence(raw);
  const evidenceSummary = claudeGoalRouteEvidenceSummary(raw);
  const parentOperations = claudeParentLifecycleOperations(raw).filter(
    (operation) => operation.startsWith("after:"),
  );
  const retainedGoalOwner = hasClaudeGoalAgentEvidence(raw);
  const reportsClaudeOwner = reportsClaudeNativeOwner(report);
  const parentLifecycleCheck = claudeParentLifecycleCheck(parentOperations);
  if (!retainedGoalOwner && !reportsClaudeOwner && !requireOwner)
    return parentOperations.length ? [parentLifecycleCheck] : [];
  const selected = selectedClaudeGoalRoute(evidence);
  return [
    {
      name: "Claude native-subagent route has retained effective-route evidence",
      passed:
        evidence !== undefined &&
        selected !== undefined &&
        claudeGoalRouteMatchesSelection(evidence, selected),
      detail: `expected one marked completed Claude runner whose transcript-derived route exactly matches its selected model and effort (${evidenceSummary})`,
    },
    ...(reconcileReport
      ? [
          {
            name: "Claude route report matches retained effective-route evidence",
            passed: claudeRouteReportMatchesEvidence(
              report,
              evidence,
              selected,
            ),
            detail:
              "reported route verification must reconcile with observation and confirmation evidence",
          },
        ]
      : []),
    parentLifecycleCheck,
  ];
}

function claudeParentLifecycleCheck(parentOperations: string[]): CheckResult {
  return {
    name: "Claude parent performs no mutation or verification outside the owner",
    passed: parentOperations.length === 0,
    detail: parentOperations.length
      ? `unexpected normalized parent operations: ${parentOperations.join(", ")}`
      : "no parent mutation or verification outside the owner",
  };
}

function reportsClaudeNativeOwner(report: GoalReport | undefined): boolean {
  if (!report) return false;
  return [
    report.harness === "claude",
    report.route_applied_by === "native-subagent",
  ].every(Boolean);
}

function selectedClaudeGoalRoute(
  evidence: ReturnType<typeof claudeGoalRouteEvidence>,
) {
  if (!evidence) return undefined;
  return CLAUDE_GOAL_RUNNERS[evidence.subagentType];
}

function claudeRouteReportMatchesEvidence(
  report: GoalReport | undefined,
  evidence: ReturnType<typeof claudeGoalRouteEvidence>,
  selected: { model: string; effort: string } | undefined,
): boolean {
  if (!report || !evidence || !selected) return false;
  return claudeGoalRouteReportMatches(report, evidence, selected);
}

function trialActivation(options: RunCaseOptions, harness: HarnessResult) {
  const { evalCase } = options;
  return evalCase.activation && !options.withoutSkill
    ? gradeActivation(
        evalCase.activation,
        activationTargetSkill(evalCase),
        harness.skillActivation,
        {
          sequence: evalCase.activation_sequence,
          includes: evalCase.activation_includes,
          excludes: evalCase.activation_excludes,
        },
      )
    : undefined;
}

async function evaluateSemanticOutput(
  options: RunCaseOptions,
  response: string,
  baseChecks: CheckResult[],
  harnessOk: boolean,
) {
  const semanticChecks = options.evalCase.semantic_output_checks;
  if (!semanticChecks?.length)
    return {
      checks: baseChecks,
      semanticOutput: undefined,
      passed: harnessOk && baseChecks.every((check) => check.passed),
    };
  return applySemanticOutputGate(
    {
      adapter: options.semanticOutput.adapter,
      response,
      checks: semanticChecks,
      model: options.semanticOutput.model,
      effort: options.semanticOutput.effort,
    },
    baseChecks,
    harnessOk,
  );
}

async function evaluateQuality(
  options: RunCaseOptions,
  repoDir: string,
  checks: CheckResult[],
) {
  const { judge, evalCase, adapter } = options;
  if (!judge) return undefined;
  return runQualityJudge({
    adapter: judge.adapter,
    repoDir,
    task: renderParticipantPrompt(evalCase.prompt, adapter.name, evalCase),
    checks,
    model: judge.model,
    effort: judge.effort,
  });
}

async function evaluateSemanticArtifact(
  options: RunCaseOptions,
  repoDir: string,
) {
  const config = options.evalCase.semantic_artifact;
  if (!config) return undefined;
  return runSemanticArtifactChecks({
    adapter: options.semanticOutput.adapter,
    repoDir,
    config,
    model: options.semanticOutput.model,
    effort: options.semanticOutput.effort,
  });
}

async function retainHarnessTrace(repoDir: string, harness: HarnessResult) {
  await writeFile(
    join(repoDir, ".git", "retained-harness.jsonl"),
    harness.raw,
    {
      mode: 0o600,
    },
  );
}

async function evaluateTrial(
  options: RunCaseOptions,
  context: TrialContext,
): Promise<TrialResult> {
  const { adapter } = options;
  const { harness, repoDir } = context;
  const observedGoalRouteApplication =
    adapter.name === "codex"
      ? observeCodexGoalRouteApplication(harness.resultText, harness.raw)
      : undefined;
  const observedTicketPipelineRoutes =
    /^format\tdarrow-ticket-pipeline-result-v1$/m.test(harness.resultText)
      ? observeCodexTicketPipelineRoutes(harness.raw)
      : undefined;
  await retainHarnessTrace(repoDir, harness);
  const baseChecks = await trialChecks(
    options,
    context,
    observedGoalRouteApplication,
  );
  const artifactGate = await evaluateSemanticArtifact(options, repoDir);
  const gate = await evaluateSemanticOutput(
    options,
    harness.resultText,
    [...baseChecks, ...(artifactGate?.checks ?? [])],
    harness.ok,
  );
  const judged = await evaluateQuality(options, repoDir, gate.checks);
  return {
    trial: context.trial,
    executionMode: "executed",
    passed: gate.passed,
    checks: gate.checks,
    harness,
    activation: trialActivation(options, harness),
    routeApplication: observedGoalRouteApplication,
    effectiveOwnerRoute: effectiveNativeOwnerRoute(harness.raw),
    orchestrationMetrics: extractOrchestrationMetrics(
      harness.resultText,
      gate.checks,
      observedGoalRouteApplication?.childInvocationCount ??
        observedTicketPipelineRoutes?.length,
    ),
    semanticOutput: gate.semanticOutput,
    semanticArtifact: artifactGate?.result,
    judge: judged,
  };
}

async function evaluateDryTrial(
  options: RunCaseOptions,
  trial: number,
  repoDir: string,
): Promise<TrialResult> {
  return dryTrialResult(
    trial,
    await runChecks(
      repoDir,
      options.evalCase.checks,
      trialCheckEnvironment(options, repoDir),
    ),
  );
}

function trialFixtureOptions(
  options: RunCaseOptions,
): Parameters<typeof buildFixture>[0] {
  const { evalCase, adapter, withoutSkill = false } = options;
  return {
    repositorySkill: evalCase.skillScope === "repository",
    fixture: evalCase.fixture,
    skillDir: withoutSkill ? "" : evalCase.skillDir,
    skillMounts:
      evalCase.skillScope === "repository"
        ? [adapter.name === "codex" ? ".agents/skills" : ".claude/skills"]
        : adapter.skillMounts,
    mountPluginSkills: evalCase.mount_plugin_skills ?? false,
    sourcePluginRoot: evalCase.source_plugin
      ? resolve(ROOT, evalCase.source_plugin)
      : undefined,
    additionalSkillDirs: (evalCase.additional_skills ?? []).map((path) =>
      resolve(ROOT, path),
    ),
    additionalPluginRoots: (evalCase.additional_plugins ?? []).map((path) =>
      resolve(ROOT, path),
    ),
    sourceClaudePlugin: adapter.sourceClaudePlugin,
    sourceCodexPlugin: adapter.sourceCodexPlugin,
    caseDir: evalCase.caseDir,
  };
}

async function evaluateLiveTrial(
  options: RunCaseOptions,
  trial: number,
  repoDir: string,
): Promise<TrialResult> {
  const { evalCase, adapter, model, effort } = options;
  const baseRevision = await repositoryHead(repoDir);
  const harness = await adapter.run({
    repoDir,
    prompt: trialPrompt(options, repoDir),
    model,
    effort,
    control: {
      ...goalRouteControl(
        options.expectedGoalRoute,
        trialFollowUpPrompt(options, repoDir),
        expectsAdaptiveDeliveryOwner(evalCase),
        evalCase.activation && !options.withoutSkill
          ? activationProbeForCase(evalCase, adapter.name)
          : undefined,
      ),
      ownerEvaluationMode: options.ownerEvaluationMode,
    },
  });
  throwIfInterrupted();
  return evaluateTrial(options, { trial, repoDir, baseRevision, harness });
}

async function runTrial(
  options: RunCaseOptions,
  trial: number,
): Promise<TrialResult> {
  throwIfInterrupted();
  const repoDir = await buildFixture(trialFixtureOptions(options));
  let checkpointFailed = false;
  try {
    const result = options.dry
      ? await evaluateDryTrial(options, trial, repoDir)
      : await evaluateLiveTrial(options, trial, repoDir);
    // A completed result must be persisted even if a signal arrived while
    // grading. Handle cancellation only after its checkpoint is durable.
    try {
      await options.checkpoint?.(result);
    } catch (error) {
      checkpointFailed = true;
      throw new Error(
        `trial evidence could not be checkpointed; fixture retained at ${repoDir}`,
        { cause: error },
      );
    }
    throwIfInterrupted();
    return result;
  } finally {
    if (!checkpointFailed) await destroyFixture(repoDir);
  }
}

/** Total tokens for one trial, or null when orchestration usage is unaccounted. */
function trialTokenTotal(
  trial: TrialResult,
  harnessName: string,
): number | null {
  if (trial.harness.tokenUsageComplete === false) return null;
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
  const observed = trialResults.map((trial) => trial.orchestrationMetrics);
  if (observed.some(defined) && !observed.every(defined)) return {};
  const measured = observed.filter(defined);
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
  const observed = trialResults.map((trial) =>
    trial.judge?.ok ? trial.judge.assessment : undefined,
  );
  if (observed.some(defined) && !observed.every(defined)) return {};
  const assessments = observed.filter(defined);
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

function activationSummary(
  options: RunCaseOptions,
  trialResults: TrialResult[],
): Pick<
  CaseResult,
  "activationClass" | "activationTargetSkill" | "activationPassRate"
> {
  if (!options.evalCase.activation || options.withoutSkill) return {};
  const grades = trialResults.map((trial) => trial.activation).filter(defined);
  return {
    activationClass: options.evalCase.activation,
    activationTargetSkill: activationTargetSkill(options.evalCase),
    activationPassRate:
      grades.length === trialResults.length ? activationPassRate(grades) : null,
  };
}

function meanTrialTokens(
  trialResults: TrialResult[],
  harness: string,
  dry: boolean,
): number | null {
  const totals = trialResults.map((trial) => trialTokenTotal(trial, harness));
  return !dry && totals.every((value) => value !== null)
    ? mean(totals as number[])
    : null;
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
  return {
    caseId: evalCase.id,
    ...codexAgentConcurrencyEvidence(adapter.name),
    ownerEvaluationMode: options.ownerEvaluationMode,
    expectedEffectiveOwnerRoute: options.assertedEffectiveOwnerRoute,
    executionMode: dry ? "dry" : "executed",
    invariant: evalCase.invariant,
    evaluationDigest: evaluationDigest(options),
    passThreshold: options.threshold,
    skillDirectory:
      options.withoutSkill || !evalCase.skillDir ? null : evalCase.skillDir,
    mountPluginSkills:
      !options.withoutSkill &&
      !!evalCase.skillDir &&
      (evalCase.mount_plugin_skills ?? false),
    ...activationSummary(options, trialResults),
    harness: adapter.name,
    model,
    effort,
    condition: condition?.label,
    trials: trialResults,
    passRate: dry
      ? null
      : trialResults.filter((t) => t.passed).length /
        Math.max(1, trialResults.length),
    meanDurationMs: mean(durations),
    p95DurationMs: p95(durations),
    ...phaseAverages(trialResults),
    meanTokens: meanTrialTokens(trialResults, adapter.name, dry),
    totalCostUsd: totalCostUsd(trialResults, adapter.name),
    humanReviewMinutes: humanReviewMinutes ?? null,
    ...orchestrationSummary(options, trialResults),
    ...judgeSummary(trialResults),
  };
}

function judgeLine(result: TrialResult): string | undefined {
  if (!result.judge) return undefined;
  return result.judge.assessment
    ? `${result.judge.assessment.verdict} · ${result.judge.assessment.overallScore}/5`
    : `invalid · ${result.judge.parseError}`;
}

function semanticOutputLine(result: TrialResult): string | undefined {
  if (!result.semanticOutput) return undefined;
  const { route } = result.semanticOutput;
  const grade = result.semanticOutput.ok
    ? "graded"
    : `invalid · ${result.semanticOutput.parseError}`;
  return `${grade} · ${route.harness}/${route.model}@${route.effort}`;
}

function trialLine(
  options: RunCaseOptions,
  result: TrialResult,
): Omit<TrialLine, "completed" | "total"> {
  return {
    passed: result.passed,
    caseId: options.evalCase.id,
    trial: result.trial,
    trials: options.trials,
    durationMs: result.harness.durationMs,
    tokens: options.dry ? null : trialTokenTotal(result, options.adapter.name),
    failedChecks: result.checks.filter((check) => !check.passed),
    activation: result.activation
      ? {
          passed: result.activation.passed,
          className: result.activation.class,
          targetSkill: result.activation.targetSkill,
          expectedSkills: result.activation.expectedSkills,
          requiredSkills: result.activation.requiredSkills,
          excludedSkills: result.activation.excludedSkills,
          primarySkill: result.activation.primarySkill,
          observedSkills: result.activation.observedSkills,
          source: result.activation.source,
        }
      : undefined,
    judge: judgeLine(result),
    semanticOutput: semanticOutputLine(result),
    dry: options.dry,
  };
}

async function runCase(options: RunCaseOptions): Promise<CaseResult> {
  let completionQueue = Promise.resolve();
  const recordCompletion = (result: TrialResult): Promise<void> => {
    const pending = completionQueue.then(async () => {
      await options.checkpoint?.(result);
      options.ui?.finishTrial(trialLine(options, result));
    });
    completionQueue = pending.catch(() => undefined);
    return pending;
  };
  const trialResults = await mapWithConcurrency(
    Array.from({ length: options.trials }, (_, index) => index + 1),
    options.jobs,
    async (trial) => {
      options.ui?.startTrial(options.evalCase.id, trial, options.trials);
      return runTrial({ ...options, checkpoint: recordCompletion }, trial);
    },
  );
  return summarizeCase(options, trialResults);
}

/** The human-readable completion record an adaptive-delivery run must report. */
function goalRouteRecordChecks(
  resultText: string,
  report: GoalReport | undefined,
): CheckResult[] {
  return [
    {
      name: "goal completion report is canonical",
      passed: validGoalReportValues(report),
      detail:
        "expected one ordered readable report with every field and canonical value",
    },
    internalGoalRecordCheck(resultText),
  ];
}

function internalGoalRecordCheck(resultText: string): CheckResult {
  return {
    name: "goal completion report omits internal TSV records",
    passed: !exposesInternalGoalRecord(resultText),
    detail: "internal tab-separated records are not caller-facing output",
  };
}

function evaluationRecordChecks(resultText: string): CheckResult[] {
  const childRecords = resultText.match(
    /^(?:evaluation_child_invocations\t|evaluation_child_invocations: )\d+$/gm,
  );
  const interruptionRecords = resultText.match(
    /^(?:evaluation_human_interruptions\t|evaluation_human_interruptions: )\d+$/gm,
  );
  return [
    {
      name: "reported child invocation count",
      passed: childRecords?.length === 1,
      detail: "expected evaluation_child_invocations with an integer",
    },
    {
      name: "reported human intervention count",
      passed: interruptionRecords?.length === 1,
      detail: "expected evaluation_human_interruptions with an integer",
    },
  ];
}

const { values } = parseArgs({
  options: {
    harness: { type: "string" },
    model: { type: "string" },
    effort: {
      type: "string",
      default: CODEX_EVAL_ROLE_DEFAULTS.candidate.effort,
    },
    trials: { type: "string", default: "5" },
    jobs: { type: "string", default: "3" },
    case: { type: "string", multiple: true },
    skill: { type: "string" },
    plugin: { type: "string" },
    threshold: { type: "string", default: "0.8" },
    dry: { type: "boolean", default: false },
    "owner-evaluation": { type: "string", default: "enforced" },
    condition: { type: "string" },
    "without-skill": { type: "boolean", default: false },
    "human-review-minutes": { type: "string" },
    "corpus-manifest": { type: "string" },
    "skill-dir": { type: "string" },
    "mount-plugin-skills": { type: "boolean", default: false },
    "condition-label": { type: "string" },
    "require-evaluation-records": { type: "boolean", default: false },
    "case-routes": { type: "string" },
    "expected-goal-routes": { type: "string" },
    "assert-goal-routes": { type: "string" },
    "assert-effective-owner-routes": { type: "string" },
    "assert-goal-dimensions": { type: "string" },
    output: { type: "string" },
    "no-color": { type: "boolean", default: false },
    "no-emoji": { type: "boolean", default: false },
    "no-progress": { type: "boolean", default: false },
    "judge-harness": { type: "string" },
    "judge-model": { type: "string" },
    "judge-effort": {
      type: "string",
      default: CODEX_EVAL_ROLE_DEFAULTS.qualityJudge.effort,
    },
    "semantic-check-harness": { type: "string", default: "codex" },
    "semantic-check-model": { type: "string" },
    "semantic-check-effort": {
      type: "string",
      default: CODEX_EVAL_ROLE_DEFAULTS.semanticOutputGrader.effort,
    },
  },
});

const trials = Number(values.trials);
const ownerEvaluationMode = values["owner-evaluation"];
if (ownerEvaluationMode !== "passive" && ownerEvaluationMode !== "enforced") {
  console.error("--owner-evaluation must be passive or enforced");
  process.exit(1);
}
const jobs = Number(values.jobs);
const threshold = Number(values.threshold);
if (!Number.isInteger(trials) || trials < 1) {
  console.error("--trials must be a positive integer");
  process.exit(1);
}
if (!Number.isInteger(jobs) || jobs < 1) {
  console.error("--jobs must be a positive integer");
  process.exit(1);
}
if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
  console.error("--threshold must be greater than 0 and at most 1");
  process.exit(1);
}

const harness = values.harness;
if (!harness) {
  console.error(
    `--harness is required; available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}
const baseAdapter = ADAPTERS[harness];
if (!baseAdapter) {
  console.error(
    `Unknown harness '${harness}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}
const adapter = baseAdapter;
const judgeAdapter = values["judge-harness"]
  ? ADAPTERS[values["judge-harness"]]
  : undefined;
if (values["judge-harness"] && !judgeAdapter) {
  console.error(
    `Unknown judge harness '${values["judge-harness"]}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}
const semanticOutputAdapter = ADAPTERS[values["semantic-check-harness"]!];
if (!semanticOutputAdapter) {
  console.error(
    `Unknown semantic-check harness '${values["semantic-check-harness"]}'. Available: ${Object.keys(ADAPTERS).join(", ")}`,
  );
  process.exit(1);
}
const semanticOutputRoute = resolveEvalRoute(
  semanticOutputAdapter,
  "semanticOutputGrader",
  {
    model: values["semantic-check-model"],
    effort: values["semantic-check-effort"],
  },
);
const semanticOutput = {
  adapter: semanticOutputAdapter,
  ...semanticOutputRoute,
};

const candidateRoute = resolveEvalRoute(adapter, "candidate", {
  model: values.model,
  effort: values.effort,
});
const model = candidateRoute.model;
const effort = candidateRoute.effort;
const judge = judgeAdapter
  ? {
      adapter: judgeAdapter,
      ...resolveEvalRoute(judgeAdapter, "qualityJudge", {
        model: values["judge-model"],
        effort: values["judge-effort"],
      }),
    }
  : undefined;
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
let assertedEffectiveOwnerRoutes: Record<
  string,
  { model: string; effort: string }
> = {};
if (values["assert-effective-owner-routes"]) {
  try {
    const parsed = JSON.parse(values["assert-effective-owner-routes"]);
    if (
      !parsed ||
      Array.isArray(parsed) ||
      typeof parsed !== "object" ||
      !Object.values(parsed).every(isNonEmptyRouteRecord)
    )
      throw new Error("invalid routes");
    assertedEffectiveOwnerRoutes = parsed;
  } catch {
    console.error(
      "--assert-effective-owner-routes must be a JSON object of model/effort routes",
    );
    process.exit(2);
  }
}
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
  values.skill,
  values.plugin,
);
for (const evalCase of cases) {
  if (evalCase.skillScope !== "repository") continue;
  if (evalCase.source_plugin || evalCase.mount_plugin_skills)
    throw new Error(
      `${evalCase.id}: repository cases cannot use source_plugin or mount_plugin_skills`,
    );
  if (
    adapter.name === "claude" &&
    !values["skill-dir"] &&
    !values["without-skill"]
  ) {
    evalCase.skillDir = join(ROOT, ".claude/skills", evalCase.owningSkillName!);
    await readFile(join(evalCase.skillDir, "SKILL.md"), "utf8");
  }
}
if (values["skill-dir"]) {
  const skillDir = resolve(process.cwd(), values["skill-dir"]);
  for (const evalCase of cases) {
    evalCase.skillDir = skillDir;
    evalCase.mount_plugin_skills =
      evalCase.mount_plugin_skills === true || values["mount-plugin-skills"];
  }
}
for (const evalCase of cases) {
  const activationErrors = [
    ...validateActivationCase(evalCase),
    ...(await validateMountedActivationTarget(evalCase)),
  ];
  if (activationErrors.length) throw new Error(activationErrors.join("; "));
}
if (!cases.length) {
  console.error("No cases matched.");
  process.exit(1);
}

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
await mkdir(RESULTS_ROOT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const condSuffix = condition ? `-${condition.label}` : "";
const outPath = values.output
  ? resolve(process.cwd(), values.output)
  : join(
      RESULTS_ROOT,
      `${stamp}-${adapter.name}-${model}-${effort}${condSuffix}.json`,
    );
await mkdir(dirname(outPath), { recursive: true });
const presentation = resolvePresentation({
  isTTY: process.stdout.isTTY ?? false,
  env: process.env,
  noColor: values["no-color"],
  noEmoji: values["no-emoji"],
  noProgress: values["no-progress"],
});
const ui = new EvalCliUi(
  jobs > 1 ? { ...presentation, progress: false } : presentation,
  cases.length * trials,
);
ui.heading({
  harness: adapter.name,
  model,
  effort,
  harnessVersion: harnessVersion || undefined,
  cases: cases.length,
  trials,
  jobs,
  threshold,
  condition: condition?.label,
  dry: values.dry!,
});
const runIdentity = new Bun.CryptoHasher("sha256")
  .update(
    stableEvidence({
      cases: cases.map((evalCase) =>
        evaluationDigest({
          ownerEvaluationMode,
          evalCase,
          adapter,
          model: caseRoutes[evalCase.id]?.model ?? model,
          effort: caseRoutes[evalCase.id]?.effort ?? effort,
          trials,
          jobs,
          threshold,
          dry: values.dry!,
          condition,
          withoutSkill: values["without-skill"],
          humanReviewMinutes,
          requireEvaluationRecords: values["require-evaluation-records"],
          semanticOutput,
          judge,
          expectedGoalRoute: expectedGoalRoutes[evalCase.id],
          assertedGoalRoute: assertedGoalRoutes[evalCase.id],
          assertedEffectiveOwnerRoute:
            assertedEffectiveOwnerRoutes[evalCase.id],
          assertedGoalDimensions: assertedGoalDimensions[evalCase.id],
        }),
      ),
      harness: adapter.name,
      trials,
      threshold,
      dry: values.dry,
    }),
  )
  .digest("hex");
const activeRunPath = join(RESULTS_ROOT, "active", `${runIdentity}.json`);
await mkdir(dirname(activeRunPath), { recursive: true });
const activeRun = await startActiveRun(activeRunPath, outPath);
const results: CaseResult[] = [];
const unpersistedTrials = new Map<string, unknown>();
const removeSignalHandlers = installRunSignals();

try {
  for (const evalCase of cases) {
    const caseRoute = caseRoutes[evalCase.id];
    const caseModel = caseRoute?.model ?? model;
    const caseEffort = caseRoute?.effort ?? effort;
    const caseOptions: RunCaseOptions = {
      ownerEvaluationMode,
      evalCase,
      adapter,
      model: caseModel,
      effort: caseEffort,
      trials,
      jobs,
      threshold,
      dry: values.dry!,
      condition,
      withoutSkill: values["without-skill"],
      humanReviewMinutes,
      requireEvaluationRecords: values["require-evaluation-records"],
      semanticOutput,
      judge,
      expectedGoalRoute: expectedGoalRoutes[evalCase.id],
      assertedGoalRoute: assertedGoalRoutes[evalCase.id],
      assertedEffectiveOwnerRoute: assertedEffectiveOwnerRoutes[evalCase.id],
      assertedGoalDimensions: assertedGoalDimensions[evalCase.id],
      ui,
      checkpoint: async (trial) => {
        const artifactPath = join(
          activeRun.evidenceDirectory,
          `${encodeURIComponent(evalCase.id)}-${trial.trial}.json`,
        );
        const evidence = {
          format: "darrow-eval-trial-v1",
          attemptId: activeRun.attemptId,
          plannedTrials: trials,
          case: {
            ...summarizeCase(caseOptions, [trial]),
            harnessVersion: harnessVersion || undefined,
          },
        };
        unpersistedTrials.set(artifactPath, evidence);
        await atomicWriteJson(artifactPath, evidence);
        activeRun.completedTrials.push({
          caseId: evalCase.id,
          trial: trial.trial,
          passed: trial.passed,
          artifactPath,
        });
        await checkpointActiveRun(activeRunPath, activeRun);
        unpersistedTrials.delete(artifactPath);
      },
    };
    const result = await runCase(caseOptions);
    result.harnessVersion = harnessVersion || undefined;
    results.push(result);
  }

  let failed = 0;
  const summaries = results.map((result) => {
    const taskOk = result.passRate !== null && result.passRate >= threshold;
    const activationOk = activationPassesThreshold(
      result.activationPassRate,
      threshold,
    );
    const passed = taskOk && activationOk;
    if (!passed) failed++;
    return {
      caseId: result.caseId,
      invariant: result.invariant,
      passed,
      taskPassed: taskOk,
      passRate: result.passRate ?? 0,
      activationPassRate: result.activationClass
        ? result.activationPassRate
        : undefined,
      activationPassed: result.activationClass
        ? result.activationPassRate === null
          ? null
          : activationOk
        : undefined,
      trials: result.trials.length,
      meanDurationMs: result.meanDurationMs,
      meanTokens: result.meanTokens,
      dry: values.dry!,
    };
  });

  throwIfInterrupted();
  await atomicWriteJson(outPath, results);
  activeRun.status = "complete";
  await finalizeActiveRun(activeRunPath, activeRun);
  ui.finish(summaries, outPath);
  process.exitCode = values.dry ? 0 : failed ? 1 : 0;
} catch (caught) {
  ui.stop();
  const interruption = await settleInterruption();
  const error = interruption ?? caught;
  const diagnosticPath = `${outPath}.diagnostic.json`;
  const failure =
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ""}`
      : String(error);
  await atomicWriteJson(diagnosticPath, {
    format: "darrow-eval-diagnostic-v1",
    artifactPath: outPath,
    activeRunPath,
    evidenceDirectory: activeRun.evidenceDirectory,
    completedTrials: activeRun.completedTrials,
    unpersistedTrials: [...unpersistedTrials.values()],
    failure,
  });
  activeRun.status = interruption ? "interrupted" : "diagnostic";
  activeRun.diagnosticPath = diagnosticPath;
  activeRun.failure = failure;
  console.error(
    `Diagnostic: ${diagnosticPath}\nEvidence: ${activeRun.evidenceDirectory}`,
  );
  try {
    await finalizeActiveRun(activeRunPath, activeRun);
  } catch (finalizationError) {
    console.error(
      `Active-run finalization failed: ${String(finalizationError)}`,
    );
  }
  if (!interruption) throw error;
  process.exitCode = interruptionExitCode();
} finally {
  removeSignalHandlers();
}
