export const CORE_TREATMENTS = ["native", "plugins", "cli"] as const;
export const POLICY_DIAGNOSTIC_TREATMENTS = [
  "native-no-tdd",
  "plugins-no-tdd",
] as const;
export const OPERATIONAL_DIAGNOSTIC_TREATMENTS = [
  "manual-playbook",
  "cli-playbook",
] as const;
export const TREATMENTS = [
  ...CORE_TREATMENTS,
  ...POLICY_DIAGNOSTIC_TREATMENTS,
  ...OPERATIONAL_DIAGNOSTIC_TREATMENTS,
] as const;
export const HARNESSES = ["codex", "claude"] as const;

export type CoreTreatment = (typeof CORE_TREATMENTS)[number];
export type OperationalDiagnosticTreatment =
  (typeof OPERATIONAL_DIAGNOSTIC_TREATMENTS)[number];
export type Treatment = (typeof TREATMENTS)[number];
export type Harness = (typeof HARNESSES)[number];
export type Phase = "smoke" | "pilot" | "confirmatory";
export type Stratum = "simple" | "orchestrated";

export interface Route {
  executable: string;
  version: string;
  model: string;
  permissionMode: string;
  authFiles: string[];
}

export interface EffectiveRoute extends Route {
  effort: string;
}

export interface Protocol {
  schemaVersion: string;
  preregisteredAt: string;
  amendedAt: string;
  frozenSeed: string;
  treatments: CoreTreatment[];
  harnesses: Record<Harness, Route>;
  phases: Record<
    Phase,
    {
      repeats: number;
      timeoutMinutes: number;
      effort: string;
      taskId?: string;
    }
  >;
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
  budgets: Record<Phase, { costUsd: number; tokens: number }>;
  paths: {
    pluginRoot: string;
    bunExecutable: string;
    darrowExecutable: string;
    toolchainHome: string;
  };
}

export interface OperationalDiagnostic {
  schemaVersion: string;
  id: string;
  phase: Phase;
  repeats: number;
  treatments: OperationalDiagnosticTreatment[];
  taskIds: string[];
}

export interface OperatorStudy extends OperationalDiagnostic {
  preregisteredAt: string;
  frozenSeed: string;
  harnesses: Harness[];
  thresholds: {
    minCliUnattendedCompletions: number;
    minCliQualityQualifiedUnattendedCompletions: number;
    maxCliQualityDeficit: number;
    maxCliInterventions: number;
    maxCliOperationalFailures: number;
    maxWallTimeRatio: number;
    maxResourceRatio: number;
  };
  budget: {
    costUsd: number;
    tokens: number;
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
  oracleTestAdjustments?: Array<{
    path: string;
    find: string;
    replace: string;
  }>;
  prompt: string;
  verificationCommand: string;
  verificationCwd?: string;
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
  failureCategory: string | null;
  outputPath: string | null;
}

export interface OperationalMetrics {
  operatorLaunchesRequired: number;
  operatorHandoffsRequired: number;
  operatorReturnsRequired?: number;
  expectedStages: number;
  executedStages: number;
  finishedStages: number;
  unattendedCompletion: boolean;
}

export interface OperatorAttentionInterval {
  label: string;
  durationMs: number;
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
  timeoutMs: number;
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
  treatmentSetupTimeMs: number;
  harnessTimeMs: number;
  humanAttentionMinutes: number | null;
  operatorAttentionIntervals?: OperatorAttentionInterval[];
  operationalMetrics?: OperationalMetrics | null;
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
  tracePath: string | null;
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
