export const CONTRACT_VERSION = "0.1.0" as const;

export type Scope = "explicit" | "project" | "user" | "bundled";
export type RunState = "running" | "waiting_for_input" | "completed";
export type Conclusion =
  "succeeded" | "succeeded_with_waivers" | "failed" | "cancelled";

export interface Requirement {
  contract: string;
  version: string;
}

export interface WorkflowDefinition {
  schemaVersion: typeof CONTRACT_VERSION;
  id: string;
  version: string;
  engine: string;
  inputs: Record<
    string,
    { type: "string" | "boolean" | "number"; required: boolean }
  >;
  requirements: { capabilities: Requirement[] };
  profile: string;
  steps: Array<{
    id: string;
    command: { id: string; version: string };
    with: Record<string, unknown>;
  }>;
}

export interface ProfileDefinition {
  schemaVersion: typeof CONTRACT_VERSION;
  id: string;
  harness: "codex";
  provider: "openai";
  model: "gpt-5.6-sol";
  reasoningEffort: "high";
  permissions: { inherit: true };
}

export interface ProjectDefinition {
  schemaVersion: typeof CONTRACT_VERSION;
  defaultProfile: string;
  pluginRoots: string[];
}

export interface CommandMetadata {
  schemaVersion: 1;
  kind: "command";
  contractVersion: string;
  inputSchema: string;
  outputSchema: string;
  requires?: Requirement[];
}

export interface CapabilityMetadata {
  schemaVersion: 1;
  kind: "capability";
  provides: Array<{ contract: string; version: string }>;
}

export type SkillMetadata = CommandMetadata | CapabilityMetadata;

export interface SkillCandidate {
  id: string;
  pluginName: string;
  pluginVersion: string;
  skillName: string;
  skillDir: string;
  pluginDir: string;
  scope: Scope;
  harnessEnabled: boolean;
  metadata: SkillMetadata;
  digest: string;
}

export interface ResolvedPlan {
  schemaVersion: typeof CONTRACT_VERSION;
  engineVersion: typeof CONTRACT_VERSION;
  workflow: {
    id: string;
    version: string;
    source: string;
    scope: Scope;
    digest: string;
  };
  profile: ProfileDefinition & { source: string; digest: string };
  capabilities: Array<{
    contract: string;
    requested: string;
    version: string;
    providerId: string;
    pluginVersion: string;
    scope: Scope;
    source: string;
    digest: string;
  }>;
  steps: Array<{
    id: string;
    commandId: string;
    contractVersion: string;
    source: string;
    digest: string;
    input: Record<string, unknown>;
  }>;
  inputs: Record<string, unknown>;
  digest: string;
}

export interface RunRecord {
  schemaVersion: typeof CONTRACT_VERSION;
  runId: string;
  workflowId: string;
  state: RunState;
  conclusion: Conclusion | null;
  createdAt: string;
  updatedAt: string;
  temporal: Record<string, unknown>;
  workspace: string | null;
  currentStep: string | null;
  error: { category: string; message: string } | null;
}

export interface ActivityInput {
  runId: string;
  repoRoot: string;
  runDir: string;
  workspace: string;
  snapshotDir: string;
  step: ResolvedPlan["steps"][number];
  planCapabilities: ResolvedPlan["capabilities"];
  profile: Omit<ResolvedPlan["profile"], "model"> & { model: string };
  attemptId: string;
}

export interface CommandResult {
  invocationId: string;
  status: "succeeded" | "failed";
  commandId: string;
  contractVersion: string;
  implementationVersion: string;
  payload?: Record<string, unknown>;
  artifacts: ArtifactReference[];
  transcript?: string;
  nativeSessionId?: string;
  usage?: Record<string, number>;
  timing: { startedAt: string; finishedAt: string };
  error?: { category: string; message: string };
}

export interface ArtifactReference {
  schemaVersion: typeof CONTRACT_VERSION;
  artifactId: string;
  type: string;
  schema: string;
  schemaDigest: string;
  contentHash: string;
  size: number;
  stepId: string;
  attemptId: string;
  location: string;
  createdAt: string;
}
