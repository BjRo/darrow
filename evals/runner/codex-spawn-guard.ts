import {
  lstat,
  readFile,
  readdir,
  readlink,
  writeFile,
} from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const OWNER_MARKER = "- phase: adaptive-delivery-owner";
const CODEX_AGENT_REF =
  /^(?:\/root(?:\/[a-z0-9_]+)+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const LEGACY_ATTESTATION_PREFIX = "- darrow_eval_spawn_attestation: ";
const REQUIRED_CONTRACT_LABELS = [
  "Role",
  "Outcome",
  "Acceptance criteria",
  "Scope and authority",
  "Execution",
  "Verification and gates",
  "Completion evidence",
] as const;
const FIXTURE_STATE_ENTRY =
  /^(?:fixture-|implementation-readiness-|independent-review-|review-|human-feedback-|verification-|gh-|pricing-|version-|ticketctl\.log$)/;
const PREFLIGHT_TRACE_ENTRY =
  /^implementation-readiness-(?:invocations|pre-status)$/;

export interface CodexSpawnGuardPolicy {
  secret: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  requestSha256: string;
  objectiveRoot: string;
  goalLoopPath: string;
  statePath: string;
}

interface AcceptedRoute {
  model: string;
  effort: string;
  forkTurns: "none";
}

interface CodexSpawnGuardState {
  route: AcceptedRoute;
  workflow: string;
  risk: "routine" | "elevated" | "high";
  profile: string;
}

/** Historical proof shape retained only so old result artifacts remain readable. */
export interface CodexSpawnAttestation {
  model: string;
  effort: string;
  forkTurns: "none";
  requestSha256: string;
  objectiveSha256: string;
  contractSha256: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  objectiveMode: "inline" | "file-backed";
  ledger: string;
  attachmentDir?: string;
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fingerprintEntry(
  root: string,
  path: string,
  records: string[],
  excludeGitDirectory = false,
): Promise<void> {
  const stat = await lstat(path);
  const name = relative(root, path);
  if (stat.isDirectory()) {
    if (excludeGitDirectory && name === ".git") return;
    records.push(`dir\0${name}\0`);
    const entries = await readdir(path);
    entries.sort();
    for (const entry of entries)
      await fingerprintEntry(
        root,
        join(path, entry),
        records,
        excludeGitDirectory,
      );
    return;
  }
  if (stat.isSymbolicLink()) {
    records.push(`link\0${name}\0${await readlink(path)}\0`);
    return;
  }
  if (!stat.isFile()) throw new Error(`unsupported worktree entry: ${name}`);
  const contents = await readFile(path);
  records.push(
    `file\0${name}\0${stat.mode & 0o111 ? "x" : "-"}\0${sha256(contents)}\0`,
  );
}

async function fingerprintFixtureStateDirectory(
  gitDir: string,
  records: string[],
): Promise<void> {
  const directory = join(gitDir, "fixture-state");
  records.push("dir\0fixture-state\0");
  const entries = await readdir(directory);
  entries.sort();
  for (const entry of entries) {
    if (PREFLIGHT_TRACE_ENTRY.test(entry)) continue;
    await fingerprintEntry(gitDir, join(directory, entry), records);
  }
}

/** Content identity for the repository worktree, excluding Git-private state. */
export async function repositoryFingerprint(repoDir: string): Promise<string> {
  const root = resolve(repoDir);
  const records: string[] = [];
  const entries = await readdir(root);
  entries.sort();
  for (const entry of entries)
    await fingerprintEntry(root, join(root, entry), records, true);
  return sha256(records.join(""));
}

/** Identity for evaluator-owned fixture inputs and traces stored in .git. */
export async function fixtureStateFingerprint(
  repoDir: string,
): Promise<string> {
  const gitDir = join(resolve(repoDir), ".git");
  const records: string[] = [];
  const entries = (await readdir(gitDir))
    .filter(
      (entry) =>
        !PREFLIGHT_TRACE_ENTRY.test(entry) &&
        (entry === "fixture-bin" || FIXTURE_STATE_ENTRY.test(entry)),
    )
    .sort();
  for (const entry of entries) {
    if (entry === "fixture-state")
      await fingerprintFixtureStateDirectory(gitDir, records);
    else await fingerprintEntry(gitDir, join(gitDir, entry), records);
  }
  return sha256(records.join(""));
}

function denied(
  reason: string,
  hookEventName = "PreToolUse",
): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  };
}

function stateProof(state: CodexSpawnGuardState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}\n`;
}

function decodedProof(
  proof: string,
  secret: string,
): Record<string, unknown> | undefined {
  const separator = proof.lastIndexOf(".");
  if (separator < 1) return undefined;
  const payload = proof.slice(0, separator);
  const signature = proof.slice(separator + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (signature !== expected) return undefined;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function canonicalCodexAgentRef(value: unknown): string | undefined {
  return typeof value === "string" && CODEX_AGENT_REF.test(value)
    ? value
    : undefined;
}

function validAcceptedRoute(value: unknown): value is AcceptedRoute {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const route = value as Record<string, unknown>;
  return (
    typeof route.model === "string" &&
    !!route.model &&
    typeof route.effort === "string" &&
    !!route.effort &&
    route.forkTurns === "none"
  );
}

function validGuardState(value: unknown): value is CodexSpawnGuardState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return [
    validAcceptedRoute(state.route),
    typeof state.workflow === "string" && !!state.workflow,
    ["routine", "elevated", "high"].includes(String(state.risk)),
    typeof state.profile === "string" && !!state.profile,
  ].every(Boolean);
}

async function readGuardState(
  policy: Pick<CodexSpawnGuardPolicy, "statePath" | "secret">,
): Promise<CodexSpawnGuardState | undefined> {
  try {
    const decoded = decodedProof(
      (await readFile(policy.statePath, "utf8")).trim(),
      policy.secret,
    );
    return validGuardState(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

/** Accepted owner and route captured by the eval-only spawn guard. */
export async function verifiedCodexAcceptedOwner(
  statePath: string,
  secret: string,
  observedAgentRef?: string,
): Promise<
  | {
      agentRef: string;
      model: string;
      effort: string;
      forkTurns: "none";
      workflow: string;
      risk: "routine" | "elevated" | "high";
      profile: string;
    }
  | undefined
> {
  const state = await readGuardState({ statePath, secret });
  const agentRef = canonicalCodexAgentRef(observedAgentRef);
  return state && agentRef
    ? {
        agentRef,
        model: state.route.model,
        effort: state.route.effort,
        forkTurns: "none",
        workflow: state.workflow,
        risk: state.risk,
        profile: state.profile,
      }
    : undefined;
}

function concreteSpawnRoute(
  input: Record<string, unknown>,
): Omit<AcceptedRoute, "forkTurns"> | undefined {
  if (typeof input.model !== "string" || !input.model) return undefined;
  if (typeof input.reasoning_effort !== "string" || !input.reasoning_effort)
    return undefined;
  if (input.fork_turns !== undefined && input.fork_turns !== "none")
    return undefined;
  return { model: input.model, effort: input.reasoning_effort };
}

function ownerInput(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const record = input as Record<string, unknown>;
  return typeof record.message === "string" &&
    record.message.startsWith(`${OWNER_MARKER}\n`)
    ? record
    : undefined;
}

function contractLabelValue(
  contract: string,
  label: string,
): string | undefined {
  const prefix = `${label}:`;
  const matches = contract
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix));
  if (matches.length !== 1) return undefined;
  const value = matches[0]!.slice(prefix.length).trim();
  return value || undefined;
}

function semanticSelectedRoute(value: string | undefined): string | undefined {
  const matches = value?.match(
    /[A-Za-z0-9._-]+(?:\s*(?:\||\/|>)\s*[A-Za-z0-9._-]+){3}/g,
  );
  if (matches?.length !== 1) return undefined;
  return matches[0]
    .replace(/[.,;:]$/, "")
    .split(/\s*(?:\||\/|>)\s*/)
    .join("|");
}

function structuredContractValue(value: string | undefined, key: string) {
  const match = value?.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
  return match?.[1]?.trim() || undefined;
}

function completeStructuredContractField(
  value: string | undefined,
  keys: string[],
) {
  return keys.every((key) => structuredContractValue(value, key));
}

function normalizedContractRisk(
  value: string | undefined,
): "routine" | "elevated" | "high" | undefined {
  const risk = value
    ?.trim()
    .replace(/^`/, "")
    .match(/^(routine|elevated|high)(?:`|[\s.,:]|$)/i)?.[1]
    ?.toLowerCase();
  return risk === "routine" || risk === "elevated" || risk === "high"
    ? risk
    : undefined;
}

function ownerDimensions(input: Record<string, unknown>) {
  const contract = String(input.message)
    .slice(OWNER_MARKER.length + 1)
    .trim();
  const execution = contractLabelValue(contract, "Execution");
  const risk = normalizedContractRisk(
    structuredContractValue(execution, "risk"),
  );
  const workflow = structuredContractValue(execution, "workflow");
  const profile = structuredContractValue(execution, "profile");
  return workflow && profile && risk
    ? {
        workflow,
        profile,
        risk,
      }
    : undefined;
}

function structuredOwnerContractIssue(
  contract: string,
  input: Record<string, unknown>,
  route: Omit<AcceptedRoute, "forkTurns">,
): string | undefined {
  if (
    !completeStructuredContractField(
      contractLabelValue(contract, "Scope and authority"),
      ["included", "authorized", "forbidden", "preserve"],
    )
  )
    return "adaptive delivery owner contract has incomplete scope or authority";
  const execution = contractLabelValue(contract, "Execution");
  if (
    !completeStructuredContractField(execution, [
      "workflow",
      "sequence",
      "risk",
      "profile",
      "route",
      "capabilities",
    ])
  )
    return "adaptive delivery owner contract has incomplete execution policy";
  if (!ownerDimensions(input))
    return "adaptive delivery owner contract has invalid workflow, risk, or profile";
  if (
    !completeStructuredContractField(
      contractLabelValue(contract, "Verification and gates"),
      ["readiness", "review", "focused", "final", "feedback", "blockers"],
    )
  )
    return "adaptive delivery owner contract has incomplete verification or gates";
  const expectedRoute = `codex|openai|${route.model}|${route.effort}`;
  return semanticSelectedRoute(structuredContractValue(execution, "route")) ===
    expectedRoute
    ? undefined
    : "adaptive delivery owner contract route does not match the host spawn";
}

function ownerContractIssue(
  input: Record<string, unknown>,
  route: Omit<AcceptedRoute, "forkTurns">,
): string | undefined {
  const message = String(input.message);
  const contract = message.slice(OWNER_MARKER.length + 1).trim();
  if (contract.length < 80)
    return "adaptive delivery owner contract is missing or incomplete";
  if (
    /Protocol ledger|goal-loop step|darrow-native-goal-report|objective_file/i.test(
      contract,
    )
  )
    return "adaptive delivery owner contract contains removed lifecycle protocol";
  const missing = REQUIRED_CONTRACT_LABELS.filter(
    (label) => !contractLabelValue(contract, label),
  );
  if (missing.length)
    return `adaptive delivery owner contract is missing fields: ${missing.join(", ")}`;
  if (
    contractLabelValue(contract, "Role") !==
    "You are the already-launched sole engineering owner. Perform this contract directly; do not invoke adaptive-delivery or seek another owner."
  )
    return "adaptive delivery owner contract has an invalid role";
  return structuredOwnerContractIssue(contract, input, route);
}

async function ownerBoundaryIssue(
  cwd: string,
  policy: CodexSpawnGuardPolicy,
): Promise<string | undefined> {
  const [repository, fixture] = await Promise.all([
    repositoryFingerprint(cwd),
    fixtureStateFingerprint(cwd),
  ]);
  if (repository !== policy.baselineSha256)
    return "parent worktree changed before adaptive delivery owner activation";
  if (fixture !== policy.fixtureStateSha256)
    return "parent fixture state changed before adaptive delivery owner activation";
  return undefined;
}

async function persistOwnerState(
  input: Record<string, unknown>,
  route: Omit<AcceptedRoute, "forkTurns">,
  policy: CodexSpawnGuardPolicy,
): Promise<string | undefined> {
  const state: CodexSpawnGuardState = {
    route: { ...route, forkTurns: "none" },
    ...ownerDimensions(input)!,
  };
  try {
    await writeFile(policy.statePath, stateProof(state, policy.secret), {
      mode: 0o600,
      flag: "wx",
    });
    return undefined;
  } catch {
    return "adaptive delivery owner activation state could not be established; retry is forbidden";
  }
}

async function guardOwnerAgent(
  hook: Record<string, unknown>,
  input: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown>> {
  if (await readGuardState(policy))
    return denied(
      "adaptive delivery owner activation was already attempted; retries are forbidden",
    );
  const route = concreteSpawnRoute(input);
  if (!route)
    return denied(
      "adaptive delivery owner requires concrete model and effort without a conflicting fork_turns value",
    );
  const contractIssue = ownerContractIssue(input, route);
  if (contractIssue) return denied(contractIssue);
  const boundaryIssue = await ownerBoundaryIssue(
    String(hook.cwd ?? ""),
    policy,
  );
  if (boundaryIssue) return denied(boundaryIssue);
  const stateIssue = await persistOwnerState(input, route, policy);
  if (stateIssue) return denied(stateIssue);
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: { ...input, fork_turns: "none" },
    },
  };
}

async function guardUnmarkedAgent(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const state = await readGuardState(policy);
  if (state) return undefined;
  return denied(
    "only the ownership-marked adaptive delivery Agent may start from the parent thread",
  );
}

function shellCommand(hook: Record<string, unknown>): string | undefined {
  const input = hook.tool_input;
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const command = (input as Record<string, unknown>).command;
  return typeof command === "string" ? command.trim() : undefined;
}

async function guardParentShell(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const command = shellCommand(hook);
  if (!command) return denied("malformed parent shell command");
  const state = await readGuardState(policy);
  if (state) return undefined;
  if (
    /\b(?:test\.sh|independent-review-fixture)\b|\b(?:bun|npm|pnpm)\s+(?:run\s+)?test\b|\bnode\s+--test\b/.test(
      command,
    )
  )
    return denied(
      "the classifier cannot execute verification or review before activation",
    );
  return undefined;
}

async function guardParentPatch(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const state = await readGuardState(policy);
  if (state) return undefined;
  return denied("the adaptive-delivery classifier is read-only");
}

export async function guardCodexSpawn(
  hookInput: unknown,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  if (!hookInput || typeof hookInput !== "object" || Array.isArray(hookInput))
    return denied("malformed Codex hook input");
  const hook = hookInput as Record<string, unknown>;
  const toolName =
    typeof hook.tool_name === "string" ? hook.tool_name : "Agent";
  if (toolName === "Bash") return guardParentShell(hook, policy);
  if (toolName === "apply_patch") return guardParentPatch(hook, policy);
  const input = ownerInput(hook.tool_input);
  return input
    ? guardOwnerAgent(hook, input, policy)
    : guardUnmarkedAgent(hook, policy);
}

function validLegacyAttestation(
  record: Record<string, unknown>,
  body: string,
): boolean {
  return [
    typeof record.model === "string",
    typeof record.effort === "string",
    record.forkTurns === "none",
    /^[0-9a-f]{64}$/.test(String(record.requestSha256 ?? "")),
    record.objectiveSha256 === sha256(body),
    /^[0-9a-f]{64}$/.test(String(record.contractSha256 ?? "")),
    /^[0-9a-f]{64}$/.test(String(record.baselineSha256 ?? "")),
    /^[0-9a-f]{64}$/.test(String(record.fixtureStateSha256 ?? "")),
    record.objectiveMode === "inline" || record.objectiveMode === "file-backed",
    typeof record.ledger === "string" &&
      isAbsolute(record.ledger) &&
      normalize(record.ledger) === record.ledger,
    record.objectiveMode !== "file-backed" ||
      (typeof record.attachmentDir === "string" &&
        record.attachmentDir.startsWith("/")),
  ].every(Boolean);
}

/** Read old result artifacts; new owner prompts deliberately carry no proof line. */
export function verifiedCodexSpawnAttestation(
  prompt: string,
  secret: string,
): CodexSpawnAttestation | undefined {
  const lines = prompt.split(/\r?\n/);
  const proofs = lines.filter((line) =>
    line.startsWith(LEGACY_ATTESTATION_PREFIX),
  );
  if (proofs.length !== 1 || lines.at(-1) !== proofs[0]) return undefined;
  const proof = proofs[0]!.slice(LEGACY_ATTESTATION_PREFIX.length);
  const record = decodedProof(proof, secret);
  if (!record) return undefined;
  const body = lines.slice(1, -1).join("\n");
  return validLegacyAttestation(record, body)
    ? (record as unknown as CodexSpawnAttestation)
    : undefined;
}

async function readStdin(): Promise<unknown> {
  return JSON.parse(await new Response(Bun.stdin.stream()).text());
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      secret: { type: "string" },
      baseline: { type: "string" },
      "fixture-state": { type: "string" },
      request: { type: "string" },
      "objective-root": { type: "string" },
      "goal-loop": { type: "string" },
      state: { type: "string" },
    },
  });
  if (
    !values.secret ||
    !values.baseline ||
    !values["fixture-state"] ||
    !values.request ||
    !values["objective-root"] ||
    !values["goal-loop"] ||
    !values.state
  )
    process.exit(64);
  const result = await guardCodexSpawn(await readStdin(), {
    secret: values.secret,
    baselineSha256: values.baseline,
    fixtureStateSha256: values["fixture-state"],
    requestSha256: values.request,
    objectiveRoot: values["objective-root"],
    goalLoopPath: values["goal-loop"],
    statePath: values.state,
  });
  if (result) process.stdout.write(`${JSON.stringify(result)}\n`);
}
