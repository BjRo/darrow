import {
  lstat,
  readFile,
  readdir,
  readlink,
  writeFile,
} from "node:fs/promises";
import { createHash, createHmac } from "node:crypto";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
import { parseArgs } from "node:util";

const OWNER_MARKER = "- phase: adaptive-goal-runner";
const ATTESTATION_PREFIX = "- darrow_eval_spawn_attestation: ";

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

export interface CodexSpawnGuardPolicy {
  secret: string;
  baselineSha256: string;
  fixtureStateSha256: string;
  requestSha256: string;
  objectiveRoot: string;
  goalLoopPath: string;
  statePath: string;
}

interface CodexSpawnGuardState {
  parentTurnId: string;
  acceptedInputSha256: string;
  acceptedUpdatedInputSha256: string;
  toolUseId?: string;
  attestation: CodexSpawnAttestation;
  acceptedAgentRef?: string;
}

const CONTRACT_LABELS = [
  "Outcome",
  "Acceptance criteria",
  "Scope",
  "Non-goals",
  "Preserved work",
  "Permissions",
  "Workflow sequence",
  "Feedback checks",
  "Final-tree checks",
  "Readiness gate",
  "Independent review",
  "Stopping budget",
  "Human feedback",
  "Completion report",
  "Protocol ledger",
] as const;

const INTERNAL_GOAL_RECORD =
  /^format\tdarrow-(?:native-goal|goal-step|claude-(?:agent-route|route-gate|verify-route))-[^\t\r\n]+$/m;

const FIXTURE_STATE_ENTRY =
  /^(?:fixture-|implementation-readiness-|independent-review-|review-|human-feedback-|verification-|gh-|pricing-|version-|ticketctl\.log$)/;

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
      (entry) => entry === "fixture-bin" || FIXTURE_STATE_ENTRY.test(entry),
    )
    .sort();
  for (const entry of entries)
    await fingerprintEntry(gitDir, join(gitDir, entry), records);
  return sha256(records.join(""));
}

function completeContractLabels(contract: string): boolean {
  const lines = contract.split(/\r?\n/);
  const indexes = CONTRACT_LABELS.map((label) =>
    lines.flatMap((line, index) =>
      line.startsWith(`${label}:`) ? [index] : [],
    ),
  );
  return (
    indexes.every((matches, index) => {
      if (matches.length !== 1) return false;
      const label = CONTRACT_LABELS[index]!;
      const line = lines[matches[0]!]!;
      return (
        line.startsWith(`${label}: `) && !!line.slice(label.length + 2).trim()
      );
    }) &&
    indexes.every((matches, index) =>
      index === 0 ? true : matches[0]! > indexes[index - 1]![0]!,
    )
  );
}

export function goalContractRecordIssues(contract: string): string[] {
  const ledger = contractLabelValue(contract, "Protocol ledger");
  const checks: Array<[string, boolean]> = [
    ["contract_labels", completeContractLabels(contract)],
    [
      "protocol_ledger",
      !!ledger &&
        isAbsolute(ledger) &&
        normalize(ledger) === ledger &&
        basename(ledger).startsWith("darrow-goal-run."),
    ],
    ["internal_goal_record", !INTERNAL_GOAL_RECORD.test(contract)],
  ];
  return checks.filter(([, valid]) => !valid).map(([name]) => name);
}

function contractLabelValue(
  contract: string,
  label: string,
): string | undefined {
  const prefix = `${label}: `;
  const matches = contract
    .split(/\r?\n/)
    .filter((line) => line.startsWith(prefix));
  return matches.length === 1
    ? matches[0]!.slice(prefix.length).trim()
    : undefined;
}

function fileBackedContractReference(
  objective: string,
): { path: string; sha256: string } | undefined {
  const lines = objective.split(/\r?\n/);
  const path = lines[1] ?? "";
  const expected =
    lines[2]?.match(/^Expected SHA-256: ([0-9a-f]{64})$/)?.[1] ?? "";
  const valid = [
    lines.length === 10,
    lines[0] === "Before doing any work, read the complete goal contract at:",
    lines[3] === "Verify the file digest before following the contract.",
    lines[4] ===
      "If the file is missing, unreadable, or does not match, stop and report the evidence gap.",
    lines[5] ===
      "This accepted ownership-marked task makes you the sole work owner.",
    lines[6] ===
      "The applicable launch contract says whether the launcher already persisted this contract in that thread or you must persist this contract in that thread before work.",
    lines[7] ===
      "Goal persistence belongs to the existing work owner; it does not create another owner.",
    lines[8] === "Follow that complete contract through terminal completion.",
    lines[9] === "",
    path.startsWith("/"),
    !!expected,
  ].every(Boolean);
  return valid ? { path, sha256: expected } : undefined;
}

function fileBackedObjectivePath(body: string): string | undefined {
  const match = body.match(/^- objective_file: (\/[^\r\n]+)(?:\r?\n|$)/);
  return match?.[1];
}

interface ResolvedContract {
  contract: string;
  objectiveMode: "inline" | "file-backed";
  attachmentDir?: string;
  objectiveFile?: string;
}

async function validFileBackedContract(
  reference: { path: string; sha256: string },
  objectiveRoot: string,
): Promise<ResolvedContract | undefined> {
  const root = resolve(objectiveRoot);
  const attachmentDir = dirname(reference.path);
  const entries = (await readdir(attachmentDir)).sort();
  const stats = await Promise.all([
    lstat(reference.path),
    lstat(join(attachmentDir, "goal-objective.txt")),
  ]);
  const valid = [
    dirname(attachmentDir) === root,
    basename(attachmentDir).startsWith("darrow-goal-contract."),
    reference.path === join(attachmentDir, "goal-contract.md"),
    entries.join("\n") === "goal-contract.md\ngoal-objective.txt",
    stats.every((stat) => stat.isFile()),
  ].every(Boolean);
  if (!valid) return undefined;
  const contract = await readFile(reference.path, "utf8");
  return sha256(contract) === reference.sha256
    ? {
        contract,
        objectiveMode: "file-backed",
        attachmentDir,
        objectiveFile: join(attachmentDir, "goal-objective.txt"),
      }
    : undefined;
}

async function soleFileBackedContract(
  objectiveRoot: string,
): Promise<ResolvedContract | undefined> {
  try {
    const entries = await readdir(objectiveRoot);
    if (entries.length !== 1) return undefined;
    const attachmentDir = join(resolve(objectiveRoot), entries[0]!);
    const objectiveFile = join(attachmentDir, "goal-objective.txt");
    const objective = await readFile(objectiveFile, "utf8");
    const reference = fileBackedContractReference(objective);
    if (
      !reference ||
      reference.path !== join(attachmentDir, "goal-contract.md")
    )
      return undefined;
    return await validFileBackedContract(reference, objectiveRoot);
  } catch {
    return undefined;
  }
}

async function resolvedContract(
  body: string,
  objectiveRoot: string,
): Promise<ResolvedContract | undefined> {
  const objectivePath = fileBackedObjectivePath(body);
  if (objectivePath) {
    try {
      const objective = await readFile(objectivePath, "utf8");
      const reference = fileBackedContractReference(objective);
      if (
        reference &&
        objectivePath === join(dirname(reference.path), "goal-objective.txt")
      ) {
        const resolved = await validFileBackedContract(
          reference,
          objectiveRoot,
        );
        if (resolved) return resolved;
      }
    } catch {
      // Fall through to the sole ledger-owned objective below.
    }
  }
  const materialized = await soleFileBackedContract(objectiveRoot);
  if (materialized) return materialized;
  const root = resolve(objectiveRoot);
  const entries = await readdir(root);
  if (entries.length === 0) return { contract: body, objectiveMode: "inline" };
  return (await inlineLedgerMatches(body, root, entries))
    ? { contract: body, objectiveMode: "inline" }
    : undefined;
}

async function inlineLedgerMatches(
  body: string,
  root: string,
  entries: string[],
): Promise<boolean> {
  const ledger = contractLabelValue(body, "Protocol ledger");
  if (!ledger) return false;
  let ledgerIsDirectory: boolean;
  try {
    const ledgerStat = await lstat(ledger);
    ledgerIsDirectory =
      ledgerStat.isDirectory() && !ledgerStat.isSymbolicLink();
  } catch {
    return false;
  }
  return [
    dirname(ledger) === root,
    basename(ledger).startsWith("darrow-goal-run."),
    entries.length === 1,
    entries[0] === basename(ledger),
    ledgerIsDirectory,
  ].every(Boolean);
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

function signedState(state: CodexSpawnGuardState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}\n`;
}

async function readGuardState(
  policy: Pick<CodexSpawnGuardPolicy, "statePath" | "secret">,
): Promise<CodexSpawnGuardState | undefined> {
  try {
    const proof = (await readFile(policy.statePath, "utf8")).trim();
    const separator = proof.lastIndexOf(".");
    if (separator < 1) return undefined;
    const payload = proof.slice(0, separator);
    const signature = proof.slice(separator + 1);
    const expected = createHmac("sha256", policy.secret)
      .update(payload)
      .digest("hex");
    if (signature !== expected) return undefined;
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as CodexSpawnGuardState;
  } catch {
    return undefined;
  }
}

/** Exact canonical task_name captured from the signed accepted spawn result. */
export async function verifiedCodexAcceptedAgentRef(
  statePath: string,
  secret: string,
): Promise<string | undefined> {
  const state = await readGuardState({ statePath, secret });
  return canonicalCodexAgentRef(state?.acceptedAgentRef);
}

function hookTurnId(hook: Record<string, unknown>): string | undefined {
  return typeof hook.turn_id === "string" && hook.turn_id
    ? hook.turn_id
    : undefined;
}

function hookToolUseId(hook: Record<string, unknown>): string | undefined {
  return typeof hook.tool_use_id === "string" && hook.tool_use_id
    ? hook.tool_use_id
    : undefined;
}

function ownerInputIdentity(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const record = input as Record<string, unknown>;
  const route = concreteSpawnRoute(record);
  if (!route || typeof record.message !== "string") return undefined;
  return sha256(
    JSON.stringify([
      typeof record.task_name === "string" ? record.task_name : null,
      record.message,
      route.model,
      route.effort,
      record.fork_turns ?? null,
    ]),
  );
}

function concreteSpawnRoute(
  input: Record<string, unknown>,
): { model: string; effort: string } | undefined {
  if (typeof input.model !== "string" || !input.model) return undefined;
  if (typeof input.reasoning_effort !== "string" || !input.reasoning_effort)
    return undefined;
  if (input.fork_turns !== undefined && input.fork_turns !== "none")
    return undefined;
  return { model: input.model, effort: input.reasoning_effort };
}

function attestationLine(
  attestation: CodexSpawnAttestation,
  secret: string,
): string {
  const payload = Buffer.from(JSON.stringify(attestation)).toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${ATTESTATION_PREFIX}${payload}.${signature}`;
}

async function ownerBoundaryIssue(
  cwd: string,
  policy: CodexSpawnGuardPolicy,
): Promise<string | undefined> {
  if ((await repositoryFingerprint(cwd)) !== policy.baselineSha256)
    return "parent worktree changed before adaptive goal owner activation";
  if ((await fixtureStateFingerprint(cwd)) !== policy.fixtureStateSha256)
    return "parent fixture state changed before adaptive goal owner activation";
  return undefined;
}

function spawnAttestation(
  route: { model: string; effort: string },
  body: string,
  resolved: ResolvedContract,
  policy: CodexSpawnGuardPolicy,
): CodexSpawnAttestation {
  const ledger = contractLabelValue(resolved.contract, "Protocol ledger");
  if (!ledger)
    throw new Error("validated goal contract lost its protocol ledger");
  return {
    model: route.model,
    effort: route.effort,
    forkTurns: "none",
    requestSha256: policy.requestSha256,
    objectiveSha256: sha256(body),
    contractSha256: sha256(resolved.contract),
    baselineSha256: policy.baselineSha256,
    fixtureStateSha256: policy.fixtureStateSha256,
    objectiveMode: resolved.objectiveMode,
    ledger,
    ...(resolved.attachmentDir
      ? { attachmentDir: resolved.attachmentDir }
      : {}),
  };
}

function allowedSpawn(
  input: Record<string, unknown>,
  message: string,
  attestation: CodexSpawnAttestation,
  secret: string,
): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: updatedOwnerInput(input, message, attestation, secret),
    },
  };
}

function updatedOwnerInput(
  input: Record<string, unknown>,
  message: string,
  attestation: CodexSpawnAttestation,
  hmacKey: string,
): Record<string, unknown> {
  return {
    ...input,
    fork_turns: "none",
    message: `${message}\n${attestationLine(attestation, hmacKey)}`,
  };
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
  if (
    hook.hook_event_name === "PostToolUse" &&
    ["Agent", "spawn_agent", "spawnAgent"].includes(toolName)
  )
    return observeAcceptedOwner(hook, policy);
  if (toolName === "Bash") return guardParentShell(hook, policy);
  if (toolName === "apply_patch") return guardParentPatch(hook, policy);
  const input = ownerInput(hook.tool_input);
  if (!input) return guardUnmarkedAgent(hook, policy);
  return guardOwnerAgent(hook, input, policy);
}

function canonicalCodexAgentRef(value: unknown): string | undefined {
  return typeof value === "string" && /^\/root(?:\/[a-z0-9_]+)+$/.test(value)
    ? value
    : undefined;
}

function postToolAgentRef(hook: Record<string, unknown>): string | undefined {
  const response = hook.tool_response;
  if (!response || typeof response !== "object" || Array.isArray(response))
    return undefined;
  return canonicalCodexAgentRef(
    (response as Record<string, unknown>).task_name,
  );
}

function acceptedOwnerOutput(agentRef: string): Record<string, unknown> {
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext:
        `Darrow observed accepted native-subagent reference ${agentRef} from task_name. ` +
        "Record it unchanged with the exact documented goal-loop step activate command before waiting.",
    },
  };
}

function deniedPostToolUse(message: string): Record<string, unknown> {
  return denied(message, "PostToolUse");
}

function ownerCompletionBindingIssue(
  hook: Record<string, unknown>,
  state: CodexSpawnGuardState,
): string | undefined {
  const parentTurnId = hookTurnId(hook);
  const postToolUseId = hookToolUseId(hook);
  const inputIdentity = ownerInputIdentity(hook.tool_input);
  const inputMatches = inputIdentity
    ? [state.acceptedInputSha256, state.acceptedUpdatedInputSha256].includes(
        inputIdentity,
      )
    : false;
  const checks: Array<[boolean, string]> = [
    [
      !parentTurnId || parentTurnId !== state.parentTurnId,
      "Codex owner completion is not bound to the accepted parent turn",
    ],
    [
      state.toolUseId !== undefined && postToolUseId !== state.toolUseId,
      "Codex owner completion tool identity changed",
    ],
    [
      !inputMatches,
      "Codex owner completion input does not match the accepted spawn",
    ],
  ];
  return checks.find(([invalid]) => invalid)?.[1];
}

async function observeAcceptedOwner(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown>> {
  const state = await readGuardState(policy);
  if (!state)
    return deniedPostToolUse("Codex owner activation has no accepted spawn");
  const bindingIssue = ownerCompletionBindingIssue(hook, state);
  if (bindingIssue) return deniedPostToolUse(bindingIssue);
  const agentRef = postToolAgentRef(hook);
  if (!agentRef)
    return deniedPostToolUse(
      "Codex owner response omitted a canonical task_name",
    );
  if (state.acceptedAgentRef)
    return state.acceptedAgentRef === agentRef
      ? acceptedOwnerOutput(agentRef)
      : deniedPostToolUse("Codex accepted owner reference changed");
  await writeFile(
    policy.statePath,
    signedState({ ...state, acceptedAgentRef: agentRef }, policy.secret),
    { mode: 0o600 },
  );
  return acceptedOwnerOutput(agentRef);
}

interface CanonicalOwnerContract {
  canonicalBody: string;
  canonicalMessage: string;
  resolved: ResolvedContract;
}

async function canonicalOwnerContract(
  body: string,
  objectiveRoot: string,
): Promise<CanonicalOwnerContract | string> {
  const resolved = await resolvedContract(body, objectiveRoot);
  if (!resolved)
    return "adaptive goal owner objective was not a valid inline or file-backed contract";
  const contractIssues = goalContractRecordIssues(resolved.contract);
  if (contractIssues.length)
    return `adaptive goal owner contract has invalid fields: ${contractIssues.join(", ")}`;
  const canonicalBody = resolved.objectiveFile
    ? `- objective_file: ${resolved.objectiveFile}`
    : body;
  return {
    canonicalBody,
    canonicalMessage: `${OWNER_MARKER}\n${canonicalBody}`,
    resolved,
  };
}

async function persistOwnerGuardState(
  state: CodexSpawnGuardState,
  policy: CodexSpawnGuardPolicy,
): Promise<boolean> {
  try {
    await writeFile(policy.statePath, signedState(state, policy.secret), {
      mode: 0o600,
      flag: "wx",
    });
    return true;
  } catch {
    return false;
  }
}

interface OwnerGuardStateInput {
  hook: Record<string, unknown>;
  input: Record<string, unknown>;
  attestation: CodexSpawnAttestation;
  canonicalMessage: string;
  policy: CodexSpawnGuardPolicy;
}

async function establishOwnerGuardState({
  hook,
  input,
  attestation,
  canonicalMessage,
  policy,
}: OwnerGuardStateInput): Promise<string | undefined> {
  const parentTurnId = hookTurnId(hook);
  if (!parentTurnId)
    return "adaptive goal owner spawn has no host turn identity";
  const acceptedInputSha256 = ownerInputIdentity(input);
  const updatedInputSha256 = ownerInputIdentity(
    updatedOwnerInput(input, canonicalMessage, attestation, policy.secret),
  );
  if (!acceptedInputSha256 || !updatedInputSha256)
    return "adaptive goal owner spawn identity could not be bound";
  const toolUseId = hookToolUseId(hook);
  const persisted = await persistOwnerGuardState(
    {
      parentTurnId,
      acceptedInputSha256,
      acceptedUpdatedInputSha256: updatedInputSha256,
      ...(toolUseId ? { toolUseId } : {}),
      attestation,
    },
    policy,
  );
  return persisted
    ? undefined
    : "adaptive goal owner activation state could not be established; retry is forbidden";
}

async function guardOwnerAgent(
  hook: Record<string, unknown>,
  input: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown>> {
  if (await readGuardState(policy))
    return denied(
      "adaptive goal owner activation was already attempted; retries are forbidden",
    );
  const route = concreteSpawnRoute(input);
  const message = input.message as string;
  if (!route)
    return denied(
      "adaptive goal owner requires concrete model and effort without a conflicting fork_turns value",
    );
  const cwd = String(hook.cwd ?? "");
  const boundaryIssue = await ownerBoundaryIssue(cwd, policy);
  if (boundaryIssue) return denied(boundaryIssue);
  const body = message.slice(OWNER_MARKER.length + 1);
  const contract = await canonicalOwnerContract(body, policy.objectiveRoot);
  if (typeof contract === "string") return denied(contract);
  const attestation = spawnAttestation(
    route,
    contract.canonicalBody,
    contract.resolved,
    policy,
  );
  const stateIssue = await establishOwnerGuardState({
    hook,
    input,
    attestation,
    canonicalMessage: contract.canonicalMessage,
    policy,
  });
  if (stateIssue) return denied(stateIssue);
  return allowedSpawn(
    input,
    contract.canonicalMessage,
    attestation,
    policy.secret,
  );
}

async function guardUnmarkedAgent(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const state = await readGuardState(policy);
  const turn = hookTurnId(hook);
  if (state && turn && turn !== state.parentTurnId) return undefined;
  return denied(
    "only the ownership-marked adaptive goal Agent may start from the parent thread",
  );
}

function shellCommand(hook: Record<string, unknown>): string | undefined {
  const input = hook.tool_input;
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const command = (input as Record<string, unknown>).command;
  return typeof command === "string" ? command.trim() : undefined;
}

function parentLifecycleShellAllowed(
  command: string,
  state: CodexSpawnGuardState,
  policy: CodexSpawnGuardPolicy,
): boolean {
  if (/^(?:[^\s/]+\/)*feedbackctl answer [A-Za-z0-9._-]+$/.test(command))
    return true;
  if (parentActivationCommand(command, state, policy)) return true;
  if (parentLaunchStopCommand(command, state, policy)) return true;
  if (parentReportCommand(command, state, policy)) return true;
  const attachment = state.attestation.attachmentDir;
  if (!attachment) return false;
  return (
    command ===
    `/bin/bash ${policy.goalLoopPath} step release-objective --ledger ${state.attestation.ledger} --attachment-dir ${attachment} --expected-sha256 ${state.attestation.contractSha256}`
  );
}

function parentActivationCommand(
  command: string,
  state: CodexSpawnGuardState,
  policy: CodexSpawnGuardPolicy,
): boolean {
  const prefix =
    `/bin/bash ${policy.goalLoopPath} step activate ` +
    `--ledger ${state.attestation.ledger} ` +
    "--applied-by native-subagent --boundary native_subagent --agent-ref ";
  const suffix =
    " --effective-route " +
    `'codex|openai|${state.attestation.model}|${state.attestation.effort}' ` +
    "--route-verified true";
  if (!command.startsWith(prefix) || !command.endsWith(suffix)) return false;
  const agentRef = command.slice(prefix.length, -suffix.length);
  return (
    canonicalCodexAgentRef(agentRef) === agentRef &&
    agentRef === state.acceptedAgentRef
  );
}

function parentLaunchStopCommand(
  command: string,
  state: CodexSpawnGuardState,
  policy: CodexSpawnGuardPolicy,
): boolean {
  const agentRef = state.acceptedAgentRef;
  return (
    !!agentRef &&
    command ===
      `/bin/bash ${policy.goalLoopPath} step launch-stop ` +
        `--ledger ${state.attestation.ledger} --reason launch-unavailable ` +
        `--agent-ref ${agentRef}`
  );
}

function parentReportCommand(
  command: string,
  state: CodexSpawnGuardState,
  policy: CodexSpawnGuardPolicy,
): boolean {
  const prefix =
    `/bin/bash ${policy.goalLoopPath} step report ` +
    `--ledger ${state.attestation.ledger} --status `;
  if (!command.startsWith(prefix)) return false;
  return /^(?:complete|blocked|launch-required) --human-interruptions \d+$/.test(
    command.slice(prefix.length),
  );
}

async function guardParentShell(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const command = shellCommand(hook);
  if (!command) return denied("malformed parent shell command");
  const state = await readGuardState(policy);
  const turn = hookTurnId(hook);
  if (state && turn !== state.parentTurnId) return undefined;
  if (state)
    return parentLifecycleShellAllowed(command, state, policy)
      ? undefined
      : denied(
          "parent shell commands are forbidden after goal owner activation",
        );
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

function patchTarget(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return undefined;
  const patch = (input as Record<string, unknown>).command;
  if (typeof patch !== "string") return undefined;
  const targets = [
    ...patch.matchAll(/^\*\*\* (Add|Update|Delete) File: (.+)$/gm),
  ];
  return targets.length === 1 && targets[0]![1] === "Add"
    ? targets[0]![2]
    : undefined;
}

async function guardParentPatch(
  hook: Record<string, unknown>,
  policy: CodexSpawnGuardPolicy,
): Promise<Record<string, unknown> | undefined> {
  const state = await readGuardState(policy);
  const turn = hookTurnId(hook);
  if (state && turn !== state.parentTurnId) return undefined;
  if (state)
    return denied(
      "parent file changes are forbidden after goal owner activation",
    );
  const target = patchTarget(hook.tool_input);
  const root = `${resolve(policy.objectiveRoot)}/`;
  return target && resolve(target).startsWith(root)
    ? undefined
    : denied(
        "the classifier may write only one private objective staging file",
      );
}

function finalAttestationProof(lines: string[]): string | undefined {
  const proofs = lines.filter((line) => line.startsWith(ATTESTATION_PREFIX));
  if (proofs.length !== 1 || lines.at(-1) !== proofs[0]) return undefined;
  return proofs[0]!.slice(ATTESTATION_PREFIX.length);
}

function decodedAttestation(
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
    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function validAttestation(
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

export function verifiedCodexSpawnAttestation(
  prompt: string,
  secret: string,
): CodexSpawnAttestation | undefined {
  const lines = prompt.split(/\r?\n/);
  const proof = finalAttestationProof(lines);
  if (!proof) return undefined;
  const record = decodedAttestation(proof, secret);
  if (!record) return undefined;
  const body = lines.slice(1, -1).join("\n");
  return validAttestation(record, body)
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
