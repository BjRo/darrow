export interface FixtureCommit {
  message: string;
  files: Record<string, string>;
}

export interface Fixture {
  /** Commits to create, in order, before the working-tree state is applied. */
  commits: FixtureCommit[];
  /** Working-tree files written (or overwritten) after the commits. */
  files?: Record<string, string>;
  /** Paths staged with `git add` after `files` are written. */
  staged?: string[];
  /** Git hooks installed executable under .git/hooks, e.g. {"pre-commit": "#!/bin/sh\nexit 1"}. */
  hooks?: Record<string, string>;
}

export interface Check {
  name: string;
  /** Shell command executed in the fixture repo. */
  run: string;
  /** Check passes only if stdout matches. */
  expect_regex?: string;
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
  skill: string;
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
  run(repoDir: string, prompt: string, model: string, effort: string): Promise<HarnessResult>;
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
  trials: TrialResult[];
  passRate: number;
  meanDurationMs: number;
  p95DurationMs: number;
  meanTokens: number;
  totalCostUsd: number;
}
