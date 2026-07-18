export const TREATMENTS = ["native", "plugins", "cli"] as const;
export const HARNESSES = ["codex", "claude"] as const;

export type Treatment = (typeof TREATMENTS)[number];
export type Harness = (typeof HARNESSES)[number];
export type Phase = "pilot" | "confirmatory";
export type Stratum = "simple" | "orchestrated";

export interface Route {
  executable: string;
  version: string;
  model: string;
  effort: string;
  permissionMode: string;
  authFiles: string[];
}

export interface Protocol {
  schemaVersion: string;
  preregisteredAt: string;
  frozenSeed: string;
  repeats: number;
  treatments: Treatment[];
  harnesses: Record<Harness, Route>;
  design: {
    alpha: number;
    power: number;
    pairedTaskSd: number;
    qualityNonInferiorityMargin: number;
    usefulQualityGain: number;
    usefulAttentionReduction: number;
    maxCostRatio: number;
    maxWallTimeRatio: number;
    maxOperationalFailureRate: number;
    bootstrapSamples: number;
    randomizationSamples: number;
  };
  budgets: {
    pilotCostUsd: number;
    confirmatoryCostUsd: number;
    pilotTokens: number;
    confirmatoryTokens: number;
  };
  paths: {
    pluginRoot: string;
    bunExecutable: string;
    darrowExecutable: string;
    toolchainHome: string;
  };
}

export interface RepositoryDefinition {
  id: string;
  url: string;
  pinnedRevision: string;
  setupCommand: string;
}

export interface TaskDefinition {
  id: string;
  repository: string;
  phase: Phase;
  stratum: Stratum;
  baseRevision: string;
  oracleRevision: string;
  prompt: string;
  verificationCommand: string;
  grading: "deterministic" | "mixed";
  rubric: string[];
}

export interface Corpus {
  schemaVersion: string;
  repositories: RepositoryDefinition[];
  tasks: TaskDefinition[];
}

export interface Assignment {
  ordinal: number;
  taskId: string;
  repository: string;
  phase: Phase;
  stratum: Stratum;
  harness: Harness;
  treatment: Treatment;
  repeat: number;
  order: number;
}

export interface SanitizationManifest {
  schemaVersion: string;
  sourceRevision: string;
  removedPaths: string[];
  retainedFileCount: number;
  treeDigest: string;
}

export interface CheckObservation {
  command: string;
  exitCode: number;
  durationMs: number;
  passed: boolean;
}

export interface Observation {
  schemaVersion: string;
  runId: string;
  assignment: Assignment;
  startedAt: string;
  finishedAt: string;
  status: "completed" | "waiting" | "failed";
  setupFailure: string | null;
  operationalFailure: string | null;
  harnessVersion: string;
  model: string;
  effort: string;
  permissionMode: string;
  sourceRevision: string;
  runnerRevision: string;
  pluginDigest: string;
  configurationDigest: string;
  sanitizationDigest: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  wallTimeMs: number;
  preparationTimeMs: number;
  harnessTimeMs: number;
  humanAttentionMinutes: number | null;
  interventions: number;
  failures: number;
  retries: number;
  recovered: boolean;
  reworkCount: number;
  deterministicQuality: number;
  blindedQuality: number | null;
  quality: number;
  verification: CheckObservation | null;
  patchPath: string | null;
  rawOutputPath: string;
  darrowRunId: string | null;
  retainedWorkspacePath: string | null;
}

export interface PairEstimate {
  comparison: string;
  tasks: number;
  estimate: number;
  ciLow: number;
  ciHigh: number;
  pValue: number;
}
