import type { StepExecutionStatus } from "./scheduler";

export const CONTRACT_VERSION = "0.1.0" as const;

export type Scope = "explicit" | "project" | "user" | "bundled";
export type RunState = "running" | "waiting_for_input" | "completed";
export type Conclusion =
  "succeeded" | "succeeded_with_waivers" | "failed" | "cancelled";

export type CancellationMode = "wait_for_boundary" | "interrupt";

export interface CancellationRequest {
  requestedAt: string;
}

export interface CancellationSummary extends CancellationRequest {
  completed: string[];
  incomplete: string[];
  uncertain: string[];
}

export interface HumanChoice {
  id: string;
  consequence: string;
  acceptsInstructions: boolean;
}

export interface HumanRequest {
  requestId: string;
  version: number;
  stepId: string | null;
  reason: string;
  question: string;
  choices: HumanChoice[];
  context: Array<{ label: string; reference: string }>;
}

export interface ContentReference {
  contentId: string;
  mediaType: "text/plain";
  contentHash: string;
  size: number;
  location: string;
}

export interface HumanResponse {
  requestId: string;
  version: number;
  choice: string;
  actor: {
    id: string | null;
    harness: string | null;
    verified: false;
  };
  instructions: ContentReference | null;
  rationale: ContentReference | null;
  model?: string;
}

export type OutcomeValue = string | number | boolean | null;

export interface LoopRegion {
  id: string;
  steps: string[];
  maxAttempts: number;
  until: {
    stepId: string;
    output: string;
    equals: OutcomeValue;
  };
  waiver: {
    id: string;
    description: string;
    instructionsTo: string | null;
  } | null;
}

export interface WaiverRecord {
  waiverId: string;
  loopId: string;
  stepId: string;
  attempt: number;
  outcome: {
    output: string;
    expected: OutcomeValue;
    actual: OutcomeValue;
  };
  actor: HumanResponse["actor"];
  rationale: ContentReference;
  instructions: ContentReference | null;
  instructionsTo: string | null;
}

export interface Requirement {
  contract: string;
  version: string;
}

export interface TicketIdentity {
  backend: string;
  project: string;
  nativeId: string;
  url: string;
}

export interface ArtifactPublication {
  ticket: TicketIdentity;
  artifactTypes: string[];
}

export interface PublishedArtifact {
  publicationId: string;
  artifactId: string;
  runId: string;
  stepId: string;
  attemptId: string;
  type: string;
  contentHash: string;
  size: number;
  sourceLocation: string;
  location: string;
  publishedAt: string;
}

export interface TicketPublicationRecord {
  schemaVersion: typeof CONTRACT_VERSION;
  ticketKey: string;
  ticket: TicketIdentity;
  publications: PublishedArtifact[];
}

export interface TicketPublicationResult {
  ticketKey: string;
  ticket: TicketIdentity;
  artifacts: PublishedArtifact[];
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
  loops: LoopRegion[];
  steps: Array<{
    id: string;
    dependsOn: string[];
    command: { id: string; version: string };
    with: Record<string, unknown>;
    publish?: ArtifactPublication;
  }>;
}

interface BaseProfileDefinition {
  schemaVersion: typeof CONTRACT_VERSION;
  id: string;
  reasoningEffort: "high";
  permissions: { inherit: true };
}

export interface CodexProfileDefinition extends BaseProfileDefinition {
  harness: "codex";
  provider: "openai";
  model: "gpt-5.6-sol";
}

export interface ClaudeProfileDefinition extends BaseProfileDefinition {
  harness: "claude";
  provider: "anthropic";
  model: "claude-sonnet-4-6";
}

export type ProfileDefinition =
  CodexProfileDefinition | ClaudeProfileDefinition;

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
  cancellation?: CancellationMode;
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
  loops: LoopRegion[];
  steps: Array<{
    id: string;
    dependsOn: string[];
    commandId: string;
    contractVersion: string;
    cancellation: CancellationMode;
    source: string;
    digest: string;
    input: Record<string, unknown>;
    publish: ArtifactPublication | null;
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
  steps: StepExecutionStatus[];
  request: HumanRequest | null;
  waivers: WaiverRecord[];
  cancellation: CancellationSummary | null;
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
  instructions: ContentReference[];
  priorArtifacts: ArtifactReference[];
}

export interface PublicationActivityInput {
  repoRoot: string;
  runDir: string;
  runId: string;
  stepId: string;
  attemptId: string;
  publication: ArtifactPublication;
  artifacts: ArtifactReference[];
}

export type PublicationActivityResult =
  | { status: "succeeded"; publication: TicketPublicationResult }
  | {
      status: "failed";
      error: { category: string; message: string };
    };

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
