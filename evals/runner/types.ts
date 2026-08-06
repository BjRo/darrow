export interface FixtureCommit {
  message: string;
  files: Record<string, string>;
}

export interface Fixture {
  /** Absolute path to a local repo to clone (HEAD state) instead of building
   *  commits. Remotes are stripped so nothing can reach the source repo. */
  repo?: string;
  /** Commits to create, in order, before the working-tree state is applied. */
  commits?: FixtureCommit[];
  /** Working-tree files written (or overwritten) after the commits. */
  files?: Record<string, string>;
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
  prompt: string;
  fixture: Fixture;
  /** Mount every sibling skill from the plugin for orchestrator/composition evals. */
  mount_plugin_skills?: boolean;
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
  factoryMetrics?: {
    childInvocationCount: number;
    humanInterruptions: number;
    escapedDefects: number;
    falsePositiveVerifierFindings: number;
  };
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
  /** Total harness tokens when complete; null when foreign child usage is not reconciled. */
  meanTokens: number | null;
  /** Sum of actual provider cost, or null when any trial cost is unknown. */
  totalCostUsd: number | null;
  /** Manually measured minutes needed to assess one trial's review output, or null when unmeasured. */
  humanReviewMinutes: number | null;
  /** Factory-specific outcome metrics, present when factory wire records appear. */
  meanChildInvocationCount?: number;
  /** Invocation counts come from controller/baseline result records. */
  childInvocationCountSource?:
    "harness_observed" | "controller_result" | "condition_report";
  totalHumanInterruptions?: number;
  escapedDefects?: number;
  falsePositiveVerifierFindings?: number;
}
