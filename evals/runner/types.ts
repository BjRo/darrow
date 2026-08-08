export interface FixtureCommit {
  message: string;
  files: Record<string, string>;
}

export interface Fixture {
  /** Corpus source ID resolved by the loader to a pinned local repository. */
  source?: string;
  /** Absolute path to a local repo to clone (HEAD state) instead of building
   *  commits. Remotes are stripped so nothing can reach the source repo. */
  repo?: string;
  /** Commits to create, in order, before the working-tree state is applied. */
  commits?: FixtureCommit[];
  /** Working-tree files written (or overwritten) after the commits. */
  files?: Record<string, string>;
  /** Commit `files` as evaluation scaffolding before the harness starts. */
  commit_files?: boolean;
  /** One local tracker record exposed through `.git/fixture-bin/ticketctl`. */
  ticket?: {
    id: string;
    title: string;
    body: string;
  };
  /** Paths staged with `git add` after `files` are written. */
  staged?: string[];
  /** Git hooks installed executable under .git/hooks, e.g. {"pre-commit": "#!/bin/sh\nexit 1"}. */
  hooks?: Record<string, string>;
  /** Executables installed to .git/fixture-bin — prepended to PATH when the
   *  harness runs, to shadow network tools with mocks (e.g. gh). */
  bin?: Record<string, string>;
  /** Shell script run in the repo last (before skill mounts) for states the
   *  declarative fields can't express, e.g. extra branches or merge conflicts. */
  setup?: string;
}

export interface Check {
  name: string;
  /** Optional product-value metric represented by this outcome check. */
  metric?: "escaped_defect" | "defect_detection" | "false_positive";
  /** Shell command executed in the fixture repo. */
  run: string;
  /** Check passes only if stdout matches. */
  expect_regex?: string;
  /** Check passes only if stdout, excluding one final newline, equals this value. */
  expect_exact?: string;
  /** Check fails if stdout matches. */
  not_regex?: string;
  /** Extra regex flags, e.g. "i". "m" is always applied. */
  flags?: string;
  /** Expected exit code (default 0). */
  exit_code?: number;
}

export interface OutputCheck {
  name: string;
  /** Optional product-value metric represented by this output assertion. */
  metric?: "escaped_defect" | "defect_detection" | "false_positive";
  /** Check passes only if the final agent message is one JSON value. */
  valid_json?: boolean;
  /** JSON Schema path, relative to the case's skill directory. */
  schema?: string;
  /** RFC 6901 pointer selecting a value from the parsed final JSON. */
  json_path?: string;
  /** Deep-equality expectation for the selected JSON value. */
  expect_json?: unknown;
  /** Selected array must contain an item with this recursive subset. */
  contains_json?: unknown;
  /** Check passes only if the final agent message matches. */
  expect_regex?: string;
  /** Check passes only if the final agent message exactly equals this value. */
  expect_exact?: string;
  /** Check fails if the final agent message matches. */
  not_regex?: string;
  /** Extra regex flags, e.g. "i". "m" is always applied. */
  flags?: string;
}

export interface EvalCase {
  id: string;
  /** Invariant ID from the capability spec, e.g. GW-C1. */
  invariant: string;
  /** Absolute path to the skill under test — derived by the loader from the
   *  case file's location (two levels up from evals/<case>.yaml), never set
   *  in the yaml itself. */
  skillDir: string;
  /** Absolute directory containing the case YAML, derived by the loader. */
  caseDir: string;
  prompt: string;
  fixture: Fixture;
  /** Mount every sibling skill from the plugin for orchestrator/composition evals. */
  mount_plugin_skills?: boolean;
  /** Optional bundled route policy for a policy-routing judgment case. */
  goal_route_policy?: "current" | "candidate";
  checks: Check[];
  /** Assertions over the final agent message, kept outside the model workspace. */
  output_checks?: OutputCheck[];
}

export interface HarnessResult {
  ok: boolean;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  /** Actual provider cost when supplied by the harness; null means unknown. */
  costUsd: number | null;
  /** Normalized final agent message, excluding harness protocol events. */
  resultText: string;
  raw: string;
  /** Optional phase-level evidence for adapters that split preparation,
   * classification, and implementation across host-native turns. */
  phaseMetrics?: {
    preparation?: { durationMs: number };
    classifier?: {
      durationMs: number;
      inputTokens: number;
      outputTokens: number;
      modelCalls: number;
    };
    execution?: {
      durationMs: number;
      inputTokens: number;
      outputTokens: number;
    };
  };
}

export interface GoalRoute {
  harness: string;
  provider: string;
  model: string;
  effort: string;
}

export interface GoalRouteApplication {
  profile: string;
  workflow?: string;
  risk?: "routine" | "elevated" | "high";
  workflowFile?: string;
  workflowSha256?: string;
  dimensionStage?: "workflow" | "workflow-risk";
  verificationGate?: "routine" | "elevated" | "high";
  selected: GoalRoute;
  effective: GoalRoute;
  appliedBy: "current-thread" | "host-api" | "nested-session";
  launchBoundary: "same_thread" | "host_api" | "nested_session";
  childInvocationCount: number;
  childInputTokens: number;
  childOutputTokens: number;
}

export interface HarnessAdapter {
  name: string;
  defaultModel: string;
  /** Repo-relative directories where the skill folder gets mounted. */
  skillMounts: string[];
  /** CLI version string, recorded per run (versions have drifted mid-experiment before). */
  version(): Promise<string>;
  run(
    repoDir: string,
    prompt: string,
    model: string,
    effort: string,
  ): Promise<HarnessResult>;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
  metric?: "escaped_defect" | "defect_detection" | "false_positive";
}

export interface TrialResult {
  trial: number;
  passed: boolean;
  checks: CheckResult[];
  harness: HarnessResult;
  /** Harness-observed application of a goal-loop profile route. */
  routeApplication?: GoalRouteApplication;
  orchestrationMetrics?: {
    childInvocationCount: number;
    humanInterruptions: number;
    escapedDefects: number;
    falsePositiveVerifierFindings: number;
  };
  judge?: JudgeResult;
}

export interface JudgeAssessment {
  verdict: "pass" | "fail";
  overallScore: number;
  dimensions: {
    correctness: number;
    maintainability: number;
    testQuality: number;
    scopeDiscipline: number;
  };
  strengths: string[];
  weaknesses: string[];
  summary: string;
}

export interface JudgeResult {
  ok: boolean;
  assessment?: JudgeAssessment;
  parseError?: string;
  harness: HarnessResult;
}

export interface CaseResult {
  caseId: string;
  invariant: string;
  harness: string;
  model: string;
  effort: string;
  /** Condition label when run with --condition (A/B experiments). */
  condition?: string;
  /** Harness CLI version at run time. */
  harnessVersion?: string;
  trials: TrialResult[];
  passRate: number;
  meanDurationMs: number;
  p95DurationMs: number;
  meanPreparationDurationMs?: number;
  meanClassifierDurationMs?: number;
  meanClassifierTokens?: number;
  meanClassifierModelCalls?: number;
  meanExecutionDurationMs?: number;
  meanExecutionTokens?: number;
  /** Total harness tokens when complete; null when nested or foreign usage is not reconciled. */
  meanTokens: number | null;
  /** Sum of actual provider cost, or null when any trial cost is unknown. */
  totalCostUsd: number | null;
  /** Manually measured minutes needed to assess one trial's review output, or null when unmeasured. */
  humanReviewMinutes: number | null;
  /** Orchestration-specific outcome metrics, present when orchestration result records appear. */
  meanChildInvocationCount?: number;
  /** Invocation counts come from controller/baseline result records. */
  childInvocationCountSource?:
    "harness_observed" | "controller_result" | "condition_report";
  totalHumanInterruptions?: number;
  escapedDefects?: number;
  falsePositiveVerifierFindings?: number;
  /** Mean blind-judge score (1-5), separate from deterministic pass/fail. */
  meanJudgeScore?: number;
  /** Share of trials the blind judge classified as acceptable. */
  judgePassRate?: number;
}
