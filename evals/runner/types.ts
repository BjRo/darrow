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
  checks: Check[];
}

export interface HarnessResult {
  ok: boolean;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
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
}

export interface TrialResult {
  trial: number;
  passed: boolean;
  checks: CheckResult[];
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
  meanTokens: number;
  totalCostUsd: number;
}
